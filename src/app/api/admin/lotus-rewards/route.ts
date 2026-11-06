import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listLotusRewards, adminGiveLotusFlowers, adminRevokeLotusReward } from "@/server/repo";

export const runtime = "nodejs";

// Full Lotus-Flower reward history (automatic milestones + manual grants).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  return ok({ rewards: await listLotusRewards() });
}

// action: "give" (manual grant) | "revoke".
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const b = await readJson<{ action?: string; userId?: string; flowers?: number; reason?: string; rewardId?: string }>(req);
  if (b.action === "give") {
    const userId = typeof b.userId === "string" ? b.userId : "";
    const flowers = typeof b.flowers === "number" ? b.flowers : 0;
    if (!userId || flowers <= 0) return fail("Pick a user and a positive number of flowers");
    const res = await adminGiveLotusFlowers(userId, flowers, typeof b.reason === "string" ? b.reason : "", user.fullName);
    if (!res.ok) return fail(res.error ?? "Could not send", 400);
    return ok(res);
  }
  if (b.action === "revoke") {
    const rewardId = typeof b.rewardId === "string" ? b.rewardId : "";
    if (!rewardId) return fail("Missing reward");
    const res = await adminRevokeLotusReward(rewardId, user.fullName);
    if (!res.ok) return fail(res.error ?? "Could not revoke", 400);
    return ok(res);
  }
  return fail("Invalid request");
}
