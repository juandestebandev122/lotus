import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { contentLeaderboard, gamesLeaderboard } from "@/server/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/leaderboard?category=reels|videos|games&range=day|week|month|all
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const sp = new URL(req.url).searchParams;
  const category = sp.get("category") ?? "games";
  const range = sp.get("range") ?? "all";
  if (category === "reels") return ok({ category, range, rows: await contentLeaderboard("reel", range) });
  if (category === "videos") return ok({ category, range, rows: await contentLeaderboard("video", range) });
  return ok({ category: "games", range, rows: await gamesLeaderboard(range) });
}
