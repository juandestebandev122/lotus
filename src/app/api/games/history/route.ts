import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listMyGameResults } from "@/server/repo";

export const runtime = "nodejs";

// The signed-in player's own finished-match history (complete activity log).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  return ok({ matches: await listMyGameResults(user.id) });
}
