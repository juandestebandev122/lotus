import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listTickets, updateTicket, deleteTicket, addAdminLog } from "@/server/repo";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const tickets = await listTickets();
  return ok({ tickets });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const { id, status, reply } = await readJson<{ id?: string; status?: string; reply?: string }>(req);
  if (!id) return fail("Ticket id is required");
  const t = await updateTicket(id, { status, reply });
  if (!t) return fail("Ticket not found", 404);
  await addAdminLog(user.fullName, `Updated support ticket #${id}${status ? ` → ${status}` : ""}`);
  return ok({ ticket: t });
}

/** Delete a support ticket. Needed now that the PUBLIC contact form can create
 *  tickets without a login — spam has to be removable, not just closable. */
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const { id } = await readJson<{ id?: string }>(req);
  if (!id) return fail("Ticket id is required");
  const removed = await deleteTicket(String(id));
  if (!removed) return fail("Ticket not found", 404);
  await addAdminLog(user.fullName, `Deleted support ticket #${id} ("${removed.subject}" from ${removed.userName})`);
  return ok({ ok: true });
}
