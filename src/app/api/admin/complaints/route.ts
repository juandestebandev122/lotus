import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listComplaints, createComplaint, updateComplaint, investigationRecords, addAdminLog } from "@/server/repo";
import { canAccess } from "@/lib/admin-perms";

export const runtime = "nodejs";

async function guard() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin" || !canAccess("moderation", user.adminRole, user.adminPermissions)) return null;
  return user;
}

// GET: the complaint list, OR (?investigate=1 with a filter) the linked records.
export async function GET(req: Request) {
  const user = await guard();
  if (!user) return fail("Record management access required", 403);
  const url = new URL(req.url);
  if (url.searchParams.get("investigate")) {
    const records = await investigationRecords({
      userId: url.searchParams.get("userId") || undefined,
      roomId: url.searchParams.get("roomId") || undefined,
      callId: url.searchParams.get("callId") || undefined,
      competitionId: url.searchParams.get("competitionId") || undefined,
    });
    await addAdminLog(user.fullName, `Accessed investigation records (${url.searchParams.toString()})`);
    return ok({ records });
  }
  return ok({ complaints: await listComplaints() });
}

// POST: raise a complaint / investigation case.
export async function POST(req: Request) {
  const user = await guard();
  if (!user) return fail("Record management access required", 403);
  const b = await readJson<Record<string, string>>(req);
  if (!b.reason || !b.reason.trim()) return fail("A reason is required");
  const c = await createComplaint({
    reason: b.reason, category: b.category,
    subjectUserId: b.subjectUserId, subjectName: b.subjectName,
    roomId: b.roomId, callId: b.callId, competitionId: b.competitionId, agencyId: b.agencyId,
    raisedBy: user.id, raisedByName: user.fullName,
  });
  await addAdminLog(user.fullName, `Opened complaint ${c.code}`);
  return ok({ complaint: c });
}

// PATCH: update status / add an internal note.
export async function PATCH(req: Request) {
  const user = await guard();
  if (!user) return fail("Record management access required", 403);
  const b = await readJson<{ id?: string; status?: string; note?: string }>(req);
  if (!b.id) return fail("Complaint id required");
  const status = ["pending", "investigating", "resolved", "rejected"].includes(b.status ?? "") ? (b.status as "pending" | "investigating" | "resolved" | "rejected") : undefined;
  const c = await updateComplaint(b.id, { status, note: b.note, by: user.fullName });
  if (!c) return fail("Complaint not found", 404);
  await addAdminLog(user.fullName, `Updated complaint ${c.code}${status ? ` → ${status}` : ""}`);
  return ok({ complaint: c });
}
