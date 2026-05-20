"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ImportLyricsForm } from "@/components/ImportLyricsForm";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { listPlaylists, listSongs, songSourceLabel, type PlaylistSummary, type SongSummary } from "@/lib/api";

const HOW_IT_WORKS = [
  { n: "1", text: "Paste a lyrics URL or raw text below" },
  { n: "2", text: "Review the NLP vocabulary breakdown" },
  { n: "3", text: "Export selected words as Anki flashcards" },
];

export default function DashboardPage() {
  const { user, loading } = useRequireAuth();
  const [songs, setSongs] = useState<SongSummary[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshLists = useCallback(async () => {
    setLoadError(null);
    try {
      const [songRes, plRes] = await Promise.all([listSongs(5), listPlaylists()]);
      setSongs(songRes.songs);
      setPlaylists(plRes.playlists);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load data.");
    }
  }, []);

  useEffect(() => {
    if (user) void refreshLists();
  }, [user, refreshLists]);

  if (loading || !user) return null;

  const hasSongs = songs.length > 0;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-semibold">Add Songs</h1>
        <p className="text-textSecondary">Import lyrics via URL or raw text to start analysis.</p>
      </section>

      {!hasSongs && (
        <section className="rounded-2xl border border-accent/20 bg-accent/5 px-5 py-4">
          <p className="mb-3 text-sm font-medium text-accent">How it works</p>
          <ol className="flex flex-col gap-2 sm:flex-row sm:gap-6">
            {HOW_IT_WORKS.map((step) => (
              <li key={step.n} className="flex items-start gap-2.5 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent">
                  {step.n}
                </span>
                <span className="text-textSecondary">{step.text}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <ImportLyricsForm />

      {loadError ? <p className="text-sm text-red-400">{loadError}</p> : null}

      {hasSongs && (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recent Songs</h2>
              <Link href="/songs" className="text-xs text-accent underline">
                View all
              </Link>
            </div>
            <ul className="divide-y divide-white/5">
              {songs.map((s) => (
                <li key={s.id} className="py-2.5 first:pt-0 last:pb-0">
                  <Link href={`/analysis/${s.id}`} className="block transition hover:text-accent">
                    <span className="font-medium">{s.title}</span>
                    {s.artist ? <span className="text-textSecondary"> · {s.artist}</span> : null}
                    <span className="mt-0.5 block text-xs text-textSecondary">
                      {songSourceLabel(s.sourceType)} · {new Date(s.createdAt).toLocaleString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Playlists</h2>
              <Link href="/playlists" className="text-xs text-accent underline">
                Manage
              </Link>
            </div>
            {playlists.length === 0 ? (
              <p className="text-sm text-textSecondary">
                No playlists yet.{" "}
                <Link href="/playlists" className="text-accent underline">
                  Create one
                </Link>{" "}
                to organise your songs.
              </p>
            ) : (
              <ul className="divide-y divide-white/5">
                {playlists.map((p) => (
                  <li key={p.id} className="py-2.5 first:pt-0 last:pb-0">
                    <Link href={`/playlist/${p.id}`} className="block transition hover:text-accent">
                      <span className="font-medium">{p.name}</span>
                      <span className="ml-2 text-xs text-textSecondary">
                        {p.songCount} {p.songCount === 1 ? "song" : "songs"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
