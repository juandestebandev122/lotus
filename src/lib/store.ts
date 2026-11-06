// STORE helpers - backgrounds, name effects, badges (frames have their own
// lib in frames.ts; both share the same buy/equip/expiry model).
import type { CSSProperties } from "react";
import { withBase } from "@/lib/base-path";
import type { AppConfig } from "@/lib/config";

// NOTE: dice, boards and tokens are NOT store items. Their price lives on the
// design itself, in the admin page where the design is created — see
// lib/cosmetic-shop.ts. That is what makes a new design appear in the Store on
// its own, with nothing to keep in step.
export type StoreKind = "background" | "nameEffect" | "badge" | "overlay";
export type PurchaseLimit = "once" | "daily" | "weekly" | "monthly" | "lifetime";
export type StoreItem = {
  id: string; kind: StoreKind; name: string;
  image?: string; style?: string; price: number; enabled: boolean;
  category?: string; badge?: string; description?: string;
  validityDays?: number; order?: number; vipOnly?: boolean;
  // ---- v400 store controls ----
  archived?: boolean;        // archived → hidden from the store, kept for restore
  featured?: boolean; newArrival?: boolean; trending?: boolean;
  comingSoon?: boolean;      // shown as a teaser, not buyable yet
  limitedEdition?: boolean;
  salePrice?: number;        // discounted price (used while a sale window is active)
  saleStart?: string; saleEnd?: string; // ISO dates ("" = open-ended on that side)
  stock?: number;            // remaining stock; undefined = unlimited
  purchaseLimit?: PurchaseLimit; // undefined = unlimited buys
  minLevel?: number; maxLevel?: number; // level eligibility (0/unset = no limit)
  displayOnly?: boolean;     // visible in the store but NOT purchasable ("Display only") — distinct from comingSoon
  agencyIds?: string[];      // if non-empty, ONLY members of these agencies can see + buy this item (empty/unset = everyone)
  userIds?: string[];        // if non-empty, restrict to these SELECTED users (see + buy). Also drives "Invitation only".
  gender?: "male" | "female"; // restrict to a gender (optional; unset = everyone)
  // How the audience restriction (agencies / users / gender / vip / level) behaves — this is
  // what makes VISIBILITY independent from PURCHASE. "hide" (default) = non-eligible users can't
  // SEE it; "show" = everyone SEES it but only eligible users can BUY it (also gives "invite only").
  restrictMode?: "hide" | "show";
  freeForVip?: boolean;      // VIP members get it for FREE (price 0 for them)
  firstBuyDiscountPct?: number; // % off a user's FIRST purchase of this item (0/unset = none)
};

/** Is an item's sale window currently active? */
export function saleActive(item: StoreItem, now = Date.now()): boolean {
  if (typeof item.salePrice !== "number" || item.salePrice < 0) return false;
  const start = item.saleStart ? new Date(item.saleStart).getTime() : -Infinity;
  const end = item.saleEnd ? new Date(item.saleEnd).getTime() + 86_400_000 : Infinity; // inclusive end day
  return now >= start && now < end;
}

/** The price a buyer actually pays right now, and whether it's a sale. */
export function effectiveStorePrice(item: StoreItem, now = Date.now()): { price: number; onSale: boolean } {
  const base = Math.max(0, Math.floor(item.price ?? 0));
  if (saleActive(item, now)) return { price: Math.max(0, Math.floor(item.salePrice as number)), onSale: true };
  return { price: base, onSale: false };
}

// The name-effect presets the admin can sell. Pure CSS - no assets, and new
// presets can be added here later without touching stored data.
export const NAME_EFFECTS: Record<string, { label: string; css: CSSProperties }> = {
  gold: { label: "Golden", css: { background: "linear-gradient(90deg,#f6d365,#fda085,#f6d365)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", fontWeight: 800 } },
  rainbow: { label: "Rainbow", css: { background: "linear-gradient(90deg,#f87171,#facc15,#4ade80,#38bdf8,#c084fc)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", fontWeight: 800 } },
  neon: { label: "Neon violet", css: { color: "#c4b5fd", textShadow: "0 0 8px rgba(167,139,250,0.9), 0 0 18px rgba(139,92,246,0.6)", fontWeight: 800 } },
  fire: { label: "Fire", css: { background: "linear-gradient(180deg,#fde047,#f97316,#dc2626)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", fontWeight: 800 } },
  ice: { label: "Ice", css: { background: "linear-gradient(180deg,#e0f2fe,#7dd3fc,#38bdf8)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", fontWeight: 800 } },
  emerald: { label: "Emerald glow", css: { color: "#6ee7b7", textShadow: "0 0 10px rgba(52,211,153,0.8)", fontWeight: 800 } },
  royal: { label: "Royal gold glow", css: { color: "#fcd34d", textShadow: "0 0 10px rgba(251,191,36,0.85)", fontWeight: 800 } },
  pink: { label: "Pink shine", css: { background: "linear-gradient(90deg,#f9a8d4,#f472b6,#f9a8d4)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", fontWeight: 800 } },
};

/** Items currently in the store, one kind, sorted by admin order. Archived items are
 *  hidden; coming-soon items stay visible as teasers. */
export function storeItemsOf(config: AppConfig, kind: StoreKind): StoreItem[] {
  return ((config.storeItems ?? []) as StoreItem[])
    .filter((i) => i.kind === kind && i.enabled !== false && !i.archived)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function storeItemById(config: AppConfig, id?: string | null): StoreItem | null {
  if (!id) return null;
  return ((config.storeItems ?? []) as StoreItem[]).find((i) => i.id === id) ?? null;
}

/** CSS for a user's equipped name effect (resolved via the catalog). */
export function nameEffectCss(config: AppConfig, itemId?: string | null): CSSProperties | undefined {
  const item = storeItemById(config, itemId);
  if (!item || item.kind !== "nameEffect" || !item.style) return undefined;
  return NAME_EFFECTS[item.style]?.css;
}

/** Image URL for an equipped background/badge ("" when none). */
export function storeImageOf(config: AppConfig, itemId?: string | null): string {
  const item = storeItemById(config, itemId);
  return item?.image ? withBase(item.image) : "";
}

/** My ownership state for an item (same shape as frames' myFrameState). */
export function myStoreState(user: { storeOwned?: Record<string, { at: string; expiresAt?: string | null }> } | null | undefined, itemId: string): { owned: boolean; expired: boolean; expiresAt: string | null; label: string } {
  const e = user?.storeOwned?.[itemId];
  if (!e) return { owned: false, expired: false, expiresAt: null, label: "" };
  if (!e.expiresAt) return { owned: true, expired: false, expiresAt: null, label: "Permanent" };
  const left = new Date(e.expiresAt).getTime() - Date.now();
  if (left <= 0) return { owned: false, expired: true, expiresAt: e.expiresAt, label: "Expired" };
  const days = Math.floor(left / 86_400_000);
  const hours = Math.ceil(left / 3_600_000);
  return { owned: true, expired: false, expiresAt: e.expiresAt, label: days >= 1 ? `${days} day${days === 1 ? "" : "s"} left` : `Expires in ${hours} h` };
}

export async function buyStoreItem(itemId: string): Promise<{ ok: boolean; error?: string; balance?: number; expiresAt?: string | null }> {
  try {
    const res = await fetch(withBase("/api/store/purchase"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId }) });
    const d = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, balance: d.balance, expiresAt: d.expiresAt ?? null } : { ok: false, error: d.error };
  } catch { return { ok: false, error: "Network problem - please try again" }; }
}

export async function equipStore(kind: StoreKind, itemId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/users/cosmetics"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ equipStore: { kind, itemId } }) });
    const d = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, error: d.error };
  } catch { return { ok: false, error: "Network problem - please try again" }; }
}

export async function sendStoreRequest(kind: string, text: string, image?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/store/requests"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, text, image }) });
    const d = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, error: d.error };
  } catch { return { ok: false, error: "Network problem - please try again" }; }
}

export async function cancelStoreRequest(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/store/requests"), { method: "DELETE", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    const d = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, error: d.error };
  } catch { return { ok: false, error: "Network problem - please try again" }; }
}
