import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser, publicUser } from "@/server/auth";
import { findByUsername, updateUser, userAvatarLocked, duplicateNameError } from "@/server/repo";

export const runtime = "nodejs";

// Characters that genuinely BREAK a profile link — they split or corrupt the
// /u/<name> URL. Emoji and other decorative characters are still allowed: those
// profiles are linked by member ID number instead (see lib/profile-href).
const URL_BREAKING = /[\\/?#%\s]/;

export async function PATCH(req: Request) {
  const me = await getCurrentUser();
  if (!me) return fail("Not authenticated", 401);

  const body = await readJson(req);
  const patch: Record<string, unknown> = {};

  if (typeof body.fullName === "string" && body.fullName.trim()) {
    patch.fullName = body.fullName.trim();
    const nameErr = await duplicateNameError("user", body.fullName, { excludeId: me.id, currentName: me.fullName });
    if (nameErr) return fail(nameErr, 409);
  }
  if (typeof body.bio === "string") patch.bio = body.bio.slice(0, 160);
  if (typeof body.city === "string") patch.city = body.city;
  if (["male", "female", "other"].includes(body.gender as string)) patch.gender = body.gender;
  // Profile photo + cover image. Empty string clears them.
  //
  // THIS MUST ONLY EVER STORE REAL IMAGE BYTES. The app hands the client a
  // CACHEABLE URL for the picture (publicUser replaces `avatar` with
  // "/api/avatar/<id>?v=<hash>"), and the profile-edit form submits whatever it
  // was given back on every save. Storing that string overwrote the real image
  // with a link POINTING AT ITSELF: /api/avatar/<id> then read `user.avatar`,
  // found a URL instead of image bytes, and 404'd forever — the member's photo
  // silently vanished the first time they saved their profile. That is why it
  // looked like it only ever hit new members: they are the ones who fill in
  // their profile just after joining.
  //
  // So: accept a data: image URL (a real upload), "" to clear, or a served file
  // path such as the admin's default picture. The ONE thing that is never
  // storable is a link back to the avatar endpoint itself. Anything else is
  // IGNORED, leaving the stored picture untouched.
  const isStorableImage = (v: string) =>
    v === "" ||
    v.startsWith("data:image/") ||
    (v.startsWith("/") && !/^\/api\/avatar\//i.test(v));
  if (typeof body.avatar === "string" && isStorableImage(body.avatar)) {
    // Admin "Common Profile Picture" campaign lock: block the user from changing their
    // own picture while a lock-enabled campaign targets them.
    if (await userAvatarLocked(me.id)) return fail("An admin has temporarily locked profile pictures — you can't change yours right now.", 403);
    patch.avatar = body.avatar.slice(0, 3_000_000);
  }
  if (typeof body.cover === "string" && isStorableImage(body.cover)) patch.cover = body.cover.slice(0, 5_000_000);

  if (typeof body.username === "string" && body.username.trim()) {
    const username = body.username.trim().toLowerCase();
    if (username !== me.username) {
      if (username.length > 40) return fail("Username can be at most 40 characters", 400);
      if (URL_BREAKING.test(username)) {
        return fail("Username can't contain spaces or the characters / \\ ? # %", 400);
      }
      const taken = await findByUsername(username);
      if (taken) return fail("Username is already taken", 409);
      patch.username = username;
    }
  }

  // Privacy & Security settings (Profile Privacy — Phase 1). Merged onto the
  // current value so a partial save never wipes the rest.
  if (body.privacy && typeof body.privacy === "object") {
    const p = body.privacy as Record<string, unknown>;
    const cur = me.privacy ?? {};
    const next = { ...cur };
    if (p.profileVisibility === "public" || p.profileVisibility === "private") next.profileVisibility = p.profileVisibility;
    if (["everyone", "followers", "following", "friends", "nobody"].includes(p.whoCanMessage as string)) next.whoCanMessage = p.whoCanMessage as typeof next.whoCanMessage;
    if (typeof p.hideOnlineStatus === "boolean") next.hideOnlineStatus = p.hideOnlineStatus;
    if (typeof p.hideLastSeen === "boolean") next.hideLastSeen = p.hideLastSeen;
    if (typeof p.hideReadReceipts === "boolean") next.hideReadReceipts = p.hideReadReceipts;
    if (typeof p.hideFollowersList === "boolean") next.hideFollowersList = p.hideFollowersList;
    if (typeof p.hideFollowingList === "boolean") next.hideFollowingList = p.hideFollowingList;
    patch.privacy = next;
  }

  const updated = await updateUser(me.id, patch);
  return ok({ user: updated ? publicUser(updated) : null });
}
