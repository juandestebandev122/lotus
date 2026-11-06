"use client";

import { useEffect, useState } from "react";

// Premium game effects master switch (persisted per browser). Gates all the
// "juicy" extras — coin-move/kill/home/win sounds + haptics, safe-zone glow,
// capture flash, home celebration, winner fireworks & confetti — so a player who
// prefers a plain board can turn everything off. ON by default.
const KEY = "lotus.game.fx";
let fxOn = (() => {
  try { return typeof localStorage === "undefined" || localStorage.getItem(KEY) !== "0"; } catch { return true; }
})();
const listeners = new Set<(on: boolean) => void>();

export function isFxOn(): boolean { return fxOn; }
export function setFxOn(on: boolean): void {
  fxOn = on;
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* ignore */ }
  listeners.forEach((l) => l(on));
}

/** React binding so any component re-renders when the effects switch flips. */
export function useGameFx(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(fxOn);
  useEffect(() => {
    const l = (v: boolean) => setOn(v);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return [on, setFxOn];
}
