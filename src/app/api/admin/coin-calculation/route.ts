import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { coinCalculationReport } from "@/server/repo";

export const runtime = "nodejs";

// The ONE authoritative coin/financial overview (Coin Calculation Table).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  return ok(await coinCalculationReport());
}
