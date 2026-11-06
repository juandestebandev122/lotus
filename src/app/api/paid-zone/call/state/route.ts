import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getCallStateByRoom, getConfig } from "@/server/repo";

export const runtime = "nodejs";

// The caller polls this in the call room to know when the receiver answers /
// declines / doesn't pick up (ringing → active → ended).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const cfg = await getConfig();
  if ((cfg.membership?.subscriberFeatures?.paidZone || cfg.membership?.subscriberFeatures?.paidZoneCalls) && !user.vip && user.role !== "admin") {
    return fail("Paid Zone is available to paid subscribers only.", 403);
  }
  const roomId = new URL(req.url).searchParams.get("roomId") || "";
  if (!roomId) return fail("Missing room");
  // Pass the requester so that the RECEIVER simply being on the call screen
  // answers the call (starts billing) — no separate Accept tap required.
  const state = await getCallStateByRoom(roomId, user.id);
  return ok(state);
}
