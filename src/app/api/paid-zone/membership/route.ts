import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { exitPaidZone, renewPaidZoneNow, getConfig } from "@/server/repo";

export const runtime = "nodejs";

// Manage my own Paid Zone membership: leave it, or pay the monthly renewal now.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const cfg = await getConfig();
  if (cfg.membership?.subscriberFeatures?.paidZone && !user.vip && user.role !== "admin") {
    return fail("Paid Zone is available to paid subscribers only.", 403);
  }
  const b = await readJson<{ action?: string }>(req);

  if (b.action === "exit") {
    const res = await exitPaidZone(user.id);
    if (!res.ok) return fail(res.error ?? "Could not leave the Paid Zone", 400);
    return ok({ ok: true });
  }

  if (b.action === "renew") {
    const res = await renewPaidZoneNow(user.id);
    if (!res.ok) return fail(res.error ?? "Could not renew", (res.error ?? "").includes("coins") ? 402 : 400);
    return ok({ ok: true, balance: res.balance });
  }

  return fail("Unknown action", 400);
}
