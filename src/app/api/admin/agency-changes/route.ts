import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listAgencyChangeRequests, decideAgencyChangeRequest, cancelAgencyChangeRequest, addAdminLog } from "@/server/repo";
import { canAccess } from "@/lib/admin-perms";

export const runtime = "nodejs";

async function requireAgencyAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { user: null as null };
  if (!canAccess("agencies", user.adminRole, user.adminPermissions)) return { user: null as null };
  return { user };
}

// Admin: the agency-change review queue (pending first).
export async function GET() {
  const { user } = await requireAgencyAdmin();
  if (!user) return fail("Agency management access required", 403);
  return ok({ requests: await listAgencyChangeRequests() });
}

// Admin: approve (→ transfer the user), reject (→ notify with a reason), or
// cancel (→ void a pending request without transferring).
export async function PATCH(req: Request) {
  const { user } = await requireAgencyAdmin();
  if (!user) return fail("Agency management access required", 403);
  const body = await readJson<{ id?: string; approve?: boolean; cancel?: boolean; reason?: string }>(req);
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return fail("Request id is required");
  if (body.cancel === true) {
    const res = await cancelAgencyChangeRequest(id, user.fullName, body.reason);
    if (!res.ok) return fail(res.error ?? "Could not cancel the request", 400);
    await addAdminLog(user.fullName, `Cancelled agency-change request ${id}`);
    return ok({ ok: true });
  }
  const approve = body.approve === true;
  const res = await decideAgencyChangeRequest(id, approve, user.fullName, body.reason);
  if (!res.ok) return fail(res.error ?? "Could not update the request", 400);
  await addAdminLog(user.fullName, `${approve ? "Approved" : "Rejected"} agency-change request ${id}`);
  return ok({ ok: true });
}
