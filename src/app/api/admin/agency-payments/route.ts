import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listAgencyPayments } from "@/server/repo";
import { canAccess } from "@/lib/admin-perms";

export const runtime = "nodejs";

// Admin: complete agency-membership payment history (all receipts, incl. failed).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin" || !canAccess("agencies", user.adminRole, user.adminPermissions)) {
    return fail("Agency management access required", 403);
  }
  const agencyId = new URL(req.url).searchParams.get("agencyId") ?? undefined;
  return ok({ payments: await listAgencyPayments({ agencyId }) });
}
