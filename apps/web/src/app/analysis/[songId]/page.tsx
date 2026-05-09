"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { addSongToPlaylist, analyzeLyrics, getSavedSongAnalysis, listPlaylists, type PlaylistSummary } from "@/lib/api";
import { VocabGroupPanel } from "@/components/VocabGroupPanel";
import { DEMO_USER_ID } from "@/lib/constants";
import { VocabularyEntry } from "@/types/api";

export default function SongAnalysisPage() {
  const params = useParams<{ songId: string }>();
  const songId = Number(params.songId);
  const [entries, setEntries] = useState<VocabularyEntry[]>([]);
  const [lyrics, setLyrics] = useState("Loading…");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [playlistPick, setPlaylistPick] = useState("");
  const [playlistMsg, setPlaylistMsg] = useState<string | null>(null);
  const [addingPlaylist, setAddingPlaylist] = useState(false);

  const grouped = useMemo(() => {
    return {
      verb: entries.filter((e) => e.partOfSpeech === "verb"),
      noun: entries.filter((e) => e.partOfSpeech === "noun"),
      adjective: entries.filter((e) => e.partOfSpeech === "adjective"),
    };
  }, [entries]);

  useEffect(() => {
    listPlaylists(DEMO_USER_ID)
      .then((r) => setPlaylists(r.playlists))
      .catch(() => setPlaylists([]));
  }, []);

  useEffect(() => {
    if (!Number.isFinite(songId) || songId < 1) {
      setHydrating(false);
      setLyrics("Invalid song.");
      return;
    }
    let cancelled = false;
    setHydrating(true);
    getSavedSongAnalysis(songId)
      .then((data) => {
        if (cancelled) return;
        setLyrics(data.cleanedLyrics);
        setEntries(data.entries);
        setSelected(new Set(data.entries.filter((x) => x.isSelected).map((x) => x.id)));
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof Error && err.message === "NOT_FOUND") {
          setLyrics("Song or lyrics not found.");
        } else {
          setLyrics("Could not load this song. Try the dashboard or run analysis below.");
        }
        setEntries([]);
        setSelected(new Set());
      })
      .finally(() => {
        if (!cancelled) setHydrating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [songId]);

  async function runAnalysis() {
    setLoading(true);
    try {
      const data = await analyzeLyrics(songId);
      setEntries(data.entries);
      setSelected(new Set(data.entries.map((x) => x.id)));
      setLyrics(data.cleanedLyrics);
    } finally {
      setLoading(false);
    }
  }

  async function onAddToPlaylist() {
    const id = Number(playlistPick);
    if (!id) return;
    setAddingPlaylist(true);
    setPlaylistMsg(null);
    try {
      await addSongToPlaylist(id, songId);
      setPlaylistMsg("Added to playlist.");
      const r = await listPlaylists(DEMO_USER_ID);
      setPlaylists(r.playlists);
    } catch (e) {
      setPlaylistMsg(e instanceof Error ? e.message : "Could not add to playlist.");
    } finally {
      setAddingPlaylist(false);
    }
  }

  function onToggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="text-2xl font-semibold">Song Analysis #{songId}</h1>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <button className="button-primary" onClick={runAnalysis} disabled={loading || hydrating}>
            {loading ? "Analyzing…" : hydrating ? "Loading…" : entries.length > 0 ? "Re-analyze lyrics" : "Analyze lyrics"}
          </button>
          {playlists.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="rounded-xl border border-white/10 bg-surfaceSoft px-3 py-2 text-sm"
                value={playlistPick}
                onChange={(e) => setPlaylistPick(e.target.value)}
              >
                <option value="">Add to playlist…</option>
                {playlists.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button type="button" className="button-secondary text-sm" disabled={!playlistPick || addingPlaylist} onClick={onAddToPlaylist}>
                {addingPlaylist ? "Adding…" : "Add"}
              </button>
            </div>
          ) : (
            <p className="text-xs text-textSecondary">
              Create a playlist on the{" "}
              <Link href="/dashboard" className="text-accent underline">
                dashboard
              </Link>{" "}
              to save this song.
            </p>
          )}
          {playlistMsg ? <p className="text-xs text-textSecondary">{playlistMsg}</p> : null}
        </div>
      </div>
      <section className="card">
        <h2 className="mb-2 text-lg font-medium">Original Lyrics</h2>
        <pre className="whitespace-pre-wrap text-sm text-textSecondary">{lyrics}</pre>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        <div>
          <h3 className="mb-2 font-semibold text-accent">Verbs</h3>
          <VocabGroupPanel entries={grouped.verb} selected={selected} onToggle={onToggle} />
        </div>
        <div>
          <h3 className="mb-2 font-semibold text-accent">Nouns</h3>
          <VocabGroupPanel entries={grouped.noun} selected={selected} onToggle={onToggle} />
        </div>
        <div>
          <h3 className="mb-2 font-semibold text-accent">Adjectives</h3>
          <VocabGroupPanel entries={grouped.adjective} selected={selected} onToggle={onToggle} />
        </div>
      </section>
      <Link href={`/export?songId=${songId}&ids=${Array.from(selected).join(",")}`} className="button-primary inline-block">
        Continue to Export
      </Link>
    </div>
  );
}
