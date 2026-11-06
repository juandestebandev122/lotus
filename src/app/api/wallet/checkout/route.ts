import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getConfig } from "@/server/repo";
import { razorpayCreds, razorpayCredsComplete, createOrder } from "@/server/razorpay";
import { stripeConfigured, createCoinCheckout } from "@/server/stripe";
import { priceBreakdown } from "@/lib/coin-price";

export const runtime = "nodejs";

// Start a real coin purchase. Prefers Razorpay (India), falls back to Stripe.
// Returns the data the client needs to open the gateway. If neither is set up
// it reports configured:false so the wallet uses the built-in test checkout.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);

  const config = await getConfig();
  const body = await readJson<{ packageId?: string }>(req);
  const chosen = config.coinPackages.find((p) => p.id === body.packageId && p.active);
  if (!chosen) return fail("Coin package not found or unavailable", 404);

  // Charge the SAME total the checkout screen showed: package price + tax +
  // service charge, from the one shared calculator.
  const payable = priceBreakdown(chosen.price, config.coinFees).payable;

  // ---- Razorpay (preferred) ----
  const rzp = await razorpayCreds();
  if (razorpayCredsComplete(rzp)) {
    const currency = (config.paymentGateway?.currency || "INR").toUpperCase();
    try {
      const order = await createOrder(rzp, {
        amountMajor: payable,
        currency,
        receipt: `c_${chosen.id}_${Date.now().toString(36)}`,
        notes: { userId: user.id, packageId: chosen.id, coins: String(chosen.coins) },
      });
      return ok({
        configured: true,
        provider: "razorpay",
        keyId: rzp.keyId,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        name: "LotusPlay Connect",
        description: `${chosen.coins.toLocaleString("en-US")} coins · ${chosen.name}`,
        prefill: { name: user.fullName, email: user.email || "" },
      });
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Could not start payment", 502);
    }
  }

  // ---- Stripe (fallback) ----
  if (await stripeConfigured()) {
    const currency = (config.paymentGateway?.currency || "SAR").toLowerCase();
    const host = req.headers.get("host") || "lotusplay.tech";
    const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
    const origin = process.env.SITE_URL || `${proto}://${host}`;
    try {
      const session = await createCoinCheckout({
        origin,
        userId: user.id,
        packageId: chosen.id,
        coins: chosen.coins,
        priceMajor: payable,
        currency,
        name: `${chosen.coins.toLocaleString("en-US")} coins · ${chosen.name}`,
      });
      return ok({ configured: true, provider: "stripe", url: session.url, id: session.id });
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Could not start checkout", 502);
    }
  }

  return ok({ configured: false });
}
