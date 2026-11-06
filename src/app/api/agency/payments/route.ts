import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listAgencyPayments } from "@/server/repo";

export const runtime = "nodejs";

// The signed-in user's agency membership payment history / receipts. Pass
// ?agencyId= to scope to one agency (still only the caller's own payments).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const agencyId = new URL(req.url).searchParams.get("agencyId") ?? undefined;
  return ok({ payments: await listAgencyPayments({ userId: user.id, agencyId }) });
}
