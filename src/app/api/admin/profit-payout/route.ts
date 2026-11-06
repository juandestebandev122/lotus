import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { recordCompanyPayout, recordAgencyPayout, listProfitPayouts, addAdminLog } from "@/server/repo";

export const runtime = "nodejs";

// Profit withdrawals / payouts for the Company, Agency and Trust pools (User
// profit is withdrawn via the normal wallet flow). GET lists payouts; POST
// records one (deducting from the pool).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const u = new URL(req.url);
  const payouts = await listProfitPayouts({ pool: u.searchParams.get("pool") || undefined, agencyId: u.searchParams.get("agencyId") || undefined });
  return ok({ payouts });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const b = await readJson<{ pool?: string; agencyId?: string; amount?: number; method?: string; details?: string; note?: string }>(req);
  const amount = Number(b.amount) || 0;
  const method = String(b.method || "Manual").slice(0, 40);
  const details = b.details ? String(b.details).slice(0, 120) : undefined;
  const note = b.note ? String(b.note).slice(0, 200) : undefined;

  let res;
  if (b.pool === "agency") {
    if (!b.agencyId) return fail("Agency is required");
    res = await recordAgencyPayout({ agencyId: String(b.agencyId), amount, method, details, note, by: user.fullName });
  } else if (b.pool === "company") {
    res = await recordCompanyPayout({ amount, method, details, note, by: user.fullName });
  } else {
    return fail("Unknown profit pool");
  }
  if (!res.ok) return fail(res.error ?? "Payout failed", 400);
  await addAdminLog(user.fullName, `Recorded ${b.pool} profit payout of ${amount} via ${method}`);
  return ok(res);
}
