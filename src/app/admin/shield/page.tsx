"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { ShieldCheck, Save, Info, Upload, Trash2, Loader2 } from "lucide-react";

type Anim = "none" | "pulse" | "spin" | "bounce";
type Speed = "slow" | "normal" | "fast";
type SH = { iconEnabled: boolean; glow: boolean; blink: boolean; particles: boolean; image: string; color: string; animationStyle: Anim; speed: Speed };

const ANIM_CLS: Record<Anim, string> = { none: "", pulse: "animate-pulse", spin: "animate-spin", bounce: "animate-bounce" };
const SPEED_SEC: Record<Speed, string> = { slow: "1.6s", normal: "1s", fast: "0.6s" };

export default function AdminShieldPage() {
  const { toast } = useToast();
  const { config, loading, reload } = useConfig();
  const [s, setS] = useState<SH>({ iconEnabled: true, glow: true, blink: false, particles: false, image: "", color: "#10b981", animationStyle: "pulse", speed: "normal" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (loading) return;
    const c = config.shield ?? {};
    setS({
      iconEnabled: c.iconEnabled !== false,
      glow: c.glow !== false,
      blink: c.blink === true,
      particles: c.particles === true,
      image: c.image ?? "",
      color: c.color || "#10b981",
      animationStyle: (["none", "pulse", "spin", "bounce"].includes(String(c.animationStyle)) ? c.animationStyle : "pulse") as Anim,
      speed: (["slow", "normal", "fast"].includes(String(c.speed)) ? c.speed : "normal") as Speed,
    });
  }, [loading, config]);

  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(withBase("/api/admin/tokens"), { method: "POST", credentials: "include", body: fd });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.url) { setS((x) => ({ ...x, image: d.url })); toast("Shield image uploaded", "success"); }
      else toast(d.error ?? "Upload failed", "error");
    } catch { toast("Upload failed", "error"); }
    setUploading(false);
  };

  const save = async () => {
    setSaving(true);
    const res = await saveConfig({ shield: s });
    setSaving(false);
    if (res.ok) { await reload(); toast("Shield settings saved — live for all games immediately.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const imgSrc = s.image ? (s.image.startsWith("http") || s.image.startsWith("/") ? s.image : withBase(s.image)) : "";

  const Toggle = ({ on, set, label, hint }: { on: boolean; set: (v: boolean) => void; label: string; hint?: string }) => (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-ink-900/50 p-2.5">
      <div className="min-w-0 flex-1"><div className="text-sm text-mist-100">{label}</div>{hint && <div className="text-[11px] text-mist-500">{hint}</div>}</div>
      <button onClick={() => set(!on)} role="switch" aria-checked={on} className={cn("relative h-6 w-11 shrink-0 rounded-full transition", on ? "bg-emerald-500" : "bg-white/10")}>
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition-all", on ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-24">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><ShieldCheck className="size-6 text-lotus-300" /> Shield Protection</h1>
        <p className="mt-1 text-sm text-mist-400">Customise the safe-zone shield shown when two same-colour coins stack on a normal box. Changes are <span className="font-semibold text-mist-200">live in every game instantly</span>.</p>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-sky-400/20 bg-sky-500/5 px-4 py-3 text-xs text-mist-400">
        <Info className="mt-0.5 size-4 shrink-0 text-sky-300" />
        <p>This page changes the shield&apos;s <b className="text-mist-200">appearance only</b>. The safe-zone RULE is fixed: the shield appears only when a same-colour pair sits on a <b className="text-mist-200">normal box</b> — never on home path / home column / start / safe boxes (those are already safe).</p>
      </div>

      {/* Live preview */}
      <Card className="flex items-center gap-5 p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-mist-500">Preview</div>
        <div className="relative grid size-16 place-items-center rounded-2xl bg-ink-800" style={s.glow ? { filter: `drop-shadow(0 0 10px ${s.color})` } : undefined}>
          <div className="size-10 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 ring-2 ring-white/40" />
          {s.iconEnabled && (
            <span
              className={cn("absolute -left-1 -top-1 grid size-6 place-items-center overflow-hidden rounded-full text-xs shadow-md ring-2 ring-white/70", ANIM_CLS[s.animationStyle], s.blink && "animate-pulse")}
              style={{ backgroundColor: imgSrc ? "transparent" : s.color, animationDuration: SPEED_SEC[s.speed] }}
            >
              {imgSrc
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={imgSrc} alt="shield" className="size-full object-cover" />
                : "🛡️"}
              {s.particles && <span className="absolute inset-0 animate-ping rounded-full" style={{ boxShadow: `0 0 6px 1px ${s.color}` }} />}
            </span>
          )}
        </div>
      </Card>

      {/* Toggles */}
      <Card className="space-y-2 p-5">
        <Toggle on={s.iconEnabled} set={(v) => setS((x) => ({ ...x, iconEnabled: v }))} label="Show shield icon" hint="The little shield badge on the protected coins." />
        <Toggle on={s.glow} set={(v) => setS((x) => ({ ...x, glow: v }))} label="Glow effect" hint="A coloured halo around the protected box." />
        <Toggle on={s.blink} set={(v) => setS((x) => ({ ...x, blink: v }))} label="Blinking effect" />
        <Toggle on={s.particles} set={(v) => setS((x) => ({ ...x, particles: v }))} label="Particle effect" hint="A pulsing sparkle around the shield." />
      </Card>

      {/* Appearance */}
      <Card className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-mist-300">Shield colour</label>
            <div className="mt-1 flex items-center gap-2">
              <input type="color" value={s.color} onChange={(e) => setS((x) => ({ ...x, color: e.target.value }))} className="h-9 w-12 cursor-pointer rounded border border-line bg-ink-900" />
              <input value={s.color} onChange={(e) => setS((x) => ({ ...x, color: e.target.value }))} className="h-9 flex-1 rounded-lg border border-line bg-ink-900 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-mist-300">Custom shield image (optional)</label>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
            <div className="mt-1 flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} {s.image ? "Replace" : "Upload"}
              </Button>
              {s.image && <Button size="sm" variant="secondary" onClick={() => setS((x) => ({ ...x, image: "" }))}><Trash2 className="size-4" /> Use default 🛡️</Button>}
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-mist-300">Animation style</label>
            <select value={s.animationStyle} onChange={(e) => setS((x) => ({ ...x, animationStyle: e.target.value as Anim }))} className="mt-1 h-10 w-full rounded-lg border border-line bg-ink-900 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400">
              <option value="none">None</option>
              <option value="pulse">Pulse</option>
              <option value="spin">Spin</option>
              <option value="bounce">Bounce</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-mist-300">Animation speed</label>
            <select value={s.speed} onChange={(e) => setS((x) => ({ ...x, speed: e.target.value as Speed }))} className="mt-1 h-10 w-full rounded-lg border border-line bg-ink-900 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400">
              <option value="slow">Slow</option>
              <option value="normal">Normal</option>
              <option value="fast">Fast</option>
            </select>
          </div>
        </div>
      </Card>

      <Button onClick={save} disabled={saving}><Save className="size-4" /> {saving ? "Saving…" : "Save shield settings"}</Button>
    </div>
  );
}
