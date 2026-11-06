import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { masterTransactionReport } from "@/server/repo";

export const runtime = "nodejs";

// MASTER TRANSACTION MANAGEMENT — the unified ledger of every coin/Lotus
// movement (wallet transactions + gifts with splits + withdrawals) and the
// live dashboard summary. Admin-only.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const data = await masterTransactionReport();
  return ok(data);
}
