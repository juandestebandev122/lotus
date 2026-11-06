import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listAgencyUserApprovals, decideAgencyUserApproval } from "@/server/repo";
import { canAccess } from "@/lib/admin-perms";

export const runtime = "nodejs";

async function requireAgencyAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { user: null as null };
  if (!canAccess("agencies", user.adminRole, user.adminPermissions)) return { user: null as null };
  return { user };
}

// Admin: the Agency-User approval queue + audit log (newest first).
export async function GET() {
  const { user } = await requireAgencyAdmin();
  if (!user) return fail("Agency management access required", 403);
  return ok({ requests: await listAgencyUserApprovals() });
}

// Admin: approve (→ activate + add to agency) or reject (→ account stays inactive).
export async function PATCH(req: Request) {
  const { user } = await requireAgencyAdmin();
  if (!user) return fail("Agency management access required", 403);
  const body = await readJson<{ id?: string; approve?: boolean; note?: string }>(req);
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return fail("Request id is required");
  const approve = body.approve === true;
  const res = await decideAgencyUserApproval(id, approve, user.id, user.fullName, body.note?.slice(0, 300));
  if (!res.ok) return fail(res.error ?? "Could not update the request", 400);
  return ok({ ok: true });
}
