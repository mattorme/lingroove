"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ImportLyricsForm } from "@/components/ImportLyricsForm";
import { AddToPlaylistMenu } from "@/components/AddToPlaylistMenu";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { createPlaylist, listPlaylists, listSongs, type PlaylistSummary, type SongSummary } from "@/lib/api";

export default function DashboardPage() {
  const { user, loading } = useRequireAuth();
  const [songs, setSongs] = useState<SongSummary[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [playlistName, setPlaylistName] = useState("");
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);

  const refreshLists = useCallback(async () => {
    setLoadError(null);
    try {
      const [songRes, plRes] = await Promise.all([listSongs(), listPlaylists()]);
      setSongs(songRes.songs);
      setPlaylists(plRes.playlists);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load dashboard data.");
    }
  }, []);

  useEffect(() => {
    if (user) void refreshLists();
  }, [user, refreshLists]);

  async function onCreatePlaylist(e: React.FormEvent) {
    e.preventDefault();
    if (!playlistName.trim()) return;
    setCreatingPlaylist(true);
    try {
      await createPlaylist({ name: playlistName.trim() });
      setPlaylistName("");
      await refreshLists();
    } finally {
      setCreatingPlaylist(false);
    }
  }

  if (loading || !user) return null;

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="text-textSecondary">Import lyrics via URL or raw text to start analysis.</p>
      </section>
      <ImportLyricsForm />
      {loadError ? <p className="text-sm text-red-400">{loadError}</p> : null}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-lg font-semibold">Recent Songs</h2>
          {songs.length === 0 ? (
            <p className="text-sm text-textSecondary">No songs yet. Import lyrics above — they will show here when you return to the dashboard.</p>
          ) : (
            <ul className="space-y-3">
              {songs.map((s) => (
                <li key={s.id} className="rounded-xl border border-white/10 bg-surfaceSoft p-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <Link href={`/analysis/${s.id}`} className="block min-w-0 flex-1 transition hover:text-accent">
                      <span className="font-medium">{s.title}</span>
                      {s.artist ? <span className="text-textSecondary"> · {s.artist}</span> : null}
                      <span className="mt-0.5 block text-xs text-textSecondary">
                        {s.sourceType === "url" ? "URL" : "Raw"} · {new Date(s.createdAt).toLocaleString()}
                      </span>
                    </Link>
                    <div className="min-w-0 shrink-0 lg:max-w-sm">
                      <AddToPlaylistMenu songId={s.id} onPlaylistsChanged={refreshLists} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Playlists</h2>
            <Link href="/playlists" className="text-xs text-accent underline">
              Manage
            </Link>
          </div>
          <form onSubmit={onCreatePlaylist} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-surfaceSoft px-3 py-2 text-sm"
              placeholder="New playlist name"
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
            />
            <button type="submit" className="button-secondary shrink-0 text-sm" disabled={creatingPlaylist}>
              {creatingPlaylist ? "Creating…" : "Create"}
            </button>
          </form>
          {playlists.length === 0 ? (
            <p className="text-sm text-textSecondary">
              No playlists yet. Create one here or on the{" "}
              <Link href="/playlists" className="text-accent underline">
                Playlists
              </Link>{" "}
              page, then use &quot;Save to Playlist&quot; on any song.
            </p>
          ) : (
            <ul className="space-y-2">
              {playlists.map((p) => (
                <li key={p.id}>
                  <Link href={`/playlist/${p.id}`} className="block rounded-xl border border-white/10 bg-surfaceSoft px-3 py-2 transition hover:border-accent">
                    <span className="font-medium">{p.name}</span>
                    <span className="mt-0.5 block text-xs text-textSecondary">{p.songCount} song(s)</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
