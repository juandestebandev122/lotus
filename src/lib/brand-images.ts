import { withBase } from "./base-path";

// ============================================================
// App image registry — every changeable image in the app. The admin can
// replace any of these from Admin → App Images; the app reads the override
// from config.images[slot] (an uploaded URL) and falls back to the built-in
// default asset in /public. Keep this list in sync with the wired surfaces.
// ============================================================

export type BrandSlot =
  | "logo"
  | "hero2"
  | "badgeRewards"
  | "objDice"
  | "objCoin"
  | "objGem"
  | "objController"
  | "snakeBoard"
  | "tourneyTrophy"
  | "emptyFriends"
  | "emptyMessages"
  | "emptyNotifications"
  | "emptySearch";

export interface BrandSlotDef {
  key: BrandSlot;
  label: string;
  desc: string;
  def: string; // default asset path in /public
  ratio: string; // recommended size hint for the admin
  group: "Branding" | "Home" | "Decorations" | "Illustrations";
}

export const BRAND_SLOTS: BrandSlotDef[] = [
  { key: "logo", label: "App Logo", desc: "Header, sidebar, login screen and the game-board centre.", def: "/logo.png", ratio: "Square, e.g. 512×512 (round)", group: "Branding" },
  { key: "hero2", label: "Home Banner Art", desc: "The big illustration on the Home welcome banner.", def: "/hero-2.png", ratio: "Wide, e.g. 1200×600 (transparent PNG)", group: "Home" },
  { key: "badgeRewards", label: "Rewards Badge", desc: "The small floating badge on the Home banner.", def: "/badge-rewards.png", ratio: "Square (transparent PNG)", group: "Home" },
  { key: "objDice", label: "Floating Dice", desc: "Decorative dice on the login & profile screens.", def: "/obj-dice.png", ratio: "Square (transparent PNG)", group: "Decorations" },
  { key: "objCoin", label: "Floating Coin", desc: "Decorative coin on the login & profile screens.", def: "/obj-coin.png", ratio: "Square (transparent PNG)", group: "Decorations" },
  { key: "objGem", label: "Floating Gem", desc: "Decorative gem on the login & profile screens.", def: "/obj-gem.png", ratio: "Square (transparent PNG)", group: "Decorations" },
  { key: "objController", label: "Floating Controller", desc: "Decorative controller on the login screen.", def: "/obj-controller.png", ratio: "Square (transparent PNG)", group: "Decorations" },
  { key: "snakeBoard", label: "Snake & Ladder Board", desc: "The Snake & Ladder board illustration.", def: "/snake-board.png", ratio: "Square", group: "Illustrations" },
  { key: "tourneyTrophy", label: "Tournaments Art", desc: "The trophy image on the Tournaments page.", def: "/tourney-trophy.png", ratio: "Square (transparent PNG)", group: "Illustrations" },
  { key: "emptyFriends", label: "Empty · Friends", desc: "Shown when the Friends list is empty.", def: "/empty-friends.png", ratio: "Square", group: "Illustrations" },
  { key: "emptyMessages", label: "Empty · Messages", desc: "Shown when there are no messages.", def: "/empty-messages.png", ratio: "Square", group: "Illustrations" },
  { key: "emptyNotifications", label: "Empty · Notifications", desc: "Shown when there are no notifications.", def: "/empty-notifications.png", ratio: "Square", group: "Illustrations" },
  { key: "emptySearch", label: "Empty · Search", desc: "Shown on the Search screen.", def: "/empty-search.png", ratio: "Square", group: "Illustrations" },
];

const DEFAULTS = Object.fromEntries(BRAND_SLOTS.map((s) => [s.key, s.def])) as Record<BrandSlot, string>;

export const BRAND_SLOT_KEYS: BrandSlot[] = BRAND_SLOTS.map((s) => s.key);

/** Resolve the src for an image slot: the admin override if set, else the
 *  built-in default. Handles data URLs, absolute URLs and app-relative paths. */
export function brandSrc(images: Record<string, string> | undefined, key: BrandSlot): string {
  const v = images?.[key];
  if (v && (v.startsWith("data:") || v.startsWith("http"))) return v;
  return withBase(v || DEFAULTS[key]);
}
