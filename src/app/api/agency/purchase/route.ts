import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { purchaseAgencyMembership } from "@/server/repo";

export const runtime = "nodejs";

// The agency owner buys / renews the membership with wallet coins → activation +
// receipt. Failed payments never activate the membership.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const b = await readJson<{ agencyId?: string; planId?: string }>(req);
  if (!b.agencyId || !b.planId) return fail("agencyId and planId are required");
  const res = await purchaseAgencyMembership(user.id, b.agencyId, b.planId);
  if (!res.ok) return fail(res.error ?? "Payment failed", 402);
  return ok({ agency: res.agency, receipt: res.receipt, balance: res.balance });
}
