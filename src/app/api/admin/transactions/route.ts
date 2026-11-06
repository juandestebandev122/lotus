import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getDB } from "@/server/db";
import { listAllTransactions, adminAdjustCoins, addAdminLog } from "@/server/repo";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const db = await getDB();
  // Attach each member's permanent ID NUMBER at read time, so the admin table can
  // show "name + ID" without changing how transactions are written.
  const pubOf = new Map(db.users.map((u) => [u.id, u.publicId]));
  const transactions = (await listAllTransactions()).map((t) => ({ ...t, publicId: pubOf.get(t.userId) }));
  // Wallet balances per user (for the "all wallet balances" view).
  // Includes the LOTUS balance — the admin wallets table showed an empty column
  // because this was never sent.
  const wallets = db.users.map((u) => ({ id: u.id, fullName: u.fullName, publicId: u.publicId, email: u.email ?? "", coins: u.coins ?? 0, lotus: u.lotus ?? 0 }));
  const revenue = transactions.filter((t) => t.type === "purchase" && t.status === "success").reduce((s, t) => s + t.amount, 0);
  const giftSpend = transactions.filter((t) => t.type === "spend").reduce((s, t) => s + t.coins, 0);
  // Company/admin revenue from the gift + call splits (in coins) — now sourced
  // from the Company Profit ledger (the single source of truth). Full breakdown
  // lives on the dedicated Company Profit page.
  const giftRevenue = (db.companyProfits ?? []).filter((e) => e.type === "gift").reduce((s, e) => s + e.coins, 0);
  return ok({
    transactions,
    wallets,
    revenue,
    giftSpend,
    giftRevenue,
    companyEarnings: db.companyEarnings ?? 0,
    receiverPayouts: db.receiverPayouts ?? 0,
  });
}

// Manual credit / debit of a user's wallet.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const body = await readJson<{ userId?: string; delta?: number; reason?: string }>(req);
  const userId = typeof body.userId === "string" ? body.userId : "";
  const delta = Math.floor(Number(body.delta) || 0);
  if (!userId || !delta) return fail("User and a non-zero coin amount are required");

  const res = await adminAdjustCoins(userId, delta, user.fullName, typeof body.reason === "string" ? body.reason : "");
  if (!res.ok) return fail(res.error ?? "Could not adjust wallet", 400);
  await addAdminLog(user.fullName, `${delta >= 0 ? "Credited" : "Debited"} ${Math.abs(delta)} coins ${delta >= 0 ? "to" : "from"} a user wallet`);
  return ok({ ok: true, balance: res.balance });
}
