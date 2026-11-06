import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { lotusReport, userLotusBreakdown } from "@/server/repo";

export const runtime = "nodejs";

// Lotus economy dashboard: rates/limits config + totals + withdrawals + earners.
// ?user=<id> → that user's Lotus earning breakdown-by-source (Top-Earners drill-down).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const key = new URL(req.url).searchParams.get("user")?.trim();
  if (key) return ok({ breakdown: await userLotusBreakdown(key) });
  return ok({ report: await lotusReport() });
}
