"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { fetchUserProfit, type UserProfitReport, type UserProfitEntry } from "@/lib/admin";
import { Coins, TrendingUp, CalendarDays, Search, Download, Printer, RefreshCw, Gift, Phone, Gamepad2, UserPlus, Award, ShieldCheck, Layers, Users, Trash2 } from "lucide-react";

const TYPE_META: Record<string, { label: string; icon: typeof Coins; tone: string }> = {
  gift: { label: "Gift received", icon: Gift, tone: "bg-lotus-500/15 text-lotus-300" },
  call: { label: "Call earnings", icon: Phone, tone: "bg-fuchsia-500/15 text-fuchsia-300" },
  game: { label: "Game winnings", icon: Gamepad2, tone: "bg-sky-500/15 text-sky-300" },
  referral: { label: "Referral", icon: UserPlus, tone: "bg-emerald-500/15 text-emerald-300" },
  reward: { label: "Reward / bonus", icon: Award, tone: "bg-amber-500/15 text-amber-300" },
  admin: { label: "Admin credit", icon: ShieldCheck, tone: "bg-petal-500/15 text-petal-300" },
  other: { label: "Other", icon: Layers, tone: "bg-white/[0.06] text-mist-300" },
};
const TYPE_OPTIONS = ["all", "gift", "call", "game", "referral", "reward", "admin", "other"];
const num = (n: number) => (n ?? 0).toLocaleString("en-SA");

export default function UserProfitPage() {
  const [rep, setRep] = useState<UserProfitReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { toast } = useToast();
  const [askClear, setAskClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchUserProfit({ q, type, from, to }).then((r) => { setRep(r); setLoading(false); });
  }, [q, type, from, to]);
  useEffect(() => { load(); }, [type, from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(load, 400); return () => clearTimeout(t); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const entries = rep?.entries ?? [];

  const clearGameTx = async () => {
    setClearing(true);
    try {
      const res = await fetch(withBase("/api/admin/user-profit"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "clearGameTransactions" }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { toast(`Removed ${d.removed ?? 0} game transaction record(s).`, "success"); load(); }
      else toast(d.error ?? "Could not clear", "error");
    } catch { toast("Could not clear", "error"); }
    setClearing(false);
    setAskClear(false);
  };

  const exportCsv = () => {
    const cols = ["Reference ID", "Date & Time", "User ID", "Username", "Source", "Coins earned", "Detail"];
    const rows = entries.map((e) => [e.id, new Date(e.at).toLocaleString("en-SA"), e.userId, e.userName, TYPE_META[e.type]?.label ?? e.type, String(e.coins), e.note ?? ""]);
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [cols, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `user-profit-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const cards = [
    { label: "Users earned today", value: rep?.today ?? 0, icon: CalendarDays, tone: "text-emerald-300" },
    { label: "Earned this month", value: rep?.monthly ?? 0, icon: TrendingUp, tone: "text-sky-300" },
    { label: "Total lifetime earned", value: rep?.totalLifetime ?? 0, icon: Coins, tone: "text-gold-300" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><Users className="size-6 text-emerald-300" /> User Profit</h1>
          <p className="mt-1 text-sm text-mist-400">Every coin your users <b>earn</b> on the platform — gifts received, call earnings, game winnings, referrals &amp; rewards. Recorded automatically.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={load}><RefreshCw className="size-4" /> Refresh</Button>
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={entries.length === 0}><Download className="size-4" /> CSV / Excel</Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}><Printer className="size-4" /> Print / PDF</Button>
          <Button variant="secondary" size="sm" onClick={() => setAskClear(true)} className="!border-rose-500/30 !text-rose-300"><Trash2 className="size-4" /> Clear game transactions</Button>
        </div>
      </div>

      {askClear && (
        <ConfirmDialog
          danger
          title="Clear all game transactions?"
          message="This removes every coin-related GAME transaction record — game winnings and any game-start charges — from the ledger, so games no longer appear as a coin source. User coin balances are NOT changed; only the log entries are removed. This can't be undone."
          confirmLabel={clearing ? "Clearing…" : "Clear game transactions"}
          cancelLabel="Cancel"
          onConfirm={clearGameTx}
          onCancel={() => setAskClear(false)}
        />
      )}

      {/* Dashboard cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label} className="p-5">
            <div className="flex items-center justify-between">
              <span className="grid size-11 place-items-center rounded-lg bg-emerald-500/12 text-emerald-300"><c.icon className="size-5" /></span>
            </div>
            <div className={cn("mt-4 font-display text-3xl font-extrabold", c.tone)}>🪙 {num(c.value)}</div>
            <div className="text-sm text-mist-400">{c.label}</div>
          </Card>
        ))}
      </div>

      {/* By source + weekly */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-mist-100">Earnings by source</h2>
          <span className="text-xs text-mist-400">This week: <b className="text-mist-200">🪙 {num(rep?.weekly ?? 0)}</b></span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(rep?.byType ?? []).length === 0 ? (
            <p className="text-sm text-mist-500">No user earnings recorded for this filter yet.</p>
          ) : (rep?.byType ?? []).map((b) => {
            const M = TYPE_META[b.type] ?? TYPE_META.other;
            return (
              <span key={b.type} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold", M.tone)}>
                <M.icon className="size-3.5" /> {M.label}: 🪙 {num(b.coins)} <span className="opacity-70">({b.count})</span>
              </span>
            );
          })}
        </div>
      </Card>

      {/* Top earners */}
      {(rep?.topEarners ?? []).length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-bold text-mist-100">Top earning users</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(rep?.topEarners ?? []).slice(0, 10).map((u, i) => (
              <div key={u.userId} className="flex items-center justify-between rounded-lg border border-line bg-ink-800 px-3 py-2 text-sm">
                <span className="flex items-center gap-2 text-mist-200">
                  <span className={cn("grid size-6 place-items-center rounded-full text-[11px] font-bold", i < 3 ? "bg-gold-500/20 text-gold-300" : "bg-white/[0.06] text-mist-400")}>{i + 1}</span>
                  <b className="text-mist-100">{u.userName || "—"}</b>
                </span>
                <span className="font-bold text-gold-300">🪙 {num(u.coins)} <span className="text-[10px] font-normal text-mist-500">({u.count})</span></span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] print:hidden">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-ink-800 px-3">
          <Search className="size-4 text-mist-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search user, detail, reference ID…" className="h-10 w-full bg-transparent text-sm text-mist-100 outline-none placeholder:text-mist-500" />
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)} className="h-10 rounded-xl border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400">
          {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t === "all" ? "All sources" : TYPE_META[t]?.label ?? t}</option>)}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="From date" className="h-10 rounded-xl border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="To date" className="h-10 rounded-xl border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400" />
      </div>

      {/* History table */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between px-5 py-3 text-xs text-mist-500">
          <span>Earnings history {rep ? `(${num(rep.totalCount)} entries)` : ""}</span>
          <span>Shown total: <b className="text-gold-300">🪙 {num(entries.reduce((s, e) => s + e.coins, 0))}</b></span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-white/5 text-left text-xs uppercase tracking-wide text-mist-500">
                <th className="px-5 py-3 font-semibold">Reference ID</th>
                <th className="px-5 py-3 font-semibold">User</th>
                <th className="px-5 py-3 font-semibold">Source</th>
                <th className="px-5 py-3 font-semibold">Coins earned</th>
                <th className="px-5 py-3 font-semibold">Date &amp; time</th>
                <th className="px-5 py-3 font-semibold">Detail</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-mist-500">Loading…</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-mist-500">No user earnings recorded for this filter yet.</td></tr>
              ) : entries.map((e: UserProfitEntry) => {
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
                    <td className="px-5 py-3 font-bold text-emerald-300">🪙 {num(e.coins)}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-xs text-mist-300">{new Date(e.at).toLocaleString("en-SA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-5 py-3 text-xs text-mist-400">{e.note || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-[11px] text-mist-600 print:hidden">🔒 This report is generated automatically from the wallet ledger and is admin-only. It shows coins users earned — purchases and spends are excluded.</p>
    </div>
  );
}
