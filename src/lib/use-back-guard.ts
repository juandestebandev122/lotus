"use client";

import { useEffect } from "react";
import { lifelog } from "./lifelog";

/**
 * While `active` is true, ABSORB the browser/phone BACK button (and back-swipe
 * gesture) so it does NOT navigate away from the current page. Used on the game
 * winner/result screen: a reflexive back-tap right after a win used to instantly
 * throw the player back to the voice room and wipe the winner screen. With this
 * guard, the hardware back keeps them on the result (they leave via the on-screen
 * "Back to Room" / "Play Again" buttons instead).
 *
 * How it works: while active we keep exactly ONE sentinel entry on top of the
 * history stack (same URL, so no navigation). A back press pops the sentinel and
 * fires `popstate`, where we re-push it — so the user stays on the result. When
 * the guard turns off WITHOUT navigating away (e.g. Play Again, or the player
 * taps ✕ to view the board), we quietly remove the sentinel so history stays
 * clean and a later back press behaves normally. It logs `nav:back` so we can
 * confirm from the server log that a hardware-back was the trigger.
 */
export function useBackGuard(active: boolean, onBack?: () => void): void {
  useEffect(() => {
    if (!active || typeof window === "undefined") return;

    const isSentinel = () => {
      try { return !!(window.history.state as { __lotusBackGuard?: boolean } | null)?.__lotusBackGuard; }
      catch { return false; }
    };
    const pushSentinel = () => { try { window.history.pushState({ __lotusBackGuard: true }, ""); } catch { /* ignore */ } };

    // Seed a single sentinel so the next back press pops THIS, not the page. Each
    // subsequent back re-pushes it, so there is never more than one at a time.
    pushSentinel();

    const onPop = () => {
      lifelog("nav:back", { guarded: true });
      pushSentinel(); // stay on the result screen
      onBack?.();     // optional: reveal the board, etc.
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      // If the guard is switching off but we did NOT navigate away (the sentinel
      // is still the current entry — e.g. Play Again / ✕), consume it so history
      // is left exactly as we found it. If we DID navigate away (current entry is
      // the new page, not the sentinel), leave history to the router.
      if (isSentinel()) { try { window.history.back(); } catch { /* ignore */ } }
    };
  }, [active, onBack]);
}
