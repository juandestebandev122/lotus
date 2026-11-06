import { withBase } from "./base-path";

export interface CoinPurchase {
  id: string;
  userId: string;
  userName: string;
  packageId: string;
  packageName: string;
  coins: number;
  bonus: number;
  price: number;            // total paid, including tax + service charge
  basePrice?: number;       // package price before extras (older records: absent)
  tax?: number;
  taxLabel?: string;
  serviceCharge?: number;
  serviceLabel?: string;
  currency: string;
  screenshotUrl?: string;
  screenshotName?: string;
  paymentRef?: string;
  userIdNumber?: string;
  status: "pending" | "approved" | "rejected";
  at: string;
  decidedAt?: string;
  decidedBy?: string;
  note?: string;
}

// Upload a payment screenshot (reuses the secure upload endpoint).
export async function uploadPaymentScreenshot(file: File): Promise<{ ok: boolean; url?: string; name?: string; error?: string }> {
  try {
    const form = new FormData();
    form.append("file", file);
    form.append("kind", "payment");
    const res = await fetch(withBase("/api/upload"), { method: "POST", credentials: "include", body: form });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, url: d.url, name: d.name, error: d.error };
  } catch {
    return { ok: false, error: "Upload failed" };
  }
}

// User submits a coin purchase for admin verification.
export async function submitCoinPurchase(input: { packageId: string; screenshotUrl?: string; screenshotName?: string; paymentRef?: string; userIdNumber?: string }): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/wallet/buy-request"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, error: d.error };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function fetchMyCoinPurchases(): Promise<CoinPurchase[]> {
  try {
    const res = await fetch(withBase("/api/wallet/buy-request"), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return (d.requests as CoinPurchase[]) ?? [];
  } catch {
    return [];
  }
}

// Admin
export async function fetchCoinPurchases(): Promise<CoinPurchase[]> {
  try {
    const res = await fetch(withBase("/api/admin/coin-purchases"), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return (d.requests as CoinPurchase[]) ?? [];
  } catch {
    return [];
  }
}

export async function decideCoinPurchase(id: string, approve: boolean, note?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/admin/coin-purchases"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, approve, note }),
    });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, error: d.error };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function adjustUserCoins(userId: string, delta: number, reason?: string, currency?: "coins" | "lotus"): Promise<{ ok: boolean; error?: string; balance?: number; lotus?: number }> {
  try {
    const res = await fetch(withBase("/api/admin/coin-adjust"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ userId, delta, reason, currency }),
    });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, error: d.error, balance: d.balance, lotus: d.lotus };
  } catch {
    return { ok: false, error: "Network error" };
  }
}
