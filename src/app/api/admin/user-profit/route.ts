import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { userProfitReport, clearGameTransactions, addAdminLog } from "@/server/repo";
import { canAccess } from "@/lib/admin-perms";

export const runtime = "nodejs";

// Admin action: clear all coin-related GAME transaction records (game winnings +
// game-start charges). Balances are untouched — only the ledger rows are removed.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  if (!canAccess("payments", user.adminRole, user.adminPermissions)) return fail("Financial access required", 403);
  const body = await readJson<{ action?: string }>(req);
  if (body.action !== "clearGameTransactions") return fail("Unknown action", 400);
  const res = await clearGameTransactions();
  await addAdminLog(user.fullName, `Cleared ${res.removed} game coin transaction record(s)`);
  return ok(res);
}

// User Profit — coins users EARNED on the platform (gifts received, call
// earnings, game winnings, referrals, rewards). Admin-only (payments permission).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  if (!canAccess("payments", user.adminRole, user.adminPermissions)) return fail("Financial access required", 403);

  const p = new URL(req.url).searchParams;
  const report = await userProfitReport({
    from: p.get("from") || undefined,
    to: p.get("to") || undefined,
    type: p.get("type") || undefined,
    q: p.get("q") || undefined,
    limit: p.get("limit") ? Number(p.get("limit")) : 1000,
    offset: p.get("offset") ? Number(p.get("offset")) : 0,
  });
  return ok(report);
}
