import Link from "next/link";

export default function HomePage() {
  return (
    <section className="grid gap-6 py-16 md:grid-cols-2 md:items-center">
      <div className="space-y-4">
        <p className="text-sm uppercase tracking-widest text-accent">Lingroove</p>
        <h1 className="text-4xl font-bold leading-tight">Learn Spanish through songs you already love.</h1>
        <p className="text-textSecondary">
          Import lyrics, extract vocabulary with NLP, organize songs in playlists, and export Anki-ready flashcards.
        </p>
        <Link href="/dashboard" className="button-primary inline-block">
          Open Dashboard
        </Link>
      </div>
      <div className="card min-h-64 bg-gradient-to-br from-surface to-surfaceSoft">
        <p className="text-sm text-textSecondary">Music-first language learning</p>
        <p className="mt-4 text-lg">
          Dark immersive UI, lyric context, and one-click Anki export.
        </p>
      </div>
    </section>
  );
}
