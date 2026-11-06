"use client";

// Genuine-activity tracking for the Inactivity Detection system.
//
// "Active" means the user actually DID something: touched or clicked anywhere,
// scrolled, typed, opened a page, sent a message, played a game move, joined a
// voice seat, sent a gift. Simply leaving the app open on screen is NOT activity
// — that is exactly the idle-farming this protects the Startup Bonus from.
//
// This module is a tiny shared singleton rather than React state on purpose: it
// is written on every pointer event, so re-rendering the app on each touch would
// be wasteful. Consumers read it through refs / on a timer instead.

import { useEffect, useRef } from "react";

let lastActivityAt = Date.now();
/** Set while the tab is hidden, so we know the user stepped away. */
let hiddenSince = 0;

/** Events that count as a real interaction. `scroll` and `wheel` are passive. */
const ACTIVITY_EVENTS = [
  "pointerdown", "mousedown", "keydown", "touchstart",
  "wheel", "scroll", "input", "submit",
] as const;

/** Mark the user as active right now. Call from any code that represents a
 *  deliberate user action (sending a gift, taking a game turn, …). */
export function markActive(): void {
  lastActivityAt = Date.now();
}

/** Milliseconds since the user last genuinely interacted. */
export function idleMs(): number {
  return Date.now() - lastActivityAt;
}

/** Whether the app is currently in the background / minimised. */
export function isBackgrounded(): boolean {
  return typeof document !== "undefined" && document.hidden;
}

/** How long the app has been backgrounded, in ms (0 when in the foreground). */
export function backgroundedMs(): number {
  return hiddenSince ? Date.now() - hiddenSince : 0;
}

/**
 * Installs the global activity listeners. Mount this ONCE, high in the tree.
 * Listeners are passive + capture so they never interfere with the UI.
 */
export function useActivityTracker(): void {
  const installed = useRef(false);
  useEffect(() => {
    if (installed.current || typeof window === "undefined") return;
    installed.current = true;
    const onAny = () => { lastActivityAt = Date.now(); };
    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, onAny, { passive: true, capture: true });
    }
    const onVis = () => {
      if (document.hidden) {
        hiddenSince = Date.now();
      } else {
        // Coming BACK to the app is itself a deliberate action, and it clears the
        // idle clock. This is what makes background time safe: a user who returns
        // after an hour away starts fresh instead of being logged out instantly.
        hiddenSince = 0;
        lastActivityAt = Date.now();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onAny);
    return () => {
      for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, onAny, { capture: true } as EventListenerOptions);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onAny);
      installed.current = false;
    };
  }, []);
}
