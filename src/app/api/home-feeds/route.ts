import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { featureOn, homeTrending } from "@/server/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Home page: Trending Shorts + Trending Videos (most liked) + Latest Jobs +
// all registered Business Profiles.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const [reelsOn, businessOn] = await Promise.all([featureOn("reels"), featureOn("business")]);
  const t = await homeTrending(user.id);
  return ok({
    trendingShorts: reelsOn ? t.trendingShorts : [],
    trendingVideos: reelsOn ? t.trendingVideos : [],
    latestJobs: t.latestJobs,
    businesses: businessOn ? t.businesses : [],
  });
}
