// App version + a tiny lifecycle beacon. TEMPORARY diagnostic: the game screens
// call lifelog() at key moments (winner declared, results popup shown/hidden,
// board mounted/unmounted) so we can read — from the server log — the EXACT
// sequence on a real user's device instead of guessing why the popup vanishes.
// The beacon fn is exposed on window.__lotusLog by the inline script in layout.tsx.
export const APP_VERSION = "v569";

// A short per-tab device id so we can isolate ONE player's timeline in the
// server log (two players' events land in the same file). Stable for the tab.
let DEVICE_ID = "";
function deviceId(): string {
  if (DEVICE_ID) return DEVICE_ID;
  try {
    DEVICE_ID = sessionStorage.getItem("lotus.did") || "";
    if (!DEVICE_ID) {
      DEVICE_ID = (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().slice(0, 6) : Math.floor(performance.now()).toString(36).slice(-6));
      sessionStorage.setItem("lotus.did", DEVICE_ID);
    }
  } catch { DEVICE_ID = "anon"; }
  return DEVICE_ID;
}

export function lifelog(tag: string, extra?: Record<string, unknown>) {
  try {
    const w = window as unknown as { __lotusLog?: (o: Record<string, unknown>) => void };
    w.__lotusLog?.({ k: "life", tag, v: APP_VERSION, d: deviceId(), ...(extra ?? {}) });
  } catch {
    /* never throw from diagnostics */
  }
}
