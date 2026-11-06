// Turn animation — the ACTIVE player's profile picture animates while it is
// their turn, so everyone can see at a glance whose move it is.
//
// Rules (admin-controlled via /admin/animations → config.gameAnim):
//   • ONLY the player whose turn it is animates. Every other avatar is static.
//   • It starts the moment the turn begins and stops the moment the dice roll
//     completes (or the turn ends) — see turnAnimActive() below.
//   • Every style animates transform/opacity only, so the browser runs it on the
//     GPU: it cannot slow the dice, the token walk, or the frame rate.

export type TurnAnimStyle =
  | "shake" | "bounce" | "pulse" | "glow" | "rotate"
  | "heartbeat" | "ripple" | "breathing" | "sparkle" | "none";

/** Admin picker options, in the order the client listed them. */
export const TURN_ANIM_STYLES: { id: TurnAnimStyle; label: string; hint: string }[] = [
  { id: "glow", label: "Glow", hint: "Pulsing ring of light — picture stays fixed (recommended)" },
  { id: "pulse", label: "Pulse", hint: "Smoothly grows and shrinks in place" },
  { id: "shake", label: "Shake", hint: "Gentle in-place wobble (no drifting)" },
  { id: "bounce", label: "Bounce", hint: "Gentle up-and-down hop" },
  { id: "rotate", label: "Rotate", hint: "Tilts left and right" },
  { id: "heartbeat", label: "Heartbeat", hint: "Double beat, like a pulse" },
  { id: "ripple", label: "Ripple", hint: "Circle spreads outward and fades" },
  { id: "breathing", label: "Breathing", hint: "Very slow, calm zoom in and out" },
  { id: "sparkle", label: "Sparkle", hint: "Small stars twinkle at the corners" },
  { id: "none", label: "None", hint: "No movement — keeps only the glowing border" },
];

/**
 * The CSS class for the active player's avatar. Returns "" when the feature is
 * off, the style is "none", or it is not this player's turn — so the class is
 * only ever attached to one avatar on screen at a time.
 */
export function turnAnimClass(
  cfg: { turnAnim?: boolean; turnAnimStyle?: TurnAnimStyle } | undefined,
  active: boolean,
): string {
  if (!active) return "";
  if (cfg?.turnAnim === false) return "";
  const style = cfg?.turnAnimStyle ?? "glow";
  if (style === "none") return "";
  return `turn-anim-${style}`;
}

/**
 * Whether the active player's avatar should be animating right now.
 * It plays ONLY while it's the player's turn and they haven't rolled yet (a hint
 * that it's their move). The moment the dice starts ROLLING it STOPS, so the
 * profile picture stays completely FIXED during the roll — only the dice animates
 * (client requirement). It also stops once the roll lands.
 */
export function turnAnimActive(opts: {
  isTurn: boolean;
  rolling: boolean;
  die: number | null | undefined;
  finished?: boolean;
}): boolean {
  if (!opts.isTurn || opts.finished) return false;
  return opts.die == null && !opts.rolling;
}
