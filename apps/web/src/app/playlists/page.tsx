"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { createPlaylist, listPlaylists, type PlaylistSummary } from "@/lib/api";

export default function PlaylistsPage() {
  const { user, loading } = useRequireAuth();
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [playlistName, setPlaylistName] = useState("");
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);

  const refreshLists = useCallback(async () => {
    setLoadError(null);
    try {
      const plRes = await listPlaylists();
      setPlaylists(plRes.playlists);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load playlists.");
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
        <h1 className="text-3xl font-semibold">Playlists</h1>
        <p className="text-textSecondary">
          Organize imported songs. Add songs from the{" "}
          <Link href="/dashboard" className="text-accent underline">
            Add Songs
          </Link>{" "}
          or a song&apos;s analysis page, then export vocabulary as CSV.
        </p>
      </section>
      {loadError ? <p className="text-sm text-red-400">{loadError}</p> : null}
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Create playlist</h2>
        <form onSubmit={onCreatePlaylist} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-surfaceSoft px-3 py-2 text-sm"
            placeholder="Playlist name"
            value={playlistName}
            onChange={(e) => setPlaylistName(e.target.value)}
          />
          <button type="submit" className="button-secondary shrink-0 text-sm" disabled={creatingPlaylist}>
            {creatingPlaylist ? "Creating…" : "Create"}
          </button>
        </form>
      </section>
      <section className="card">
        <h2 className="mb-3 text-lg font-semibold">Your playlists</h2>
        {playlists.length === 0 ? (
          <p className="text-sm text-textSecondary">No playlists yet. Create one above, then add songs from the Add Songs page or a song&apos;s analysis view.</p>
        ) : (
          <ul className="space-y-2">
            {playlists.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/playlist/${p.id}`}
                  className="block rounded-xl border border-white/10 bg-surfaceSoft px-3 py-2 transition hover:border-accent"
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="mt-0.5 block text-xs text-textSecondary">{p.songCount} {p.songCount === 1 ? "song" : "songs"}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
