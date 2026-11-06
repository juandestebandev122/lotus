// Tax + service charge on coin purchases.
//
// ONE shared calculator, used by the wallet store, the checkout modal, the
// payment gateways and the admin screens, so the number the user sees is always
// exactly the number they are charged and the number the admin verifies.

export interface CoinFees {
  taxEnabled?: boolean;
  taxLabel?: string;
  taxPct?: number;
  serviceEnabled?: boolean;
  serviceLabel?: string;
  servicePct?: number;
  serviceFixed?: number;
  showBreakdown?: boolean;
}

export interface PriceBreakdown {
  base: number;      // the package price the admin set
  tax: number;       // tax amount
  service: number;   // service charge amount
  payable: number;   // what the user actually pays
  taxLabel: string;
  serviceLabel: string;
  taxPct: number;
  servicePct: number;
  serviceFixed: number;
  hasExtras: boolean; // true when anything is added on top of the base price
}

/** Round to 2 decimals without floating-point noise (0.1 + 0.2 problems). */
const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Work out what a package actually costs.
 * Tax and the service charge are both calculated on the BASE price (they are not
 * compounded on each other), which is how VAT + a flat handling fee normally work.
 */
export function priceBreakdown(base: number, fees: CoinFees | undefined): PriceBreakdown {
  const f = fees ?? {};
  const safeBase = Math.max(0, Number(base) || 0);
  const taxPct = f.taxEnabled ? Math.max(0, Math.min(100, f.taxPct ?? 0)) : 0;
  const servicePct = f.serviceEnabled ? Math.max(0, Math.min(100, f.servicePct ?? 0)) : 0;
  const serviceFixed = f.serviceEnabled ? Math.max(0, f.serviceFixed ?? 0) : 0;
  const tax = money((safeBase * taxPct) / 100);
  const service = money((safeBase * servicePct) / 100 + serviceFixed);
  const payable = money(safeBase + tax + service);
  return {
    base: money(safeBase),
    tax,
    service,
    payable,
    taxLabel: f.taxLabel?.trim() || "Tax",
    serviceLabel: f.serviceLabel?.trim() || "Service charge",
    taxPct,
    servicePct,
    serviceFixed,
    hasExtras: tax > 0 || service > 0,
  };
}

/** Format an amount with the admin's currency symbol. */
export function fmtMoney(amount: number, currency: string): string {
  const n = Math.round((amount + Number.EPSILON) * 100) / 100;
  const s = Number.isInteger(n) ? n.toLocaleString("en-SA") : n.toLocaleString("en-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency}${s}`;
}
