import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { adminSetWalletFrozen } from "@/server/repo";
import { clientIp } from "@/server/geo";

export const runtime = "nodejs";

// Super-Admin: freeze / unfreeze a user's coin wallet. While frozen the user keeps
// using the app but cannot spend / withdraw / transfer coins (admin add & deduct
// still work, for corrections).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const body = await readJson<{ userId?: string; frozen?: boolean; reason?: string }>(req);
  if (!body.userId || typeof body.frozen !== "boolean") return fail("userId and frozen are required");
  const res = await adminSetWalletFrozen(String(body.userId), body.frozen, typeof body.reason === "string" ? body.reason : "", user.fullName, { ip: clientIp(req), device: (req.headers.get("user-agent") ?? "").slice(0, 120), adminId: user.publicId ?? user.id });
  if (!res.ok) return fail(res.error ?? "Could not update the wallet", 400);
  return ok({ ok: true, frozen: res.frozen });
}
