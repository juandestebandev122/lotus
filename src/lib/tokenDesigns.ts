// ============================================================
// Admin-managed game token designs. The admin can enable/disable
// and rename the built-in Ludo token skins, and add custom ones
// (with an uploaded image). Players only see ENABLED designs in
// Customize, and a custom design renders its image in-game.
// ============================================================

export type TokenCategory = "Free" | "Premium" | "VIP" | "Event" | "Seasonal";
export const TOKEN_CATEGORIES: TokenCategory[] = ["Free", "Premium", "VIP", "Event", "Seasonal"];

export interface TokenDesignCfg {
  id: string;        // built-in LudoToken skin id, or "custom-xxxx"
  name: string;      // display name shown in Customize
  enabled: boolean;  // available to players when true
  builtin?: string;  // the built-in skin id (set for built-in designs)
  image?: string;    // image URL — a CUSTOM design's art, OR an admin REPLACEMENT that
                     // overrides a built-in design's art. Used as the FALLBACK for any
                     // colour that has no dedicated picture below.
  // PER-COLOUR artwork. A single `image` made all four players' coins identical, so
  // in a 4-player game nobody could tell whose coin was whose. Each colour can now
  // carry its own picture; anything left empty falls back to `image`, so an existing
  // one-image design keeps working exactly as before.
  images?: { red?: string; green?: string; yellow?: string; blue?: string };
  category?: string; // Free / Premium / VIP / Event / Seasonal (default Free)
  order?: number;    // display order in Customize (lower first)
  /**
   * Coin price. 0 or unset = FREE to everyone (unchanged behaviour).
   * Any price above 0 makes this token purchase-only: it appears in the Store's
   * Tokens category on its own, and a player must buy it once (permanently)
   * before they can use it. Same model as paid dice.
   */
  priceCoins?: number;
  /** How long a purchase lasts, in days. 0/unset = permanent (same meaning as
   *  the Frame Store). Only applies to paid designs. */
  validityDays?: number;
}

/** True when this token has to be bought before it can be used. */
export const tokenPriceOf = (d?: { priceCoins?: number }): number => Math.max(0, Math.floor(d?.priceCoins ?? 0));

/** A player may use a token when it's free, they bought it, or they're an admin. */
export function canUseToken(d: TokenDesignCfg | undefined, ownedIds: string[] | undefined, isAdmin = false): boolean {
  if (!d) return false;
  if (tokenPriceOf(d) <= 0) return true;
  if (isAdmin) return true;
  return (ownedIds ?? []).includes(d.id);
}

/** The four Ludo player colours a token design can carry artwork for. */
export const TOKEN_COLORS = ["red", "green", "yellow", "blue"] as const;
export type TokenColor = (typeof TOKEN_COLORS)[number];

/** The built-in designs (mirror of cosmetics TOKEN_SKINS) used to seed the catalog. */
export function defaultTokenDesigns(): TokenDesignCfg[] {
  return [
    { id: "royal-lotus", name: "Royal Lotus 🪷", enabled: true, builtin: "royal-lotus" },
    { id: "lotus-bloom", name: "Lotus Bloom 🌸", enabled: true, builtin: "lotus-bloom" },
    { id: "animal-lotus", name: "Animal Lotus 🦁", enabled: true, builtin: "animal-lotus" },
    { id: "butterfly-lotus", name: "Butterfly Lotus 🦋", enabled: true, builtin: "butterfly-lotus" },
    { id: "peacock-lotus", name: "Peacock Lotus 🦚", enabled: true, builtin: "peacock-lotus" },
    { id: "shiva-lotus", name: "Shiva Lotus 🕉️", enabled: true, builtin: "shiva-lotus" },
    { id: "coin", name: "Royal Coin", enabled: true, builtin: "coin" },
    { id: "classic", name: "Classic", enabled: true, builtin: "classic" },
    { id: "glossy", name: "Glossy", enabled: true, builtin: "glossy" },
    { id: "ring", name: "Ring", enabled: true, builtin: "ring" },
    { id: "gem", name: "Gem", enabled: true, builtin: "gem" },
    { id: "star", name: "Star", enabled: true, builtin: "star" },
    { id: "pin", name: "Pin", enabled: true, builtin: "pin" },
    { id: "pawn", name: "Pawn", enabled: true, builtin: "pawn" },
    { id: "crown", name: "Crown", enabled: true, builtin: "crown" },
    { id: "pearl", name: "Pearl", enabled: true, builtin: "pearl" },
  ];
}

/** Merge admin config over the built-in defaults so new built-ins always appear
 *  and admin edits (name/enabled) win; custom designs are appended. */
export function resolveTokenDesigns(cfg?: TokenDesignCfg[]): TokenDesignCfg[] {
  const base = defaultTokenDesigns();
  let merged: TokenDesignCfg[];
  if (!cfg || !cfg.length) {
    merged = base;
  } else {
    const byId = new Map(cfg.map((d) => [d.id, d]));
    merged = base.map((b) => {
      const o = byId.get(b.id);
      // Admin edits win (name / enabled / an image OVERRIDE / category / order /
      // PRICE). The price must be carried through here — this merge is what the
      // Store, the purchase check and the game all read, so a price dropped here
      // makes a paid token look free everywhere.
      return o ? { ...b, name: o.name || b.name, enabled: o.enabled !== false, image: o.image ?? b.image, images: o.images ?? b.images, category: o.category ?? b.category, order: o.order, priceCoins: o.priceCoins ?? b.priceCoins, validityDays: o.validityDays ?? b.validityDays } : b;
    });
    for (const d of cfg) if (!base.some((b) => b.id === d.id)) merged.push(d);
  }
  // Stable sort by admin display order (undefined orders keep their position last).
  return merged
    .map((d, i) => ({ d, i }))
    .sort((a, b) => {
      const ao = a.d.order ?? 1000 + a.i;
      const bo = b.d.order ?? 1000 + b.i;
      return ao - bo || a.i - b.i;
    })
    .map((x) => x.d);
}

/** Only the designs a player is allowed to pick (enabled). */
export function enabledTokenDesigns(cfg?: TokenDesignCfg[]): TokenDesignCfg[] {
  return resolveTokenDesigns(cfg).filter((d) => d.enabled);
}

/** The custom image for a selected token id (undefined for built-in designs).
 *
 *  Pass the player's COLOUR to get that colour's own artwork. Falling back to the
 *  shared `image` keeps every design made before per-colour art working, and means
 *  an admin can fill in the four colours one at a time. */
export function customTokenImage(id: string | undefined, cfg?: TokenDesignCfg[], color?: string): string | undefined {
  if (!id) return undefined;
  const d = resolveTokenDesigns(cfg).find((x) => x.id === id);
  if (!d) return undefined;
  const perColor = color ? d.images?.[color as TokenColor] : undefined;
  return (perColor && perColor.trim()) || d.image;
}
