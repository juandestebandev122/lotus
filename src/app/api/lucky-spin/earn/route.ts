import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { buySpinChance, watchAdForChance } from "@/server/repo";

export const runtime = "nodejs";

// Earn an extra Lucky Spin chance: buy with coins, or watch a promotion/ad.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const b = await readJson<{ action?: string }>(req);

  if (b.action === "buy") {
    const res = await buySpinChance(user.id);
    if (!res.ok) return fail(res.error ?? "Could not buy a spin", (res.error ?? "").includes("coins") ? 402 : 400);
    return ok(res);
  }
  if (b.action === "ad") {
    const res = await watchAdForChance(user.id);
    if (!res.ok) return fail(res.error ?? "Could not earn a chance", 400);
    return ok(res);
  }
  return fail("Unknown action", 400);
}
