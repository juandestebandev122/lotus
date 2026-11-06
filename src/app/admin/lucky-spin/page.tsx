"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { cn } from "@/lib/cn";
import { withBase } from "@/lib/base-path";
import { applyFilterSort, SortTh, TableSearch, type SortDir } from "@/components/admin/TableControls";
import { UserPicker } from "@/components/admin/UserPicker";
import { Sparkles, Save, Power, Plus, Trash2, Coins, Clock, Gift, History, Percent } from "lucide-react";

type Seg = { label: string; coins: number; weight: number; weightPaid?: number };
type SbTier = { minCoins: number; boostPct: number };
type Extra = { extraChancesEnabled: boolean; dailyLoginChances: number; winTaskChances: number; buyCostCoins: number; adChancesPerDay: number; chanceExpiryDays: number };
interface ChanceLog { id: string; userId: string; userName: string; publicId?: string; delta: number; reason: string; balanceAfter: number; by?: string; at: string }

const REASON_LABEL: Record<string, string> = { daily_login: "Daily login", task: "Task (win)", ad: "Watched promo", purchase: "Bought", admin: "Admin", spin: "Used (spin)", expired: "Expired", reset: "Reset" };

export default function AdminLuckySpinPage() {
  const { toast } = useToast();
  const { config, reload } = useConfig();
  const [enabled, setEnabled] = useState(true);
  const [cooldownHours, setCooldownHours] = useState(24);
  const [segments, setSegments] = useState<Seg[]>([]);
  const [extra, setExtra] = useState<Extra>({ extraChancesEnabled: true, dailyLoginChances: 1, winTaskChances: 1, buyCostCoins: 50, adChancesPerDay: 2, chanceExpiryDays: 0 });
  // Spending-based reward boost (buyers/spenders hit "Try again" less often).
  const [sbEnabled, setSbEnabled] = useState(false);
  const [sbTiers, setSbTiers] = useState<SbTier[]>([]);
  const [saving, setSaving] = useState(false);
  const [log, setLog] = useState<ChanceLog[]>([]);
  const [logQ, setLogQ] = useState("");
  const [logSort, setLogSort] = useState("at");
  const [logDir, setLogDir] = useState<SortDir>("desc");
  const sortLog = (col: string) => { if (logSort === col) setLogDir((d) => (d === "asc" ? "desc" : "asc")); else { setLogSort(col); setLogDir("desc"); } };
  // Manage-user tool state.
  const [mUser, setMUser] = useState("");
  const [mAmount, setMAmount] = useState(1);
  const [mBusy, setMBusy] = useState("");

  useEffect(() => {
    const s = config.luckySpin;
    if (s) {
      setEnabled(s.enabled !== false);
      setCooldownHours(s.cooldownHours ?? 24);
      setSegments(s.segments?.length ? s.segments.map((x) => ({ ...x })) : []);
      setSbEnabled(s.spendBoost?.enabled === true);
      setSbTiers((s.spendBoost?.tiers ?? []).map((t) => ({ ...t })));
      setExtra({
        extraChancesEnabled: s.extraChancesEnabled !== false,
        dailyLoginChances: s.dailyLoginChances ?? 1,
        winTaskChances: s.winTaskChances ?? 1,
        buyCostCoins: s.buyCostCoins ?? 50,
        adChancesPerDay: s.adChancesPerDay ?? 2,
        chanceExpiryDays: s.chanceExpiryDays ?? 0,
      });
    }
  }, [config.luckySpin]);

  const loadLog = () => fetch(withBase("/api/admin/lucky-spin"), { credentials: "include" }).then((r) => r.json()).then((d) => setLog(d.log ?? [])).catch(() => {});
  useEffect(() => { loadLog(); }, []);

  // Search + click-to-sort over the chance log.
  const shownLog = applyFilterSort(log, {
    q: logQ, sort: logSort, dir: logDir,
    searchText: (e) => [e.userName, e.publicId, e.userId, e.reason, e.by, e.at.slice(0, 10)].filter(Boolean).join(" "),
    sortKeys: {
      at: (e) => new Date(e.at).getTime(),
      publicId: (e) => e.publicId ?? "",
      userName: (e) => e.userName ?? "",
      reason: (e) => e.reason ?? "",
      delta: (e) => e.delta,
      balanceAfter: (e) => e.balanceAfter,
      by: (e) => e.by ?? "",
    },
  });

  const totalWeight = segments.reduce((a, s) => a + Math.max(0, s.weight), 0) || 1;
  // Paid-spin total: each slice's paid weight, falling back to its free weight.
  const totalWeightPaid = segments.reduce((a, s) => a + Math.max(0, s.weightPaid ?? s.weight), 0) || 1;

  // Save the WHOLE luckySpin object (segments + extra-chance config) so nothing resets.
  const save = async (nextEnabled = enabled, nextExtra = extra, nextSb?: { enabled: boolean; tiers: SbTier[] }) => {
    if (segments.length < 2) return toast("Add at least 2 reward slices", "error");
    setSaving(true);
    const sb = nextSb ?? { enabled: sbEnabled, tiers: sbTiers };
    const res = await saveConfig({ luckySpin: { enabled: nextEnabled, cooldownHours, segments, spendBoost: sb, ...nextExtra } });
    setSaving(false);
    if (res.ok) { setEnabled(nextEnabled); setExtra(nextExtra); setSbEnabled(sb.enabled); setSbTiers(sb.tiers); await reload(); toast("Lucky Spin settings saved", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const manage = async (action: string) => {
    if (!mUser.trim()) return toast("Enter a username or user ID", "error");
    setMBusy(action);
    const res = await fetch(withBase("/api/admin/lucky-spin"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user: mUser.trim(), action, amount: mAmount }) });
    const d = await res.json().catch(() => ({}));
    setMBusy("");
    if (res.ok) { toast(`${d.targetName ?? "User"}: ${action} → ${d.chances ?? 0} chances${d.disabled ? " (disabled)" : ""}`, "success"); loadLog(); }
    else toast(d?.error ?? "Could not update", "error");
  };

  const update = (i: number, patch: Partial<Seg>) => setSegments((segs) => segs.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const add = () => setSegments((s) => [...s, { label: "10", coins: 10, weight: 10 }]);
  const remove = (i: number) => setSegments((s) => s.filter((_, idx) => idx !== i));
  // Reorder the slices (A–Z / lowest coins first / highest chance first).
  // The order is what the wheel shows — Save keeps it.
  const sortSegments = (mode: "label" | "coins" | "chance") =>
    setSegments((segs) => [...segs].sort((a, b) =>
      mode === "label" ? a.label.localeCompare(b.label, undefined, { numeric: true })
      : mode === "coins" ? a.coins - b.coins
      : b.weight - a.weight));

  const field = "h-10 w-full rounded-lg border border-line bg-ink-900 px-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><Sparkles className="size-6 text-amber-400" /> Lucky Spin</h1>
          <p className="text-sm text-mist-400">Configure the daily spin-the-wheel reward — rewards, odds, and the free-spin cooldown.</p>
        </div>
      </div>

      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => save(!enabled)} className={cn("inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition", enabled ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300")}>
            <Power className="size-4" /> Lucky Spin {enabled ? "ON" : "OFF"}
          </button>
          <label className="text-sm">
            <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-mist-400"><Clock className="size-3.5" /> Free-spin cooldown (hours)</span>
            <input type="number" min={0} value={cooldownHours} onChange={(e) => setCooldownHours(Math.max(0, Math.floor(Number(e.target.value) || 0)))} className={cn(field, "w-40")} />
          </label>
        </div>
      </Card>

      {/* REWARDS — what each slice pays. Odds live in their own card below,
          per the client's "Separate Reward & Odds Configuration" request. */}
      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 font-display text-lg font-bold text-mist-100"><Coins className="size-5 text-gold-300" /> Rewards</p>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-mist-500">
            Sort:
            <button onClick={() => sortSegments("label")} className="rounded-full bg-white/5 px-2 py-0.5 text-mist-300 transition hover:bg-white/10 hover:text-lotus-200">A–Z</button>
            <button onClick={() => sortSegments("coins")} className="rounded-full bg-white/5 px-2 py-0.5 text-mist-300 transition hover:bg-white/10 hover:text-lotus-200">Coins</button>
            <button onClick={() => sortSegments("chance")} className="rounded-full bg-white/5 px-2 py-0.5 text-mist-300 transition hover:bg-white/10 hover:text-lotus-200">Chance</button>
          </div>
        </div>
        <div className="space-y-2">
          <div className="hidden grid-cols-[1fr_6rem_2rem] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-mist-500 sm:grid">
            <span>Label (shown on wheel)</span><span>Coins won</span><span />
          </div>
          {segments.map((s, i) => (
            <div key={i} className="grid grid-cols-2 items-center gap-2 rounded-xl border border-line bg-ink-800 p-2 sm:grid-cols-[1fr_6rem_2rem]">
              <input value={s.label} onChange={(e) => update(i, { label: e.target.value.slice(0, 16) })} placeholder="Label" className={field} />
              <input type="number" min={0} value={s.coins} onChange={(e) => update(i, { coins: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} className={field} title="Coins won" />
              <button onClick={() => remove(i)} className="grid size-8 place-items-center rounded-lg text-mist-400 hover:bg-rose-500/15 hover:text-rose-300" title="Remove"><Trash2 className="size-4" /></button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={add}><Plus className="size-4" /> Add reward</Button>
          <Button size="sm" onClick={() => save()} disabled={saving}><Save className="size-4" /> {saving ? "Saving…" : "Save rewards"}</Button>
          <span className="text-xs text-mist-500">{segments.length} slices</span>
        </div>
        <p className="text-[11px] text-mist-500">Tip: use “Try again” (0 coins) for no-win slices. Coins are credited instantly when a player lands on a reward. Sorting reorders the wheel slices — press Save to keep the new order.</p>
      </Card>

      {/* ODDS — separate FREE-spin and PAID-spin chances per slice. */}
      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 font-display text-lg font-bold text-mist-100"><Percent className="size-5 text-amber-400" /> Odds &amp; win chances — Free spin vs Paid spin</p>
          <span className="text-xs text-mist-400">Higher weight = higher chance</span>
        </div>
        <p className="text-xs text-mist-500">
          <span className="font-semibold text-emerald-300">Free</span> = the free daily spin. <span className="font-semibold text-sky-300">Paid</span> = spins using a bought/earned extra chance — leave a Paid weight empty to use the same odds as Free.
        </p>
        <div className="space-y-2">
          <div className="hidden grid-cols-[1fr_5rem_4rem_5rem_4rem] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-mist-500 sm:grid">
            <span>Reward</span><span className="text-emerald-300">Free wt</span><span className="text-center text-emerald-300">Free %</span><span className="text-sky-300">Paid wt</span><span className="text-center text-sky-300">Paid %</span>
          </div>
          {segments.map((s, i) => (
            <div key={i} className="grid grid-cols-2 items-center gap-2 rounded-xl border border-line bg-ink-800 p-2 sm:grid-cols-[1fr_5rem_4rem_5rem_4rem]">
              <span className="truncate px-1 text-sm text-mist-200">{s.label || `Slice ${i + 1}`} <span className="text-xs text-mist-500">({s.coins} coins)</span></span>
              <input type="number" min={0} step="0.5" value={s.weight} onChange={(e) => update(i, { weight: Math.max(0, Number(e.target.value) || 0) })} className={field} title="Free-spin weight" />
              <span className="text-center text-sm font-bold text-emerald-300 tabular-nums">{((Math.max(0, s.weight) / totalWeight) * 100).toFixed(1)}%</span>
              <input
                type="number" min={0} step="0.5"
                value={s.weightPaid ?? ""}
                placeholder="= free"
                onChange={(e) => update(i, { weightPaid: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value) || 0) })}
                className={field}
                title="Paid-spin weight (empty = same as free)"
              />
              <span className="text-center text-sm font-bold text-sky-300 tabular-nums">{((Math.max(0, s.weightPaid ?? s.weight) / totalWeightPaid) * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => save()} disabled={saving}><Save className="size-4" /> {saving ? "Saving…" : "Save odds"}</Button>
          <span className="text-xs text-mist-500">free total {totalWeight.toFixed(1)} · paid total {totalWeightPaid.toFixed(1)} · chance = weight ÷ total</span>
        </div>
      </Card>

      {/* SPENDING-BASED reward boost — buyers/spenders hit "Try again" less. */}
      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 font-display text-lg font-bold text-mist-100"><Coins className="size-5 text-emerald-300" /> Reward boost by coins purchased / spent</p>
          <button onClick={() => save(enabled, extra, { enabled: !sbEnabled, tiers: sbTiers })} className={cn("inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition", sbEnabled ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300")}>
            <Power className="size-3.5" /> Boost {sbEnabled ? "ON" : "OFF"}
          </button>
        </div>
        <p className="text-xs text-mist-500">
          Users who have purchased or spent more coins win more often: the highest matching tier reduces the chance of
          landing on “Try again” (0-coin) slices by the boost %. Users below the first tier spin with the normal odds.
        </p>
        <div className="space-y-2">
          <div className="hidden grid-cols-[10rem_10rem_2rem] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-mist-500 sm:grid">
            <span>Min coins purchased+spent</span><span>“Try again” reduced by %</span><span />
          </div>
          {sbTiers.map((t, i) => (
            <div key={i} className="grid grid-cols-2 items-center gap-2 rounded-xl border border-line bg-ink-800 p-2 sm:grid-cols-[10rem_10rem_2rem]">
              <input type="number" min={0} value={t.minCoins} onChange={(e) => setSbTiers((ts) => ts.map((x, idx) => (idx === i ? { ...x, minCoins: Math.max(0, Math.floor(Number(e.target.value) || 0)) } : x)))} className={field} title="Minimum lifetime coins purchased + spent" />
              <input type="number" min={0} max={90} value={t.boostPct} onChange={(e) => setSbTiers((ts) => ts.map((x, idx) => (idx === i ? { ...x, boostPct: Math.min(90, Math.max(0, Math.floor(Number(e.target.value) || 0))) } : x)))} className={field} title="Reduce the Try-again chance by this % (max 90)" />
              <button onClick={() => setSbTiers((ts) => ts.filter((_, idx) => idx !== i))} className="grid size-8 place-items-center rounded-lg text-mist-400 hover:bg-rose-500/15 hover:text-rose-300" title="Remove tier"><Trash2 className="size-4" /></button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setSbTiers((ts) => [...ts, { minCoins: 100, boostPct: 10 }])}><Plus className="size-4" /> Add tier</Button>
          <Button size="sm" onClick={() => save()} disabled={saving}><Save className="size-4" /> {saving ? "Saving…" : "Save boost tiers"}</Button>
          <span className="text-xs text-mist-500">{sbTiers.length} tiers · example: 500 coins → 25% fewer “Try again”</span>
        </div>
      </Card>

      {/* Extra chances — earning rules + limits */}
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 font-display text-lg font-bold text-mist-100"><Sparkles className="size-5 text-amber-400" /> Extra chances</p>
          <button onClick={() => save(enabled, { ...extra, extraChancesEnabled: !extra.extraChancesEnabled })} className={cn("inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition", extra.extraChancesEnabled ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300")}>
            <Power className="size-3.5" /> Extra chances {extra.extraChancesEnabled ? "ON" : "OFF"}
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm"><span className="mb-1 block text-xs font-semibold text-mist-400">Daily login gives</span><input type="number" min={0} value={extra.dailyLoginChances} onChange={(e) => setExtra({ ...extra, dailyLoginChances: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} className={cn(field, "w-28")} /></label>
          <label className="text-sm"><span className="mb-1 block text-xs font-semibold text-mist-400">Win a game gives</span><input type="number" min={0} value={extra.winTaskChances} onChange={(e) => setExtra({ ...extra, winTaskChances: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} className={cn(field, "w-28")} /></label>
          <label className="text-sm"><span className="mb-1 block text-xs font-semibold text-mist-400">Buy 1 chance (coins)</span><input type="number" min={0} value={extra.buyCostCoins} onChange={(e) => setExtra({ ...extra, buyCostCoins: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} className={cn(field, "w-28")} /></label>
          <label className="text-sm"><span className="mb-1 block text-xs font-semibold text-mist-400">Watch-to-earn / day</span><input type="number" min={0} value={extra.adChancesPerDay} onChange={(e) => setExtra({ ...extra, adChancesPerDay: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} className={cn(field, "w-28")} /></label>
          <label className="text-sm"><span className="mb-1 block text-xs font-semibold text-mist-400">Expire after (days, 0=never)</span><input type="number" min={0} value={extra.chanceExpiryDays} onChange={(e) => setExtra({ ...extra, chanceExpiryDays: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} className={cn(field, "w-40")} /></label>
          <Button size="sm" onClick={() => save()} disabled={saving}><Save className="size-4" /> {saving ? "Saving…" : "Save extra chances"}</Button>
        </div>
        <p className="text-[11px] text-mist-500">Each spin uses the free daily spin first; when the cooldown isn&apos;t ready, it uses one extra chance. Set any value to 0 to turn that earning method off.</p>
      </Card>

      {/* Manage a specific user's chances */}
      <Card className="space-y-3 p-5">
        <p className="flex items-center gap-1.5 font-display text-lg font-bold text-mist-100"><Gift className="size-5 text-lotus-300" /> Manage a user&apos;s chances</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm"><span className="mb-1 block text-xs font-semibold text-mist-400">Username or user ID</span>
            <UserPicker value={mUser} onPick={(v) => setMUser(v)} placeholder="Type a name, @username or ID…" className="w-64" />
          </label>
          <label className="text-sm"><span className="mb-1 block text-xs font-semibold text-mist-400">Amount</span><input type="number" min={0} value={mAmount} onChange={(e) => setMAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))} className={cn(field, "w-24")} /></label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => manage("add")} disabled={!!mBusy}>Add</Button>
          <Button size="sm" variant="secondary" onClick={() => manage("remove")} disabled={!!mBusy}>Remove</Button>
          <Button size="sm" variant="secondary" onClick={() => manage("set")} disabled={!!mBusy}>Set to amount</Button>
          <button onClick={() => manage("reset")} disabled={!!mBusy} className="rounded-lg border border-line bg-ink-800 px-3 py-1.5 text-sm font-semibold text-amber-300 hover:bg-ink-700">Reset to 0</button>
          <button onClick={() => manage("disable")} disabled={!!mBusy} className="rounded-lg border border-line bg-ink-800 px-3 py-1.5 text-sm font-semibold text-rose-300 hover:bg-ink-700">Disable for user</button>
          <button onClick={() => manage("enable")} disabled={!!mBusy} className="rounded-lg border border-line bg-ink-800 px-3 py-1.5 text-sm font-semibold text-emerald-300 hover:bg-ink-700">Enable for user</button>
        </div>
      </Card>

      {/* Transaction log */}
      <Card className="p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 font-display text-lg font-bold text-mist-100"><History className="size-5 text-sky-300" /> Chance transactions <span className="text-sm font-normal text-mist-500">({shownLog.length} of {log.length})</span></p>
          <div className="flex items-center gap-2">
            <TableSearch value={logQ} onChange={setLogQ} placeholder="Search name / ID / reason…" className="w-56" />
            <button onClick={loadLog} className="text-xs font-semibold text-lotus-300 hover:text-lotus-200">Refresh</button>
          </div>
        </div>
        {shownLog.length === 0 ? (
          <p className="py-6 text-center text-sm text-mist-500">{log.length === 0 ? "No extra-chance activity yet." : "No entries match your search."}</p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-ink-850 text-mist-500"><tr>
                <SortTh col="at" sort={logSort} dir={logDir} onSort={sortLog} className="!px-2 !py-1.5">Time</SortTh>
                <SortTh col="publicId" sort={logSort} dir={logDir} onSort={sortLog} className="!px-2 !py-1.5">ID number</SortTh>
                <SortTh col="userName" sort={logSort} dir={logDir} onSort={sortLog} className="!px-2 !py-1.5">User</SortTh>
                <SortTh col="reason" sort={logSort} dir={logDir} onSort={sortLog} className="!px-2 !py-1.5">Reason</SortTh>
                <SortTh col="delta" sort={logSort} dir={logDir} onSort={sortLog} className="!px-2 !py-1.5" align="right">Change</SortTh>
                <SortTh col="balanceAfter" sort={logSort} dir={logDir} onSort={sortLog} className="!px-2 !py-1.5" align="right">Balance</SortTh>
                <SortTh col="by" sort={logSort} dir={logDir} onSort={sortLog} className="!px-2 !py-1.5">By</SortTh>
              </tr></thead>
              <tbody>
                {shownLog.map((e) => (
                  <tr key={e.id} className="border-b border-white/5 last:border-0">
                    <td className="px-2 py-1.5 text-mist-400">{new Date(e.at).toLocaleString("en-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    {/* ID number + the name, both linking to that member's record
                        in Users so the admin can open the account from the log. */}
                    <td className="px-2 py-1.5">
                      <Link href={`/admin/users?q=${encodeURIComponent(e.publicId || e.userId)}`} className="font-mono font-bold text-lotus-300 hover:underline">
                        {e.publicId ?? "—"}
                      </Link>
                    </td>
                    <td className="px-2 py-1.5">
                      <Link href={`/admin/users?q=${encodeURIComponent(e.publicId || e.userId)}`} className="text-mist-200 hover:text-lotus-300 hover:underline">
                        {e.userName}
                      </Link>
                    </td>
                    <td className="px-2 py-1.5"><span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-mist-300">{REASON_LABEL[e.reason] ?? e.reason}</span></td>
                    <td className={cn("px-2 py-1.5 text-right font-bold tabular-nums", e.delta >= 0 ? "text-emerald-300" : "text-rose-300")}>{e.delta >= 0 ? `+${e.delta}` : e.delta}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-mist-300">{e.balanceAfter}</td>
                    <td className="px-2 py-1.5 text-mist-500">{e.by ?? "—"}</td>
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
