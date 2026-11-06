import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listActiveCalls, listCallRecords, paidZoneCallStats, forceEndCall, addAdminLog } from "@/server/repo";

export const runtime = "nodejs";

// Admin: live active calls + ended call records + dashboard stats.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const [active, records, stats] = await Promise.all([listActiveCalls(), listCallRecords(), paidZoneCallStats()]);
  return ok({ active, records, stats });
}

// Admin: force-disconnect an active call.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const b = await readJson<{ callId?: string }>(req);
  if (!b.callId) return fail("Missing call");
  const res = await forceEndCall(String(b.callId), user.fullName);
  if (!res.ok) return fail("Call not found or already ended", 400);
  await addAdminLog(user.fullName, `Force-ended Paid Zone call ${b.callId}`);
  return ok({ ok: true });
}
