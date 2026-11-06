import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { createCoinPurchase, listMyCoinPurchases, featureOn } from "@/server/repo";

export const runtime = "nodejs";

// User submits a QR/UPI coin purchase (after paying + uploading a screenshot).
// Creates a PENDING request — no coins are added until an admin verifies it.
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return fail("Please log in first", 401);
  if (!(await featureOn("coins"))) return fail("The coin system is currently turned off.", 403);
  const body = await readJson<{ packageId?: string; screenshotUrl?: string; screenshotName?: string; paymentRef?: string; userIdNumber?: string }>(req);
  if (!body.packageId) return fail("Pick a coin package first");
  const res = await createCoinPurchase({
    userId: me.id,
    packageId: String(body.packageId),
    screenshotUrl: typeof body.screenshotUrl === "string" ? body.screenshotUrl : undefined,
    screenshotName: typeof body.screenshotName === "string" ? body.screenshotName : undefined,
    paymentRef: typeof body.paymentRef === "string" ? body.paymentRef : undefined,
    userIdNumber: typeof body.userIdNumber === "string" ? body.userIdNumber : undefined,
  });
  if (!res.ok) return fail(res.error ?? "Could not submit your purchase", 400);
  return ok({ ok: true, request: res.request });
}

// The user's own purchase requests (to show pending/approved status).
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return ok({ requests: [] });
  return ok({ requests: await listMyCoinPurchases(me.id) });
}
