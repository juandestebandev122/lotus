// ============================================================
// LotusPlay Connect — Ludo game engine (pure logic, no UI)
// Classic 4-player Ludo on a 15×15 board. The functions here are
// pure: they take a GameState and return a NEW GameState, so React
// can render from immutable snapshots. Geometry constants map every
// board position to a [row, col] cell for the renderer.
// ============================================================

export type Color = "red" | "green" | "yellow" | "blue";

export const COLORS: Color[] = ["red", "green", "yellow", "blue"];

export const LABEL: Record<Color, string> = {
  red: "Red",
  green: "Green",
  yellow: "Yellow",
  blue: "Blue",
};

export interface Token {
  color: Color;
  index: number; // 0..3
  pos: number; // -1 = yard, 0..50 = main track, 51..56 = home column (56 = home)
  // SAME-COLOUR BLOCK (temporary safe zone): true while this coin is part of — or the
  // surviving remnant of — a pair/stack of 2+ same-colour coins on the same box. A
  // stacked coin CANNOT be cut. It's cleared the moment this coin leaves its box, so
  // when a pair splits only the mover loses protection; the coin left behind stays
  // safe on that box until it too moves. Additive/optional so old synced states parse.
  stacked?: boolean;
}

export interface GameState {
  players: Color[]; // active colors, in turn order
  tokens: Token[]; // 4 per active player
  turn: number; // index into players[]
  die: number | null; // last roll; null = must roll
  consecutiveSixes: number;
  winner: Color | null;
  message: string;
  removed: Color[]; // players removed after using all their chances
  misses: Record<string, number>; // missed-turn count per colour (3 = removed)
  // EVERY roll that happened, with an incrementing sequence number `n`. Unlike
  // `die` (which auto-clears on a no-move pass and on each move), this survives
  // in the synced state — so every device can show/animate each roll EXACTLY
  // once, including no-move rolls, three-sixes forfeits and back-to-back sixes.
  // `spent` is set when the roller's turn was ENDED by force (missed turn /
  // leave) — the display must never resurrect a spent roll when the turn cycles
  // back to that player. Optional + additive: older states still parse fine.
  lastRoll?: { value: number; by: Color; n: number; spent?: boolean };
  // Per-colour count of consecutive rolls that were NOT a 6 (reset to 0 the moment
  // that colour rolls a 6). Drives the OPTIONAL admin "Fair Dice" pity system so a
  // player who has gone many turns without a 6 can be given a better chance of one.
  // Purely additive + optional: when the admin feature is OFF this value is only
  // tracked, never read, so the dice stay 100% pure-random and unchanged.
  sinceSix?: Record<string, number>;
}

/** Admin "Fair Dice" (pity) config — all optional, feature is OFF unless enabled. */
export interface FairDiceConfig {
  enabled?: boolean;        // master switch — OFF keeps the dice 100% pure-random
  threshold?: number;       // rolls without a 6 before help starts (3–40, e.g. 10–15)
  boostPercent?: number;    // once past the threshold, % chance to turn a roll into a 6 (0–100)
  guaranteeAfter?: number;  // hard-guarantee a 6 after this many 6-less rolls (0 = never)
}

const clampInt = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.floor(n)));

/**
 * Given a freshly-rolled die value and the roller's current 6-less streak, return
 * the value to actually use. With the feature OFF (or no config) this returns the
 * raw value unchanged — the dice stay perfectly uniform. With it ON, a player who
 * has gone `threshold`+ rolls without a 6 gets a `boostPercent` chance to have this
 * roll become a 6, and a guaranteed 6 once past `guaranteeAfter`. Pure + testable;
 * the caller supplies the randomness only through the raw value + Math.random here.
 */
export function fairDieValue(raw: number, streak: number, cfg?: FairDiceConfig): number {
  if (!cfg?.enabled || raw === 6) return raw; // off, or already a 6 — nothing to do
  const threshold = clampInt(cfg.threshold ?? 12, 3, 40);
  const guarantee = Math.max(0, Math.floor(cfg.guaranteeAfter ?? 0));
  if (guarantee > 0 && streak >= guarantee) return 6; // absolute ceiling — never stuck forever
  if (streak >= threshold) {
    const boost = clampInt(cfg.boostPercent ?? 50, 0, 100) / 100;
    if (Math.random() < boost) return 6;
  }
  return raw;
}

// ─────────────────────────────────────────────────────────────────────────────
// DICE CONTROL MANAGEMENT (Admin → Dice Control)
//
// Everything below applies ONLY to CASUAL Ludo. A PAID tournament / cash match with
// fairPlayProtection on ALWAYS returns a pure-random value (certified fair) — the
// client's own rule. Mode "random" (the default) is also pure-random, so with the
// feature untouched the dice behave exactly as before.
// ─────────────────────────────────────────────────────────────────────────────

export interface DiceControlConfig {
  mode?: "random" | "controlled" | "tournament" | "testing";
  fairPlayProtection?: boolean;
  useProbabilities?: boolean;
  probabilities?: { one?: number; two?: number; three?: number; four?: number; five?: number; six?: number };
  equalProbability?: boolean; winnerBalancing?: boolean; newPlayerSupport?: boolean; autoFairness?: boolean;
  maxRollsWithout6?: number; minRollsBefore6?: number; disableConsecutive6?: boolean; maxConsecutive6?: number;
  boostThreshold?: number; boostPercent?: number;
  playerControls?: { id: string; userId: string; userName: string; preferredValues: number[]; strength?: number; duration?: "match" | "day" | "permanent" | "tournament"; setAt?: string; setBy?: string }[];
}

/** Live context the controlled-die chooser needs about the current roll. */
export interface DiceRollContext {
  sinceSix: number;          // roller's current 6-less streak
  consecutiveSixes: number;  // 6s in a row this turn
  totalRolls: number;        // rolls so far this game (for minRollsBefore6)
  userId?: string;           // the ROLLING player's account id (player-specific control)
  paid?: boolean;            // paid tournament / cash match → forced fair
  isTournament?: boolean;    // tournament match (for "tournament"-scoped player control)
  can6: boolean;             // a 6 has at least one legal move (never force an unusable 6)
  behind?: boolean;          // roller is losing (winner balancing)
  isNew?: boolean;           // roller is a new player (new-player support)
}

const rnd6 = () => 1 + Math.floor(Math.random() * 6);
const rndNo6 = () => 1 + Math.floor(Math.random() * 5); // uniform 1..5

function isPlayerControlActive(pc: NonNullable<DiceControlConfig["playerControls"]>[number], ctx: DiceRollContext): boolean {
  const d = pc.duration ?? "permanent";
  if (d === "tournament") return !!ctx.isTournament;
  if (d === "day") return !pc.setAt || Date.now() - new Date(pc.setAt).getTime() < 24 * 60 * 60 * 1000;
  return true; // "permanent" — and "match" (its expiry is applied server-side after the match)
}

function weightedDie(p?: DiceControlConfig["probabilities"]): number {
  const w = [p?.one ?? 0, p?.two ?? 0, p?.three ?? 0, p?.four ?? 0, p?.five ?? 0, p?.six ?? 0];
  const total = w.reduce((a, b) => a + b, 0);
  if (total <= 0) return rnd6();
  let r = Math.random() * total;
  for (let i = 0; i < 6; i++) { if (r < w[i]!) return i + 1; r -= w[i]!; }
  return 6;
}

function applySixRules(v: number, dc: DiceControlConfig, ctx: DiceRollContext): number {
  const guarantee = Math.max(0, Math.floor(dc.maxRollsWithout6 ?? 0));
  if (guarantee > 0 && ctx.sinceSix >= guarantee && ctx.can6) return 6; // never stuck without a 6
  const bt = Math.max(0, Math.floor(dc.boostThreshold ?? 0));
  if (bt > 0 && ctx.sinceSix >= bt && ctx.can6 && v !== 6 && Math.random() * 100 < Math.max(0, Math.min(100, dc.boostPercent ?? 0))) return 6;
  if (v === 6 && (dc.minRollsBefore6 ?? 0) > 0 && ctx.totalRolls < (dc.minRollsBefore6 ?? 0)) return rndNo6(); // no early 6
  const maxCon = dc.disableConsecutive6 ? 1 : Math.max(0, Math.floor(dc.maxConsecutive6 ?? 0));
  if (v === 6 && maxCon > 0 && ctx.consecutiveSixes >= maxCon) return rndNo6(); // cap consecutive 6s
  return v;
}

/** THE controlled-die chooser — returns a 1–6 value honouring the admin's Dice Control
 *  settings. Guaranteed fair for paid matches + mode "random", and never forces an
 *  unusable 6. Falls back to uniform on any degenerate config. */
export function controlledDie(dc: DiceControlConfig | undefined, ctx: DiceRollContext): number {
  if (ctx.paid && dc?.fairPlayProtection !== false) return rnd6(); // FAIR-PLAY GUARDRAIL
  const mode = dc?.mode ?? "random";
  if (!dc || mode === "random") return rnd6(); // default: pure random (caller adds Fair Dice pity)

  // 1) Player-specific control (casual only) — highest priority.
  const pc = (dc.playerControls ?? []).find((p) => p.userId && p.userId === ctx.userId && (p.preferredValues?.length ?? 0) > 0 && isPlayerControlActive(p, ctx));
  if (pc) {
    if (Math.random() * 100 < Math.max(0, Math.min(100, pc.strength ?? 100))) {
      const vals = pc.preferredValues.filter((v) => v >= 1 && v <= 6);
      let v = vals.length ? vals[Math.floor(Math.random() * vals.length)]! : rnd6();
      if (v === 6 && !ctx.can6) v = rndNo6(); // never hand out an unusable 6
      return v;
    }
    return rnd6();
  }

  // 2) Tournament / equal-probability fairness → uniform (still honour six-rules).
  if (mode === "tournament" || dc.equalProbability) return applySixRules(rnd6(), dc, ctx);

  // 3) Probability table (controlled / testing) + gentle balancing for a losing/new player.
  let v = dc.useProbabilities ? weightedDie(dc.probabilities) : rnd6();
  if (((dc.winnerBalancing && ctx.behind) || (dc.newPlayerSupport && (ctx.isNew || ctx.behind)) || dc.autoFairness) && v <= 3 && Math.random() < 0.35) {
    const bumped = Math.min(6, v + 3);
    v = bumped === 6 && !ctx.can6 ? 5 : bumped; // don't "help" a trailing player into a wasted, unusable 6
  }
  return applySixRules(v, dc, ctx);
}

export const MAX_MISSES = 3; // chances before a player is removed
export const TURN_SECONDS = 10; // seconds allowed per turn (auto-pass after this)

// ----- Board geometry (15×15, [row, col], 0-indexed) -----

// The 52-cell shared ring, clockwise, starting at Red's entry cell.
export const RING: [number, number][] = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7],
  [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14],
  [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7],
  [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0],
  [6, 0],
];

// Where each color enters the ring (its start cell).
export const START: Record<Color, number> = { red: 0, green: 13, yellow: 26, blue: 39 };

// Each color's 6-cell home column (pos 51..56). The last cell is home.
export const HOME: Record<Color, [number, number][]> = {
  red: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
  green: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
  yellow: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
  blue: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]],
};

// Four parking spots in each corner yard.
export const YARD: Record<Color, [number, number][]> = {
  red: [[1, 1], [1, 4], [4, 1], [4, 4]],
  green: [[1, 10], [1, 13], [4, 10], [4, 13]],
  yellow: [[10, 10], [10, 13], [13, 10], [13, 13]],
  blue: [[10, 1], [10, 4], [13, 1], [13, 4]],
};

// Safe cells (ring indices): the 4 starts + the 4 guard stars.
//
// SAFE is the CLASSIC set and stays exported unchanged. The admin can, however,
// move the guard stars to any valid cells on the 52-square ring (Admin → Game
// Board → Safe-zone cells). Because that changes where coins can be captured, the
// chosen set has to be identical for everyone — so it comes from the SERVER config
// and is installed once, at load, via configureSafeCells(). Every rule check and
// every renderer goes through isSafeCell(), so the board's stars and the engine's
// capture rule can never disagree.
export const DEFAULT_SAFE = [0, 8, 13, 21, 26, 34, 39, 47] as const;
export const SAFE = new Set<number>(DEFAULT_SAFE);

let SAFE_SET = new Set<number>(DEFAULT_SAFE);

/** Install the admin's safe cells. Anything invalid is ignored, and an empty or
 *  missing list restores the classic 8 — so a bad config can never leave the board
 *  with no safe squares at all. */
export function configureSafeCells(cells?: number[] | null): void {
  const clean = Array.isArray(cells)
    ? [...new Set(cells.filter((n) => Number.isInteger(n) && n >= 0 && n < 52))]
    : [];
  SAFE_SET = clean.length > 0 ? new Set(clean) : new Set<number>(DEFAULT_SAFE);
}

/** Is this ring index a permanent safe square (no captures there)? */
export function isSafeCell(ringIndex: number): boolean {
  return SAFE_SET.has(ringIndex);
}

/** The safe cells currently in force (for renderers and the admin preview). */
export function safeCells(): number[] {
  return [...SAFE_SET].sort((a, b) => a - b);
}

export const HOME_END = 56; // exact pos required to bring a token home

/** Ring index for a token at main-track pos (0..50), else null. */
export function ringIndexOf(color: Color, pos: number): number | null {
  if (pos < 0 || pos > 50) return null;
  return (START[color] + pos) % 52;
}

/** Board [row, col] for any token, for rendering. */
/** The board CENTRE. Every colour's home column stops one square short of it
 *  (red ends [7,6], green [6,7], yellow [7,8], blue [8,7]), so a finished coin
 *  used to park BESIDE the centre and the arrival celebration burst over an
 *  empty triangle — the "coin never reaches the centre" report. */
export const CENTRE_CELL: [number, number] = [7, 7];

/** Where a token is DRAWN. Rendering only — no rule reads this, so moving the
 *  finished coin into the centre cannot affect the path, turns, cutting, safe
 *  squares or the finishing run. */
export function cellOf(token: Token): [number, number] {
  if (token.pos === -1) return YARD[token.color][token.index];
  if (token.pos <= 50) return RING[ringIndexOf(token.color, token.pos)!];
  // A coin that has finished belongs IN the centre, not next to it.
  if (token.pos >= HOME_END) return CENTRE_CELL;
  return HOME[token.color][token.pos - 51];
}

function clone(s: GameState): GameState {
  return {
    ...s,
    players: [...s.players],
    tokens: s.tokens.map((t) => ({ ...t })),
    removed: [...s.removed],
    misses: { ...s.misses },
    sinceSix: s.sinceSix ? { ...s.sinceSix } : undefined,
  };
}

/** SAME-COLOUR BLOCK maintenance (SET-ONLY). After a move, any NORMAL box on the shared
 *  ring that holds 2+ coins of the SAME colour becomes a temporary safe zone: every coin
 *  in that group gets `stacked = true`. This NEVER clears the flag — clearing happens only
 *  when a coin leaves its box (in applyMove) — which is exactly what keeps the lone
 *  remnant of a split pair protected until it also moves.
 *  The shield is NEVER applied on a PERMANENT safe cell (the 4 starts + 4 guard stars) —
 *  those boxes are already uncuttable by the rules, so no extra shield is needed. This is
 *  purely a no-op for gameplay: capture already skips SAFE cells (see applyMove), so a
 *  `stacked` flag there was never used to block a cut — it only produced a wrong shield. */
function markBlocks(s: GameState): void {
  const groups = new Map<string, Token[]>();
  for (const t of s.tokens) {
    if (t.pos < 0 || t.pos > 50) continue; // yard / home column are not on the shared ring
    const ri = ringIndexOf(t.color, t.pos);
    if (ri === null || isSafeCell(ri)) continue; // off-ring OR a permanent safe cell → no shield
    const key = `${t.color}:${ri}`;
    const arr = groups.get(key);
    if (arr) arr.push(t); else groups.set(key, [t]);
  }
  for (const arr of groups.values()) {
    if (arr.length >= 2) for (const t of arr) t.stacked = true;
  }
}

export function currentColor(s: GameState): Color {
  return s.players[s.turn];
}

export function rollDie(): number {
  return 1 + Math.floor(Math.random() * 6);
}

export function createGame(players: Color[]): GameState {
  const tokens: Token[] = [];
  for (const c of players) for (let i = 0; i < 4; i++) tokens.push({ color: c, index: i, pos: -1 });
  const misses: Record<string, number> = {};
  const sinceSix: Record<string, number> = {};
  players.forEach((p) => { misses[p] = 0; sinceSix[p] = 0; });
  return {
    players,
    tokens,
    turn: 0,
    die: null,
    consecutiveSixes: 0,
    winner: null,
    message: `${LABEL[players[0]]} to roll`,
    removed: [],
    misses,
    sinceSix,
  };
}

function tokensOf(s: GameState, color: Color): Token[] {
  return s.tokens.filter((t) => t.color === color);
}

function allHome(s: GameState, color: Color): boolean {
  return tokensOf(s, color).every((t) => t.pos === HOME_END);
}

/** Token indices that can legally move with this die value. */
export function legalMoves(s: GameState, color: Color, die: number): number[] {
  const res: number[] = [];
  for (const t of tokensOf(s, color)) {
    if (t.pos === HOME_END) continue;
    if (t.pos === -1) {
      if (die === 6) res.push(t.index);
      continue;
    }
    if (t.pos + die <= HOME_END) res.push(t.index);
  }
  return res;
}

function advanceTurn(s: GameState): void {
  for (let i = 1; i <= s.players.length; i++) {
    const next = (s.turn + i) % s.players.length;
    const c = s.players[next];
    if (!s.removed.includes(c) && !allHome(s, c)) {
      s.turn = next;
      return;
    }
  }
}

/** Players still in the game (not removed, not finished). */
export function activeColors(s: GameState): Color[] {
  return s.players.filter((p) => !s.removed.includes(p));
}

export function chancesLeft(s: GameState, color: Color): number {
  return Math.max(0, MAX_MISSES - (s.misses[color] ?? 0));
}

/** The current player missed their turn (timed out). Deducts a chance and may remove them. */
export function missTurn(s: GameState): GameState {
  const st = clone(s);
  if (st.winner) return st;
  const color = currentColor(st);
  st.die = null;
  st.consecutiveSixes = 0;
  // The current turn is over without (or despite) a roll — retire the roll
  // record so no device can show its number again when the turn cycles back.
  if (st.lastRoll) st.lastRoll = { ...st.lastRoll, spent: true };
  st.misses[color] = (st.misses[color] ?? 0) + 1;

  if (st.misses[color] >= MAX_MISSES) {
    st.removed.push(color);
    // their tokens leave the board
    st.tokens.forEach((t) => {
      if (t.color === color) t.pos = -1;
    });
    // last player standing wins (covers 2-player: remove one → other wins)
    const remaining = st.players.filter((p) => !st.removed.includes(p));
    if (remaining.length === 1) {
      st.winner = remaining[0];
      st.message = `${LABEL[color]} was removed — ${LABEL[remaining[0]]} wins! 🎉`;
      return st;
    }
    advanceTurn(st);
    st.message = `${LABEL[color]} was removed (out of chances). ${LABEL[currentColor(st)]}'s turn`;
    return st;
  }

  advanceTurn(st);
  st.message = `${LABEL[color]} missed a turn (${chancesLeft(st, color)} left). ${LABEL[currentColor(st)]}'s turn`;
  return st;
}

/** A player LEFT the game — uses ONE leave-chance (heart), not all of them. They
 *  keep any remaining chances and may rejoin the same game. Only when their last
 *  chance is gone are they removed; in a 2-player game the other player then wins.
 *  The reduced chance count lives in the shared state, so a rejoin never resets it. */
export function leaveGame(s: GameState, color: Color): GameState {
  const st = clone(s);
  if (st.winner || st.removed.includes(color)) return st;
  st.misses[color] = (st.misses[color] ?? 0) + 1; // one leave-chance used (cumulative)

  if (st.misses[color] >= MAX_MISSES) {
    st.removed.push(color);
    st.tokens.forEach((t) => { if (t.color === color) t.pos = -1; });
    const remaining = st.players.filter((p) => !st.removed.includes(p));
    if (remaining.length === 1) {
      st.winner = remaining[0];
      st.die = null;
      st.message = `${LABEL[color]} left too many times — ${LABEL[remaining[0]]} wins! 🎉`;
      return st;
    }
    if (currentColor(st) === color) { st.die = null; advanceTurn(st); }
    st.message = `${LABEL[color]} was removed (out of chances). ${LABEL[currentColor(st)]}'s turn`;
    return st;
  }

  if (currentColor(st) === color) {
    st.die = null;
    if (st.lastRoll) st.lastRoll = { ...st.lastRoll, spent: true }; // their turn ended — retire the roll display
    advanceTurn(st);
  }
  st.message = `${LABEL[color]} left (${chancesLeft(st, color)} chance${chancesLeft(st, color) === 1 ? "" : "s"} left — can rejoin). ${LABEL[currentColor(st)]}'s turn`;
  return st;
}

/** A player LEFT and forfeits the WHOLE match in one go (uses every remaining
 *  chance). Kept for admin force-end; the Leave button uses {@link leaveGame}. */
export function forfeit(s: GameState, color: Color): GameState {
  const st = clone(s);
  if (st.winner || st.removed.includes(color)) return st;
  st.misses[color] = MAX_MISSES; // 0 hearts left
  st.removed.push(color);
  st.tokens.forEach((t) => { if (t.color === color) t.pos = -1; });
  const remaining = st.players.filter((p) => !st.removed.includes(p));
  if (remaining.length === 1) {
    st.winner = remaining[0];
    st.die = null;
    st.message = `${LABEL[color]} left — ${LABEL[remaining[0]]} wins! 🎉`;
    return st;
  }
  if (currentColor(st) === color) {
    st.die = null;
    if (st.lastRoll) st.lastRoll = { ...st.lastRoll, spent: true }; // their turn ended — retire the roll display
    advanceTurn(st);
  }
  st.message = `${LABEL[color]} left the game. ${LABEL[currentColor(st)]}'s turn`;
  return st;
}

/** Merge sticky removals: a late in-flight move from another device must NEVER
 *  re-add a player who has already left/been removed. Keeps every player's board
 *  consistent right after someone leaves (fixes "state inconsistent after leave").
 *  Called on each incoming synced state; only rewrites when a regression is seen. */
export function reconcileRemovals(incoming: GameState, current: GameState): GameState {
  const union = [...new Set([...(incoming.removed ?? []), ...(current.removed ?? [])])];
  if (union.length === (incoming.removed ?? []).length) return incoming; // no one to re-remove
  const st: GameState = { ...incoming, removed: union };
  st.tokens = incoming.tokens.map((t) => (union.includes(t.color) ? { ...t, pos: -1 } : t));
  const remaining = st.players.filter((p) => !union.includes(p));
  if (remaining.length === 1 && !st.winner) { st.winner = remaining[0]; st.die = null; }
  return st;
}

/** Apply the server-authoritative "left seats" (colours whose player pressed
 *  Leave). Removes every listed colour that's still in the game, zeroes their
 *  tokens, advances off a leaver's turn, and declares the last player standing
 *  the winner. Returns the SAME object when nothing changes so the poll can skip
 *  a redundant re-render. This is the authority that makes Leave stick on EVERY
 *  device regardless of state version (fixes "Leave didn't remove the player /
 *  forced to play out 3 chances"). */
export function applyLeftSeats(s: GameState, seatKeys: string[]): GameState {
  if (!seatKeys?.length) return s;
  const toRemove = seatKeys.filter(
    (k) => s.players.includes(k as Color) && !s.removed.includes(k as Color),
  ) as Color[];
  if (!toRemove.length) return s;
  const st = clone(s);
  for (const color of toRemove) {
    st.misses[color] = MAX_MISSES; // 0 hearts left
    st.removed.push(color);
    st.tokens.forEach((t) => { if (t.color === color) t.pos = -1; });
  }
  const remaining = st.players.filter((p) => !st.removed.includes(p));
  if (remaining.length === 1 && !st.winner) {
    st.winner = remaining[0];
    st.die = null;
    st.message = `${LABEL[remaining[0]]} wins! 🎉`;
    return st;
  }
  if (!st.winner) {
    if (toRemove.includes(currentColor(st))) {
      st.die = null;
      if (st.lastRoll) st.lastRoll = { ...st.lastRoll, spent: true }; // their turn ended — retire the roll display
      advanceTurn(st);
    }
    st.message = `${LABEL[currentColor(st)]}'s turn`;
  }
  return st;
}

/** Apply a die roll. Auto-passes the turn when no move is possible. */
export function applyRoll(s: GameState, value: number): GameState {
  const st = clone(s);
  const color = currentColor(st);
  // Record the roll for every device (see GameState.lastRoll) — set on ALL
  // paths, including the auto-pass and three-sixes branches below, so opponents
  // always learn the rolled value even when `die` never stays set.
  st.lastRoll = { value, by: color, n: (s.lastRoll?.n ?? 0) + 1 };
  // Leave-chances are CUMULATIVE for the whole game session: a player gets 3 and
  // each leave / missed turn uses one PERMANENTLY. Playing a turn does NOT refill
  // them, and rejoining never resets them (the count lives in the shared state).
  st.consecutiveSixes = value === 6 ? st.consecutiveSixes + 1 : 0;
  // Track this colour's 6-less streak for the optional Fair Dice pity system.
  // Reset to 0 on a 6, otherwise +1. Always maintained (cheap) so the streak is
  // correct the instant an admin turns the feature on — the value is only ACTED
  // on client-side when the feature is enabled (see games/ludo roll()).
  {
    const ss = st.sinceSix ? { ...st.sinceSix } : {};
    ss[color] = value === 6 ? 0 : (ss[color] ?? 0) + 1;
    st.sinceSix = ss;
  }

  if (value === 6 && st.consecutiveSixes >= 3) {
    st.die = null;
    st.consecutiveSixes = 0;
    advanceTurn(st);
    st.message = `Three 6s — turn forfeited. ${LABEL[currentColor(st)]}'s turn`;
    return st;
  }

  st.die = value;
  const moves = legalMoves(st, color, value);
  if (moves.length === 0) {
    st.die = null;
    advanceTurn(st);
    st.message = `${LABEL[color]} rolled ${value} — no move. ${LABEL[currentColor(st)]}'s turn`;
    return st;
  }
  st.message = `${LABEL[color]} rolled ${value} — pick a token`;
  return st;
}

/** Move the chosen token. Handles captures, extra turns and winning.
 *  `resetMisses` (default true = the lenient "Return chances" rule) clears the
 *  player's missed-turn count when they play, so only 3 misses IN A ROW remove
 *  them. Pass FALSE for the admin "Fixed chances" rule ("used chances stay used"),
 *  where missed turns must be CUMULATIVE and never restored by playing. */
export function applyMove(s: GameState, tokenIndex: number, resetMisses = true): GameState {
  const st = clone(s);
  const color = currentColor(st);
  const die = st.die;
  if (die === null) return st;

  const tok = st.tokens.find((t) => t.color === color && t.index === tokenIndex);
  if (!tok) return st;

  // In "Return chances" mode: the player is clearly PRESENT (they just moved) →
  // clear their missed-turn count so only 3 missed turns IN A ROW remove them
  // (survives brief disconnects). In "Fixed chances" mode (resetMisses=false) we
  // SKIP this, so used chances stay used — the fix for "chances must not be
  // retained in fixed option".
  if (resetMisses && st.misses) st.misses[color] = 0;

  tok.pos = tok.pos === -1 ? 0 : tok.pos + die;
  // This coin just LEFT its previous box → it loses any same-colour-block protection.
  // (When a stacked pair splits, only the mover is cleared here; the coin left behind
  //  keeps stacked=true and stays a safe zone until it too moves.)
  tok.stacked = false;
  const reachedHome = tok.pos === HOME_END;

  // Capture any opponents sharing this (non-safe) ring cell.
  let captured = false;
  const ri = ringIndexOf(color, tok.pos);
  if (ri !== null && !isSafeCell(ri)) {
    for (const o of st.tokens) {
      if (o.color === color) continue;
      // SAME-COLOUR BLOCK = temporary safe zone: a stacked coin (part of, or the
      // remnant of, a 2+ same-colour block) can never be cut.
      if (o.stacked) continue;
      if (ringIndexOf(o.color, o.pos) === ri) {
        o.pos = -1;
        captured = true;
      }
    }
  }

  // Re-mark same-colour blocks (set-only) so a new/kept pair becomes a safe zone.
  markBlocks(st);

  if (allHome(st, color)) st.winner = color;

  const extraTurn = die === 6 || captured || reachedHome;
  st.die = null;

  if (st.winner) {
    st.message = `${LABEL[st.winner]} wins! 🎉`;
    return st;
  }
  if (extraTurn) {
    if (die !== 6) st.consecutiveSixes = 0;
    const note = captured ? "captured! " : reachedHome ? "home! " : "";
    st.message = `${LABEL[color]} ${note}roll again`;
  } else {
    st.consecutiveSixes = 0;
    advanceTurn(st);
    st.message = `${LABEL[currentColor(st)]}'s turn`;
  }
  return st;
}

/** Simple bot: capture > go home > leave yard > advance furthest. */
export function botChoose(s: GameState, color: Color, die: number): number {
  const moves = legalMoves(s, color, die);
  let best = moves[0];
  let bestScore = -Infinity;
  for (const m of moves) {
    const tok = tokensOf(s, color).find((t) => t.index === m)!;
    let score = tok.pos; // prefer advancing tokens already further along
    if (tok.pos === -1) {
      score = 40; // get a token out of the yard
    } else {
      const target = tok.pos + die;
      if (target === HOME_END) score += 120; // bring it home
      else if (target > 50) score += 30; // safety of the home column
      const ri = ringIndexOf(color, target);
      if (ri !== null && !isSafeCell(ri)) {
        const willCapture = s.tokens.some(
          (o) => o.color !== color && !o.stacked && ringIndexOf(o.color, o.pos) === ri,
        );
        if (willCapture) score += 100;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}
