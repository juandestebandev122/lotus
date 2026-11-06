import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getLuckySpinState, spinLuckyWheel } from "@/server/repo";

export const runtime = "nodejs";

// My spin state: the wheel + whether I can spin + next spin time + history.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  return ok(await getLuckySpinState(user.id));
}

// Spin the wheel (weighted-random coin reward; starts the cooldown).
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const res = await spinLuckyWheel(user.id);
  if (!res.ok) return fail(res.error ?? "Could not spin", 400);
  return ok(res);
}
