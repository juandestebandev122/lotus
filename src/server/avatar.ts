import crypto from "node:crypto";

// ============================================================
// Cacheable avatars. Avatars/covers are stored as base64 data-URL JPEGs on the
// user record. Embedding those (~50-60KB) in every polled API response blew up
// users' mobile data. Instead we return a SHORT, content-addressed URL
// (/api/avatar/<id>?v=<hash>) that the browser fetches ONCE and caches forever
// (the hash changes only when the image changes), so polls carry ~40 bytes
// instead of 60KB.
// ============================================================

/** A short content hash so a changed image gets a fresh (re-fetched) URL. */
function shortHash(s: string): string {
  return crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);
}

// ============================================================
// Admin "Common Profile Picture" campaigns — DISPLAY-TIME override.
// A campaign never touches a user's stored `avatar`; it only changes what avatarUrl()
// emits (and what /api/avatar serves) while it's active. db.ts refreshes this cache on
// every getDB() so it flips on/off with the schedule. Because the emitted URL's cache
// tag changes when a campaign targets a user (and reverts when it ends), the browser +
// service-worker caches bust and auto-revert — the real picture returns on its own.
// ============================================================
export type AvatarCampaignTarget = { tag: string; all: boolean; userIds: Set<string> };
let _activeCampaigns: AvatarCampaignTarget[] = [];

/** Called by db.ts whenever the DB is read, with the campaigns active RIGHT NOW (agency
 *  targets already expanded into userIds so this only ever needs a user's id). */
export function setActiveAvatarCampaigns(list: AvatarCampaignTarget[]): void {
  _activeCampaigns = list;
}

/** The URL cache tag for a campaign — changes if its image changes → busts caches. Hashes
 *  only a small SAMPLE (length + head + tail) so it's cheap to recompute on every DB read. */
export function avatarCampaignTag(id: string, image: string): string {
  const sample = `${image.length}|${image.slice(0, 64)}|${image.slice(-64)}`;
  return `c${id.replace(/[^a-z0-9]/gi, "").slice(0, 14)}${shortHash(sample)}`;
}

/** The active campaign tag for a user (null if none targets them). */
function campaignTagFor(id?: string): string | null {
  if (!id || _activeCampaigns.length === 0) return null;
  for (const c of _activeCampaigns) {
    if (c.all || c.userIds.has(id)) return c.tag;
  }
  return null;
}

/** Cacheable URL for a user's avatar (empty string if they have none). While an admin
 *  profile-picture campaign targets this user, a campaign URL is returned INSTEAD (the
 *  stored avatar is untouched); the URL reverts to the real one when the campaign ends. */
export function avatarUrl(user: { id?: string; avatar?: string } | null | undefined): string {
  if (!user?.id) return "";
  const camp = campaignTagFor(user.id);
  if (camp) return `/api/avatar/${user.id}?v=${camp}`; // campaign override (even if the user has no avatar)
  const av = user?.avatar || "";
  if (!av) return "";
  if (!av.startsWith("data:")) return av; // already a plain URL — leave it
  return `/api/avatar/${user.id}?v=${shortHash(av)}`;
}

/** Cacheable URL for a user's cover image. */
export function coverUrl(user: { id?: string; cover?: string } | null | undefined): string {
  const cv = user?.cover || "";
  if (!cv || !user?.id) return "";
  if (!cv.startsWith("data:")) return cv;
  return `/api/avatar/${user.id}?v=${shortHash(cv)}&kind=cover`;
}

/** Cacheable URL for a room's custom picture (empty string if it has none). The
 *  raw data URL lives on the room record; polls carry this ~40-byte URL instead
 *  of the full base64 image (same data-saving trick as {@link avatarUrl}). */
export function roomImageUrl(room: { id?: string; image?: string } | null | undefined): string {
  const img = room?.image || "";
  if (!img || !room?.id) return "";
  if (!img.startsWith("data:")) return img; // already a plain URL
  return `/api/room-image/${room.id}?v=${shortHash(img)}`;
}

/** Cacheable URL for a reel's thumbnail — content-addressed (`?v=<hash>`) so that an
 *  edited poster gets a fresh URL and is re-fetched (the offline image cache is safe
 *  to cache-first only because the URL changes when the bytes change). "" when none. */
export function reelThumbUrl(reel: { id?: string; thumb?: string } | null | undefined): string {
  const t = reel?.thumb || "";
  if (!t || !reel?.id) return "";
  if (!t.startsWith("data:")) return t; // already a plain URL
  return `/api/reel-thumb/${reel.id}?v=${shortHash(t)}`;
}
