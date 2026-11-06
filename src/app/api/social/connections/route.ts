import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { resolveProfileUser, listFollowers, listFollowing, listFriends, getConfig, mutualFollow } from "@/server/repo";
import { avatarUrl } from "@/server/avatar";
import { effectiveFrame, type UserRecord } from "@/server/db";

export const runtime = "nodejs";

// Who a profile's followers / following / friends actually ARE. Opened when a
// user taps the count tiles on a profile. Respects the mutual-follow privacy gate:
// if that gate is on and the viewer can't see the (locked) profile, the lists are
// hidden too.
export async function GET(req: Request) {
  const viewer = await getCurrentUser();
  if (!viewer) return fail("Please log in first", 401);

  const url = new URL(req.url);
  const userParam = url.searchParams.get("user") ?? "";
  const type = url.searchParams.get("type") ?? "followers";
  // Resolve by @username, member ID number, or internal id (same as the profile).
  const target = await resolveProfileUser(userParam);
  if (!target) return fail("User not found", 404);

  const isOwnerOrAdmin = viewer.id === target.id || viewer.role === "admin";

  // Same gate as the profile page: the admin's global mutual-follow viewing gate,
  // OR the target's own PRIVATE profile — either hides these lists from non-mutual
  // viewers (the owner + admins always see them).
  const cfg = await getConfig();
  const globalGate = cfg.privacy?.enabled !== false && cfg.privacy?.mutualFollowToView === true;
  const selfPrivate = target.privacy?.profileVisibility === "private";
  if ((globalGate || selfPrivate) && !isOwnerOrAdmin && !(await mutualFollow(viewer.id, target.id))) {
    return fail("This profile is private", 403);
  }

  // Per-list hide (Profile Privacy — Phase 2): the user can hide just their
  // followers or just their following list from others.
  if (!isOwnerOrAdmin) {
    if (type === "followers" && target.privacy?.hideFollowersList === true) return fail("This user's followers list is private.", 403);
    if (type === "following" && target.privacy?.hideFollowingList === true) return fail("This user's following list is private.", 403);
  }

  const shape = (u: { id?: string; username?: string; fullName?: string; publicId?: string; level?: number; avatar?: string; equippedFrame?: string; frames?: Record<string, { at: string; expiresAt?: string | null }>; ownedFrameIds?: string[] }) => ({
    id: u.id ?? "",
    username: u.username ?? "",
    fullName: u.fullName ?? "Member",
    publicId: u.publicId ?? "",
    level: u.level ?? 1,
    avatar: avatarUrl(u),
    // Frame-store frame (expiry-aware) so lists show it like everywhere else.
    equippedFrame: effectiveFrame(u as UserRecord),
  });

  let users;
  if (type === "friends") {
    users = (await listFriends(target.id)).filter((f) => f.state === "friends").map((f) => shape(f.user));
  } else if (type === "following") {
    users = (await listFollowing(target.id)).map(shape);
  } else {
    users = (await listFollowers(target.id)).map(shape);
  }
  return ok({ users });
}
