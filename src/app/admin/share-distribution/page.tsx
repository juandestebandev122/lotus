"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { withBase } from "@/lib/base-path";
import { useConfig, saveConfig } from "@/lib/config";
import { PieChart, Save, Loader2, Users, Landmark, Building2, HandCoins, Flower2, AlertTriangle, Calculator, History, ArrowRight } from "lucide-react";

interface ShareChange { id: string; at: string; by: string; before: { user: number; agency: number; company: number; trust: number; trustEnabled: boolean; gst: number }; after: { user: number; agency: number; company: number; trust: number; trustEnabled: boolean; gst: number } }

/**
 * Share Distribution Management — a focused Super-Admin module to set the 4-way
 * profit-sharing split (User / Agency / Company / Trust) that the Lotus economy
 * applies to EVERY coin spend (gifts, calls, voice rooms, referrals, transfers,
 * Lucky Spin). It writes the same config the Lotus Economy page uses, so the two
 * always stay in sync.
 */
export default function ShareDistributionPage() {
  const { toast } = useToast();
  const { config, reload } = useConfig();
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(65);
  const [agency, setAgency] = useState(5);
  const [company, setCompany] = useState(25);
  const [trust, setTrust] = useState(5);
  const [sim, setSim] = useState(100);
  const [log, setLog] = useState<ShareChange[]>([]);

  useEffect(() => {
    fetch(withBase("/api/admin/share-log"), { credentials: "include", cache: "no-store" }).then((r) => r.json()).then((d) => setLog(d.log ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    const l = config.lotus;
    if (!l) return;
    setUser(l.userSharePct ?? 65);
    setAgency(l.agencySharePct ?? 5);
    setCompany(l.companySharePct ?? 25);
    setTrust(l.trustSharePct ?? 5);
  }, [config.lotus]);

  const total = user + agency + company + trust;
  const ok = total === 100;
  const enabled = !!config.lotus?.enabled;
  const name = config.lotus?.name || "Lotus";

  const save = async () => {
    if (!ok) return toast(`Shares must total 100% (currently ${total}%)`, "error");
    setSaving(true);
    const res = await saveConfig({ lotus: { ...(config.lotus ?? {} as NonNullable<typeof config.lotus>), userSharePct: user, agencySharePct: agency, companySharePct: company, trustSharePct: trust } });
    setSaving(false);
    if (res.ok) { toast("Share distribution saved", "success"); reload(); }
    else toast(res.error ?? "Save failed", "error");
  };

  const rows: { key: string; label: string; icon: typeof Users; val: number; set: (n: number) => void; tone: string; bar: string }[] = [
    { key: "user", label: "User Share (the receiver)", icon: Users, val: user, set: setUser, tone: "text-emerald-300", bar: "bg-emerald-400" },
    { key: "agency", label: "Agency Share", icon: Landmark, val: agency, set: setAgency, tone: "text-sky-300", bar: "bg-sky-400" },
    { key: "company", label: "Company Share", icon: Building2, val: company, set: setCompany, tone: "text-fuchsia-300", bar: "bg-fuchsia-400" },
    { key: "trust", label: "Trust Share (Trust Wallet)", icon: HandCoins, val: trust, set: setTrust, tone: "text-amber-300", bar: "bg-amber-400" },
  ];
  const fld = "h-11 w-24 rounded-lg border border-line bg-ink-800 px-3 text-lg font-bold text-mist-100 outline-none focus:border-lotus-400";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><PieChart className="size-6 text-lotus-300" /> Share Distribution</h1>
        <p className="mt-1 text-sm text-mist-400">Set how every coin spent in the app is split into Lotus Flowers — <b>User · Agency · Company · Trust</b>. Applies to gifts, audio/video calls, voice rooms, referrals, transfers &amp; Lucky Spin. Editable anytime.</p>
      </div>

      {/* Economy status */}
      <Card className={cn("flex flex-wrap items-center justify-between gap-3 p-4", enabled ? "border-emerald-400/30" : "border-amber-400/30")}>
        <p className="flex items-center gap-2 text-sm text-mist-200"><Flower2 className={cn("size-4", enabled ? "text-emerald-300" : "text-amber-300")} /> The {name} economy is currently <b className={enabled ? "text-emerald-300" : "text-amber-300"}>{enabled ? "ON" : "OFF"}</b>.</p>
        {!enabled && <Link href="/admin/lotus" className="rounded-full bg-lotus-500/20 px-3 py-1.5 text-xs font-bold text-lotus-200 hover:bg-lotus-500/30">Turn it ON in Lotus Economy →</Link>}
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-mist-100">Profit-sharing percentage</h2>
          <span className={cn("rounded-full px-3 py-1 text-sm font-bold", ok ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300")}>Total {total}%{ok ? " ✓" : " — must be 100"}</span>
        </div>

        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center gap-3">
              <span className={cn("flex w-52 shrink-0 items-center gap-2 text-sm font-semibold", r.tone)}><r.icon className="size-4" /> {r.label}</span>
              <input type="number" min={0} max={100} value={r.val} onChange={(e) => r.set(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} className={fld} />
              <span className="text-sm text-mist-500">%</span>
              <div className="ml-2 hidden h-2 flex-1 overflow-hidden rounded-full bg-ink-800 sm:block">
                <div className={cn("h-full rounded-full", r.bar)} style={{ width: `${Math.min(100, r.val)}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Proportion bar */}
        <div className="mt-5 flex h-4 w-full overflow-hidden rounded-full ring-1 ring-white/10">
          {rows.map((r) => total > 0 && r.val > 0 && <div key={r.key} className={r.bar} style={{ width: `${(r.val / total) * 100}%` }} title={`${r.label}: ${r.val}%`} />)}
        </div>

        <div className="mt-4 rounded-lg bg-ink-800/60 px-3 py-2 text-[11px] text-mist-400">
          <b>Example — 100 coins spent:</b> User <b className="text-emerald-200">{user}</b> · Agency <b className="text-sky-200">{agency}</b> · Company <b className="text-fuchsia-200">{company}</b> · Trust <b className="text-amber-200">{trust}</b> {name} Flowers. If the receiver has no active agency, the agency slice rolls into Company.
        </div>

        {!ok && <p className="mt-3 flex items-center gap-1.5 text-xs text-rose-300"><AlertTriangle className="size-4" /> The four shares must add up to exactly 100% before you can save.</p>}
        <Button className="mt-4" onClick={save} disabled={saving || !ok}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save distribution</Button>
      </Card>

      {/* Profit Simulator */}
      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-mist-100"><Calculator className="size-4 text-lotus-300" /> Profit Simulator</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-mist-400">Coins spent</label>
          <input type="number" min={0} value={sim} onChange={(e) => setSim(Math.max(0, Number(e.target.value) || 0))} className="h-10 w-32 rounded-lg border border-line bg-ink-800 px-3 text-lg font-bold text-mist-100 outline-none focus:border-lotus-400" />
          <span className="text-xs text-mist-500">→ splits into (Lotus):</span>
        </div>
        {(() => {
          const t = user + agency + company + trust || 100;
          const a = Math.round((sim * agency) / t * 100) / 100;
          const c = Math.round((sim * company) / t * 100) / 100;
          const tr = Math.round((sim * trust) / t * 100) / 100;
          const u = Math.round((sim - a - c - tr) * 100) / 100;
          const cells: [string, number, string][] = [["User", u, "text-emerald-300"], ["Agency", a, "text-sky-300"], ["Company", c, "text-fuchsia-300"], ["Trust", tr, "text-amber-300"]];
          return (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {cells.map(([lab, v, tone]) => (
                <div key={lab} className="rounded-xl border border-line bg-ink-800/50 p-3 text-center">
                  <div className="text-[11px] text-mist-400">{lab}</div>
                  <div className={cn("font-display text-xl font-extrabold", tone)}>{v.toLocaleString("en-SA")}</div>
                </div>
              ))}
            </div>
          );
        })()}
      </Card>

      {/* Profit dashboards hub */}
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-bold text-mist-100">Profit dashboards</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {([
            { href: "/admin/user-profit", label: "User Earnings", icon: Users, tone: "text-emerald-300" },
            { href: "/admin/agent-profit", label: "Agency Profit", icon: Landmark, tone: "text-sky-300" },
            { href: "/admin/company-profit", label: "Company Profit", icon: Building2, tone: "text-fuchsia-300" },
            { href: "/admin/trust", label: "Trust Profit", icon: HandCoins, tone: "text-amber-300" },
          ]).map((d) => (
            <Link key={d.href} href={d.href} className="flex items-center gap-2 rounded-xl border border-line bg-ink-800 px-3 py-3 text-sm font-semibold text-mist-100 transition hover:border-lotus-400/40">
              <d.icon className={cn("size-4", d.tone)} /> <span className="flex-1">{d.label}</span> <ArrowRight className="size-4 text-mist-500" />
            </Link>
          ))}
        </div>
      </Card>

      {/* Share change history (audit) */}
      <Card className="overflow-hidden p-0">
        <div className="border-b border-white/5 px-5 py-3"><h2 className="flex items-center gap-2 text-sm font-bold text-mist-100"><History className="size-4 text-lotus-300" /> Share change history</h2></div>
        <div className="max-h-72 overflow-y-auto">
          {log.length === 0 ? <p className="px-5 py-6 text-center text-sm text-mist-500">No changes recorded yet.</p> : log.map((e) => (
            <div key={e.id} className="border-b border-white/5 px-5 py-2.5 text-xs last:border-0">
              <div className="flex items-center justify-between"><span className="font-semibold text-mist-200">{e.by}</span><span className="text-[10px] text-mist-500">{new Date(e.at).toLocaleString("en-GB")}</span></div>
              <div className="mt-0.5 text-mist-400">User {e.before.user}→<b className="text-emerald-300">{e.after.user}</b> · Agency {e.before.agency}→<b className="text-sky-300">{e.after.agency}</b> · Company {e.before.company}→<b className="text-fuchsia-300">{e.after.company}</b> · Trust {e.before.trust}→<b className="text-amber-300">{e.after.trust}</b>{e.before.trustEnabled !== e.after.trustEnabled ? ` · Trust ${e.after.trustEnabled ? "ON" : "OFF"}` : ""}{e.before.gst !== e.after.gst ? ` · GST ${e.after.gst}%` : ""}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
