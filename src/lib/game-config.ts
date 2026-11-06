// Per-game settings resolver. Each game (ludo / snake / chess) can override the
// shared game settings; when a game has no override, we fall back to the global value,
// so behaviour is unchanged until an admin sets a per-game value.
import type { AppConfig } from "@/lib/config";

export type GameId = "ludo" | "snake" | "chess";
type Speed = "slow" | "normal" | "fast";

/** Chance-missing timer (seconds/turn) for a game — per-game override, else global. */
export function gameTurnSeconds(config: AppConfig, game: GameId, fallback = 10): number {
  const v = config.perGameSettings?.[game]?.turnSeconds ?? config.gameTurnSeconds ?? fallback;
  return Math.max(5, Math.min(120, Math.floor(v)));
}

/** Dice animation speed for a game — per-game override, else global. */
export function gameDiceSpeed(config: AppConfig, game: GameId): Speed {
  return config.perGameSettings?.[game]?.diceSpeed ?? config.gameDiceSpeed ?? "normal";
}

/** Token move (hop) speed for a game — per-game override, else global. */
export function gameTokenSpeed(config: AppConfig, game: GameId): Speed {
  return config.perGameSettings?.[game]?.tokenSpeed ?? config.gameTokenSpeed ?? "normal";
}

// NOTE: the "return chances on rejoin" per-game value is read INLINE in the Ludo/Snake
// pages (`perGameSettings?.<game>?.returnChancesOnRejoin ?? gameRules?.returnChancesOnRejoin`)
// so the exact `=== false` / `!== false` polarity of the leave/miss rules is preserved.
// A helper here risked a subtly different default, so it is intentionally omitted.
