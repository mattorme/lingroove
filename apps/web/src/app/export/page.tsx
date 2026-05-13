"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { generateAnkiCsv } from "@/lib/api";

function ExportPageContent() {
  const { user, loading } = useRequireAuth();
  const searchParams = useSearchParams();
  const songId = Number(searchParams.get("songId") || "0");
  const ids = (searchParams.get("ids") || "")
    .split(",")
    .filter(Boolean)
    .map((item) => Number(item));
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  if (loading || !user) return null;

  async function onExport() {
    setError(null);
    setExporting(true);
    try {
      await generateAnkiCsv(songId, ids);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Export Anki CSV</h1>
      <div className="card">
        <p className="text-textSecondary">Song ID: {songId}</p>
        <p className="text-textSecondary">Selected entries: {ids.length}</p>
        {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
        <button
          className="button-primary mt-4"
          onClick={onExport}
          disabled={exporting || !songId || ids.length === 0}
        >
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
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
