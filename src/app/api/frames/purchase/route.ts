import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { purchaseAvatarFrame } from "@/server/repo";

export const runtime = "nodejs";

// Buy an avatar frame with coins (free frames just unlock). Auto-equips it.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const { frameId } = await readJson<{ frameId?: string }>(req);
  if (typeof frameId !== "string" || !frameId) return fail("frameId required");
  const res = await purchaseAvatarFrame(user.id, frameId.slice(0, 60));
  if (!res.ok) return fail(res.error ?? "Could not buy the frame", res.error?.includes("coins") ? 402 : 400);
  return ok({ balance: res.balance, owned: res.owned, expiresAt: res.expiresAt ?? null });
}
