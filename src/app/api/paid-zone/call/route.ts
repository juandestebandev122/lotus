import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { startPaidZoneCall, getConfig } from "@/server/repo";

export const runtime = "nodejs";

// Start a 1:1 audio/video call with another approved member. Creates a private
// 2-seat room, invites + notifies the target, and returns the room id to join.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const cfg = await getConfig();
  if ((cfg.membership?.subscriberFeatures?.paidZone || cfg.membership?.subscriberFeatures?.paidZoneCalls) && !user.vip && user.role !== "admin") {
    return fail("Paid Zone is available to paid subscribers only.", 403);
  }
  const b = await readJson<{ targetUserId?: string; mode?: string }>(req);
  if (!b.targetUserId) return fail("Missing user");
  const mode = b.mode === "video" ? "video" : "audio";
  const res = await startPaidZoneCall(user.id, String(b.targetUserId), mode);
  if (!res.ok) return fail(res.error ?? "Could not start the call", 400);
  return ok(res);
}
