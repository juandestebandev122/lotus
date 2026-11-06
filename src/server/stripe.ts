// ============================================================
// Stripe integration (coin top-ups) — fetch-based, no SDK.
// The secret key comes from Admin → Settings (config.stripe) when saved there,
// otherwise from the env var; with neither, the wallet falls back to the
// built-in test/simulated checkout. Checkout prefers Razorpay when that is set up.
//   Server env:  STRIPE_SECRET_KEY = sk_test_... / sk_live_...
//   (publishable key is only needed client-side and is optional for Checkout)
// ============================================================

import { getDB } from "./db";

const STRIPE_API = "https://api.stripe.com/v1";

export type StripeSource = "settings" | "env" | "none";

export function stripeKeyValid(key: string): boolean {
  return /^sk_(test|live)_/.test(key);
}

export function envStripeSecret(): string {
  return process.env.STRIPE_SECRET_KEY || "";
}

/** The active secret key: the admin-saved one when valid, else env ("" = off). */
export async function stripeSecret(): Promise<{ key: string; source: StripeSource }> {
  const saved = ((await getDB()).config?.stripe?.secretKey || "").trim();
  if (stripeKeyValid(saved)) return { key: saved, source: "settings" };
  const env = envStripeSecret();
  return stripeKeyValid(env) ? { key: env, source: "env" } : { key: "", source: "none" };
}

export async function stripeConfigured(): Promise<boolean> {
  return (await stripeSecret()).source !== "none";
}

/** Admin "Test connection": one read-only authenticated call (balance). */
export async function testStripeConnection(key: string): Promise<{ ok: boolean; mode?: "test" | "live"; error?: string }> {
  if (!stripeKeyValid(key)) return { ok: false, error: "The Secret key must start with sk_test_ or sk_live_." };
  try {
    const res = await fetch(`${STRIPE_API}/balance`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 401) return { ok: false, error: "Stripe refused this Secret key. Copy it again from the Stripe Dashboard." };
    if (!res.ok) return { ok: false, error: `Stripe answered with an error (HTTP ${res.status}).` };
    return { ok: true, mode: key.startsWith("sk_live_") ? "live" : "test" };
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    return { ok: false, error: timedOut ? "No answer from Stripe (timed out). Try again." : "Could not reach Stripe. Check the server's internet connection." };
  }
}

function encodeForm(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.append(k, String(v));
  }
  return sp.toString();
}

async function stripeRequest(path: string, method: "GET" | "POST", body?: string) {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${(await stripeSecret()).key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || `Stripe error ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/** Create a hosted Checkout Session for a coin package and return its URL. */
export async function createCoinCheckout(opts: {
  origin: string;
  userId: string;
  packageId: string;
  coins: number;
  priceMajor: number; // price in the major unit (e.g. SAR)
  currency: string; // ISO code, lower-cased (e.g. "sar")
  name: string;
}): Promise<{ id: string; url: string }> {
  const unitAmount = Math.round(opts.priceMajor * 100); // smallest currency unit
  const body = encodeForm({
    mode: "payment",
    success_url: `${opts.origin}/wallet?paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.origin}/wallet?canceled=1`,
    client_reference_id: opts.userId,
    "line_items[0][quantity]": 1,
    "line_items[0][price_data][currency]": opts.currency,
    "line_items[0][price_data][unit_amount]": unitAmount,
    "line_items[0][price_data][product_data][name]": opts.name,
    "metadata[userId]": opts.userId,
    "metadata[packageId]": opts.packageId,
    "metadata[coins]": opts.coins,
  });
  const session = await stripeRequest("/checkout/sessions", "POST", body);
  return { id: session.id as string, url: session.url as string };
}

/** Retrieve a Checkout Session to verify it was actually paid before crediting. */
export async function getCoinCheckout(sessionId: string): Promise<{
  paid: boolean;
  amountTotal: number | null;
  currency: string | null;
  clientReferenceId: string | null;
  metadata: Record<string, string>;
}> {
  const s = await stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}`, "GET");
  return {
    paid: s.payment_status === "paid",
    amountTotal: typeof s.amount_total === "number" ? s.amount_total : null,
    currency: s.currency ?? null,
    clientReferenceId: s.client_reference_id ?? null,
    metadata: (s.metadata as Record<string, string>) || {},
  };
}
