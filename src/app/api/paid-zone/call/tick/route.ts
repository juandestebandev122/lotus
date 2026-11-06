import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { callTick, getConfig } from "@/server/repo";

export const runtime = "nodejs";

// Per-minute billing heartbeat — the CALLER's client posts this every ~minute.
// Deducts coins for whole minutes elapsed and tells the client to disconnect
// when the balance can't cover the next minute.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const cfg = await getConfig();
  if ((cfg.membership?.subscriberFeatures?.paidZone || cfg.membership?.subscriberFeatures?.paidZoneCalls) && !user.vip && user.role !== "admin") {
    return fail("Paid Zone is available to paid subscribers only.", 403);
  }
  const b = await readJson<{ roomId?: string }>(req);
  if (!b.roomId) return fail("Missing room");
  const res = await callTick(user.id, String(b.roomId));
  return ok(res);
}
