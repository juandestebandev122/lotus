"use client";

import { useEffect, useState } from "react";

/**
 * PERSONAL BOARD ORIENTATION.
 *
 * Each player can turn the Ludo board so their own home sits where they want it,
 * without changing anything for anyone else.
 *
 * ROTATION ONLY — NEVER A MIRROR. This matters more than it looks.
 *
 * The board used to reach the four corners with two flips: a 180° rotation
 * (top<->bottom) and `scaleX(-1)` (left<->right). The rotation is fine, but the
 * MIRROR reverses handedness: the coins still walk the identical path in the game
 * state, yet reflected on screen they appear to travel ANTICLOCKWISE, and the
 * cutting points, safe squares and finishing run all read backwards. That is
 * exactly what a player sees when they move their seat from bottom-left to
 * bottom-right.
 *
 * A rotation cannot do that. The four corners are simply four quarter-turns:
 *
 *        0°            90°           180°          270°
 *   red    top-left     top-right     bottom-right  bottom-left
 *   green  top-right    bottom-right  bottom-left   top-left
 *   yellow bottom-right bottom-left   top-left      top-right
 *   blue   bottom-left  top-left      top-right     bottom-right
 *
 * So changing seat position is now PURELY visual: the path, the turn order, the
 * cutting rules, the safe cells and the finishing path are mathematically
 * untouched, because rotating a board cannot change which way round it runs.
 *
 * This is a LOCAL VIEW ONLY — saved per browser, never sent to the server and
 * never seen by the other players.
 */

export type Corner = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
export type Rotation = 0 | 90 | 180 | 270;
export interface BoardView { rotation: Rotation }

// The rotation is stored under a new key. The ORIGINAL "my home at the bottom"
// preference is migrated once, so a player who had it on keeps it (it was a 180°
// rotation, which is exactly what it becomes here). The old mirror key is read
// only to clear it — a mirrored view can never be reproduced, by design.
const KEY_ROT = "lotus.game.boardRotation";
const KEY_V_LEGACY = "lotus.game.homeBottom";
const KEY_H_LEGACY = "lotus.game.mirrorX";

function readRotation(): Rotation {
  try {
    const raw = localStorage.getItem(KEY_ROT);
    if (raw === "90" || raw === "180" || raw === "270") return Number(raw) as Rotation;
    if (raw === "0") return 0;
    // First run after the update — carry the old top<->bottom preference across.
    const legacy = localStorage.getItem(KEY_V_LEGACY) === "1";
    localStorage.removeItem(KEY_H_LEGACY); // drop the mirror for good
    return legacy ? 180 : 0;
  } catch {
    return 0;
  }
}

let view: BoardView = { rotation: readRotation() };
const listeners = new Set<(v: BoardView) => void>();

function publish() {
  try { localStorage.setItem(KEY_ROT, String(view.rotation)); } catch { /* ignore */ }
  listeners.forEach((l) => l(view));
}

const norm = (deg: number): Rotation => (((deg % 360) + 360) % 360) as Rotation;

export function getBoardView(): BoardView { return view; }
export function setBoardView(v: Partial<BoardView>): void {
  view = { ...view, ...v, rotation: norm(v.rotation ?? view.rotation) };
  publish();
}
/** Turn the board a quarter-turn clockwise. */
export function rotateBoard(step = 90): void { setBoardView({ rotation: norm(view.rotation + step) }); }
/** Flip the board end-for-end (180°) — the old "my home at the bottom" button. */
export function toggleFlipV(): void { setBoardView({ rotation: norm(view.rotation + 180) }); }

/** React binding — re-renders every component using the board view when it changes. */
export function useBoardView(): [BoardView, (v: Partial<BoardView>) => void] {
  const [v, setV] = useState(view);
  useEffect(() => {
    setV(view); // adopt whatever was persisted before hydration
    const l = (nv: BoardView) => setV({ ...nv });
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return [v, setBoardView];
}

/** Where a colour's home sits by default, before any rotation. */
export const HOME_CORNER: Record<string, Corner> = {
  red: "topLeft", green: "topRight", yellow: "bottomRight", blue: "bottomLeft",
};

// The corners in clockwise order, so a quarter-turn is just a step along this ring.
const CW: Corner[] = ["topLeft", "topRight", "bottomRight", "bottomLeft"];

/** Where a corner ends up on screen after the rotation. */
export function movedCorner(corner: Corner, v: BoardView): Corner {
  const i = CW.indexOf(corner);
  if (i < 0) return corner;
  return CW[(i + v.rotation / 90) % 4];
}

/** Which colour ends up in each screen corner, given the rotation. */
export function cornerColors(v: BoardView): Record<Corner, string> {
  const out = {} as Record<Corner, string>;
  for (const [color, home] of Object.entries(HOME_CORNER)) out[movedCorner(home, v)] = color;
  return out;
}

/**
 * The rotation needed to put `color`'s home in `target`. Used by the one-tap
 * "put my home bottom-left / bottom-right" buttons. Always solvable, because the
 * four quarter-turns reach all four corners.
 */
export function viewForCorner(color: string, target: Corner): BoardView {
  const home = HOME_CORNER[color] ?? "topLeft";
  const from = CW.indexOf(home);
  const to = CW.indexOf(target);
  if (from < 0 || to < 0) return { rotation: 0 };
  return { rotation: norm((to - from) * 90) };
}

/** The CSS transform for the board itself. */
export function boardTransform(v: BoardView): string | undefined {
  return v.rotation ? `rotate(${v.rotation}deg)` : undefined;
}

/**
 * The counter-transform for readable content (names, numbers, HOME text) so it
 * stays upright inside a rotated board. With rotation only, this is simply the
 * opposite turn — no special cases, unlike the old mirror handling.
 */
export function contentTransform(v: BoardView): string | undefined {
  return v.rotation ? `rotate(${-v.rotation}deg)` : undefined;
}
