import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { recordManagementDashboard, getConfig } from "@/server/repo";
import { canAccess } from "@/lib/admin-perms";

export const runtime = "nodejs";

// Admin: the Record Management dashboard (aggregate counts + storage) + config.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin" || !canAccess("moderation", user.adminRole, user.adminPermissions)) {
    return fail("Record management access required", 403);
  }
  const [dashboard, cfg] = await Promise.all([recordManagementDashboard(), getConfig()]);
  return ok({ dashboard, config: cfg.recording ?? {} });
}
