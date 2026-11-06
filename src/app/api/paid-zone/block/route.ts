import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { paidZoneBlock, getConfig } from "@/server/repo";

export const runtime = "nodejs";

// Block / unblock another Paid Zone member (they disappear from each other).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const cfg = await getConfig();
  if (cfg.membership?.subscriberFeatures?.paidZone && !user.vip && user.role !== "admin") {
    return fail("Paid Zone is available to paid subscribers only.", 403);
  }
  const b = await readJson<{ targetUserId?: string; blocked?: boolean }>(req);
  if (!b.targetUserId) return fail("Missing user");
  const res = await paidZoneBlock(user.id, String(b.targetUserId), b.blocked !== false);
  if (!res.ok) return fail("Could not update", 400);
  return ok({ ok: true });
}
