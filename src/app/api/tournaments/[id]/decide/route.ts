import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { decideTournamentRequest, openTournamentRegistration, addAdminLog } from "@/server/repo";

export const runtime = "nodejs";

// Admin approves/rejects a join request, OR opens registration.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const body = await readJson<{ action?: string; userId?: string; decision?: string }>(req);

  if (body.action === "openRegistration") {
    const r = await openTournamentRegistration(id);
    if (!r.ok) return fail("Tournament not found", 404);
    await addAdminLog(user.fullName, `Opened registration for "${r.title}"`);
    return ok({ ok: true });
  }

  const decision = body.decision === "approved" ? "approved" : body.decision === "rejected" ? "rejected" : body.decision === "removed" ? "removed" : null;
  if (!body.userId || !decision) return fail("userId and decision are required");

  const res = await decideTournamentRequest(id, body.userId, decision, user.fullName);
  if (!res.ok) return fail(res.error ?? "Could not update request", 400);
  const word = decision === "approved" ? "Approved" : decision === "removed" ? "Removed" : "Rejected";
  await addAdminLog(user.fullName, `${word} a participant for "${res.title}"`);
  return ok({ ok: true, full: res.full ?? false });
}
