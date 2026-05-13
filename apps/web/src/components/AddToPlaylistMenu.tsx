"use client";

import { useCallback, useEffect, useState } from "react";
import { addSongToPlaylist, createPlaylist, listPlaylists, type PlaylistSummary } from "@/lib/api";

const CREATE_NEW = "__new__";

function NewPlaylistInput({
  value,
  onChange,
  onSubmit,
  loading,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  label: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        className="min-w-0 flex-1 rounded-xl border border-white/10 bg-surfaceSoft px-3 py-2"
        placeholder="New playlist name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="button-secondary shrink-0"
        disabled={loading || !value.trim()}
        onClick={onSubmit}
      >
        {loading ? "Saving…" : label}
      </button>
    </div>
  );
}

export function AddToPlaylistMenu({
  songId,
  onPlaylistsChanged,
}: {
  songId: number;
  onPlaylistsChanged?: () => void;
}) {
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [selected, setSelected] = useState("");
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const r = await listPlaylists();
    setPlaylists(r.playlists);
  }, []);

  useEffect(() => {
    void refresh().catch(() => setPlaylists([]));
  }, [refresh]);

  async function onSaveToExisting() {
    if (!selected || selected === CREATE_NEW) return;
    setLoading(true);
    setMsg(null);
    try {
      await addSongToPlaylist(Number(selected), songId);
      setMsg("Saved to playlist.");
      await refresh();
      onPlaylistsChanged?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setLoading(false);
    }
  }

  async function onCreateAndSave() {
    const name = newName.trim();
    if (!name) return;
    setLoading(true);
    setMsg(null);
    try {
      const pl = await createPlaylist({ name });
      await addSongToPlaylist(pl.id, songId);
      setNewName("");
      setSelected("");
      setMsg("Playlist created and song saved.");
      await refresh();
      onPlaylistsChanged?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not create playlist.");
    } finally {
      setLoading(false);
    }
  }

  if (playlists.length === 0) {
    return (
      <div className="flex min-w-0 flex-col gap-2 text-sm">
        <NewPlaylistInput
          value={newName}
          onChange={setNewName}
          onSubmit={onCreateAndSave}
          loading={loading}
          label="Create & Save to Playlist"
        />
        {msg ? <p className="text-xs text-textSecondary">{msg}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="min-w-0 max-w-full rounded-xl border border-white/10 bg-surfaceSoft px-3 py-2"
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setMsg(null);
          }}
        >
          <option value="">Save to playlist…</option>
          {playlists.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.name}
            </option>
          ))}
          <option value={CREATE_NEW}>+ Create new playlist…</option>
        </select>
        {selected && selected !== CREATE_NEW ? (
          <button type="button" className="button-secondary shrink-0" disabled={loading} onClick={onSaveToExisting}>
            {loading ? "Saving…" : "Save to Playlist"}
          </button>
        ) : null}
      </div>
      {selected === CREATE_NEW ? (
        <NewPlaylistInput
          value={newName}
          onChange={setNewName}
          onSubmit={onCreateAndSave}
          loading={loading}
          label="Create & Save"
        />
      ) : null}
      {msg ? <p className="text-xs text-textSecondary">{msg}</p> : null}
    </div>
  );
}
