import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { freeCoinStatus, claimPeriodicFreeCoins } from "@/server/repo";

export const runtime = "nodejs";

// My timed-reward state: interval + amount + whether it's ready + the exact
// server time and next-claim time (the client renders its countdown from these
// and never computes the interval itself, so it always matches the server).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  return ok(await freeCoinStatus(user.id));
}

// Claim the timed reward. All rules (interval, amount, daily limit, level) are
// re-checked server-side on the server clock; a too-early / ineligible attempt
// is rejected (and logged) here.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const res = await claimPeriodicFreeCoins(user.id);
  if (!res.ok) return fail(res.error ?? "Could not claim", 400);
  return ok(res);
}
