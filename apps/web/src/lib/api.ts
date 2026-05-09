import { AnalyzeResponse } from "@/types/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === "string") return data.detail;
  } catch {
    // ignore JSON parse errors and use fallback
  }
  return fallback;
}

export async function importLyrics(payload: {
  sourceType: "url" | "raw";
  sourceValue: string;
  title?: string;
  artist?: string;
  userId: number;
}) {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/import-lyrics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      `Cannot reach API at ${API_BASE}. Check backend server, CORS, and NEXT_PUBLIC_API_BASE_URL.`
    );
  }
  if (!res.ok) throw new Error(await parseError(res, "Failed to import lyrics"));
  return res.json();
}

export async function analyzeLyrics(songId: number): Promise<AnalyzeResponse> {
  const res = await fetch(`${API_BASE}/analyze-lyrics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ songId }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to analyze lyrics"));
  return res.json();
}

export async function createPlaylist(payload: { userId: number; name: string; description?: string }) {
  const res = await fetch(`${API_BASE}/playlist/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to create playlist"));
  return res.json();
}
