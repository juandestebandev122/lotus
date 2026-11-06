import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getConfig, purchaseCoins, notifyUser } from "@/server/repo";
import { withDB, type DBShape } from "@/server/db";
import { priceBreakdown } from "@/lib/coin-price";

export const runtime = "nodejs";

// Buy a coin package. The actual card charge happens at a payment gateway —
// this endpoint is the secure server step that credits coins ONLY after a
// successful payment and records the transaction either way.
//
// `simulateFail: true` lets the demo show the failed-payment path (no coins
// added, status recorded). `paymentRef` is an idempotency key that blocks
// duplicate credits. Plug real gateway verification in where noted.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);

  const body = await readJson<{ packageId?: string; simulateFail?: boolean; paymentRef?: string; method?: string }>(req);
  const config = await getConfig();
  const pkg = config.coinPackages.find((p) => p.id === body.packageId && p.active);
  if (!pkg) return fail("Coin package not found or unavailable", 404);
  const ref = typeof body.paymentRef === "string" && body.paymentRef ? body.paymentRef.slice(0, 64) : undefined;
  const method = typeof body.method === "string" && body.method ? body.method.slice(0, 30) : "Card";
  // The amount charged/recorded includes tax + service charge, matching checkout.
  const payable = priceBreakdown(pkg.price, config.coinFees).payable;

  // ── Payment gateway verification goes here (Razorpay/Stripe). ──
  // The provider is configured in admin (config.paymentGateway). In "test"
  // mode the result is simulated; with a real provider, verify the gateway
  // signature/charge here before crediting. Duplicate payments are blocked by
  // the paymentRef idempotency key inside purchaseCoins().
  const paymentSucceeded = !body.simulateFail;

  if (!paymentSucceeded) {
    await withDB((db: DBShape) => {
      if (!db.transactions) db.transactions = [];
      db.transactions.unshift({
        id: `tx_${Math.random().toString(36).slice(2, 12)}`,
        userId: user.id,
        userName: user.fullName,
        type: "purchase",
        coins: pkg.coins,
        amount: payable,
        status: "failed",
        description: `Failed payment (${method}) for ${pkg.name} (${pkg.coins.toLocaleString("en-SA")} coins)`,
        balanceAfter: user.coins ?? 0,
        createdAt: new Date().toISOString(),
        ref,
      });
    });
    await notifyUser(user.id, `Payment failed for ${pkg.coins.toLocaleString("en-SA")} coins. No coins were added.`, { label: "Wallet", href: "/wallet" });
    return fail("Payment failed — no coins were added.", 402);
  }

  const res = await purchaseCoins(user.id, user.fullName, pkg.coins, payable, ref, method);
  if (!res.ok) return fail(res.error ?? "Could not credit coins", 400);
  // Idempotent replay (duplicate click/retry) — coins already credited once.
  if ("duplicate" in res && res.duplicate) return ok({ ok: true, balance: res.balance, duplicate: true });
  await notifyUser(user.id, `Payment successful — ${pkg.coins.toLocaleString("en-SA")} coins added to your wallet 🎉`, { label: "Wallet", href: "/wallet" }, "reward");
  return ok({ ok: true, balance: res.balance });
}
