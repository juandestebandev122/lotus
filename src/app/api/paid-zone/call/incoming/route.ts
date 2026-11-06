import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listIncomingCalls, getConfig } from "@/server/repo";

export const runtime = "nodejs";

// Ringing calls addressed to me — drives the incoming-call Accept/Reject popup.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const cfg = await getConfig();
  if ((cfg.membership?.subscriberFeatures?.paidZone || cfg.membership?.subscriberFeatures?.paidZoneCalls) && !user.vip && user.role !== "admin") {
    return fail("Paid Zone is available to paid subscribers only.", 403);
  }
  const calls = await listIncomingCalls(user.id);
  return ok({ calls });
}
