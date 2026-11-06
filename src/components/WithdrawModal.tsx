"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { requestWithdrawal } from "@/lib/wallet";
import { WITHDRAW_METHODS } from "@/lib/withdraw";
import { useConfig } from "@/lib/config";
import { cn } from "@/lib/cn";
import { X, Banknote, ShieldCheck } from "lucide-react";

// Shared "Withdraw money" sheet — used in the user wallet and admin panel. All
// rates / fees / limits are read from the admin config. When the Lotus economy is
// ON, withdrawals are made from the user's Lotus Flowers (coins can't be withdrawn
// directly); otherwise from coins. `lotusBalance` is the user's Lotus balance.
export function WithdrawModal({ balance, lotusBalance = 0, onClose, onDone }: { balance: number; lotusBalance?: number; onClose: () => void; onDone: (newBalance?: number) => void }) {
  const { toast } = useToast();
  const { config } = useConfig();
  const lotusOn = !!config.lotus?.enabled;
  const lc = config.lotus ?? { enabled: false, name: "Lotus Flower", coinToLotus: 1, lotusToCurrency: 0.1, currency: "SAR", minWithdraw: 100, maxWithdraw: 100000, dailyLimit: 0, feePct: 0, autoApprove: false };
  const wc = config.withdraw ?? { coinsPerUnit: 10, currency: "SAR", feePct: 0, minCoins: 1000, maxCoins: 100000, autoApprove: false };

  // One view-model for either currency, so the JSX stays the same in both modes.
  const vm = lotusOn
    ? { unit: lc.name, bal: lotusBalance, min: lc.minWithdraw, max: lc.maxWithdraw, cur: lc.currency, feePct: lc.feePct, auto: lc.autoApprove, kind: "lotus" as const, rateLabel: `1 ${lc.name} = ${lc.currency} ${lc.lotusToCurrency}` }
    : { unit: "coins", bal: balance, min: wc.minCoins, max: wc.maxCoins, cur: wc.currency, feePct: wc.feePct, auto: wc.autoApprove, kind: "coins" as const, rateLabel: `${Math.max(1, wc.coinsPerUnit || 1)} coins = ${wc.currency} 1` };

  const [amount, setAmount] = useState(vm.min);
  const [method, setMethod] = useState<string>(WITHDRAW_METHODS[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const field = "mt-1 h-11 w-full rounded-xl border border-line bg-ink-900 px-3.5 text-sm text-mist-100 outline-none focus:border-lotus-400";

  const detailLabel = method === "STC Pay" ? "STC Pay number" : method === "PayPal" ? "PayPal email" : "Bank account / IBAN";

  // Admin conversion slabs — quick-pick amounts with exact admin-defined payouts.
  const tiers = lotusOn ? (config.lotus?.conversionTiers ?? []).filter((t) => t.enabled && t.lotus > 0).sort((a, b) => a.lotus - b.lotus) : [];
  const slab = lotusOn ? tiers.find((t) => t.lotus === amount) : undefined;
  // amount → cash: slab value when the amount matches an enabled slab exactly, else
  // Lotus × per-Lotus value, or coins ÷ coins-per-unit; minus GST + fee.
  const gross = slab ? Math.round(slab.value * 100) / 100 : lotusOn ? Math.round(amount * Math.max(0, lc.lotusToCurrency) * 100) / 100 : Math.round((amount / Math.max(1, wc.coinsPerUnit || 1)) * 100) / 100;
  const gstPct = lotusOn ? Math.max(0, Math.min(100, lc.gstPct ?? 0)) : 0;
  const gst = Math.round(gross * (gstPct / 100) * 100) / 100;
  const fee = Math.round(gross * (Math.max(0, Math.min(100, vm.feePct)) / 100) * 100) / 100;
  const net = Math.round((gross - gst - fee) * 100) / 100;
  const fmt = (n: number) => `${vm.cur} ${n.toLocaleString("en-SA", { maximumFractionDigits: 2 })}`;

  const submit = async () => {
    if (amount < vm.min) return toast(`Minimum is ${vm.min.toLocaleString("en-SA")} ${vm.unit}`, "error");
    if (vm.max > 0 && amount > vm.max) return toast(`Maximum is ${vm.max.toLocaleString("en-SA")} ${vm.unit}`, "error");
    if (amount > vm.bal) return toast(`You don't have that many ${vm.unit}`, "error");
    if (!details.trim()) return toast(`Enter your ${detailLabel}`, "error");
    setBusy(true);
    const res = await requestWithdrawal(amount, method, details.trim(), vm.kind);
    setBusy(false);
    if (res.ok) { toast(vm.auto ? "Withdrawal auto-approved — being processed" : "Withdrawal request submitted", "success"); onDone(res.balance); }
    else toast(res.error ?? "Could not submit withdrawal", "error");
  };

  return (
    <div className="fixed inset-0 z-[130] grid place-items-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-sm rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Banknote className="size-5 text-emerald-300" /> Withdraw money</h2>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>

        <p className="text-xs text-mist-400">Available balance: <span className="font-semibold text-gold-300">{vm.bal.toLocaleString("en-SA")} {vm.unit}</span></p>
        {lotusOn && <p className="mt-1 text-[11px] text-lotus-300">Withdrawals are made from your {lc.name} earnings (from gifts you received).</p>}

        <label className="mt-3 block text-xs font-semibold text-mist-300">{vm.unit.charAt(0).toUpperCase() + vm.unit.slice(1)} to withdraw</label>
        <input type="number" min={vm.min} step={lotusOn ? 10 : 100} value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))} className={field} />
        {/* Admin-defined slab quick-picks — tap to withdraw that exact amount. */}
        {tiers.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tiers.map((t) => (
              <button key={t.id} type="button" onClick={() => setAmount(t.lotus)} disabled={t.lotus > vm.bal}
                className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
                  amount === t.lotus ? "border-lotus-400 bg-lotus-500/20 text-lotus-100"
                  : t.lotus > vm.bal ? "cursor-not-allowed border-white/8 bg-ink-900 text-mist-600"
                  : "border-line bg-ink-900 text-mist-300 hover:border-lotus-400/50")}>
                {t.lotus.toLocaleString("en-SA")} → {vm.cur} {t.value.toLocaleString("en-SA")}
              </button>
            ))}
          </div>
        )}
        <div className="mt-1.5 rounded-lg border border-white/8 bg-ink-900/50 px-3 py-2 text-xs">
          <div className="flex items-center justify-between"><span className="text-mist-400">Amount ({slab ? `slab: ${slab.lotus.toLocaleString("en-SA")} ${lc.name} = ${vm.cur} ${slab.value.toLocaleString("en-SA")}` : vm.rateLabel})</span><span className="text-mist-200">{fmt(gross)}</span></div>
          {gstPct > 0 && <div className="flex items-center justify-between"><span className="text-mist-400">GST ({gstPct}%)</span><span className="text-rose-300">− {fmt(gst)}</span></div>}
          {vm.feePct > 0 && <div className="flex items-center justify-between"><span className="text-mist-400">Service fee ({vm.feePct}%)</span><span className="text-rose-300">− {fmt(fee)}</span></div>}
          <div className="mt-1 flex items-center justify-between border-t border-white/8 pt-1"><span className="font-semibold text-mist-200">You receive</span><span className="font-bold text-emerald-300">{fmt(net)}</span></div>
        </div>
        <p className="mt-1 text-[11px] text-mist-500">Min {vm.min.toLocaleString("en-SA")} {vm.unit}{vm.max > 0 ? ` · max ${vm.max.toLocaleString("en-SA")} ${vm.unit}` : ""}{lotusOn && lc.dailyLimit > 0 ? ` · daily limit ${lc.dailyLimit.toLocaleString("en-SA")}` : ""}</p>

        <label className="mt-3 block text-xs font-semibold text-mist-300">Payout method</label>
        <select value={method} onChange={(e) => { setMethod(e.target.value); setDetails(""); }} className={cn(field, "appearance-none")}>
          {WITHDRAW_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>

        <label className="mt-3 block text-xs font-semibold text-mist-300">{detailLabel}</label>
        <input value={details} onChange={(e) => setDetails(e.target.value)} placeholder={detailLabel} className={field} />

        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-mist-500"><ShieldCheck className="size-3.5 text-emerald-300" /> Your {vm.unit} are held while the request is reviewed. Rejected requests are refunded automatically.</p>
        <Button block size="lg" className="mt-4" onClick={submit} disabled={busy}>
          <Banknote className="size-4" /> {busy ? "Submitting…" : `Withdraw ${fmt(net)}`}
        </Button>
      </div>
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300",
  approved: "bg-sky-500/15 text-sky-300",
  completed: "bg-emerald-500/15 text-emerald-300",
  rejected: "bg-rose-500/15 text-rose-300",
};
export function WithdrawStatusPill({ status }: { status: string }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", STATUS_TONE[status] ?? "bg-white/10 text-mist-300")}>{status}</span>;
}
