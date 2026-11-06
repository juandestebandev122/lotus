"use client";

import { useEffect, useState } from "react";

// Personal preference: rotate the Ludo board so MY home/base sits at the BOTTOM of
// the screen (opponents fill the other sides). Purely a local display choice (per
// browser) — it never changes the shared game, so each player can view the board
// from their own perspective. OFF by default (opt-in). Shared store + listeners so
// the in-game toggle and the Customize setting stay in sync live.
const KEY = "lotus.game.homeBottom";
let on: boolean = (() => {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
})();
const listeners = new Set<(v: boolean) => void>();

export function getHomeBottom(): boolean { return on; }
export function setHomeBottom(v: boolean): void {
  on = v;
  try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* ignore */ }
  listeners.forEach((l) => l(v));
}

/** React binding so any component re-renders when the preference flips. */
export function useHomeBottom(): [boolean, (v: boolean) => void] {
  const [v, setV] = useState(on);
  useEffect(() => {
    setV(on); // adopt any value persisted before hydration
    const l = (nv: boolean) => setV(nv);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return [v, setHomeBottom];
}
