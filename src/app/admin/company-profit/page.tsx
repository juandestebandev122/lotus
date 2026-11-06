"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { fetchCompanyProfit, type CompanyProfitReport, type CompanyProfitEntry } from "@/lib/admin";
import { ProfitPayoutButton } from "@/components/admin/ProfitPayoutButton";
import { Coins, TrendingUp, CalendarDays, Search, Download, Printer, RefreshCw, Gift, Phone, Video, Gamepad2, Wallet, Banknote, Percent, Mic, Layers, UserPlus } from "lucide-react";

const TYPE_META: Record<string, { label: string; icon: typeof Coins; tone: string }> = {
  gift: { label: "Gifts", icon: Gift, tone: "bg-lotus-500/15 text-lotus-300" },
  audio_call: { label: "Audio calls", icon: Phone, tone: "bg-fuchsia-500/15 text-fuchsia-300" },
  video_call: { label: "Video calls", icon: Video, tone: "bg-violet-500/15 text-violet-300" },
  call: { label: "Paid Zone call", icon: Phone, tone: "bg-fuchsia-500/15 text-fuchsia-300" }, // legacy (pre audio/video split)
  recharge: { label: "Coin purchases", icon: Wallet, tone: "bg-emerald-500/15 text-emerald-300" },
  withdrawal_fee: { label: "Withdrawal fees", icon: Banknote, tone: "bg-amber-500/15 text-amber-300" },
  game: { label: "Game", icon: Gamepad2, tone: "bg-sky-500/15 text-sky-300" },
  commission: { label: "Commission", icon: Percent, tone: "bg-lotus-500/15 text-lotus-300" },
  room: { label: "Room", icon: Mic, tone: "bg-petal-500/15 text-petal-300" },
  other: { label: "Other", icon: Layers, tone: "bg-white/[0.06] text-mist-300" },
};
const TYPE_OPTIONS = ["all", "gift", "audio_call", "video_call", "recharge", "withdrawal_fee", "call", "game", "commission", "room", "other"];
const num = (n: number) => (n ?? 0).toLocaleString("en-SA");
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function CompanyProfitPage() {
  const [rep, setRep] = useState<CompanyProfitReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [period, setPeriod] = useState<"today" | "week" | "month" | "all">("all");

  // Quick period filters (Today / Weekly / Monthly / All Time) — set the date range.
  const applyPeriod = (p: "today" | "week" | "month" | "all") => {
    setPeriod(p);
    const now = new Date();
    if (p === "all") { setFrom(""); setTo(""); return; }
    const start = new Date(now);
    if (p === "today") start.setHours(0, 0, 0, 0);
    else if (p === "week") start.setDate(now.getDate() - 6);
    else if (p === "month") start.setDate(now.getDate() - 29);
    setFrom(iso(start)); setTo(iso(now));
  };

  const load = useCallback(() => {
    setLoading(true);
    fetchCompanyProfit({ q, type, from, to }).then((r) => { setRep(r); setLoading(false); });
  }, [q, type, from, to]);
  useEffect(() => { load(); }, [type, from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(load, 400); return () => clearTimeout(t); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const entries = rep?.entries ?? [];
  const shownTotal = (rep?.byType ?? []).reduce((s, b) => s + b.coins, 0);

  const exportCsv = () => {
    const cols = ["Reference ID", "Date & Time", "User ID", "Username", "Type", "Coins to company", "Note"];
    const rows = entries.map((e) => [e.id, new Date(e.at).toLocaleString("en-SA"), e.userId, e.userName, TYPE_META[e.type]?.label ?? e.type, String(e.coins), e.note ?? ""]);
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [cols, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `company-profit-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const cards = [
    { label: "Today's profit", value: rep?.today ?? 0, icon: CalendarDays, tone: "text-emerald-300" },
    { label: "This month's profit", value: rep?.monthly ?? 0, icon: TrendingUp, tone: "text-sky-300" },
    { label: "Total lifetime profit", value: rep?.totalLifetime ?? 0, icon: Coins, tone: "text-gold-300" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><Coins className="size-6 text-gold-300" /> Admin Profit <span className="text-sm font-normal text-mist-500">(Company)</span></h1>
          <p className="mt-1 text-sm text-mist-400">Every coin the company/admin earns as commission &amp; fees, recorded automatically. Read-only &amp; tamper-proof. See also <b className="text-mist-300">Agent Profit</b> &amp; <b className="text-mist-300">User Profit</b>.</p>
        </div>
        <div className="flex items-center gap-2">
          <ProfitPayoutButton pool="company" balance={rep?.totalLifetime ?? 0} onDone={load} />
          <Button variant="secondary" size="sm" onClick={load}><RefreshCw className="size-4" /> Refresh</Button>
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={entries.length === 0}><Download className="size-4" /> CSV / Excel</Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}><Printer className="size-4" /> Print / PDF</Button>
        </div>
      </div>

      {/* Quick period filters */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {([["today", "Today"], ["week", "Weekly"], ["month", "Monthly"], ["all", "All Time"]] as const).map(([p, lbl]) => (
          <button key={p} onClick={() => applyPeriod(p)} className={cn("rounded-full px-4 py-1.5 text-sm font-semibold transition", period === p ? "bg-lotus-600 text-white" : "border border-line bg-ink-800 text-mist-300 hover:text-mist-100")}>{lbl}</button>
        ))}
      </div>

      {/* Dashboard cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label} className="p-5">
            <div className="flex items-center justify-between">
              <span className="grid size-11 place-items-center rounded-lg bg-gold-500/12 text-gold-300"><c.icon className="size-5" /></span>
            </div>
            <div className={cn("mt-4 font-display text-3xl font-extrabold", c.tone)}>🪙 {num(c.value)}</div>
            <div className="text-sm text-mist-400">{c.label}</div>
          </Card>
        ))}
      </div>

      {/* By type + weekly */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-mist-100">Profit by source</h2>
          <span className="text-xs text-mist-400">Total ({period === "all" ? "all time" : period}): <b className="text-gold-300">🪙 {num(shownTotal)}</b></span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(rep?.byType ?? []).length === 0 ? (
            <p className="text-sm text-mist-500">No profit recorded for this period yet.</p>
          ) : (rep?.byType ?? []).map((b) => {
            const M = TYPE_META[b.type] ?? TYPE_META.other;
            return (
              <button key={b.type} onClick={() => setType(type === b.type ? "all" : b.type)} title={`Filter the history to ${M.label}`} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition hover:brightness-125", M.tone, type === b.type && "ring-2 ring-white/50")}>
                <M.icon className="size-3.5" /> {M.label}: 🪙 {num(b.coins)} <span className="opacity-70">({b.count})</span>
              </button>
            );
          })}
          {/* Referral rewards PAID (a user-acquisition cost) — shown for the same period, NOT counted in profit. */}
          {(rep?.referralPaid ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/12 px-3 py-1.5 text-xs font-semibold text-rose-300" title="Referral rewards paid out in this period — a user-acquisition cost, shown for reference (not company profit)">
              <UserPlus className="size-3.5" /> Referral paid (cost): 🪙 {num(rep?.referralPaid ?? 0)}
            </span>
          )}
        </div>
      </Card>

      {/* Filters */}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] print:hidden">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-ink-800 px-3">
          <Search className="size-4 text-mist-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search user, note, reference ID…" className="h-10 w-full bg-transparent text-sm text-mist-100 outline-none placeholder:text-mist-500" />
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)} className="h-10 rounded-xl border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400">
          {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t === "all" ? "All types" : TYPE_META[t]?.label ?? t}</option>)}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="From date" className="h-10 rounded-xl border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="To date" className="h-10 rounded-xl border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400" />
      </div>

      {/* History table */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between px-5 py-3 text-xs text-mist-500">
          <span>Transaction history {rep ? `(${num(rep.totalCount)} entries)` : ""}</span>
          <span>Company received: <b className="text-gold-300">🪙 {num(entries.reduce((s, e) => s + e.coins, 0))}</b> (shown)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-white/5 text-left text-xs uppercase tracking-wide text-mist-500">
                <th className="px-5 py-3 font-semibold">Reference ID</th>
                <th className="px-5 py-3 font-semibold">User</th>
                <th className="px-5 py-3 font-semibold">Type</th>
                <th className="px-5 py-3 font-semibold">Coins → company</th>
                <th className="px-5 py-3 font-semibold">Date &amp; time</th>
                <th className="px-5 py-3 font-semibold">Detail</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-mist-500">Loading…</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-mist-500">No company profit recorded for this filter yet.</td></tr>
              ) : entries.map((e: CompanyProfitEntry) => {
                const M = TYPE_META[e.type] ?? TYPE_META.other;
                return (
                  <tr key={e.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                    <td className="px-5 py-3 font-mono text-[11px] text-lotus-300">{e.id}</td>
                    <td className="px-5 py-3 text-xs">
                      {e.userId ? (
                        <Link href={`/admin/users?q=${encodeURIComponent(e.userId)}`} className="hover:underline">
                          <div className="font-semibold text-mist-100 hover:text-lotus-300">{e.userName || "—"}</div>
                          <div className="font-mono text-[10px] text-mist-500">{e.userId}</div>
                        </Link>
                      ) : <div className="font-semibold text-mist-100">{e.userName || "—"}</div>}
                    </td>
                    <td className="px-5 py-3"><span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", M.tone)}><M.icon className="size-3" /> {M.label}</span></td>
                    <td className="px-5 py-3 font-bold text-gold-300">🪙 {num(e.coins)}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-xs text-mist-300">{new Date(e.at).toLocaleString("en-SA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-5 py-3 text-xs text-mist-400">{e.note || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-[11px] text-mist-600 print:hidden">🔒 This ledger is written automatically by the system and is admin-only — it cannot be edited or deleted by users. Every commission coin is reflected here with no mismatch.</p>
    </div>
  );
}
