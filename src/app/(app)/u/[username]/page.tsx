import { notFound } from "next/navigation";
import { resolveProfileUser, socialStats, agencyBadgeOfUser, getConfig, mutualFollow, isFollowing, friendStateOf } from "@/server/repo";
import { publicUser, getCurrentUser } from "@/server/auth";
import { PublicProfile } from "@/components/social/PublicProfile";

// NEVER cache a profile — above all, never cache a "not found".
//
// Without this, a visit to /u/<name> BEFORE that member exists (a mistyped name,
// or an admin opening the link a moment before the account is created) caches the
// 404 for the rest of the browsing session. The account then exists, the URL is
// correct, and the member still sees "404 — This page could not be found" until
// they hard-refresh. That is precisely the report: 404 for a brand-new account,
// while the same URL answers 200 from the server.
export const dynamic = "force-dynamic";

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  // Resolve by @username, the member ID NUMBER (100009) or the raw user id. All
  // three work, so a member whose username contains emoji is still reachable.
  const rec = await resolveProfileUser(username);
  if (!rec) notFound();
  const pub = publicUser(rec);
  const stats = await socialStats(rec.id);
  // The agency this user belongs to (shown as a badge next to their name).
  const agency = await agencyBadgeOfUser(rec.id);

  const me = await getCurrentUser();
  const isSelf = !!me && me.id === rec.id;

  // The viewer's REAL relationship to this profile, so the Follow / Add-friend
  // buttons show the correct state. Computed for ANY logged-in viewer (not only
  // when the privacy gate is on) — otherwise the buttons default to "Follow"/"Add
  // friend" even for people you already follow/befriended, and tapping them would
  // TOGGLE (unfollow) or DOWNGRADE the existing relationship.
  const iFollow = !!me && !isSelf && (await isFollowing(me.id, rec.id));
  const friendState = me && !isSelf ? await friendStateOf(me.id, rec.id) : "none";

  // PRIVACY GATE. A profile is "locked" (details/tabs hidden, only name + counts +
  // a Follow button shown) to a non-mutual viewer when EITHER:
  //   (a) the admin's global mutual-follow gate is on, OR
  //   (b) THIS user set their own profile to PRIVATE (Profile Privacy — Phase 1).
  // The owner and admins always see everything.
  const cfg = await getConfig();
  const globalGate = cfg.privacy?.enabled !== false && cfg.privacy?.mutualFollowToView === true;
  const selfPrivate = rec.privacy?.profileVisibility === "private";
  const isOwnerOrAdmin = !!me && (me.id === rec.id || me.role === "admin");
  let locked = false;
  if ((globalGate || selfPrivate) && !isOwnerOrAdmin) {
    locked = !(me && (await mutualFollow(me.id, rec.id)));
  }

  // Hide online status / last seen from others when the user turned those on
  // (owner + admins still see the real values).
  const hideOnline = rec.privacy?.hideOnlineStatus === true && !isOwnerOrAdmin;
  const hideLastSeen = rec.privacy?.hideLastSeen === true && !isOwnerOrAdmin;

  // When locked, this gate is SERVER-SIDE: strip the hidden detail (game stats,
  // received gifts) so it never reaches a non-mutual viewer's device — only the
  // public counts (followers/following/friends) survive.
  const safeStats = locked
    ? { followers: stats.followers, following: stats.following, friends: stats.friends, roomsJoined: 0, gamesPlayed: 0, wins: 0, tournamentWins: 0 }
    : { ...pub.stats, ...stats };
  const safeUser = {
    ...pub,
    stats: safeStats,
    ...(locked ? { receivedGifts: [] } : {}),
    ...(hideOnline ? { status: "offline" as const } : {}),
    ...(hideLastSeen ? { lastSeen: undefined } : {}),
  };

  return (
    <PublicProfile
      user={safeUser}
      agency={agency ?? undefined}
      locked={locked}
      isPrivate={selfPrivate}
      initiallyFollowing={iFollow}
      initialFriendState={friendState}
    />
  );
}
