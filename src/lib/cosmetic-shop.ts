"use client";

import { withBase } from "./base-path";
import type { AppConfig } from "./config";
import { resolveDiceModels } from "./dice-model";
import { resolveTokenDesigns } from "./tokenDesigns";

// ============================================================
// GAME COSMETICS SHOP — dice, boards and tokens.
//
// One rule, in one place: the PRICE LIVES ON THE DESIGN, set in the admin page
// where that design is created. Price 0 (or unset) = free for everyone, exactly
// as it has always been. Any price above 0 puts the design in the Store on its
// own — nothing else has to be created or kept in step — and a player must buy
// it once (permanently) before it can be used.
// ============================================================

export type CosmeticKind = "dice" | "board" | "token";

export interface ShopItem {
  kind: CosmeticKind;
  id: string;
  name: string;
  price: number;      // coins; 0 = free
  validityDays: number; // 0 = permanent; else the purchase expires after N days
  image?: string;     // artwork, when the design has any
  enabled: boolean;
}

export const KIND_LABEL: Record<CosmeticKind, string> = { dice: "Dice", board: "Board", token: "Token" };

/** Every design of one kind, with its price — the single source the Store, the
 *  Customize page and the admin pages all read. */
export function cosmeticCatalog(config: AppConfig, kind: CosmeticKind): ShopItem[] {
  if (kind === "dice") {
    // The complete DICE MODELS (Admin → Dice Models) are what players buy.
    return resolveDiceModels(config.diceModels).map((d) => ({
      kind, id: d.id, name: d.name, price: Math.max(0, Math.floor(d.priceCoins ?? 0)), validityDays: Math.max(0, Math.floor(d.validityDays ?? 0)), image: d.faceImage, enabled: d.enabled !== false,
    }));
  }
  if (kind === "token") {
    return resolveTokenDesigns(config.tokenDesigns).map((d) => ({
      kind, id: d.id, name: d.name, price: Math.max(0, Math.floor(d.priceCoins ?? 0)), validityDays: Math.max(0, Math.floor(d.validityDays ?? 0)), image: d.image, enabled: d.enabled !== false,
    }));
  }
  return (config.gameBoard?.boards ?? []).map((b, i) => ({
    kind, id: b.id, name: b.name || `Board ${i + 1}`, price: Math.max(0, Math.floor(b.priceCoins ?? 0)), validityDays: Math.max(0, Math.floor(b.validityDays ?? 0)), image: b.image, enabled: b.enabled !== false,
  }));
}

/** Only the designs that are actually on sale — this is what the Store lists. */
export function shopItems(config: AppConfig, kind: CosmeticKind): ShopItem[] {
  return cosmeticCatalog(config, kind).filter((i) => i.enabled && i.price > 0);
}

export type OwnedCosmetics = { dice: string[]; board: string[]; token: string[]; expiry: Record<string, string> };
export const NO_COSMETICS: OwnedCosmetics = { dice: [], board: [], token: [], expiry: {} };

/** "Permanent", "3 days left", "Expires in 5 h" — the same wording as frames. */
export function ownedLabel(owned: OwnedCosmetics | undefined, kind: CosmeticKind, id: string): string {
  const until = owned?.expiry?.[`${kind}:${id}`];
  if (!until) return "Permanent";
  const left = new Date(until).getTime() - Date.now();
  if (left <= 0) return "Expired";
  const days = Math.floor(left / 86_400_000);
  return days >= 1 ? `${days} day${days === 1 ? "" : "s"} left` : `Expires in ${Math.ceil(left / 3_600_000)} h`;
}

/** How long a purchase will last, for the Buy button. */
export function validityLabel(item: ShopItem): string {
  return item.validityDays > 0 ? `${item.validityDays} days` : "Permanent";
}

/** May this player use this design? Free → always. Paid → only once bought.
 *  Admins are never gated, so they can always check how a design looks. */
export function canUse(item: ShopItem | undefined, owned: OwnedCosmetics | undefined, isAdmin = false): boolean {
  if (!item) return false;
  if (item.price <= 0) return true;
  if (isAdmin) return true;
  return (owned?.[item.kind] ?? []).includes(item.id);
}

export async function fetchOwnedCosmetics(): Promise<OwnedCosmetics> {
  try {
    const res = await fetch(withBase("/api/cosmetics/purchase"), { credentials: "include", cache: "no-store" });
    if (!res.ok) return NO_COSMETICS;
    const d = await res.json();
    return { dice: d?.owned?.dice ?? [], board: d?.owned?.board ?? [], token: d?.owned?.token ?? [], expiry: d?.owned?.expiry ?? {} };
  } catch { return NO_COSMETICS; }
}

export async function buyCosmetic(kind: CosmeticKind, id: string): Promise<{ ok: boolean; error?: string; balance?: number; name?: string; owned?: OwnedCosmetics }> {
  try {
    const res = await fetch(withBase("/api/cosmetics/purchase"), {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id }),
    });
    const d = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, balance: d.balance, name: d.name, owned: d.owned } : { ok: false, error: d.error };
  } catch { return { ok: false, error: "Network problem — please try again" }; }
}

/** Admin: give a paid design to one member, or to "all", for free. */
export async function grantCosmetic(kind: CosmeticKind, id: string, target: string): Promise<{ ok: boolean; error?: string; count?: number; name?: string }> {
  try {
    const res = await fetch(withBase("/api/admin/cosmetics/grant"), {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id, target }),
    });
    const d = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, count: d.count, name: d.name } : { ok: false, error: d.error };
  } catch { return { ok: false, error: "Network problem — please try again" }; }
}
