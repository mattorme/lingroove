"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export function TopNav() {
  const router = useRouter();
  const { user, logout, loading } = useAuth();

  function onLogout() {
    logout();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-bg/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold text-accent">
          Lingroove
        </Link>
        <div className="flex items-center gap-3 text-sm text-textSecondary">
          {!loading && user ? (
            <>
              <Link href="/dashboard" className="hover:text-textPrimary">
                Dashboard
              </Link>
              <Link href="/songs" className="hover:text-textPrimary">
                Songs
              </Link>
              <Link href="/playlists" className="hover:text-textPrimary">
                Playlists
              </Link>
              <Link href="/profile" className="hover:text-textPrimary">
                {user.display_name}
              </Link>
              <button
                type="button"
                onClick={onLogout}
                className="rounded-lg border border-white/10 px-3 py-1 text-xs hover:border-accent hover:text-textPrimary"
              >
                Sign out
              </button>
            </>
          ) : !loading ? (
            <>
              <Link href="/login" className="hover:text-textPrimary">
                Sign in
              </Link>
              <Link href="/signup" className="button-primary py-1 text-xs">
                Sign up
              </Link>
            </>
          ) : null}
        </div>
      </nav>
    </header>
  );
}
