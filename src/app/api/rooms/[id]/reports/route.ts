import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listRoomReports, roomHostModerate } from "@/server/repo";

export const runtime = "nodejs";

// Host / co-host: the reports raised in THIS room.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const res = await listRoomReports(id, user.id);
  if (!res.ok) return fail(res.error ?? "Not allowed", 403);
  return ok({ reports: res.reports });
}

// Host / co-host: warn a member, or resolve / dismiss a report.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const body = await readJson<{ action?: string; targetUserId?: string; reportId?: string; note?: string }>(req);
  const action = body.action;
  if (action !== "warn" && action !== "resolve" && action !== "dismiss") return fail("Invalid action");
  const res = await roomHostModerate(id, user.id, { action, targetUserId: body.targetUserId, reportId: body.reportId, note: body.note?.slice(0, 300) });
  if (!res.ok) return fail(res.error ?? "Could not moderate", 400);
  return ok({ ok: true });
}
