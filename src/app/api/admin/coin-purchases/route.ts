import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listCoinPurchases, decideCoinPurchase, addAdminLog } from "@/server/repo";

export const runtime = "nodejs";

// Admin: list all QR/UPI coin-purchase requests.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  return ok({ requests: await listCoinPurchases() });
}

// Admin: approve (credit coins + bonus) or reject a purchase.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const body = await readJson<{ id?: string; approve?: boolean; note?: string }>(req);
  if (!body.id) return fail("id required");
  const res = await decideCoinPurchase(String(body.id), body.approve === true, user.fullName, typeof body.note === "string" ? body.note : undefined);
  if (!res.ok) return fail(res.error ?? "Could not update purchase", 400);
  await addAdminLog(user.fullName, `${body.approve ? "Approved" : "Rejected"} coin purchase ${body.id}`);
  return ok({ ok: true });
}
