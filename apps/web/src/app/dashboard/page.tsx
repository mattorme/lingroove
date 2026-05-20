"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import { ImportLyricsForm } from "@/components/ImportLyricsForm";
import { PlaylistArtwork } from "@/components/PlaylistArtwork";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import {
  addSongToPlaylist,
  listPlaylists,
  listSongs,
  songSourceLabel,
  type PlaylistSummary,
  type SongSummary,
} from "@/lib/api";

const HOW_IT_WORKS = [
  { n: "1", text: "Paste a lyrics URL or raw text below" },
  { n: "2", text: "Review the NLP vocabulary breakdown" },
  { n: "3", text: "Export selected words as Anki flashcards" },
];

function DraggableSongRow({ song }: { song: SongSummary }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `song-${song.id}`,
    data: { songId: song.id },
  });

  return (
    <li
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`group -mx-2 cursor-grab select-none rounded-lg outline-none transition-all active:cursor-grabbing ${
        isDragging
          ? "scale-[0.98] bg-white/[0.03] opacity-40"
          : "hover:bg-white/[0.06]"
      }`}
    >
      <Link
        href={`/analysis/${song.id}`}
        className="flex items-center gap-3 px-2 py-2.5"
      >
        {song.artworkUrl ? (
          <div className={`relative h-9 w-9 shrink-0 overflow-hidden rounded-md transition-transform ${isDragging ? "" : "group-hover:scale-105"}`}>
            <Image
              src={song.artworkUrl}
              alt={song.title}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div className="h-9 w-9 shrink-0 rounded-md bg-white/[0.06]" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {song.title}
            {song.artist ? (
              <span className="font-normal text-textSecondary"> · {song.artist}</span>
            ) : null}
          </p>
          <p className="mt-0.5 truncate text-xs text-textSecondary">
            {songSourceLabel(song.sourceType)} · {new Date(song.createdAt).toLocaleString()}
          </p>
        </div>
      </Link>
    </li>
  );
}

function DroppablePlaylistRow({
  playlist,
  isActive,
  feedback,
}: {
  playlist: PlaylistSummary;
  isActive: boolean;
  feedback: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `playlist-${playlist.id}`,
    data: { playlistId: playlist.id },
  });

  const highlighted = isOver || !!feedback;

  return (
    <li
      ref={setNodeRef}
      style={{
        backgroundColor: highlighted
          ? "rgb(168 85 247 / 0.35)"
          : isActive
          ? "rgba(255,255,255,0.03)"
          : undefined,
        transform: highlighted
          ? "scale(1.03)"
          : isActive
          ? "scale(0.99)"
          : undefined,
      }}
      className={`-mx-2 rounded-xl transition-all duration-150 ${!highlighted && !isActive ? "hover:bg-white/[0.06]" : ""}`}
    >
      <Link
        href={`/playlist/${playlist.id}`}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex items-center gap-3 px-2 py-2.5"
      >
        <div
          className="transition-transform duration-150"
          style={{ transform: highlighted ? "scale(1.1)" : undefined }}
        >
          <PlaylistArtwork urls={playlist.artworkUrls} size={9} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{playlist.name}</p>
          <p className="text-xs text-textSecondary">
            {playlist.songCount} {playlist.songCount === 1 ? "song" : "songs"}
          </p>
        </div>
        {feedback ? (
          <span className="shrink-0 text-xs font-medium text-green-400">
            {feedback}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

export default function DashboardPage() {
  const { user, loading } = useRequireAuth();
  const [songs, setSongs] = useState<SongSummary[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeSong, setActiveSong] = useState<SongSummary | null>(null);
  const [dropFeedback, setDropFeedback] = useState<{
    playlistId: number;
    msg: string;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Prefer pointer-within (cursor inside row) for hover feedback. If the
  // cursor isn't strictly inside any row (between rows etc.), fall back to
  // rect intersection so drops still register.
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointer = pointerWithin(args);
    if (pointer.length > 0) return pointer;
    return rectIntersection(args);
  }, []);

  const refreshLists = useCallback(async () => {
    setLoadError(null);
    try {
      const [songRes, plRes] = await Promise.all([listSongs(5), listPlaylists()]);
      setSongs(songRes.songs);
      setPlaylists(plRes.playlists);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load data.");
    }
  }, []);

  useEffect(() => {
    if (user) void refreshLists();
  }, [user, refreshLists]);

  function handleDragStart(e: DragStartEvent) {
    const songId = e.active.data.current?.songId as number | undefined;
    const song = songs.find((s) => s.id === songId) ?? null;
    setActiveSong(song);
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveSong(null);
    const songId = e.active.data.current?.songId as number | undefined;
    const playlistId = e.over?.data.current?.playlistId as number | undefined;
    if (!songId || !playlistId) return;
    try {
      await addSongToPlaylist(playlistId, songId);
      setDropFeedback({ playlistId, msg: "Added!" });
      void refreshLists();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to add";
      setDropFeedback({ playlistId, msg });
    } finally {
      setTimeout(() => setDropFeedback(null), 3000);
    }
  }

  if (loading || !user) return null;

  const hasSongs = songs.length > 0;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-semibold">Add Songs</h1>
        <p className="text-textSecondary">
          Import lyrics via URL or raw text to start analysis.
        </p>
      </section>

      {!hasSongs && (
        <section className="rounded-2xl border border-accent/20 bg-accent/5 px-5 py-4">
          <p className="mb-3 text-sm font-medium text-accent">How it works</p>
          <ol className="flex flex-col gap-2 sm:flex-row sm:gap-6">
            {HOW_IT_WORKS.map((step) => (
              <li key={step.n} className="flex items-start gap-2.5 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent">
                  {step.n}
                </span>
                <span className="text-textSecondary">{step.text}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <ImportLyricsForm />

      {loadError ? <p className="text-sm text-red-400">{loadError}</p> : null}

      {hasSongs && (
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveSong(null)}
        >
          <section className="grid items-stretch gap-4 md:grid-cols-2">
            {/* ── Recent Songs (draggable) ── */}
            <div className="card">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Recent Songs</h2>
                <Link href="/songs" className="text-xs text-accent underline">
                  View all
                </Link>
              </div>
              <ul className="space-y-0.5">
                {songs.map((s) => (
                  <DraggableSongRow key={s.id} song={s} />
                ))}
              </ul>
            </div>

            {/* ── Playlists (droppable) ── */}
            <div className="card">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Playlists</h2>
                <Link href="/playlists" className="text-xs text-accent underline">
                  Manage
                </Link>
              </div>
              {playlists.length === 0 ? (
                <p className="text-sm text-textSecondary">
                  No playlists yet.{" "}
                  <Link href="/playlists" className="text-accent underline">
                    Create one
                  </Link>{" "}
                  to organise your songs.
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {playlists.map((p) => (
                    <DroppablePlaylistRow
                      key={p.id}
                      playlist={p}
                      isActive={activeSong !== null}
                      feedback={
                        dropFeedback?.playlistId === p.id
                          ? dropFeedback.msg
                          : null
                      }
                    />
                  ))}
                </ul>
              )}
            </div>
          </section>

          <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
            {activeSong ? (
              <div className="flex w-56 cursor-grabbing items-center gap-3 rounded-xl border border-white/15 bg-surface px-3 py-2.5 shadow-[0_20px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
                {activeSong.artworkUrl ? (
                  <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md shadow-md">
                    <Image
                      src={activeSong.artworkUrl}
                      alt={activeSong.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="h-9 w-9 shrink-0 rounded-md bg-white/[0.06]" />
                )}
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate font-medium">{activeSong.title}</p>
                  {activeSong.artist ? (
                    <p className="truncate text-xs text-textSecondary">{activeSong.artist}</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
