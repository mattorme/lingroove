"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AddToPlaylistMenu } from "@/components/AddToPlaylistMenu";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { listSongs, songSourceLabel, type SongSummary } from "@/lib/api";

export default function SongsPage() {
  const { user, loading } = useRequireAuth();
  const [songs, setSongs] = useState<SongSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const songRes = await listSongs();
      setSongs(songRes.songs);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load songs.");
    }
  }, []);

  useEffect(() => {
    if (user) void refresh();
  }, [user, refresh]);

  if (loading || !user) return null;

  const query = search.trim().toLowerCase();
  const filtered = query
    ? songs.filter(
        (s) =>
          s.title.toLowerCase().includes(query) ||
          (s.artist ?? "").toLowerCase().includes(query),
      )
    : songs;

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-semibold">Songs</h1>
        <p className="text-textSecondary">All your imported songs.</p>
      </section>

      {loadError ? <p className="text-sm text-red-400">{loadError}</p> : null}

      <section className="card space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-textSecondary">
            {songs.length} {songs.length === 1 ? "song" : "songs"}
          </span>
          <input
            type="search"
            placeholder="Search by title or artist…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-surfaceSoft px-3 py-2 text-sm sm:max-w-xs"
          />
        </div>

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
          <ul className="divide-y divide-white/5">
            {filtered.map((s) => (
              <li key={s.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <Link
                    href={`/analysis/${s.id}`}
                    className="min-w-0 flex-1 transition hover:text-accent"
                  >
                    <span className="font-medium">{s.title}</span>
                    {s.artist ? (
                      <span className="text-textSecondary"> · {s.artist}</span>
                    ) : null}
                    <span className="mt-0.5 block text-xs text-textSecondary">
                      {songSourceLabel(s.sourceType)} · {new Date(s.createdAt).toLocaleString()}
                    </span>
                  </Link>
                  <div className="shrink-0">
                    <AddToPlaylistMenu
                      songId={s.id}
                      onPlaylistsChanged={refresh}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
