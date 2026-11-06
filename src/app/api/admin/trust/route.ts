import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { trustReport, adminTrustAdjust } from "@/server/repo";

export const runtime = "nodejs";

// Trust Profit dashboard: balance + income by period + sources + ledger.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const u = new URL(req.url);
  const report = await trustReport({
    from: u.searchParams.get("from") || undefined,
    to: u.searchParams.get("to") || undefined,
    q: u.searchParams.get("q") || undefined,
    source: u.searchParams.get("source") || undefined,
  });
  return ok({ report });
}

// Manual Trust Wallet credit / debit (a debit can pay a user).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const type = body.type === "debit" ? "debit" : "credit";
  const res = await adminTrustAdjust({
    type,
    lotus: Number(body.lotus) || 0,
    note: String(body.note || "").slice(0, 200),
    targetUserId: body.targetUserId ? String(body.targetUserId) : undefined,
    adminName: user.fullName,
  });
  if (!res.ok) return fail(res.error ?? "Failed", 400);
  return ok(res);
}
