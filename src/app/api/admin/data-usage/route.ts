import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { dataUsageReport } from "@/server/repo";

export const runtime = "nodejs";

// Per-user data-usage estimate for the admin panel. Accepts an explicit
// from/to (YYYY-MM-DD) custom range, or a trailing `days` window (back-compat;
// e.g. Today = days=1, Last 8/15/31). from/to win when both are valid.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const sp = new URL(req.url).searchParams;
  const isDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(`${s}T00:00:00Z`));
  const from = sp.get("from");
  const to = sp.get("to");
  // Optional single-user drill-down for "search usage for a specific user".
  const userId = sp.get("user") || undefined;
  if (isDate(from) && isDate(to)) {
    return ok(await dataUsageReport(from, to, userId));
  }
  // Trailing N-day window.
  const daysParam = Number(sp.get("days") || 8);
  const days = Math.max(1, Math.min(366, Number.isFinite(daysParam) ? daysParam : 8));
  const today = new Date();
  const start = new Date(today); start.setUTCDate(start.getUTCDate() - (days - 1));
  return ok(await dataUsageReport(start.toISOString().slice(0, 10), today.toISOString().slice(0, 10), userId));
}
