import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { userCallAnalytics } from "@/server/repo";

export const runtime = "nodejs";

// Most-active-users report (admin). Query: ?from=ISO&to=ISO (the date window the
// report covers). Defaults to the last 30 days when not supplied.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const url = new URL(req.url);
  const now = Date.now();
  const parse = (v: string | null, fallback: number) => {
    if (!v) return fallback;
    const t = Date.parse(v);
    return Number.isNaN(t) ? fallback : t;
  };
  const fromMs = parse(url.searchParams.get("from"), now - 30 * 24 * 60 * 60 * 1000);
  const toMs = parse(url.searchParams.get("to"), now);

  const rows = await userCallAnalytics(fromMs, toMs);
  return ok({ rows });
}
