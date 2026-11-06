"use client";

import { useEffect } from "react";

// While a live game BOARD is mounted (active play OR the end-of-game results
// popup), set a global flag. The service-worker auto-update reload checks this
// flag and DEFERS the reload so an update never interrupts a match or wipes the
// winner popup. Crucially it does NOT defer on the game SETUP screen (no board
// mounted there) — so a client sitting in the game section still receives new
// versions between matches, instead of getting stuck on an old build.
declare global {
  interface Window {
    __lotusGameActive?: boolean;
  }
}

export function useGameActiveFlag() {
  useEffect(() => {
    if (typeof window !== "undefined") window.__lotusGameActive = true;
    return () => {
      if (typeof window !== "undefined") window.__lotusGameActive = false;
    };
  }, []);
}
