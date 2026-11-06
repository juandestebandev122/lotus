"use client";

import { withBase } from "./base-path";

export interface WalletTransaction {
  id: string;
  userId: string;
  userName: string;
  publicId?: string; // member ID number (admin views enrich this at read time)
  type: "purchase" | "spend" | "credit" | "debit";
  coins: number;
  amount: number;
  status: "success" | "pending" | "failed";
  description: string;
  balanceAfter: number;
  createdAt: string;
}

export interface WalletSummary {
  balance: number;
  totalPurchased: number;
  totalSpent: number;
  transactions: WalletTransaction[];
  lotus?: number;         // Lotus Flower (withdraw-only) balance
  lotusEnabled?: boolean; // whether the Lotus economy is active
  lotusName?: string;     // display name of the Lotus currency
  lotusIcon?: string;     // admin-uploaded Lotus icon URL (empty = default 🪷)
  // --- My Wallet dashboard (Lotus Wallet Management) ---
  lotusCurrency?: string;       // payout currency label (e.g. "SAR")
  lotusRate?: number;           // linear payout value of 1 Lotus
  lotusValue?: number;          // current cash value of the whole Lotus balance
  totalEarnedLotus?: number;    // lifetime Lotus earned
  totalConvertedLotus?: number; // Lotus converted into cash-out requests
  totalWithdrawn?: number;      // cash actually paid out (completed withdrawals)
  totalWithdrawnLotus?: number;
  pendingWithdrawals?: { count: number; lotus: number; value: number };
  processingWithdrawals?: { count: number; lotus: number; value: number };
  rejectedWithdrawals?: { count: number; lotus: number; value: number };
  conversionTiers?: { id: string; lotus: number; value: number }[]; // enabled admin slabs
  eligibleTier?: { lotus: number; value: number } | null;           // best slab this balance affords
  eligibleAmount?: number;      // "Eligible withdrawal amount" shown in the wallet
  minWithdraw?: number;
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(withBase(path), { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface WithdrawalRow {
  id: string;
  userId: string;
  userName: string;
  coins: number;
  amountINR: number; // gross payout value
  feeAmount?: number; // withdrawal fee kept by the company
  netAmount?: number; // net paid to the user (gross − fee)
  currency?: string; // payout currency label (e.g. "SAR")
  method: string;
  details: string;
  status: "pending" | "approved" | "rejected" | "completed";
  at: string;
  decidedAt?: string;
  decidedBy?: string;
  note?: string;
  // Admin view only — enriched from the user's KYC record.
  kycStatus?: string;
  bank?: { accountHolder?: string; bankName?: string; accountNumber?: string; iban?: string; branch?: string; swift?: string; status?: string };
}

export async function fetchMyWithdrawals(): Promise<WithdrawalRow[]> {
  const data = await getJson<{ withdrawals: WithdrawalRow[] }>("/api/wallet/withdraw");
  return data?.withdrawals ?? [];
}

export async function requestWithdrawal(amount: number, method: string, details: string, kind: "coins" | "lotus" = "coins"): Promise<{ ok: boolean; balance?: number; error?: string }> {
  try {
    const res = await fetch(withBase("/api/wallet/withdraw"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(kind === "lotus" ? { lotus: amount, method, details } : { coins: amount, method, details }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, balance: (data as { balance?: number }).balance, error: (data as { error?: string }).error };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function fetchAllWithdrawals(): Promise<WithdrawalRow[]> {
  const data = await getJson<{ withdrawals: WithdrawalRow[] }>("/api/admin/withdrawals");
  return data?.withdrawals ?? [];
}

export async function decideWithdrawal(id: string, decision: "approved" | "rejected" | "completed", note = ""): Promise<boolean> {
  try {
    const res = await fetch(withBase("/api/admin/withdrawals"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, decision, note }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchWallet(): Promise<WalletSummary> {
  const data = await getJson<WalletSummary>("/api/wallet");
  return data ?? { balance: 0, totalPurchased: 0, totalSpent: 0, transactions: [] };
}

export async function purchasePackage(
  packageId: string,
  simulateFail = false,
  paymentRef?: string,
  method?: string,
): Promise<{ ok: boolean; balance?: number; duplicate?: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/wallet/purchase"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ packageId, simulateFail, paymentRef, method }),
    });
    const data = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      balance: (data as { balance?: number }).balance,
      duplicate: (data as { duplicate?: boolean }).duplicate,
      error: (data as { error?: string }).error,
    };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export interface CheckoutStart {
  configured: boolean;
  provider?: "razorpay" | "stripe";
  // Razorpay
  keyId?: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  name?: string;
  description?: string;
  prefill?: { name?: string; email?: string };
  // Stripe
  url?: string;
  error?: string;
}

// Start a real coin purchase. The server returns the gateway + data to proceed
// (Razorpay order, or Stripe hosted URL), or { configured:false } when no real
// gateway is set up (the wallet then uses the built-in test checkout).
export async function startCheckout(packageId: string): Promise<CheckoutStart> {
  try {
    const res = await fetch(withBase("/api/wallet/checkout"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ packageId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { configured: true, error: (data as { error?: string }).error };
    return data as CheckoutStart;
  } catch {
    return { configured: false, error: "Network error" };
  }
}

// Verify a returned payment and credit the coins (idempotent). Pass the
// gateway's payload: Razorpay {razorpay_*} or Stripe {sessionId}.
export async function confirmPayment(
  payload: Record<string, string>,
): Promise<{ ok: boolean; balance?: number; duplicate?: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/wallet/confirm"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      balance: (data as { balance?: number }).balance,
      duplicate: (data as { duplicate?: boolean }).duplicate,
      error: (data as { error?: string }).error,
    };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

// Send a gift to a named player. Delivers it to their profile + notifies them.
export async function sendGift(
  toName: string,
  giftId: string,
  context?: string,
  roomId?: string,
): Promise<{ ok: boolean; balance?: number; delivered?: boolean; recipientName?: string; error?: string }> {
  try {
    const res = await fetch(withBase("/api/wallet/gift"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ toName, giftId, context, roomId }),
    });
    const data = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      balance: (data as { balance?: number }).balance,
      delivered: (data as { delivered?: boolean }).delivered,
      recipientName: (data as { recipientName?: string }).recipientName,
      error: (data as { error?: string }).error,
    };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function spendOnGift(coins: number, description: string): Promise<{ ok: boolean; balance?: number; error?: string }> {
  try {
    const res = await fetch(withBase("/api/wallet/gift"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ coins, description }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, balance: (data as { balance?: number }).balance, error: (data as { error?: string }).error };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

// ---------- Admin ----------
export interface WalletRow { id: string; fullName: string; email: string; coins: number; lotus?: number; publicId?: string }
export async function fetchAllTransactions(): Promise<{ transactions: WalletTransaction[]; wallets: WalletRow[]; revenue: number; giftSpend: number; giftRevenue?: number; companyEarnings?: number; receiverPayouts?: number }> {
  const data = await getJson<{ transactions: WalletTransaction[]; wallets: WalletRow[]; revenue: number; giftSpend: number; giftRevenue?: number; companyEarnings?: number; receiverPayouts?: number }>("/api/admin/transactions");
  return data ?? { transactions: [], wallets: [], revenue: 0, giftSpend: 0 };
}

export async function adminAdjustWallet(userId: string, delta: number, reason: string): Promise<boolean> {
  try {
    const res = await fetch(withBase("/api/admin/transactions"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ userId, delta, reason }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
