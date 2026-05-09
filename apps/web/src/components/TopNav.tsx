import Link from "next/link";

export function TopNav() {
  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-bg/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold text-accent">
          Lingroove
        </Link>
        <div className="flex items-center gap-3 text-sm text-textSecondary">
          <Link href="/dashboard" className="hover:text-textPrimary">
            Dashboard
          </Link>
          <Link href="/export" className="hover:text-textPrimary">
            Export
          </Link>
        </div>
      </nav>
    </header>
  );
}
