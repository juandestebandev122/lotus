"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import {
  Calculator, Coins, Wallet, ArrowDownToLine, ArrowUpFromLine, Gift,
  BookOpen, ExternalLink, RefreshCw,
} from "lucide-react";

interface Row { key: string; label: string; coins: number; count: number; inr?: number; note?: string }
interface Report {
  coinsPerUnit: number; coinValue: number; currency: string;
  purchased: Row;
  free: Row[]; freeTotal: number; freeCount: number;
  refunds: Row;
  transfers: Row[];
  removed: Row[];
  giftSplit: { count: number; cost: number; receiverShare: number; companyShare: number; agencyShare: number; trustShare: number };
  totals: { createdTotal: number; inflow: number; outflow: number; circulation: number; drift: number };
  company: { companyProfit: number; userProfit: number; agencyProfit: number; trustProfit: number };
  moneyView: { cashIn: number; freeCoinCost: number };
}

const n = (v: number | undefined) => (v ?? 0).toLocaleString("en-SA", { maximumFractionDigits: 2 });

// The plain-language glossary — one entry per number the admin sees elsewhere.
const GLOSSARY: { term: string; where: string; href: string; meaning: string }[] = [
  { term: "Coins in circulation", where: "Dashboard", href: "/admin", meaning: "Coins sitting in ALL member wallets right now. This is the one true “coins that exist” number — everything else explains how it got there." },
  { term: "Coins Purchased", where: "Transaction Management", href: "/admin/transaction-management", meaning: "Coins members bought with real money. The ONLY coins that bring cash income." },
  { term: "Free Coins Given", where: "Transaction Management + Free Coins", href: "/admin/free-coins", meaning: "Every coin the platform handed out for free — welcome bonus, daily login, Lucky Spin, level rewards, competition prizes, and admin manual credits. Both pages now use this SAME definition, so they show the same total. Gift transfers between members and Paid-Zone call earnings are NOT free coins (that value came from another member’s wallet)." },
  { term: "Income — where coins come from", where: "Transaction Management", href: "/admin/transaction-management", meaning: "All coins that ENTERED wallets, counted in coins (purchases + free coins + transfers). It is a coin-flow view, not money." },
  { term: "Total Income (₹)", where: "Revenue & Profit strip", href: "/admin/transaction-management", meaning: "Real money received from coin purchases only. Free coins never count as money income." },
  { term: "Total Expense (₹)", where: "Revenue & Profit strip", href: "/admin/transaction-management", meaning: "The money VALUE of the free coins given away (free coins × coin value). Give fewer free coins and this falls." },
  { term: "Admin Profit", where: "Dashboard + Admin Profit", href: "/admin/company-profit", meaning: "The company’s own coin earnings — its share of gifts, Paid-Zone calls, fees. Held by the company, not in member wallets." },
];

export default function AdminCoinCalculationPage() {
  const [r, setR] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(withBase("/api/admin/coin-calculation"), { credentials: "include", cache: "no-store" });
      const d = await res.json();
      if (res.ok) setR(d);
    } catch { /* stays on the previous numbers */ }
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const Section = ({ title, icon: Icon, tint, children, sub }: {
    title: string; icon: typeof Coins; tint: string; sub?: string; children: React.ReactNode;
  }) => (
    <Card className="p-0">
      <div className="flex items-start gap-2.5 border-b border-white/5 px-5 py-4">
        <Icon className={cn("mt-0.5 size-4 shrink-0", tint)} />
        <div>
          <h2 className="text-sm font-bold text-mist-100">{title}</h2>
          {sub && <p className="mt-0.5 text-xs text-mist-500">{sub}</p>}
        </div>
      </div>
      {children}
    </Card>
  );

  const RowsTable = ({ rows, totalLabel, total }: { rows: Row[]; totalLabel?: string; total?: number }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-mist-500">
            <th className="px-5 py-2.5 font-semibold">Item</th>
            <th className="px-5 py-2.5 text-right font-semibold">Times</th>
            <th className="px-5 py-2.5 text-right font-semibold">Coins</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-white/5 last:border-0">
              <td className="px-5 py-2.5">
                <div className="text-mist-100">{row.label}</div>
                {row.note && <div className="text-[11px] text-mist-500">{row.note}</div>}
              </td>
              <td className="px-5 py-2.5 text-right tabular-nums text-mist-400">{row.count.toLocaleString("en-SA")}</td>
              <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-mist-100">
                {n(row.coins)}
                {typeof row.inr === "number" && row.inr > 0 && <span className="ml-1.5 text-[11px] font-medium text-emerald-300">(₹{n(row.inr)})</span>}
              </td>
            </tr>
          ))}
          {typeof total === "number" && (
            <tr className="bg-white/[0.03]">
              <td className="px-5 py-2.5 text-sm font-bold text-mist-100">{totalLabel}</td>
              <td />
              <td className="px-5 py-2.5 text-right text-sm font-bold tabular-nums text-lotus-200">{n(total)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold text-mist-50"><Calculator className="size-5 text-lotus-300" /> Coin Calculation</h1>
          <p className="mt-1 text-sm text-mist-500">
            One table that explains every coin number — where coins come from, where they go, and what is left in wallets.
          </p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-mist-300 transition hover:bg-white/5 disabled:opacity-60">
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} /> Refresh
        </button>
      </div>

      {!r ? (
        <Card className="p-8 text-center text-sm text-mist-500">{loading ? "Calculating…" : "Could not load the report."}</Card>
      ) : (
        <>
          {/* The four headline numbers */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Coins in circulation", sub: "in all member wallets right now", value: n(r.totals.circulation), icon: Wallet, tint: "text-lotus-300" },
              { label: "Coins created (all-time)", sub: "purchases + free coins + refunds", value: n(r.totals.createdTotal), icon: ArrowDownToLine, tint: "text-emerald-300" },
              { label: "Coins removed (all-time)", sub: "gifts, spends, deductions, cash-outs", value: n(r.totals.outflow), icon: ArrowUpFromLine, tint: "text-petal-300" },
              { label: "Coin value", sub: `${r.coinsPerUnit} coins = 1 ${r.currency === "INR" ? "₹" : r.currency}`, value: `${r.currency === "INR" ? "₹" : r.currency + " "}${n(r.coinValue)}`, icon: Coins, tint: "text-gold-300" },
            ].map((s) => (
              <Card key={s.label} className="p-4">
                <s.icon className={cn("size-4", s.tint)} />
                <div className="mt-2 text-xl font-extrabold tabular-nums text-mist-50">{s.value}</div>
                <div className="text-xs font-semibold text-mist-300">{s.label}</div>
                <div className="text-[11px] text-mist-500">{s.sub}</div>
              </Card>
            ))}
          </div>

          {/* A. Created */}
          <Section title="1 · Coins created — how coins enter the app" icon={ArrowDownToLine} tint="text-emerald-300"
            sub="Coins exist only when the platform creates them: a purchase, a free reward, or a refund.">
            <RowsTable
              rows={[r.purchased, ...r.free.map((f) => ({ ...f, label: `Free: ${f.label}` })), r.refunds].filter((row) => row.count > 0)}
              totalLabel="Total coins created" total={r.totals.createdTotal}
            />
          </Section>

          {/* B. Moved */}
          <Section title="2 · Coins moved between members — no new coins" icon={Gift} tint="text-sky-300"
            sub="Gifts and Paid-Zone calls move EXISTING coins from one member to another. They change who holds the coins, not how many exist.">
            <RowsTable rows={r.transfers.filter((row) => row.count > 0)} />
            {r.giftSplit.count > 0 && (
              <div className="border-t border-white/5 px-5 py-4 text-xs">
                <p className="font-semibold text-mist-300">Where every gifted coin goes ({r.giftSplit.count.toLocaleString("en-SA")} gifts, {n(r.giftSplit.cost)} coins sent):</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                  {[
                    ["To the receiver", r.giftSplit.receiverShare, "text-emerald-300"],
                    ["Company share", r.giftSplit.companyShare, "text-lotus-300"],
                    ["Agency share", r.giftSplit.agencyShare, "text-sky-300"],
                    ["Trust share", r.giftSplit.trustShare, "text-gold-300"],
                  ].map(([label, v, tint]) => (
                    <div key={label as string} className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
                      <div className={cn("text-sm font-bold tabular-nums", tint as string)}>{n(v as number)}</div>
                      <div className="text-[11px] text-mist-500">{label as string}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* C. Removed */}
          <Section title="3 · Coins removed — how coins leave wallets" icon={ArrowUpFromLine} tint="text-petal-300"
            sub="Spending on the platform, admin deductions and cash-outs take coins OUT of member wallets.">
            <RowsTable rows={r.removed.filter((row) => row.count > 0)} totalLabel="Total coins removed" total={r.totals.outflow} />
          </Section>

          {/* The check */}
          <Section title="4 · The check — does it add up?" icon={Calculator} tint="text-lotus-300">
            <div className="px-5 py-4 text-sm">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2.5">
                  <div className="text-lg font-bold tabular-nums text-emerald-300">{n(r.totals.inflow)}</div>
                  <div className="text-[11px] text-mist-500">All coins that entered wallets</div>
                </div>
                <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2.5">
                  <div className="text-lg font-bold tabular-nums text-petal-300">− {n(r.totals.outflow)}</div>
                  <div className="text-[11px] text-mist-500">All coins that left wallets</div>
                </div>
                <div className="rounded-lg border border-lotus-400/30 bg-lotus-500/[0.08] px-3 py-2.5">
                  <div className="text-lg font-bold tabular-nums text-lotus-200">= {n(r.totals.circulation)} in wallets</div>
                  <div className="text-[11px] text-mist-500">
                    {Math.abs(r.totals.drift) > 0.01
                      ? `includes ${n(r.totals.drift)} from old test-data cleanups kept in balances`
                      : "matches the ledger exactly"}
                  </div>
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2.5">
                  <div className="text-sm font-bold tabular-nums text-emerald-300">₹{n(r.moneyView.cashIn)}</div>
                  <div className="text-[11px] text-mist-500">Real money received (coin purchases)</div>
                </div>
                <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2.5">
                  <div className="text-sm font-bold tabular-nums text-petal-300">₹{n(r.moneyView.freeCoinCost)}</div>
                  <div className="text-[11px] text-mist-500">Money value of all free coins given</div>
                </div>
                <div className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2.5">
                  <div className="text-sm font-bold tabular-nums text-gold-300">{n(r.company.companyProfit)} coins</div>
                  <div className="text-[11px] text-mist-500">Company profit (gift/call/fee shares)</div>
                </div>
              </div>
            </div>
          </Section>

          {/* Glossary */}
          <Section title="What each number on the other pages means" icon={BookOpen} tint="text-gold-300"
            sub="The same coins can be counted from different angles — this is what every screen is really showing.">
            <div className="divide-y divide-white/5">
              {GLOSSARY.map((g) => (
                <div key={g.term} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-mist-100">{g.term}</span>
                    <Link href={g.href} className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-mist-400 transition hover:text-lotus-200">
                      {g.where} <ExternalLink className="size-2.5" />
                    </Link>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-mist-400">{g.meaning}</p>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
