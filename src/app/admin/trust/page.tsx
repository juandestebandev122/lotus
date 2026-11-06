"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { withBase } from "@/lib/base-path";
import { useConfig, saveConfig } from "@/lib/config";
import { HandCoins, Wallet, TrendingUp, Loader2, Save, Download, Printer, Power, Search, ArrowDownCircle, ArrowUpCircle } from "lucide-react";

interface TrustEntry { id: string; at: string; type: "credit" | "debit"; lotus: number; source: string; userName?: string; note?: string }
interface Report {
  enabled: boolean; sharePct: number; name: string; currency: string;
  balance: number; totalIncome: number; totalSpent: number;
  today: number; weekly: number; monthly: number; yearly: number;
  bySource: { source: string; lotus: number; count: number }[];
  last7: { day: string; lotus: number }[];
  entries: TrustEntry[]; totalCount: number;
}

const num = (n: number) => (n ?? 0).toLocaleString("en-SA", { maximumFractionDigits: 2 });

export default function AdminTrustPage() {
  const { toast } = useToast();
  const { config, reload } = useConfig();
  const [rep, setRep] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [q, setQ] = useState(""); const [source, setSource] = useState("all"); const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [pct, setPct] = useState(5);
  // manual adjust
  const [adjType, setAdjType] = useState<"credit" | "debit">("credit");
  const [adjAmt, setAdjAmt] = useState(0); const [adjNote, setAdjNote] = useState(""); const [adjUser, setAdjUser] = useState("");

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q); if (source !== "all") qs.set("source", source); if (from) qs.set("from", from); if (to) qs.set("to", to);
    try { const res = await fetch(withBase(`/api/admin/trust?${qs}`), { credentials: "include", cache: "no-store" }); const d = await res.json().catch(() => ({})); setRep(d.report ?? null); } catch { /* ignore */ }
    setLoading(false);
  }, [q, source, from, to]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (config.lotus) setPct(config.lotus.trustSharePct ?? 5); }, [config.lotus]);

  const enabled = config.lotus?.trustEnabled !== false;
  const name = rep?.name || config.lotus?.name || "Lotus";
  const cur = rep?.currency || "SAR";

  const toggleEnabled = async () => {
    setBusy("toggle");
    const res = await saveConfig({ lotus: { ...(config.lotus ?? {} as NonNullable<typeof config.lotus>), trustEnabled: !enabled } });
    setBusy("");
    if (res.ok) { toast(`Trust Share turned ${!enabled ? "ON" : "OFF"}`, "success"); reload(); load(); } else toast(res.error ?? "Failed", "error");
  };
  const savePct = async () => {
    setBusy("pct");
    const res = await saveConfig({ lotus: { ...(config.lotus ?? {} as NonNullable<typeof config.lotus>), trustSharePct: pct } });
    setBusy("");
    if (res.ok) { toast("Trust Share % saved", "success"); reload(); } else toast(res.error ?? "Failed", "error");
  };
  const submitAdjust = async () => {
    if (adjAmt <= 0) return toast("Enter a valid amount", "error");
    if (!adjNote.trim()) return toast("Enter a reason / note", "error");
    setBusy("adjust");
    const res = await fetch(withBase("/api/admin/trust"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: adjType, lotus: adjAmt, note: adjNote.trim(), targetUserId: adjType === "debit" && adjUser.trim() ? adjUser.trim() : undefined }) });
    setBusy("");
    const d = await res.json().catch(() => ({}));
    if (res.ok) { toast(`Trust Wallet ${adjType}ed ${num(adjAmt)} ${name}`, "success"); setAdjAmt(0); setAdjNote(""); setAdjUser(""); load(); } else toast((d as { error?: string }).error ?? "Failed", "error");
  };

  const exportCsv = () => {
    if (!rep) return;
    const rows = [["Reference", "Date & Time", "Type", `${name} amount`, "Source", "User", "Note"], ...rep.entries.map((e) => [e.id, new Date(e.at).toLocaleString("en-GB"), e.type, String(e.lotus), e.source, e.userName ?? "", (e.note ?? "").replace(/[\r\n,]+/g, " ")])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `trust-statement-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const maxDay = Math.max(1, ...(rep?.last7 ?? []).map((d) => d.lotus));
  const fld = "h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><HandCoins className="size-6 text-amber-300" /> Trust Management</h1>
          <p className="mt-1 text-sm text-mist-400">The Trust Fund grows from a {rep?.sharePct ?? pct}% share of every coin transaction (gifts, calls, rooms, games, referrals, Lucky Spin). Spend it on reward campaigns, festival &amp; lucky-spin bonuses, and promotions.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={exportCsv}><Download className="size-4" /> CSV / Excel</Button>
          <Button size="sm" variant="secondary" onClick={() => window.print()}><Printer className="size-4" /> Print / PDF</Button>
        </div>
      </div>

      {/* Settings: enable + share % */}
      <Card className={cn("flex flex-wrap items-center justify-between gap-3 p-4", enabled ? "border-emerald-400/25" : "border-amber-400/25")}>
        <div className="flex items-center gap-3">
          <button onClick={toggleEnabled} disabled={busy === "toggle"} className={cn("inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition", enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-white/[0.06] text-mist-400")}>
            {busy === "toggle" ? <Loader2 className="size-4 animate-spin" /> : <Power className="size-4" />} Trust Share {enabled ? "ON" : "OFF"}
          </button>
          <span className="text-xs text-mist-400">{enabled ? "A share of every transaction flows to the Trust Fund." : "OFF — the Trust slice rolls into Company revenue."}</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-mist-400">Trust Share %</label>
          <input type="number" min={0} max={100} value={pct} onChange={(e) => setPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} className="h-9 w-20 rounded-lg border border-line bg-ink-800 px-3 text-sm font-bold text-mist-100 outline-none focus:border-lotus-400" />
          <Button size="sm" onClick={savePct} disabled={busy === "pct"}>{busy === "pct" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save</Button>
          <Link href="/admin/share-distribution" className="text-[11px] text-lotus-300 hover:text-lotus-200">Full split →</Link>
        </div>
      </Card>

      {loading ? <div className="grid h-24 place-items-center text-mist-400"><Loader2 className="size-5 animate-spin" /></div> : rep && (
        <>
          {/* Dashboard */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Trust Wallet balance" value={`${num(rep.balance)} ${name}`} tone="text-amber-300" icon={Wallet} big />
            <Stat label="Total income" value={`${num(rep.totalIncome)} ${name}`} tone="text-emerald-300" icon={TrendingUp} big />
            <Stat label="Total spent" value={`${num(rep.totalSpent)} ${name}`} tone="text-rose-300" icon={ArrowUpCircle} big />
            <Stat label="Share rate" value={`${rep.sharePct}%`} tone="text-lotus-300" icon={HandCoins} big />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat label="Today" value={`${num(rep.today)}`} tone="text-sky-300" />
            <Stat label="This week" value={`${num(rep.weekly)}`} tone="text-sky-300" />
            <Stat label="This month" value={`${num(rep.monthly)}`} tone="text-sky-300" />
            <Stat label="This year" value={`${num(rep.yearly)}`} tone="text-sky-300" />
            <Stat label="All-time income" value={`${num(rep.totalIncome)}`} tone="text-emerald-300" />
          </div>

          {/* Last-7-day chart + by source */}
          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-bold text-mist-100">Trust income — last 7 days</h2>
              <div className="flex h-32 items-end gap-2">
                {rep.last7.map((d, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex w-full flex-1 items-end"><div className="w-full rounded-t bg-gradient-to-t from-amber-500/40 to-amber-300" style={{ height: `${(d.lotus / maxDay) * 100}%`, minHeight: d.lotus > 0 ? 4 : 0 }} title={`${num(d.lotus)} ${name}`} /></div>
                    <span className="text-[10px] text-mist-500">{d.day}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-bold text-mist-100">Income by source</h2>
              {rep.bySource.length === 0 ? <p className="text-sm text-mist-500">No Trust income yet.</p> : (
                <div className="space-y-1.5">
                  {rep.bySource.map((s) => (
                    <div key={s.source} className="flex items-center gap-3 rounded-lg border border-line bg-ink-800/50 px-3 py-1.5">
                      <span className="flex-1 truncate text-sm capitalize text-mist-200">{s.source.replace(/_/g, " ")} <span className="text-[10px] text-mist-500">({s.count})</span></span>
                      <span className="text-sm font-bold text-amber-200">{num(s.lotus)} {name}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Manual credit / debit */}
          <Card className="p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-mist-100"><ArrowDownCircle className="size-4 text-amber-300" /> Manual credit / debit</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div><label className="mb-1 block text-[11px] font-semibold text-mist-400">Action</label><select value={adjType} onChange={(e) => setAdjType(e.target.value as "credit" | "debit")} className={fld}><option value="credit">Credit (add to Trust)</option><option value="debit">Debit (spend / pay out)</option></select></div>
              <div><label className="mb-1 block text-[11px] font-semibold text-mist-400">Amount ({name})</label><input type="number" min={0} value={adjAmt} onChange={(e) => setAdjAmt(Math.max(0, Number(e.target.value) || 0))} className={fld} /></div>
              <div><label className="mb-1 block text-[11px] font-semibold text-mist-400">Pay to user ID (optional, debit)</label><input value={adjUser} onChange={(e) => setAdjUser(e.target.value)} placeholder="u_… (leave blank = just spend)" className={fld} disabled={adjType !== "debit"} /></div>
              <div><label className="mb-1 block text-[11px] font-semibold text-mist-400">Reason / note</label><input value={adjNote} onChange={(e) => setAdjNote(e.target.value)} placeholder="e.g. Festival bonus" className={fld} /></div>
            </div>
            <Button className="mt-3" onClick={submitAdjust} disabled={busy === "adjust"}>{busy === "adjust" ? <Loader2 className="size-4 animate-spin" /> : adjType === "credit" ? <ArrowDownCircle className="size-4" /> : <ArrowUpCircle className="size-4" />} {adjType === "credit" ? "Add to Trust" : "Debit Trust"}</Button>
          </Card>

          {/* History / audit log */}
          <Card className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-5 py-3">
              <h2 className="text-sm font-bold text-mist-100">Transaction history &amp; audit log ({rep.totalCount})</h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-2"><Search className="size-3.5 text-mist-500" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-8 w-32 bg-transparent text-xs text-mist-100 outline-none" /></div>
                <select value={source} onChange={(e) => setSource(e.target.value)} className="h-8 rounded-lg border border-line bg-ink-800 px-2 text-xs text-mist-100"><option value="all">All sources</option>{rep.bySource.map((s) => <option key={s.source} value={s.source}>{s.source}</option>)}<option value="manual">manual</option></select>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 rounded-lg border border-line bg-ink-800 px-2 text-xs text-mist-100" />
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 rounded-lg border border-line bg-ink-800 px-2 text-xs text-mist-100" />
              </div>
            </div>
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-ink-900 text-mist-400"><tr><th className="px-4 py-2 font-semibold">Reference</th><th className="px-4 py-2 font-semibold">Date &amp; Time</th><th className="px-4 py-2 font-semibold">Type</th><th className="px-4 py-2 text-right font-semibold">{name}</th><th className="px-4 py-2 font-semibold">Source</th><th className="px-4 py-2 font-semibold">Detail</th></tr></thead>
                <tbody>
                  {rep.entries.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-mist-500">No Trust transactions yet.</td></tr> : rep.entries.map((e) => (
                    <tr key={e.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-2 font-mono text-[10px] text-mist-500">{e.id}</td>
                      <td className="px-4 py-2 text-mist-300">{new Date(e.at).toLocaleString("en-GB")}</td>
                      <td className="px-4 py-2"><span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold", e.type === "credit" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300")}>{e.type === "credit" ? "+" : "−"}</span></td>
                      <td className={cn("px-4 py-2 text-right font-bold tabular-nums", e.type === "credit" ? "text-emerald-300" : "text-rose-300")}>{num(e.lotus)}</td>
                      <td className="px-4 py-2 capitalize text-mist-300">{e.source.replace(/_/g, " ")}</td>
                      <td className="px-4 py-2 text-mist-400">{e.userName ? <b className="text-mist-200">{e.userName}</b> : ""}{e.userName && e.note ? " · " : ""}{e.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone, icon: Icon, big }: { label: string; value: string; tone: string; icon?: typeof Wallet; big?: boolean }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-xs text-mist-400">{Icon && <Icon className={cn("size-3.5", tone)} />} {label}</div>
      <div className={cn("mt-1 font-display font-extrabold", tone, big ? "text-xl" : "text-lg")}>{value}</div>
    </Card>
  );
}
