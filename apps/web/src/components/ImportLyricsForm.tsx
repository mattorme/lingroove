"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchSongMetadata, importLyrics } from "@/lib/api";

export function ImportLyricsForm() {
  const router = useRouter();
  const [sourceType, setSourceType] = useState<"url" | "raw">("url");
  const [sourceValue, setSourceValue] = useState("");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [loading, setLoading] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataResolved, setMetadataResolved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const metadataDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (sourceType !== "url") return;

    const url = sourceValue.trim();
    setMetadataResolved(false);

    if (!url.startsWith("http://") && !url.startsWith("https://")) return;

    if (metadataDebounce.current) clearTimeout(metadataDebounce.current);
    metadataDebounce.current = setTimeout(async () => {
      setMetadataLoading(true);
      try {
        const meta = await fetchSongMetadata(url);
        if (meta.title) setTitle(meta.title);
        if (meta.artist) setArtist(meta.artist);
      } catch {
        // Silently ignore — fields will be empty for the user to fill in
      } finally {
        setMetadataLoading(false);
        setMetadataResolved(true);
      }
    }, 600);

    return () => {
      if (metadataDebounce.current) clearTimeout(metadataDebounce.current);
    };
  }, [sourceValue, sourceType]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await importLyrics({
        sourceType,
        sourceValue,
        title: title || "Untitled Song",
        artist: artist || undefined,
      });
      router.push(`/analysis/${data.songId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to import lyrics.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const isUrl = sourceType === "url";
  const showMetaFields = !isUrl || metadataResolved;
  const inputClass = "w-full rounded-xl border border-white/10 bg-surfaceSoft px-3 py-2";

  function switchSourceType(type: "url" | "raw") {
    setSourceType(type);
    setSourceValue("");
    setTitle("");
    setArtist("");
    setMetadataResolved(false);
    setError(null);
  }

  return (
    <form className="card space-y-3" onSubmit={onSubmit}>
      <div className="flex gap-2">
        <button type="button" className={isUrl ? "button-primary" : "button-secondary"} onClick={() => switchSourceType("url")}>
          URL
        </button>
        <button type="button" className={!isUrl ? "button-primary" : "button-secondary"} onClick={() => switchSourceType("raw")}>
          Raw Lyrics
        </button>
      </div>
      {isUrl && (
        <div className="relative">
          <textarea
            className={`${inputClass} h-20`}
            placeholder="Paste lyrics URL"
            value={sourceValue}
            onChange={(e) => setSourceValue(e.target.value)}
            required
          />
          {metadataLoading && (
            <span className="absolute bottom-2 right-3 text-xs text-white/40">fetching…</span>
          )}
        </div>
      )}
      {showMetaFields && (
        <>
          <input className={inputClass} placeholder="Song title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className={inputClass} placeholder="Artist (optional)" value={artist} onChange={(e) => setArtist(e.target.value)} />
        </>
      )}
      {!isUrl && (
        <textarea
          className={`${inputClass} h-40`}
          placeholder="Paste raw lyrics"
          value={sourceValue}
          onChange={(e) => setSourceValue(e.target.value)}
          required
        />
      )}
      <button className="button-primary" disabled={loading || metadataLoading}>
        {loading ? "Importing..." : metadataLoading ? "Fetching..." : "Import and Analyze"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
