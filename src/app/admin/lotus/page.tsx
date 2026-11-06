"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { withBase } from "@/lib/base-path";
import { useConfig, saveConfig, type AppConfig } from "@/lib/config";
import { Flower2, Coins, TrendingUp, Wallet, Check, X, Clock, Loader2, Save, Users, ArrowRightLeft } from "lucide-react";

type LotusCfg = NonNullable<AppConfig["lotus"]>;
interface Withdrawal { id: string; userId: string; userName: string; coins: number; lotus?: number; kind?: string; amountINR: number; netAmount?: number; feeAmount?: number; currency?: string; method: string; details: string; status: string; at: string; note?: string }
interface Report {
  enabled: boolean; config: LotusCfg;
  totalGiftedCoins: number; totalLotusGenerated: number; totalLotusOutstanding: number; companyGiftRevenue: number;
  companyLotus: number; agencyLotusTotal: number; trustWallet: number; totalGstCollected: number;
  withdrawals: { pending: { count: number; lotus: number }; approved: { count: number; lotus: number }; completed: { count: number; lotus: number }; rejected: { count: number; lotus: number }; totalPaidCurrency: number; currency: string };
  topEarners: { userId: string; name: string; publicId?: string; lotus: number }[];
  recent: Withdrawal[];
  trustRecent: { id: string; at: string; type: "credit" | "debit"; lotus: number; source: string; userName?: string; note?: string }[];
}

interface Breakdown {
  found: boolean; userId?: string; name?: string; publicId?: string; lotusName: string;
  balance: number; earned: number; spent: number; withdrawn?: number;
  bySource: { source: string; amount: number; count: number }[];
  recent: { at: string; source: string; amount: number; description: string }[];
}

const num = (n: number) => (n ?? 0).toLocaleString("en-SA");
const fmtDate = (iso: string) => new Date(iso).toLocaleString("en-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function AdminLotusPage() {
  const { toast } = useToast();
  const { config } = useConfig();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  // Editable config form (seeded from the live config).
  const [f, setF] = useState<LotusCfg | null>(null);
  // Top-earner drill-down (how a user's Lotus was earned, by source).
  const [bd, setBd] = useState<Breakdown | null>(null);
  const [bdLoading, setBdLoading] = useState(false);
  const openBreakdown = useCallback(async (userId: string) => {
    setBd(null); setBdLoading(true);
    try {
      const r = await fetch(withBase(`/api/admin/lotus?user=${encodeURIComponent(userId)}`), { credentials: "include", cache: "no-store" });
      const d = await r.json();
      setBd((d?.breakdown as Breakdown) ?? { found: false } as Breakdown);
    } catch { toast("Could not load the breakdown", "error"); }
    setBdLoading(false);
  }, [toast]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(withBase("/api/admin/lotus"), { credentials: "include", cache: "no-store" });
      const d = await res.json();
      setReport(d.report ?? null);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (config.lotus && !f) setF({ ...config.lotus }); }, [config.lotus, f]);

  const set = <K extends keyof LotusCfg>(k: K, v: LotusCfg[K]) => setF((s) => (s ? { ...s, [k]: v } : s));

  // Lotus Flower icon upload — reuses the admin image-upload endpoint; the returned
  // URL is saved into config.lotus.icon and shown everywhere the currency appears.
  const iconRef = useRef<HTMLInputElement>(null);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const uploadIcon = async (file: File) => {
    setUploadingIcon(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(withBase("/api/admin/tokens"), { method: "POST", body: fd, credentials: "include" });
      const d = await res.json();
      if (res.ok && d.url) { set("icon", d.url as string); toast("Icon uploaded — press Save settings to apply.", "success"); }
      else toast(d.error ?? "Upload failed", "error");
    } catch { toast("Upload failed", "error"); }
    setUploadingIcon(false);
    if (iconRef.current) iconRef.current.value = "";
  };

  const save = async () => {
    if (!f) return;
    setBusy("save");
    const res = await saveConfig({ lotus: f });
    setBusy("");
    if (res.ok) { toast("Lotus settings saved", "success"); load(); }
    else toast(res.error ?? "Save failed", "error");
  };

  const decide = async (w: Withdrawal, decision: "approved" | "rejected" | "completed") => {
    let note = "";
    if (decision === "rejected") { const v = window.prompt(`Reject ${w.userName}'s withdrawal? Optional reason:`, ""); if (v === null) return; note = v; }
    setBusy(w.id + decision);
    const res = await fetch(withBase("/api/admin/withdrawals"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: w.id, decision, note }) });
    setBusy("");
    if (res.ok) { toast(`Withdrawal ${decision}`, decision === "rejected" ? "info" : "success"); load(); }
    else { const d = await res.json().catch(() => ({})); toast(d.error ?? "Failed", "error"); }
  };

  const fld = "h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400";
  const numName = f?.name ?? "Lotus";
  const cur = f?.currency ?? report?.withdrawals.currency ?? "SAR";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><Flower2 className="size-6 text-lotus-300" /> Lotus Flower Economy</h1>
        <p className="mt-1 text-sm text-mist-400">Convert gifted coins to withdraw-only Lotus Flowers, so the same coins don&apos;t circulate forever. All rates/limits below are editable anytime — no app update needed.</p>
      </div>

      {/* Config */}
      {f && (
        <Card className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-bold text-mist-100"><ArrowRightLeft className="size-4 text-lotus-300" /> Conversion &amp; withdrawal settings</h2>
            <button onClick={() => set("enabled", !f.enabled)} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition", f.enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-white/[0.06] text-mist-400")}>
              <span className={cn("size-2 rounded-full", f.enabled ? "bg-emerald-400" : "bg-mist-500")} /> {f.enabled ? "Economy ON" : "Economy OFF"}
            </button>
          </div>
          {!f.enabled && <p className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">While OFF, gifts credit the receiver in coins and coin withdrawals work as before. Turn ON to switch gifts to Lotus Flowers and make withdrawals Lotus-only.</p>}

          {/* Lotus Flower icon — admin-uploaded, shown wherever the currency appears. */}
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-ink-800/60 p-3">
            <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-ink-900">
              {f.icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={withBase(f.icon)} alt="" className="size-11 object-contain" />
              ) : (
                <Flower2 className="size-7 text-lotus-300" />
              )}
            </div>
            <div className="min-w-40 flex-1">
              <div className="text-sm font-semibold text-mist-100">Lotus Flower icon</div>
              <div className="text-xs text-mist-500">Shown in the Wallet, withdrawals and reports. PNG with a transparent background looks best. {f.icon ? "" : "Using the default 🪷 for now."}</div>
            </div>
            <input ref={iconRef} type="file" accept="image/*" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadIcon(file); }} />
            <Button variant="secondary" onClick={() => iconRef.current?.click()} disabled={uploadingIcon}>{uploadingIcon ? "Uploading…" : f.icon ? "Change icon" : "Upload icon"}</Button>
            {f.icon && <Button variant="ghost" onClick={() => set("icon", "")}><X className="size-4" /> Remove</Button>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Currency name (what receivers earn)"><input value={f.name} onChange={(e) => set("name", e.target.value)} className={fld} maxLength={24} /></Field>
            <Field label="Payout currency"><input value={f.currency} onChange={(e) => set("currency", e.target.value)} className={fld} maxLength={8} /></Field>
            <Field label={`Coin → ${numName} rate (${numName} per 1 coin share)`}><input type="number" min={0} step="0.01" value={f.coinToLotus} onChange={(e) => set("coinToLotus", Number(e.target.value) || 0)} className={fld} /></Field>
            <Field label={`${numName} → ${cur} value (payout per 1 ${numName})`}><input type="number" min={0} step="0.0001" value={f.lotusToCurrency} onChange={(e) => set("lotusToCurrency", Number(e.target.value) || 0)} className={fld} /></Field>
            <Field label={`GST % (on withdrawals)`}><input type="number" min={0} max={100} value={f.gstPct ?? 18} onChange={(e) => set("gstPct", Number(e.target.value) || 0)} className={fld} /></Field>
            <Field label={`Service fee % (on withdrawals)`}><input type="number" min={0} max={100} value={f.feePct} onChange={(e) => set("feePct", Number(e.target.value) || 0)} className={fld} /></Field>
            <Field label={`Minimum withdrawal (${numName})`}><input type="number" min={0} value={f.minWithdraw} onChange={(e) => set("minWithdraw", Number(e.target.value) || 0)} className={fld} /></Field>
            <Field label={`Maximum withdrawal (${numName}, 0 = no cap)`}><input type="number" min={0} value={f.maxWithdraw} onChange={(e) => set("maxWithdraw", Number(e.target.value) || 0)} className={fld} /></Field>
            <Field label={`Daily withdrawal limit (${numName}, 0 = no cap)`}><input type="number" min={0} value={f.dailyLimit} onChange={(e) => set("dailyLimit", Number(e.target.value) || 0)} className={fld} /></Field>
            <Field label="Approval mode"><select value={f.autoApprove ? "auto" : "manual"} onChange={(e) => set("autoApprove", e.target.value === "auto")} className={fld}><option value="manual">Manual (admin approves)</option><option value="auto">Automatic</option></select></Field>
          </div>

          {/* 4-way Lotus distribution shares (Final Plan) */}
          {(() => {
            const uS = f.userSharePct ?? 65, aS = f.agencySharePct ?? 5, cS = f.companySharePct ?? 25, tS = f.trustSharePct ?? 5;
            const total = uS + aS + cS + tS;
            return (
              <div className="mt-4 rounded-xl border border-lotus-400/25 bg-lotus-500/[0.05] p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-mist-100">Lotus distribution shares — every coin spent, split 4 ways</h3>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", total === 100 ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300")}>Total {total}%{total !== 100 ? " (should be 100)" : " ✓"}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="User (receiver) %"><input type="number" min={0} max={100} value={uS} onChange={(e) => set("userSharePct", Number(e.target.value) || 0)} className={fld} /></Field>
                  <Field label="Agency %"><input type="number" min={0} max={100} value={aS} onChange={(e) => set("agencySharePct", Number(e.target.value) || 0)} className={fld} /></Field>
                  <Field label="Company %"><input type="number" min={0} max={100} value={cS} onChange={(e) => set("companySharePct", Number(e.target.value) || 0)} className={fld} /></Field>
                  <Field label="Trust Wallet %"><input type="number" min={0} max={100} value={tS} onChange={(e) => set("trustSharePct", Number(e.target.value) || 0)} className={fld} /></Field>
                </div>
                <p className="mt-2 text-[11px] text-mist-400">Applies to gifts, calls, voice rooms, referrals, transfers &amp; Lucky Spin. If a receiver has no active agency, the agency slice rolls into Company. <b>Example — 100 coins:</b> User {uS} · Agency {aS} · Company {cS} · Trust {tS} {numName}.</p>
              </div>
            );
          })()}
          {/* Conversion rules — admin-defined slabs "X Lotus = value". Every value is
              admin-controlled: add / edit / delete / enable / disable, nothing hardcoded.
              A withdrawal that exactly matches an ENABLED slab pays the slab value;
              other amounts use the linear per-Lotus rate above. */}
          {(() => {
            const tiers = f.conversionTiers ?? [];
            const setTier = (id: string, patch: Partial<{ lotus: number; value: number; enabled: boolean }>) =>
              set("conversionTiers", tiers.map((t) => (t.id === id ? { ...t, ...patch } : t)));
            const addTier = () => set("conversionTiers", [...tiers, { id: `ct_${Date.now().toString(36)}`, lotus: 0, value: 0, enabled: true }]);
            const delTier = (id: string) => set("conversionTiers", tiers.filter((t) => t.id !== id));
            return (
              <div className="mt-4 rounded-xl border border-gold-400/25 bg-gold-500/[0.04] p-4">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-mist-100">Conversion rules — {numName} → {cur} withdrawal values</h3>
                  <Button variant="secondary" size="sm" onClick={addTier}>+ Add rule</Button>
                </div>
                <p className="mb-3 text-[11px] text-mist-400">Set the exact payout for each {numName} amount (e.g. 500 {numName} = {cur} 300). Users see this table in their wallet, and a withdrawal matching an <b>enabled</b> rule pays the rule&apos;s value. Amounts with no matching rule use the linear rate above. Disable a rule to keep it without offering it.</p>
                {tiers.length === 0 ? (
                  <p className="rounded-lg bg-ink-800/60 px-3 py-2 text-xs text-mist-500">No rules yet — every withdrawal uses the linear rate. Press “Add rule” to define slab values.</p>
                ) : (
                  <div className="space-y-1.5">
                    {tiers.map((t) => (
                      <div key={t.id} className={cn("flex flex-wrap items-center gap-2 rounded-lg border border-line bg-ink-800/50 px-3 py-2", !t.enabled && "opacity-60")}>
                        <input type="number" min={0} value={t.lotus || ""} placeholder="Lotus" onChange={(e) => setTier(t.id, { lotus: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} className="h-9 w-28 rounded-lg border border-line bg-ink-900 px-2.5 text-sm font-semibold text-mist-100 outline-none focus:border-lotus-400" />
                        <span className="text-xs text-mist-400">{numName} =</span>
                        <span className="text-xs font-semibold text-mist-300">{cur}</span>
                        <input type="number" min={0} step="0.01" value={t.value || ""} placeholder="Value" onChange={(e) => setTier(t.id, { value: Math.max(0, Number(e.target.value) || 0) })} className="h-9 w-28 rounded-lg border border-line bg-ink-900 px-2.5 text-sm font-semibold text-emerald-200 outline-none focus:border-lotus-400" />
                        <span className="min-w-0 flex-1" />
                        <button onClick={() => setTier(t.id, { enabled: !t.enabled })} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold transition", t.enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-white/[0.06] text-mist-400")}>
                          <span className={cn("size-1.5 rounded-full", t.enabled ? "bg-emerald-400" : "bg-mist-500")} /> {t.enabled ? "Enabled" : "Disabled"}
                        </button>
                        <button onClick={() => delTier(t.id)} className="rounded-lg bg-rose-500/10 p-1.5 text-rose-300 transition hover:bg-rose-500/20" title="Delete rule"><X className="size-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[10px] text-mist-600">Changes apply after “Save settings”. Rules with 0 {numName} are ignored.</p>
              </div>
            );
          })()}
          {(() => {
            const gross = Math.round(1000 * f.lotusToCurrency * 100) / 100;
            const gst = Math.round(gross * ((f.gstPct ?? 18) / 100) * 100) / 100;
            const fee = Math.round(gross * (f.feePct / 100) * 100) / 100;
            const net = Math.round((gross - gst - fee) * 100) / 100;
            return (
              <div className="mt-3 rounded-lg bg-ink-800/60 px-3 py-2 text-[11px] text-mist-400">
                <b>Withdrawal example</b> — 1,000 {numName} → gross <b className="text-mist-200">{cur} {num(gross)}</b> − GST ({f.gstPct ?? 18}%) {cur} {num(gst)} − service fee ({f.feePct}%) {cur} {num(fee)} = user receives <b className="text-emerald-200">{cur} {num(net)}</b>.
              </div>
            );
          })()}
          {/* Which FREE rewards convert to Lotus (vs stay as coins) when the economy is ON */}
          <div className="mt-4 rounded-xl border border-lotus-400/25 bg-lotus-500/[0.05] p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-mist-100"><ArrowRightLeft className="size-4 text-lotus-300" /> Free rewards → Lotus conversion</h3>
            <p className="mt-0.5 text-xs text-mist-400">While the economy is ON, these free rewards pay <b className="text-mist-200">{numName}</b> (via the split above) instead of coins. Turn any one OFF to keep paying it as coins. Coins otherwise come only from purchases.</p>
            <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {([
                ["welcome", "Welcome bonus"], ["dailyLogin", "Daily login bonus"], ["timed", "Timed reward"], ["activity", "Activity / Startup bonus"],
                ["luckySpin", "Lucky Spin"], ["referral", "Referral reward"], ["tournament", "Tournament / competition prizes"], ["levelUp", "Level-up reward"],
                ["event", "Event reward"], ["manual", "Manual admin give-away"],
              ] as const).map(([key, label]) => {
                const on = (f.rewardTypes ?? {})[key] !== false;
                return (
                  <div key={key} className={cn("flex items-center justify-between gap-2 rounded-lg border border-line bg-ink-900/60 px-3 py-2", !f.enabled && "opacity-50")}>
                    <span className="text-sm text-mist-200">{label}</span>
                    <button onClick={() => set("rewardTypes", { ...(f.rewardTypes ?? {}), [key]: !on })} role="switch" aria-checked={on} disabled={!f.enabled}
                      className={cn("relative h-5 w-9 shrink-0 rounded-full transition", on ? "bg-emerald-500" : "bg-mist-600")}>
                      <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", on ? "left-[18px]" : "left-0.5")} />
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] text-mist-500">Each conversion is logged on the user&apos;s transaction with the reward type, original amount, your split %, {numName} credited, date and status.</p>
          </div>
          <Button className="mt-4" onClick={save} disabled={busy === "save"}>{busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save settings</Button>
        </Card>
      )}

      {/* Reports */}
      {loading ? (
        <div className="grid h-24 place-items-center text-mist-400"><Loader2 className="size-5 animate-spin" /></div>
      ) : report && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
            <Stat icon={Coins} label="Total gifted coins" value={num(report.totalGiftedCoins)} tone="text-gold-300" />
            <Stat icon={Flower2} label={`Total ${numName} generated`} value={num(report.totalLotusGenerated)} tone="text-lotus-300" />
            <Stat icon={Wallet} label={`${numName} held by users`} value={num(report.totalLotusOutstanding)} tone="text-sky-300" />
            <Stat icon={TrendingUp} label="Company revenue (gifts)" value={`${num(report.companyGiftRevenue)} coins`} tone="text-fuchsia-300" />
            <Stat icon={TrendingUp} label="Total paid out" value={`${report.withdrawals.currency} ${num(report.withdrawals.totalPaidCurrency)}`} tone="text-emerald-300" />
          </div>

          {/* 4-way distribution wallets + GST (Final Plan) */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={Flower2} label={`Company ${numName} revenue`} value={num(report.companyLotus)} tone="text-fuchsia-300" />
            <Stat icon={Users} label={`Agency ${numName} (all wallets)`} value={num(report.agencyLotusTotal)} tone="text-sky-300" />
            <Stat icon={Wallet} label={`Trust Wallet balance`} value={num(report.trustWallet)} tone="text-amber-300" />
            <Stat icon={TrendingUp} label="GST collected" value={`${report.withdrawals.currency} ${num(report.totalGstCollected)}`} tone="text-rose-300" />
          </div>

          {/* Trust Wallet ledger */}
          <Card className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-5 py-3">
              <h2 className="flex items-center gap-2 text-sm font-bold text-mist-100"><Wallet className="size-4 text-amber-300" /> Trust Wallet / Trust Fund</h2>
              <span className="text-xs text-mist-400">Balance: <b className="text-amber-200">{num(report.trustWallet)} {numName}</b> · funds reward campaigns, festival &amp; lucky-spin bonuses, referral programs, promotions</span>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {report.trustRecent.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-mist-500">No Trust Wallet activity yet.</p>
              ) : report.trustRecent.map((t) => (
                <div key={t.id} className="flex items-center gap-3 border-b border-white/5 px-5 py-2.5 last:border-0">
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold", t.type === "credit" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300")}>{t.type === "credit" ? "+" : "−"}{num(t.lotus)}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-mist-300"><b className="capitalize text-mist-200">{t.source.replace(/_/g, " ")}</b>{t.userName ? ` · ${t.userName}` : ""}{t.note ? ` · ${t.note}` : ""}</span>
                  <span className="shrink-0 text-[10px] text-mist-600">{new Date(t.at).toLocaleString("en-GB")}</span>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Bucket label="Pending" tone="bg-amber-500/15 text-amber-300" c={report.withdrawals.pending} name={numName} />
            <Bucket label="Approved" tone="bg-sky-500/15 text-sky-300" c={report.withdrawals.approved} name={numName} />
            <Bucket label="Completed" tone="bg-emerald-500/15 text-emerald-300" c={report.withdrawals.completed} name={numName} />
            <Bucket label="Rejected" tone="bg-rose-500/15 text-rose-300" c={report.withdrawals.rejected} name={numName} />
          </div>

          {/* Withdrawal requests */}
          <Card className="overflow-hidden p-0">
            <div className="border-b border-white/5 px-5 py-3"><h2 className="flex items-center gap-2 text-sm font-bold text-mist-100"><Wallet className="size-4 text-lotus-300" /> {numName} withdrawals</h2></div>
            <div className="max-h-[60vh] overflow-y-auto">
              {report.recent.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-mist-500">No {numName} withdrawals yet.</p>
              ) : report.recent.map((w) => (
                <div key={w.id} className="flex flex-wrap items-center gap-3 border-b border-white/5 px-5 py-3 last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-mist-100">{w.userName}</div>
                    <div className="truncate text-[11px] text-mist-500">{num(w.lotus ?? 0)} {numName} → {w.currency} {num(w.netAmount ?? w.amountINR)} · {w.method} · {w.details}</div>
                    <div className="text-[10px] text-mist-600">{new Date(w.at).toLocaleString("en-GB")}</div>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold capitalize", w.status === "pending" ? "bg-amber-500/15 text-amber-300" : w.status === "rejected" ? "bg-rose-500/15 text-rose-300" : w.status === "completed" ? "bg-emerald-500/15 text-emerald-300" : "bg-sky-500/15 text-sky-300")}>{w.status}</span>
                  {(w.status === "pending" || w.status === "approved") && (
                    <div className="flex shrink-0 gap-1.5">
                      {w.status === "pending" && <WBtn label="Approve" icon={Check} busy={busy === w.id + "approved"} onClick={() => decide(w, "approved")} />}
                      <WBtn label="Paid" icon={Check} tone="emerald" busy={busy === w.id + "completed"} onClick={() => decide(w, "completed")} />
                      {w.status === "pending" && <WBtn label="Reject" icon={X} tone="rose" busy={busy === w.id + "rejected"} onClick={() => decide(w, "rejected")} />}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Top earners — click a row to trace exactly how that Lotus was earned. */}
          <Card className="p-5">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-mist-100"><Users className="size-4 text-lotus-300" /> Top earners (user-wise {numName})</h2>
            <p className="mb-3 text-[11px] text-mist-500">Click a member to see exactly how their {numName} was earned (by source).</p>
            {report.topEarners.length === 0 ? (
              <p className="text-sm text-mist-500">No earnings yet.</p>
            ) : (
              <div className="space-y-1.5">
                {report.topEarners.map((u, i) => (
                  <button key={u.userId} onClick={() => openBreakdown(u.userId)} className="flex w-full items-center gap-3 rounded-lg border border-line bg-ink-800/50 px-3 py-2 text-left transition hover:border-lotus-400/40 hover:bg-lotus-500/[0.06]">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-lotus-500/15 text-[10px] font-bold text-lotus-200">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-mist-100">{u.name} {u.publicId && <span className="font-mono text-[10px] text-mist-500">{u.publicId}</span>}</span>
                    <span className="shrink-0 text-sm font-bold text-lotus-200 underline decoration-lotus-400/40 decoration-dotted underline-offset-2">{num(u.lotus)} {numName}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {/* Top-earner breakdown modal */}
      {(bd !== null || bdLoading) && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => { setBd(null); setBdLoading(false); }}>
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-ink-900 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {bdLoading ? <div className="grid h-32 place-items-center text-mist-500"><Loader2 className="size-6 animate-spin" /></div> : bd && !bd.found ? (
              <p className="py-8 text-center text-sm text-mist-400">Could not load this member&rsquo;s breakdown.</p>
            ) : bd && (
              <>
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Flower2 className="size-5 text-lotus-300" /> {bd.name}</h3>
                    <div className="text-xs text-mist-500">{bd.publicId} · how their {bd.lotusName} was earned</div>
                  </div>
                  <button onClick={() => setBd(null)} className="text-mist-500 hover:text-mist-200"><X className="size-5" /></button>
                </div>
                <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-xl border border-lotus-400/30 bg-lotus-500/[0.08] p-3"><div className="text-[10px] uppercase text-lotus-300/80">Current balance</div><div className="font-display text-lg font-extrabold text-lotus-200">{num(bd.balance)}</div></div>
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3"><div className="text-[10px] uppercase text-emerald-300/80">Lifetime earned</div><div className="font-display text-lg font-extrabold text-emerald-200">{num(bd.earned)}</div></div>
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-3"><div className="text-[10px] uppercase text-rose-300/80">Used / spent</div><div className="font-display text-lg font-extrabold text-rose-200">{num(bd.spent)}</div></div>
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3"><div className="text-[10px] uppercase text-amber-300/80">Withdrawn</div><div className="font-display text-lg font-extrabold text-amber-200">{num(bd.withdrawn ?? 0)}</div></div>
                </div>
                {bd.userId && (
                  <a href={withBase(`/admin/lotus/statement/${encodeURIComponent(bd.userId)}`)} className="mb-3 flex items-center justify-center gap-1.5 rounded-lg border border-lotus-400/30 bg-lotus-500/[0.06] px-3 py-2 text-xs font-bold text-lotus-200 transition hover:bg-lotus-500/[0.12]">
                    Open full statement &amp; export (CSV · Excel · PDF · Print) →
                  </a>
                )}
                <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-mist-500">Earned by source</div>
                {bd.bySource.length === 0 ? <p className="py-4 text-center text-sm text-mist-500">No {bd.lotusName} earnings recorded.</p> : (
                  <div className="space-y-1.5">
                    {bd.bySource.map((s) => {
                      const pct = bd.earned > 0 ? Math.round((s.amount / bd.earned) * 100) : 0;
                      return (
                        <div key={s.source} className="rounded-lg border border-line bg-ink-800/50 p-2.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-mist-100">{s.source} <span className="text-[10px] text-mist-500">×{s.count}</span></span>
                            <span className="font-bold text-lotus-200">{num(s.amount)} <span className="text-[10px] text-mist-500">{pct}%</span></span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-lotus-500/70" style={{ width: `${pct}%` }} /></div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {bd.recent.length > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-semibold text-mist-300">Recent earnings ({bd.recent.length})</summary>
                    <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                      {bd.recent.map((r, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2 rounded border border-line/60 px-2 py-1 text-[11px]">
                          <span className="min-w-0 flex-1 truncate text-mist-400" title={r.description}>{fmtDate(r.at)} · {r.source}</span>
                          <span className="shrink-0 font-semibold text-emerald-300">+{num(r.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                <p className="mt-3 text-[10px] text-mist-500">Lifetime earned can be higher than the current balance — the difference is what the member has spent or withdrawn.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-[11px] font-semibold text-mist-400">{label}</label>{children}</div>;
}
function Stat({ icon: Icon, label, value, tone }: { icon: typeof Coins; label: string; value: string; tone: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-xs text-mist-400"><Icon className={cn("size-3.5", tone)} /> {label}</div>
      <div className={cn("mt-1 font-display text-xl font-extrabold", tone)}>{value}</div>
    </Card>
  );
}
function Bucket({ label, tone, c, name }: { label: string; tone: string; c: { count: number; lotus: number }; name: string }) {
  return (
    <div className="rounded-xl border border-line bg-ink-800/50 p-3 text-center">
      <div className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold", tone)}><Clock className="size-2.5" /> {label}</div>
      <div className="mt-1.5 font-display text-lg font-extrabold text-mist-100">{c.count}</div>
      <div className="text-[10px] text-mist-500">{num(c.lotus)} {name}</div>
    </div>
  );
}
function WBtn({ label, icon: Icon, onClick, busy, tone }: { label: string; icon: typeof Check; onClick: () => void; busy?: boolean; tone?: "rose" | "emerald" }) {
  return (
    <button onClick={onClick} disabled={busy} className={cn("inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-50", tone === "rose" ? "bg-rose-500/10 text-rose-300 hover:bg-rose-500/20" : tone === "emerald" ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25" : "bg-sky-500/15 text-sky-300 hover:bg-sky-500/25")}>
      {busy ? <Loader2 className="size-3 animate-spin" /> : <Icon className="size-3" />} {label}
    </button>
  );
}
