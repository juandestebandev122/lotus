"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { cn } from "@/lib/cn";
import { Clock, Check, Coins } from "lucide-react";

type AR = {
  enabled?: boolean; name?: string; requiredMinutes?: number; continuousCoins?: number; accumulatedCoins?: number;
  gapMinutes?: number; dailyLimit?: number; maxPerUser?: number; notifyTitle?: string; continuousMsg?: string; accumulatedMsg?: string;
};

export default function AdminActivityRewardPage() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();
  const [a, setA] = useState<AR>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!loading && config.activityReward) setA(config.activityReward as AR); }, [loading, config.activityReward]);

  const set = <K extends keyof AR>(k: K, v: AR[K]) => setA((p) => ({ ...p, [k]: v }));
  const save = async () => {
    setSaving(true);
    const res = await saveConfig({ activityReward: a });
    setSaving(false);
    if (res.ok) { await reload(); toast("Activity reward saved — live for all users.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const hours = Math.round(((a.requiredMinutes ?? 60) / 60) * 10) / 10;
  const prev = (t?: string, c?: number) => (t || "").replace(/\{coins\}/g, String(c ?? 0)).replace(/\{hours\}/g, String(hours));
  const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
    <label className="block"><span className="mb-1 block text-sm font-semibold text-mist-200">{label}</span>{children}{hint && <span className="mt-1 block text-[11px] text-mist-500">{hint}</span>}</label>
  );
  const inp = "h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400";

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-10">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><Clock className="size-6 text-lotus-300" /> Activity Reward (Startup Bonus)</h1>
        <p className="mt-1 text-sm text-mist-400">Reward users with coins for spending time in the app. Fully editable — nothing is hardcoded. Applies live to everyone; no app update needed.</p>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <span className={cn("grid size-11 place-items-center rounded-2xl", a.enabled ? "bg-emerald-500/15 text-emerald-300" : "bg-ink-800 text-mist-500")}><Coins className="size-5" /></span>
          <div><div className="text-sm font-bold text-mist-100">{a.name || "Startup Bonus"}</div><div className="text-xs text-mist-400">{a.enabled ? "ON — users earn coins for activity." : "OFF — no activity rewards are given."}</div></div>
        </div>
        <button onClick={() => set("enabled", !a.enabled)} role="switch" aria-checked={a.enabled === true} className={cn("relative h-6 w-11 shrink-0 rounded-full transition", a.enabled ? "bg-emerald-500" : "bg-mist-600")}><span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", a.enabled ? "left-[22px]" : "left-0.5")} /></button>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 font-display text-lg font-bold text-mist-100">Reward rules</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Reward name"><input value={a.name ?? ""} onChange={(e) => set("name", e.target.value)} className={inp} placeholder="Startup Bonus" /></Field>
          <Field label="Required activity per reward (minutes)" hint={`= ${hours} hour(s)`}><input type="number" min={1} value={a.requiredMinutes ?? 60} onChange={(e) => set("requiredMinutes", Number(e.target.value) || 60)} className={inp} /></Field>
          <Field label="Continuous reward (coins)" hint="Given when the required time is spent in one unbroken session."><input type="number" min={0} value={a.continuousCoins ?? 50} onChange={(e) => set("continuousCoins", Number(e.target.value) || 0)} className={inp} /></Field>
          <Field label="Accumulated reward (coins)" hint="Given when the time adds up across sessions (not continuous)."><input type="number" min={0} value={a.accumulatedCoins ?? 25} onChange={(e) => set("accumulatedCoins", Number(e.target.value) || 0)} className={inp} /></Field>
          <Field label="Continuous gap (minutes)" hint="A break longer than this ends the continuous run."><input type="number" min={1} value={a.gapMinutes ?? 3} onChange={(e) => set("gapMinutes", Number(e.target.value) || 3)} className={inp} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Daily limit / user" hint="0 = no limit"><input type="number" min={0} value={a.dailyLimit ?? 0} onChange={(e) => set("dailyLimit", Number(e.target.value) || 0)} className={inp} /></Field>
            <Field label="Max / user (lifetime)" hint="0 = no limit"><input type="number" min={0} value={a.maxPerUser ?? 0} onChange={(e) => set("maxPerUser", Number(e.target.value) || 0)} className={inp} /></Field>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 font-display text-lg font-bold text-mist-100">Notification</h2>
        <div className="space-y-4">
          <Field label="Title"><input value={a.notifyTitle ?? ""} onChange={(e) => set("notifyTitle", e.target.value)} className={inp} placeholder="Congratulations!" /></Field>
          <Field label="Continuous message" hint="Use {coins} and {hours} — they're replaced automatically."><input value={a.continuousMsg ?? ""} onChange={(e) => set("continuousMsg", e.target.value)} className={inp} placeholder="You earned {coins} coins for {hours} hour of continuous activity." /></Field>
          <Field label="Accumulated message" hint="Use {coins} and {hours}."><input value={a.accumulatedMsg ?? ""} onChange={(e) => set("accumulatedMsg", e.target.value)} className={inp} placeholder="You earned {coins} coins for {hours} hour of accumulated activity." /></Field>
          <div className="rounded-xl border border-line bg-ink-800/50 p-3 text-sm">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-mist-500">Preview</div>
            <div className="text-mist-200">🎁 {a.notifyTitle || "Congratulations!"} {prev(a.continuousMsg || "You earned {coins} coins for {hours} hour of continuous activity.", a.continuousCoins ?? 50)}</div>
            <div className="mt-1 text-mist-400">🎁 {a.notifyTitle || "Congratulations!"} {prev(a.accumulatedMsg || "You earned {coins} coins for {hours} hour of accumulated activity.", a.accumulatedCoins ?? 25)}</div>
          </div>
        </div>
      </Card>

      <div className="flex justify-end"><Button onClick={save} disabled={saving}><Check className="size-4" /> {saving ? "Saving…" : "Save changes"}</Button></div>
      <p className="text-center text-[11px] text-mist-600">Users&apos; total active time, rewards earned and bonus coins are tracked per account automatically. This bonus credits <b>coins</b> as specified.</p>
    </div>
  );
}
