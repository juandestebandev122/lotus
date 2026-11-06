import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { respondToCall, getConfig } from "@/server/repo";

export const runtime = "nodejs";

// Receiver accepts or rejects a ringing call.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const cfg = await getConfig();
  if ((cfg.membership?.subscriberFeatures?.paidZone || cfg.membership?.subscriberFeatures?.paidZoneCalls) && !user.vip && user.role !== "admin") {
    return fail("Paid Zone is available to paid subscribers only.", 403);
  }
  const b = await readJson<{ callId?: string; accept?: boolean }>(req);
  if (!b.callId) return fail("Missing call");
  const res = await respondToCall(String(b.callId), user.id, b.accept === true);
  if (!res.ok) return fail(res.error ?? "Could not respond to the call", 400);
  return ok(res);
}
