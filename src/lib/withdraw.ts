// Wallet withdrawal (cash-out) settings, shared by client + server.
// Coins convert to a real-money payout (Saudi Riyal) at this rate.

export const COINS_PER_SAR = 10; // 10 coins = SAR 1 payout
export const MIN_WITHDRAW_COINS = 1000; // minimum cash-out (SAR 100)

export const WITHDRAW_METHODS = ["Bank transfer", "STC Pay", "PayPal"] as const;
export type WithdrawMethod = (typeof WITHDRAW_METHODS)[number];

export type WithdrawStatus = "pending" | "approved" | "rejected" | "completed";

// Payout value (in SAR) for a number of coins. Name kept for compatibility.
export function inrFromCoins(coins: number): number {
  return Math.round((coins / COINS_PER_SAR) * 100) / 100;
}
