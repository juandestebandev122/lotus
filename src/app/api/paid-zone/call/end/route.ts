import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { endPaidZoneCall, getConfig } from "@/server/repo";

export const runtime = "nodejs";

// End a Paid Zone call (the participant hung up / left).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const cfg = await getConfig();
  if ((cfg.membership?.subscriberFeatures?.paidZone || cfg.membership?.subscriberFeatures?.paidZoneCalls) && !user.vip && user.role !== "admin") {
    return fail("Paid Zone is available to paid subscribers only.", 403);
  }
  const b = await readJson<{ roomId?: string }>(req);
  if (!b.roomId) return fail("Missing room");
  await endPaidZoneCall(String(b.roomId), "hangup");
  return ok({ ok: true });
}
