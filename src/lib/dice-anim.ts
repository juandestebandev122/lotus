// Dice-roll animation styles — the visual the die plays WHILE it is rolling
// (from the instant the player taps Roll until the result lands). Admin-selectable
// via /admin/animations → config.gameAnim.diceStyle, exactly like the turn-anim
// styles. Every style animates transform only, so it runs on the GPU and never
// affects the roll timing, the result, or game speed.

export type DiceAnimStyle =
  | "tumble" | "spin" | "flip" | "shake" | "bounce" | "wobble" | "zoom" | "roll2d";

/** Admin picker options. `tumble` is the original 3-D dice roll (recommended). */
export const DICE_ANIM_STYLES: { id: DiceAnimStyle; label: string; hint: string }[] = [
  { id: "tumble", label: "3-D Tumble", hint: "Realistic dice tumbling on its axes (recommended)" },
  { id: "spin", label: "Spin", hint: "Fast flat spin" },
  { id: "flip", label: "Flip", hint: "Flips over vertically" },
  { id: "shake", label: "Shake", hint: "Quick side-to-side shake" },
  { id: "bounce", label: "Bounce", hint: "Hops up and down while rolling" },
  { id: "wobble", label: "Wobble", hint: "Tilts and wobbles" },
  { id: "zoom", label: "Zoom pulse", hint: "Pulses bigger and smaller" },
  { id: "roll2d", label: "Flat roll", hint: "Simple 2-D spin (lightest)" },
];

/** The CSS class attached to the die element while `rolling` is true. Returns the
 *  chosen style's class, falling back to the classic tumble. When dice animation
 *  is turned OFF entirely the game doesn't add the `rolling` state at all, so this
 *  is only ever asked for when an animation should play. */
export function diceAnimClass(
  cfg: { diceStyle?: DiceAnimStyle } | undefined,
): string {
  const style = cfg?.diceStyle ?? "tumble";
  return `dice-anim-${style}`;
}
