import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { agentProfitReport } from "@/server/repo";
import { canAccess } from "@/lib/admin-perms";

export const runtime = "nodejs";

// Agent (Agency) Profit — each agency's commission share of gifts sent to its
// members. Admin-only (payments permission).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  if (!canAccess("payments", user.adminRole, user.adminPermissions)) return fail("Financial access required", 403);

  const p = new URL(req.url).searchParams;
  const report = await agentProfitReport({
    from: p.get("from") || undefined,
    to: p.get("to") || undefined,
    agencyId: p.get("agencyId") || undefined,
    q: p.get("q") || undefined,
    limit: p.get("limit") ? Number(p.get("limit")) : 1000,
    offset: p.get("offset") ? Number(p.get("offset")) : 0,
  });
  return ok(report);
}
