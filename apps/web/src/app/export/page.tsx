"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

function ExportPageContent() {
  const searchParams = useSearchParams();
  const songId = Number(searchParams.get("songId") || "0");
  const ids = (searchParams.get("ids") || "")
    .split(",")
    .filter(Boolean)
    .map((item) => Number(item));

  async function onExport() {
    const res = await fetch(`${API_BASE}/generate-anki`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ songId, selectedVocabularyIds: ids }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lingroove-anki.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Export Anki CSV</h1>
      <div className="card">
        <p className="text-textSecondary">Song ID: {songId}</p>
        <p className="text-textSecondary">Selected entries: {ids.length}</p>
        <button className="button-primary mt-4" onClick={onExport} disabled={!songId || ids.length === 0}>
          Export CSV
        </button>
      </div>
    </div>
  );
}

export default function ExportPage() {
  return (
    <Suspense fallback={<p className="text-textSecondary">Loading export page...</p>}>
      <ExportPageContent />
    </Suspense>
  );
}
