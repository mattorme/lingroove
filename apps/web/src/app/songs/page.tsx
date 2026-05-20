"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AddToPlaylistMenu } from "@/components/AddToPlaylistMenu";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { deleteSong, listSongs, songSourceLabel, type SongSummary } from "@/lib/api";

type ContextMenu = { x: number; y: number; song: SongSummary };
type DeleteModal = { ids: number[]; title: string };

export default function SongsPage() {
  const router = useRouter();
  const { user, loading } = useRequireAuth();
  const [songs, setSongs] = useState<SongSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [deleteModal, setDeleteModal] = useState<DeleteModal | null>(null);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const lastClickedId = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await listSongs();
      setSongs(res.songs);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load songs.");
    }
  }, []);

  useEffect(() => {
    if (user) void refresh();
  }, [user, refresh]);

  // Close context menu on outside click or Escape
  useEffect(() => {
    if (!contextMenu) return;
    function onMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setContextMenu(null);
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [contextMenu]);

  // Close modal on Escape
  useEffect(() => {
    if (!deleteModal) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setDeleteModal(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [deleteModal]);

  // Delete key opens modal for selected songs
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (selectedIds.size === 0 || deleteModal) return;
      e.preventDefault();
      const ids = [...selectedIds];
      const names = songs.filter((s) => ids.includes(s.id));
      const title = names.length === 1 ? `"${names[0].title}"` : `${names.length} songs`;
      setDeleteModal({ ids, title });
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedIds, deleteModal, songs]);

  if (loading || !user) return null;

  const query = search.trim().toLowerCase();
  const filtered = query
    ? songs.filter(
        (s) =>
          s.title.toLowerCase().includes(query) ||
          (s.artist ?? "").toLowerCase().includes(query),
      )
    : songs;

  function handleRowClick(e: React.MouseEvent, songId: number) {
    const target = e.target as HTMLElement;
    if (target.closest("a") || target.closest("button") || target.closest("select")) return;
    setContextMenu(null);

    if (e.shiftKey && lastClickedId.current !== null) {
      const anchorIdx = filtered.findIndex((s) => s.id === lastClickedId.current);
      const currentIdx = filtered.findIndex((s) => s.id === songId);
      if (anchorIdx !== -1 && currentIdx !== -1) {
        const start = Math.min(anchorIdx, currentIdx);
        const end = Math.max(anchorIdx, currentIdx);
        setSelectedIds(new Set(filtered.slice(start, end + 1).map((s) => s.id)));
        return;
      }
    }

    lastClickedId.current = songId;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (e.metaKey || e.ctrlKey) {
        next.has(songId) ? next.delete(songId) : next.add(songId);
      } else if (next.has(songId) && next.size === 1) {
        next.clear();
      } else {
        next.clear();
        next.add(songId);
      }
      return next;
    });
  }

  function handleContextMenu(e: React.MouseEvent, song: SongSummary) {
    e.preventDefault();
    if (!selectedIds.has(song.id)) setSelectedIds(new Set([song.id]));
    const x = Math.min(e.clientX, window.innerWidth - 192);
    const y = Math.min(e.clientY, window.innerHeight - 100);
    setContextMenu({ x, y, song });
  }

  function openDeleteModal(ids: number[]) {
    setContextMenu(null);
    const names = songs.filter((s) => ids.includes(s.id));
    const title =
      names.length === 1
        ? `"${names[0].title}"`
        : `${names.length} songs`;
    setDeleteModal({ ids, title });
  }

  async function onConfirmDelete() {
    if (!deleteModal) return;
    setDeleting(true);
    setLoadError(null);
    try {
      await Promise.all(deleteModal.ids.map((id) => deleteSong(id)));
      setSongs((prev) => prev.filter((s) => !deleteModal.ids.includes(s.id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        deleteModal.ids.forEach((id) => next.delete(id));
        return next;
      });
      setDeleteModal(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to delete.");
    } finally {
      setDeleting(false);
    }
  }

  const someSelected = selectedIds.size > 0;

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-semibold">Songs</h1>
        <p className="text-textSecondary">All your imported songs.</p>
      </section>

      {loadError ? <p className="text-sm text-red-400">{loadError}</p> : null}

      <section className="card space-y-4">
        {/* ── toolbar ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-textSecondary">
              {songs.length} {songs.length === 1 ? "song" : "songs"}
            </span>
            {someSelected && (
              <>
                <span className="text-white/20">·</span>
                <span className="font-medium">{selectedIds.size} selected</span>
                <button
                  type="button"
                  onClick={() => openDeleteModal([...selectedIds])}
                  className="rounded-lg border border-red-500/50 px-2.5 py-1 text-xs text-red-400 transition hover:border-red-500 hover:text-red-300"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="ml-1 text-xs text-textSecondary transition hover:text-textPrimary"
                >
                  ✕
                </button>
              </>
            )}
          </div>
          <input
            type="search"
            placeholder="Search by title or artist…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-surfaceSoft px-3 py-2 text-sm sm:max-w-xs"
          />
        </div>

        {/* ── list ── */}
        {songs.length === 0 ? (
          <p className="text-sm text-textSecondary">
            No songs yet.{" "}
            <Link href="/dashboard" className="text-accent underline">
              Import lyrics
            </Link>{" "}
            to get started.
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-textSecondary">No songs match &quot;{search}&quot;.</p>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((s) => (
              <li
                key={s.id}
                onClick={(e) => handleRowClick(e, s.id)}
                onContextMenu={(e) => handleContextMenu(e, s)}
                className={`cursor-default select-none rounded-lg px-2 py-2.5 transition-colors ${
                  selectedIds.has(s.id) ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <p>
                      <Link
                        href={`/analysis/${s.id}`}
                        className="font-medium transition hover:text-accent"
                      >
                        {s.title}
                      </Link>
                      {s.artist ? (
                        <span className="text-textSecondary"> · {s.artist}</span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-textSecondary">
                      {songSourceLabel(s.sourceType)} · {new Date(s.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <AddToPlaylistMenu songId={s.id} onPlaylistsChanged={refresh} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── context menu ── */}
      {contextMenu && (
        <div
          ref={menuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 min-w-[176px] overflow-hidden rounded-xl border border-white/10 bg-surface py-1 shadow-2xl"
        >
          <button
            type="button"
            onClick={() => router.push(`/analysis/${contextMenu.song.id}`)}
            className="w-full px-4 py-2 text-left text-sm transition hover:bg-white/5"
          >
            View analysis
          </button>
          <div className="my-1 border-t border-white/10" />
          <button
            type="button"
            onClick={() => openDeleteModal([contextMenu.song.id])}
            className="w-full px-4 py-2 text-left text-sm text-red-400 transition hover:bg-white/5"
          >
            Delete
          </button>
        </div>
      )}

      {/* ── delete confirmation modal ── */}
      {deleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setDeleteModal(null); }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-surface p-6 shadow-2xl">
            <h2 className="text-lg font-semibold">Delete {deleteModal.title}?</h2>
            <p className="mt-2 text-sm text-textSecondary">
              This will permanently remove{" "}
              {deleteModal.ids.length === 1 ? "this song" : "these songs"} and all
              associated lyrics and vocabulary. This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteModal(null)}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-textSecondary transition hover:text-textPrimary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={onConfirmDelete}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-400 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
