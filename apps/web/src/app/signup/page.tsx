"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchMeWithToken, signup } from "@/lib/api";

const MAX_PASSWORD_BYTES = 72;

export default function SignupPage() {
  const router = useRouter();
  const { user, login: authLogin, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
      setError(`Password must be at most ${MAX_PASSWORD_BYTES} characters.`);
      return;
    }
    setSubmitting(true);
    try {
      const { access_token } = await signup({ email, display_name: displayName, password });
      const userData = await fetchMeWithToken(access_token);
      authLogin(access_token, userData);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;

  return (
    <div className="mx-auto max-w-sm py-16">
      <div className="card space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Create account</h1>
          <p className="mt-1 text-sm text-textSecondary">
            Already have an account?{" "}
            <Link href="/login" className="text-accent underline">
              Sign in
            </Link>
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm text-textSecondary">Display name</label>
            <input
              type="text"
              required
              autoComplete="name"
              className="w-full rounded-xl border border-white/10 bg-surfaceSoft px-3 py-2"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-textSecondary">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-xl border border-white/10 bg-surfaceSoft px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-textSecondary">Password</label>
            <input
              type="password"
              required
              minLength={8}
              maxLength={MAX_PASSWORD_BYTES}
              autoComplete="new-password"
              className="w-full rounded-xl border border-white/10 bg-surfaceSoft px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-textSecondary">8–{MAX_PASSWORD_BYTES} characters.</p>
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button type="submit" className="button-primary w-full" disabled={submitting}>
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
