"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { cn } from "@/lib/cn";
import { Landmark, Plus, Trash2, ArrowUp, ArrowDown, Check, Power } from "lucide-react";

type Tier = { id: string; name: string; badge: string; color: string; minValue: number; perk?: string };
type Metric = "members" | "earnings";

const METRIC_LABEL: Record<Metric, string> = {
  members: "Number of members",
  // Agency.earnings accumulates LOTUS, not coins — since the Lotus economy
  // shipped, every reward pays Lotus and coins are purchase-only, so
  // Agency.totalCoins is 0 for every agency. Calling this "coins" made admins
  // set thresholds on the wrong scale.
  earnings: "Agency earnings (Lotus 🪷)",
};

const newId = () => `agl_${Math.random().toString(36).slice(2, 8)}`;

export default function AdminAgencyLevelsPage() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(true);
  const [metric, setMetric] = useState<Metric>("members");
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    const al = config.agencyLevels ?? {};
    setEnabled(al.enabled !== false);
    setMetric(al.metric === "earnings" ? "earnings" : "members"); // coerce legacy "coins" → members
    setTiers((al.tiers ?? []).map((t) => ({ ...t })));
  }, [loading, config]);

  const setTier = (i: number, patch: Partial<Tier>) => setTiers((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const removeTier = (i: number) => setTiers((ts) => ts.filter((_, j) => j !== i));
  const addTier = () => setTiers((ts) => [...ts, { id: newId(), name: "New Tier", badge: "🏅", color: "#a855f7", minValue: ts.length ? (ts[ts.length - 1].minValue + 10) : 0 }]);
  const move = (i: number, dir: -1 | 1) => setTiers((ts) => {
    const j = i + dir; if (j < 0 || j >= ts.length) return ts;
    const copy = [...ts]; [copy[i], copy[j]] = [copy[j], copy[i]]; return copy;
  });

  const save = async () => {
    // Keep tiers sorted by threshold so the ladder reads bottom→top.
    const clean = [...tiers].map((t) => ({ ...t, name: t.name.trim() || "Tier", minValue: Math.max(0, Math.floor(t.minValue || 0)) })).sort((a, b) => a.minValue - b.minValue);
    setSaving(true);
    const res = await saveConfig({ agencyLevels: { enabled, metric, tiers: clean } });
    setSaving(false);
    if (res.ok) { await reload(); toast("Agency levels saved — applied instantly.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-24">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
          <Landmark className="size-6 text-lotus-300" /> Agency Levels
        </h1>
        <p className="mt-1 text-sm text-mist-400">Create your own agency tiers (Bronze, Silver, Gold…) with a badge, colour and threshold. Every agency is automatically placed on the highest tier it qualifies for — or you can set a tier manually per agency in <b className="text-mist-300">Agencies → Edit</b>.</p>
      </div>

      {/* Master switch + metric */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <Power className="size-5 shrink-0 text-mist-400" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-mist-100">Use custom agency levels</div>
            <div className="text-xs text-mist-500">Off = the old numeric level (kept for compatibility).</div>
          </div>
          <button onClick={() => setEnabled((v) => !v)} role="switch" aria-checked={enabled} className={cn("relative h-6 w-11 shrink-0 rounded-full transition", enabled ? "bg-emerald-500" : "bg-mist-600")}>
            <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", enabled ? "left-[22px]" : "left-0.5")} />
          </button>
        </div>
        <div className={cn("mt-4 border-t border-line/60 pt-4", !enabled && "opacity-50")}>
          <label className="text-xs font-semibold text-mist-300">What decides an agency&apos;s level?</label>
          <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)} disabled={!enabled} className="mt-1 h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400">
            {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => <option key={m} value={m}>{METRIC_LABEL[m]}</option>)}
          </select>
          <p className="mt-1 text-[11px] text-mist-500">The agency reaches a tier once this value meets that tier&apos;s threshold. (Default: number of members — so levels are meaningful straight away.)</p>
        </div>
      </Card>

      {/* Tier ladder */}
      <Card className={cn("p-4 sm:p-5", !enabled && "opacity-60")}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-mist-100">Level tiers</h2>
          <Button size="sm" variant="secondary" onClick={addTier}><Plus className="size-4" /> Add tier</Button>
        </div>
        {tiers.length === 0 ? (
          <p className="py-8 text-center text-sm text-mist-500">No tiers yet — click <b className="text-mist-300">Add tier</b>.</p>
        ) : (
          <div className="space-y-2">
            {tiers.map((t, i) => (
              <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-ink-900/60 p-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg text-lg" style={{ background: `${t.color}22` }}>{t.badge || "🏅"}</span>
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <label className="flex flex-col">
                    <span className="text-[10px] text-mist-500">Name</span>
                    <input value={t.name} onChange={(e) => setTier(i, { name: e.target.value })} className="h-8 w-28 rounded-lg border border-line bg-ink-800 px-2 text-sm text-mist-100 outline-none focus:border-lotus-400" />
                  </label>
                  <label className="flex flex-col">
                    <span className="text-[10px] text-mist-500">Badge</span>
                    <input value={t.badge} onChange={(e) => setTier(i, { badge: e.target.value.slice(0, 4) })} className="h-8 w-14 rounded-lg border border-line bg-ink-800 px-2 text-center text-sm outline-none focus:border-lotus-400" />
                  </label>
                  <label className="flex flex-col">
                    <span className="text-[10px] text-mist-500">Colour</span>
                    <input type="color" value={t.color} onChange={(e) => setTier(i, { color: e.target.value })} className="h-8 w-12 cursor-pointer rounded-lg border border-line bg-ink-800" />
                  </label>
                  <label className="flex flex-col">
                    <span className="text-[10px] text-mist-500">Reach at ({metric === "members" ? "members" : "Lotus earned"})</span>
                    <input type="number" min={0} value={t.minValue} onChange={(e) => setTier(i, { minValue: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} className="h-8 w-24 rounded-lg border border-line bg-ink-800 px-2 text-sm text-mist-100 outline-none focus:border-lotus-400" />
                  </label>
                  <label className="flex flex-1 flex-col">
                    <span className="text-[10px] text-mist-500">Perk / note (optional)</span>
                    <input value={t.perk ?? ""} onChange={(e) => setTier(i, { perk: e.target.value })} placeholder="e.g. +5% commission" className="h-8 w-full min-w-32 rounded-lg border border-line bg-ink-800 px-2 text-sm text-mist-100 outline-none focus:border-lotus-400" />
                  </label>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="grid size-8 place-items-center rounded-lg text-mist-400 hover:bg-white/10 disabled:opacity-30"><ArrowUp className="size-4" /></button>
                  <button onClick={() => move(i, 1)} disabled={i === tiers.length - 1} className="grid size-8 place-items-center rounded-lg text-mist-400 hover:bg-white/10 disabled:opacity-30"><ArrowDown className="size-4" /></button>
                  <button onClick={() => removeTier(i)} className="grid size-8 place-items-center rounded-lg text-rose-300 hover:bg-rose-500/15"><Trash2 className="size-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-[11px] text-mist-500">Tiers are saved sorted by threshold (lowest first). An agency shows the highest tier whose threshold it meets.</p>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}><Check className="size-4" /> {saving ? "Saving…" : "Save agency levels"}</Button>
      </div>
    </div>
  );
}
