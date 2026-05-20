"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  deletePlaylist,
  exportPlaylistAnkiPackage,
  exportPlaylistCsv,
  getPlaylist,
  removeSongFromPlaylist,
  renamePlaylist,
  type PlaylistDetail,
} from "@/lib/api";

export default function PlaylistPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const playlistId = Number(params.id);
  const [data, setData] = useState<PlaylistDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [exporting, setExporting] = useState<"anki" | "csv" | null>(null);
  const [busySongId, setBusySongId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(playlistId) || playlistId < 1) {
      setError("Invalid playlist.");
      setData(null);
      return;
    }
    setError(null);
    try {
      const pl = await getPlaylist(playlistId);
      setData(pl);
      setRenameValue(pl.name);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Could not load playlist.");
    }
  }, [playlistId]);

  useEffect(() => {
    void load();
  }, [load]);

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
    if (!window.confirm(`Delete playlist “${data.name}”? Songs in your library will not be removed.`)) return;
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

  async function onRemoveSong(songId: number) {
    setBusySongId(songId);
    try {
      await removeSongFromPlaylist(playlistId, songId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove song.");
    } finally {
      setBusySongId(null);
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

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <div className="card space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{data.name}</h1>
            <p className="text-textSecondary">{data.description || "No description"}</p>
            <p className="mt-2 text-sm text-accent">Vocabulary rows across playlist: {data.vocabularyCount}</p>
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
            <button type="button" className="button-secondary text-sm text-red-300" onClick={onDelete}>
              Delete playlist
            </button>
          </div>
        </div>
        <form onSubmit={onRename} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="text-sm text-textSecondary sm:shrink-0">Rename</label>
          <input
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-surfaceSoft px-3 py-2 text-sm"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
          />
          <button type="submit" className="button-secondary shrink-0 text-sm" disabled={renaming || renameValue.trim() === data.name}>
            {renaming ? "Saving…" : "Save name"}
          </button>
        </form>
      </div>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Songs</h2>
        {data.songs.length === 0 ? (
          <p className="text-sm text-textSecondary">No songs in this playlist yet. Export will still download a CSV with headers only.</p>
        ) : (
          <ul className="space-y-2">
            {data.songs.map((song) => (
              <li key={song.songId} className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
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
                  <div>
                    <p className="font-medium">{song.title}</p>
                    <p className="text-sm text-textSecondary">{song.artist || "Unknown artist"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/analysis/${song.songId}`} className="button-secondary inline-block text-sm">
                    Open analysis
                  </Link>
                  <button
                    type="button"
                    className="button-secondary text-sm text-red-300"
                    disabled={busySongId === song.songId}
                    onClick={() => onRemoveSong(song.songId)}
                  >
                    {busySongId === song.songId ? "Removing…" : "Remove from playlist"}
                  </button>
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
    </div>
  );
}
