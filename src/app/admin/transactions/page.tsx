"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { fetchAllTransactions, adminAdjustWallet, type WalletTransaction, type WalletRow } from "@/lib/wallet";
import { ViolationsPanel } from "@/components/admin/ViolationsPanel";
import { KycPanel } from "@/components/admin/KycPanel";
import { WithdrawalsPanel } from "@/components/admin/WithdrawalsPanel";
import { ReportFilters, matchesReportFilter, emptyReportFilter, type ReportFilter } from "@/components/admin/ReportFilters";
import { cn } from "@/lib/cn";
import { Banknote, Coins, Wallet, Download, Plus, Minus, X, Gift, ArrowRight, Search } from "lucide-react";

const TAB_LABELS: Record<string, string> = {
  transactions: "Transactions",
  wallets: "Wallets",
  withdrawals: "Withdrawals",
  violations: "Violations & Penalties",
  kyc: "KYC Verification",
};

const STATUS: Record<string, string> = {
  success: "bg-emerald-500/15 text-emerald-300",
  pending: "bg-amber-500/15 text-amber-300",
  failed: "bg-rose-500/15 text-rose-300",
};

export default function AdminTransactionsPage() {
  const { toast } = useToast();
  const [txns, setTxns] = useState<WalletTransaction[]>([]);
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [revenue, setRevenue] = useState(0);
  const [giftSpend, setGiftSpend] = useState(0);
  const [tab, setTab] = useState<"transactions" | "wallets" | "withdrawals" | "violations" | "kyc">("transactions");
  const [filter, setFilter] = useState<"all" | "success" | "pending" | "failed">("all");
  const [repFilter, setRepFilter] = useState<ReportFilter>(emptyReportFilter);
  const [adjust, setAdjust] = useState<WalletRow | null>(null);
  // Wallets tab: search + sort.
  const [walletQ, setWalletQ] = useState("");
  const [walletHas, setWalletHas] = useState<"all" | "coins" | "lotus">("all");
  const [walletSort, setWalletSort] = useState<"name" | "id" | "coins" | "lotus">("coins");
  const [walletDir, setWalletDir] = useState<"asc" | "desc">("desc");

  const load = () => fetchAllTransactions().then((d) => { setTxns(d.transactions); setWallets(d.wallets); setRevenue(d.revenue); setGiftSpend(d.giftSpend); });
  useEffect(() => { load(); }, []);

  // Total coins sold = sum of all successful coin purchases.
  const coinsSold = useMemo(
    () => txns.filter((t) => t.type === "purchase" && t.status === "success").reduce((s, t) => s + t.coins, 0),
    [txns],
  );

  const shownTxns = useMemo(
    () => txns.filter((t) => (filter === "all" || t.status === filter) && matchesReportFilter(repFilter, t.createdAt, `${t.userName} ${t.description}`)),
    [txns, filter, repFilter],
  );

  // Wallets: filter by name / email / ID + balance presence, then sort.
  const shownWallets = useMemo(() => {
    const q = walletQ.trim().toLowerCase();
    const list = wallets.filter((w) => {
      if (walletHas === "coins" && (w.coins ?? 0) <= 0) return false;
      if (walletHas === "lotus" && (w.lotus ?? 0) <= 0) return false;
      if (!q) return true;
      return [w.fullName, w.email, w.publicId, w.id].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
    const dir = walletDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      let r = 0;
      if (walletSort === "name") r = (a.fullName || "").localeCompare(b.fullName || "");
      else if (walletSort === "id") r = (a.publicId || "").localeCompare(b.publicId || "", undefined, { numeric: true });
      else if (walletSort === "coins") r = (a.coins ?? 0) - (b.coins ?? 0);
      else r = (a.lotus ?? 0) - (b.lotus ?? 0);
      return r * dir;
    });
  }, [wallets, walletQ, walletHas, walletSort, walletDir]);

  // Click a column header to sort by it; click again to flip the direction.
  const sortBy = (col: "name" | "id" | "coins" | "lotus") => {
    if (walletSort === col) setWalletDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setWalletSort(col); setWalletDir(col === "name" || col === "id" ? "asc" : "desc"); }
  };
  const sortArrow = (col: string) => (walletSort === col ? (walletDir === "asc" ? " ▲" : " ▼") : "");

  const exportCsv = () => {
    const rows = [
      ["Date", "Transaction ID", "ID Number", "User", "Type", "Coins", "Amount (INR)", "Status", "Balance After", "Description"],
      ...shownTxns.map((t) => [new Date(t.createdAt).toLocaleString("en-SA"), t.id, t.publicId ?? "", t.userName, t.type, String(t.coins), String(t.amount), t.status, String(t.balanceAfter), `"${t.description.replace(/"/g, "'")}"`]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lotus-transactions.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast("Transaction report exported", "success");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-mist-100">Financial management</h1>
          <p className="text-sm text-mist-400">Wallets, coin purchases, gift spending &amp; transaction logs.</p>
        </div>
        <Button variant="secondary" onClick={exportCsv}><Download className="size-4" /> Export CSV</Button>
      </div>

      {/* Every figure is CLICKABLE — it opens the list the number came from, so an
          admin can always see what makes up a total instead of guessing. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Banknote} tone="text-emerald-300"
          value={`₹${revenue.toLocaleString("en-SA")}`}
          label="Total revenue (INR)"
          hint="See the successful purchases behind this"
          onClick={() => { setTab("transactions"); setFilter("success"); }}
        />
        <StatCard
          icon={Coins} tone="text-gold-300"
          value={coinsSold.toLocaleString("en-SA")}
          label="Total coins sold"
          hint="See every coin purchase"
          onClick={() => { setTab("transactions"); setFilter("success"); }}
        />
        <StatCard
          icon={Gift} tone="text-petal-400"
          value={giftSpend.toLocaleString("en-SA")}
          label="Coins spent on gifts"
          hint="Open the full gift activity report"
          href="/admin/gifts"
        />
        <StatCard
          icon={Wallet} tone="text-lotus-300"
          value={wallets.length.toLocaleString("en-SA")}
          label="User wallets"
          hint="See every user's balance"
          onClick={() => setTab("wallets")}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(["transactions", "wallets", "withdrawals", "violations", "kyc"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("rounded-full px-4 py-1.5 text-sm font-semibold transition", tab === t ? "bg-lotus-600 text-white" : "border border-line bg-ink-800 text-mist-400 hover:text-mist-100")}>{TAB_LABELS[t]}</button>
        ))}
      </div>

      {tab === "withdrawals" && <WithdrawalsPanel />}
      {tab === "violations" && <ViolationsPanel wallets={wallets} />}
      {tab === "kyc" && <KycPanel />}

      {tab === "transactions" && (
        <>
          <div className="space-y-2">
            <ReportFilters value={repFilter} onChange={setRepFilter} />
            <div className="flex flex-wrap items-center gap-2">
              {(["all", "success", "pending", "failed"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={cn("rounded-full px-3 py-1.5 text-xs font-semibold capitalize", filter === f ? "bg-lotus-500/20 text-lotus-200" : "bg-ink-800 text-mist-400 hover:text-mist-100")}>{f}</button>
              ))}
              <span className="ml-auto text-xs text-mist-500">{shownTxns.length} shown</span>
            </div>
          </div>
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-mist-500">
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Description</th>
                    <th className="px-4 py-3 font-semibold">Coins</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shownTxns.map((t) => {
                    const credit = t.type === "purchase" || t.type === "credit";
                    return (
                      <tr key={t.id} className="border-b border-white/5 last:border-0">
                        <td className="px-4 py-3 text-xs text-mist-400">{new Date(t.createdAt).toLocaleString("en-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                        <td className="px-4 py-3">
                          <Link href={`/admin/users?q=${encodeURIComponent(t.publicId || t.userId)}`} className="text-mist-200 hover:text-lotus-300 hover:underline">
                            {t.userName}
                          </Link>
                          {t.publicId && <span className="ml-1.5 font-mono text-[11px] font-bold text-lotus-300">ID {t.publicId}</span>}
                        </td>
                        <td className="px-4 py-3 text-mist-300">{t.description}</td>
                        <td className={cn("px-4 py-3 font-semibold tabular-nums", credit ? "text-emerald-300" : "text-petal-300")}>{credit ? "+" : "−"}{t.coins.toLocaleString("en-SA")}</td>
                        <td className="px-4 py-3 text-mist-400">{t.amount ? `₹${t.amount}` : "—"}</td>
                        <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", STATUS[t.status])}>{t.status}</span></td>
                      </tr>
                    );
                  })}
                  {shownTxns.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-mist-500">No transactions match.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {tab === "wallets" && (
        <>
        {/* Filter + sort bar for the wallets list. */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-mist-500" />
            <input value={walletQ} onChange={(e) => setWalletQ(e.target.value)} placeholder="Search name / email / ID…" className="h-9 w-72 rounded-lg border border-line bg-ink-800 pl-8 pr-3 text-sm text-mist-100 outline-none focus:border-lotus-400" />
          </label>
          <div className="flex overflow-hidden rounded-lg border border-line">
            {([["all", "All"], ["coins", "Has coins"], ["lotus", "Has Lotus"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => setWalletHas(v)} className={cn("px-3 py-1.5 text-xs font-semibold transition", walletHas === v ? "bg-lotus-500 text-white" : "bg-ink-800 text-mist-300 hover:bg-white/[0.06]")}>{l}</button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-mist-400">
            Sort
            <select value={walletSort} onChange={(e) => setWalletSort(e.target.value as "name" | "id" | "coins" | "lotus")} className="h-9 rounded-lg border border-line bg-ink-800 px-2 text-sm text-mist-100 outline-none focus:border-lotus-400">
              <option value="coins">Coin balance</option>
              <option value="lotus">Lotus balance</option>
              <option value="name">Name</option>
              <option value="id">ID number</option>
            </select>
          </label>
          <button onClick={() => setWalletDir((d) => (d === "asc" ? "desc" : "asc"))} title="Reverse order" className="inline-flex items-center gap-1 rounded-lg border border-line bg-ink-800 px-3 py-1.5 text-xs font-semibold text-mist-200 hover:bg-white/[0.06]">
            {walletDir === "asc" ? "Ascending ▲" : "Descending ▼"}
          </button>
          <span className="ml-auto text-xs text-mist-500">{shownWallets.length} of {wallets.length}</span>
        </div>
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-mist-500">
                  <th className="px-4 py-3 font-semibold"><button onClick={() => sortBy("name")} className="uppercase tracking-wide hover:text-mist-200">User{sortArrow("name")}</button></th>
                  <th className="px-4 py-3 font-semibold"><button onClick={() => sortBy("id")} className="uppercase tracking-wide hover:text-mist-200">ID number{sortArrow("id")}</button></th>
                  <th className="px-4 py-3 font-semibold"><button onClick={() => sortBy("coins")} className="uppercase tracking-wide hover:text-mist-200">Coin balance{sortArrow("coins")}</button></th>
                  <th className="px-4 py-3 font-semibold"><button onClick={() => sortBy("lotus")} className="uppercase tracking-wide hover:text-mist-200">Lotus balance{sortArrow("lotus")}</button></th>
                  <th className="px-4 py-3 text-right font-semibold">Adjust</th>
                </tr>
              </thead>
              <tbody>
                {shownWallets.map((w) => (
                  <tr key={w.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/admin/users?q=${encodeURIComponent(w.publicId || w.id)}`} className="flex items-center gap-3 hover:opacity-80">
                        <Avatar name={w.fullName} size="sm" />
                        <div>
                          <div className="font-semibold text-mist-100">{w.fullName}</div>
                          <div className="text-xs text-mist-500">{w.email || "—"}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-mist-300">{w.publicId ?? "—"}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-gold-300">{w.coins.toLocaleString("en-SA")} 🪙</td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-lotus-300">{(w.lotus ?? 0).toLocaleString("en-SA")} 🪷</td>
                    <td className="px-4 py-3 text-right"><Button size="sm" variant="secondary" onClick={() => setAdjust(w)}>Add / deduct</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shownWallets.length === 0 && <div className="px-4 py-8 text-center text-sm text-mist-500">No wallets match your filter.</div>}
        </Card>
        </>
      )}

      {adjust && <AdjustModal wallet={adjust} onClose={() => setAdjust(null)} onSaved={() => { setAdjust(null); load(); toast("Wallet updated", "success"); }} />}
    </div>
  );
}

function AdjustModal({ wallet, onClose, onSaved }: { wallet: WalletRow; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [amount, setAmount] = useState(100);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const field = "h-11 w-full rounded-xl border border-line bg-ink-900 px-3.5 text-sm text-mist-100 outline-none focus:border-lotus-400";


  const apply = async (sign: 1 | -1) => {
    setBusy(true);
    const ok = await adminAdjustWallet(wallet.id, sign * Math.abs(amount), reason || (sign > 0 ? "Admin credit" : "Admin debit"));
    setBusy(false);
    if (ok) onSaved();
    else toast("Could not adjust wallet", "error");
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-mist-100">Adjust {wallet.fullName}&apos;s wallet</h2>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>
        <p className="mb-3 text-sm text-mist-400">Current balance: <span className="font-semibold text-gold-300">{wallet.coins.toLocaleString("en-SA")} coins</span></p>
        <label className="block text-xs font-semibold text-mist-300">Coins</label>
        <input type="number" min={1} value={amount} onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))} className={cn(field, "mt-1")} />
        <label className="mt-3 block text-xs font-semibold text-mist-300">Reason</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Refund / bonus / correction" className={cn(field, "mt-1")} />
        <div className="mt-4 flex gap-2">
          <Button block variant="secondary" onClick={() => apply(-1)} disabled={busy}><Minus className="size-4" /> Deduct</Button>
          <Button block onClick={() => apply(1)} disabled={busy}><Plus className="size-4" /> Credit</Button>
        </div>
      </div>
    </div>
  );
}

/** A dashboard figure that OPENS the data behind it. Either switches tab in this
 *  page (onClick) or navigates to another admin page (href). */
function StatCard({ icon: Icon, tone, value, label, hint, onClick, href }: {
  icon: typeof Coins; tone: string; value: string; label: string; hint: string;
  onClick?: () => void; href?: string;
}) {
  const inner = (
    <>
      <Icon className={cn("size-6", tone)} />
      <div className="mt-2 font-display text-2xl font-extrabold text-mist-100">{value}</div>
      <div className="text-sm text-mist-400">{label}</div>
      <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-lotus-300 opacity-0 transition group-hover:opacity-100">
        {hint} <ArrowRight className="size-3" />
      </div>
    </>
  );
  const cls = "group block w-full cursor-pointer rounded-2xl border border-line bg-ink-900 p-5 text-left transition hover:border-lotus-400/50 hover:bg-ink-850";
  if (href) return <Link href={href} className={cls}>{inner}</Link>;
  return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}