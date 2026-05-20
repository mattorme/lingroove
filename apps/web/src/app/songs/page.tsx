"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import {
  addSongToPlaylist,
  deleteSong,
  listPlaylists,
  listSongs,
  songSourceLabel,
  type PlaylistSummary,
  type SongSummary,
} from "@/lib/api";

type ContextMenuView = "main" | "addToPlaylist";
type ContextMenu = { x: number; y: number; song: SongSummary };
type DeleteModal = { ids: number[]; title: string };

export default function SongsPage() {
  const router = useRouter();
  const { user, loading } = useRequireAuth();
  const [songs, setSongs] = useState<SongSummary[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [contextMenuView, setContextMenuView] = useState<ContextMenuView>("main");
  const [addingToPlaylist, setAddingToPlaylist] = useState(false);
  const [addToPlaylistMsg, setAddToPlaylistMsg] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<DeleteModal | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toolbarDropdownOpen, setToolbarDropdownOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const toolbarDropdownRef = useRef<HTMLDivElement>(null);
  const lastClickedId = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const [songRes, playlistRes] = await Promise.all([listSongs(), listPlaylists()]);
      setSongs(songRes.songs);
      setPlaylists(playlistRes.playlists);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load songs.");
    }
  }, []);

  useEffect(() => {
    if (user) void refresh();
  }, [user, refresh]);

  function closeContextMenu() {
    setContextMenu(null);
    setContextMenuView("main");
    setAddToPlaylistMsg(null);
  }

  // Close context menu on outside click or Escape
  useEffect(() => {
    if (!contextMenu) return;
    function onMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeContextMenu();
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextMenu]);

  // Close toolbar dropdown on outside click
  useEffect(() => {
    if (!toolbarDropdownOpen) return;
    function onMouseDown(e: MouseEvent) {
      if (toolbarDropdownRef.current && !toolbarDropdownRef.current.contains(e.target as Node)) {
        setToolbarDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [toolbarDropdownOpen]);

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
    closeContextMenu();
    setToolbarDropdownOpen(false);

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
    setContextMenuView("main");
    setAddToPlaylistMsg(null);
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 200);
    setContextMenu({ x, y, song });
  }

  async function handleAddToPlaylist(playlistId: number) {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setAddingToPlaylist(true);
    setAddToPlaylistMsg(null);
    try {
      await Promise.all(ids.map((id) => addSongToPlaylist(playlistId, id)));
      const pl = playlists.find((p) => p.id === playlistId);
      setAddToPlaylistMsg(`Added to "${pl?.name ?? "playlist"}"`);
      void refresh();
      setTimeout(closeContextMenu, 1200);
    } catch (e) {
      setAddToPlaylistMsg(e instanceof Error ? e.message : "Failed to add.");
    } finally {
      setAddingToPlaylist(false);
      setToolbarDropdownOpen(false);
    }
  }

  function openDeleteModal(ids: number[]) {
    closeContextMenu();
    setToolbarDropdownOpen(false);
    const names = songs.filter((s) => ids.includes(s.id));
    const title =
      names.length === 1 ? `"${names[0].title}"` : `${names.length} songs`;
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

                {/* Add to playlist toolbar dropdown */}
                <div ref={toolbarDropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setToolbarDropdownOpen((v) => !v)}
                    className="rounded-lg border border-white/20 px-2.5 py-1 text-xs transition hover:border-white/40 hover:text-textPrimary"
                  >
                    Add to playlist ▾
                  </button>
                  {toolbarDropdownOpen && (
                    <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] overflow-hidden rounded-xl border border-white/10 bg-surface py-1 shadow-2xl">
                      {playlists.length === 0 ? (
                        <p className="px-4 py-2 text-xs text-textSecondary">No playlists yet</p>
                      ) : (
                        playlists.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            disabled={addingToPlaylist}
                            onClick={() => handleAddToPlaylist(p.id)}
                            className="w-full px-4 py-2 text-left text-sm transition hover:bg-white/5 disabled:opacity-50"
                          >
                            {p.name}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

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
                <div className="flex min-w-0 items-center gap-3">
                  {s.artworkUrl ? (
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md">
                      <Image
                        src={s.artworkUrl}
                        alt={s.title}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="h-10 w-10 shrink-0 rounded-md bg-white/[0.06]" />
                  )}
                  <div className="min-w-0">
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
          className="fixed z-50 min-w-[200px] overflow-hidden rounded-xl border border-white/10 bg-surface py-1 shadow-2xl"
        >
          {contextMenuView === "main" ? (
            <>
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
                onClick={() => setContextMenuView("addToPlaylist")}
                className="flex w-full items-center justify-between px-4 py-2 text-left text-sm transition hover:bg-white/5"
              >
                <span>Add to playlist</span>
                <span className="text-textSecondary">›</span>
              </button>
              <div className="my-1 border-t border-white/10" />
              <button
                type="button"
                onClick={() =>
                  openDeleteModal(
                    selectedIds.size > 1
                      ? [...selectedIds]
                      : [contextMenu.song.id],
                  )
                }
                className="w-full px-4 py-2 text-left text-sm text-red-400 transition hover:bg-white/5"
              >
                {selectedIds.size > 1 ? `Delete ${selectedIds.size} songs` : "Delete"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setContextMenuView("main");
                  setAddToPlaylistMsg(null);
                }}
                className="flex w-full items-center gap-1.5 px-4 py-2 text-left text-sm text-textSecondary transition hover:bg-white/5"
              >
                <span>‹</span>
                <span>Back</span>
              </button>
              <div className="my-1 border-t border-white/10" />
              <p className="px-4 py-1 text-xs text-textSecondary">
                {selectedIds.size > 1
                  ? `Add ${selectedIds.size} songs to…`
                  : "Add to playlist…"}
              </p>
              {addToPlaylistMsg ? (
                <p className="px-4 py-2 text-xs text-green-400">{addToPlaylistMsg}</p>
              ) : playlists.length === 0 ? (
                <p className="px-4 py-2 text-xs text-textSecondary">
                  No playlists yet. Create one first.
                </p>
              ) : (
                <div className="max-h-52 overflow-y-auto">
                  {playlists.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={addingToPlaylist}
                      onClick={() => handleAddToPlaylist(p.id)}
                      className="w-full px-4 py-2 text-left text-sm transition hover:bg-white/5 disabled:opacity-50"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── delete confirmation modal ── */}
      {deleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDeleteModal(null);
          }}
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
