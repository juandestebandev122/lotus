// ============================================================
// User Level System — XP earned automatically from in-app activity
// (games, gifts, daily logins, coin purchases, joining rooms) raises a
// player's level. Each level-up grants bonus coins; each TIER unlocks a
// badge, an avatar frame, and perks. Pure module — safe on client + server.
// ============================================================

/** XP awarded per activity. Tune here — used by the server when activity happens. */
export const XP = {
  play: 12, // finishing a game (every player)
  win: 30, // winning a game (on top of `play`)
  gift: 6, // sending a gift
  dailyLogin: 25, // first login of the day
  purchase: 15, // an approved coin purchase
} as const;

export type XpReason = keyof typeof XP;

// XP curve: cumulative XP needed to BE at a level. Level 1 = 0 XP.
// reach(L) = 30·(L-1)·L  →  L2=60, L3=180, L4=360, L5=600, L10=2700, L20=11400 …
const BASE = 60;
export function xpToReach(level: number): number {
  const L = Math.max(1, Math.floor(level));
  return (BASE * (L - 1) * L) / 2;
}

/** Highest level a given XP total qualifies for. */
export function levelForXp(xp: number): number {
  const x = Math.max(0, Math.floor(xp || 0));
  let L = 1;
  while (xpToReach(L + 1) <= x) L++;
  return L;
}

/** Progress within the current level — for a profile progress bar. */
export function levelProgress(xp: number) {
  const x = Math.max(0, Math.floor(xp || 0));
  const level = levelForXp(x);
  const cur = xpToReach(level);
  const next = xpToReach(level + 1);
  const span = Math.max(1, next - cur);
  const intoLevel = Math.max(0, x - cur);
  return {
    xp: x,
    level,
    nextLevel: level + 1,
    intoLevel,
    span,
    toNext: Math.max(0, next - x),
    pct: Math.min(100, Math.round((intoLevel / span) * 100)),
  };
}

/** Coins granted when a player REACHES the given level (capped). */
export function levelUpBonusCoins(level: number): number {
  return Math.min(500, 20 + Math.max(2, level) * 10); // L2=40, L5=70, L10=120 … cap 500
}

export interface LevelTier {
  name: string;
  emoji: string;
  minLevel: number;
  badgeClass: string; // pill background + text
  frame: string; // CSS gradient for the avatar frame ring
  perks: string[];
}

// Milestone tiers. The badge + avatar frame change as players climb.
export const TIERS: LevelTier[] = [
  { name: "Newcomer", emoji: "🌱", minLevel: 1, badgeClass: "bg-emerald-500/15 text-emerald-200", frame: "linear-gradient(135deg,#34d399,#10b981)", perks: ["Welcome badge", "Earn XP from every game, gift, room & daily login"] },
  { name: "Bronze", emoji: "🥉", minLevel: 5, badgeClass: "bg-amber-600/20 text-amber-200", frame: "linear-gradient(135deg,#f59e0b,#b45309)", perks: ["Bronze avatar frame", "Bigger level-up coin rewards"] },
  { name: "Silver", emoji: "🥈", minLevel: 10, badgeClass: "bg-slate-300/15 text-slate-100", frame: "linear-gradient(135deg,#e2e8f0,#94a3b8)", perks: ["Silver avatar frame", "Priority game matching"] },
  { name: "Gold", emoji: "🥇", minLevel: 20, badgeClass: "bg-yellow-500/20 text-yellow-100", frame: "linear-gradient(135deg,#fde047,#f59e0b)", perks: ["Gold avatar frame", "Level badge shown on your profile & in rooms"] },
  { name: "Platinum", emoji: "💠", minLevel: 35, badgeClass: "bg-cyan-400/15 text-cyan-100", frame: "linear-gradient(135deg,#67e8f9,#0891b2)", perks: ["Platinum avatar frame", "Extra co-host slots"] },
  { name: "Diamond", emoji: "💎", minLevel: 50, badgeClass: "bg-fuchsia-500/15 text-fuchsia-100", frame: "linear-gradient(135deg,#f0abfc,#a855f7,#22d3ee)", perks: ["Exclusive Diamond frame", "Top-tier status across the whole app"] },
];

export function tierForLevel(level: number): LevelTier {
  let t = TIERS[0];
  for (const x of TIERS) if (level >= x.minLevel) t = x;
  return t;
}

/** The avatar frame gradient for a level. */
export function frameForLevel(level: number): string {
  return tierForLevel(level).frame;
}
