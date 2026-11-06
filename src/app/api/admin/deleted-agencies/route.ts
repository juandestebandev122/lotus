import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listDeletedAgencies, restoreDeletedAgency, permanentlyDeleteAgency, getConfig } from "@/server/repo";
import { canAccess } from "@/lib/admin-perms";

export const runtime = "nodejs";

function isSuperAdmin(role?: string): boolean {
  return !role || role === "super_admin";
}

// The Deleted Agencies archive. Viewable by admins with Agencies access; the
// RESTORE / permanent-delete controls are Super-Admin only (enforced in POST).
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin" || !canAccess("agencies", user.adminRole, user.adminPermissions)) {
    return fail("Agency management access required", 403);
  }
  return ok({ deleted: await listDeletedAgencies(), idRearrangement: (await getConfig()).idRearrangement === true, superAdmin: isSuperAdmin(user.adminRole) });
}

// Super-Admin-only actions: restore | purge (permanent delete).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return fail("Administrator access required", 403);
  if (!isSuperAdmin(user.adminRole)) return fail("Only a Super Admin can restore or permanently delete agencies.", 403);

  const b = await readJson<{ action?: string; id?: string }>(req);
  if (b.action === "restore") {
    if (!b.id) return fail("Agency id is required");
    const res = await restoreDeletedAgency(b.id, user.fullName);
    return res.ok ? ok({ ok: true }) : fail(res.error ?? "Could not restore", 400);
  }
  if (b.action === "purge") {
    if (!b.id) return fail("Agency id is required");
    const res = await permanentlyDeleteAgency(b.id, user.fullName);
    return res.ok ? ok({ ok: true }) : fail(res.error ?? "Could not delete", 400);
  }
  return fail("Unknown action");
}
