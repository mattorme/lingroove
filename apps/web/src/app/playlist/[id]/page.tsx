"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  addSongToPlaylist,
  deletePlaylist,
  exportPlaylistAnkiPackage,
  exportPlaylistCsv,
  getPlaylist,
  listPlaylists,
  removeSongFromPlaylist,
  renamePlaylist,
  type PlaylistDetail,
  type PlaylistSongRow,
  type PlaylistSummary,
} from "@/lib/api";

type ContextMenu = { x: number; y: number; song: PlaylistSongRow; subLeft: boolean };
type RemoveModal = { ids: number[]; title: string };

export default function PlaylistPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const playlistId = Number(params.id);
  const [data, setData] = useState<PlaylistDetail | null>(null);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [exporting, setExporting] = useState<"anki" | "csv" | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [playlistSubmenuOpen, setPlaylistSubmenuOpen] = useState(false);
  const [removeModal, setRemoveModal] = useState<RemoveModal | null>(null);
  const [removing, setRemoving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const lastClickedId = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(playlistId) || playlistId < 1) {
      setError("Invalid playlist.");
      setData(null);
      return;
    }
    setError(null);
    try {
      const [pl, plRes] = await Promise.all([getPlaylist(playlistId), listPlaylists()]);
      setData(pl);
      setRenameValue(pl.name);
      setPlaylists(plRes.playlists.filter((p) => p.id !== playlistId));
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Could not load playlist.");
    }
  }, [playlistId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Close context menu on outside click or Escape
  useEffect(() => {
    if (!contextMenu) return;
    function onMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setContextMenu(null);
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
    if (!removeModal) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setRemoveModal(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [removeModal]);

  // Delete/Backspace opens remove modal for selected songs
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (selectedIds.size === 0 || removeModal || !data) return;
      e.preventDefault();
      openRemoveModal([...selectedIds]);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedIds, removeModal, data]);

  async function onRename(e: React.FormEvent) {
    e.preventDefault();
    const name = renameValue.trim();
    if (!name || !data) return;
    setRenaming(true);
    try {
      await renamePlaylist(playlistId, { name });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rename failed.");
    } finally {
      setRenaming(false);
    }
  }

  async function onDelete() {
    if (!data) return;
    if (!window.confirm(`Delete playlist "${data.name}"? Songs in your library will not be removed.`)) return;
    try {
      await deletePlaylist(playlistId);
      router.push("/playlists");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    }
  }

  async function onExport(format: "anki" | "csv") {
    if (!data) return;
    setExporting(format);
    try {
      if (format === "anki") {
        await exportPlaylistAnkiPackage(playlistId, data.name);
      } else {
        await exportPlaylistCsv(playlistId, data.name);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(null);
    }
  }

  function openRemoveModal(ids: number[]) {
    setContextMenu(null);
    if (!data) return;
    const songs = data.songs.filter((s) => ids.includes(s.songId));
    const title =
      songs.length === 1 ? `"${songs[0].title}"` : `${songs.length} songs`;
    setRemoveModal({ ids, title });
  }

  async function onConfirmRemove() {
    if (!removeModal) return;
    setRemoving(true);
    try {
      await Promise.all(
        removeModal.ids.map((id) => removeSongFromPlaylist(playlistId, id)),
      );
      setSelectedIds((prev) => {
        const next = new Set(prev);
        removeModal.ids.forEach((id) => next.delete(id));
        return next;
      });
      setRemoveModal(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove songs.");
    } finally {
      setRemoving(false);
    }
  }

  function handleRowClick(e: React.MouseEvent, songId: number) {
    const target = e.target as HTMLElement;
    if (target.closest("a") || target.closest("button")) return;
    setContextMenu(null);

    const songs = data?.songs ?? [];
    if (e.shiftKey && lastClickedId.current !== null) {
      const anchorIdx = songs.findIndex((s) => s.songId === lastClickedId.current);
      const currentIdx = songs.findIndex((s) => s.songId === songId);
      if (anchorIdx !== -1 && currentIdx !== -1) {
        const start = Math.min(anchorIdx, currentIdx);
        const end = Math.max(anchorIdx, currentIdx);
        setSelectedIds(new Set(songs.slice(start, end + 1).map((s) => s.songId)));
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

  function handleContextMenu(e: React.MouseEvent, song: PlaylistSongRow) {
    e.preventDefault();
    if (!selectedIds.has(song.songId)) setSelectedIds(new Set([song.songId]));
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 160);
    setContextMenu({ x, y, song, subLeft: x + 380 > window.innerWidth });
  }

  async function handleAddToPlaylist(playlistId: number) {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setContextMenu(null);
    setPlaylistSubmenuOpen(false);
    try {
      await Promise.all(ids.map((id) => addSongToPlaylist(playlistId, id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add to playlist.");
    }
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <p className="text-red-400">{error}</p>
        <Link href="/playlists" className="text-accent underline">
          Back to playlists
        </Link>
      </div>
    );
  }

  if (!data) return <p className="text-textSecondary">Loading playlist…</p>;

  const someSelected = selectedIds.size > 0;

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="card space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{data.name}</h1>
            <p className="text-textSecondary">{data.description || "No description"}</p>
            <p className="mt-2 text-sm text-accent">
              Vocabulary rows across playlist: {data.vocabularyCount}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="button-primary text-sm"
              disabled={exporting !== null}
              onClick={() => onExport("anki")}
            >
              {exporting === "anki" ? "Exporting…" : "Export Anki Deck"}
            </button>
            <button
              type="button"
              className="button-secondary text-sm"
              disabled={exporting !== null}
              onClick={() => onExport("csv")}
            >
              {exporting === "csv" ? "Exporting…" : "Export CSV"}
            </button>
            <button
              type="button"
              className="button-secondary text-sm text-red-300"
              onClick={onDelete}
            >
              Delete playlist
            </button>
          </div>
        </div>
        <form
          onSubmit={onRename}
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
        >
          <label className="text-sm text-textSecondary sm:shrink-0">Rename</label>
          <input
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-surfaceSoft px-3 py-2 text-sm"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
          />
          <button
            type="submit"
            className="button-secondary shrink-0 text-sm"
            disabled={renaming || renameValue.trim() === data.name}
          >
            {renaming ? "Saving…" : "Save name"}
          </button>
        </form>
      </div>

      <section className="card space-y-4">
        {/* ── toolbar ── */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-textSecondary">
            {data.songs.length} {data.songs.length === 1 ? "song" : "songs"}
          </span>
          {someSelected && (
            <>
              <span className="text-white/20">·</span>
              <span className="font-medium">{selectedIds.size} selected</span>
              <button
                type="button"
                onClick={() => openRemoveModal([...selectedIds])}
                className="rounded-lg border border-red-500/50 px-2.5 py-1 text-xs text-red-400 transition hover:border-red-500 hover:text-red-300"
              >
                Remove
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

        {/* ── list ── */}
        {data.songs.length === 0 ? (
          <p className="text-sm text-textSecondary">
            No songs yet. Add songs from the{" "}
            <Link href="/dashboard" className="text-accent underline">
              dashboard
            </Link>{" "}
            or a song&apos;s analysis page.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {data.songs.map((song) => (
              <li
                key={song.songId}
                onClick={(e) => handleRowClick(e, song.songId)}
                onContextMenu={(e) => handleContextMenu(e, song)}
                className={`cursor-default select-none rounded-lg px-2 py-2.5 transition-colors ${
                  selectedIds.has(song.songId)
                    ? "bg-white/[0.08]"
                    : "hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  {song.artworkUrl ? (
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md">
                      <Image
                        src={song.artworkUrl}
                        alt={song.title}
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
                        href={`/analysis/${song.songId}`}
                        className="font-medium transition hover:text-accent"
                      >
                        {song.title}
                      </Link>
                      {song.artist ? (
                        <span className="text-textSecondary"> · {song.artist}</span>
                      ) : null}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-sm text-textSecondary">
        <Link href="/playlists" className="text-accent underline">
          All playlists
        </Link>
      </p>

      {/* ── context menu ── */}
      {contextMenu && (
        <div
          ref={menuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 min-w-[200px] rounded-xl border border-white/10 bg-surface py-1 shadow-2xl"
        >
          <button
            type="button"
            onClick={() => router.push(`/analysis/${contextMenu.song.songId}`)}
            className="w-full px-4 py-2 text-left text-sm transition hover:bg-white/5"
          >
            View analysis
          </button>
          <div className="my-1 border-t border-white/10" />
          <div
            className="relative"
            onMouseEnter={() => setPlaylistSubmenuOpen(true)}
            onMouseLeave={() => setPlaylistSubmenuOpen(false)}
          >
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-2 text-left text-sm transition hover:bg-white/5"
            >
              <span>Add to playlist</span>
              <span className="text-xs text-textSecondary">›</span>
            </button>
            {playlistSubmenuOpen && (
              <div
                className={`absolute top-0 z-10 min-w-[160px] overflow-hidden rounded-xl border border-white/10 bg-surface py-1 shadow-2xl ${
                  contextMenu.subLeft ? "right-full mr-1" : "left-full ml-1"
                }`}
              >
                {playlists.length === 0 ? (
                  <p className="px-4 py-2 text-xs text-textSecondary">
                    No other playlists
                  </p>
                ) : (
                  <div className="max-h-52 overflow-y-auto">
                    {playlists.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleAddToPlaylist(p.id)}
                        className="w-full px-4 py-2 text-left text-sm transition hover:bg-white/5"
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="my-1 border-t border-white/10" />
          <button
            type="button"
            onClick={() =>
              openRemoveModal(
                selectedIds.size > 1 ? [...selectedIds] : [contextMenu.song.songId],
              )
            }
            className="w-full px-4 py-2 text-left text-sm text-red-400 transition hover:bg-white/5"
          >
            {selectedIds.size > 1
              ? `Remove ${selectedIds.size} songs`
              : "Remove from playlist"}
          </button>
        </div>
      )}

      {/* ── remove confirmation modal ── */}
      {removeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setRemoveModal(null);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-surface p-6 shadow-2xl">
            <h2 className="text-lg font-semibold">
              Remove {removeModal.title}?
            </h2>
            <p className="mt-2 text-sm text-textSecondary">
              {removeModal.ids.length === 1
                ? "This song"
                : "These songs"}{" "}
              will be removed from this playlist. They will remain in your
              library.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRemoveModal(null)}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-textSecondary transition hover:text-textPrimary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removing}
                onClick={onConfirmRemove}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-400 disabled:opacity-50"
              >
                {removing ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
