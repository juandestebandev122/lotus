"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import {
  Wallet, Search, Coins, Flower2, Lock, Snowflake, Plus, Minus, Download,
  ShieldCheck, History, TrendingUp, TrendingDown, Users, Loader2, Send,
  Banknote, Building2, Landmark, ExternalLink, X,
} from "lucide-react";

interface LedgerRow { id: string; at: string; type: string; unit: "coin" | "lotus"; amount: number; balanceAfter: number; description: string; ref?: string }
interface Detail {
  found: boolean; userId?: string; publicId?: string; name?: string; username?: string; avatar?: string; email?: string; phone?: string;
  frozen?: boolean; frozenReason?: string; lastUpdated?: string; lotusName: string;
  coinBalance: number; lotusBalance: number; lockedCoins: number; lockedLotus: number;
  earnedCoins: number; spentCoins: number; earnedLotus: number; spentLotus: number;
  coinLedger: LedgerRow[]; lotusLedger: LedgerRow[];
}
interface Summary {
  totalUsers: number; onlineUsers: number; vipUsers: number; totalCoins: number; totalLotus: number; lotusName: string; currency: string;
  withdrawPending: { count: number; value: number }; withdrawApproved: { count: number; value: number };
  rechargeToday: number; coinsPurchasedToday: number; coinsGiftedToday: number;
  companyEarnings: number; agentEarnings: number; trustEarnings: number; totalGiftValue: number;
  earningsUnit: "coin" | "lotus";
}
interface HouseRow { id: string; at: string; type: string; amount: number; note?: string; who?: string }
interface AgencyRow { id: string; publicId?: string; name: string; owner?: string; members: number; earnings: number }
interface House {
  unit: "coin" | "lotus"; lotusName: string;
  company: { balance: number; today: number; count: number; entries: HouseRow[] };
  trust: { balance: number; today: number; count: number; entries: HouseRow[] };
  agencies: { total: number; count: number; list: AgencyRow[] };
}
interface Match { userId: string; publicId?: string; name: string; username?: string; avatar?: string; coins: number; lotus: number; frozen?: boolean }
interface Audit { id: string; at: string; admin: string; action: string; userName: string; publicId?: string; currency: string; delta: number; oldBalance: number; newBalance: number; reason?: string; ip?: string; device?: string }

const n = (v: number) => (v ?? 0).toLocaleString("en-SA");
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-SA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

const RANGES = [
  { key: "today", label: "Today", ms: 0 },
  { key: "7d", label: "7 days", ms: 7 * 864e5 },
  { key: "30d", label: "30 days", ms: 30 * 864e5 },
  { key: "all", label: "All", ms: Infinity },
];

export default function AdminWalletManagementPage() {
  const { toast } = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [house, setHouse] = useState<House | null>(null);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [tab, setTab] = useState<"coin" | "lotus" | "statement">("coin");
  const [houseTab, setHouseTab] = useState<"company" | "agencies" | "trust">("company");
  const [range, setRange] = useState("30d");
  const [busy, setBusy] = useState(false);

  // Base load: tiles + house wallets + audit.
  const loadBase = useCallback(async () => {
    try {
      const r = await fetch(withBase("/api/admin/wallet-management"), { credentials: "include", cache: "no-store" });
      const d = await r.json();
      if (d?.summary) setSummary(d.summary as Summary);
      if (d?.house) setHouse(d.house as House);
      if (Array.isArray(d?.audit)) setAudit(d.audit as Audit[]);
    } catch { toast("Could not load wallet data", "error"); }
    setLoading(false);
  }, [toast]);
  useEffect(() => { void loadBase(); }, [loadBase]);

  // Open one user's full wallet.
  const openWallet = useCallback(async (key: string) => {
    setSearching(true); setMatches(null);
    try {
      const r = await fetch(withBase(`/api/admin/wallet-management?user=${encodeURIComponent(key)}`), { credentials: "include", cache: "no-store" });
      const d = await r.json();
      setDetail((d?.detail as Detail) ?? { found: false } as Detail);
    } catch { toast("Could not open wallet", "error"); }
    setSearching(false);
  }, [toast]);

  // Live search — debounced pick-list so any partial name / ID / phone finds the user.
  const debId = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const term = q.trim();
    if (debId.current) clearTimeout(debId.current);
    if (term.length < 1) { setMatches(null); return; }
    debId.current = setTimeout(async () => {
      try {
        const r = await fetch(withBase(`/api/admin/wallet-management?q=${encodeURIComponent(term)}`), { credentials: "include", cache: "no-store" });
        const d = await r.json();
        setMatches(Array.isArray(d?.matches) ? (d.matches as Match[]) : []);
      } catch { /* ignore transient */ }
    }, 250);
    return () => { if (debId.current) clearTimeout(debId.current); };
  }, [q]);

  // Admin wallet actions (reuse the existing routes).
  const adjust = async (currency: "coin" | "lotus", sign: 1 | -1) => {
    if (!detail?.userId) return;
    const raw = window.prompt(`${sign > 0 ? "Add" : "Deduct"} ${currency === "lotus" ? detail.lotusName : "coins"} — amount:`, "");
    if (raw === null) return;
    const amt = Number(raw); if (!(amt > 0)) { toast("Enter a positive amount", "error"); return; }
    const reason = window.prompt("Reason (recorded in the audit):", "") ?? "";
    setBusy(true);
    try {
      const r = await fetch(withBase("/api/admin/coin-adjust"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: detail.userId, delta: sign * amt, currency: currency === "lotus" ? "lotus" : undefined, reason }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { toast("Wallet updated", "success"); await openWallet(detail.userId); await loadBase(); } else toast(d?.error ?? "Failed", "error");
    } catch { toast("Network error", "error"); }
    setBusy(false);
  };
  const toggleFreeze = async () => {
    if (!detail?.userId) return;
    const next = !detail.frozen;
    const reason = next ? (window.prompt("Freeze reason:", "") ?? "") : "";
    setBusy(true);
    try {
      const r = await fetch(withBase("/api/admin/wallet-freeze"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: detail.userId, frozen: next, reason }) });
      if (r.ok) { toast(next ? "Wallet frozen" : "Wallet unfrozen", "success"); await openWallet(detail.userId); await loadBase(); } else toast("Failed", "error");
    } catch { toast("Network error", "error"); }
    setBusy(false);
  };

  // Statement: opening/closing per currency over the selected range.
  const rangeStart = useMemo(() => { const r = RANGES.find((x) => x.key === range)!; return r.ms === Infinity ? 0 : (r.key === "today" ? new Date(new Date().toDateString()).getTime() : Date.now() - r.ms); }, [range]);
  const stmt = (ledger: LedgerRow[], closing: number) => {
    const inRange = ledger.filter((t) => new Date(t.at).getTime() >= rangeStart);
    const credits = inRange.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0);
    const debits = inRange.filter((t) => t.amount < 0).reduce((a, t) => a - t.amount, 0);
    const opening = Math.round((closing - credits + debits) * 100) / 100;
    return { opening, credits, debits, closing, rows: inRange };
  };

  const exportCsv = () => {
    if (!detail?.found) return;
    const rows = [...detail.coinLedger, ...detail.lotusLedger].sort((a, b) => (a.at < b.at ? 1 : -1));
    const head = ["Date", "Wallet", "Type", "Amount", "Balance After", "Description", "Ref"];
    const csv = [head, ...rows.map((r) => [fmt(r.at), r.unit === "lotus" ? (detail.lotusName) : "Coins", r.type, String(r.amount), String(r.balanceAfter), r.description, r.ref ?? ""])]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `wallet-${detail.publicId || detail.userId}.csv`; a.click();
  };

  const cur = summary?.currency ?? "SAR";
  const lname = summary?.lotusName ?? house?.lotusName ?? "Lotus";
  const earnUnit = summary?.earningsUnit === "lotus" ? lname : "Coins"; // Company / Agents unit
  const houseUnit = house?.unit === "lotus" ? lname : "Coins";

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-24">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><Wallet className="size-6 text-lotus-300" /> Wallet Management</h1>
        <p className="mt-1 text-sm text-mist-400">Complete financial transparency — <b className="text-mist-200">Coins</b>, <b className="text-mist-200">{lname}</b> and <b className="text-mist-200">{cur}</b> shown separately, with per-user wallets, the Company / Agencies / Trust house wallets, dual ledgers, statements and a durable audit trail. Balances only ever change through a logged transaction.</p>
      </div>

      {/* Summary tiles — grouped by currency so Coins / Lotus / real-money never mix */}
      {loading && !summary ? <div className="grid h-24 place-items-center text-mist-500"><Loader2 className="size-5 animate-spin" /></div> : summary && (
        <div className="space-y-3">
          <Group label="Coins" icon={Coins}>
            <Tile icon={Coins} label="Total coins in system" value={n(summary.totalCoins)} unit="Coins" accent />
            <Tile icon={Coins} label="Coins purchased today" value={n(summary.coinsPurchasedToday)} unit="Coins" />
            <Tile icon={Send} label="Coins gifted today" value={n(summary.coinsGiftedToday)} unit="Coins" />
            <Tile icon={History} label="Total gift value" value={n(summary.totalGiftValue)} unit="Coins" />
          </Group>
          <Group label={`${lname} (flowers)`} icon={Flower2}>
            <Tile icon={Flower2} label={`Total ${lname} in system`} value={n(summary.totalLotus)} unit={lname} accent />
          </Group>
          <Group label={`Platform earnings`} icon={Building2}>
            <Tile icon={Building2} label="Company earnings" value={n(summary.companyEarnings)} unit={earnUnit} />
            <Tile icon={Users} label="Agent (agency) earnings" value={n(summary.agentEarnings)} unit={earnUnit} />
            <Tile icon={Landmark} label="Trust earnings" value={n(summary.trustEarnings)} unit={lname} />
          </Group>
          <Group label={`Real money · ${cur}`} icon={Banknote}>
            <Tile icon={Banknote} label="Recharge today" value={n(summary.rechargeToday)} unit={cur} />
            <Tile icon={TrendingDown} label="Withdrawals pending" value={`${summary.withdrawPending.count}`} unit={`${cur} ${n(summary.withdrawPending.value)}`} />
            <Tile icon={TrendingDown} label="Withdrawals approved" value={`${summary.withdrawApproved.count}`} unit={`${cur} ${n(summary.withdrawApproved.value)}`} />
            <Tile icon={Users} label="Users" value={n(summary.totalUsers)} unit={`${n(summary.onlineUsers)} online · ${n(summary.vipUsers)} VIP`} />
          </Group>
        </div>
      )}

      {/* User lookup — live pick-list so ANY partial name / ID / phone finds the member */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-line bg-ink-800 px-3">
            <Search className="size-4 text-mist-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && matches && matches.length) void openWallet(matches[0].userId); }} placeholder="Search any member to open their wallet — name, member ID, username or phone…" className="h-10 flex-1 bg-transparent text-sm text-mist-100 outline-none placeholder:text-mist-500" />
            {q && <button onClick={() => { setQ(""); setMatches(null); }} className="text-mist-500 hover:text-mist-200"><X className="size-4" /></button>}
          </div>
          <Button onClick={() => { if (matches && matches.length) void openWallet(matches[0].userId); }} disabled={searching || !(matches && matches.length)}>{searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Open wallet</Button>
        </div>

        {/* Live results */}
        {matches !== null && (
          matches.length === 0 ? (
            <p className="mt-3 rounded-lg border border-line bg-ink-900/50 p-3 text-center text-sm text-mist-400">No member matches “{q}”. Try a name, member ID, username or phone.</p>
          ) : (
            <div className="mt-3 max-h-72 divide-y divide-line/60 overflow-y-auto rounded-lg border border-line bg-ink-900/50">
              {matches.map((m) => (
                <button key={m.userId} onClick={() => openWallet(m.userId)} className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-white/[0.04]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {m.avatar ? <img src={withBase(m.avatar)} alt="" className="size-8 rounded-full object-cover" /> : <span className="grid size-8 place-items-center rounded-full bg-ink-700 text-xs text-mist-400">{(m.name || "?").slice(0, 1)}</span>}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 truncate text-sm font-semibold text-mist-100">{m.name}{m.frozen && <Snowflake className="size-3 text-sky-300" />}</div>
                    <div className="truncate text-[11px] text-mist-500">{m.publicId} · @{m.username}</div>
                  </div>
                  <div className="shrink-0 text-right text-[11px]">
                    <div className="font-semibold text-gold-200">{n(m.coins)} <span className="text-mist-500">coins</span></div>
                    <div className="text-lotus-200">{n(m.lotus)} <span className="text-mist-500">{lname}</span></div>
                  </div>
                </button>
              ))}
            </div>
          )
        )}
      </Card>

      {detail?.found && (
        <>
          {/* Wallet overview */}
          <Card className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {detail.avatar && <img src={withBase(detail.avatar)} alt="" className="size-12 rounded-full object-cover" />}
                <div>
                  <div className="flex items-center gap-2 font-display text-lg font-bold text-mist-100">
                    <Link href={`/admin/users?q=${encodeURIComponent(detail.publicId || detail.userId || "")}`} className="hover:text-lotus-300">{detail.name}</Link>
                    {detail.frozen && <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-300"><Snowflake className="size-3" /> Frozen</span>}
                  </div>
                  <div className="text-xs text-mist-500">{detail.publicId ?? detail.userId} · @{detail.username} · updated {fmt(detail.lastUpdated)}</div>
                  {detail.frozen && detail.frozenReason && <div className="mt-0.5 text-[11px] text-sky-300/80">Reason: {detail.frozenReason}</div>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => adjust("coin", 1)} disabled={busy}><Plus className="size-3.5" /> Coins</Button>
                <Button size="sm" variant="ghost" onClick={() => adjust("coin", -1)} disabled={busy}><Minus className="size-3.5" /> Coins</Button>
                <Button size="sm" variant="secondary" onClick={() => adjust("lotus", 1)} disabled={busy}><Plus className="size-3.5" /> {detail.lotusName}</Button>
                <Button size="sm" variant="ghost" onClick={() => adjust("lotus", -1)} disabled={busy}><Minus className="size-3.5" /> {detail.lotusName}</Button>
                <Button size="sm" variant={detail.frozen ? "secondary" : "danger"} onClick={toggleFreeze} disabled={busy}><Snowflake className="size-3.5" /> {detail.frozen ? "Unfreeze" : "Freeze"}</Button>
                <Button size="sm" variant="ghost" onClick={exportCsv}><Download className="size-3.5" /> CSV</Button>
              </div>
            </div>
            {/* Balances grid */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Bal icon={Coins} label="Coin balance" value={n(detail.coinBalance)} accent />
              <Bal icon={Flower2} label={`${detail.lotusName} balance`} value={n(detail.lotusBalance)} />
              <Bal icon={Lock} label="Locked coins" value={n(detail.lockedCoins)} muted />
              <Bal icon={Lock} label={`Locked ${detail.lotusName}`} value={n(detail.lockedLotus)} muted />
              <Bal icon={TrendingUp} label="Lifetime earned coins" value={n(detail.earnedCoins)} />
              <Bal icon={TrendingDown} label="Lifetime spent coins" value={n(detail.spentCoins)} />
              <Bal icon={TrendingUp} label={`Lifetime earned ${detail.lotusName}`} value={n(detail.earnedLotus)} />
              <Bal icon={TrendingDown} label={`Lifetime spent ${detail.lotusName}`} value={n(detail.spentLotus)} />
            </div>
          </Card>

          {/* Ledgers + statement */}
          <Card className="p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-1 rounded-lg border border-line bg-ink-900 p-1">
                {([["coin", "Coin ledger"], ["lotus", `${detail.lotusName} ledger`], ["statement", "Statement"]] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setTab(k)} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold transition", tab === k ? "bg-lotus-600/90 text-white" : "text-mist-400 hover:text-mist-100")}>{l}</button>
                ))}
              </div>
              {tab === "statement" && (
                <div className="flex gap-1">
                  {RANGES.map((r) => <button key={r.key} onClick={() => setRange(r.key)} className={cn("rounded-lg px-2.5 py-1 text-xs font-semibold transition", range === r.key ? "bg-lotus-500/20 text-lotus-200" : "bg-white/5 text-mist-400 hover:text-mist-200")}>{r.label}</button>)}
                </div>
              )}
            </div>

            {tab === "coin" && <Ledger rows={detail.coinLedger} unit="coins" />}
            {tab === "lotus" && <Ledger rows={detail.lotusLedger} unit={detail.lotusName} />}
            {tab === "statement" && (
              <div className="space-y-4">
                {([["Coins", detail.coinLedger, detail.coinBalance], [detail.lotusName, detail.lotusLedger, detail.lotusBalance]] as const).map(([label, ledger, closing]) => {
                  const s = stmt(ledger, closing);
                  return (
                    <div key={label} className="rounded-xl border border-line bg-ink-900/50 p-3">
                      <div className="mb-2 text-sm font-bold text-mist-100">{label} statement <span className="text-mist-500">· {RANGES.find((x) => x.key === range)?.label}</span></div>
                      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                        <div className="rounded-lg bg-ink-800 p-2"><div className="text-mist-500">Opening</div><div className="font-display text-base font-bold text-mist-100">{n(s.opening)}</div></div>
                        <div className="rounded-lg bg-emerald-500/10 p-2"><div className="text-emerald-300/80">+ Credits</div><div className="font-display text-base font-bold text-emerald-200">+{n(s.credits)}</div></div>
                        <div className="rounded-lg bg-rose-500/10 p-2"><div className="text-rose-300/80">− Debits</div><div className="font-display text-base font-bold text-rose-200">−{n(s.debits)}</div></div>
                        <div className="rounded-lg bg-lotus-500/10 p-2"><div className="text-lotus-300/80">Closing</div><div className="font-display text-base font-bold text-lotus-200">{n(s.closing)}</div></div>
                      </div>
                      {s.rows.length === 0 && <p className="mt-2 text-center text-[11px] text-mist-500">No movements in this period.</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}

      {/* House wallets — Company / Agencies / Trust */}
      {house && (
        <Card className="p-4 sm:p-5">
          <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Landmark className="size-5 text-lotus-300" /> House &amp; platform wallets</h2>
          <p className="mb-3 text-sm text-mist-400">Company, Agencies and Trust balances with their movements. Payouts &amp; adjustments are on the dedicated control pages (linked below).</p>

          <div className="mb-3 flex gap-1 rounded-lg border border-line bg-ink-900 p-1">
            {([["company", "Company", Building2], ["agencies", `Agencies (${house.agencies.count})`, Users], ["trust", "Trust", ShieldCheck]] as const).map(([k, l, Ic]) => (
              <button key={k} onClick={() => setHouseTab(k)} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition", houseTab === k ? "bg-lotus-600/90 text-white" : "text-mist-400 hover:text-mist-100")}><Ic className="size-3.5" /> {l}</button>
            ))}
          </div>

          {houseTab === "company" && (
            <>
              <HouseHead balance={house.company.balance} unit={houseUnit} today={house.company.today} count={house.company.count} href="/admin/company-profit" hrefLabel="Company Profit controls" />
              <p className="mb-2 text-[11px] text-mist-500">Company profit combines the platform&rsquo;s share of gifts &amp; calls (paid in {lname}) with recharge &amp; withdrawal fees (in coins) — see each row&rsquo;s <b>Type</b>. The dedicated Company Profit page breaks it down by source.</p>
              <HouseLedger rows={house.company.entries} unit={houseUnit} />
            </>
          )}
          {houseTab === "trust" && (
            <>
              <HouseHead balance={house.trust.balance} unit={lname} today={house.trust.today} count={house.trust.count} href="/admin/lotus" hrefLabel="Trust / Lotus controls" />
              <HouseLedger rows={house.trust.entries} unit={lname} />
            </>
          )}
          {houseTab === "agencies" && (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-ink-900/50 p-3">
                <div><div className="text-[11px] text-mist-500">All agency wallets · {house.agencies.count} agencies</div><div className="font-display text-xl font-extrabold tabular-nums text-mist-100">{n(house.agencies.total)} <span className="text-sm font-semibold text-mist-500">{houseUnit}</span></div></div>
                <Link href={withBase("/admin/agencies")} className="inline-flex items-center gap-1 text-xs font-semibold text-lotus-300 hover:text-lotus-200">Agency controls <ExternalLink className="size-3" /></Link>
              </div>
              {house.agencies.list.length === 0 ? <p className="py-8 text-center text-sm text-mist-500">No agencies yet.</p> : (
                <div className="-mx-4 overflow-x-auto sm:-mx-5">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-mist-500">
                      <th className="px-4 py-2.5 font-semibold">Agency</th><th className="px-4 py-2.5 font-semibold">Owner</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Members</th><th className="px-4 py-2.5 text-right font-semibold">Wallet ({houseUnit})</th>
                    </tr></thead>
                    <tbody>
                      {house.agencies.list.map((a) => (
                        <tr key={a.id} className="border-b border-line/50">
                          <td className="px-4 py-2"><span className="text-mist-100">{a.name}</span> <span className="text-[10px] text-mist-500">{a.publicId}</span></td>
                          <td className="px-4 py-2 text-mist-300">{a.owner || "—"}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-mist-400">{n(a.members)}</td>
                          <td className="px-4 py-2 text-right font-bold tabular-nums text-gold-200">{n(a.earnings)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {/* Audit trail */}
      <Card className="p-4 sm:p-5">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-mist-100"><History className="size-5 text-lotus-300" /> Wallet audit trail</h2>
        <p className="mb-3 text-sm text-mist-400">Every admin wallet action — with who, when, before/after balance, IP and device. Immutable record.</p>
        {audit.length === 0 ? <p className="py-6 text-center text-sm text-mist-500">No wallet actions recorded yet.</p> : (
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-mist-500">
                <th className="px-4 py-2.5 font-semibold">Date</th><th className="px-4 py-2.5 font-semibold">Admin</th><th className="px-4 py-2.5 font-semibold">Action</th><th className="px-4 py-2.5 font-semibold">User</th>
                <th className="px-4 py-2.5 text-right font-semibold">Change</th><th className="px-4 py-2.5 text-right font-semibold">Old→New</th><th className="px-4 py-2.5 font-semibold">IP / Device</th>
              </tr></thead>
              <tbody>
                {audit.slice(0, 300).map((a) => (
                  <tr key={a.id} className="border-b border-line/50">
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-mist-400">{fmt(a.at)}</td>
                    <td className="px-4 py-2 text-mist-300">{a.admin}</td>
                    <td className="px-4 py-2"><span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-mist-200">{a.action}</span>{a.reason && <div className="mt-0.5 max-w-[220px] truncate text-[10px] text-mist-500" title={a.reason}>{a.reason}</div>}</td>
                    <td className="px-4 py-2"><span className="text-mist-100">{a.userName}</span> <span className="text-[10px] text-mist-500">{a.publicId}</span></td>
                    <td className={cn("px-4 py-2 text-right font-bold tabular-nums", a.delta > 0 ? "text-emerald-300" : a.delta < 0 ? "text-rose-300" : "text-mist-500")}>{a.currency ? `${a.delta > 0 ? "+" : ""}${n(a.delta)}` : "—"} <span className="text-[9px] uppercase text-mist-500">{a.currency === "lotus" ? lname : a.currency === "coin" ? "coins" : ""}</span></td>
                    <td className="px-4 py-2 text-right tabular-nums text-mist-400">{a.currency ? `${n(a.oldBalance)}→${n(a.newBalance)}` : "—"}</td>
                    <td className="px-4 py-2 text-[10px] text-mist-500"><div>{a.ip || "—"}</div><div className="max-w-[180px] truncate" title={a.device}>{a.device || "—"}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Group({ label, icon: Icon, children }: { label: string; icon: typeof Coins; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-mist-500"><Icon className="size-3.5 text-mist-400" /> {label}</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{children}</div>
    </div>
  );
}

function Tile({ icon: Icon, label, value, unit, accent }: { icon: typeof Coins; label: string; value: string; unit?: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-3", accent ? "border-lotus-400/40 bg-lotus-500/[0.08]" : "border-line bg-ink-900")}>
      <div className="flex items-center justify-between">
        <Icon className={cn("size-4", accent ? "text-lotus-300" : "text-mist-400")} />
        {unit && <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-mist-400">{unit}</span>}
      </div>
      <div className={cn("mt-1.5 font-display text-lg font-extrabold tabular-nums", accent ? "text-lotus-200" : "text-mist-100")}>{value}</div>
      <div className="text-[10px] leading-tight text-mist-500">{label}</div>
    </div>
  );
}

function Bal({ icon: Icon, label, value, accent, muted }: { icon: typeof Coins; label: string; value: string; accent?: boolean; muted?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-3", accent ? "border-gold-400/30 bg-gold-500/[0.06]" : muted ? "border-line bg-ink-900/50" : "border-line bg-ink-900")}>
      <div className="flex items-center gap-1.5 text-[11px] text-mist-400"><Icon className="size-3.5" /> {label}</div>
      <div className={cn("mt-1 font-display text-xl font-extrabold tabular-nums", accent ? "text-gold-200" : muted ? "text-mist-300" : "text-mist-100")}>{value}</div>
    </div>
  );
}

function HouseHead({ balance, unit, today, count, href, hrefLabel }: { balance: number; unit: string; today: number; count: number; href: string; hrefLabel: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-ink-900/50 p-3">
      <div className="flex flex-wrap items-center gap-4">
        <div><div className="text-[11px] text-mist-500">Current balance</div><div className="font-display text-2xl font-extrabold tabular-nums text-mist-100">{n(balance)} <span className="text-sm font-semibold text-mist-500">{unit}</span></div></div>
        <div><div className="text-[11px] text-mist-500">Today</div><div className={cn("font-display text-lg font-bold tabular-nums", today > 0 ? "text-emerald-300" : today < 0 ? "text-rose-300" : "text-mist-300")}>{today > 0 ? "+" : ""}{n(today)}</div></div>
        <div><div className="text-[11px] text-mist-500">Entries</div><div className="font-display text-lg font-bold tabular-nums text-mist-300">{n(count)}</div></div>
      </div>
      <Link href={withBase(href)} className="inline-flex items-center gap-1 text-xs font-semibold text-lotus-300 hover:text-lotus-200">{hrefLabel} <ExternalLink className="size-3" /></Link>
    </div>
  );
}

function HouseLedger({ rows, unit }: { rows: HouseRow[]; unit: string }) {
  if (rows.length === 0) return <p className="py-8 text-center text-sm text-mist-500">No movements yet.</p>;
  return (
    <div className="-mx-4 overflow-x-auto sm:-mx-5">
      <table className="w-full min-w-[620px] text-sm">
        <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-mist-500">
          <th className="px-4 py-2.5 font-semibold">Date</th><th className="px-4 py-2.5 font-semibold">Type</th>
          <th className="px-4 py-2.5 font-semibold">Detail</th><th className="px-4 py-2.5 text-right font-semibold">{unit}</th>
        </tr></thead>
        <tbody>
          {rows.slice(0, 200).map((r) => (
            <tr key={r.id} className="border-b border-line/50">
              <td className="whitespace-nowrap px-4 py-2 text-xs text-mist-400">{fmt(r.at)}</td>
              <td className="px-4 py-2"><span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] capitalize text-mist-300">{r.type}</span></td>
              <td className="px-4 py-2 text-mist-300"><div className="max-w-[360px] truncate" title={`${r.note ?? ""}${r.who ? ` · ${r.who}` : ""}`}>{r.note || "—"}{r.who ? <span className="text-mist-500"> · {r.who}</span> : null}</div></td>
              <td className={cn("px-4 py-2 text-right font-bold tabular-nums", r.amount >= 0 ? "text-emerald-300" : "text-rose-300")}>{r.amount >= 0 ? "+" : ""}{n(r.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 200 && <p className="mt-2 text-center text-[11px] text-mist-500">Showing the 200 most recent of {rows.length}.</p>}
    </div>
  );
}

function Ledger({ rows, unit }: { rows: LedgerRow[]; unit: string }) {
  if (rows.length === 0) return <p className="py-8 text-center text-sm text-mist-500">No {unit} transactions yet.</p>;
  return (
    <div className="-mx-4 overflow-x-auto sm:-mx-5">
      <table className="w-full min-w-[640px] text-sm">
        <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-mist-500">
          <th className="px-4 py-2.5 font-semibold">Txn</th><th className="px-4 py-2.5 font-semibold">Date</th><th className="px-4 py-2.5 font-semibold">Type</th>
          <th className="px-4 py-2.5 font-semibold">Description</th><th className="px-4 py-2.5 text-right font-semibold">{unit}</th><th className="px-4 py-2.5 text-right font-semibold">Balance</th>
        </tr></thead>
        <tbody>
          {rows.slice(0, 500).map((r) => (
            <tr key={r.id} className="border-b border-line/50">
              <td className="px-4 py-2 font-mono text-[10px] text-mist-500">{r.id.slice(0, 10)}</td>
              <td className="whitespace-nowrap px-4 py-2 text-xs text-mist-400">{fmt(r.at)}</td>
              <td className="px-4 py-2"><span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] capitalize text-mist-300">{r.type}</span></td>
              <td className="px-4 py-2 text-mist-300"><div className="max-w-[320px] truncate" title={r.description}>{r.description}</div></td>
              <td className={cn("px-4 py-2 text-right font-bold tabular-nums", r.amount >= 0 ? "text-emerald-300" : "text-rose-300")}>{r.amount >= 0 ? "+" : ""}{n(r.amount)}</td>
              <td className="px-4 py-2 text-right tabular-nums text-mist-400">{n(r.balanceAfter)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 500 && <p className="mt-2 text-center text-[11px] text-mist-500">Showing the 500 most recent of {rows.length}.</p>}
    </div>
  );
}
