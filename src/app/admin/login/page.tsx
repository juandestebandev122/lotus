"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/Logo";
import { ShieldCheck, Mail, Lock, ArrowLeft } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const { user, isAuthed, loading, loginWithEmail, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Already signed in as an admin → go straight to the panel.
  useEffect(() => {
    if (!loading && isAuthed && user?.role === "admin" && !submitted) {
      router.replace("/admin");
    }
  }, [loading, isAuthed, user, submitted, router]);

  // After a login attempt, route based on the account's role.
  useEffect(() => {
    if (!submitted || !user) return;
    if (user.role === "admin") {
      router.replace("/admin");
    } else {
      setError("This account doesn't have admin access.");
      setSubmitted(false);
      logout();
    }
  }, [submitted, user, router, logout]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await loginWithEmail(email.trim(), password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Login failed");
      return;
    }
    setSubmitted(true); // role check happens in the effect above
  };

  const field =
    "h-11 w-full rounded-xl border border-line bg-ink-800 pl-10 pr-3.5 text-sm text-mist-100 outline-none placeholder:text-mist-500 focus:border-lotus-400";

  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size="md" href={null} />
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-lotus-500/15 px-3 py-1 text-xs font-semibold text-lotus-200">
            <ShieldCheck className="size-3.5" /> Admin Panel
          </div>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-ink-850 p-6 shadow-xl">
          <h1 className="font-display text-xl font-extrabold text-mist-100">Admin sign in</h1>
          <p className="mt-1 text-sm text-mist-400">Restricted area — administrators only.</p>

          <label className="mt-5 block text-sm font-semibold text-mist-200">Email</label>
          <div className="relative mt-1.5">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mist-500" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your admin email"
              autoFocus
              className={field}
            />
          </div>

          <label className="mt-4 block text-sm font-semibold text-mist-200">Password</label>
          <div className="relative mt-1.5">
            <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mist-500" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={field}
            />
          </div>

          <div className="mt-2 flex justify-end">
            <Link href="/forgot" className="text-xs text-lotus-300 hover:text-lotus-200">Forgot password?</Link>
          </div>

          {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

          <Button type="submit" block size="lg" className="mt-5" disabled={busy}>
            <ShieldCheck className="size-5" /> {busy ? "Signing in…" : "Sign in to Admin"}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <Link href="/home" className="inline-flex items-center gap-1.5 text-sm text-mist-400 hover:text-mist-200">
            <ArrowLeft className="size-4" /> Back to app
          </Link>
        </div>
      </div>
    </div>
  );
}
