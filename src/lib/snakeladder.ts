// ============================================================
// Snake & Ladder — a simple, classic multiplayer board game.
// 2–4 players race from square 1 to 100. Ladders jump you up,
// snakes slide you down. Roll a 6 to get an extra turn. First
// player to land exactly on 100 wins.
// ============================================================

export type Color = "red" | "green" | "yellow" | "blue";
export const SL_COLORS: Color[] = ["red", "green", "yellow", "blue"];

// head (high square) -> tail (low square)
export const SNAKES: Record<number, number> = {
  16: 6,
  47: 26,
  49: 11,
  56: 53,
  62: 19,
  64: 60,
  87: 24,
  93: 73,
  95: 75,
  98: 78,
};

// bottom (low square) -> top (high square)
export const LADDERS: Record<number, number> = {
  1: 38,
  4: 14,
  9: 31,
  21: 42,
  28: 84,
  36: 44,
  51: 67,
  71: 91,
  80: 100,
};

export interface Jump {
  from: number;
  to: number;
  kind: "snake" | "ladder";
}

export interface SLState {
  players: Color[];
  pos: Record<Color, number>;
  turn: number; // index into players
  dice: number | null;
  winner: Color | null;
  lastJump: Jump | null;
  left?: Color[]; // players who left — skipped in the turn rotation
  misses?: Record<string, number>; // missed-turn count per colour (3 = removed)
  rolls?: number; // monotonic roll counter — used to reset the turn timer per roll
}

export const MAX_MISSES_SL = 3; // chances before a player is removed
export const TURN_SECONDS_SL = 10; // seconds allowed per turn

/** Chances (hearts) a player has left before being removed. */
export function chancesLeftSL(s: SLState, color: Color): number {
  return Math.max(0, MAX_MISSES_SL - (s.misses?.[color] ?? 0));
}

/** Next player index whose seat hasn't left the game (skips left players). */
function nextActiveTurn(s: SLState, from: number): number {
  const n = s.players.length;
  const left = s.left ?? [];
  for (let i = 1; i <= n; i++) {
    const t = (from + i) % n;
    if (!left.includes(s.players[t])) return t;
  }
  return from;
}

export function createSL(players: Color[]): SLState {
  const pos = {} as Record<Color, number>;
  const misses = {} as Record<string, number>;
  players.forEach((p) => { pos[p] = 0; misses[p] = 0; }); // 0 = not yet on the board
  return { players, pos, turn: 0, dice: null, winner: null, lastJump: null, misses, rolls: 0 };
}

export function currentPlayer(s: SLState): Color {
  return s.players[s.turn];
}

/** A player LEFT — uses ONE leave-chance (heart), not all of them. They keep any
 *  remaining chances and may rejoin the same game; only when their last chance is
 *  gone are they removed (in a 2-player game the other player then wins). The
 *  reduced count lives in the shared state, so a rejoin never resets it. */
export function leaveSL(s: SLState, color: Color): SLState {
  if (s.winner || (s.left ?? []).includes(color)) return s;
  const misses = { ...(s.misses ?? {}) };
  misses[color] = (misses[color] ?? 0) + 1; // one leave-chance used (cumulative)
  const ns: SLState = { ...s, misses, dice: null };
  if (misses[color] >= MAX_MISSES_SL) {
    const left = [...(s.left ?? []), color];
    const remaining = s.players.filter((p) => !left.includes(p));
    ns.left = left;
    if (remaining.length === 1) { ns.winner = remaining[0]; return ns; }
    if (remaining.length === 0) return ns;
    if (s.players[s.turn] === color) ns.turn = nextActiveTurn(ns, s.turn);
    return ns;
  }
  if (s.players[s.turn] === color) ns.turn = nextActiveTurn(ns, s.turn);
  return ns;
}

/** A player left and forfeits the WHOLE match (uses every remaining chance).
 *  Kept for admin force-end; the Leave button uses {@link leaveSL}. */
export function forfeitSL(s: SLState, color: Color): SLState {
  if (s.winner || (s.left ?? []).includes(color)) return s;
  const left = [...(s.left ?? []), color];
  const remaining = s.players.filter((p) => !left.includes(p));
  if (remaining.length === 1) return { ...s, left, winner: remaining[0], dice: null };
  if (remaining.length === 0) return { ...s, left };
  // 3-4 players: drop the leaver from the rotation so the game never hangs.
  const ns: SLState = { ...s, left, dice: null };
  if (s.players[s.turn] === color) ns.turn = nextActiveTurn(ns, s.turn);
  return ns;
}

/** Apply the server-authoritative "left seats" (colours whose player pressed
 *  Leave). Removes every listed colour still in the game, advances off a
 *  leaver's turn, and declares the last player standing the winner. Returns the
 *  SAME object when nothing changes so the poll can skip a redundant re-render.
 *  This makes Leave stick on EVERY device regardless of state version. */
export function applyLeftSeatsSL(s: SLState, seatKeys: string[]): SLState {
  if (!seatKeys?.length) return s;
  const already = s.left ?? [];
  const toRemove = seatKeys.filter(
    (k) => s.players.includes(k as Color) && !already.includes(k as Color),
  ) as Color[];
  if (!toRemove.length) return s;
  const left = [...already, ...toRemove];
  const remaining = s.players.filter((p) => !left.includes(p));
  if (remaining.length === 1) return { ...s, left, winner: remaining[0], dice: null };
  if (remaining.length === 0) return { ...s, left };
  const ns: SLState = { ...s, left, dice: null };
  if (toRemove.includes(s.players[s.turn])) ns.turn = nextActiveTurn(ns, s.turn);
  return ns;
}

/** Merge sticky removals: a late in-flight move must never re-add a player who
 *  already left. Keeps every device consistent right after someone leaves. */
export function reconcileRemovalsSL(incoming: SLState, current: SLState): SLState {
  const union = [...new Set([...(incoming.left ?? []), ...(current.left ?? [])])];
  if (union.length === (incoming.left ?? []).length) return incoming;
  const st: SLState = { ...incoming, left: union };
  const remaining = st.players.filter((p) => !union.includes(p));
  if (remaining.length === 1 && !st.winner) { st.winner = remaining[0]; st.dice = null; }
  return st;
}

/** The current player missed their turn (timed out). Deduct a chance; THREE
 *  missed turns in a row (a player who left/went idle) removes them. In a
 *  2-player game removing one player makes the other win immediately. */
export function missSL(s: SLState): SLState {
  if (s.winner) return s;
  const color = s.players[s.turn];
  const misses = { ...(s.misses ?? {}) };
  misses[color] = (misses[color] ?? 0) + 1;
  const ns: SLState = { ...s, misses, dice: null };
  if (misses[color] >= MAX_MISSES_SL) {
    const left = [...(s.left ?? []), color];
    const remaining = s.players.filter((p) => !left.includes(p));
    ns.left = left;
    if (remaining.length === 1) { ns.winner = remaining[0]; return ns; }
    if (remaining.length === 0) return ns;
    ns.turn = nextActiveTurn(ns, s.turn);
    return ns;
  }
  ns.turn = nextActiveTurn(ns, s.turn);
  return ns;
}

/** Can the current player move a coin with this dice value?
 *  START-ON-1 RULE: a coin sits in the base (square 0) until its owner rolls
 *  exactly a 1 — only then may it ENTER the board (onto square 1). Once on the
 *  board an exact roll is needed to finish (overshooting 100 is not a legal move). */
export function canMoveSL(s: SLState, dice: number): boolean {
  const start = s.pos[s.players[s.turn]];
  if (start === 0) return dice === 1;   // must roll a 1 to leave the base
  return start + dice <= 100;           // exact finish; no overshoot past 100
}

/** Apply the ROLL ONLY. Sets the dice and, when there is NO legal move, auto-passes
 *  the turn. It does NOT move the coin — the player taps their own coin
 *  ({@link applyMoveSL}) to move it (manual movement, mirrors Ludo). Returns a NEW state. */
export function applyRoll(s: SLState, dice: number): SLState {
  if (s.winner) return s;
  const start = s.pos[s.players[s.turn]];
  const ns: SLState = {
    ...s,
    pos: { ...s.pos },
    dice,
    lastJump: null,
    // Leave-chances are CUMULATIVE for the whole session — playing a turn does NOT
    // refill them, and rejoining never resets them (the count lives in shared state).
    misses: { ...(s.misses ?? {}) },
    rolls: (s.rolls ?? 0) + 1,
  };
  if (!canMoveSL(s, dice)) {
    // No legal move → the coin stays put and the turn passes. At the BASE, ANY
    // non-1 (even a 6) passes the turn — the "enter only on a 1" rule wins over
    // the 6-rolls-again rule. On the board an overshoot passes unless it was a 6.
    ns.dice = null;
    if (start === 0 || dice !== 6) ns.turn = nextActiveTurn(ns, s.turn);
    return ns;
  }
  // Legal move available → hold the dice and wait for the player's tap.
  return ns;
}

/** Perform the pending move (the player tapped their coin). Enters the board on a
 *  1, otherwise advances by the dice; applies snakes/ladders, wins on exactly 100,
 *  and grants another roll on a 6. No-op when no move is pending. Returns a NEW state. */
export function applyMoveSL(s: SLState): SLState {
  if (s.winner || s.dice == null) return s;
  const me = s.players[s.turn];
  const dice = s.dice;
  const start = s.pos[me];
  if (!canMoveSL(s, dice)) {
    // Nothing legal to do — shouldn't happen (applyRoll gates it) but stay safe.
    const ns: SLState = { ...s, dice: null };
    if (start === 0 || dice !== 6) ns.turn = nextActiveTurn(ns, s.turn);
    return ns;
  }
  const ns: SLState = { ...s, pos: { ...s.pos }, lastJump: null, misses: { ...(s.misses ?? {}) }, dice: null };
  let next = start === 0 ? 1 : start + dice; // a 1 enters onto square 1

  if (LADDERS[next] !== undefined) {
    ns.lastJump = { from: next, to: LADDERS[next], kind: "ladder" };
    next = LADDERS[next];
  } else if (SNAKES[next] !== undefined) {
    ns.lastJump = { from: next, to: SNAKES[next], kind: "snake" };
    next = SNAKES[next];
  }
  ns.pos[me] = next;

  if (next === 100) {
    ns.winner = me;
    return ns;
  }

  // Roll of 6 → same player goes again; otherwise pass to the next ACTIVE player
  // (skipping anyone who left, so the game can't freeze on an empty seat).
  if (dice !== 6) {
    ns.turn = nextActiveTurn(ns, s.turn);
  }
  return ns;
}

/** Map a square (1..100) to a 0-based row/col, row 0 at the BOTTOM, boustrophedon order. */
export function squareToRC(n: number): { row: number; col: number } {
  const row = Math.floor((n - 1) / 10);
  const offset = (n - 1) % 10;
  const col = row % 2 === 0 ? offset : 9 - offset;
  return { row, col };
}
