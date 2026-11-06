"use client";

import { useCallback, useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import {
  UserX, Check, RotateCcw, Timer, BellRing, Moon, ShieldCheck, Coins,
  LogOut, MonitorSmartphone, AlertTriangle, TriangleAlert,
} from "lucide-react";

type Inact = {
  enabled: boolean; timeoutMinutes: number; warningSeconds: number; backgroundMonitor: boolean;
  exemptAdmins: boolean; exemptRoles: string[]; singleSession: boolean;
  rewardRequiresActivity: boolean; rewardGraceMinutes: number; roomTimeoutSeconds: number;
};

type Report = {
  today: { autoLogouts: number; sessionsEnded: number; idleMinutes: number; coinsSaved: number };
  lifetime: { autoLogouts: number; idleMinutes: number; coinsSaved: number };
  logs: { id: string; userId: string; userName: string; publicId?: string; kind: string; at: string; idleMinutes?: number; reason: string }[];
  suspicious: { id: string; publicId?: string; name: string; username?: string; idleMinutes: number; activeMinutes: number; idlePct: number; rewards: number; bonus: number }[];
};

const DEFAULTS: Inact = {
  enabled: false, timeoutMinutes: 15, warningSeconds: 30, backgroundMonitor: false,
  exemptAdmins: true, exemptRoles: [], singleSession: false,
  rewardRequiresActivity: true, rewardGraceMinutes: 5, roomTimeoutSeconds: 60,
};

const TIMEOUTS = [3, 5, 10, 15];
const EXEMPTABLE = [
  { v: "agency", label: "Agency owners" },
  { v: "business", label: "Business accounts" },
  { v: "moderator", label: "Agency managers" },
  { v: "support", label: "Support staff" },
];

export default function AdminInactivityPage() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();
  const [a, setA] = useState<Inact>(DEFAULTS);
  const [custom, setCustom] = useState(false);
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    if (loading) return;
    const g = config.inactivity ?? {};
    const mins = g.timeoutMinutes ?? 15;
    setA({
      enabled: g.enabled === true,
      timeoutMinutes: mins,
      warningSeconds: g.warningSeconds ?? 30,
      backgroundMonitor: g.backgroundMonitor === true,
      exemptAdmins: g.exemptAdmins !== false,
      exemptRoles: g.exemptRoles ?? [],
      singleSession: g.singleSession === true,
      rewardRequiresActivity: g.rewardRequiresActivity !== false,
      rewardGraceMinutes: g.rewardGraceMinutes ?? 5,
      roomTimeoutSeconds: g.roomTimeoutSeconds ?? 60,
    });
    setCustom(!TIMEOUTS.includes(mins));
  }, [loading, config]);

  const loadReport = useCallback(async () => {
    try {
      const r = await fetch(withBase("/api/admin/inactivity"), { credentials: "include", cache: "no-store" });
      const j = await r.json();
      if (j?.today) setReport(j as Report);
    } catch { /* dashboard is best-effort */ }
  }, []);
  useEffect(() => { void loadReport(); }, [loadReport]);

  const save = async () => {
    setSaving(true);
    const res = await saveConfig({ inactivity: a });
    setSaving(false);
    if (res.ok) { await reload(); await loadReport(); toast("Inactivity settings saved — live for all users.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const resetAll = () => { setA(DEFAULTS); setCustom(false); toast("Reset to defaults — press Save changes to apply.", "info"); };

  const toggleRole = (v: string) =>
    setA({ ...a, exemptRoles: a.exemptRoles.includes(v) ? a.exemptRoles.filter((r) => r !== v) : [...a.exemptRoles, v] });

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-24">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
          <UserX className="size-6 text-lotus-300" /> Inactivity Detection
        </h1>
        <p className="mt-1 text-sm text-mist-400">
          Stops users farming the hourly Startup Bonus by leaving the app open without using it, and can
          optionally log idle users out. Changes are live for everyone — no app update needed.
        </p>
      </div>

      {/* Today's dashboard */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={Coins} label="Coins saved today" value={report ? String(report.today.coinsSaved) : "—"} accent />
        <Stat icon={Timer} label="Idle minutes blocked" value={report ? String(report.today.idleMinutes) : "—"} />
        <Stat icon={LogOut} label="Auto logouts today" value={report ? String(report.today.autoLogouts) : "—"} />
        <Stat icon={MonitorSmartphone} label="Sessions ended today" value={report ? String(report.today.sessionsEnded) : "—"} />
      </div>
      {report && (
        <p className="-mt-2 text-xs text-mist-500">
          All time: <b className="text-mist-300">{report.lifetime.coinsSaved}</b> coins saved ·{" "}
          <b className="text-mist-300">{report.lifetime.idleMinutes}</b> idle minutes blocked ·{" "}
          <b className="text-mist-300">{report.lifetime.autoLogouts}</b> auto logouts.
        </p>
      )}

      {/* ── Bonus protection (the part that actually saves money) ── */}
      <Card className="p-4 sm:p-5">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-mist-100">
          <Coins className="size-5 text-lotus-300" /> Startup Bonus protection
        </h2>
        <p className="mb-1 text-sm text-mist-400">
          This is the setting that prevents the financial loss. It does <b className="text-mist-200">not</b> log
          anyone out — it simply stops idle time counting toward bonus coins.
        </p>
        <Toggle
          icon={ShieldCheck}
          label="Only reward genuine activity"
          hint="Idle minutes earn no bonus time. Being in a voice room always counts as active."
          on={a.rewardRequiresActivity}
          onChange={(v) => setA({ ...a, rewardRequiresActivity: v })}
        />
        {a.rewardRequiresActivity && (
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 pl-8">
            <div className="min-w-0">
              <span className="text-xs font-semibold text-mist-300">Count as active for</span>
              <p className="text-xs text-mist-500">Minutes after someone&apos;s last tap that still earn bonus time.</p>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number" min={1} max={120} value={a.rewardGraceMinutes}
                onChange={(e) => setA({ ...a, rewardGraceMinutes: Math.max(1, Math.min(120, Number(e.target.value) || 1)) })}
                className="h-9 w-20 rounded-lg border border-line bg-ink-800 px-2 text-sm font-semibold text-mist-100 outline-none focus:border-lotus-400"
              />
              <span className="text-xs text-mist-400">minutes</span>
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 py-3">
          <div className="min-w-0">
            <span className="text-xs font-semibold text-mist-300">Voice-room presence timeout</span>
            <p className="text-xs text-mist-500">A member who stops sending a heartbeat for this long is treated as <b className="text-mist-300">gone</b> — removed from the participant list, the &quot;in room&quot; count, and any bonus. Covers closing the app, losing connection, or force-quitting.</p>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number" min={20} max={600} value={a.roomTimeoutSeconds}
              onChange={(e) => setA({ ...a, roomTimeoutSeconds: Math.max(20, Math.min(600, Number(e.target.value) || 60)) })}
              className="h-9 w-20 rounded-lg border border-line bg-ink-800 px-2 text-sm font-semibold text-mist-100 outline-none focus:border-lotus-400"
            />
            <span className="text-xs text-mist-400">seconds</span>
          </div>
        </div>
        <p className="border-t border-line/60 pt-3 text-xs text-mist-500">
          Note: bonus time already stops completely while the app is minimised or in the background — the
          app only counts minutes while it is open on screen. The server always verifies a live session +
          fresh heartbeat before paying any bonus, so offline/ghost users can never be rewarded.
        </p>
      </Card>

      {/* ── Auto logout (the risky part — flagged) ── */}
      <Card className="p-4 sm:p-5">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-mist-100">
          <LogOut className="size-5 text-lotus-300" /> Auto logout for idle users
        </h2>

        <div className="mb-3 flex gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-400" />
          <p className="text-xs leading-relaxed text-amber-200/90">
            <b>Please read before switching this on.</b> An automatic idle logout was removed from this app
            once before, because users were being signed out while the app sat in the background — they
            complained about having to log in again constantly. This version is safe by default: background
            time is <b>not</b> counted, and returning to the app resets the clock. Bonus abuse is already
            handled by the setting above, <b>without</b> logging anyone out. Only turn this on if you
            specifically want idle users signed out.
          </p>
        </div>

        <Toggle
          icon={UserX}
          label="Automatically log out inactive users"
          hint="Default OFF. When off, nothing below applies and no one is ever signed out for being idle."
          on={a.enabled}
          onChange={(v) => setA({ ...a, enabled: v })}
        />

        {a.enabled && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 py-3 pl-8">
              <span className="text-xs font-semibold text-mist-300">Log out after</span>
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="flex overflow-hidden rounded-lg border border-line">
                  {TIMEOUTS.map((m) => (
                    <button
                      key={m}
                      onClick={() => { setCustom(false); setA({ ...a, timeoutMinutes: m }); }}
                      className={cn("px-3 py-1.5 text-xs font-semibold transition",
                        !custom && a.timeoutMinutes === m ? "bg-lotus-500 text-white" : "bg-ink-800 text-mist-300 hover:bg-white/[0.06]")}
                    >
                      {m} min
                    </button>
                  ))}
                  <button
                    onClick={() => setCustom(true)}
                    className={cn("px-3 py-1.5 text-xs font-semibold transition",
                      custom ? "bg-lotus-500 text-white" : "bg-ink-800 text-mist-300 hover:bg-white/[0.06]")}
                  >
                    Custom
                  </button>
                </div>
                {custom && (
                  <input
                    type="number" min={1} max={1440} value={a.timeoutMinutes}
                    onChange={(e) => setA({ ...a, timeoutMinutes: Math.max(1, Math.min(1440, Number(e.target.value) || 1)) })}
                    className="h-9 w-20 rounded-lg border border-line bg-ink-800 px-2 text-sm font-semibold text-mist-100 outline-none focus:border-lotus-400"
                  />
                )}
              </div>
            </div>

            <Segmented
              label="Warning countdown before logout"
              value={String(a.warningSeconds)}
              options={[{ v: "30", label: "30 seconds" }, { v: "60", label: "60 seconds" }]}
              onChange={(v) => setA({ ...a, warningSeconds: Number(v) })}
              indent
            />

            <Toggle
              icon={Moon}
              label="Also count time while the app is in the background"
              hint="⚠ This is what caused the old logout problem. Leave OFF unless you are sure."
              on={a.backgroundMonitor}
              onChange={(v) => setA({ ...a, backgroundMonitor: v })}
            />

            <Toggle
              icon={ShieldCheck}
              label="Never log out administrators"
              hint="Recommended ON so you can't be signed out of the admin panel while working."
              on={a.exemptAdmins}
              onChange={(v) => setA({ ...a, exemptAdmins: v })}
            />

            <div className="border-t border-line/60 py-3 pl-8">
              <div className="mb-2 text-xs font-semibold text-mist-300">Also exempt these roles</div>
              <div className="flex flex-wrap gap-1.5">
                {EXEMPTABLE.map((r) => (
                  <button
                    key={r.v}
                    onClick={() => toggleRole(r.v)}
                    className={cn("rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                      a.exemptRoles.includes(r.v) ? "border-lotus-400 bg-lotus-500/15 text-lotus-200" : "border-line bg-ink-800 text-mist-300 hover:bg-white/[0.06]")}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </Card>

      {/* ── Session security ── */}
      <Card className="p-4 sm:p-5">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-mist-100">
          <MonitorSmartphone className="size-5 text-lotus-300" /> Session security
        </h2>
        <Toggle
          icon={MonitorSmartphone}
          label="One device at a time"
          hint="Signing in ends that account's other sessions — stops one account being farmed on several devices."
          on={a.singleSession}
          onChange={(v) => setA({ ...a, singleSession: v })}
        />
      </Card>

      {/* ── Suspicious idle accounts ── */}
      <Card className="p-4 sm:p-5">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-mist-100">
          <AlertTriangle className="size-5 text-amber-400" /> Suspicious idle accounts
        </h2>
        <p className="mb-3 text-sm text-mist-400">
          Accounts with the most idle time — the ones most likely to be leaving the app open to collect
          coins. Ranked by idle minutes, showing each member&apos;s ID number.
        </p>
        {!report?.suspicious.length ? (
          <p className="py-4 text-center text-sm text-mist-500">No accounts with significant idle time yet.</p>
        ) : (
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-mist-500">
                  <th className="px-4 py-2">ID number</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2 text-right">Idle min</th>
                  <th className="px-4 py-2 text-right">Active min</th>
                  <th className="px-4 py-2 text-right">Idle %</th>
                  <th className="px-4 py-2 text-right">Bonus earned</th>
                </tr>
              </thead>
              <tbody>
                {report.suspicious.map((u) => (
                  <tr key={u.id} className="border-b border-line/50">
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/users?q=${encodeURIComponent(u.publicId || u.id)}`} className="font-mono text-xs font-bold text-lotus-300 hover:underline">{u.publicId ?? "—"}</Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/users?q=${encodeURIComponent(u.publicId || u.id)}`} className="hover:underline">
                        <span className="font-semibold text-mist-100 hover:text-lotus-300">{u.name}</span>
                        {u.username && <span className="ml-1 text-xs text-mist-500">@{u.username}</span>}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-mist-200">{u.idleMinutes}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-mist-400">{u.activeMinutes}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-bold",
                        u.idlePct >= 80 ? "bg-rose-500/15 text-rose-300" : u.idlePct >= 50 ? "bg-amber-500/15 text-amber-300" : "bg-white/[0.06] text-mist-300")}>
                        {u.idlePct}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-mist-300">{u.bonus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Event log ── */}
      <Card className="p-4 sm:p-5">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-mist-100">
          <BellRing className="size-5 text-lotus-300" /> Inactivity event log
        </h2>
        <p className="mb-3 text-sm text-mist-400">Every automatic logout and ended session, with the member ID number and the reason.</p>
        {!report?.logs.length ? (
          <p className="py-4 text-center text-sm text-mist-500">No inactivity events recorded yet.</p>
        ) : (
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-mist-500">
                  <th className="px-4 py-2">Date &amp; time</th>
                  <th className="px-4 py-2">ID number</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Idle</th>
                  <th className="px-4 py-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {report.logs.map((l) => (
                  <tr key={l.id} className="border-b border-line/50">
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-mist-400">
                      {new Date(l.at).toLocaleString("en-SA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/users?q=${encodeURIComponent(l.publicId || l.userId)}`} className="font-mono text-xs font-bold text-lotus-300 hover:underline">{l.publicId ?? "—"}</Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/users?q=${encodeURIComponent(l.publicId || l.userId)}`} className="font-semibold text-mist-100 hover:text-lotus-300 hover:underline">{l.userName}</Link>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-mist-400">{l.idleMinutes != null ? `${l.idleMinutes} min` : "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-mist-300">{l.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <button onClick={resetAll} className="inline-flex items-center gap-1.5 text-sm font-semibold text-mist-400 transition hover:text-mist-100">
        <RotateCcw className="size-4" /> Reset everything to defaults
      </button>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink-900/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <span className="text-xs text-mist-400">Changes apply to every user after you save.</span>
          <Button onClick={save} disabled={saving}><Check className="size-4" /> {saving ? "Saving…" : "Save changes"}</Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: {
  icon: ComponentType<{ className?: string }>; label: string; value: string; accent?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border p-3", accent ? "border-lotus-400/40 bg-lotus-500/[0.08]" : "border-line bg-ink-900")}>
      <Icon className={cn("size-4", accent ? "text-lotus-300" : "text-mist-400")} />
      <div className={cn("mt-2 font-display text-xl font-extrabold tabular-nums", accent ? "text-lotus-200" : "text-mist-100")}>{value}</div>
      <div className="text-[11px] leading-tight text-mist-500">{label}</div>
    </div>
  );
}

function Toggle({ icon: Icon, label, hint, on, onChange }: {
  icon: ComponentType<{ className?: string }>; label: string; hint: string; on: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 border-t border-line/60 py-3 first:border-t-0">
      <Icon className="size-5 shrink-0 text-mist-400" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-mist-100">{label}</div>
        <div className="text-xs text-mist-500">{hint}</div>
      </div>
      <button
        onClick={() => onChange(!on)}
        role="switch"
        aria-checked={on}
        title={on ? "On — tap to turn off" : "Off — tap to turn on"}
        className={cn("relative h-6 w-11 shrink-0 rounded-full transition", on ? "bg-emerald-500" : "bg-mist-600")}
      >
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );
}

function Segmented({ label, value, options, onChange, indent }: {
  label: string; value: string; options: { v: string; label: string }[]; onChange: (v: string) => void; indent?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 border-t border-line/60 py-3", indent && "pl-8")}>
      <span className="text-xs font-semibold text-mist-300">{label}</span>
      <div className="flex overflow-hidden rounded-lg border border-line">
        {options.map((o) => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className={cn("px-3 py-1.5 text-xs font-semibold transition", value === o.v ? "bg-lotus-500 text-white" : "bg-ink-800 text-mist-300 hover:bg-white/[0.06]")}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
