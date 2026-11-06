import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getConfig, purchaseCoins, notifyUser } from "@/server/repo";
import { verifyPaymentSignature, getOrder, razorpayCreds, razorpayCredsComplete } from "@/server/razorpay";
import { stripeConfigured, getCoinCheckout } from "@/server/stripe";
import { priceBreakdown } from "@/lib/coin-price";

export const runtime = "nodejs";

// Verify a completed payment and credit the coins.
//  • Razorpay: body has { razorpay_order_id, razorpay_payment_id, razorpay_signature }
//  • Stripe:   body has { sessionId }
// The gateway payment id is the idempotency key, so a retry can't double-credit.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);

  const body = await readJson<{
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
    sessionId?: string;
  }>(req);

  // ---- Razorpay ----
  if (body.razorpay_payment_id) {
    const orderId = String(body.razorpay_order_id || "");
    const paymentId = String(body.razorpay_payment_id || "");
    const signature = String(body.razorpay_signature || "");
    const rzp = await razorpayCreds();
    if (!razorpayCredsComplete(rzp)) return fail("Payments are not configured", 400);
    if (!verifyPaymentSignature(rzp, orderId, paymentId, signature))
      return fail("Payment verification failed", 400);

    let order;
    try {
      order = await getOrder(rzp, orderId);
    } catch {
      return fail("Could not verify the payment with Razorpay", 502);
    }
    if (order.status !== "paid") return fail("Payment was not completed", 402);
    if (order.notes.userId && order.notes.userId !== user.id)
      return fail("This payment belongs to a different account", 403);

    const coins = Number(order.notes.coins) || 0;
    if (!coins) return fail("Invalid payment details", 400);
    const priceMajor = (order.amount ?? 0) / 100;

    const res = await purchaseCoins(user.id, user.fullName, coins, priceMajor, `rzp_${paymentId}`, "Razorpay");
    if (!res.ok) return fail(res.error ?? "Could not credit coins", 400);
    if ("duplicate" in res && res.duplicate) return ok({ ok: true, balance: res.balance, duplicate: true });
    await notifyUser(
      user.id,
      `Payment successful — ${coins.toLocaleString("en-US")} coins added to your wallet 🎉`,
      { label: "Wallet", href: "/wallet" },
      "reward",
    );
    return ok({ ok: true, balance: res.balance });
  }

  // ---- Stripe ----
  if (body.sessionId) {
    if (!(await stripeConfigured())) return fail("Payments are not configured", 400);
    const sessionId = body.sessionId.slice(0, 200);
    let session;
    try {
      session = await getCoinCheckout(sessionId);
    } catch {
      return fail("Could not verify the payment with Stripe", 502);
    }
    if (!session.paid) return fail("Payment was not completed", 402);
    if (session.clientReferenceId && session.clientReferenceId !== user.id)
      return fail("This payment belongs to a different account", 403);
    const coins = Number(session.metadata.coins) || 0;
    if (!coins) return fail("Invalid payment details", 400);
    const config = await getConfig();
    const pkg = config.coinPackages.find((p) => p.id === session.metadata.packageId);
    // Record the FULL amount the customer was actually charged (package price +
    // tax + service charge), not the pre-tax base. The Stripe session was created
    // with the taxed total, so recording pkg.price would under-report revenue and
    // disagree with the checkout screen. Prefer Stripe's own amountTotal; fall
    // back to the shared tax calculator.
    const priceMajor = session.amountTotal != null
      ? session.amountTotal / 100
      : (pkg ? priceBreakdown(pkg.price, config.coinFees).payable : 0);
    const res = await purchaseCoins(user.id, user.fullName, coins, priceMajor, `stripe_${sessionId}`, "Stripe");
    if (!res.ok) return fail(res.error ?? "Could not credit coins", 400);
    if ("duplicate" in res && res.duplicate) return ok({ ok: true, balance: res.balance, duplicate: true });
    await notifyUser(
      user.id,
      `Payment successful — ${coins.toLocaleString("en-US")} coins added to your wallet 🎉`,
      { label: "Wallet", href: "/wallet" },
      "reward",
    );
    return ok({ ok: true, balance: res.balance });
  }

  return fail("Missing payment details", 400);
}
