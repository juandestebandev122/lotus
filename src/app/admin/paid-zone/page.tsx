"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { fetchAdminPaidZone, adminPaidZoneAction, clearPaidZoneLog, fetchPaidZoneCalls, adminForceEndCall, adminEditPaidZoneProfile, CALL_INTEREST_LABEL, type PZAdminMember, type PZActivity, type PZCall, type PZStats, type CallInterest } from "@/lib/paid-zone";
import { uploadFile } from "@/lib/upload";
import { UserLink, TableSearch, SortTh, applyFilterSort, type SortDir } from "@/components/admin/TableControls";
import { Gem, Check, X, FileText, Ban, Trash2, RotateCcw, Clock, Coins, Power, Save, ScrollText, Flag, Phone, Video, PhoneOff, Radio, Users, BarChart3, Wifi, Landmark, Pencil, Upload, Eye, EyeOff } from "lucide-react";

const STATUS_PILL: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300",
  approved: "bg-emerald-500/15 text-emerald-300",
  rejected: "bg-rose-500/15 text-rose-300",
  suspended: "bg-orange-500/15 text-orange-300",
};

const LOG_TONE: Record<string, string> = {
  request: "bg-lotus-500/15 text-lotus-200",
  approve: "bg-emerald-500/15 text-emerald-300",
  reject: "bg-rose-500/15 text-rose-300",
  suspend: "bg-orange-500/15 text-orange-300",
  restore: "bg-emerald-500/15 text-emerald-300",
  remove: "bg-rose-500/15 text-rose-300",
  block: "bg-rose-500/15 text-rose-300",
  unblock: "bg-mist-500/15 text-mist-300",
  call: "bg-fuchsia-500/15 text-fuchsia-200",
};

export default function AdminPaidZonePage() {
  const { toast } = useToast();
  const { config, reload: reloadConfig } = useConfig();
  const [members, setMembers] = useState<PZAdminMember[]>([]);
  const [log, setLog] = useState<PZActivity[]>([]);
  const [calls, setCalls] = useState<{ active: PZCall[]; records: PZCall[]; stats: PZStats | null }>({ active: [], records: [], stats: null });
  const [loading, setLoading] = useState(true);
  const [editMember, setEditMember] = useState<PZAdminMember | null>(null);
  const [tab, setTab] = useState<"dashboard" | "pending" | "approved" | "calls" | "log">("dashboard");
  const [busy, setBusy] = useState("");

  // Search + sort for the call records and the activity log.
  const [callQ, setCallQ] = useState("");
  const [callSort, setCallSort] = useState("start");
  const [callDir, setCallDir] = useState<SortDir>("desc");
  const [logQ, setLogQ] = useState("");
  const [logSort, setLogSort] = useState("when");
  const [logDir, setLogDir] = useState<SortDir>("desc");
  const sortCalls = (col: string) => { if (col === callSort) setCallDir((d) => (d === "asc" ? "desc" : "asc")); else { setCallSort(col); setCallDir("desc"); } };
  const sortLog = (col: string) => { if (col === logSort) setLogDir((d) => (d === "asc" ? "desc" : "asc")); else { setLogSort(col); setLogDir("desc"); } };

  const shownCalls = useMemo(() => applyFilterSort(calls.records, {
    q: callQ, sort: callSort, dir: callDir,
    searchText: (c) => `${c.callerName} ${c.receiverName} ${c.callerId} ${c.receiverId} ${c.type} ${c.endReason ?? ""} ${new Date(c.startedAt).toLocaleDateString("en-SA")}`,
    sortKeys: {
      caller: (c) => c.callerName ?? "",
      type: (c) => c.type ?? "",
      start: (c) => new Date(c.startedAt).getTime() || 0,
      min: (c) => c.minutesBilled ?? 0,
      coins: (c) => c.coinsDeducted ?? 0,
      ended: (c) => c.endReason ?? "",
    },
  }), [calls.records, callQ, callSort, callDir]);

  const shownLog = useMemo(() => applyFilterSort(log, {
    q: logQ, sort: logSort, dir: logDir,
    searchText: (e) => `${e.type} ${e.actorName} ${e.actorId} ${e.targetName ?? ""} ${e.targetId ?? ""} ${e.detail ?? ""} ${new Date(e.at).toLocaleDateString("en-SA")}`,
    sortKeys: {
      when: (e) => new Date(e.at).getTime() || 0,
      action: (e) => e.type ?? "",
      by: (e) => e.actorName ?? "",
      details: (e) => e.detail ?? "",
    },
  }), [log, logQ, logSort, logDir]);

  // Settings — the FULL paidZone object (sent whole so per-minute fields aren't zeroed).
  const [pz, setPz] = useState({ enabled: true, joinCost: 500, audioPerMin: 10, videoPerMin: 20, callsEnabled: true, videoCallsEnabled: true, recordingEnabled: false, receiverRewardsEnabled: true, receiverSharePct: 70, agencyProfitPct: 0, monthlyCoins: 300, renewalDays: 30, graceDays: 3, autoRenew: true });
  const [savingCfg, setSavingCfg] = useState(false);
  useEffect(() => {
    const c = config.paidZone;
    if (c) setPz({ enabled: c.enabled ?? true, joinCost: c.joinCost ?? 500, audioPerMin: c.audioPerMin ?? 10, videoPerMin: c.videoPerMin ?? 20, callsEnabled: c.callsEnabled !== false, videoCallsEnabled: c.videoCallsEnabled !== false, recordingEnabled: c.recordingEnabled === true, receiverRewardsEnabled: c.receiverRewardsEnabled !== false, receiverSharePct: c.receiverSharePct ?? 70, agencyProfitPct: c.agencyProfitPct ?? 0, monthlyCoins: c.monthlyCoins ?? 300, renewalDays: c.renewalDays ?? 30, graceDays: c.graceDays ?? 3, autoRenew: c.autoRenew !== false });
  }, [config.paidZone]);

  // Withdrawal (cash-out) settings — fully admin-configurable.
  const [wd, setWd] = useState({ coinsPerUnit: 10, currency: "SAR", feePct: 0, minCoins: 1000, maxCoins: 100000, autoApprove: false });
  const [savingWd, setSavingWd] = useState(false);
  useEffect(() => {
    const w = config.withdraw;
    if (w) setWd({ coinsPerUnit: w.coinsPerUnit ?? 10, currency: w.currency ?? "SAR", feePct: w.feePct ?? 0, minCoins: w.minCoins ?? 1000, maxCoins: w.maxCoins ?? 100000, autoApprove: w.autoApprove === true });
  }, [config.withdraw]);
  const saveWithdraw = async (next: typeof wd) => {
    setWd(next); setSavingWd(true);
    const res = await saveConfig({ withdraw: next });
    setSavingWd(false);
    if (res.ok) { await reloadConfig(); toast("Withdrawal settings saved", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const reload = () => fetchAdminPaidZone().then((d) => { setMembers(d.members); setLog(d.log); setLoading(false); });
  const reloadCalls = () => fetchPaidZoneCalls().then(setCalls);
  useEffect(() => { reload(); reloadCalls(); const t = setInterval(reloadCalls, 6000); return () => clearInterval(t); }, []);

  const saveSettings = async (next: typeof pz) => {
    setPz(next);
    setSavingCfg(true);
    const res = await saveConfig({ paidZone: next });
    setSavingCfg(false);
    if (res.ok) { await reloadConfig(); toast("Paid Zone settings saved", "success"); }
    else toast(res.error ?? "Could not save settings", "error");
  };
  const forceEnd = async (c: PZCall) => { if (await adminForceEndCall(c.id)) { toast("Call disconnected", "success"); reloadCalls(); } else toast("Could not disconnect", "error"); };
  const stats = calls.stats;
  const clearLog = async () => { if (await clearPaidZoneLog()) { toast("Activity log cleared", "success"); reload(); } };

  const pendingCount = members.filter((m) => m.status === "pending").length;
  const shown = useMemo(() => {
    if (tab === "pending") return members.filter((m) => m.status === "pending");
    if (tab === "approved") return members.filter((m) => m.status === "approved" || m.status === "suspended");
    return members;
  }, [members, tab]);

  const act = async (m: PZAdminMember, action: "approve" | "reject" | "suspend" | "restore" | "remove", verb: string) => {
    setBusy(m.userId);
    const ok = await adminPaidZoneAction(m.userId, action);
    setBusy("");
    if (ok) { toast(`${m.fullName} ${verb}`, "success"); reload(); }
    else toast("Action failed", "error");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><Gem className="size-6 text-fuchsia-300" /> Paid Zone</h1>
          <p className="text-sm text-mist-400">Verify &amp; manage premium members. Approve requests, view documents, suspend or remove members.</p>
        </div>
      </div>

      {/* Settings — zone ON/OFF, fee, calling controls, per-minute rates, recording */}
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => saveSettings({ ...pz, enabled: !pz.enabled })} className={cn("inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition", pz.enabled ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300")}>
            <Power className="size-4" /> Paid Zone {pz.enabled ? "ON" : "OFF"}
          </button>
          <button onClick={() => saveSettings({ ...pz, callsEnabled: !pz.callsEnabled })} className={cn("inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition", pz.callsEnabled ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300")}>
            <Phone className="size-4" /> Audio calls {pz.callsEnabled ? "ON" : "OFF"}
          </button>
          <button onClick={() => saveSettings({ ...pz, videoCallsEnabled: !pz.videoCallsEnabled })} className={cn("inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition", pz.videoCallsEnabled ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300")}>
            <Video className="size-4" /> Video calls {pz.videoCallsEnabled ? "ON" : "OFF"}
          </button>
          <button onClick={() => saveSettings({ ...pz, recordingEnabled: !pz.recordingEnabled })} className={cn("inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition", pz.recordingEnabled ? "bg-rose-500/15 text-rose-300" : "bg-ink-800 text-mist-400")} title="Media capture is wired separately; this flags calls as recorded.">
            <Radio className="size-4" /> Recording {pz.recordingEnabled ? "ON" : "OFF"}
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <NumField label="Joining fee" icon={Coins} value={pz.joinCost} onChange={(v) => setPz({ ...pz, joinCost: v })} suffix="coins" />
          <NumField label="Audio call rate" icon={Phone} value={pz.audioPerMin} onChange={(v) => setPz({ ...pz, audioPerMin: v })} suffix="coins/min" />
          <NumField label="Video call rate" icon={Video} value={pz.videoPerMin} onChange={(v) => setPz({ ...pz, videoPerMin: v })} suffix="coins/min" />
          <Button size="sm" onClick={() => saveSettings(pz)} disabled={savingCfg}><Save className="size-4" /> {savingCfg ? "Saving…" : "Save rates"}</Button>
        </div>

        {/* Coin distribution: split each billed minute between the RECEIVER and the company. */}
        <div className="rounded-xl border border-white/8 bg-ink-900/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-sm font-bold text-mist-100"><Coins className="size-4 text-gold-300" /> Call coin distribution</p>
            <button onClick={() => saveSettings({ ...pz, receiverRewardsEnabled: !pz.receiverRewardsEnabled })} className={cn("inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition", pz.receiverRewardsEnabled ? "bg-emerald-500/15 text-emerald-300" : "bg-ink-800 text-mist-400")}>
              <Power className="size-3.5" /> Receiver rewards {pz.receiverRewardsEnabled ? "ON" : "OFF"}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-4">
            <NumField label="Receiver share" icon={Users} value={pz.receiverSharePct} onChange={(v) => setPz({ ...pz, receiverSharePct: Math.max(0, Math.min(100, v)) })} suffix="%" />
            <NumField label="Agency profit" icon={Landmark} value={pz.agencyProfitPct} onChange={(v) => setPz({ ...pz, agencyProfitPct: Math.max(0, Math.min(100, v)) })} suffix="%" />
            {(() => {
              const trustPct = config.lotus?.trustEnabled !== false ? Math.max(0, Math.min(100, config.lotus?.trustSharePct ?? 5)) : 0;
              const company = Math.max(0, 100 - Math.max(0, Math.min(100, pz.receiverSharePct)) - Math.max(0, Math.min(100, pz.agencyProfitPct)) - trustPct);
              return (
                <>
                  <div className="text-sm">
                    <p className="mb-1 text-xs font-semibold text-mist-400">Trust profit</p>
                    <div className="flex h-11 items-center rounded-xl border border-line bg-ink-800 px-3.5 font-bold text-emerald-300" title="Set in Admin → Trust Management">{trustPct}%</div>
                  </div>
                  <div className="text-sm">
                    <p className="mb-1 text-xs font-semibold text-mist-400">Company profit</p>
                    <div className="flex h-11 items-center rounded-xl border border-line bg-ink-800 px-3.5 font-bold text-gold-300">{company}%</div>
                  </div>
                </>
              );
            })()}
            <Button size="sm" onClick={() => saveSettings(pz)} disabled={savingCfg}><Save className="size-4" /> {savingCfg ? "Saving…" : "Save split"}</Button>
          </div>
          <p className="mt-2 text-[11px] text-mist-500">
            {pz.receiverRewardsEnabled
              ? `Each billed minute: ${pz.receiverSharePct}% to the person who receives the call${pz.agencyProfitPct > 0 ? `, ${pz.agencyProfitPct}% to the caller's OWN agency (only if they're in one — never split across agencies)` : ""}, ${Math.max(0, 100 - pz.receiverSharePct - pz.agencyProfitPct)}% company profit.`
              : `Receiver rewards are OFF — ${pz.agencyProfitPct > 0 ? `${pz.agencyProfitPct}% to the caller's own agency (if any), the rest` : "100%"} is company profit.`}
          </p>
          <p className="mt-1 text-[11px] text-mist-500">Agency profit applies to <span className="font-semibold text-mist-300">all agencies</span> using this single rate. When a member of an agency spends coins on a call, only <span className="font-semibold text-mist-300">their</span> agency is credited — shown in Admin → Agent Profit.</p>
          <p className="mt-1 text-[11px] text-mist-500"><span className="font-semibold text-emerald-300">Trust profit</span> is taken from the company&apos;s share on every billed call and credited to the Trust Wallet — its % is set in <span className="font-semibold text-mist-300">Admin → Trust Management</span>, and each call&apos;s trust credit appears there.</p>
        </div>

        {/* Monthly membership renewal — coins, period, grace, auto-renew. */}
        <div className="rounded-xl border border-white/8 bg-ink-900/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-sm font-bold text-mist-100"><Coins className="size-4 text-fuchsia-300" /> Monthly membership renewal</p>
            <button onClick={() => saveSettings({ ...pz, autoRenew: !pz.autoRenew })} className={cn("inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition", pz.autoRenew ? "bg-emerald-500/15 text-emerald-300" : "bg-ink-800 text-mist-400")}>
              <Power className="size-3.5" /> Auto-renew {pz.autoRenew ? "ON" : "OFF"}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-4">
            <NumField label="Monthly fee" icon={Coins} value={pz.monthlyCoins} onChange={(v) => setPz({ ...pz, monthlyCoins: v })} suffix="coins" />
            <NumField label="Renewal period" icon={Clock} value={pz.renewalDays} onChange={(v) => setPz({ ...pz, renewalDays: Math.max(1, v) })} suffix="days" />
            <NumField label="Grace period" icon={Clock} value={pz.graceDays} onChange={(v) => setPz({ ...pz, graceDays: Math.max(0, v) })} suffix="days" />
            <Button size="sm" onClick={() => saveSettings(pz)} disabled={savingCfg}><Save className="size-4" /> {savingCfg ? "Saving…" : "Save renewal"}</Button>
          </div>
          <p className="mt-2 text-[11px] text-mist-500">
            {pz.monthlyCoins > 0
              ? `Members are charged ${pz.monthlyCoins} coins every ${pz.renewalDays} days${pz.autoRenew ? " (auto-charged when they have enough coins)" : " (they must renew manually — auto-renew is OFF)"}. After the due date + ${pz.graceDays}-day grace, an unpaid membership becomes Inactive until renewed.`
              : "Monthly fee is 0 — memberships never expire (no renewal charge)."}
          </p>
        </div>
      </Card>

      {/* Withdrawal (cash-out) settings — rate, fee, limits, approval mode. */}
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 font-display text-lg font-bold text-mist-100"><Coins className="size-5 text-emerald-300" /> Coin withdrawal (cash-out)</p>
            <p className="text-sm text-mist-400">How wallet coins convert to real money when a user withdraws. Requests are reviewed in <a href={withBase("/admin/transactions")} className="text-lotus-300 underline">Financial → Withdrawals</a>.</p>
          </div>
          <button onClick={() => saveWithdraw({ ...wd, autoApprove: !wd.autoApprove })} className={cn("inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition", wd.autoApprove ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300")}>
            <Power className="size-3.5" /> {wd.autoApprove ? "Auto-approve" : "Manual approval"}
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <NumField label="Conversion rate" icon={Coins} value={wd.coinsPerUnit} onChange={(v) => setWd({ ...wd, coinsPerUnit: Math.max(1, v) })} suffix={`coins = 1 ${wd.currency}`} />
          <NumField label="Withdrawal fee" icon={Coins} value={wd.feePct} onChange={(v) => setWd({ ...wd, feePct: Math.max(0, Math.min(100, v)) })} suffix="%" />
          <NumField label="Minimum" icon={Coins} value={wd.minCoins} onChange={(v) => setWd({ ...wd, minCoins: Math.max(0, v) })} suffix="coins" />
          <NumField label="Maximum" icon={Coins} value={wd.maxCoins} onChange={(v) => setWd({ ...wd, maxCoins: Math.max(0, v) })} suffix="coins (0 = none)" />
          <label className="text-sm">
            <p className="mb-1 text-xs font-semibold text-mist-400">Currency</p>
            <input value={wd.currency} onChange={(e) => setWd({ ...wd, currency: e.target.value.slice(0, 8) })} className="h-11 w-24 rounded-xl border border-line bg-ink-900 px-3.5 text-sm text-mist-100 outline-none focus:border-lotus-400" />
          </label>
          <Button size="sm" onClick={() => saveWithdraw(wd)} disabled={savingWd}><Save className="size-4" /> {savingWd ? "Saving…" : "Save withdrawal"}</Button>
        </div>
        <p className="text-[11px] text-mist-500">
          Example: withdrawing {wd.coinsPerUnit * 1000} coins = {wd.currency} 1,000{wd.feePct > 0 ? ` − ${wd.feePct}% fee = ${wd.currency} ${(1000 * (1 - wd.feePct / 100)).toLocaleString("en-SA", { maximumFractionDigits: 2 })} paid to the user` : " paid to the user"}. {wd.autoApprove ? "Requests are auto-approved." : "Requests need admin approval."}
        </p>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        {([["dashboard", "📊 Dashboard"], ["pending", `Requests (${pendingCount})`], ["approved", "Members"], ["calls", `Calls${stats?.activeCalls ? ` (${stats.activeCalls} live)` : ""}`], ["log", "Activity log"]] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className={cn("rounded-full px-4 py-1.5 text-sm font-semibold transition", tab === t ? "bg-lotus-600 text-white" : "border border-line bg-ink-800 text-mist-400 hover:text-mist-100")}>{label}</button>
        ))}
        <a href={withBase("/admin/moderation")} className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-line bg-ink-800 px-3 py-1.5 text-xs font-semibold text-mist-300 hover:text-mist-100"><Flag className="size-3.5 text-amber-300" /> Reports &amp; moderation</a>
      </div>

      {tab === "dashboard" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={Users} tone="text-lotus-300" label="Approved members" value={stats?.approved ?? 0} sub={`${stats?.members ?? 0} total`} />
          <Stat icon={Wifi} tone="text-emerald-300" label="Online now" value={stats?.online ?? 0} />
          <Stat icon={Radio} tone="text-fuchsia-300" label="Active calls" value={stats?.activeCalls ?? 0} />
          <Stat icon={Clock} tone="text-sky-300" label="Total call minutes" value={stats?.totalMinutes ?? 0} />
          <Stat icon={Coins} tone="text-gold-300" label="Total coins billed" value={stats?.totalCoins ?? 0} />
          <Stat icon={BarChart3} tone="text-emerald-300" label="Company profit" value={stats?.companyEarnings ?? 0} sub="coins kept" />
          <Stat icon={Users} tone="text-sky-300" label="Receiver payouts" value={stats?.receiverPayouts ?? 0} sub="coins to receivers" />
          <Stat icon={BarChart3} tone="text-emerald-300" label="Trust profit" value={stats?.trustProfit ?? 0} sub="credited to Trust Wallet from calls" />
          <Stat icon={Phone} tone="text-emerald-300" label="Calls today" value={stats?.today.calls ?? 0} sub={`${stats?.today.minutes ?? 0} min · ${stats?.today.coins ?? 0} coins`} />
          <Stat icon={Radio} tone="text-rose-300" label="Recorded calls" value={stats?.recordedCalls ?? 0} />
          <Stat icon={Clock} tone="text-amber-300" label="Pending requests" value={pendingCount} />
        </div>
      )}

      {tab === "calls" && (
        <div className="space-y-5">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-mist-100"><Radio className="size-4 text-fuchsia-300" /> Active calls ({calls.active.length}) <span className="text-xs font-normal text-mist-500">· live, refreshes automatically</span></p>
            {calls.active.length === 0 ? (
              <Card className="p-6 text-center text-sm text-mist-500">No calls in progress.</Card>
            ) : (
              <div className="space-y-2">
                {calls.active.map((c) => (
                  <Card key={c.id} className="flex flex-wrap items-center gap-3 p-3">
                    <span className={cn("grid size-9 place-items-center rounded-lg", c.type === "video" ? "bg-lotus-500/15 text-lotus-300" : "bg-emerald-500/15 text-emerald-300")}>{c.type === "video" ? <Video className="size-4" /> : <Phone className="size-4" />}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-mist-100">{c.callerName} <span className="text-mist-500">→</span> {c.receiverName}</p>
                      <p className="text-xs text-mist-500">started {new Date(c.startedAt).toLocaleTimeString("en-SA", { hour: "2-digit", minute: "2-digit" })} · {c.minutesBilled} min · 🪙 {c.coinsDeducted} · {c.perMin}/min{c.recorded ? " · ⏺ rec" : ""}</p>
                    </div>
                    <button onClick={() => forceEnd(c)} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/25"><PhoneOff className="size-3.5" /> Disconnect</button>
                  </Card>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-mist-100"><FileText className="size-4 text-lotus-300" /> Call records ({shownCalls.length}{shownCalls.length !== calls.records.length ? ` of ${calls.records.length}` : ""})</p>
              <TableSearch value={callQ} onChange={setCallQ} placeholder="Search caller, receiver, ID…" className="w-64" />
            </div>
            <Card className="overflow-hidden p-0">
              <div className="max-h-[28rem] overflow-x-auto overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-ink-850 text-left text-xs uppercase tracking-wide text-mist-500">
                    <tr>
                      <SortTh col="caller" sort={callSort} dir={callDir} onSort={sortCalls} className="px-3 py-2.5">Caller → Receiver</SortTh>
                      <SortTh col="type" sort={callSort} dir={callDir} onSort={sortCalls} className="px-3 py-2.5">Type</SortTh>
                      <SortTh col="start" sort={callSort} dir={callDir} onSort={sortCalls} className="px-3 py-2.5">Start</SortTh>
                      <SortTh col="min" sort={callSort} dir={callDir} onSort={sortCalls} className="px-3 py-2.5">Min</SortTh>
                      <SortTh col="coins" sort={callSort} dir={callDir} onSort={sortCalls} className="px-3 py-2.5">Coins</SortTh>
                      <SortTh col="ended" sort={callSort} dir={callDir} onSort={sortCalls} className="px-3 py-2.5">Ended</SortTh>
                    </tr>
                  </thead>
                  <tbody>
                    {shownCalls.map((c) => (
                      <tr key={c.id} className="border-b border-white/5 last:border-0">
                        <td className="px-3 py-2 text-mist-200">
                          <UserLink name={c.callerName} userId={c.callerId} showId={false} />
                          <span className="mx-1 text-mist-500">→</span>
                          <UserLink name={c.receiverName} userId={c.receiverId} showId={false} />
                        </td>
                        <td className="px-3 py-2"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", c.type === "video" ? "bg-lotus-500/15 text-lotus-200" : "bg-emerald-500/15 text-emerald-200")}>{c.type}{c.recorded ? " ⏺" : ""}</span></td>
                        <td className="px-3 py-2 text-xs text-mist-400">{new Date(c.startedAt).toLocaleString("en-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                        <td className="px-3 py-2 text-mist-300">{c.minutesBilled}</td>
                        <td className="px-3 py-2 text-gold-300">{c.coinsDeducted}</td>
                        <td className="px-3 py-2 text-[11px] text-mist-500 capitalize">{c.endReason ?? ""}</td>
                      </tr>
                    ))}
                    {shownCalls.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-mist-500">{calls.records.length === 0 ? "No completed calls yet." : "No calls match your search."}</td></tr>}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}

      {(tab === "log" || tab === "pending" || tab === "approved") && (tab === "log" ? (
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-mist-200"><ScrollText className="size-4 text-lotus-300" /> All Paid Zone activity ({shownLog.length}{shownLog.length !== log.length ? ` of ${log.length}` : ""})</p>
            <div className="flex items-center gap-2">
              <TableSearch value={logQ} onChange={setLogQ} placeholder="Search action, member, ID…" className="w-64" />
              {log.length > 0 && <button onClick={clearLog} className="inline-flex items-center gap-1.5 rounded-lg bg-ink-800 px-2.5 py-1.5 text-xs font-semibold text-mist-400 hover:text-rose-300"><Trash2 className="size-3.5" /> Clear log</button>}
            </div>
          </div>
          <Card className="overflow-hidden p-0">
            <div className="max-h-[34rem] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-ink-850 text-left text-xs uppercase tracking-wide text-mist-500">
                  <tr>
                    <SortTh col="when" sort={logSort} dir={logDir} onSort={sortLog} className="px-4 py-2.5">When</SortTh>
                    <SortTh col="action" sort={logSort} dir={logDir} onSort={sortLog} className="px-4 py-2.5">Action</SortTh>
                    <SortTh col="by" sort={logSort} dir={logDir} onSort={sortLog} className="px-4 py-2.5">By</SortTh>
                    <SortTh col="details" sort={logSort} dir={logDir} onSort={sortLog} className="px-4 py-2.5">Details</SortTh>
                  </tr>
                </thead>
                <tbody>
                  {shownLog.map((e) => (
                    <tr key={e.id} className="border-b border-white/5 last:border-0">
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-mist-400">{new Date(e.at).toLocaleString("en-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="px-4 py-2.5"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", LOG_TONE[e.type] ?? "bg-white/[0.06] text-mist-300")}>{e.type}</span></td>
                      <td className="px-4 py-2.5 text-xs text-mist-300"><UserLink name={e.actorName} userId={e.actorId} showId={false} /></td>
                      <td className="px-4 py-2.5 text-xs text-mist-300">
                        {e.detail}
                        {e.targetName && e.type !== "call" ? <> · <UserLink name={e.targetName} userId={e.targetId} showId={false} /></> : null}
                      </td>
                    </tr>
                  ))}
                  {!loading && shownLog.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-mist-500">{log.length === 0 ? "No activity yet." : "No activity matches your search."}</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : loading ? (
        <p className="py-10 text-center text-sm text-mist-400">Loading…</p>
      ) : shown.length === 0 ? (
        <Card className="p-10 text-center text-sm text-mist-500">{tab === "pending" ? "No requests waiting for review. 🎉" : "No members yet."}</Card>
      ) : (
        <div className="space-y-3">
          {shown.map((m) => (
            <Card key={m.userId} className="p-4">
              <div className="flex flex-wrap items-start gap-3">
                <Avatar name={m.fullName} src={m.avatar} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display font-bold text-mist-100">{(m.fzName && m.fzName.trim()) || m.accountName}</span>
                    {m.fzId && <span className="rounded-full bg-purple-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-purple-300">{m.fzId}</span>}
                    {m.fzVisible === false && <span className="rounded-full bg-mist-600/30 px-2 py-0.5 text-[10px] font-semibold text-mist-400">Profile hidden</span>}
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", STATUS_PILL[m.status])}>{m.status}</span>
                    {m.status === "approved" && (
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", m.membershipActive === false ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/15 text-emerald-300")}>
                        {m.membershipActive === false ? "Inactive" : "Active"}{m.renewAt ? ` · renews ${new Date(m.renewAt).toLocaleDateString("en-SA", { day: "numeric", month: "short" })}` : ""}
                      </span>
                    )}
                    <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-200">{CALL_INTEREST_LABEL[m.callInterest as CallInterest]}</span>
                  </div>
                  <div className="mt-1 grid gap-x-4 gap-y-0.5 text-xs text-mist-400 sm:grid-cols-2">
                    <span>Real name: <span className="text-mist-200">{m.realName}</span></span>
                    <span>Account: <span className="text-mist-200">{m.fullName} @{m.username}</span></span>
                    <span>Gender: <span className="text-mist-200 capitalize">{m.gender}</span></span>
                    <span>Paid: <span className="inline-flex items-center gap-1 text-gold-300"><Coins className="size-3" /> {m.coinsPaid}</span></span>
                  </div>
                  {m.docUrl ? (
                    <a href={withBase(m.docUrl)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-ink-800 px-2.5 py-1.5 text-xs font-semibold text-lotus-300 hover:text-lotus-200">
                      <FileText className="size-3.5" /> View verification: {m.docName || "document"}
                    </a>
                  ) : (
                    <p className="mt-2 text-xs text-mist-500">No document uploaded.</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  {/* Edit the member's SEPARATE Friend Zone profile (names, picture,
                      bio, visibility) — never touches their login account. */}
                  <button disabled={busy === m.userId} onClick={() => setEditMember(m)} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-lotus-500/15 px-3 py-1.5 text-xs font-semibold text-lotus-300 hover:bg-lotus-500/25 disabled:opacity-50"><Pencil className="size-3.5" /> Edit profile</button>
                  {m.status === "pending" && (
                    <>
                      <button disabled={busy === m.userId} onClick={() => act(m, "approve", "approved")} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"><Check className="size-3.5" /> Approve</button>
                      <button disabled={busy === m.userId} onClick={() => act(m, "reject", "rejected (refunded)")} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/25 disabled:opacity-50"><X className="size-3.5" /> Reject</button>
                    </>
                  )}
                  {m.status === "approved" && (
                    <button disabled={busy === m.userId} onClick={() => act(m, "suspend", "suspended")} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-orange-500/15 px-3 py-1.5 text-xs font-semibold text-orange-300 hover:bg-orange-500/25 disabled:opacity-50"><Ban className="size-3.5" /> Suspend</button>
                  )}
                  {m.status === "suspended" && (
                    <button disabled={busy === m.userId} onClick={() => act(m, "restore", "restored")} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"><RotateCcw className="size-3.5" /> Restore</button>
                  )}
                  <button disabled={busy === m.userId} onClick={() => act(m, "remove", "removed")} title="Delete this Paid Zone record" className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-ink-800 px-3 py-1.5 text-xs font-semibold text-mist-300 hover:text-rose-300 disabled:opacity-50"><Trash2 className="size-3.5" /> {m.status === "pending" ? "Delete" : "Remove"}</button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ))}

      {editMember && (
        <EditProfileModal
          member={editMember}
          onClose={() => setEditMember(null)}
          onSaved={() => { setEditMember(null); reload(); toast("Friend Zone profile updated.", "success"); }}
          toast={toast}
        />
      )}
    </div>
  );
}

/** Admin editor for a member's SEPARATE Friend Zone profile. */
function EditProfileModal({ member, onClose, onSaved, toast }: {
  member: PZAdminMember;
  onClose: () => void;
  onSaved: () => void;
  toast: (m: string, t?: "success" | "error" | "info") => void;
}) {
  const [accountName, setAccountName] = useState(member.accountName ?? "");
  const [fzName, setFzName] = useState(member.fzName ?? "");
  const [fzUsername, setFzUsername] = useState(member.fzUsername ?? "");
  const [fzBio, setFzBio] = useState(member.fzBio ?? "");
  const [fzAvatar, setFzAvatar] = useState(member.fzAvatar ?? "");
  const [fzVisible, setFzVisible] = useState(member.fzVisible !== false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickAvatar = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    const res = await uploadFile(file, "chatimage");
    setUploading(false);
    if (res.ok && res.file?.url) setFzAvatar(res.file.url);
    else toast(res.error ?? "Could not upload", "error");
  };

  const save = async () => {
    setSaving(true);
    const res = await adminEditPaidZoneProfile(member.userId, { accountName, fzName, fzUsername, fzBio, fzAvatar, fzVisible });
    setSaving(false);
    if (res.ok) onSaved();
    else toast(res.error ?? "Could not save", "error");
  };

  const F = "mt-1 w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400";
  return (
    <div className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-md rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-mist-100">Edit Friend Zone profile</h2>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>
        <p className="mb-4 text-xs text-mist-500">
          {member.fullName} @{member.username}{member.fzId ? ` · ${member.fzId}` : ""}. This is the member&apos;s
          separate Friend Zone identity — editing it does <b>not</b> change their login account.
        </p>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Avatar name={fzName || accountName} src={fzAvatar ? withBase(fzAvatar) : undefined} size="lg" />
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void pickAvatar(f); }} />
              <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}><Upload className="size-4" /> {uploading ? "Uploading…" : "Picture"}</Button>
              {fzAvatar && <Button size="sm" variant="ghost" onClick={() => setFzAvatar("")}>Remove</Button>}
            </div>
          </div>
          <label className="block"><span className="text-xs font-semibold text-mist-400">Public account name (verification handle)</span><input value={accountName} onChange={(e) => setAccountName(e.target.value)} maxLength={40} className={F} /></label>
          <label className="block"><span className="text-xs font-semibold text-mist-400">Friend Zone display name</span><input value={fzName} onChange={(e) => setFzName(e.target.value)} maxLength={40} className={F} /></label>
          <label className="block"><span className="text-xs font-semibold text-mist-400">Friend Zone username</span><input value={fzUsername} onChange={(e) => setFzUsername(e.target.value)} maxLength={24} className={F} /></label>
          <label className="block"><span className="text-xs font-semibold text-mist-400">Friend Zone bio</span><textarea value={fzBio} onChange={(e) => setFzBio(e.target.value)} maxLength={300} rows={3} className={cn(F, "resize-none")} /></label>
          <button onClick={() => setFzVisible((v) => !v)} className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition", fzVisible ? "bg-emerald-500/15 text-emerald-300" : "bg-mist-600/25 text-mist-300")}>
            {fzVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />} Profile {fzVisible ? "visible to members" : "hidden"}
          </button>
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={save} disabled={saving}><Check className="size-4" /> {saving ? "Saving…" : "Save profile"}</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

function NumField({ label, icon: Icon, value, onChange, suffix }: { label: string; icon: typeof Coins; value: number; onChange: (v: number) => void; suffix: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-mist-300">{label}</label>
      <div className="flex items-center gap-1 rounded-lg border border-line bg-ink-800 px-2.5">
        <Icon className="size-4 text-gold-300" />
        <input type="number" min={0} value={value} onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))} className="h-9 w-20 bg-transparent text-sm text-mist-100 outline-none" />
        <span className="whitespace-nowrap text-xs text-mist-500">{suffix}</span>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, tone, label, value, sub }: { icon: typeof Coins; tone: string; label: string; value: number; sub?: string }) {
  return (
    <Card className="p-5">
      <Icon className={cn("size-6", tone)} />
      <div className="mt-2 font-display text-2xl font-extrabold text-mist-100">{value.toLocaleString("en-SA")}</div>
      <div className="text-sm text-mist-400">{label}</div>
      {sub && <div className="text-xs text-mist-500">{sub}</div>}
    </Card>
  );
}
