// ---------------------------------------------------------------------------
// ADMIN-MANAGED DICE LIBRARY.
//
// Mirrors the token library (lib/tokenDesigns.ts) so both behave the same way:
// the built-in skins are seeded into a catalogue the admin can rename, reorder,
// enable/disable, or override with an uploaded picture — and the admin can add
// entirely new dice on top. Players only ever see ENABLED designs in Customize.
//
// Before this there was ONE custom dice face (gameDice.faceImage) shared by
// everybody, so "multiple dice styles" was not possible.
// ---------------------------------------------------------------------------

import { DICE_SKINS } from "./cosmetics";

export type DiceCategory = "Free" | "Premium" | "VIP" | "Event" | "Seasonal";
export const DICE_CATEGORIES: DiceCategory[] = ["Free", "Premium", "VIP", "Event", "Seasonal"];

export interface DiceDesignCfg {
  id: string;        // a built-in DiceSkin id, or "dice-xxxx" for an admin addition
  name: string;      // shown in Customize
  enabled: boolean;  // players can pick it when true
  builtin?: string;  // the built-in skin id (set for seeded designs)
  /** Uploaded artwork for the die FACE. Replaces the pip drawing entirely. */
  image?: string;
  /** Optional look overrides for a non-image die (Tailwind classes). */
  surface?: string;
  pip?: string;
  category?: string;
  order?: number;
  /**
   * Coin price for a PREMIUM/VIP/Event dice. 0 or unset = free to everyone.
   * A dice with a price must be bought once with coins before a player can equip
   * it; the purchase is permanent.
   */
  priceCoins?: number;
  /** How long a purchase lasts, in days. 0/unset = permanent. */
  validityDays?: number;
}

/** True when this dice has to be bought before it can be used. */
export const dicePriceOf = (d?: { priceCoins?: number }): number => Math.max(0, Math.floor(d?.priceCoins ?? 0));

/** A player may use a dice when it's free, they bought it, or they're an admin. */
export function canUseDice(d: DiceDesignCfg | undefined, ownedIds: string[] | undefined, isAdmin = false): boolean {
  if (!d) return false;
  if (dicePriceOf(d) <= 0) return true;
  if (isAdmin) return true;
  return (ownedIds ?? []).includes(d.id);
}

/** The built-in skins, seeded into the catalogue so the admin starts with a full set. */
export function defaultDiceDesigns(): DiceDesignCfg[] {
  return DICE_SKINS.map((s, i) => ({
    id: s.id,
    name: s.name,
    enabled: true,
    builtin: s.id,
    surface: s.surface,
    pip: s.pip,
    category: "Free",
    order: i,
  }));
}

/** Admin edits merged over the built-ins, then any admin-added designs appended. */
export function resolveDiceDesigns(cfg?: DiceDesignCfg[]): DiceDesignCfg[] {
  const base = defaultDiceDesigns();
  if (!cfg?.length) return base;
  const merged = base.map((b) => {
    const o = cfg.find((x) => x.id === b.id);
    return o
      ? {
          ...b,
          name: o.name || b.name,
          enabled: o.enabled !== false,
          image: o.image ?? b.image,
          surface: o.surface ?? b.surface,
          pip: o.pip ?? b.pip,
          category: o.category ?? b.category,
          order: o.order ?? b.order,
          priceCoins: o.priceCoins ?? b.priceCoins,
          validityDays: o.validityDays ?? b.validityDays,
        }
      : b;
  });
  const extra = cfg.filter((c) => !base.some((b) => b.id === c.id));
  return [...merged, ...extra].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** Only the designs a player may pick. */
export function enabledDiceDesigns(cfg?: DiceDesignCfg[]): DiceDesignCfg[] {
  return resolveDiceDesigns(cfg).filter((d) => d.enabled);
}

/** The look for a chosen dice id — face image and/or surface + pip classes. */
export function diceLook(id: string | undefined, cfg?: DiceDesignCfg[]): { image?: string; surface?: string; pip?: string } {
  const all = resolveDiceDesigns(cfg);
  const d = (id && all.find((x) => x.id === id)) || all[0];
  if (!d) return {};
  return { image: d.image?.trim() || undefined, surface: d.surface, pip: d.pip };
}
