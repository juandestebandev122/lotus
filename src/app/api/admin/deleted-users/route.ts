import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listDeletedUsers, restoreDeletedUser, permanentlyDeleteUser, setIdRearrangement, getConfig } from "@/server/repo";
import { canAccess } from "@/lib/admin-perms";

export const runtime = "nodejs";

function isSuperAdmin(role?: string): boolean {
  return !role || role === "super_admin";
}

// The Deleted Users archive. Viewable by admins with Users access; the RESTORE /
// permanent-delete / ID-rearrangement CONTROLS are Super-Admin only (enforced in POST).
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin" || !canAccess("users", user.adminRole, user.adminPermissions)) {
    return fail("Users access required", 403);
  }
  return ok({ deleted: await listDeletedUsers(), idRearrangement: (await getConfig()).idRearrangement === true, superAdmin: isSuperAdmin(user.adminRole) });
}

// Super-Admin-only actions: restore | purge (permanent delete) | setIdRearrangement.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return fail("Administrator access required", 403);
  if (!isSuperAdmin(user.adminRole)) return fail("Only a Super Admin can manage deleted users and ID re-arrangement.", 403);

  const b = await readJson<{ action?: string; id?: string; enabled?: boolean }>(req);
  if (b.action === "restore") {
    if (!b.id) return fail("User id is required");
    const res = await restoreDeletedUser(b.id, user.fullName);
    return res.ok ? ok({ ok: true }) : fail(res.error ?? "Could not restore", 400);
  }
  if (b.action === "purge") {
    if (!b.id) return fail("User id is required");
    const res = await permanentlyDeleteUser(b.id, user.fullName);
    return res.ok ? ok({ ok: true }) : fail(res.error ?? "Could not delete", 400);
  }
  if (b.action === "setIdRearrangement") {
    const res = await setIdRearrangement(b.enabled === true, user.fullName);
    return res.ok ? ok({ ok: true, idRearrangement: b.enabled === true }) : fail("Could not update", 400);
  }
  return fail("Unknown action");
}
