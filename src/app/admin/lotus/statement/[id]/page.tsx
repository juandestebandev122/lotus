"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { useConfig } from "@/lib/config";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { downloadCsv, downloadExcel, printPage } from "@/lib/statement-export";
import { Flower2, ArrowLeft, FileSpreadsheet, FileText, Printer, Download, Loader2, Wallet, TrendingUp, TrendingDown, Banknote } from "lucide-react";

// Mirrors the server LotusBreakdown shape (see repo.ts userLotusBreakdown).
type HistoryRow = { at: string; kind: "earn" | "spend" | "withdraw"; source: string; amount: number; balanceAfter?: number; description: string };
interface Breakdown {
  found: boolean; userId?: string; name?: string; username?: string; publicId?: string; lotusName: string; joinedAt?: string;
  balance: number; earned: number; spent: number; withdrawn: number;
  bySource: { source: string; amount: number; count: number }[];
  recent: { at: string; source: string; amount: number; description: string }[];
  history: HistoryRow[]; historyTruncated: boolean;
}

const nfmt = (n: number) => (Math.round((n ?? 0) * 100) / 100).toLocaleString("en-SA", { maximumFractionDigits: 2 });
const fmtFull = (iso: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const fmtDay = (iso: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const KIND_LABEL: Record<HistoryRow["kind"], string> = { earn: "Earned", spend: "Spent", withdraw: "Withdrawn" };

export default function LotusStatementPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { config } = useConfig();
  const [bd, setBd] = useState<Breakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const lotusName = bd?.lotusName || config.lotus?.name || "Lotus";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(withBase(`/api/admin/lotus?user=${encodeURIComponent(id)}`), { credentials: "include", cache: "no-store" });
      const d = await r.json();
      setBd((d?.breakdown as Breakdown) ?? { found: false } as Breakdown);
    } catch { toast("Could not load the statement", "error"); setBd({ found: false } as Breakdown); }
    setLoading(false);
  }, [id, toast]);
  useEffect(() => { load(); }, [load]);

  // Export data — Date · Type · Source · Amount(signed) · Balance After · Description.
  const exportRows = (): (string | number)[][] =>
    (bd?.history ?? []).map((h) => [fmtFull(h.at), KIND_LABEL[h.kind], h.source, h.amount, h.balanceAfter ?? "", h.description]);
  const EXPORT_HEADERS = ["Date & time", "Type", "Source", `Amount (${lotusName})`, `Balance after (${lotusName})`, "Description"];
  const stamp = () => new Date().toISOString().slice(0, 10);
  const baseName = () => `lotus-statement-${(bd?.publicId || bd?.username || bd?.name || "user").replace(/[^a-z0-9]+/gi, "-")}-${stamp()}`;
  const doCsv = () => { if (bd?.history?.length) { downloadCsv(baseName(), EXPORT_HEADERS, exportRows()); toast("CSV downloaded", "success"); } else toast("No transactions to export", "info"); };
  const doExcel = () => { if (bd?.history?.length) { downloadExcel(baseName(), `${lotusName} statement`, EXPORT_HEADERS, exportRows()); toast("Excel downloaded", "success"); } else toast("No transactions to export", "info"); };
  const doPdf = () => { toast("In the print box, choose “Save as PDF” as the printer.", "info"); setTimeout(printPage, 400); };

  if (loading) return <div className="grid h-[60vh] place-items-center text-mist-400"><Loader2 className="size-6 animate-spin" /></div>;
  if (!bd || !bd.found) return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="text-sm text-mist-400">This member&rsquo;s {lotusName} statement could not be found.</p>
      <a href={withBase("/admin/lotus")} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-lotus-300 hover:text-lotus-200"><ArrowLeft className="size-4" /> Back to Lotus economy</a>
    </div>
  );

  const net = bd.balance;
  const periodFrom = bd.joinedAt || bd.history[0]?.at || "";

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-16">
      {/* Print isolation — only the statement prints; the admin shell is hidden. */}
      <style>{`@media print { body * { visibility: hidden !important; } #lotus-statement, #lotus-statement * { visibility: visible !important; } #lotus-statement { position: absolute; left: 0; top: 0; width: 100%; padding: 0; } .no-print { display: none !important; } #lotus-statement .print-border { border-color: #ddd !important; } #lotus-statement * { color: #111 !important; background: transparent !important; box-shadow: none !important; } }`}</style>

      {/* Toolbar (not printed) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <a href={withBase("/admin/lotus")} className="inline-flex items-center gap-1.5 text-sm font-semibold text-mist-300 transition hover:text-mist-100"><ArrowLeft className="size-4" /> Back to Lotus economy</a>
        <div className="flex flex-wrap items-center gap-2">
          <ExportBtn icon={FileText} label="CSV" onClick={doCsv} />
          <ExportBtn icon={FileSpreadsheet} label="Excel" onClick={doExcel} />
          <ExportBtn icon={Download} label="PDF" onClick={doPdf} />
          <ExportBtn icon={Printer} label="Print" onClick={printPage} />
        </div>
      </div>

      <div id="lotus-statement" className="space-y-4">
        {/* Header / user details */}
        <Card className="print-border p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><Flower2 className="size-6 text-lotus-300" /> {lotusName} statement</h1>
              <div className="mt-1 text-sm text-mist-300">{bd.name}{bd.username ? ` · @${bd.username}` : ""}</div>
              <div className="mt-0.5 grid gap-x-6 gap-y-0.5 text-xs text-mist-500 sm:grid-cols-2">
                {bd.publicId && <span>Member ID: <b className="font-mono text-mist-300">{bd.publicId}</b></span>}
                <span>User ID: <b className="font-mono text-mist-300">{bd.userId}</b></span>
                <span>Registered: <b className="text-mist-300">{fmtDay(bd.joinedAt || "")}</b></span>
                <span>Statement period: <b className="text-mist-300">{fmtDay(periodFrom)} → {fmtDay(new Date().toISOString())}</b></span>
              </div>
            </div>
            <div className="rounded-xl border border-lotus-400/30 bg-lotus-500/[0.08] px-4 py-3 text-right">
              <div className="text-[10px] uppercase tracking-wide text-lotus-300/80">Current balance</div>
              <div className="font-display text-2xl font-extrabold text-lotus-200">{nfmt(net)}</div>
              <div className="text-[10px] text-mist-500">{lotusName}</div>
            </div>
          </div>
        </Card>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Summary icon={Wallet} tone="text-lotus-200" ring="border-lotus-400/30 bg-lotus-500/[0.06]" label="Current balance" value={nfmt(bd.balance)} name={lotusName} />
          <Summary icon={TrendingUp} tone="text-emerald-200" ring="border-emerald-500/25 bg-emerald-500/[0.06]" label="Total earned" value={nfmt(bd.earned)} name={lotusName} />
          <Summary icon={TrendingDown} tone="text-rose-200" ring="border-rose-500/25 bg-rose-500/[0.06]" label="Total used / spent" value={nfmt(bd.spent)} name={lotusName} />
          <Summary icon={Banknote} tone="text-amber-200" ring="border-amber-500/25 bg-amber-500/[0.06]" label="Total withdrawn" value={nfmt(bd.withdrawn)} name={lotusName} />
        </div>

        {/* Earned by source */}
        {bd.bySource.length > 0 && (
          <Card className="print-border p-5">
            <h2 className="mb-3 text-sm font-bold text-mist-100">Earned by source</h2>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {bd.bySource.map((s) => {
                const pct = bd.earned > 0 ? Math.round((s.amount / bd.earned) * 100) : 0;
                return (
                  <div key={s.source} className="rounded-lg border border-line bg-ink-800/50 p-2.5 print-border">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-mist-100">{s.source} <span className="text-[10px] text-mist-500">×{s.count}</span></span>
                      <span className="font-bold text-lotus-200">{nfmt(s.amount)} <span className="text-[10px] text-mist-500">{pct}%</span></span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-lotus-500/70" style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Complete history table */}
        <Card className="print-border overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-5 py-3 print-border">
            <h2 className="text-sm font-bold text-mist-100">Complete {lotusName} history</h2>
            <span className="text-xs text-mist-500">{bd.history.length} transaction{bd.history.length === 1 ? "" : "s"}{bd.historyTruncated ? " (most recent 3,000 shown)" : ""}</span>
          </div>
          {bd.history.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-mist-500">No {lotusName} transactions recorded for this member.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wide text-mist-500">
                  <tr>
                    <th className="px-4 py-2 font-semibold">#</th>
                    <th className="px-4 py-2 font-semibold">Date &amp; time</th>
                    <th className="px-4 py-2 font-semibold">Type</th>
                    <th className="px-4 py-2 font-semibold">Source</th>
                    <th className="px-4 py-2 font-semibold">Description</th>
                    <th className="px-4 py-2 text-right font-semibold">Amount</th>
                    <th className="px-4 py-2 text-right font-semibold">Balance after</th>
                  </tr>
                </thead>
                <tbody>
                  {/* newest first for reading; export keeps chronological order */}
                  {[...bd.history].reverse().map((h, i) => (
                    <tr key={i} className="border-t border-white/5 print-border">
                      <td className="px-4 py-2 text-mist-600">{bd.history.length - i}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-mist-400">{fmtFull(h.at)}</td>
                      <td className="px-4 py-2">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", h.kind === "earn" ? "bg-emerald-500/15 text-emerald-300" : h.kind === "withdraw" ? "bg-amber-500/15 text-amber-300" : "bg-rose-500/15 text-rose-300")}>{KIND_LABEL[h.kind]}</span>
                      </td>
                      <td className="px-4 py-2 text-mist-300">{h.source}</td>
                      <td className="max-w-[320px] truncate px-4 py-2 text-mist-400" title={h.description}>{h.description}</td>
                      <td className={cn("whitespace-nowrap px-4 py-2 text-right font-bold tabular-nums", h.amount >= 0 ? "text-emerald-300" : "text-rose-300")}>{h.amount >= 0 ? "+" : "−"}{nfmt(Math.abs(h.amount))}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-mist-400">{h.balanceAfter == null ? "—" : nfmt(h.balanceAfter)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <p className="px-1 text-[10px] text-mist-500">Generated {fmtFull(new Date().toISOString())} · Lotus Ludo admin · figures in {lotusName}. Total earned can exceed the current balance — the difference is what the member has spent or withdrawn.</p>
      </div>
    </div>
  );
}

function Summary({ icon: Icon, tone, ring, label, value, name }: { icon: typeof Wallet; tone: string; ring: string; label: string; value: string; name: string }) {
  return (
    <div className={cn("rounded-xl border p-4 print-border", ring)}>
      <div className="flex items-center gap-1.5 text-[11px] text-mist-400"><Icon className={cn("size-3.5", tone)} /> {label}</div>
      <div className={cn("mt-1 font-display text-xl font-extrabold", tone)}>{value}</div>
      <div className="text-[10px] text-mist-500">{name}</div>
    </div>
  );
}

function ExportBtn({ icon: Icon, label, onClick }: { icon: typeof FileText; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-3 py-1.5 text-xs font-semibold text-mist-200 transition hover:border-lotus-400/40 hover:bg-lotus-500/[0.08] hover:text-mist-100">
      <Icon className="size-4 text-lotus-300" /> {label}
    </button>
  );
}
