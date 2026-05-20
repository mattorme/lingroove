import { AnalyzeResponse } from "@/types/api";
import { getStoredToken } from "@/context/AuthContext";
import { API_BASE } from "@/lib/config";

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

// ---------------------------------------------------------------------------
// Internal fetch helpers
// ---------------------------------------------------------------------------

async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === "string" && data.detail.length > 0) return data.detail;
  } catch {
    // ignore JSON parse errors
  }
  return fallback;
}

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = {
    ...authHeaders(),
    ...(init?.headers as Record<string, string> | undefined),
  };
  try {
    return await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new Error("Cannot reach the API. Check that the backend is running and CORS is configured.");
  }
}

async function apiGet<T>(path: string, errorMsg: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(await parseError(res, errorMsg));
  return res.json() as Promise<T>;
}

async function apiPost<T>(path: string, body: unknown, errorMsg: string): Promise<T> {
  const res = await apiFetch(path, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await parseError(res, errorMsg));
  return res.json() as Promise<T>;
}

async function apiPatch<T>(path: string, body: unknown, errorMsg: string): Promise<T> {
  const res = await apiFetch(path, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await parseError(res, errorMsg));
  return res.json() as Promise<T>;
}

async function apiDelete(path: string, errorMsg: string): Promise<void> {
  const res = await apiFetch(path, { method: "DELETE" });
  if (!res.ok) throw new Error(await parseError(res, errorMsg));
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function filenameFromContentDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const quoted = /filename="([^"]+)"/i.exec(header);
  if (quoted?.[1]) return quoted[1].trim();
  const unquoted = /filename=([^;]+)/i.exec(header);
  if (unquoted?.[1]) return unquoted[1].trim().replace(/^UTF-8''/, "");
  return fallback;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export type AuthUser = {
  id: number;
  email: string;
  display_name: string;
  created_at: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export async function signup(payload: {
  email: string;
  display_name: string;
  password: string;
}): Promise<TokenResponse> {
  return apiPost<TokenResponse>("/auth/signup", payload, "Signup failed");
}

export async function login(payload: {
  email: string;
  password: string;
}): Promise<TokenResponse> {
  return apiPost<TokenResponse>("/auth/login", payload, "Invalid email or password");
}

export async function getMe(): Promise<AuthUser> {
  return apiGet<AuthUser>("/auth/me", "Failed to load profile");
}

/**
 * Fetch the current user's profile using an explicit token rather than the
 * one stored in localStorage. Used immediately after login/signup, before the
 * token has been committed to storage.
 */
export async function fetchMeWithToken(token: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load profile");
  return res.json() as Promise<AuthUser>;
}

// ---------------------------------------------------------------------------
// Lyrics / Songs
// ---------------------------------------------------------------------------

export type ImportLyricsResponse = {
  songId: number;
  lyricId: number;
  cleanedLyrics: string;
  detectedLanguage: string;
};

export async function fetchSongMetadata(url: string): Promise<{ title: string | null; artist: string | null }> {
  return apiGet(`/song-metadata?url=${encodeURIComponent(url)}`, "Failed to fetch song metadata");
}

export async function importLyrics(payload: {
  sourceType: "url" | "raw";
  sourceValue: string;
  title?: string;
  artist?: string;
}): Promise<ImportLyricsResponse> {
  return apiPost<ImportLyricsResponse>("/import-lyrics", payload, "Failed to import lyrics");
}

export async function analyzeLyrics(songId: number): Promise<AnalyzeResponse> {
  return apiPost<AnalyzeResponse>("/analyze-lyrics", { songId }, "Failed to analyze lyrics");
}

export async function getSavedSongAnalysis(songId: number): Promise<AnalyzeResponse> {
  const res = await apiFetch(`/songs/${songId}/analysis`);
  if (res.status === 404) throw new Error("NOT_FOUND");
  if (!res.ok) throw new Error(await parseError(res, "Failed to load saved analysis"));
  return res.json() as Promise<AnalyzeResponse>;
}

export type SongSummary = {
  id: number;
  title: string;
  artist: string | null;
  sourceType: string;
  createdAt: string;
};

export function songSourceLabel(sourceType: string): string {
  return sourceType === "url" ? "URL" : "Raw";
}

export async function listSongs(limit?: number): Promise<{ songs: SongSummary[] }> {
  const path = limit !== undefined ? `/songs?limit=${limit}` : `/songs`;
  return apiGet(path, "Failed to load songs");
}

export async function deleteSong(songId: number): Promise<void> {
  return apiDelete(`/songs/${songId}`, "Failed to delete song");
}

// ---------------------------------------------------------------------------
// Playlists
// ---------------------------------------------------------------------------

export type PlaylistSummary = {
  id: number;
  name: string;
  description: string | null;
  songCount: number;
};

export async function listPlaylists(): Promise<{ playlists: PlaylistSummary[] }> {
  return apiGet(`/playlists`, "Failed to load playlists");
}

export async function createPlaylist(payload: {
  name: string;
  description?: string;
}): Promise<{ id: number; name: string }> {
  return apiPost("/playlist/create", payload, "Failed to create playlist");
}

export async function renamePlaylist(playlistId: number, payload: { name: string }): Promise<void> {
  await apiPatch(`/playlist/${playlistId}`, payload, "Failed to rename playlist");
}

export async function deletePlaylist(playlistId: number): Promise<void> {
  return apiDelete(`/playlist/${playlistId}`, "Failed to delete playlist");
}

export type PlaylistSongRow = {
  songId: number;
  title: string;
  artist: string | null;
};

export type PlaylistDetail = {
  id: number;
  name: string;
  description: string | null;
  vocabularyCount: number;
  songs: PlaylistSongRow[];
};

export async function getPlaylist(playlistId: number): Promise<PlaylistDetail> {
  return apiGet(`/playlist/${playlistId}`, "Failed to load playlist");
}

export async function addSongToPlaylist(playlistId: number, songId: number): Promise<void> {
  await apiPost(`/playlist/${playlistId}/songs`, { songId }, "Failed to add song to playlist");
}

export async function removeSongFromPlaylist(playlistId: number, songId: number): Promise<void> {
  return apiDelete(`/playlist/${playlistId}/songs/${songId}`, "Failed to remove song from playlist");
}

export async function generateAnkiCsv(songId: number, selectedVocabularyIds: number[]): Promise<void> {
  const res = await apiFetch("/generate-anki", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ songId, selectedVocabularyIds }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to generate Anki CSV"));
  const blob = await res.blob();
  triggerBlobDownload(blob, "lingroove-anki.csv");
}

export async function exportPlaylistCsv(playlistId: number, playlistName: string): Promise<void> {
  const res = await apiFetch(`/playlist/${playlistId}/export-csv`);
  if (!res.ok) throw new Error(await parseError(res, "Failed to export playlist"));
  const blob = await res.blob();
  const slug = (playlistName.trim().replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "playlist") + ".csv";
  const filename = filenameFromContentDisposition(res.headers.get("Content-Disposition"), slug);
  triggerBlobDownload(blob, filename);
}
