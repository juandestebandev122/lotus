"use client";

import { useEffect } from "react";

// Registers the service worker so the app is installable on Android
// ("Add to Home screen" / Play Store TWA). Also keeps the app ALWAYS up to date:
// it re-checks for a new version on load, when the app regains focus, and on a
// short interval — and reloads ONCE when a new version takes control. This means
// a long-running session (someone who never closes the tab) still picks up new
// deploys automatically, instead of getting stuck on an old cached screen.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    // Reload once when a NEW service worker takes control (i.e. the app was
    // updated). Skip the very first install (no previous version to replace).
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    const onControllerChange = () => {
      if (reloading || !hadController) return;
      // NEVER yank the page out from under an ACTIVE GAME BOARD — a mid-match
      // reload would wipe the board and, worse, the end-of-game RESULTS popup
      // (which reads as "the winner screen appeared for a second then vanished").
      // Defer only while a game BOARD is actually mounted (window.__lotusGameActive,
      // set by NetBoard). We do NOT defer on the game SETUP screen, so a client
      // sitting in the game section still receives the update between matches —
      // deferring on the whole /games/ path used to trap them on an old build.
      const doReload = () => {
        if (reloading) return;
        // Defer the automatic reload while a game BOARD is mounted, OR while an admin
        // is working in the ADMIN PANEL — an admin editing settings/reviewing chats
        // must not be yanked out mid-task every time a new version deploys. Admins
        // still see the "Update now" banner + the manual Refresh button, so they
        // update on THEIR terms (this is the "group chats page reloads by itself" fix).
        const onAdmin = typeof location !== "undefined" && location.pathname.startsWith("/admin");
        if ((typeof window !== "undefined" && window.__lotusGameActive) || onAdmin) {
          window.setTimeout(doReload, 5000);
          return;
        }
        reloading = true;
        window.location.reload();
      };
      doReload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    let cleanupChecks: (() => void) | null = null;
    const register = () => {
      navigator.serviceWorker
        // updateViaCache:"none" → the SW script is always fetched fresh, so new
        // versions are detected reliably.
        .register("/sw.js", { updateViaCache: "none" })
        .then((reg) => {
          const check = () => { reg.update().catch(() => {}); };
          check();
          // Keep checking so a long session updates itself: on focus / when the
          // app returns to the foreground, and every couple of minutes.
          const iv = window.setInterval(check, 120_000);
          const onVisible = () => { if (!document.hidden) check(); };
          document.addEventListener("visibilitychange", onVisible);
          window.addEventListener("focus", check);
          cleanupChecks = () => {
            window.clearInterval(iv);
            document.removeEventListener("visibilitychange", onVisible);
            window.removeEventListener("focus", check);
          };
        })
        .catch(() => {});
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register);

    // --- Stale-deploy safety net ---------------------------------------------
    // Right after a new version goes live, a browser still running the OLD build
    // can click a link whose code chunk no longer exists on the server. That
    // navigation dead-ends on the browser's "This page couldn't load" with no
    // recovery (the periodic SW check may not have fired yet). Here we listen for
    // those specific "stale build" failures and reload ONCE to pull the fresh
    // version. A short cooldown prevents any reload loop.
    const RELOAD_KEY = "lotus-stale-reload-at";
    const isStaleDeployError = (msg: string) =>
      /ChunkLoadError|Loading chunk [^ ]+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Failed to find Server Action/i.test(msg);
    const recover = (raw: unknown) => {
      const msg = typeof raw === "string" ? raw : (raw && typeof raw === "object" && "message" in raw ? String((raw as { message?: unknown }).message ?? "") : String(raw ?? ""));
      if (!isStaleDeployError(msg)) return;
      let last = 0;
      try { last = Number(sessionStorage.getItem(RELOAD_KEY) || 0); } catch { /* private mode */ }
      const now = Date.now();
      if (now - last < 20_000) return; // already reloaded very recently — don't loop
      try { sessionStorage.setItem(RELOAD_KEY, String(now)); } catch { /* ignore */ }
      window.location.reload();
    };
    const onError = (e: ErrorEvent) => {
      // A 404'd <script>/<link> chunk fires a (non-bubbling) resource error on its element.
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "SCRIPT" || tgt.tagName === "LINK")) {
        const url = (tgt as HTMLScriptElement).src || (tgt as HTMLLinkElement).href || "";
        if (url.includes("/_next/static/")) return recover("ChunkLoadError: " + url);
      }
      recover(e.message || (e.error as { message?: string } | undefined)?.message);
    };
    const onRejection = (e: PromiseRejectionEvent) => recover((e.reason as { message?: string } | undefined)?.message ?? e.reason);
    // Capture phase so we also catch resource-load (script/link 404) errors.
    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      window.removeEventListener("load", register);
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onRejection);
      cleanupChecks?.();
    };
  }, []);
  return null;
}
