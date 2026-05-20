"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { STATIC_BASE } from "@/lib/config";

function UserAvatarCircle({ avatarUrl, displayName }: { avatarUrl: string | null; displayName: string }) {
  if (avatarUrl) {
    return (
      <div className="relative h-8 w-8 overflow-hidden rounded-full ring-1 ring-white/10">
        <Image
          src={`${STATIC_BASE}${avatarUrl}`}
          alt={displayName}
          fill
          className="object-cover"
          unoptimized
        />
      </div>
    );
  }
  return (
    <div className="h-8 w-8 rounded-full border border-white/20 bg-white/[0.06]" />
  );
}

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
                Add Songs
              </Link>
              <Link href="/songs" className="hover:text-textPrimary">
                Songs
              </Link>
              <Link href="/playlists" className="hover:text-textPrimary">
                Playlists
              </Link>

              {/* Avatar with hover dropdown */}
              <div className="group relative ml-1">
                <Link href="/profile" className="block">
                  <UserAvatarCircle avatarUrl={user.avatar_url} displayName={user.display_name} />
                </Link>

                <div className="invisible absolute right-0 top-full z-20 mt-2 w-44 overflow-hidden rounded-xl border border-white/10 bg-surface opacity-0 shadow-2xl transition-all duration-150 group-hover:visible group-hover:opacity-100">
                  <Link
                    href="/profile"
                    className="block px-4 py-2.5 text-sm text-textSecondary transition hover:bg-white/[0.05] hover:text-textPrimary"
                  >
                    Account
                  </Link>
                  <div className="border-t border-white/10" />
                  <button
                    type="button"
                    onClick={onLogout}
                    className="w-full px-4 py-2.5 text-left text-sm text-red-400 transition hover:bg-white/[0.05]"
                  >
                    Sign out
                  </button>
                </div>
              </div>
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
