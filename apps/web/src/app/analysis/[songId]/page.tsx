"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AddToPlaylistMenu } from "@/components/AddToPlaylistMenu";
import { analyzeLyrics, getSavedSongAnalysis } from "@/lib/api";
import { VocabGroupPanel } from "@/components/VocabGroupPanel";
import { VocabularyEntry } from "@/types/api";

const DEMO_USER_ID = 1;

export default function SongAnalysisPage() {
  const params = useParams<{ songId: string }>();
  const songId = Number(params.songId);
  const [entries, setEntries] = useState<VocabularyEntry[]>([]);
  const [lyrics, setLyrics] = useState("Loading…");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [hydrating, setHydrating] = useState(true);

  const grouped = useMemo(() => {
    return {
      verb: entries.filter((e) => e.partOfSpeech === "verb"),
      noun: entries.filter((e) => e.partOfSpeech === "noun"),
      adjective: entries.filter((e) => e.partOfSpeech === "adjective"),
    };
  }, [entries]);

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
          setLyrics("Could not load this song. Try importing again or run analysis below.");
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
        <div className="flex min-w-0 max-w-md flex-col gap-2 sm:items-end">
          <button className="button-primary" onClick={runAnalysis} disabled={loading || hydrating}>
            {loading ? "Analyzing…" : hydrating ? "Loading…" : entries.length > 0 ? "Re-analyze lyrics" : "Analyze lyrics"}
          </button>
          <AddToPlaylistMenu userId={DEMO_USER_ID} songId={songId} />
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
      <Link
        href={`/export?songId=${songId}&ids=${Array.from(selected).join(",")}`}
        className="button-primary inline-block"
      >
        Continue to Export
      </Link>
    </div>
  );
}
