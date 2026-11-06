// ============================================================
// Razorpay integration (coin top-ups) — fetch-based, no SDK.
// Credentials come from Admin → Settings (config.razorpay) when key id +
// secret are both saved there; otherwise from the env vars:
//   Server env:  RAZORPAY_KEY_ID     = rzp_test_... / rzp_live_...
//                RAZORPAY_KEY_SECRET = <secret>
// Flow: server creates an Order → client pays via Razorpay Checkout popup →
// server verifies the signature before crediting coins.
// ============================================================

import crypto from "node:crypto";
import { getDB } from "./db";

const RZP_API = "https://api.razorpay.com/v1";

export interface RazorpayCreds {
  keyId: string;
  keySecret: string;
}

export type RazorpaySource = "settings" | "env" | "none";

export function envRazorpayCreds(): RazorpayCreds {
  return { keyId: process.env.RAZORPAY_KEY_ID || "", keySecret: process.env.RAZORPAY_KEY_SECRET || "" };
}

export function razorpayCredsComplete(c: RazorpayCreds): boolean {
  return /^rzp_(test|live)_/.test(c.keyId) && c.keySecret.length > 0;
}

/** The active credentials: the admin-saved pair when complete, else env. */
export async function razorpayCreds(): Promise<RazorpayCreds & { source: RazorpaySource }> {
  const saved = (await getDB()).config?.razorpay;
  const fromSettings: RazorpayCreds = { keyId: (saved?.keyId || "").trim(), keySecret: (saved?.keySecret || "").trim() };
  if (razorpayCredsComplete(fromSettings)) return { ...fromSettings, source: "settings" };
  const env = envRazorpayCreds();
  return { ...env, source: razorpayCredsComplete(env) ? "env" : "none" };
}

function authHeader(c: RazorpayCreds): string {
  return "Basic " + Buffer.from(`${c.keyId}:${c.keySecret}`).toString("base64");
}

/** Admin "Test connection": one read-only authenticated call, so a wrong key
 *  pair shows up before a customer tries to pay. */
export async function testRazorpayConnection(c: RazorpayCreds): Promise<{ ok: boolean; mode?: "test" | "live"; error?: string }> {
  if (!/^rzp_(test|live)_/.test(c.keyId)) return { ok: false, error: "The Key ID must start with rzp_test_ or rzp_live_." };
  if (!c.keySecret) return { ok: false, error: "The Key Secret is required." };
  try {
    const res = await fetch(`${RZP_API}/orders?count=1`, {
      headers: { Authorization: authHeader(c) },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 401) return { ok: false, error: "Razorpay refused this Key ID / Key Secret. Copy both again from the Razorpay Dashboard." };
    if (!res.ok) return { ok: false, error: `Razorpay answered with an error (HTTP ${res.status}).` };
    return { ok: true, mode: c.keyId.startsWith("rzp_live_") ? "live" : "test" };
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    return { ok: false, error: timedOut ? "No answer from Razorpay (timed out). Try again." : "Could not reach Razorpay. Check the server's internet connection." };
  }
}

/** Create an Order and return it (id, amount, currency). amountMajor is e.g. rupees. */
export async function createOrder(c: RazorpayCreds, opts: {
  amountMajor: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<{ id: string; amount: number; currency: string }> {
  const body = {
    amount: Math.round(opts.amountMajor * 100), // smallest unit (paise)
    currency: opts.currency.toUpperCase(),
    receipt: opts.receipt.slice(0, 40),
    notes: opts.notes || {},
  };
  const res = await fetch(`${RZP_API}/orders`, {
    method: "POST",
    headers: { Authorization: authHeader(c), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.description || `Razorpay error ${res.status}`);
  return { id: data.id, amount: data.amount, currency: data.currency };
}

/** Fetch an order to read its notes/status server-side (trusted source of coins). */
export async function getOrder(c: RazorpayCreds, orderId: string): Promise<{
  status: string;
  amount: number;
  currency: string;
  notes: Record<string, string>;
}> {
  const res = await fetch(`${RZP_API}/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: authHeader(c) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.description || `Razorpay error ${res.status}`);
  return { status: data.status, amount: data.amount, currency: data.currency, notes: data.notes || {} };
}

/** Verify the payment signature returned by Razorpay Checkout (HMAC-SHA256). */
export function verifyPaymentSignature(c: RazorpayCreds, orderId: string, paymentId: string, signature: string): boolean {
  if (!c.keySecret || !orderId || !paymentId || !signature) return false;
  const expected = crypto.createHmac("sha256", c.keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
