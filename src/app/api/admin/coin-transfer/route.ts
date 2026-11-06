import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { adminTransferCoins } from "@/server/repo";
import { clientIp } from "@/server/geo";

export const runtime = "nodejs";

// Super-Admin: atomically move coins from one user to another in a single action
// (recorded as a linked pair of transactions; both users are notified).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const body = await readJson<{ fromId?: string; toId?: string; amount?: number; reason?: string }>(req);
  if (!body.fromId || !body.toId || typeof body.amount !== "number") return fail("fromId, toId and amount are required");
  const res = await adminTransferCoins(String(body.fromId), String(body.toId), body.amount, typeof body.reason === "string" ? body.reason : "", user.fullName, { ip: clientIp(req), device: (req.headers.get("user-agent") ?? "").slice(0, 120), adminId: user.publicId ?? user.id });
  if (!res.ok) return fail(res.error ?? "Could not transfer coins", 400);
  return ok({ ok: true, fromBalance: res.fromBalance, toBalance: res.toBalance });
}
