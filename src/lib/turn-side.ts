"use client";

import { useEffect, useState } from "react";

// Personal preference: which bottom corner the always-visible in-game "turn
// indicator" floats in — bottom-LEFT or bottom-RIGHT. Purely a local display
// choice (per browser); it is NOT synced to other players, so each user sees the
// indicator wherever THEY placed it (comfortable one-handed mobile play). RIGHT
// by default (most thumbs). Shared global store + listeners so the in-game swap
// button and the Customize setting stay in sync live.
export type TurnSide = "left" | "right";

const KEY = "lotus.game.turnSide";
let side: TurnSide = (() => {
  try { return localStorage.getItem(KEY) === "left" ? "left" : "right"; } catch { return "right"; }
})();
const listeners = new Set<(s: TurnSide) => void>();

export function getTurnSide(): TurnSide { return side; }
export function setTurnSide(s: TurnSide): void {
  side = s;
  try { localStorage.setItem(KEY, s); } catch { /* ignore */ }
  listeners.forEach((l) => l(s));
}

/** React binding so any component re-renders when the side preference flips. */
export function useTurnSide(): [TurnSide, (s: TurnSide) => void] {
  const [s, setS] = useState(side);
  useEffect(() => {
    // Adopt any value persisted before hydration, then subscribe to live changes.
    setS(side);
    const l = (v: TurnSide) => setS(v);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return [s, setTurnSide];
}
