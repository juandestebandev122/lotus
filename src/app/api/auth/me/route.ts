import { ok } from "@/server/http";
import { getCurrentUser, publicUser, setSession, createToken } from "@/server/auth";
import { socialStats, sweepFrameExpiries } from "@/server/repo";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return ok({ user: null });
  // Frame-store housekeeping (throttled inside): expiry warnings + auto-unequip.
  void sweepFrameExpiries().catch(() => {});
  // Sliding session: refresh the 30-day cookie on every app open so an active
  // user is never logged out when they return from the background.
  await setSession(user.id);
  const pub = publicUser(user);
  // Override the stale stats field with live follower/following/friend counts.
  const stats = await socialStats(user.id);
  // Return the token too so the client can refresh its localStorage fallback
  // (used when the browser drops the cookie — PWA / in-app browser / iOS ITP).
  return ok({ user: { ...pub, stats: { ...pub.stats, ...stats } }, token: createToken(user.id) });
}
