"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { generateAnkiCsv, generateAnkiPackage } from "@/lib/api";

function ExportPageContent() {
  const { user, loading } = useRequireAuth();
  const searchParams = useSearchParams();
  const songId = Number(searchParams.get("songId") || "0");
  const ids = (searchParams.get("ids") || "")
    .split(",")
    .filter(Boolean)
    .map((item) => Number(item));
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"anki" | "csv" | null>(null);

  if (loading || !user) return null;

  async function onExport(format: "anki" | "csv") {
    setError(null);
    setExporting(format);
    try {
      if (format === "anki") {
        await generateAnkiPackage(songId, ids);
      } else {
        await generateAnkiCsv(songId, ids);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(null);
    }
  }

  const disabled = !songId || ids.length === 0;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Export Vocabulary</h1>
      <div className="card space-y-4">
        <p className="text-textSecondary">
          {ids.length} {ids.length === 1 ? "entry" : "entries"} selected from song #{songId}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1 rounded-xl border border-white/10 bg-surfaceSoft p-4">
            <p className="font-medium">Anki Deck</p>
            <p className="mt-1 text-sm text-textSecondary">
              Native <code>.apkg</code> file — open directly in Anki, no import setup needed.
            </p>
            <button
              className="button-primary mt-3 w-full"
              onClick={() => onExport("anki")}
              disabled={disabled || exporting !== null}
            >
              {exporting === "anki" ? "Exporting…" : "Export as Anki Deck"}
            </button>
          </div>
          <div className="flex-1 rounded-xl border border-white/10 bg-surfaceSoft p-4">
            <p className="font-medium">CSV</p>
            <p className="mt-1 text-sm text-textSecondary">
              Anki-formatted <code>.csv</code> — import manually via File → Import in Anki.
            </p>
            <button
              className="button-secondary mt-3 w-full"
              onClick={() => onExport("csv")}
              disabled={disabled || exporting !== null}
            >
              {exporting === "csv" ? "Exporting…" : "Export as CSV"}
            </button>
          </div>
        </div>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </div>
    </div>
  );
}

export default function ExportPage() {
  return (
    <Suspense fallback={<p className="text-textSecondary">Loading…</p>}>
      <ExportPageContent />
    </Suspense>
  );
}
