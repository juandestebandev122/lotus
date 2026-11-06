"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { fetchAdminUsers, type AdminUser } from "@/lib/admin";
import { Dices, ShieldCheck, Users, Activity, AlertTriangle, Check, Search, Trash2, Loader2, History, BarChart3, Info } from "lucide-react";

type Duration = "match" | "day" | "permanent" | "tournament";
interface PlayerControl { id: string; userId: string; userName: string; preferredValues: number[]; strength?: number; duration?: Duration; setAt?: string; setBy?: string }
interface DiceControl {
  mode: "random" | "controlled" | "tournament" | "testing";
  fairPlayProtection: boolean; useProbabilities: boolean;
  probabilities: { one: number; two: number; three: number; four: number; five: number; six: number };
  equalProbability: boolean; winnerBalancing: boolean; newPlayerSupport: boolean; autoFairness: boolean;
  maxRollsWithout6: number; minRollsBefore6: number; disableConsecutive6: boolean; maxConsecutive6: number;
  boostThreshold: number; boostPercent: number; playerControls: PlayerControl[];
}
interface AuditEntry { id: string; admin: string; at: string; summary: string; changes: { field: string; from: string; to: string }[] }
interface Stats { total: number; range: string; counts: Record<number, number>; distribution: Record<number, number>; byPlayer: { name: string; total: number; sixes: number }[]; byMatch: { matchId: string; game: string; total: number }[] }
const RANGE_LABELS: Record<string, string> = { today: "Today", week: "Last 7 days", month: "Last 30 days", all: "All time", custom: "Custom range" };

const DEFAULTS: DiceControl = { mode: "random", fairPlayProtection: true, useProbabilities: false, probabilities: { one: 17, two: 17, three: 17, four: 17, five: 16, six: 16 }, equalProbability: false, winnerBalancing: false, newPlayerSupport: false, autoFairness: false, maxRollsWithout6: 0, minRollsBefore6: 0, disableConsecutive6: false, maxConsecutive6: 0, boostThreshold: 0, boostPercent: 0, playerControls: [] };
const fmt = (iso?: string) => { if (!iso) return ""; try { return new Date(iso).toLocaleString("en-SA", { dateStyle: "medium", timeStyle: "short" }); } catch { return iso; } };
const field = "rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400";

export default function AdminDiceControlPage() {
  const { toast } = useToast();
  const [dc, setDc] = useState<DiceControl>(DEFAULTS);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [uq, setUq] = useState("");
  const [pickPrefs, setPickPrefs] = useState<number[]>([6]);
  const [pickDur, setPickDur] = useState<Duration>("permanent");
  const [pickStrength, setPickStrength] = useState(100);
  // Section 7 — monitoring range + player search
  const [range, setRange] = useState("today");
  const [cFrom, setCFrom] = useState("");
  const [cTo, setCTo] = useState("");
  const [statsBusy, setStatsBusy] = useState(false);
  const [pq, setPq] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/dice-control", { credentials: "include", cache: "no-store" });
      const d = await res.json();
      setDc({ ...DEFAULTS, ...(d.diceControl ?? {}), probabilities: { ...DEFAULTS.probabilities, ...(d.diceControl?.probabilities ?? {}) }, playerControls: d.diceControl?.playerControls ?? [] });
      setAudit(d.audit ?? []); setStats(d.stats ?? null);
    } catch { toast("Could not load dice control", "error"); }
    setLoading(false);
  };
  // Refetch ONLY the monitoring stats for a chosen range (never overwrites the settings
  // form the admin may be editing).
  const loadStats = async (r: string, f = cFrom, t = cTo) => {
    setStatsBusy(true);
    try {
      const qs = new URLSearchParams({ range: r });
      if (r === "custom") { if (f) qs.set("from", f); if (t) qs.set("to", t); }
      const res = await fetch(`/api/admin/dice-control?${qs.toString()}`, { credentials: "include", cache: "no-store" });
      const d = await res.json();
      setStats(d.stats ?? null);
    } catch { toast("Could not load stats", "error"); }
    setStatsBusy(false);
  };
  const pickRange = (r: string) => { setRange(r); if (r !== "custom") loadStats(r); };
  useEffect(() => { load(); }, []);
  useEffect(() => { fetchAdminUsers().then(setUsers).catch(() => {}); }, []);

  const probTotal = useMemo(() => Object.values(dc.probabilities).reduce((a, b) => a + (Number(b) || 0), 0), [dc.probabilities]);
  const probOk = probTotal === 100;
  const shownPlayers = useMemo(
    () => (stats?.byPlayer ?? []).filter((p) => p.name.toLowerCase().includes(pq.trim().toLowerCase())),
    [stats, pq],
  );

  const save = async () => {
    if (dc.useProbabilities && !probOk) { toast(`Dice probabilities must total 100% (currently ${probTotal}%).`, "error"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/dice-control", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ action: "save", settings: dc }) });
      const d = await res.json();
      if (res.ok && d.ok) { toast("Dice control saved — live now.", "success"); load(); }
      else toast(d.error ?? "Could not save", "error");
    } catch { toast("Could not save", "error"); }
    setSaving(false);
  };
  const emergency = async (action: "emergencyReset" | "disableCustom", confirmMsg: string) => {
    if (!window.confirm(confirmMsg)) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/dice-control", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ action }) });
      const d = await res.json();
      if (res.ok && d.ok) { toast("Done — dice reset to certified fair random.", "success"); load(); }
      else toast(d.error ?? "Failed", "error");
    } catch { toast("Failed", "error"); }
    setSaving(false);
  };

  const set = <K extends keyof DiceControl>(k: K, v: DiceControl[K]) => setDc((s) => ({ ...s, [k]: v }));
  const setProb = (k: keyof DiceControl["probabilities"], v: number) => setDc((s) => ({ ...s, probabilities: { ...s.probabilities, [k]: Math.max(0, Math.min(100, Math.floor(v || 0))) } }));
  const normalize = () => setDc((s) => { const keys = Object.keys(s.probabilities) as (keyof DiceControl["probabilities"])[]; const eq = [17, 17, 17, 17, 16, 16]; const p = { ...s.probabilities }; keys.forEach((k, i) => (p[k] = eq[i])); return { ...s, probabilities: p }; });

  const userMatches = uq.trim() ? users.filter((u) => `${u.fullName} ${u.username ?? ""} ${u.publicId ?? ""} ${u.email ?? ""}`.toLowerCase().includes(uq.trim().toLowerCase())).slice(0, 6) : [];
  const addPlayerControl = (u: AdminUser) => {
    if (dc.playerControls.some((p) => p.userId === u.id)) { toast("That user already has a rule.", "info"); return; }
    set("playerControls", [...dc.playerControls, { id: `pc_${Math.random().toString(36).slice(2, 10)}`, userId: u.id, userName: u.fullName, preferredValues: [...pickPrefs], strength: pickStrength, duration: pickDur, setAt: new Date().toISOString() }]);
    setUq("");
  };
  const removePlayerControl = (id: string) => set("playerControls", dc.playerControls.filter((p) => p.id !== id));

  const Toggle = ({ v, onChange }: { v: boolean; onChange: (b: boolean) => void }) => (
    <button onClick={() => onChange(!v)} role="switch" aria-checked={v} className={cn("relative h-6 w-11 shrink-0 rounded-full transition", v ? "bg-emerald-500" : "bg-mist-600")}>
      <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", v ? "left-[22px]" : "left-0.5")} />
    </button>
  );
  const Row = ({ label, hint, k }: { label: string; hint?: string; k: keyof DiceControl }) => (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-ink-900/50 p-2.5">
      <div className="min-w-0 flex-1"><div className="text-sm text-mist-100">{label}</div>{hint && <div className="text-[11px] text-mist-500">{hint}</div>}</div>
      <Toggle v={dc[k] as boolean} onChange={(b) => set(k, b as DiceControl[typeof k])} />
    </div>
  );
  const NumRow = ({ label, hint, k, max = 100 }: { label: string; hint?: string; k: keyof DiceControl; max?: number }) => (
    <label className="block">
      <span className="text-xs font-semibold text-mist-300">{label}</span>
      <input type="number" min={0} max={max} value={(dc[k] as number) || ""} onChange={(e) => set(k, Math.max(0, Math.min(max, Math.floor(Number(e.target.value) || 0))) as DiceControl[typeof k])} placeholder="0" className={cn(field, "mt-1 w-full")} />
      {hint && <span className="mt-0.5 block text-[11px] text-mist-500">{hint}</span>}
    </label>
  );

  const controlsHidden = dc.mode === "random";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-mist-100">Dice Control Management</h1>
          <p className="text-sm text-mist-400">Configure how the Ludo dice behave. Applies to <b className="text-mist-200">casual play only</b> — paid tournaments &amp; cash matches always use certified fair random. Every change is audit-logged.</p>
        </div>
        <Button onClick={save} disabled={saving || loading}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save settings</Button>
      </div>

      {loading ? <div className="grid place-items-center py-16 text-mist-500"><Loader2 className="size-6 animate-spin" /></div> : (
        <>
          {/* Fair-play banner */}
          <div className={cn("flex items-start gap-2 rounded-xl border px-4 py-3 text-xs", dc.fairPlayProtection ? "border-emerald-400/25 bg-emerald-500/5 text-mist-300" : "border-rose-400/30 bg-rose-500/10 text-rose-200")}>
            <ShieldCheck className={cn("mt-0.5 size-4 shrink-0", dc.fairPlayProtection ? "text-emerald-300" : "text-rose-300")} />
            <p>{dc.fairPlayProtection ? <><b className="text-emerald-200">Fair-play protection is ON.</b> Paid tournaments and cash matches ignore all custom dice controls and use certified fair random — recommended, and matches your own rule.</> : <><b>Fair-play protection is OFF.</b> Custom controls could affect paid matches — turn it back on for paid tournaments to avoid player complaints.</>}</p>
          </div>

          {/* 1 · Mode */}
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold text-mist-100"><Dices className="size-4 text-lotus-300" /> 1 · Dice mode</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([["random", "Normal Random", "Pure fair random (default)"], ["controlled", "Controlled", "Use probabilities + rules"], ["tournament", "Tournament", "Enforced equal/fair"], ["testing", "Testing", "Sandbox — for admin tests"]] as [DiceControl["mode"], string, string][]).map(([m, label, hint]) => (
                <button key={m} onClick={() => set("mode", m)} className={cn("rounded-xl border p-3 text-left transition", dc.mode === m ? "border-lotus-400 bg-lotus-500/15" : "border-line bg-ink-900 hover:border-lotus-400/40")}>
                  <div className={cn("text-sm font-bold", dc.mode === m ? "text-lotus-200" : "text-mist-100")}>{label}</div>
                  <div className="text-[11px] text-mist-500">{hint}</div>
                </button>
              ))}
            </div>
            {controlsHidden && <p className="mt-3 rounded-lg bg-ink-900/60 px-3 py-2 text-xs text-mist-400">Normal Random is active — the dice are 100% fair and none of the controls below apply. Pick another mode to enable them.</p>}
          </Card>

          {/* 2 · Probability */}
          <Card className={cn("p-5", controlsHidden && "opacity-60")}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-semibold text-mist-100"><BarChart3 className="size-4 text-lotus-300" /> 2 · Dice probability</h2>
              <label className="flex items-center gap-2 text-xs font-semibold text-mist-300">Use probability table <Toggle v={dc.useProbabilities} onChange={(b) => set("useProbabilities", b)} /></label>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {(["one", "two", "three", "four", "five", "six"] as const).map((k, i) => (
                <label key={k} className="block text-center">
                  <span className="text-xs font-bold text-mist-300">{i + 1}</span>
                  <input type="number" min={0} max={100} value={dc.probabilities[k]} onChange={(e) => setProb(k, Number(e.target.value))} className={cn(field, "mt-1 w-full text-center")} />
                </label>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className={cn("font-semibold", probOk ? "text-emerald-300" : "text-rose-300")}>Total: {probTotal}% {probOk ? "✓" : "(must equal 100%)"}</span>
              <button onClick={normalize} className="rounded-lg border border-line px-2 py-1 text-mist-300 hover:text-mist-100">Reset to equal</button>
            </div>
          </Card>

          {/* 5 · Six control */}
          <Card className={cn("p-5", controlsHidden && "opacity-60")}>
            <h2 className="flex items-center gap-2 font-semibold text-mist-100"><Dices className="size-4 text-lotus-300" /> 5 · Six (6) control</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <NumRow label="Guarantee a 6 after N rolls without one" hint="0 = off" k="maxRollsWithout6" />
              <NumRow label="No 6 in the first N rolls of a game" hint="0 = off" k="minRollsBefore6" />
              <NumRow label="Boost chance % past the streak" hint="works with the streak below" k="boostPercent" />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <NumRow label="Boost starts after N rolls without a 6" hint="0 = off" k="boostThreshold" />
              <label className="block">
                <span className="text-xs font-semibold text-mist-300">Limit consecutive 6s</span>
                <select value={dc.maxConsecutive6} onChange={(e) => set("maxConsecutive6", Number(e.target.value))} className={cn(field, "mt-1 w-full")} disabled={dc.disableConsecutive6}>
                  <option value={0}>Game default (3)</option><option value={1}>Max 1</option><option value={2}>Max 2</option><option value={3}>Max 3</option>
                </select>
              </label>
              <div className="flex items-end"><div className="w-full"><Row label="Disable consecutive 6s" hint="never two 6s in a row" k="disableConsecutive6" /></div></div>
            </div>
          </Card>

          {/* 4 · Match-based control */}
          <Card className={cn("p-5", controlsHidden && "opacity-60")}>
            <h2 className="flex items-center gap-2 font-semibold text-mist-100"><Users className="size-4 text-lotus-300" /> 4 · Match-based fairness</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Row label="Equal probability for all players" hint="force uniform 1–6 for everyone" k="equalProbability" />
              <Row label="Winner balancing" hint="gently help the player who is behind" k="winnerBalancing" />
              <Row label="New player support" hint="give newcomers a small boost" k="newPlayerSupport" />
              <Row label="Auto fairness mode" hint="auto-nudge low rolls for a trailing player" k="autoFairness" />
            </div>
          </Card>

          {/* 3 · Player-based control */}
          <Card className={cn("p-5", controlsHidden && "opacity-60")}>
            <h2 className="flex items-center gap-2 font-semibold text-mist-100"><Users className="size-4 text-lotus-300" /> 3 · Player-based dice control</h2>
            <p className="mt-1 text-xs text-mist-400">Bias a specific player&apos;s dice toward chosen values (casual only). Use responsibly — every change is logged.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <span className="text-xs font-semibold text-mist-300">Preferred values</span>
                <div className="mt-1 flex gap-1">{[1, 2, 3, 4, 5, 6].map((n) => (
                  <button key={n} onClick={() => setPickPrefs((p) => p.includes(n) ? p.filter((x) => x !== n) : [...p, n])} className={cn("size-8 rounded-lg border text-sm font-bold", pickPrefs.includes(n) ? "border-lotus-400 bg-lotus-500/20 text-lotus-200" : "border-line bg-ink-900 text-mist-400")}>{n}</button>
                ))}</div>
              </div>
              <label className="block"><span className="text-xs font-semibold text-mist-300">Strength %</span><input type="number" min={0} max={100} value={pickStrength} onChange={(e) => setPickStrength(Math.max(0, Math.min(100, Math.floor(Number(e.target.value) || 0))))} className={cn(field, "mt-1 w-full")} /></label>
              <label className="block"><span className="text-xs font-semibold text-mist-300">Duration</span>
                <select value={pickDur} onChange={(e) => setPickDur(e.target.value as Duration)} className={cn(field, "mt-1 w-full")}>
                  <option value="match">1 Match</option><option value="day">1 Day</option><option value="permanent">Permanent</option><option value="tournament">Tournament only</option>
                </select>
              </label>
            </div>
            <div className="relative mt-3">
              <div className="flex items-center gap-2 rounded-lg border border-line bg-ink-900 px-3"><Search className="size-4 text-mist-500" /><input value={uq} onChange={(e) => setUq(e.target.value)} placeholder="Search a user to add a rule…" className="w-full bg-transparent py-2 text-sm text-mist-100 outline-none" /></div>
              {userMatches.length > 0 && (
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-white/10 bg-ink-850 shadow-xl">
                  {userMatches.map((u) => (
                    <button key={u.id} onClick={() => addPlayerControl(u)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-white/[0.05]">
                      <span className="truncate text-mist-100">{u.fullName} <span className="text-xs text-mist-500">@{u.username}</span></span>
                      <span className="text-[11px] text-lotus-300">add rule</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {dc.playerControls.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {dc.playerControls.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 rounded-lg border border-line bg-ink-900/50 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate text-mist-100">{p.userName}</span>
                    <span className="text-xs text-mist-400">→ {p.preferredValues.join(", ") || "—"} · {p.strength ?? 100}% · {p.duration}</span>
                    <button onClick={() => removePlayerControl(p.id)} className="text-rose-300 hover:text-rose-200"><Trash2 className="size-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* 6 · Fair play */}
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold text-mist-100"><ShieldCheck className="size-4 text-emerald-300" /> 6 · Coin safety &amp; fair play</h2>
            <div className="mt-3"><Row label="Fair-play protection (paid matches always fair)" hint="STRONGLY recommended ON — paid tournaments/cash matches ignore all custom controls" k="fairPlayProtection" /></div>
          </Card>

          {/* 7 · Monitoring */}
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold text-mist-100"><Activity className="size-4 text-lotus-300" /> 7 · Real-time monitoring</h2>
            {/* Time-range selector */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {(["today", "week", "month", "all", "custom"] as const).map((r) => (
                <button key={r} onClick={() => pickRange(r)} className={cn("rounded-full px-3 py-1 text-xs font-semibold transition", range === r ? "bg-lotus-500 text-white" : "border border-line bg-ink-800 text-mist-400 hover:text-mist-100")}>{RANGE_LABELS[r]}</button>
              ))}
              {statsBusy && <span className="text-[11px] text-mist-500">loading…</span>}
            </div>
            {range === "custom" && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mist-400">
                <span>From</span>
                <input type="date" value={cFrom} onChange={(e) => setCFrom(e.target.value)} className={field} />
                <span>To</span>
                <input type="date" value={cTo} onChange={(e) => setCTo(e.target.value)} className={field} />
                <Button size="sm" variant="secondary" onClick={() => loadStats("custom", cFrom, cTo)} disabled={!cFrom && !cTo}>Apply</Button>
              </div>
            )}
            {!stats || stats.total === 0 ? (
              <p className="mt-3 text-sm text-mist-500">No dice rolls recorded for {(RANGE_LABELS[range] ?? "this range").toLowerCase()} yet.</p>
            ) : (
              <>
                <div className="mt-3 text-sm text-mist-300">Total rolls ({RANGE_LABELS[stats.range] ?? RANGE_LABELS[range]}): <b className="text-mist-100 tabular-nums">{stats.total.toLocaleString("en-SA")}</b></div>
                <div className="mt-3 grid grid-cols-6 gap-2">
                  {[1, 2, 3, 4, 5, 6].map((v) => (
                    <div key={v} className="rounded-lg border border-line bg-ink-900/50 p-2 text-center">
                      <div className="text-lg font-extrabold text-mist-100 tabular-nums">{stats.counts[v] ?? 0}</div>
                      <div className="text-[10px] text-mist-500">rolled {v}</div>
                      <div className="text-[11px] font-semibold text-lotus-300">{stats.distribution[v] ?? 0}%</div>
                    </div>
                  ))}
                </div>
                {stats.byPlayer.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-mist-500">Player-wise · {stats.byPlayer.length} player{stats.byPlayer.length === 1 ? "" : "s"}</div>
                      <input value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Search player…" className={cn(field, "py-1 text-xs")} />
                    </div>
                    <div className="max-h-72 space-y-1 overflow-y-auto">
                      {shownPlayers.map((p) => {
                        const sixPct = p.total ? Math.round((p.sixes / p.total) * 1000) / 10 : 0;
                        return (
                          <div key={p.name} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-ink-900/40 px-3 py-1.5 text-xs">
                            <span className="truncate text-mist-200">{p.name}</span>
                            <span className="shrink-0 text-mist-500">{p.total} rolls · {p.sixes} sixes · <span className="text-lotus-300">{sixPct}%</span> six</span>
                          </div>
                        );
                      })}
                      {shownPlayers.length === 0 && <p className="py-3 text-center text-xs text-mist-500">No player matches “{pq}”.</p>}
                    </div>
                  </div>
                )}
                {/* The old cryptic "Full details — N matches (Gr_xxx · N rolls)" list was
                    replaced by the readable Last Played Match History page. */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-lotus-400/25 bg-lotus-500/[0.06] p-3">
                  <div className="flex items-center gap-2 text-sm text-mist-200">
                    <History className="size-4 text-lotus-300" />
                    <span>See every match in full — players, per-player dice, roll history &amp; the move-by-move timeline.</span>
                  </div>
                  <Link href="/admin/match-history" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-lotus-600/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-lotus-600">Open Match History →</Link>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-mist-500">Fair dice average about <b className="text-mist-300">16.7% sixes</b> for everyone over time. Short samples swing a lot (a player with only ~70 rolls can sit anywhere from 7% to 22% by chance alone) — that isn&apos;t bias. Casual dice are random by default; paid tournaments &amp; cash matches always use certified fair random.</p>
              </>
            )}
          </Card>

          {/* 8 · Emergency */}
          <Card className="border-rose-400/20 p-5">
            <h2 className="flex items-center gap-2 font-semibold text-mist-100"><AlertTriangle className="size-4 text-rose-300" /> 8 · Emergency controls</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => emergency("disableCustom", "Instantly switch to Normal Random (keeps your settings, stops applying them)?")} disabled={saving}>Disable all custom controls</Button>
              <Button variant="danger" onClick={() => emergency("emergencyReset", "RESET all dice settings to certified fair random? This clears every custom rule.")} disabled={saving}>Reset to certified fair random</Button>
            </div>
          </Card>

          {/* Audit */}
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold text-mist-100"><History className="size-4 text-lotus-300" /> Audit history</h2>
            {audit.length === 0 ? <p className="mt-2 text-sm text-mist-500">No changes recorded yet.</p> : (
              <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
                {audit.map((a) => (
                  <div key={a.id} className="rounded-lg border border-line bg-ink-900/50 p-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2"><span className="font-semibold text-mist-100">{a.summary}</span><span className="text-mist-500">{a.admin} · {fmt(a.at)}</span></div>
                    {a.changes.length > 0 && <div className="mt-1 space-y-0.5">{a.changes.map((c, i) => (<div key={i} className="text-mist-500"><b className="text-mist-400">{c.field}</b>: <span className="text-rose-300/80">{c.from || "—"}</span> → <span className="text-emerald-300/90">{c.to || "—"}</span></div>))}</div>}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="flex items-start gap-2 rounded-xl border border-sky-400/20 bg-sky-500/5 px-4 py-3 text-xs text-mist-400">
            <Info className="mt-0.5 size-4 shrink-0 text-sky-300" />
            <p>Dice control applies to <b className="text-mist-200">Ludo</b> (the dice game). Because a roll happens in the player&apos;s browser, these controls shape the experience for honest players; a determined cheat could tamper with their own device — the fully tamper-proof version needs server-side dice (a larger change). Paid matches stay fair regardless.</p>
          </div>

          <div className="pb-4"><Button onClick={save} disabled={saving || loading} block>{saving ? "Saving…" : "Save all dice control settings"}</Button></div>
        </>
      )}
    </div>
  );
}
