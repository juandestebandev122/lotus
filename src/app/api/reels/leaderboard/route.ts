import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { featureOn, reelLeaderboards } from "@/server/repo";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (!(await featureOn("reels"))) return ok({ mostViewed: [], mostLiked: [], topCreators: [] });
  return ok(await reelLeaderboards(user.id));
}
