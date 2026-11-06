import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listDeletedTournaments, restoreDeletedTournament, permanentlyDeleteTournament } from "@/server/repo";
import { canAccess } from "@/lib/admin-perms";

export const runtime = "nodejs";

function isSuperAdmin(role?: string): boolean {
  return !role || role === "super_admin";
}

// The Deleted Tournaments archive. Viewable by admins with Tournaments access; the
// RESTORE / permanent-delete controls are Super-Admin only (enforced in POST).
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin" || !canAccess("tournaments", user.adminRole, user.adminPermissions)) {
    return fail("Tournament management access required", 403);
  }
  return ok({ deleted: await listDeletedTournaments(), superAdmin: isSuperAdmin(user.adminRole) });
}

// Super-Admin-only actions: restore | purge (permanent delete).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return fail("Administrator access required", 403);
  if (!isSuperAdmin(user.adminRole)) return fail("Only a Super Admin can restore or permanently delete tournaments.", 403);

  const b = await readJson<{ action?: string; id?: string }>(req);
  if (!b.id) return fail("Tournament id is required");
  if (b.action === "restore") {
    const res = await restoreDeletedTournament(b.id, user.fullName);
    return res.ok ? ok({ ok: true }) : fail(res.error ?? "Could not restore", 400);
  }
  if (b.action === "purge") {
    const res = await permanentlyDeleteTournament(b.id, user.fullName);
    return res.ok ? ok({ ok: true }) : fail(res.error ?? "Could not delete", 400);
  }
  return fail("Unknown action");
}
