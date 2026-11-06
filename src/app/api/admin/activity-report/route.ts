import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { activityTimeReport } from "@/server/repo";
import { canAccess } from "@/lib/admin-perms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/activity-report?from=YYYY-MM-DD&to=YYYY-MM-DD&userId=…
// How long each member spends in the app and what the Activity Reward paid them
// for it. Both halves are read from real records (measured minutes + the ledger).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Admins only", 403);
  if (!canAccess("reports", user.adminRole, user.adminPermissions) && !canAccess("settings", user.adminRole, user.adminPermissions)) {
    return fail("You don't have access to reports", 403);
  }
  const sp = new URL(req.url).searchParams;
  return ok(await activityTimeReport(sp.get("from") ?? undefined, sp.get("to") ?? undefined, sp.get("userId") ?? undefined));
}
