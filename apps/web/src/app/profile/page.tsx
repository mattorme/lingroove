"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { deleteAvatar, uploadAvatar } from "@/lib/api";
import { STATIC_BASE } from "@/lib/config";

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout, updateUser, loading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!confirmRemove) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setConfirmRemove(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirmRemove]);

  if (loading || !user) return null;

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);
    setAvatarLoading(true);
    try {
      const updated = await uploadAvatar(file);
      updateUser(updated);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setAvatarLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function onConfirmRemoveAvatar() {
    setConfirmRemove(false);
    setAvatarError(null);
    setAvatarLoading(true);
    try {
      const updated = await deleteAvatar();
      updateUser(updated);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Failed to remove avatar.");
    } finally {
      setAvatarLoading(false);
    }
  }

  function onLogout() {
    logout();
    router.push("/login");
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-10">
      <h1 className="text-3xl font-semibold">Account</h1>

      {/* Avatar */}
      <div className="card space-y-4">
        <h2 className="text-sm font-medium text-textSecondary">Profile picture</h2>
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-24 w-24 overflow-hidden rounded-full ring-1 ring-white/10">
            {user.avatar_url ? (
              <Image
                src={`${STATIC_BASE}${user.avatar_url}`}
                alt={user.display_name}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="h-full w-full rounded-full bg-white/[0.06]" />
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={onAvatarChange}
            />
            <button
              type="button"
              className="button-secondary text-sm"
              disabled={avatarLoading}
              onClick={() => fileInputRef.current?.click()}
            >
              {avatarLoading ? "Uploading…" : user.avatar_url ? "Change photo" : "Upload photo"}
            </button>
            {user.avatar_url && (
              <button
                type="button"
                className="rounded-full border border-red-500/50 px-4 py-2 text-sm text-red-400 transition hover:border-red-500 hover:text-red-300 disabled:opacity-50"
                disabled={avatarLoading}
                onClick={() => setConfirmRemove(true)}
              >
                Remove photo
              </button>
            )}
          </div>
        </div>
        {avatarError && <p className="text-sm text-red-400">{avatarError}</p>}
        <p className="text-xs text-textSecondary">JPEG, PNG or WebP · max 5 MB</p>
      </div>

      {/* Account details */}
      <div className="card space-y-4">
        <h2 className="text-sm font-medium text-textSecondary">Details</h2>
        <div className="space-y-1">
          <p className="text-sm text-textSecondary">Display name</p>
          <p className="font-medium">{user.display_name}</p>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-textSecondary">Email</p>
          <p className="font-medium">{user.email}</p>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-textSecondary">Member since</p>
          <p className="font-medium">{new Date(user.created_at).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          className="rounded-full bg-red-500 px-8 py-2.5 text-base font-medium text-white transition hover:bg-red-600"
          onClick={onLogout}
        >
          Sign out
        </button>
      </div>

      {confirmRemove && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmRemove(false); }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-surface p-6 shadow-2xl">
            <h2 className="text-lg font-semibold">Remove photo?</h2>
            <p className="mt-2 text-sm text-textSecondary">
              Your profile picture will be permanently removed.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmRemove(false)}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-textSecondary transition hover:text-textPrimary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirmRemoveAvatar}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-400"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
