import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listGameResults } from "@/server/repo";

export const runtime = "nodejs";

// Admin: recent finished matches — game, players, winner, time.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const results = await listGameResults(150);
  return ok({ results });
}
