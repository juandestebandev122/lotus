import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { pendingApprovalsSummary } from "@/server/repo";

export const runtime = "nodejs";

// Unified pending-approvals summary for the admin dashboard: one live count per
// approval queue across the whole app + a grand total. Computed fresh each call.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const summary = await pendingApprovalsSummary();
  return ok({ summary });
}
