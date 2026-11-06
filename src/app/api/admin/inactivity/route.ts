import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getInactivityReport } from "@/server/repo";

export const runtime = "nodejs";

// Dashboard data for Admin → Inactivity Detection: today's counters, lifetime
// totals, the auto-logout audit trail, and the most idle accounts.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const report = await getInactivityReport();
  return ok(report);
}
