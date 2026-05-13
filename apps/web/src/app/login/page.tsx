"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchMeWithToken, login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { user, login: authLogin, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { access_token } = await login({ email, password });
      const userData = await fetchMeWithToken(access_token);
      authLogin(access_token, userData);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;

  return (
    <div className="mx-auto max-w-sm py-16">
      <div className="card space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="mt-1 text-sm text-textSecondary">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-accent underline">
              Sign up
            </Link>
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
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
              autoComplete="current-password"
              className="w-full rounded-xl border border-white/10 bg-surfaceSoft px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button type="submit" className="button-primary w-full" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
