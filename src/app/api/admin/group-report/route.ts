import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { allGroupsReport } from "@/server/repo";

export const runtime = "nodejs";

// Admin: every group the platform has had — live and deleted — with the member
// who created it, its category, when it was created, and for a removed group
// when it went, who removed it and why.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const report = await allGroupsReport();
  return ok(report);
}
