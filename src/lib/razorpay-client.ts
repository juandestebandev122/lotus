"use client";

// Loads Razorpay's Checkout script on demand and opens the payment popup.

interface CheckoutInfo {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  name?: string;
  description?: string;
  prefill?: { name?: string; email?: string };
}

interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export async function openRazorpayCheckout(
  info: CheckoutInfo,
  onSuccess: (resp: RazorpaySuccess) => void,
  onDismiss?: () => void,
): Promise<boolean> {
  const loaded = await loadScript();
  if (!loaded || !window.Razorpay) return false;
  const rzp = new window.Razorpay({
    key: info.keyId,
    order_id: info.orderId,
    amount: info.amount,
    currency: info.currency,
    name: info.name || "LotusPlay Connect",
    description: info.description || "Coin purchase",
    prefill: info.prefill || {},
    theme: { color: "#7c3aed" },
    handler: (resp: RazorpaySuccess) => onSuccess(resp),
    modal: { ondismiss: () => onDismiss?.() },
  });
  rzp.open();
  return true;
}
