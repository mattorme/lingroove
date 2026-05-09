import { ImportLyricsForm } from "@/components/ImportLyricsForm";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="text-textSecondary">Import lyrics via URL or raw text to start analysis.</p>
      </section>
      <ImportLyricsForm />
      <section className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="mb-1 text-lg font-semibold">Recent Songs</h2>
          <p className="text-sm text-textSecondary">Songs appear here after import and analysis.</p>
        </div>
        <div className="card">
          <h2 className="mb-1 text-lg font-semibold">Playlists</h2>
          <p className="text-sm text-textSecondary">Create custom playlists to organize vocabulary themes.</p>
        </div>
      </section>
    </div>
  );
}
