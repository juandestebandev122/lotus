"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { fetchAgentProfit, type AgentProfitReport, type AgentProfitEntry } from "@/lib/admin";
import { ProfitPayoutButton } from "@/components/admin/ProfitPayoutButton";
import { Coins, TrendingUp, CalendarDays, Search, Download, Printer, RefreshCw, Building2, Gift, ArrowRight, Banknote } from "lucide-react";

const num = (n: number) => (n ?? 0).toLocaleString("en-SA");

export default function AgentProfitPage() {
  const [rep, setRep] = useState<AgentProfitReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [agencyId, setAgencyId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetchAgentProfit({ q, agencyId, from, to }).then((r) => { setRep(r); setLoading(false); });
  }, [q, agencyId, from, to]);
  useEffect(() => { load(); }, [agencyId, from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(load, 400); return () => clearTimeout(t); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const entries = rep?.entries ?? [];

  const exportCsv = () => {
    const cols = ["Reference ID", "Date & Time", "Agency ID", "Agency", "Member (received gift)", "Member User ID", "Sender", "Sender User ID", "Commission coins", "Detail"];
    const rows = entries.map((e) => [e.id, new Date(e.at).toLocaleString("en-SA"), e.agencyPublicId, e.agencyName, e.memberName, e.memberPublicId ?? "", e.senderName, e.senderPublicId ?? "", String(e.coins), e.note ?? ""]);
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [cols, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `agent-profit-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const cards = [
    { label: "Agencies earned today", value: rep?.today ?? 0, icon: CalendarDays, tone: "text-emerald-300" },
    { label: "Earned this month", value: rep?.monthly ?? 0, icon: TrendingUp, tone: "text-sky-300" },
    { label: "Total lifetime commission", value: rep?.totalLifetime ?? 0, icon: Coins, tone: "text-gold-300" },
  ];

  const agencies = rep?.byAgency ?? [];
  const allAgencies = rep?.allAgencies ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><Building2 className="size-6 text-fuchsia-300" /> Agent Profit</h1>
          <p className="mt-1 text-sm text-mist-400">The <b>commission</b> each Agency earns from gifts sent to its members, based on the agency&apos;s commission split. Recorded automatically.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={load}><RefreshCw className="size-4" /> Refresh</Button>
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={entries.length === 0}><Download className="size-4" /> CSV / Excel</Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}><Printer className="size-4" /> Print / PDF</Button>
        </div>
      </div>

      {/* Dashboard cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label} className="p-5">
            <div className="flex items-center justify-between">
              <span className="grid size-11 place-items-center rounded-lg bg-fuchsia-500/12 text-fuchsia-300"><c.icon className="size-5" /></span>
            </div>
            <div className={cn("mt-4 font-display text-3xl font-extrabold", c.tone)}>🪙 {num(c.value)}</div>
            <div className="text-sm text-mist-400">{c.label}</div>
          </Card>
        ))}
      </div>

      {/* Per-agency breakdown */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-mist-100">Commission by agency</h2>
          <span className="text-xs text-mist-400">This week: <b className="text-mist-200">🪙 {num(rep?.weekly ?? 0)}</b></span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {agencies.length === 0 ? (
            <p className="text-sm text-mist-500">No agency commission recorded for this filter yet.</p>
          ) : agencies.map((a) => (
            <button key={a.agencyId} onClick={() => setAgencyId((v) => v === a.agencyId ? "all" : a.agencyId)} className={cn("flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition", agencyId === a.agencyId ? "border-fuchsia-400 bg-fuchsia-500/10" : "border-line bg-ink-800 hover:border-white/20")}>
              <span className="flex items-center gap-2 text-mist-200">
                <Building2 className="size-4 text-fuchsia-300" />
                <span>
                  <b className="text-mist-100">{a.agencyName}</b>
                  <span className="ml-1 font-mono text-[10px] text-mist-500">{a.agencyPublicId}</span>
                </span>
              </span>
              <span className="font-bold text-gold-300">🪙 {num(a.coins)} <span className="text-[10px] font-normal text-mist-500">({a.count})</span></span>
            </button>
          ))}
        </div>
      </Card>

      {/* Agency profit withdrawals — pay out each agency's earned commission. */}
      <Card className="p-5 print:hidden">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-mist-100"><Banknote className="size-4 text-emerald-300" /> Agency profit withdrawals</h2>
        <p className="mb-3 text-xs text-mist-400">Withdraw / pay out each agency&apos;s earned commission balance. Deducts from the agency wallet and records an auditable payout.</p>
        {allAgencies.filter((a) => a.earnings > 0).length === 0 ? (
          <p className="text-sm text-mist-500">No agency currently has a withdrawable balance.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {allAgencies.filter((a) => a.earnings > 0).sort((a, b) => b.earnings - a.earnings).map((a) => (
              <div key={a.agencyId} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-ink-800/50 px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-mist-100">{a.agencyName} <span className="font-mono text-[10px] text-mist-500">{a.agencyPublicId}</span></span>
                  <span className="text-xs text-gold-300">🪙 {num(a.earnings)} available</span>
                </span>
                <ProfitPayoutButton pool="agency" agencyId={a.agencyId} balance={a.earnings} onDone={load} />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Filters */}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] print:hidden">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-ink-800 px-3">
          <Search className="size-4 text-mist-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search agency, member, sender…" className="h-10 w-full bg-transparent text-sm text-mist-100 outline-none placeholder:text-mist-500" />
        </div>
        <select value={agencyId} onChange={(e) => setAgencyId(e.target.value)} className="h-10 rounded-xl border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400">
          <option value="all">All agencies</option>
          {allAgencies.map((a) => <option key={a.agencyId} value={a.agencyId}>{a.agencyName} ({a.agencyPublicId})</option>)}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="From date" className="h-10 rounded-xl border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="To date" className="h-10 rounded-xl border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400" />
      </div>

      {/* History table */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between px-5 py-3 text-xs text-mist-500">
          <span>Commission history {rep ? `(${num(rep.totalCount)} entries)` : ""}</span>
          <span>Shown total: <b className="text-gold-300">🪙 {num(entries.reduce((s, e) => s + e.coins, 0))}</b></span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-white/5 text-left text-xs uppercase tracking-wide text-mist-500">
                <th className="px-5 py-3 font-semibold">Reference ID</th>
                <th className="px-5 py-3 font-semibold">Agency</th>
                <th className="px-5 py-3 font-semibold">Gift flow</th>
                <th className="px-5 py-3 font-semibold">Commission</th>
                <th className="px-5 py-3 font-semibold">Date &amp; time</th>
                <th className="px-5 py-3 font-semibold">Detail</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-mist-500">Loading…</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-mist-500">No agency commission recorded for this filter yet.</td></tr>
              ) : entries.map((e: AgentProfitEntry) => (
                <tr key={e.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                  <td className="px-5 py-3 font-mono text-[11px] text-lotus-300">{e.id}</td>
                  <td className="px-5 py-3 text-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-mist-100"><Building2 className="size-3.5 text-fuchsia-300" /> {e.agencyName}</div>
                    <div className="font-mono text-[10px] text-mist-500">{e.agencyPublicId}</div>
                  </td>
                  <td className="px-5 py-3 text-xs text-mist-300">
                    <span className="inline-flex flex-wrap items-center gap-1">
                      <Gift className="size-3 shrink-0 text-lotus-300" />
                      <Link href={`/admin/users?q=${encodeURIComponent(e.senderPublicId || e.senderName)}`} className="hover:underline hover:text-lotus-300">{e.senderName}{e.senderPublicId && <span className="ml-1 font-mono text-[10px] text-mist-500">#{e.senderPublicId}</span>}</Link>
                      <ArrowRight className="size-3 shrink-0 text-mist-500" />
                      <Link href={`/admin/users?q=${encodeURIComponent(e.memberPublicId || e.memberName)}`} className="hover:underline"><b className="text-mist-100 hover:text-lotus-300">{e.memberName}</b>{e.memberPublicId && <span className="ml-1 font-mono text-[10px] text-mist-500">#{e.memberPublicId}</span>}</Link>
                    </span>
                  </td>
                  <td className="px-5 py-3 font-bold text-fuchsia-300">🪙 {num(e.coins)}</td>
                  <td className="px-5 py-3 whitespace-nowrap text-xs text-mist-300">{new Date(e.at).toLocaleString("en-SA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="px-5 py-3 text-xs text-mist-400">{e.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-[11px] text-mist-600 print:hidden">🔒 This ledger is written automatically whenever a gift is sent to an agency member — the agency&apos;s commission share is credited to its wallet and recorded here. Admin-only, tamper-proof.</p>
    </div>
  );
}
