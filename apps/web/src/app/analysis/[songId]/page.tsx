"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { analyzeLyrics } from "@/lib/api";
import { VocabGroupPanel } from "@/components/VocabGroupPanel";
import { VocabularyEntry } from "@/types/api";

export default function SongAnalysisPage() {
  const params = useParams<{ songId: string }>();
  const songId = Number(params.songId);
  const [entries, setEntries] = useState<VocabularyEntry[]>([]);
  const [lyrics, setLyrics] = useState("Run analysis to load lyrics context and vocabulary.");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  const grouped = useMemo(() => {
    return {
      verb: entries.filter((e) => e.partOfSpeech === "verb"),
      noun: entries.filter((e) => e.partOfSpeech === "noun"),
      adjective: entries.filter((e) => e.partOfSpeech === "adjective"),
    };
  }, [entries]);

  async function runAnalysis() {
    setLoading(true);
    try {
      const data = await analyzeLyrics(songId);
      setEntries(data.entries);
      setSelected(new Set(data.entries.map((x) => x.id)));
      setLyrics(data.entries.map((x) => x.contextSentence).join("\n"));
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Song Analysis #{songId}</h1>
        <button className="button-primary" onClick={runAnalysis} disabled={loading}>
          {loading ? "Analyzing..." : "Analyze Lyrics"}
        </button>
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
