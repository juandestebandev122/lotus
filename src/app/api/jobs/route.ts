import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listAllJobs } from "@/server/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/jobs?q=&type= — every approved, non-expired job across all businesses
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const sp = new URL(req.url).searchParams;
  const jobs = await listAllJobs(user.id, { q: sp.get("q") ?? "", type: sp.get("type") ?? "" });
  return ok({ jobs });
}
