"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { withBase } from "@/lib/base-path";
import { applyFilterSort, SortTh, TableSearch, type SortDir } from "@/components/admin/TableControls";
import { UserPicker } from "@/components/admin/UserPicker";
import { cn } from "@/lib/cn";
import {
  Coins, Check, Power, Gift, UserPlus, CalendarCheck, Sparkles, Users, Trophy, Crown, Clock,
  Send, History, ExternalLink,
} from "lucide-react";

interface PeriodicClaim {
  id: string; userId: string; userName: string; publicId?: string;
  amount: number; intervalMinutes: number; at: string;
  result: "granted" | "rejected"; reason?: string; balanceAfter?: number;
}
interface Report {
  bySource: { source: string; coins: number; count: number; coinsToday: number; countToday: number }[];
  totalCoins: number; totalCount: number; totalCoinsToday: number;
  history: { id: string; userId: string; userName: string; publicId?: string; coins: number; source: string; note?: string; at: string }[];
  periodicClaims?: PeriodicClaim[];
}

// Free-coin systems that live on their OWN admin page — shown here for visibility.
// `key` = the config object whose `enabled` flag the quick ON/OFF toggle flips
// (Tournament has no flag: its prizes are distributed manually by admins).
type SysKey = "referral" | "luckySpin" | "levelRewards" | "activityReward";
const LINKED: { source: string; icon: typeof Users; href: string; note: string; key?: SysKey }[] = [
  { source: "Referral", icon: Users, href: "/admin/referrals", note: "Refer-a-friend reward", key: "referral" },
  { source: "Lucky Spin", icon: Sparkles, href: "/admin/lucky-spin", note: "Spin-the-wheel prizes", key: "luckySpin" },
  { source: "Tournament", icon: Trophy, href: "/admin/tournaments", note: "Prizes are given manually by admins" },
  { source: "Level Up", icon: Crown, href: "/admin/levels", note: "Level-up coin rewards", key: "levelRewards" },
  { source: "Activity Bonus", icon: Clock, href: "/admin/activity-reward", note: "Startup / time-in-app bonus", key: "activityReward" },
];

export default function AdminFreeCoinsPage() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();
  const [report, setReport] = useState<Report | null>(null);
  const [saving, setSaving] = useState(false);
  const [srcFilter, setSrcFilter] = useState<string>("");
  const [hq, setHq] = useState("");
  const [hSort, setHSort] = useState("at");
  const [hDir, setHDir] = useState<SortDir>("desc");
  const sortHist = (col: string) => { if (hSort === col) setHDir((d) => (d === "asc" ? "desc" : "asc")); else { setHSort(col); setHDir("desc"); } };

  // Settings form (the reward types managed here).
  const [f, setF] = useState({
    enabled: true,
    welcomeOn: true, welcomeAmt: 100,
    dailyOn: false, dailyAmt: 25,
    eventOn: true, eventAmt: 50, eventUntil: "",
    periodicOn: false, periodicInterval: 30, periodicAmt: 0, periodicDaily: 0, periodicMinLevel: 0,
  });
  useEffect(() => {
    if (loading) return;
    const c = config.freeCoins ?? {};
    setF({
      enabled: c.enabled !== false,
      welcomeOn: c.welcome?.enabled !== false, welcomeAmt: c.welcome?.amount ?? 100,
      dailyOn: c.dailyLogin?.enabled === true, dailyAmt: c.dailyLogin?.amount ?? 25,
      eventOn: c.event?.enabled !== false, eventAmt: c.event?.amount ?? 50, eventUntil: c.event?.validUntil ?? "",
      periodicOn: c.periodic?.enabled === true,
      periodicInterval: c.periodic?.intervalMinutes ?? 30,
      periodicAmt: c.periodic?.amount ?? 0,
      periodicDaily: c.periodic?.dailyLimit ?? 0,
      periodicMinLevel: c.periodic?.minLevel ?? 0,
    });
  }, [loading, config]);

  const loadReport = useCallback(async () => {
    try {
      const r = await fetch(withBase("/api/admin/free-coins"), { credentials: "include", cache: "no-store" });
      const j = await r.json();
      if (j?.bySource) setReport(j as Report);
    } catch { /* best-effort */ }
  }, []);
  useEffect(() => { void loadReport(); }, [loadReport]);

  const save = async () => {
    setSaving(true);
    const res = await saveConfig({
      freeCoins: {
        enabled: f.enabled,
        welcome: { enabled: f.welcomeOn, amount: f.welcomeAmt },
        dailyLogin: { enabled: f.dailyOn, amount: f.dailyAmt },
        event: { enabled: f.eventOn, amount: f.eventAmt, validUntil: f.eventUntil },
        periodic: { enabled: f.periodicOn, intervalMinutes: f.periodicInterval, amount: f.periodicAmt, dailyLimit: f.periodicDaily, minLevel: f.periodicMinLevel },
      },
    });
    setSaving(false);
    if (res.ok) { await reload(); toast("Free coin settings saved — live immediately.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const bySource = useMemo(() => {
    const m = new Map((report?.bySource ?? []).map((s) => [s.source, s]));
    return m;
  }, [report]);

  // Quick ON/OFF for the linked free-coin systems (flips each system's real
  // `enabled` flag — the same one its own settings page uses). The FULL current
  // object is sent so the sanitizer never resets the system's other settings.
  const [sysBusy, setSysBusy] = useState<string>("");
  const sysEnabled = (key: SysKey): boolean =>
    key === "referral" ? config.referral?.enabled !== false
    : key === "luckySpin" ? config.luckySpin?.enabled !== false
    : key === "levelRewards" ? config.levelRewards?.enabled !== false
    : config.activityReward?.enabled === true; // activity bonus ships OFF
  const toggleSys = async (key: SysKey) => {
    const next = !sysEnabled(key);
    setSysBusy(key);
    const patch =
      key === "referral" ? { referral: { ...(config.referral ?? { reward: 100, requireApproval: false, autoBlockDuplicates: true }), enabled: next } }
      : key === "luckySpin" ? { luckySpin: { ...(config.luckySpin ?? { cooldownHours: 24, segments: [] }), enabled: next } }
      : key === "levelRewards" ? { levelRewards: { ...(config.levelRewards ?? { base: 20, perLevel: 10, cap: 500, xpPlay: 12, xpWin: 30, xpGift: 6, xpDailyLogin: 25, xpPurchase: 15 }), enabled: next } }
      : { activityReward: { ...(config.activityReward ?? {}), enabled: next } };
    const res = await saveConfig(patch);
    setSysBusy("");
    if (res.ok) { await reload(); toast(`${LINKED.find((l) => l.key === key)?.source} turned ${next ? "ON" : "OFF"}`, "success"); }
    else toast(res.error ?? "Could not save", "error");
  };
  // Source filter + free-text search + click-to-sort.
  const shownHistory = applyFilterSort((report?.history ?? []).filter((h) => !srcFilter || h.source === srcFilter), {
    q: hq, sort: hSort, dir: hDir,
    searchText: (h) => [h.userName, h.publicId, h.userId, h.source, h.note, h.at.slice(0, 10)].filter(Boolean).join(" "),
    sortKeys: {
      at: (h) => new Date(h.at).getTime(),
      publicId: (h) => h.publicId ?? "",
      userName: (h) => h.userName ?? "",
      source: (h) => h.source ?? "",
      coins: (h) => h.coins,
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-24">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
          <Gift className="size-6 text-lotus-300" /> Free Coins Management
        </h1>
        <p className="mt-1 text-sm text-mist-400">
          One place to control every coin the platform gives away for free, with a complete distribution history for auditing.
        </p>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat icon={Coins} label="Total free coins given" value={report ? report.totalCoins.toLocaleString("en-SA") : "—"} accent />
        <Stat icon={History} label="Free coin grants" value={report ? report.totalCount.toLocaleString("en-SA") : "—"} />
        <Stat icon={CalendarCheck} label="Given today" value={report ? report.totalCoinsToday.toLocaleString("en-SA") : "—"} />
      </div>

      {/* Master switch */}
      <Card className="p-4 sm:p-5">
        <Toggle icon={Power} label="Free coins — master switch"
          hint="Off = the platform stops handing out the reward types below (welcome, daily login, event, manual). The other systems keep their own settings."
          on={f.enabled} onChange={(v) => setF({ ...f, enabled: v })} />
      </Card>

      {/* Managed reward types */}
      <Card className={cn("p-4 sm:p-5", !f.enabled && "opacity-60")}>
        <h2 className="mb-1 font-display text-lg font-bold text-mist-100">Reward amounts</h2>
        <p className="mb-3 text-sm text-mist-400">Set the coins and turn each reward on or off. Changes are live immediately.</p>
        <RewardRow icon={UserPlus} title="New user (welcome) bonus" hint="Given once when a new account is created."
          on={f.welcomeOn} amt={f.welcomeAmt} onToggle={(v) => setF({ ...f, welcomeOn: v })} onAmt={(v) => setF({ ...f, welcomeAmt: v })} disabled={!f.enabled} />
        <RewardRow icon={CalendarCheck} title="Daily login bonus" hint="Given on the first login each day."
          on={f.dailyOn} amt={f.dailyAmt} onToggle={(v) => setF({ ...f, dailyOn: v })} onAmt={(v) => setF({ ...f, dailyAmt: v })} disabled={!f.enabled} />
        <div className="border-t border-line/60 py-3">
          <RewardRow icon={Gift} title="Event reward (default amount)" hint="The default amount for the manual event give-away below."
            on={f.eventOn} amt={f.eventAmt} onToggle={(v) => setF({ ...f, eventOn: v })} onAmt={(v) => setF({ ...f, eventAmt: v })} disabled={!f.enabled} inline />
          {f.enabled && f.eventOn && (
            <label className="mt-2 flex flex-wrap items-center gap-2 pl-8 text-xs text-mist-400">
              Valid until (optional)
              <input type="date" value={f.eventUntil} onChange={(e) => setF({ ...f, eventUntil: e.target.value })} className="h-9 rounded-lg border border-line bg-ink-800 px-2 text-sm text-mist-100 outline-none focus:border-lotus-400" />
              {f.eventUntil && <button onClick={() => setF({ ...f, eventUntil: "" })} className="text-mist-500 hover:text-mist-200">clear</button>}
            </label>
          )}
        </div>
        <Button onClick={save} disabled={saving} className="mt-3"><Check className="size-4" /> {saving ? "Saving…" : "Save reward settings"}</Button>
      </Card>

      {/* Timed (periodic) reward — the "claim free coins every N minutes" system */}
      <Card className={cn("p-4 sm:p-5", !f.enabled && "opacity-60")}>
        <div className="mb-1 flex items-center gap-2">
          <Clock className="size-5 text-lotus-300" />
          <h2 className="font-display text-lg font-bold text-mist-100">Timed reward (claim every few minutes)</h2>
        </div>
        <p className="mb-3 text-sm text-mist-400">
          Let every eligible user claim free coins on a repeating timer. <b className="text-mist-300">This Admin Panel is the single source of truth</b> — the interval and amount you set here apply to all users instantly, and the wait is enforced on the server (changing device time, refreshing or reinstalling can’t bypass it).
        </p>
        <Toggle icon={Power} label="Enable timed reward"
          hint="Off = no repeating claim button appears for users. Turn on, set an amount, and save."
          on={f.periodicOn} onChange={(v) => setF({ ...f, periodicOn: v })} />
        {f.periodicOn && (
          <div className="mt-3 grid gap-3 border-t border-line/60 pt-3 sm:grid-cols-2">
            <NumField label="Reward interval (minutes)" hint="How long a user must wait between claims." value={f.periodicInterval} min={1}
              onChange={(v) => setF({ ...f, periodicInterval: Math.max(1, v) })} disabled={!f.enabled} suffix="min" />
            <NumField label="Coins per claim" hint="Given to the user on every successful claim." value={f.periodicAmt} min={0}
              onChange={(v) => setF({ ...f, periodicAmt: Math.max(0, v) })} disabled={!f.enabled} suffix="coins" />
            <NumField label="Daily limit (per user)" hint="Max claims per user each day. 0 = unlimited." value={f.periodicDaily} min={0}
              onChange={(v) => setF({ ...f, periodicDaily: Math.max(0, v) })} disabled={!f.enabled} suffix="/ day" />
            <NumField label="Minimum level" hint="Only users at or above this level can claim. 0 = everyone." value={f.periodicMinLevel} min={0}
              onChange={(v) => setF({ ...f, periodicMinLevel: Math.max(0, v) })} disabled={!f.enabled} suffix="level" />
          </div>
        )}
        {f.periodicOn && f.periodicAmt <= 0 && (
          <p className="mt-2 text-xs text-amber-300">Set “Coins per claim” above 0 — a 0-coin reward is treated as off.</p>
        )}
        <Button onClick={save} disabled={saving} className="mt-3"><Check className="size-4" /> {saving ? "Saving…" : "Save timed reward"}</Button>
      </Card>

      {/* Timed-reward claim log (every attempt — granted or rejected) */}
      <PeriodicClaimLog claims={report?.periodicClaims ?? []} />

      {/* Manual distribution */}
      <DistributeCard defaultAmount={f.eventAmt} onDone={() => { loadReport(); }} toast={toast} />

      {/* Other free-coin systems (managed on their own pages) */}
      <Card className="p-4 sm:p-5">
        <h2 className="mb-1 font-display text-lg font-bold text-mist-100">Other free-coin systems</h2>
        <p className="mb-3 text-sm text-mist-400">Turn each system ON/OFF right here, or open its page for the full settings. Their totals are included in the history below.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {LINKED.map((l) => {
            const s = bySource.get(l.source);
            const on = l.key ? sysEnabled(l.key) : true;
            return (
              <div key={l.source} className={cn("flex items-center gap-3 rounded-xl border border-line bg-ink-900 p-3 transition hover:border-lotus-400/50", !on && "opacity-70")}>
                <Link href={l.href} className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-lotus-500/15 text-lotus-300"><l.icon className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-mist-100">{l.source} <ExternalLink className="size-3 shrink-0 text-mist-500" /></div>
                    <div className="truncate text-xs text-mist-500">{l.note}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-sm font-bold text-gold-300">{s ? s.coins.toLocaleString("en-SA") : 0}</div>
                    <div className="text-[10px] text-mist-500">given</div>
                  </div>
                </Link>
                {l.key ? (
                  <button
                    onClick={() => void toggleSys(l.key!)}
                    disabled={sysBusy === l.key}
                    className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold transition disabled:opacity-60", on ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25" : "bg-rose-500/15 text-rose-300 hover:bg-rose-500/25")}
                    title={`Turn ${l.source} ${on ? "off" : "on"}`}
                  >
                    {sysBusy === l.key ? "…" : on ? "ON" : "OFF"}
                  </button>
                ) : (
                  <span className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-mist-500" title="Prizes are distributed manually by admins — nothing runs automatically">manual</span>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Per-source counts — CLICKABLE to filter the history below */}
      <Card className="p-4 sm:p-5">
        <h2 className="mb-1 font-display text-lg font-bold text-mist-100">Distribution by source</h2>
        <p className="mb-3 text-sm text-mist-400">Tap any source to see exactly who received those coins.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <button onClick={() => setSrcFilter("")} className={cn("rounded-xl border p-3 text-left transition", !srcFilter ? "border-lotus-400 bg-lotus-500/10" : "border-line bg-ink-900 hover:bg-white/[0.05]")}>
            <div className="font-display text-lg font-extrabold text-mist-100">{report ? report.totalCoins.toLocaleString("en-SA") : "—"}</div>
            <div className="text-xs text-mist-400">All sources · {report?.totalCount ?? 0}</div>
          </button>
          {(report?.bySource ?? []).filter((s) => s.count > 0).map((s) => (
            <button key={s.source} onClick={() => setSrcFilter(s.source)} className={cn("rounded-xl border p-3 text-left transition", srcFilter === s.source ? "border-lotus-400 bg-lotus-500/10" : "border-line bg-ink-900 hover:bg-white/[0.05]")}>
              <div className="font-display text-lg font-extrabold text-gold-300">{s.coins.toLocaleString("en-SA")}</div>
              <div className="text-xs text-mist-400">{s.source} · {s.count}{s.coinsToday > 0 ? <span className="ml-1 text-emerald-300">+{s.coinsToday} today</span> : null}</div>
            </button>
          ))}
        </div>
      </Card>

      {/* Distribution history (audit) */}
      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><History className="size-5 text-lotus-300" /> Distribution history {srcFilter && <span className="text-sm font-normal text-lotus-300">· {srcFilter}</span>}</h2>
          <div className="flex items-center gap-2">
            <TableSearch value={hq} onChange={setHq} placeholder="Search name / ID / source…" className="w-56" />
            {srcFilter && <button onClick={() => setSrcFilter("")} className="text-xs font-semibold text-mist-400 hover:text-mist-100">Show all</button>}
          </div>
        </div>
        {shownHistory.length === 0 ? (
          <p className="py-8 text-center text-sm text-mist-500">No free-coin distributions{srcFilter ? ` for ${srcFilter}` : ""} yet.</p>
        ) : (
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-mist-500">
                  <SortTh col="at" sort={hSort} dir={hDir} onSort={sortHist}>Date &amp; time</SortTh>
                  <SortTh col="publicId" sort={hSort} dir={hDir} onSort={sortHist}>ID number</SortTh>
                  <SortTh col="userName" sort={hSort} dir={hDir} onSort={sortHist}>User</SortTh>
                  <SortTh col="source" sort={hSort} dir={hDir} onSort={sortHist}>Source</SortTh>
                  <SortTh col="coins" sort={hSort} dir={hDir} onSort={sortHist} align="right">Coins</SortTh>
                </tr>
              </thead>
              <tbody>
                {shownHistory.slice(0, 500).map((h) => (
                  <tr key={h.id} className="border-b border-line/50">
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-mist-400">{new Date(h.at).toLocaleString("en-SA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-mist-300">{h.publicId ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/users?q=${encodeURIComponent(h.publicId || h.userId)}`} className="font-semibold text-mist-100 hover:text-lotus-300 hover:underline">{h.userName}</Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-mist-300">{h.source}</span>
                      {/* The raw description — shows exactly WHAT this grant was
                          (answers "what is Other Free Coins?" at a glance). */}
                      {h.note && <div className="mt-1 max-w-[280px] truncate text-[10px] text-mist-500" title={h.note}>{h.note}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold tabular-nums text-gold-300">+{h.coins.toLocaleString("en-SA")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shownHistory.length > 500 && <p className="mt-2 text-center text-[11px] text-mist-500">Showing the 500 most recent of {shownHistory.length}.</p>}
          </div>
        )}
      </Card>
    </div>
  );
}

// ---- Manual distribution card ----
function DistributeCard({ defaultAmount, onDone, toast }: { defaultAmount: number; onDone: () => void; toast: (m: string, t?: "success" | "error" | "info") => void }) {
  const [target, setTarget] = useState("");
  const [amount, setAmount] = useState(defaultAmount);
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<"event" | "manual">("event");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setAmount(defaultAmount); }, [defaultAmount]);

  const give = async () => {
    if (!(amount > 0)) { toast("Enter a coin amount", "error"); return; }
    setBusy(true);
    const res = await fetch(withBase("/api/admin/free-coins"), {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: target.trim() || "all", amount, kind, label }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { toast(`Gave ${amount} coins to ${d.credited} ${d.credited === 1 ? "user" : "users"}.`, "success"); setLabel(""); onDone(); }
    else toast(d.error ?? "Could not distribute coins", "error");
  };

  const field = "h-10 rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400";
  return (
    <Card className="p-4 sm:p-5">
      <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Send className="size-5 text-lotus-300" /> Give free coins</h2>
      <p className="mb-3 text-sm text-mist-400">Hand out coins to one member or to everyone — for an event, promotion or compensation. Every grant is logged below.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-mist-400">To</span>
          <div className="mt-1">
            <UserPicker value={target} onPick={(v) => setTarget(v)} placeholder="Everyone (or search a member by name / ID)" />
          </div>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-mist-400">Coins</span>
          <input type="number" min={1} value={amount} onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))} className={cn(field, "mt-1 w-full")} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-mist-400">Reason / label (shown in history)</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder="e.g. Diwali event" className={cn(field, "mt-1 w-full")} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-mist-400">Type</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as "event" | "manual")} className={cn(field, "mt-1 w-full")}>
            <option value="event">Event reward</option>
            <option value="manual">Manual reward</option>
          </select>
        </label>
      </div>
      <Button onClick={give} disabled={busy} className="mt-3"><Send className="size-4" /> {busy ? "Giving…" : "Give coins"}</Button>
      <p className="mt-2 text-[11px] text-mist-500">Leaving “To” empty gives the coins to <b className="text-mist-400">every active member</b>. Blocked when the master switch is off.</p>
    </Card>
  );
}

function NumField({ label, hint, value, onChange, min, disabled, suffix }: {
  label: string; hint?: string; value: number; onChange: (v: number) => void; min?: number; disabled?: boolean; suffix?: string;
}) {
  return (
    <label className={cn("block", disabled && "opacity-60")}>
      <span className="text-xs font-semibold text-mist-300">{label}</span>
      {hint && <span className="mt-0.5 block text-[11px] text-mist-500">{hint}</span>}
      <div className="mt-1 flex items-center gap-1.5">
        <input type="number" min={min ?? 0} value={value} disabled={disabled}
          onChange={(e) => onChange(Math.floor(Number(e.target.value) || 0))}
          className="h-10 w-28 rounded-lg border border-line bg-ink-800 px-3 text-sm font-semibold text-mist-100 outline-none focus:border-lotus-400 disabled:opacity-50" />
        {suffix && <span className="text-xs text-mist-500">{suffix}</span>}
      </div>
    </label>
  );
}

// The timed-reward claim log — every attempt, granted or rejected, with the
// user, time, coins, the interval in force, the result and (on a rejection) why.
function PeriodicClaimLog({ claims }: { claims: PeriodicClaim[] }) {
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"all" | "granted" | "rejected">("all");
  const granted = claims.filter((c) => c.result === "granted").length;
  const rejected = claims.length - granted;
  const totalCoins = claims.filter((c) => c.result === "granted").reduce((a, c) => a + c.amount, 0);
  const shown = claims.filter((c) => (only === "all" || c.result === only) &&
    (!q || [c.userName, c.publicId, c.userId, c.reason].filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase())));
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-1 flex items-center gap-2">
        <History className="size-5 text-lotus-300" />
        <h2 className="font-display text-lg font-bold text-mist-100">Timed reward — claim log</h2>
      </div>
      <p className="mb-3 text-sm text-mist-400">Every claim attempt is recorded here (successful and rejected), for auditing.</p>
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/[0.06] p-3"><div className="font-display text-lg font-extrabold text-emerald-200">{granted.toLocaleString("en-SA")}</div><div className="text-[11px] text-mist-500">Granted · {totalCoins.toLocaleString("en-SA")} coins</div></div>
        <div className="rounded-xl border border-rose-400/25 bg-rose-500/[0.06] p-3"><div className="font-display text-lg font-extrabold text-rose-200">{rejected.toLocaleString("en-SA")}</div><div className="text-[11px] text-mist-500">Rejected</div></div>
        <div className="rounded-xl border border-line bg-ink-900 p-3"><div className="font-display text-lg font-extrabold text-mist-100">{claims.length.toLocaleString("en-SA")}</div><div className="text-[11px] text-mist-500">Total attempts</div></div>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TableSearch value={q} onChange={setQ} placeholder="Search user / ID / reason…" className="w-56" />
        <div className="flex gap-1">
          {(["all", "granted", "rejected"] as const).map((k) => (
            <button key={k} onClick={() => setOnly(k)} className={cn("rounded-full px-3 py-1 text-xs font-semibold capitalize transition", only === k ? "bg-lotus-500/20 text-lotus-200" : "bg-white/[0.05] text-mist-400 hover:text-mist-200")}>{k}</button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-mist-500">No timed-reward claims yet.</p>
      ) : (
        <div className="-mx-4 overflow-x-auto sm:-mx-5">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-mist-500">
                <th className="px-4 py-2.5 font-semibold">Date &amp; time</th>
                <th className="px-4 py-2.5 font-semibold">ID number</th>
                <th className="px-4 py-2.5 font-semibold">User</th>
                <th className="px-4 py-2.5 font-semibold">Interval</th>
                <th className="px-4 py-2.5 text-right font-semibold">Coins</th>
                <th className="px-4 py-2.5 font-semibold">Result</th>
              </tr>
            </thead>
            <tbody>
              {shown.slice(0, 500).map((c) => (
                <tr key={c.id} className="border-b border-line/50">
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-mist-400">{new Date(c.at).toLocaleString("en-SA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-mist-300">{c.publicId ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/users?q=${encodeURIComponent(c.publicId || c.userId)}`} className="font-semibold text-mist-100 hover:text-lotus-300 hover:underline">{c.userName}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-mist-400">{c.intervalMinutes} min</td>
                  <td className={cn("px-4 py-2.5 text-right font-bold tabular-nums", c.result === "granted" ? "text-gold-300" : "text-mist-600")}>{c.result === "granted" ? `+${c.amount.toLocaleString("en-SA")}` : "—"}</td>
                  <td className="px-4 py-2.5">
                    {c.result === "granted"
                      ? <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">Granted</span>
                      : <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300" title={c.reason}>Rejected{c.reason ? ` · ${c.reason}` : ""}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length > 500 && <p className="mt-2 text-center text-[11px] text-mist-500">Showing the 500 most recent of {shown.length}.</p>}
        </div>
      )}
    </Card>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: ComponentType<{ className?: string }>; label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-3", accent ? "border-lotus-400/40 bg-lotus-500/[0.08]" : "border-line bg-ink-900")}>
      <Icon className={cn("size-4", accent ? "text-lotus-300" : "text-mist-400")} />
      <div className={cn("mt-2 font-display text-xl font-extrabold tabular-nums", accent ? "text-lotus-200" : "text-mist-100")}>{value}</div>
      <div className="text-[11px] leading-tight text-mist-500">{label}</div>
    </div>
  );
}

function Toggle({ icon: Icon, label, hint, on, onChange }: { icon: ComponentType<{ className?: string }>; label: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="size-5 shrink-0 text-mist-400" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-mist-100">{label}</div>
        <div className="text-xs text-mist-500">{hint}</div>
      </div>
      <button onClick={() => onChange(!on)} role="switch" aria-checked={on} className={cn("relative h-6 w-11 shrink-0 rounded-full transition", on ? "bg-emerald-500" : "bg-mist-600")}>
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );
}

function RewardRow({ icon: Icon, title, hint, on, amt, onToggle, onAmt, disabled, inline }: {
  icon: ComponentType<{ className?: string }>; title: string; hint: string; on: boolean; amt: number;
  onToggle: (v: boolean) => void; onAmt: (v: number) => void; disabled?: boolean; inline?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3 py-3", !inline && "border-t border-line/60 first:border-t-0", disabled && "opacity-60")}>
      <Icon className="size-5 shrink-0 text-mist-400" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-mist-100">{title}</div>
        <div className="text-xs text-mist-500">{hint}</div>
      </div>
      <div className="flex items-center gap-1.5">
        <input type="number" min={0} value={amt} disabled={disabled || !on} onChange={(e) => onAmt(Math.max(0, Number(e.target.value) || 0))} className="h-9 w-24 rounded-lg border border-line bg-ink-800 px-2 text-sm font-semibold text-mist-100 outline-none focus:border-lotus-400 disabled:opacity-50" />
        <span className="text-xs text-mist-500">coins</span>
      </div>
      <button onClick={() => !disabled && onToggle(!on)} role="switch" aria-checked={on} disabled={disabled} className={cn("relative h-6 w-11 shrink-0 rounded-full transition", on ? "bg-emerald-500" : "bg-mist-600", disabled && "cursor-not-allowed")}>
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );
}
