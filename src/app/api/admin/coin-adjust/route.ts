import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { adminAdjustCoins, adminAdjustLotus, addAdminLog } from "@/server/repo";
import { clientIp } from "@/server/geo";

export const runtime = "nodejs";

// Admin: manually add (+) or remove (-) coins — OR Lotus currency — from a user's wallet.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const body = await readJson<{ userId?: string; delta?: number; reason?: string; currency?: string }>(req);
  if (!body.userId || typeof body.delta !== "number") return fail("userId and delta are required");
  const reason = typeof body.reason === "string" ? body.reason : undefined;
  const meta = { ip: clientIp(req), device: (req.headers.get("user-agent") ?? "").slice(0, 120), adminId: user.publicId ?? user.id };
  if (body.currency === "lotus") {
    const res = await adminAdjustLotus(String(body.userId), body.delta, user.fullName, reason, meta);
    if (!res.ok) return fail(res.error ?? "Could not adjust Lotus", 400);
    await addAdminLog(user.fullName, `Adjusted Lotus for ${body.userId} by ${body.delta}`);
    return ok({ ok: true, lotus: res.lotus });
  }
  const res = await adminAdjustCoins(String(body.userId), body.delta, user.fullName, reason, meta);
  if (!res.ok) return fail(res.error ?? "Could not adjust coins", 400);
  await addAdminLog(user.fullName, `Adjusted coins for ${body.userId} by ${body.delta}`);
  return ok({ ok: true, balance: res.balance });
}
