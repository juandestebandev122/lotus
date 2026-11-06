"use client";

import { useEffect, useState } from "react";

// GLOBAL ERROR BOUNDARY — the app-wide catch-all for an unrecoverable render error.
// Its MAIN job is automatic STALE-DEPLOY RECOVERY: right after a new version goes
// live, a browser still running the OLD build can navigate to a page whose code
// chunk / server action no longer exists on the server. That failure bubbles here
// (Next's App Router routes navigation errors through the error boundary, NOT a
// window 'error' event — so the listener in ServiceWorkerRegister can't catch it,
// which is why users saw the bare "This page couldn't load" with no recovery). We
// detect those "old build" signatures and reload ONCE to pull the fresh version, so
// the user is transparently updated instead of dead-ending. A short cooldown guards
// against any reload loop; a genuine (non-stale) error shows a friendly retry UI.

const STALE_DEPLOY_RE =
  /ChunkLoadError|Loading chunk [^ ]+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Failed to find Server Action|Failed to load script|__next_f|missing required error components/i;
const RELOAD_KEY = "lotus-stale-reload-at"; // shared with ServiceWorkerRegister's cooldown

export default function GlobalError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  const blob = `${error?.message ?? ""} ${error?.stack ?? ""} ${error?.digest ?? ""}`;
  const isStale = STALE_DEPLOY_RE.test(blob);
  const [recovering, setRecovering] = useState(isStale);

  useEffect(() => {
    if (!isStale) return;
    let last = 0;
    try { last = Number(sessionStorage.getItem(RELOAD_KEY) || 0); } catch { /* private mode */ }
    const now = Date.now();
    // Already reloaded very recently → don't loop; fall back to the manual button.
    if (now - last < 20_000) { setRecovering(false); return; }
    try { sessionStorage.setItem(RELOAD_KEY, String(now)); } catch { /* ignore */ }
    // Small delay so this frame paints the "Updating…" message before the reload.
    const t = setTimeout(() => { try { window.location.reload(); } catch { /* ignore */ } }, 400);
    return () => clearTimeout(t);
  }, [isStale]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0713", color: "#e8e3f2", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
        <div style={{ maxWidth: 400, padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }} aria-hidden>🪷</div>
          {recovering ? (
            <>
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>Updating to the latest version…</h1>
              <p style={{ fontSize: 14, color: "#a79fc0", margin: 0 }}>A newer version of Lotus is live. Loading it now — this only takes a moment.</p>
            </>
          ) : (
            <>
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>Something went wrong</h1>
              <p style={{ fontSize: 14, color: "#a79fc0", margin: "0 0 18px" }}>Please reload the page. If it keeps happening, close all tabs of the app and open it again.</p>
              <button
                onClick={() => { try { window.location.reload(); } catch { /* ignore */ } }}
                style={{ background: "#7c3aed", color: "#fff", border: 0, borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
              >Reload</button>
            </>
          )}
        </div>
      </body>
    </html>
  );
}
