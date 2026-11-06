import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listMatchHistory, matchDetail } from "@/server/repo";

export const runtime = "nodejs";

// GET ?id=<matchId>            → full breakdown of one match
// GET ?range=&from=&to=&q=     → latest-first list of played matches
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (id) {
    const detail = await matchDetail(id);
    if (!detail) return fail("Match not found", 404);
    return ok({ detail });
  }
  const matches = await listMatchHistory({
    range: url.searchParams.get("range") ?? "all",
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
  });
  return ok({ matches });
}
