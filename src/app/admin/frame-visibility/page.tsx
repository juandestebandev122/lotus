"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { cn } from "@/lib/cn";
import { FRAME_MODULES, type ModuleFrameSetting, type ModuleFramesConfig } from "@/lib/module-frames";
import { Eye, EyeOff, Sparkles, Award, ShieldCheck, Info } from "lucide-react";

// Admin control: for EVERY module, decide whether purchased FRAMES and profile
// BADGES are Visible/Hidden and Required/Optional. Saved to config.moduleFrames;
// applies live across the app (no rebuild). Default (untouched) = Visible +
// Optional everywhere, i.e. exactly today's behaviour.
export default function FrameVisibilityPage() {
  const { config, reload } = useConfig();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  // Local working copy so the four switches per row feel instant; saved as one
  // complete moduleFrames object (never a partial — a nested field must always
  // be sent whole so the sanitizer/merge keeps every module).
  const [draft, setDraft] = useState<ModuleFramesConfig>(() => ({ ...(config.moduleFrames ?? {}) }));
  const [dirty, setDirty] = useState(false);

  const get = (key: string): ModuleFrameSetting => draft[key] ?? {};
  const framesVisible = (key: string) => get(key).framesVisible !== false;
  const framesRequired = (key: string) => get(key).framesRequired === true;
  const badgesVisible = (key: string) => get(key).badgesVisible !== false;
  const badgesRequired = (key: string) => get(key).badgesRequired === true;

  const setField = (key: string, patch: Partial<ModuleFrameSetting>) => {
    setDraft((d) => {
      const cur: ModuleFrameSetting = { ...(d[key] ?? {}) };
      const next: ModuleFrameSetting = { ...cur, ...patch };
      // "Required" forces "Visible" ON (a required item can never be hidden).
      if (next.framesRequired) next.framesVisible = true;
      if (next.badgesRequired) next.badgesVisible = true;
      return { ...d, [key]: next };
    });
    setDirty(true);
  };

  const save = async () => {
    setBusy(true);
    // Send the FULL object (nested config field) so nothing is dropped.
    const res = await saveConfig({ moduleFrames: draft });
    setBusy(false);
    if (res.ok) { await reload(); setDirty(false); toast("Frame & badge visibility saved — live now.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  // Bulk helpers so the client can set everything in one tap.
  const applyAll = (patch: Partial<ModuleFrameSetting>) => {
    setDraft((d) => {
      const next: ModuleFramesConfig = { ...d };
      for (const m of FRAME_MODULES) {
        const cur: ModuleFrameSetting = { ...(next[m.key] ?? {}), ...patch };
        if (cur.framesRequired) cur.framesVisible = true;
        if (cur.badgesRequired) cur.badgesVisible = true;
        next[m.key] = cur;
      }
      return next;
    });
    setDirty(true);
  };

  const summary = useMemo(() => {
    let fv = 0, bv = 0, fr = 0, br = 0;
    for (const m of FRAME_MODULES) {
      if (framesVisible(m.key)) fv++;
      if (badgesVisible(m.key)) bv++;
      if (framesRequired(m.key)) fr++;
      if (badgesRequired(m.key)) br++;
    }
    return { fv, bv, fr, br, total: FRAME_MODULES.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const Pill = ({ on, onLabel, offLabel, onIcon: OnIcon, offIcon: OffIcon, onClick, tone = "emerald" }: { on: boolean; onLabel: string; offLabel: string; onIcon: typeof Eye; offIcon: typeof Eye; onClick: () => void; tone?: "emerald" | "amber" }) => (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex w-[104px] items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-bold transition",
        on
          ? tone === "amber" ? "bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/40" : "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/40"
          : "bg-ink-800 text-mist-400 ring-1 ring-white/10 hover:text-mist-200",
      )}
    >
      {on ? <OnIcon className="size-3.5" /> : <OffIcon className="size-3.5" />}
      {on ? onLabel : offLabel}
    </button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><Eye className="size-6 text-lotus-300" /> Frames &amp; Badges Visibility</h1>
        <p className="text-sm text-mist-400">For every part of the app, choose whether purchased profile <b className="text-mist-200">Frames</b> and <b className="text-mist-200">Badges</b> are shown, and whether they are Required (always shown) or Optional. Changes apply instantly — no update needed.</p>
      </div>

      <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
        <span className="flex items-center gap-1.5 text-mist-300"><Sparkles className="size-4 text-lotus-300" /> Frames visible in <b className="text-mist-100">{summary.fv}/{summary.total}</b> · required in <b className="text-mist-100">{summary.fr}</b></span>
        <span className="flex items-center gap-1.5 text-mist-300"><Award className="size-4 text-gold-300" /> Badges visible in <b className="text-mist-100">{summary.bv}/{summary.total}</b> · required in <b className="text-mist-100">{summary.br}</b></span>
      </Card>

      {/* Bulk actions */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => applyAll({ framesVisible: true, badgesVisible: true })} className="rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-200 ring-1 ring-emerald-400/30 transition hover:bg-emerald-500/25">Show all frames &amp; badges</button>
        <button onClick={() => applyAll({ framesVisible: false, framesRequired: false, badgesVisible: false, badgesRequired: false })} className="rounded-lg bg-rose-500/15 px-3 py-2 text-xs font-bold text-rose-200 ring-1 ring-rose-400/30 transition hover:bg-rose-500/25">Hide all frames &amp; badges</button>
        <button onClick={() => applyAll({ framesRequired: false, badgesRequired: false })} className="rounded-lg bg-ink-800 px-3 py-2 text-xs font-bold text-mist-300 ring-1 ring-white/10 transition hover:text-mist-100">Make all Optional</button>
      </div>

      <Card className="overflow-x-auto p-0">
        {/* Header */}
        <div className="grid min-w-[640px] grid-cols-[1.4fr_1fr_1fr_1fr_1fr] items-center gap-2 border-b border-white/10 px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-mist-500">
          <span>Module</span>
          <span className="flex items-center gap-1"><Sparkles className="size-3.5 text-lotus-300" /> Frame</span>
          <span>Frame policy</span>
          <span className="flex items-center gap-1"><Award className="size-3.5 text-gold-300" /> Badge</span>
          <span>Badge policy</span>
        </div>
        <div className="min-w-[640px] divide-y divide-white/5">
          {FRAME_MODULES.map((m) => (
            <div key={m.key} className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr] items-center gap-2 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-mist-100">{m.label}</p>
                {!m.live && <p className="text-[10px] text-mist-500">applies when this screen shows frames</p>}
              </div>
              <Pill on={framesVisible(m.key)} onLabel="Visible" offLabel="Hidden" onIcon={Eye} offIcon={EyeOff} onClick={() => setField(m.key, { framesVisible: !framesVisible(m.key), ...(framesVisible(m.key) ? { framesRequired: false } : {}) })} />
              <Pill on={framesRequired(m.key)} onLabel="Required" offLabel="Optional" onIcon={ShieldCheck} offIcon={ShieldCheck} tone="amber" onClick={() => setField(m.key, { framesRequired: !framesRequired(m.key) })} />
              <Pill on={badgesVisible(m.key)} onLabel="Visible" offLabel="Hidden" onIcon={Eye} offIcon={EyeOff} onClick={() => setField(m.key, { badgesVisible: !badgesVisible(m.key), ...(badgesVisible(m.key) ? { badgesRequired: false } : {}) })} />
              <Pill on={badgesRequired(m.key)} onLabel="Required" offLabel="Optional" onIcon={ShieldCheck} offIcon={ShieldCheck} tone="amber" onClick={() => setField(m.key, { badgesRequired: !badgesRequired(m.key) })} />
            </div>
          ))}
        </div>
      </Card>

      <p className="flex items-start gap-1.5 text-xs text-mist-500">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span><b className="text-mist-300">Required</b> means the item is always shown in that module and its Visible switch is locked ON. <b className="text-mist-300">Optional</b> means the Visible / Hidden switch decides. Hiding a module never deletes anyone&apos;s purchased frame — it just isn&apos;t drawn there.</span>
      </p>

      {/* Sticky save bar */}
      <div className="sticky bottom-4 flex justify-end">
        <button
          onClick={save}
          disabled={busy || !dirty}
          className={cn("rounded-xl px-6 py-3 text-sm font-bold shadow-lg transition", dirty && !busy ? "bg-lotus-500 text-white hover:bg-lotus-400" : "bg-ink-800 text-mist-500")}
        >
          {busy ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </button>
      </div>
    </div>
  );
}
