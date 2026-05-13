"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading || !user) return null;

  function onLogout() {
    logout();
    router.push("/login");
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-10">
      <h1 className="text-3xl font-semibold">Profile</h1>
      <div className="card space-y-4">
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
      <button type="button" className="button-secondary text-red-300" onClick={onLogout}>
        Sign out
      </button>
    </div>
  );
}
