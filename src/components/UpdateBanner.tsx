"use client";

import { useEffect, useRef, useState } from "react";
import { APP_VERSION } from "@/lib/lifelog";

// EXPLICIT "new version available" banner.
//
// The service worker already auto-reloads on its own lifecycle, but that is
// SILENT and depends on the browser firing a controllerchange promptly — on some
// devices (installed PWA, iOS Safari, a phone that throttles background timers)
// it can lag, leaving the client on old code with NO indication. That is the
// root cause of "I don't see the feature you shipped".
//
// This component makes staleness VISIBLE and FIXABLE: it polls /api/version (a
// plain network request, independent of the SW), compares the SERVER's version
// to the version baked into THIS running bundle, and — if they differ — shows a
// prominent banner with a one-tap hard-update that clears caches, unregisters the
// service worker and reloads. No more guessing whether you're up to date.
export function UpdateBanner() {
  const [latest, setLatest] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dismissedFor = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { v?: string };
        if (!alive || !data?.v) return;
        // Stale = the server is on a DIFFERENT version than this loaded bundle.
        setLatest(data.v !== APP_VERSION ? data.v : null);
      } catch {
        /* offline / transient — ignore */
      }
    };
    check();
    const iv = window.setInterval(check, 60_000);
    const onVisible = () => { if (!document.hidden) check(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    return () => {
      alive = false;
      window.clearInterval(iv);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, []);

  const update = async () => {
    setBusy(true);
    try {
      // Purge every cache and unregister the service worker so nothing stale can
      // be served, then hard-reload to pull the fresh build.
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if (navigator.serviceWorker) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch {
      /* best effort */
    }
    // Cache-busting param guarantees the HTML shell itself is refetched.
    const url = new URL(window.location.href);
    url.searchParams.set("v", Date.now().toString());
    window.location.replace(url.toString());
  };

  // Never interrupt a live game board with the banner (it would cover controls).
  const gameActive = typeof window !== "undefined" && (window as unknown as { __lotusGameActive?: boolean }).__lotusGameActive;
  if (!latest || dismissedFor.current === latest || gameActive) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[9999] flex justify-center px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div className="flex w-full max-w-2xl items-center gap-3 rounded-2xl border border-lotus-400/40 bg-lotus-600/95 px-4 py-2.5 text-sm text-white shadow-2xl backdrop-blur">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/20 text-base">⬆️</span>
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-tight">A new version ({latest}) is ready</p>
          <p className="text-[11px] leading-tight text-white/80">You&apos;re on {APP_VERSION}. Tap update to get the latest features &amp; fixes.</p>
        </div>
        <button
          onClick={update}
          disabled={busy}
          className="shrink-0 rounded-lg bg-white px-3.5 py-1.5 text-xs font-bold text-lotus-700 transition hover:bg-white/90 disabled:opacity-60"
        >
          {busy ? "Updating…" : "Update now"}
        </button>
        <button
          onClick={() => { dismissedFor.current = latest; setLatest(null); }}
          aria-label="Dismiss"
          className="shrink-0 rounded-lg px-2 py-1.5 text-white/70 transition hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
