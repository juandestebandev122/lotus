// Supported payment methods offered at coin checkout. Which ones actually
// appear is controlled per-method by the admin (config.paymentGateway.methods).

export type PaymentMethodKey = "cards" | "googlePay" | "applePay" | "paypal" | "local";

export const PAYMENT_METHODS: { key: PaymentMethodKey; label: string; hint: string; emoji: string }[] = [
  { key: "cards", label: "Credit / Debit Card", hint: "Visa, MasterCard", emoji: "💳" },
  { key: "googlePay", label: "Google Pay", hint: "", emoji: "🟢" },
  { key: "applePay", label: "Apple Pay", hint: "", emoji: "" },
  { key: "paypal", label: "PayPal", hint: "", emoji: "🅿️" },
  { key: "local", label: "Local payment apps", hint: "Based on your country", emoji: "📱" },
];

export const DEFAULT_METHODS: Record<PaymentMethodKey, boolean> = {
  cards: true,
  googlePay: true,
  applePay: true,
  paypal: true,
  local: true,
};

export function methodLabel(key: string): string {
  return PAYMENT_METHODS.find((m) => m.key === key)?.label ?? "Card";
}
