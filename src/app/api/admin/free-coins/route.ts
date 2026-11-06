import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { freeCoinsReport, giveFreeCoins, addAdminLog, periodicClaimLog } from "@/server/repo";

export const runtime = "nodejs";

// GET — the free-coin audit: per-source totals + distribution history + the
// per-claim log of the timed (periodic) reward (granted AND rejected attempts).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const [report, periodicClaims] = await Promise.all([freeCoinsReport(), periodicClaimLog(300)]);
  return ok({ ...report, periodicClaims });
}

// POST — distribute free coins manually (to one user or everyone).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const b = await readJson<{ target?: string; amount?: number; kind?: string; label?: string }>(req);
  const target = typeof b.target === "string" && b.target.trim() ? b.target.trim() : "all";
  const amount = typeof b.amount === "number" ? b.amount : 0;
  const kind = b.kind === "event" ? "event" : "manual";
  if (!(amount > 0)) return fail("Enter a coin amount");

  const res = await giveFreeCoins({ target, amount, kind, label: b.label, adminName: user.fullName });
  if (!res.ok) return fail(res.error ?? "Could not distribute coins", 400);
  await addAdminLog(user.fullName, `Free coins: gave ${amount} (${kind}${b.label ? ` — ${b.label}` : ""}) to ${target === "all" ? `${res.credited} users` : target}`);
  return ok({ ok: true, credited: res.credited });
}
