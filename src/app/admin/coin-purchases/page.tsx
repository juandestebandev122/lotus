"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { fetchCoinPurchases, decideCoinPurchase, type CoinPurchase } from "@/lib/coin-purchase";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { ReportFilters, matchesReportFilter, emptyReportFilter, type ReportFilter } from "@/components/admin/ReportFilters";
import { Check, X, Coins, Gift, ExternalLink, Clock } from "lucide-react";

const STATUS_STYLE: Record<CoinPurchase["status"], string> = {
  pending: "bg-amber-500/15 text-amber-300",
  approved: "bg-emerald-500/15 text-emerald-300",
  rejected: "bg-rose-500/15 text-rose-300",
};

export default function AdminCoinPurchasesPage() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<CoinPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [repFilter, setRepFilter] = useState<ReportFilter>(emptyReportFilter);
  const [busy, setBusy] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const load = useCallback(async () => { setRequests(await fetchCoinPurchases()); setLoading(false); }, []);
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);

  const decide = async (id: string, approve: boolean) => {
    setBusy(id);
    const res = await decideCoinPurchase(id, approve);
    setBusy("");
    if (res.ok) { toast(approve ? "Approved — coins credited" : "Rejected", "success"); load(); }
    else toast(res.error ?? "Could not update", "error");
  };

  const shown = requests
    .filter((r) => (filter === "pending" ? r.status === "pending" : true))
    .filter((r) => matchesReportFilter(repFilter, r.at, `${r.userName} ${r.userIdNumber ?? ""} ${r.packageName}`));
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-mist-100">Coin Purchases</h1>
          <p className="text-sm text-mist-400">Verify QR/UPI payments. Approving credits the coins (+ bonus) to the user&apos;s wallet automatically.</p>
        </div>
        <div className="flex gap-1.5 rounded-xl bg-ink-800 p-1">
          {(["pending", "all"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition", filter === f ? "bg-lotus-500/25 text-white" : "text-mist-400 hover:text-mist-100")}>
              {f === "pending" ? `Pending (${pendingCount})` : "Payment history"}
            </button>
          ))}
        </div>
      </div>

      {/* Filter by user / date / month / year / range */}
      <ReportFilters value={repFilter} onChange={setRepFilter} />

      {loading ? (
        <p className="py-10 text-center text-sm text-mist-400">Loading…</p>
      ) : shown.length === 0 ? (
        <Card className="p-10 text-center text-sm text-mist-400">{filter === "pending" ? "No payments match this filter." : "No purchases match this filter."}</Card>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => (
            <Card key={r.id} className="flex flex-wrap items-center gap-3 p-4">
              {/* Screenshot thumb */}
              {r.screenshotUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={withBase(r.screenshotUrl)} alt="proof" onClick={() => setPreview(withBase(r.screenshotUrl!))} className="size-14 shrink-0 cursor-pointer rounded-lg border border-white/10 object-cover" />
              ) : (
                <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-ink-800 text-mist-600"><Coins className="size-6" /></span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-mist-100">
                  <Link href={`/admin/users?q=${encodeURIComponent(r.userIdNumber || r.userId || r.userName)}`} className="hover:underline hover:text-lotus-300">{r.userName}{r.userIdNumber ? <span className="ml-1.5 font-mono text-xs font-bold text-lotus-300">ID {r.userIdNumber}</span> : null}</Link> · {r.packageName}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-mist-500">
                  <span className="inline-flex items-center gap-1 text-emerald-300"><Coins className="size-3" /> {(r.coins + (r.bonus ?? 0)).toLocaleString()} coins</span>
                  {r.bonus ? <span className="inline-flex items-center gap-0.5 text-emerald-300/80"><Gift className="size-3" /> incl. {r.bonus} bonus</span> : null}
                  <span className="font-semibold text-gold-300">{r.currency}{r.price}</span>
                  {/* What the total is made up of, so the admin can match the payment
                      screenshot exactly. Only shown when extras were charged. */}
                  {(r.tax || r.serviceCharge) ? (
                    <span className="text-mist-500">
                      ({r.currency}{r.basePrice ?? r.price}
                      {r.tax ? ` + ${r.taxLabel ?? "Tax"} ${r.currency}${r.tax}` : ""}
                      {r.serviceCharge ? ` + ${r.serviceLabel ?? "Service"} ${r.currency}${r.serviceCharge}` : ""})
                    </span>
                  ) : null}
                  {r.paymentRef && <span>Ref: {r.paymentRef}</span>}
                  <span>{new Date(r.at).toLocaleString()}</span>
                </p>
                {r.screenshotUrl && <a href={withBase(r.screenshotUrl)} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-lotus-300 hover:underline"><ExternalLink className="size-3" /> View payment screenshot</a>}
                {r.status !== "pending" && <p className="mt-0.5 text-[11px] text-mist-500">{r.status} {r.decidedBy ? `by ${r.decidedBy}` : ""}{r.note ? ` — ${r.note}` : ""}</p>}
              </div>
              {r.status === "pending" ? (
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => decide(r.id, false)} disabled={busy === r.id}><X className="size-4" /> Reject</Button>
                  <Button size="sm" onClick={() => decide(r.id, true)} disabled={busy === r.id}><Check className="size-4" /> Approve</Button>
                </div>
              ) : (
                <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold capitalize", STATUS_STYLE[r.status])}>
                  {r.status === "approved" ? <Check className="size-3" /> : r.status === "rejected" ? <X className="size-3" /> : <Clock className="size-3" />} {r.status}
                </span>
              )}
            </Card>
          ))}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-[200] grid place-items-center bg-black/80 p-4" onClick={() => setPreview(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Payment proof" className="max-h-[85vh] max-w-full rounded-xl" />
        </div>
      )}
    </div>
  );
}
