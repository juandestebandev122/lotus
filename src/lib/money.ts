// Central money/currency for the platform. The displayed currency is driven by
// the admin payment config (config.paymentGateway.currency), so it can be INR
// now (India / Razorpay) and switch to SAR later without code changes.
// Coin COUNTS are not money — only real payment/payout amounts use these.

let activeLabel = "INR";
const LOCALE = "en-SA"; // neutral thousands grouping (works for INR + SAR)

/** Set the active currency label (called once when config loads). */
export function configureCurrency(code?: string | null) {
  if (code && typeof code === "string") activeLabel = code.toUpperCase();
}

export function currencyCode(): string {
  return activeLabel;
}

/** Format a money amount with the currency label, e.g. money(49) → "INR 49". */
export function money(amount: number | undefined | null): string {
  return `${activeLabel} ${(amount ?? 0).toLocaleString(LOCALE)}`;
}
