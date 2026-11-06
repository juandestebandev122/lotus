"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { withBase } from "@/lib/base-path";
import { useConfig } from "@/lib/config";
import { applyFilterSort, SortTh, type SortDir } from "@/components/admin/TableControls";
import { cn } from "@/lib/cn";
import { ReceiptText, RefreshCw, Search, Download, FileSpreadsheet, Printer, ChevronDown, Coins, Flower2, Wallet, Building2, Landmark, HandCoins, Users, XCircle, Banknote, Gift, TrendingUp, RotateCcw, CalendarDays } from "lucide-react";

// MASTER TRANSACTION MANAGEMENT (client spec "Transaction Management Table"):
// every coin/Lotus movement in ONE ledger — summary cards, date presets,
// search + filters, expandable audit rows, export CSV / Excel / PDF / Print.

interface Row {
  id: string; at: string; source: string; type: string; module: string;
  userId: string; userName: string; publicId?: string;
  fromId?: string; fromName?: string; fromPublicId?: string;
  toId?: string; toName?: string; toPublicId?: string;
  coinsIn: number; coinsOut: number; lotus?: number;
  walletBefore?: number; walletAfter?: number;
  lotusBefore?: number; lotusAfter?: number;
  userProfit?: number; companyProfit?: number; agencyProfit?: number; trustProfit?: number;
  receiverUnit?: string;
  gst?: number; fee?: number; net?: number; amount?: number;
  method?: string; status: string; ref?: string; note?: string;
  roomId?: string; roomName?: string;
}
interface Data {
  summary: Record<string, number>;
  rows: Row[];
  // Accounting breakdown — where coins come FROM and where they GO.
  income?: Record<string, number>; incomeToday?: Record<string, number>;
  expense?: Record<string, number>; expenseToday?: Record<string, number>;
  incomeSources?: string[]; expenseSources?: string[];
}

const n = (v?: number) => (v ?? 0).toLocaleString("en-SA");
const PRESETS = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "lastmonth", label: "Last month" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "custom", label: "Custom" },
] as const;

// Calendar boundaries for the This week / This month / Last month presets.
function startOfWeek() { const d = new Date(); d.setHours(0, 0, 0, 0); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return d.getTime(); } // Monday
function startOfMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); }
function startOfLastMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(); }

export default function TransactionManagementPage() {
  const { config } = useConfig();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [fType, setFType] = useState("");
  const [fModule, setFModule] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fMethod, setFMethod] = useState(""); // payment method (UPI / QR / bank / manual…)
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["key"]>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [coinMin, setCoinMin] = useState("");
  const [coinMax, setCoinMax] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [tmSort, setTmSort] = useState("when");
  const [tmDir, setTmDir] = useState<SortDir>("desc");
  const sortLedger = (col: string) => { if (tmSort === col) setTmDir((d) => (d === "asc" ? "desc" : "asc")); else { setTmSort(col); setTmDir("desc"); } };

  const load = () => {
    fetch(withBase("/api/admin/transaction-management"), { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d.summary) setData(d as Data); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);

  const s = data?.summary ?? {};
  const rows = useMemo(() => data?.rows ?? [], [data?.rows]);

  const modules = useMemo(() => [...new Set(rows.map((r) => r.module))].sort(), [rows]);
  const types = useMemo(() => [...new Set(rows.map((r) => r.type))].sort(), [rows]);
  const methods = useMemo(() => [...new Set(rows.map((r) => r.method).filter(Boolean) as string[])].sort(), [rows]);

  const dayStart = (offset: number) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - offset); return d.getTime(); };
  const shown = rows.filter((r) => {
    const t = new Date(r.at).getTime();
    if (preset === "today" && t < dayStart(0)) return false;
    if (preset === "yesterday" && !(t >= dayStart(1) && t < dayStart(0))) return false;
    if (preset === "week" && t < startOfWeek()) return false;
    if (preset === "month" && t < startOfMonth()) return false;
    if (preset === "lastmonth" && !(t >= startOfLastMonth() && t < startOfMonth())) return false;
    if (preset === "7d" && t < dayStart(6)) return false;
    if (preset === "30d" && t < dayStart(29)) return false;
    if (preset === "custom") {
      if (from && t < new Date(from + "T00:00:00").getTime()) return false;
      if (to && t > new Date(to + "T23:59:59").getTime()) return false;
    }
    if (fType && r.type !== fType) return false;
    if (fModule && r.module !== fModule) return false;
    if (fStatus && r.status !== fStatus) return false;
    if (fMethod && (r.method ?? "") !== fMethod) return false;
    // Coin range — matches the larger of coins in/out (and Lotus) on the row.
    const mag = Math.max(r.coinsIn, r.coinsOut, r.lotus ?? 0);
    if (coinMin && mag < Number(coinMin)) return false;
    if (coinMax && mag > Number(coinMax)) return false;
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      const hay = [r.id, r.ref, r.userId, r.userName, r.publicId, r.fromName, r.fromPublicId, r.toName, r.toPublicId, r.module, r.type, r.note, r.roomId, r.roomName, r.method, r.at.slice(0, 10)]
        .filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  // Sorted view of the filtered ledger (click a column header to sort).
  const sortedShown = applyFilterSort(shown, {
    q: "", sort: tmSort, dir: tmDir, searchText: () => "",
    sortKeys: {
      when: (r) => new Date(r.at).getTime(),
      user: (r) => r.userName ?? "",
      in: (r) => r.coinsIn ?? 0,
      out: (r) => r.coinsOut ?? 0,
      status: (r) => r.status ?? "",
    },
  });

  // ---- Revenue & Profit (INR), computed from the SHOWN (filtered) rows so it
  // always matches the selected period. Income = real-money paid transactions;
  // Expense = all FREE / promotional coins the platform handed out (spin, level,
  // startup bonus, referral, admin credits, promo…), valued at the coin→money rate.
  const coinsPerUnit = Math.max(1, config.withdraw?.coinsPerUnit ?? 20);
  const currency = config.withdraw?.currency || "INR";
  const coinValue = 1 / coinsPerUnit; // money per coin
  const fin = useMemo(() => {
    let paidIncome = 0, paidTx = 0, freeCoins = 0, freeTx = 0, coinsPurchased = 0;
    for (const r of shown) {
      const modLow = (r.module ?? "").toLowerCase();
      const noteLow = (r.note ?? "").toLowerCase();
      // INCOME — a real-money coin purchase. (The ledger tags these type
      // "Coin Purchase"; also accept a raw "purchase" or a module match.)
      const isPurchase = r.type === "Coin Purchase" || r.type === "purchase" || modLow.includes("coin purchase");
      if (isPurchase) {
        paidIncome += r.amount ?? 0;
        coinsPurchased += r.coinsIn ?? 0;
        if ((r.amount ?? 0) > 0) paidTx += 1;
        continue;
      }
      // EXPENSE = FREE / promotional coins the PLATFORM issued (spin, level,
      // startup bonus, referral, admin credits, promos…). Explicitly EXCLUDE:
      //  • gift transfers (source "gift") — user→user, not platform-issued;
      //  • refunds — returning the user's OWN coins, not a giveaway;
      //  • Paid-Zone call earnings — a caller→receiver redistribution already
      //    paid for at purchase;
      //  • any row that carries real money.
      const isGiftTransfer = r.source === "gift";
      const isRefund = noteLow.includes("refund") || modLow.includes("refund");
      const isCallEarning = noteLow.includes("call earning") || (noteLow.includes("paid zone") && noteLow.includes("earning"));
      if (!isGiftTransfer && !isRefund && !isCallEarning && (r.amount ?? 0) === 0 && (r.coinsIn ?? 0) > 0) {
        freeCoins += r.coinsIn ?? 0;
        freeTx += 1;
      }
    }
    const expenseInr = Math.round(freeCoins * coinValue * 100) / 100;
    const incomeInr = Math.round(paidIncome * 100) / 100;
    const netProfit = Math.round((incomeInr - expenseInr) * 100) / 100;
    const margin = incomeInr > 0 ? Math.round((netProfit / incomeInr) * 1000) / 10 : 0;
    return { incomeInr, expenseInr, netProfit, margin, freeCoins, paidTx, freeTx, coinsPurchased };
  }, [shown, coinValue]);
  const periodLabel = PRESETS.find((p) => p.key === preset)?.label ?? "All time";
  const money = (v: number) => `${currency === "INR" ? "₹" : currency + " "}${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

  // ---- Exports: one column set drives CSV / Excel / PDF so they always match.
  const COLS: [string, (r: Row) => string][] = [
    ["Transaction ID", (r) => r.id],
    ["Date & Time", (r) => new Date(r.at).toLocaleString("en-GB")],
    ["User ID", (r) => r.publicId ?? r.userId],
    ["Username", (r) => r.userName],
    ["Type", (r) => r.type],
    ["Source Module", (r) => r.module],
    ["From (ID)", (r) => (r.fromName ? `${r.fromName} (${r.fromPublicId ?? r.fromId ?? ""})` : "")],
    ["To (ID)", (r) => (r.toName ? `${r.toName} (${r.toPublicId ?? r.toId ?? ""})` : "")],
    ["Coins In", (r) => String(r.coinsIn || "")],
    ["Coins Out", (r) => String(r.coinsOut || "")],
    ["Lotus", (r) => (r.lotus != null ? String(r.lotus) : "")],
    ["Wallet Before", (r) => (r.walletBefore != null ? String(r.walletBefore) : "")],
    ["Wallet After", (r) => (r.walletAfter != null ? String(r.walletAfter) : "")],
    ["Lotus Before", (r) => (r.lotusBefore != null ? String(r.lotusBefore) : "")],
    ["Lotus After", (r) => (r.lotusAfter != null ? String(r.lotusAfter) : "")],
    ["User Profit", (r) => (r.userProfit != null ? String(r.userProfit) : "")],
    ["Company Profit", (r) => (r.companyProfit != null ? String(r.companyProfit) : "")],
    ["Agency Profit", (r) => (r.agencyProfit != null ? String(r.agencyProfit) : "")],
    ["Trust Profit", (r) => (r.trustProfit != null ? String(r.trustProfit) : "")],
    ["GST", (r) => (r.gst != null ? String(r.gst) : "")],
    ["Fee", (r) => (r.fee != null ? String(r.fee) : "")],
    ["Net Amount", (r) => (r.net != null ? String(r.net) : "")],
    ["Amount", (r) => (r.amount != null ? String(r.amount) : "")],
    ["Payment Method", (r) => r.method ?? ""],
    ["Status", (r) => r.status],
    ["Reference", (r) => r.ref ?? ""],
    ["Group", (r) => r.roomName ?? ""],
    ["Notes", (r) => r.note ?? ""],
  ];
  const download = (name: string, blob: Blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const stamp = () => new Date().toISOString().slice(0, 10);
  const exportCsv = () => {
    const all = [COLS.map((c) => c[0]), ...shown.map((r) => COLS.map(([, f]) => f(r)))];
    const csv = "﻿" + all.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    download(`transactions-${stamp()}.csv`, new Blob([csv], { type: "text/csv;charset=utf-8" }));
  };
  const tableHtml = () => {
    const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const head = `<tr>${COLS.map((c) => `<th>${esc(c[0])}</th>`).join("")}</tr>`;
    const body = shown.map((r) => `<tr>${COLS.map(([, f]) => `<td>${esc(f(r))}</td>`).join("")}</tr>`).join("");
    return `<table border="1" cellspacing="0" cellpadding="4"><thead>${head}</thead><tbody>${body}</tbody></table>`;
  };
  const exportXls = () => {
    const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>${tableHtml()}</body></html>`;
    download(`transactions-${stamp()}.xls`, new Blob([html], { type: "application/vnd.ms-excel" }));
  };
  const exportPdf = () => {
    const w = window.open("", "_blank", "width=1300,height=800");
    if (!w) return;
    w.document.write(`<html><head><title>Transaction Management — ${stamp()}</title><style>
      body{font-family:Arial,sans-serif;font-size:9px;margin:14px}
      h1{font-size:15px;margin:0 0 2px} p{color:#555;margin:0 0 8px}
      table{border-collapse:collapse;width:100%} th,td{border:1px solid #999;padding:2px 4px;text-align:left;vertical-align:top}
      th{background:#eee} tr:nth-child(even) td{background:#f7f7f7}
    </style></head><body><h1>Transaction Management Report</h1><p>Generated ${new Date().toLocaleString("en-GB")} · ${shown.length} transactions</p>${tableHtml()}</body></html>`);
    w.document.close();
    w.focus();
    w.print(); // browser print dialog → save as PDF or print
  };

  const inp = "h-9 rounded-lg border border-line bg-ink-900 px-2.5 text-xs text-mist-100 outline-none focus:border-lotus-400";
  const cards: { label: string; value: string; icon: typeof Coins; tone: string; sub?: string }[] = [
    { label: "Total Coin Circulation", value: n(s.totalCoinCirculation), icon: Coins, tone: "text-gold-300" },
    { label: "Total Coins Purchased", value: n(s.totalCoinsPurchased), icon: TrendingUp, tone: "text-emerald-300" },
    { label: "Total Coins Used", value: n(s.totalCoinsUsed), icon: Wallet, tone: "text-petal-300" },
    { label: "Total Coins Received", value: n(s.totalCoinsReceived), icon: Wallet, tone: "text-sky-300" },
    { label: "Total Lotus Flowers", value: n(s.totalLotusHeld), icon: Flower2, tone: "text-lotus-300", sub: `${n(s.totalLotusGenerated)} generated` },
    { label: "Total Withdrawals", value: n(s.withdrawalsTotal), icon: Banknote, tone: "text-mist-200" },
    { label: "Pending Withdrawals", value: n(s.withdrawalsPending), icon: Banknote, tone: "text-amber-300", sub: `value ${n(s.withdrawalsPendingValue)}` },
    { label: "Completed Withdrawals", value: n(s.withdrawalsCompleted), icon: Banknote, tone: "text-emerald-300", sub: `paid ${n(s.withdrawalsCompletedValue)}` },
    { label: "Company Profit", value: n(s.companyProfit), icon: Building2, tone: "text-fuchsia-300" },
    { label: "Agency Profit", value: n(s.agencyProfit), icon: Landmark, tone: "text-sky-300" },
    { label: "User Profit", value: n(s.userProfit), icon: Users, tone: "text-emerald-300" },
    { label: "Trust Profit", value: n(s.trustProfit), icon: HandCoins, tone: "text-amber-300" },
    { label: "GST Collected", value: n(s.gstCollected), icon: ReceiptText, tone: "text-rose-300" },
    { label: "Refunds (rejected)", value: n(s.refunds), icon: RotateCcw, tone: "text-amber-300", sub: `${n(s.refundsValue)} returned` },
    { label: "Failed Transactions", value: n(s.failedTransactions), icon: XCircle, tone: "text-rose-300" },
    { label: "Gifts Sent", value: n(s.giftCount), icon: Gift, tone: "text-lotus-300", sub: `${n(s.giftedCoinsTotal)} coins` },
    { label: "Today", value: n(s.txToday), icon: ReceiptText, tone: "text-mist-200", sub: `yesterday ${n(s.txYesterday)}` },
    { label: "Last 7 / 30 days", value: n(s.txLast7d), icon: ReceiptText, tone: "text-mist-200", sub: `30d ${n(s.txLast30d)}` },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><ReceiptText className="size-6 text-lotus-300" /> Transaction Management</h1>
          <p className="mt-1 text-sm text-mist-400">Every coin &amp; Lotus movement in one place — wallet transactions, gifts (with the 4-way split), and withdrawals. Nothing moves without a record.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={load}><RefreshCw className="size-4" /> Refresh</Button>
      </div>

      {/* Dashboard summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <Card key={c.label} className="p-3.5">
            <div className="flex items-center gap-1.5 text-[11px] text-mist-400"><c.icon className={cn("size-3.5", c.tone)} /> {c.label}</div>
            <div className={cn("mt-1 font-display text-xl font-extrabold", c.tone)}>{c.value}</div>
            {c.sub && <div className="text-[10px] text-mist-500">{c.sub}</div>}
          </Card>
        ))}
      </div>

      {/* ── TODAY'S ACCOUNTING — the daily profit/loss picture at a glance ── */}
      <div>
        <h2 className="mb-2 flex items-center gap-2 font-semibold text-mist-100">
          <CalendarDays className="size-4 text-lotus-300" /> Today&apos;s accounting
          <span className="text-xs font-normal text-mist-500">(business day, Saudi time)</span>
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Coins added today", value: n(s.coinsAddedToday), tone: "text-emerald-300" },
            { label: "Coins deducted today", value: n(s.coinsDeductedToday), tone: "text-rose-300" },
            { label: "Net coins today", value: n(s.netCoinsToday), tone: (s.netCoinsToday ?? 0) >= 0 ? "text-emerald-300" : "text-rose-300" },
            { label: "Transactions today", value: n(s.txToday), tone: "text-mist-100" },
            // Income / Expense / Net here are MONEY (INR), matching the spec: income =
            // paid revenue, expense = free coins issued × coin value.
            { label: "Income amount today", value: money(s.incomeAmountToday ?? 0), tone: "text-emerald-300", sub: "paid revenue" },
            { label: "Expense amount today", value: money(s.expenseAmountToday ?? 0), tone: "text-rose-300", sub: `${n(s.freeCoinsToday)} free coins × ${money(coinValue)}` },
            { label: "Net profit / loss", value: money(s.netAmountToday ?? 0), tone: (s.netAmountToday ?? 0) >= 0 ? "text-emerald-300" : "text-rose-300", sub: "income − expense" },
            { label: "Active users today", value: n(s.activeUsersToday), tone: "text-mist-100" },
          ].map((c) => (
            <Card key={c.label} className="p-3.5">
              <div className="text-[11px] text-mist-400">{c.label}</div>
              <div className={cn("mt-1 font-display text-xl font-extrabold tabular-nums", c.tone)}>{c.value}</div>
              {c.sub && <div className="text-[10px] text-mist-500">{c.sub}</div>}
            </Card>
          ))}
        </div>
        {(s.pendingTransactions ?? 0) > 0 && (
          <p className="mt-2 text-xs text-amber-300">{n(s.pendingTransactions)} transaction(s) still <b>pending</b> — filter by status &ldquo;pending&rdquo; below to review them.</p>
        )}
      </div>

      {/* ── WHERE COINS COME FROM / WHERE THEY GO ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {([
          { title: "Income — where coins come from", keys: data?.incomeSources ?? [], all: data?.income ?? {}, today: data?.incomeToday ?? {}, tone: "text-emerald-300", bar: "bg-emerald-500/70" },
          { title: "Expenses — where coins go", keys: data?.expenseSources ?? [], all: data?.expense ?? {}, today: data?.expenseToday ?? {}, tone: "text-rose-300", bar: "bg-rose-500/70" },
        ]).map((panel) => {
          const total = panel.keys.reduce((sum, k) => sum + (panel.all[k] ?? 0), 0);
          return (
            <Card key={panel.title} className="p-4">
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h2 className="font-semibold text-mist-100">{panel.title}</h2>
                <span className={cn("font-display text-lg font-extrabold tabular-nums", panel.tone)}>{n(total)}</span>
              </div>
              <div className="space-y-1.5">
                {panel.keys.map((k) => {
                  const v = panel.all[k] ?? 0;
                  const t = panel.today[k] ?? 0;
                  const pct = total > 0 ? Math.round((v / total) * 100) : 0;
                  return (
                    <div key={k}>
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="truncate text-mist-300">{k}</span>
                        <span className="shrink-0 tabular-nums text-mist-200">
                          {n(v)}
                          {t > 0 && <span className={cn("ml-1.5", panel.tone)}>+{n(t)} today</span>}
                        </span>
                      </div>
                      <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                        <div className={cn("h-full rounded-full", panel.bar)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                {panel.keys.length === 0 && <p className="py-4 text-center text-xs text-mist-500">No data yet.</p>}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Ledger */}
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-mist-100">Complete transaction ledger <span className="font-normal text-mist-500">({shown.length} of {rows.length})</span></h2>
          <div className="flex flex-wrap gap-1.5">
            <Button variant="secondary" size="sm" onClick={exportCsv} disabled={shown.length === 0}><Download className="size-4" /> CSV</Button>
            <Button variant="secondary" size="sm" onClick={exportXls} disabled={shown.length === 0}><FileSpreadsheet className="size-4" /> Excel</Button>
            <Button variant="secondary" size="sm" onClick={exportPdf} disabled={shown.length === 0}><Printer className="size-4" /> PDF / Print</Button>
          </div>
        </div>

        {/* Date presets + filters + search */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.key} onClick={() => setPreset(p.key)} className={cn("rounded-full px-3 py-1.5 text-xs font-semibold transition", preset === p.key ? "bg-lotus-500/25 text-lotus-100" : "bg-white/[0.05] text-mist-400 hover:bg-white/[0.1]")}>{p.label}</button>
          ))}
          {preset === "custom" && (
            <span className="flex items-center gap-1.5">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inp} />
              <span className="text-xs text-mist-500">to</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inp} />
            </span>
          )}
        </div>

        {/* REVENUE & PROFIT for the selected period (INR). Income = real-money
            purchases; Expense = free/promotional coins given out × coin value.
            Recomputes live with the period + filters above. */}
        <Card className="mb-3 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-display text-base font-bold text-mist-100"><TrendingUp className="size-5 text-emerald-300" /> Revenue &amp; Profit — {periodLabel}</h3>
            <span className="text-[11px] text-mist-500">Coin value: {money(coinValue)} each ({coinsPerUnit} coins = {currency === "INR" ? "₹1" : `1 ${currency}`})</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <FinCell label="Total Income" value={money(fin.incomeInr)} tone="text-emerald-300" />
            <FinCell label="Total Expense" value={money(fin.expenseInr)} tone="text-rose-300" hint="free coins issued" />
            <FinCell label="Net Profit" value={money(fin.netProfit)} tone={fin.netProfit >= 0 ? "text-emerald-300" : "text-rose-300"} />
            <FinCell label="Profit Margin" value={`${fin.margin}%`} tone={fin.margin >= 0 ? "text-lotus-200" : "text-rose-300"} />
            <FinCell label="Coins Purchased" value={n(fin.coinsPurchased)} tone="text-gold-300" hint={`${fin.paidTx} paid tx`} />
            <FinCell label="Free Coins Given" value={n(fin.freeCoins)} tone="text-sky-300" hint={`${fin.freeTx} free tx`} />
          </div>
          <p className="mt-2 text-[11px] text-mist-500">
            <b className="text-mist-400">Net Profit</b> = Income − Expense (this is also the Gross Profit — no other operating costs are paid in coins). <b className="text-mist-400">Income</b> = real-money paid revenue only. <b className="text-mist-400">Expense</b> = every free / promotional coin the platform issued (welcome, daily login, referral, spin, level-up, event, tournament, admin-gifted, cashback…) × coin value. Values follow the coin→money rate set in <b className="text-mist-400">Paid Zone → Coin withdrawal</b>. The <b className="text-mist-400">Today&apos;s accounting</b> panel above uses this same definition. Use CSV / Excel / PDF above to export.
          </p>
        </Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-mist-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Tx ID / user ID / name / group / reference / date…" className={cn(inp, "w-80 pl-8")} />
          </label>
          <select value={fType} onChange={(e) => setFType(e.target.value)} className={inp}>
            <option value="">All types</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={fModule} onChange={(e) => setFModule(e.target.value)} className={inp}>
            <option value="">All modules</option>
            {modules.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={inp}>
            <option value="">All statuses</option>
            {["success", "pending", "failed", "approved", "completed", "rejected"].map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          {methods.length > 0 && (
            <select value={fMethod} onChange={(e) => setFMethod(e.target.value)} className={inp}>
              <option value="">All payment methods</option>
              {methods.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          <span className="flex items-center gap-1 text-xs text-mist-500">
            <input type="number" min={0} value={coinMin} onChange={(e) => setCoinMin(e.target.value)} placeholder="coins ≥" className={cn(inp, "w-24")} />
            <span>–</span>
            <input type="number" min={0} value={coinMax} onChange={(e) => setCoinMax(e.target.value)} placeholder="coins ≤" className={cn(inp, "w-24")} />
          </span>
          {(q || fType || fModule || fStatus || fMethod || coinMin || coinMax || preset !== "all") && (
            <button onClick={() => { setQ(""); setFType(""); setFModule(""); setFStatus(""); setFMethod(""); setCoinMin(""); setCoinMax(""); setPreset("all"); setFrom(""); setTo(""); }} className="rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-xs font-semibold text-mist-300 hover:bg-white/[0.12]">Clear</button>
          )}
        </div>

        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wide text-mist-500">
                <tr>
                  <th className="px-4 py-3">Transaction</th>
                  <SortTh col="user" sort={tmSort} dir={tmDir} onSort={sortLedger}>User</SortTh>
                  <th className="px-4 py-3">Type / Module</th>
                  <SortTh col="in" sort={tmSort} dir={tmDir} onSort={sortLedger}>In</SortTh>
                  <SortTh col="out" sort={tmSort} dir={tmDir} onSort={sortLedger}>Out</SortTh>
                  <th className="px-4 py-3">Balance</th>
                  <SortTh col="status" sort={tmSort} dir={tmDir} onSort={sortLedger}>Status</SortTh>
                  <SortTh col="when" sort={tmSort} dir={tmDir} onSort={sortLedger}>When</SortTh>
                  <th className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {sortedShown.slice(0, 500).map((r) => {
                  const isOpen = open === r.id;
                  return (
                    <React.Fragment key={r.source + r.id + r.at}>
                      <tr className="cursor-pointer hover:bg-white/[0.02]" onClick={() => setOpen(isOpen ? null : r.id)}>
                        <td className="px-4 py-2.5">
                          <span className="block max-w-44 truncate font-mono text-[11px] text-mist-300">{r.id}</span>
                          {r.note && <span className="block max-w-44 truncate text-[10px] text-mist-500">{r.note}</span>}
                        </td>
                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <Link href={`/admin/users?q=${encodeURIComponent(r.publicId || r.userId)}`} className="hover:underline">
                            <span className="block font-medium text-mist-100 hover:text-lotus-300">{r.userName}</span>
                            <span className="block font-mono text-[10px] text-mist-600">ID {r.publicId ?? r.userId}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="block text-xs font-semibold text-mist-200">{r.type}</span>
                          <span className="block text-[10px] text-mist-500">{r.module}</span>
                        </td>
                        <td className="px-4 py-2.5 font-semibold tabular-nums text-emerald-300">{r.coinsIn ? `+${n(r.coinsIn)}` : r.lotus && r.type !== "Withdrawal" ? `+${n(r.lotus)} 🪷` : "—"}</td>
                        <td className="px-4 py-2.5 font-semibold tabular-nums text-petal-300">{r.coinsOut ? `−${n(r.coinsOut)}` : r.lotus && r.type === "Withdrawal" ? `−${n(r.lotus)} 🪷` : "—"}</td>
                        <td className="px-4 py-2.5 text-xs tabular-nums text-mist-300">{r.walletBefore != null ? `${n(r.walletBefore)} → ${n(r.walletAfter)}` : "—"}</td>
                        <td className="px-4 py-2.5">
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold capitalize", r.status === "failed" || r.status === "rejected" ? "bg-rose-500/15 text-rose-300" : r.status === "pending" ? "bg-amber-500/15 text-amber-300" : r.status === "approved" ? "bg-sky-500/15 text-sky-300" : "bg-emerald-500/15 text-emerald-300")}>{r.status}</span>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs text-mist-500">{new Date(r.at).toLocaleString("en-SA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                        <td className="px-4 py-2.5 text-right"><ChevronDown className={cn("ml-auto size-4 text-mist-500 transition", isOpen && "rotate-180")} /></td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-ink-900/50">
                          <td colSpan={9} className="px-5 py-4">
                            <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                              <Fld label="Transaction ID" value={r.id} mono />
                              <Fld label="Reference" value={r.ref ?? "—"} mono />
                              <Fld label="Source" value={`${r.source} · ${r.module}`} />
                              <Fld label="Date & time" value={new Date(r.at).toLocaleString("en-GB")} />
                              {r.fromName && <Fld label="From" value={`${r.fromName} (${r.fromPublicId ?? r.fromId})`} />}
                              {r.toName && <Fld label="To" value={`${r.toName} (${r.toPublicId ?? r.toId})`} />}
                              <Fld label="Wallet before → after" value={r.walletBefore != null ? `${n(r.walletBefore)} → ${n(r.walletAfter)} coins` : "— (not recorded)"} />
                              {(r.lotusBefore != null || r.lotus != null) && <Fld label="Lotus" value={r.lotusBefore != null ? `${n(r.lotusBefore)} → ${n(r.lotusAfter)}` : `${n(r.lotus)}`} />}
                              {(r.userProfit != null || r.companyProfit != null) && <Fld label="Profit split (User/Company/Agency/Trust)" value={`${n(r.userProfit)} / ${n(r.companyProfit)} / ${n(r.agencyProfit)} / ${n(r.trustProfit)}`} />}
                              {(r.gst != null || r.fee != null || r.net != null) && <Fld label="GST / Fee / Net" value={`${n(r.gst)} / ${n(r.fee)} / ${n(r.net)}`} />}
                              {r.amount != null && r.amount > 0 && <Fld label="Cash amount" value={n(r.amount)} />}
                              {r.method && <Fld label="Payment method" value={r.method} />}
                              {r.roomName && <Fld label="Group" value={`${r.roomName} (${r.roomId})`} />}
                            </div>
                            {r.note && <p className="mt-2 rounded-lg bg-ink-800/60 px-3 py-1.5 text-xs text-mist-300">{r.note}</p>}
                            {/* Full party-by-party breakdown: who paid, who received,
                                and each profit party's share (the client's table). */}
                            {(r.userProfit != null || r.companyProfit != null) && <PartyBreakdown r={r} rate={s.lotusRate} />}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {!loading && shown.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-mist-500">{rows.length === 0 ? "No transactions recorded yet." : "No transactions match this search/filter."}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        <p className="mt-2 text-[11px] text-mist-500">Live — refreshes every 15s. Table shows the first 500 matching rows; exports include ALL matching rows with every column. Tap a row for the complete audit (balances, splits, GST/fee, references).</p>
      </div>
    </div>
  );
}

// Full party-by-party breakdown of one distribution (gift / call / reward):
// what the sender paid and what each party (Receiver / Company / Agency / Trust)
// received — in coins AND Lotus — with the sender's & receiver's wallet before→after.
function PartyBreakdown({ r, rate }: { r: Row; rate?: number }) {
  const lotusMode = !!r.receiverUnit && r.receiverUnit !== "coins";
  const rr = rate && rate > 0 ? rate : 1; // Lotus per 1 coin
  const c = (v?: number) => (v ?? 0).toLocaleString("en-SA", { maximumFractionDigits: 2 });
  // A recorded share value → its coin-equivalent and Lotus-equivalent.
  const coinOf = (share?: number) => (lotusMode ? (share ?? 0) / rr : (share ?? 0));
  const lotusOf = (share?: number) => (lotusMode ? (share ?? 0) : (share ?? 0) * rr);
  const rows: { label: string; tone: string; sign: string; coin: number; lotus: number; wallet?: string }[] = [
    { label: "Sender paid", tone: "text-petal-300", sign: "−", coin: r.coinsOut || 0, lotus: (r.coinsOut || 0) * rr, wallet: r.walletBefore != null ? `${c(r.walletBefore)} → ${c(r.walletAfter)} coins` : undefined },
    { label: "Receiver got", tone: "text-emerald-300", sign: "+", coin: coinOf(r.userProfit), lotus: lotusOf(r.userProfit), wallet: r.lotusBefore != null ? `${c(r.lotusBefore)} → ${c(r.lotusAfter)} ${r.receiverUnit ?? ""}` : (r.walletBefore != null && !lotusMode ? undefined : undefined) },
    { label: "Company", tone: "text-fuchsia-300", sign: "+", coin: coinOf(r.companyProfit), lotus: lotusOf(r.companyProfit) },
    { label: "Agency", tone: "text-sky-300", sign: "+", coin: coinOf(r.agencyProfit), lotus: lotusOf(r.agencyProfit) },
    { label: "Trust", tone: "text-amber-300", sign: "+", coin: coinOf(r.trustProfit), lotus: lotusOf(r.trustProfit) },
  ];
  return (
    <div className="mt-3">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-mist-500">Full breakdown — who received what</div>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-ink-800/60 text-left text-[10px] uppercase text-mist-500">
              <th className="px-3 py-2">Party</th>
              <th className="px-3 py-2 text-right">Coin value</th>
              <th className="px-3 py-2 text-right">Lotus value</th>
              <th className="px-3 py-2">Wallet before → after</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-white/5">
                <td className={cn("px-3 py-1.5 font-semibold", row.tone)}>{row.label}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-mist-100">{row.sign}{c(row.coin)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-lotus-200">{row.sign}{c(row.lotus)}</td>
                <td className="px-3 py-1.5 text-mist-400">{row.wallet ?? "— (pooled)"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-[10px] text-mist-600">{lotusMode ? "Economy is in Lotus — coin values are the coin-equivalent at the current rate." : "Coin mode — Lotus values are the Lotus-equivalent at the current rate."} Company/Agency/Trust shares accumulate in their profit pools (per-transaction pool balances aren&apos;t stored historically).</p>
    </div>
  );
}

function FinCell({ label, value, tone, hint }: { label: string; value: string; tone: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-ink-900 p-3">
      <div className="text-[11px] text-mist-400">{label}</div>
      <div className={cn("mt-1 font-display text-xl font-extrabold tabular-nums", tone)}>{value}</div>
      {hint && <div className="text-[10px] text-mist-600">{hint}</div>}
    </div>
  );
}

function Fld({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-ink-800/50 px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wide text-mist-500">{label}</div>
      <div className={cn("mt-0.5 text-mist-100", mono && "font-mono text-[11px]")}>{value}</div>
    </div>
  );
}
