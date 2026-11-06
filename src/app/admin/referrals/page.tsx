"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { cn } from "@/lib/cn";
import { fetchReferrals, decideReferral, type Referral, type ReferralStats } from "@/lib/referrals";
import { Users, Coins, Clock, Check, X, Ban, ShieldAlert, Power, Save, RefreshCw, Crown, Download } from "lucide-react";

type Tab = "all" | "pending" | "approved" | "rejected" | "blocked";

const STATUS_STYLE: Record<Referral["status"], string> = {
  pending: "bg-amber-500/15 text-amber-300",
  approved: "bg-emerald-500/15 text-emerald-300",
  rejected: "bg-rose-500/15 text-rose-300",
  blocked: "bg-rose-600/20 text-rose-300",
};
const FLAG_LABEL: Record<string, string> = {
  self_ip: "Self (same device)",
  duplicate_ip: "Duplicate device",
  already_referred: "Already referred",
};

export default function AdminReferralsPage() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [tab, setTab] = useState<Tab>("pending");
  const [busy, setBusy] = useState("");

  // Settings (referral config).
  const [enabled, setEnabled] = useState(true);
  const [reward, setReward] = useState(100);
  const [agencyReward, setAgencyReward] = useState(0);
  const [requireApproval, setRequireApproval] = useState(false);
  const [autoBlock, setAutoBlock] = useState(true);
  const [savingCfg, setSavingCfg] = useState(false);

  useEffect(() => {
    if (loading) return;
    setEnabled(config.referral?.enabled !== false);
    setReward(config.referral?.reward ?? 100);
    setAgencyReward(config.referral?.agencyReward ?? 0);
    setRequireApproval(config.referral?.requireApproval === true);
    setAutoBlock(config.referral?.autoBlockDuplicates !== false);
  }, [loading, config]);

  const load = useCallback(async () => {
    const r = await fetchReferrals();
    setReferrals(r.referrals);
    setStats(r.stats);
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  const saveSettings = async () => {
    setSavingCfg(true);
    const res = await saveConfig({ referral: { enabled, reward: Math.max(0, reward), agencyReward: Math.max(0, agencyReward), requireApproval, autoBlockDuplicates: autoBlock } });
    setSavingCfg(false);
    if (res.ok) { await reload(); toast("Referral settings saved — live now", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const decide = async (r: Referral, action: "approve" | "reject" | "block") => {
    setBusy(r.id);
    const okRes = await decideReferral(r.id, action);
    setBusy("");
    if (okRes) { toast(action === "approve" ? "Approved — reward paid" : action === "block" ? "Blocked" : "Rejected", "success"); load(); }
    else toast("Could not update", "error");
  };

  const shown = useMemo(() => referrals.filter((r) => tab === "all" || r.status === tab), [referrals, tab]);

  const exportCsv = () => {
    const head = ["Referrer", "Referred", "Code", "Reward", "Status", "Flags", "Date", "Note"];
    const rows = referrals.map((r) => [r.referrerName, r.referredName, r.code, r.reward, r.status, (r.flags || []).join("|"), r.createdAt, r.note ?? ""].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([[head.join(","), ...rows].join("\n")], { type: "text/csv" }));
    a.download = "referrals.csv";
    a.click();
  };

  const TABS: [Tab, string][] = [["pending", `Pending (${stats?.pending ?? 0})`], ["approved", "Approved"], ["rejected", "Rejected"], ["blocked", "Blocked"], ["all", "All"]];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-mist-100">Referral System</h1>
          <p className="text-sm text-mist-400">Control the Refer-a-friend program: rewards, approvals, codes, reports &amp; fraud protection.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-3 py-2 text-sm font-semibold text-mist-200 hover:text-mist-100"><RefreshCw className="size-4" /> Refresh</button>
          <button onClick={exportCsv} disabled={!referrals.length} className="inline-flex items-center gap-1.5 rounded-lg bg-lotus-600 px-3 py-2 text-sm font-semibold text-white hover:bg-lotus-500 disabled:opacity-50"><Download className="size-4" /> CSV</button>
        </div>
      </div>

      {/* Settings */}
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => setEnabled((v) => !v)} className={cn("inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition", enabled ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300")}>
            <Power className="size-4" /> Referral system {enabled ? "ON" : "OFF"}
          </button>
          <button onClick={() => setRequireApproval((v) => !v)} className={cn("inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition", requireApproval ? "bg-amber-500/15 text-amber-300" : "bg-ink-800 text-mist-400")} title="When ON, every referral reward waits for your approval before it's paid.">
            <Check className="size-4" /> Manual approval {requireApproval ? "ON" : "OFF"}
          </button>
          <button onClick={() => setAutoBlock((v) => !v)} className={cn("inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition", autoBlock ? "bg-emerald-500/15 text-emerald-300" : "bg-ink-800 text-mist-400")} title="Auto-flag/block self- or same-device (duplicate) referrals.">
            <ShieldAlert className="size-4" /> Block duplicates {autoBlock ? "ON" : "OFF"}
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="mb-1 flex items-center gap-1.5 font-semibold text-mist-200"><Coins className="size-4 text-gold-300" /> Reward per referral</span>
            <div className="flex items-center gap-2">
              <input type="number" min={0} value={reward} onChange={(e) => setReward(Number(e.target.value))} className="w-32 rounded-xl border border-line bg-ink-800 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400" />
              <span className="text-xs text-mist-500">coins</span>
            </div>
          </label>
          <label className="text-sm">
            <span className="mb-1 flex items-center gap-1.5 font-semibold text-mist-200"><Coins className="size-4 text-emerald-300" /> Agency referral commission</span>
            <div className="flex items-center gap-2">
              <input type="number" min={0} value={agencyReward} onChange={(e) => setAgencyReward(Number(e.target.value))} className="w-32 rounded-xl border border-line bg-ink-800 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400" />
              <span className="text-xs text-mist-500">coins</span>
            </div>
          </label>
          <Button size="sm" onClick={saveSettings} disabled={savingCfg}><Save className="size-4" /> {savingCfg ? "Saving…" : "Save settings"}</Button>
        </div>
        <p className="text-xs text-mist-500">A referral pays out when the invited friend&apos;s account becomes active{requireApproval ? " AND you approve it" : ""}. The referrer isn&apos;t charged; the friend isn&apos;t either. <b className="text-mist-300">Agency referral commission</b> is an extra reward paid to an <b className="text-mist-300">agency</b> (its owner/manager) when it brings a user to the app — 0 turns it off. It appears in <b className="text-mist-300">Admin → Agent Profit</b>.</p>
      </Card>

      {/* Report stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Mini icon={Users} tone="text-lotus-300" label="Total referrals" value={stats?.total ?? 0} />
        <Mini icon={Clock} tone="text-amber-300" label="Pending" value={stats?.pending ?? 0} />
        <Mini icon={Check} tone="text-emerald-300" label="Approved" value={stats?.approved ?? 0} />
        <Mini icon={Ban} tone="text-rose-300" label="Rejected / Blocked" value={(stats?.rejected ?? 0) + (stats?.blocked ?? 0)} />
        <Mini icon={Coins} tone="text-gold-300" label="Coins paid" value={stats?.coinsPaid ?? 0} />
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className={cn("rounded-full px-4 py-1.5 text-sm font-semibold capitalize transition", tab === t ? "bg-lotus-600 text-white" : "border border-line bg-ink-800 text-mist-400 hover:text-mist-100")}>{label}</button>
        ))}
      </div>

      {/* Referral table */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-mist-500">
                <th className="px-4 py-3 font-semibold">Referrer</th>
                <th className="px-4 py-3 font-semibold">Invited friend</th>
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Reward</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-b border-white/5 align-top last:border-0">
                  <td className="px-4 py-3 font-semibold text-mist-100">{r.referrerName}</td>
                  <td className="px-4 py-3">
                    <div className="text-mist-200">{r.referredName}</div>
                    {(r.flags?.length ?? 0) > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {r.flags.map((f) => <span key={f} className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300"><ShieldAlert className="size-3" /> {FLAG_LABEL[f] ?? f}</span>)}
                      </div>
                    )}
                    {r.note && <div className="mt-0.5 text-[11px] text-mist-500">{r.note}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-mist-300">{r.code}</td>
                  <td className="px-4 py-3 text-gold-300"><span className="inline-flex items-center gap-1"><Coins className="size-3.5" /> {r.reward}</span></td>
                  <td className="px-4 py-3"><span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize", STATUS_STYLE[r.status])}>{r.status}</span></td>
                  <td className="px-4 py-3 text-xs text-mist-400">{new Date(r.createdAt).toLocaleDateString("en-SA", { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      {r.status !== "approved" && (
                        <button onClick={() => decide(r, "approve")} disabled={busy === r.id} title="Approve & pay reward" className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"><Check className="size-3.5" /> Approve</button>
                      )}
                      {r.status !== "rejected" && r.status !== "blocked" && (
                        <button onClick={() => decide(r, "reject")} disabled={busy === r.id} title="Reject (no reward)" className="inline-flex items-center gap-1 rounded-lg bg-ink-800 px-2.5 py-1.5 text-xs font-semibold text-mist-300 hover:text-rose-300 disabled:opacity-50"><X className="size-3.5" /> Reject</button>
                      )}
                      {r.status !== "blocked" && (
                        <button onClick={() => decide(r, "block")} disabled={busy === r.id} title="Block as fake" className="inline-flex items-center gap-1 rounded-lg bg-ink-800 px-2.5 py-1.5 text-xs font-semibold text-mist-300 hover:text-rose-300 disabled:opacity-50"><Ban className="size-3.5" /> Block</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-mist-500">No referrals in this view yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Top referrers */}
      {stats && stats.topReferrers.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-mist-100"><Crown className="size-4 text-gold-300" /> Top referrers</h2>
          <div className="space-y-1.5">
            {stats.topReferrers.map((t, i) => (
              <div key={t.name} className="flex items-center justify-between rounded-lg bg-ink-800/50 px-3 py-2 text-sm">
                <span className="text-mist-200">{i + 1}. {t.name}</span>
                <span className="font-semibold text-emerald-300">{t.count} joined</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Mini({ icon: Icon, tone, label, value }: { icon: typeof Clock; tone: string; label: string; value: number }) {
  return (
    <Card className="p-4">
      <Icon className={cn("size-5", tone)} />
      <p className="mt-2 font-display text-2xl font-extrabold text-mist-100">{value.toLocaleString("en-SA")}</p>
      <p className="text-xs text-mist-500">{label}</p>
    </Card>
  );
}
