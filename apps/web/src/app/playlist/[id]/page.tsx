"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type PlaylistData = {
  id: number;
  name: string;
  description?: string;
  vocabularyCount: number;
  songs: { songId: number; title: string; artist?: string }[];
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export default function PlaylistPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<PlaylistData | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/playlist/${params.id}`)
      .then((res) => res.json())
      .then(setData);
  }, [params.id]);

  if (!data) return <p className="text-textSecondary">Loading playlist...</p>;

  return (
    <div className="space-y-4">
      <div className="card">
        <h1 className="text-2xl font-semibold">{data.name}</h1>
        <p className="text-textSecondary">{data.description || "No description"}</p>
        <p className="mt-2 text-sm text-accent">Vocabulary total: {data.vocabularyCount}</p>
      </div>
      {data.songs.map((song) => (
        <div key={song.songId} className="card">
          <p className="font-medium">{song.title}</p>
          <p className="text-sm text-textSecondary">{song.artist || "Unknown artist"}</p>
        </div>
      ))}
    </div>
  );
}
