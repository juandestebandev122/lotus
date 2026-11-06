// Avatar FRAME shop helpers — the admin-managed catalog lives in
// config.avatarFrames; users buy frames with coins and equip one.
import { withBase } from "@/lib/base-path";
import type { AppConfig } from "@/lib/config";

export type AvatarFrame = {
  id: string; name: string; image: string; price: number; enabled: boolean;
  category?: string; badge?: string; description?: string;
  validityDays?: number; order?: number; launchAt?: string; endAt?: string;
};

export function enabledFrames(config: AppConfig): AvatarFrame[] {
  return (config.avatarFrames ?? []).filter((f) => f.enabled !== false && !!f.image);
}

/** Frames currently ON SALE in the store (enabled + inside their launch/end
 *  window), sorted by the admin display order. */
export function storeFrames(config: AppConfig): AvatarFrame[] {
  const now = Date.now();
  return enabledFrames(config)
    .filter((f) => (!f.launchAt || new Date(f.launchAt).getTime() <= now) && (!f.endAt || new Date(f.endAt).getTime() >= now))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** My ownership state for a frame: owned/expired + expiry + a friendly
 *  remaining-time label ("Permanent", "12 days left", "Expires in 5 h"). */
export function myFrameState(user: { frames?: Record<string, { at: string; expiresAt?: string | null }>; ownedFrameIds?: string[] } | null | undefined, frameId: string): { owned: boolean; expired: boolean; expiresAt: string | null; label: string } {
  const e = user?.frames?.[frameId];
  if (!e) {
    // Legacy (pre-validity) purchase = permanent.
    if (user?.ownedFrameIds?.includes(frameId)) return { owned: true, expired: false, expiresAt: null, label: "Permanent" };
    return { owned: false, expired: false, expiresAt: null, label: "" };
  }
  if (!e.expiresAt) return { owned: true, expired: false, expiresAt: null, label: "Permanent" };
  const left = new Date(e.expiresAt).getTime() - Date.now();
  if (left <= 0) return { owned: false, expired: true, expiresAt: e.expiresAt, label: "Expired" };
  const days = Math.floor(left / 86_400_000);
  const hours = Math.ceil(left / 3_600_000);
  return { owned: true, expired: false, expiresAt: e.expiresAt, label: days >= 1 ? `${days} day${days === 1 ? "" : "s"} left` : `Expires in ${hours} h` };
}

/** Validity shown on a store card ("Permanent", "7 days", "30 days"). */
export function validityLabel(f: AvatarFrame): string {
  const d = Math.max(0, Math.floor(f.validityDays ?? 0));
  return d === 0 ? "Permanent" : `${d} day${d === 1 ? "" : "s"}`;
}

export function frameById(config: AppConfig, id?: string | null): AvatarFrame | null {
  if (!id) return null;
  return enabledFrames(config).find((f) => f.id === id) ?? null;
}

/** The (base-pathed) image URL of a user's equipped frame, or "" when none. */
export function frameImageOf(config: AppConfig, id?: string | null): string {
  const f = frameById(config, id);
  return f ? withBase(f.image) : "";
}

export async function buyFrame(frameId: string): Promise<{ ok: boolean; error?: string; balance?: number; owned?: string[]; expiresAt?: string | null }> {
  try {
    const res = await fetch(withBase("/api/frames/purchase"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ frameId }) });
    const d = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, balance: d.balance, owned: d.owned, expiresAt: d.expiresAt ?? null } : { ok: false, error: d.error };
  } catch { return { ok: false, error: "Network problem — try again" }; }
}

export async function equipFrame(frameId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/users/cosmetics"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ equippedFrame: frameId }) });
    const d = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, error: d.error };
  } catch { return { ok: false, error: "Network problem — try again" }; }
}
