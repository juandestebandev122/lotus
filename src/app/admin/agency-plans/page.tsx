"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { fetchAdminAgencyPlans, saveAgencyPlan, deleteAgencyPlan, type AgencyPlan } from "@/lib/agency";
import { Landmark, Plus, Pencil, Trash2, Power, Coins, Clock, X, Loader2 } from "lucide-react";

const PRESETS: { label: string; days: number }[] = [
  { label: "1 Month", days: 30 }, { label: "3 Months", days: 90 }, { label: "6 Months", days: 180 },
  { label: "1 Year", days: 365 }, { label: "2 Years", days: 730 },
];

export default function AgencyPlansPage() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<AgencyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AgencyPlan | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState("");

  const load = useCallback(() => fetchAdminAgencyPlans().then((p) => { setPlans(p); setLoading(false); }), []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (p: AgencyPlan) => {
    setBusy(p.id);
    const res = await saveAgencyPlan({ id: p.id, name: p.name, priceCoins: p.priceCoins, durationDays: p.durationDays, specificExpiry: p.specificExpiry, enabled: !p.enabled });
    setBusy("");
    if (res.ok) load(); else toast(res.error ?? "Failed", "error");
  };
  const remove = async (p: AgencyPlan) => {
    if (!confirm(`Delete the "${p.name}" plan?`)) return;
    setBusy(p.id);
    const res = await deleteAgencyPlan(p.id);
    setBusy("");
    if (res.ok) { toast("Plan deleted", "info"); load(); }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><Landmark className="size-6 text-lotus-300" /> Agency Membership Plans</h1>
          <p className="mt-0.5 text-sm text-mist-400">Create unlimited plans, set the coins required, and enable/disable or change prices anytime.</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="size-4" /> New plan</Button>
      </div>

      {loading ? (
        <div className="grid h-40 place-items-center text-mist-400"><Loader2 className="size-5 animate-spin" /></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {plans.map((p) => (
            <Card key={p.id} className={cn("p-4", !p.enabled && "opacity-60")}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-mist-100">{p.name}</h3>
                  <p className="mt-0.5 flex items-center gap-1 text-sm text-gold-300"><Coins className="size-4" /> {p.priceCoins.toLocaleString()} coins</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-mist-400"><Clock className="size-3.5" /> {p.specificExpiry ? `Until ${new Date(p.specificExpiry).toLocaleDateString("en-GB")}` : `${p.durationDays} days`}</p>
                </div>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", p.enabled ? "bg-emerald-500/15 text-emerald-300" : "bg-white/[0.06] text-mist-400")}>{p.enabled ? "Enabled" : "Disabled"}</span>
              </div>
              <div className="mt-3 flex gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => setEditing(p)}><Pencil className="size-3.5" /> Edit</Button>
                <Button size="sm" variant="secondary" onClick={() => toggle(p)} disabled={busy === p.id}><Power className="size-3.5" /> {p.enabled ? "Disable" : "Enable"}</Button>
                <Button size="sm" variant="ghost" className="!text-rose-300" onClick={() => remove(p)} disabled={busy === p.id}><Trash2 className="size-3.5" /></Button>
              </div>
            </Card>
          ))}
          {plans.length === 0 && <Card className="p-8 text-center text-sm text-mist-400 sm:col-span-2">No plans yet — tap “New plan”.</Card>}
        </div>
      )}

      {(creating || editing) && (
        <PlanModal plan={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => { setCreating(false); setEditing(null); load(); }} />
      )}
    </div>
  );
}

function PlanModal({ plan, onClose, onSaved }: { plan: AgencyPlan | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState(plan?.name ?? "");
  const [price, setPrice] = useState(plan?.priceCoins ?? 5000);
  const [mode, setMode] = useState<"duration" | "date">(plan?.specificExpiry ? "date" : "duration");
  const [days, setDays] = useState(plan?.durationDays || 30);
  const [expiry, setExpiry] = useState(plan?.specificExpiry ? plan.specificExpiry.slice(0, 10) : "");
  const [busy, setBusy] = useState(false);
  const field = "h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400";

  const save = async () => {
    if (!name.trim()) return toast("Enter a plan name", "error");
    if (mode === "date" && !expiry) return toast("Pick a fixed expiry date", "error");
    setBusy(true);
    const res = await saveAgencyPlan({ id: plan?.id, name: name.trim(), priceCoins: Number(price) || 0, durationDays: mode === "duration" ? Number(days) || 30 : 0, specificExpiry: mode === "date" ? new Date(expiry).toISOString() : undefined, enabled: plan?.enabled ?? true });
    setBusy(false);
    if (res.ok) { toast(plan ? "Plan updated" : "Plan created", "success"); onSaved(); } else toast(res.error ?? "Failed", "error");
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-md rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-mist-100">{plan ? "Edit plan" : "New plan"}</h2>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>
        <label className="text-xs font-semibold text-mist-300">Plan name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 1 Month / Pro 6 Months" className={cn(field, "mt-1")} maxLength={60} />
        <label className="mt-3 block text-xs font-semibold text-mist-300">Price (coins)</label>
        <input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} className={cn(field, "mt-1")} />

        <div className="mt-3 flex gap-2 rounded-xl bg-ink-800/70 p-1">
          {(["duration", "date"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={cn("flex-1 rounded-lg py-2 text-xs font-semibold transition", mode === m ? "bg-lotus-500/20 text-white" : "text-mist-400")}>{m === "duration" ? "Duration" : "Fixed expiry date"}</button>
          ))}
        </div>
        {mode === "duration" ? (
          <>
            <label className="mt-3 block text-xs font-semibold text-mist-300">Duration (days)</label>
            <input type="number" min={1} value={days} onChange={(e) => setDays(Number(e.target.value))} className={cn(field, "mt-1")} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PRESETS.map((p) => <button key={p.days} onClick={() => setDays(p.days)} className="rounded-full border border-line bg-ink-800 px-2.5 py-1 text-[11px] font-semibold text-mist-200 hover:bg-ink-700">{p.label}</button>)}
            </div>
          </>
        ) : (
          <>
            <label className="mt-3 block text-xs font-semibold text-mist-300">Fixed expiry date</label>
            <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className={cn(field, "mt-1")} />
          </>
        )}
        <Button block className="mt-5" onClick={save} disabled={busy}>{busy ? "Saving…" : plan ? "Save changes" : "Create plan"}</Button>
      </div>
    </div>
  );
}
