import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { groupReport } from "@/server/repo";

export const runtime = "nodejs";

// FULL GROUP REPORT — complete details of one group for the admin panel:
// owner + contact, creator, admins/co-admins, live members, blocked/kicked
// (who/by whom/why), reports + outcomes, gift totals, and features.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const { id } = await params;
  const report = await groupReport(id);
  if (!report) return fail("Room not found", 404);
  return ok({ report });
}
