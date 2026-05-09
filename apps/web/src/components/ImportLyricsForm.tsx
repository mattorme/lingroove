"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { importLyrics } from "@/lib/api";
import { DEMO_USER_ID } from "@/lib/constants";

export function ImportLyricsForm() {
  const router = useRouter();
  const [sourceType, setSourceType] = useState<"url" | "raw">("url");
  const [sourceValue, setSourceValue] = useState("");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (sourceType === "url") {
      const trimmed = sourceValue.trim();
      try {
        const u = new URL(trimmed);
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          setError("URL must start with http:// or https://. For pasted lyrics, use Raw Lyrics.");
          setLoading(false);
          return;
        }
      } catch {
        setError("That does not look like a web link. Use Raw Lyrics for pasted lyrics, or paste a full URL (https://…).");
        setLoading(false);
        return;
      }
    }
    try {
      const data = await importLyrics({
        sourceType,
        sourceValue,
        title: title || "Untitled Song",
        artist: artist || undefined,
        userId: DEMO_USER_ID,
      });
      router.push(`/analysis/${data.songId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to import lyrics.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="card space-y-3" onSubmit={onSubmit}>
      <div className="flex gap-2">
        <button type="button" className={sourceType === "url" ? "button-primary" : "button-secondary"} onClick={() => setSourceType("url")}>
          URL
        </button>
        <button type="button" className={sourceType === "raw" ? "button-primary" : "button-secondary"} onClick={() => setSourceType("raw")}>
          Raw Lyrics
        </button>
      </div>
      <input className="w-full rounded-xl border border-white/10 bg-surfaceSoft px-3 py-2" placeholder="Song title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input className="w-full rounded-xl border border-white/10 bg-surfaceSoft px-3 py-2" placeholder="Artist (optional)" value={artist} onChange={(e) => setArtist(e.target.value)} />
      <textarea
        className="h-40 w-full rounded-xl border border-white/10 bg-surfaceSoft px-3 py-2"
        placeholder={sourceType === "url" ? "Paste lyrics URL" : "Paste raw lyrics"}
        value={sourceValue}
        onChange={(e) => setSourceValue(e.target.value)}
        required
      />
      <button className="button-primary" disabled={loading}>
        {loading ? "Importing..." : "Import and Analyze"}
      </button>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </form>
  );
}
