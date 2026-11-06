"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { WITHDRAW_METHODS } from "@/lib/withdraw";
import { Banknote, X, Loader2, History } from "lucide-react";

export interface ProfitPayout { id: string; at: string; pool: string; agencyId?: string; agencyName?: string; amount: number; method: string; details?: string; note?: string; by: string; balanceAfter: number }

// Reusable "Withdraw / Pay out" control for a profit pool (Company / Agency).
// Deducts the amount from the pool and records an auditable payout. Also shows
// the recent payout history for the pool.
export function ProfitPayoutButton({ pool, agencyId, balance, unit = "🪙", onDone }: {
  pool: "company" | "agency";
  agencyId?: string;
  balance: number;
  unit?: string;
  onDone?: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>(WITHDRAW_METHODS[0]);
  const [details, setDetails] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [payouts, setPayouts] = useState<ProfitPayout[]>([]);

  const loadHistory = () => {
    const qs = new URLSearchParams({ pool });
    if (agencyId) qs.set("agencyId", agencyId);
    fetch(withBase(`/api/admin/profit-payout?${qs}`), { credentials: "include", cache: "no-store" })
      .then((r) => r.json()).then((d) => setPayouts(d.payouts ?? [])).catch(() => {});
  };
  useEffect(() => { if (open) loadHistory(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    const amt = Math.max(0, Number(amount) || 0);
    if (amt <= 0) return toast("Enter a valid amount", "error");
    if (amt > balance) return toast("Amount exceeds the available balance", "error");
    if (!details.trim()) return toast("Enter the payout account / reference", "error");
    setBusy(true);
    const res = await fetch(withBase("/api/admin/profit-payout"), {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pool, agencyId, amount: amt, method, details: details.trim(), note: note.trim() || undefined }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { toast(`Payout of ${amt.toLocaleString("en-SA")} recorded — balance now ${(d.balance ?? 0).toLocaleString("en-SA")}`, "success"); setOpen(false); setAmount(""); setDetails(""); setNote(""); onDone?.(); }
    else toast(d.error ?? "Payout failed", "error");
  };

  const field = "mt-1 h-11 w-full rounded-xl border border-line bg-ink-900 px-3.5 text-sm text-mist-100 outline-none focus:border-lotus-400";

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><Banknote className="size-4" /> Withdraw / Pay out</Button>
      {open && (
        <div className="fixed inset-0 z-[130] grid place-items-center overflow-y-auto bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div className="my-8 w-full max-w-md rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Banknote className="size-5 text-emerald-300" /> {pool === "agency" ? "Agency" : "Company"} profit payout</h2>
              <button onClick={() => setOpen(false)} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
            </div>
            <p className="text-xs text-mist-400">Available balance: <span className="font-semibold text-gold-300">{unit} {balance.toLocaleString("en-SA")}</span></p>

            <label className="mt-3 block text-xs font-semibold text-mist-300">Amount to withdraw</label>
            <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(balance)} className={field} />

            <label className="mt-3 block text-xs font-semibold text-mist-300">Payout method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={cn(field, "appearance-none")}>
              {WITHDRAW_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>

            <label className="mt-3 block text-xs font-semibold text-mist-300">Account / reference</label>
            <input value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Bank account / IBAN / UPI / txn ref" className={field} />

            <label className="mt-3 block text-xs font-semibold text-mist-300">Note (optional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. monthly settlement" className={field} />

            <p className="mt-3 text-[11px] text-mist-500">This deducts the amount from the {pool} profit balance and records a permanent payout entry. It does not move real money — record it after you actually pay out.</p>
            <Button block size="lg" className="mt-3" onClick={submit} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Banknote className="size-4" />} Record payout</Button>

            {payouts.length > 0 && (
              <div className="mt-4">
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-mist-500"><History className="size-3.5" /> Recent payouts</p>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {payouts.slice(0, 20).map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg bg-ink-800/60 px-3 py-1.5 text-[11px]">
                      <span className="text-mist-300">{new Date(p.at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · {p.method}{p.note ? ` · ${p.note}` : ""}</span>
                      <span className="font-semibold text-rose-300">−{p.amount.toLocaleString("en-SA")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
