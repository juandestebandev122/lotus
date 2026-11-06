import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { requestWithdrawal, requestLotusWithdrawal, listWithdrawals, getConfig, findById } from "@/server/repo";

export const runtime = "nodejs";

// A user's own withdrawal requests + the live (admin-configured) cash-out rules,
// so the wallet UI always shows the current rate / fee / limits with no app update.
// When the Lotus economy is ON, the UI withdraws from the Lotus balance instead.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const cfg = await getConfig();
  const w = cfg.withdraw ?? { coinsPerUnit: 10, currency: "SAR", feePct: 0, minCoins: 1000, maxCoins: 100000, autoApprove: false };
  const fresh = await findById(user.id);
  return ok({
    withdrawals: await listWithdrawals(user.id),
    withdraw: w,
    lotus: cfg.lotus,                    // Lotus economy config (enabled + rates/limits)
    lotusBalance: fresh?.lotus ?? 0,     // the user's current Lotus balance
    // Back-compat keys some older clients read:
    coinsPerSar: w.coinsPerUnit,
    minCoins: w.minCoins,
  });
}

// Submit a withdrawal request (balance is held immediately). All limits/rates are
// validated server-side. When the Lotus economy is enabled, withdrawals come from
// the Lotus balance (coins can't be withdrawn directly); otherwise from coins.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);

  const body = await readJson<{ coins?: number; lotus?: number; method?: string; details?: string }>(req);
  const method = typeof body.method === "string" && body.method ? body.method.slice(0, 30) : "Bank transfer";
  const details = typeof body.details === "string" ? body.details : "";

  const cfg = await getConfig();
  if (cfg.lotus?.enabled) {
    const lotus = Math.max(0, Math.floor(Number(body.lotus) || 0));
    const res = await requestLotusWithdrawal({ userId: user.id, userName: user.fullName, lotus, method, details });
    if (!res.ok) return fail(res.error ?? "Could not submit withdrawal", (res.error ?? "").startsWith("Insufficient") ? 402 : 400);
    return ok({ ok: true, balance: res.balance, net: res.net, currency: res.currency, kind: "lotus" });
  }

  const coins = Math.max(0, Math.floor(Number(body.coins) || 0));
  const res = await requestWithdrawal({ userId: user.id, userName: user.fullName, coins, method, details });
  if (!res.ok) return fail(res.error ?? "Could not submit withdrawal", res.error === "Insufficient coins" ? 402 : 400);
  return ok({ ok: true, balance: res.balance, net: res.net, currency: res.currency, kind: "coins" });
}
