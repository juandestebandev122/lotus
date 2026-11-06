"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { cn } from "@/lib/cn";
import { speakingFxWrap, SpeakingFxOverlay, SPEAKING_STYLES, type SpeakingStyle } from "@/lib/speaking-fx";
import { AudioLines, Check, Upload, Sparkles } from "lucide-react";

// A small always-"speaking" avatar so the admin sees each effect live.
function Preview({ style, color, speed, imageUrl, size = 56 }: { style: SpeakingStyle; color: string; speed: "slow" | "normal" | "fast"; imageUrl?: string; size?: number }) {
  const cfg = { enabled: true, style, color, speed, imageUrl };
  const fx = speakingFxWrap(cfg, true);
  return (
    <span className="relative grid place-items-center" style={{ width: size, height: size }}>
      <span className={cn("relative grid place-items-center rounded-full", fx.className)} style={fx.style}>
        <SpeakingFxOverlay cfg={cfg} speaking />
        <span className="grid place-items-center rounded-full bg-gradient-to-br from-lotus-500 to-petal-500 font-display font-bold text-white" style={{ width: size - 12, height: size - 12 }}>A</span>
      </span>
    </span>
  );
}

const COLOR_PRESETS = ["", "#7c5cfc", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#eab308"];

export default function SpeakingEffectsPage() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();
  const sf = config.speakingFx ?? {};
  const [enabled, setEnabled] = useState(sf.enabled !== false);
  const [style, setStyle] = useState<SpeakingStyle>((sf.style as SpeakingStyle) ?? "glow");
  const [color, setColor] = useState(sf.color ?? "");
  const [speed, setSpeed] = useState<"slow" | "normal" | "fast">(sf.speed ?? "normal");
  const [imageUrl, setImageUrl] = useState(sf.imageUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading) {
      const f = config.speakingFx ?? {};
      setEnabled(f.enabled !== false); setStyle((f.style as SpeakingStyle) ?? "glow"); setColor(f.color ?? ""); setSpeed(f.speed ?? "normal"); setImageUrl(f.imageUrl ?? "");
    }
  }, [loading, config]);

  const uploadCustom = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await fetch("/api/admin/upload-media", { method: "POST", credentials: "include", body: fd });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.url) { setImageUrl(d.url as string); setStyle("custom"); toast("Custom animation uploaded ✓ — press Save to apply.", "success"); }
      else toast(d.error ?? "Upload failed", "error");
    } catch { toast("Upload failed — please try again", "error"); }
    setUploading(false);
  };

  const save = async () => {
    setSaving(true);
    const res = await saveConfig({ speakingFx: { enabled, style, color, speed, imageUrl } });
    setSaving(false);
    if (res.ok) { await reload(); toast("Speaking effect saved — applies live in every voice room.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
          <AudioLines className="size-6 text-lotus-300" /> Speaking Effects
        </h1>
        <p className="text-sm text-mist-400">Choose the animation shown on a member&apos;s profile picture while they&apos;re talking in a voice room. Applies live to everyone — no app update needed. The default is a calm, steady glow (no flicker or jumping).</p>
      </div>

      {/* Master on/off + live preview of the CURRENT selection */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Preview style={enabled ? style : "none"} color={color} speed={speed} imageUrl={imageUrl} size={64} />
            <div>
              <h2 className="font-display text-lg font-bold text-mist-100">Speaking animation</h2>
              <p className="text-sm text-mist-400">{enabled ? <>Current: <b className="text-mist-200">{SPEAKING_STYLES.find((s) => s.key === style)?.label ?? style}</b></> : "Turned OFF — no effect while speaking."}</p>
            </div>
          </div>
          <button
            onClick={() => setEnabled((v) => !v)}
            role="switch" aria-checked={enabled}
            title={enabled ? "On — tap to turn off" : "Off — tap to turn on"}
            className={cn("relative h-6 w-11 shrink-0 rounded-full transition", enabled ? "bg-emerald-500" : "bg-mist-600")}
          >
            <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", enabled ? "left-[22px]" : "left-0.5")} />
          </button>
        </div>
      </Card>

      {/* Style picker with a LIVE preview per style */}
      <Card className={cn("p-5", !enabled && "pointer-events-none opacity-50")}>
        <h2 className="font-display text-base font-bold text-mist-100">Animation style</h2>
        <p className="mt-0.5 text-sm text-mist-400">Pick a built-in style — each preview is animating with your chosen colour &amp; speed.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {SPEAKING_STYLES.map((s) => (
            <button
              key={s.key}
              onClick={() => setStyle(s.key)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border p-3 transition",
                style === s.key ? "border-lotus-400 bg-lotus-500/10 ring-1 ring-lotus-400/40" : "border-line bg-ink-900 hover:border-white/20",
              )}
            >
              <div className="grid h-16 place-items-center">
                {s.key === "none" ? <span className="grid size-11 place-items-center rounded-full bg-gradient-to-br from-lotus-500 to-petal-500 font-display font-bold text-white">A</span> : <Preview style={s.key} color={color} speed={speed} imageUrl={imageUrl} />}
              </div>
              <span className="flex items-center gap-1 text-xs font-semibold text-mist-200">
                {style === s.key && <Check className="size-3.5 text-lotus-300" />}
                {s.n !== "—" && <span className="text-mist-500">{s.n}.</span>} {s.label}
              </span>
            </button>
          ))}
        </div>
      </Card>

      {/* Custom animation UPLOAD */}
      <Card className={cn("p-5", !enabled && "pointer-events-none opacity-50")}>
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-mist-100"><Sparkles className="size-4 text-lotus-300" /> Custom animation (upload your own)</h2>
        <p className="mt-0.5 text-sm text-mist-400">Upload your own animation (<b className="text-mist-200">GIF, PNG or WebP</b>) to show around a member&apos;s avatar while they speak. Use a <b className="text-mist-200">transparent-centre</b> animation so the face stays visible. Uploading a file sets the style to <b className="text-mist-200">Custom</b> — press <b className="text-mist-200">Save</b> to apply.</p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="grid size-24 place-items-center rounded-xl border border-line bg-ink-900">
            {imageUrl ? <Preview style="custom" color={color} speed={speed} imageUrl={imageUrl} size={72} /> : <span className="px-2 text-center text-[10px] text-mist-500">No custom animation yet</span>}
          </div>
          <div className="flex flex-col gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-ink-800 px-3 py-2 text-sm font-semibold text-mist-200 transition hover:border-lotus-400 hover:text-lotus-200">
              <Upload className="size-4" /> {uploading ? "Uploading…" : imageUrl ? "Replace animation" : "Upload animation"}
              <input type="file" accept="image/*,.gif" className="hidden" onChange={(e) => { uploadCustom(e.target.files?.[0]); e.currentTarget.value = ""; }} />
            </label>
            {imageUrl && (
              <div className="flex items-center gap-2">
                <button onClick={() => setStyle("custom")} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition", style === "custom" ? "bg-lotus-500/20 text-lotus-200 ring-1 ring-lotus-400/40" : "bg-white/5 text-mist-300 hover:text-mist-100")}>Use custom</button>
                <button onClick={() => { setImageUrl(""); if (style === "custom") setStyle("glow"); }} className="rounded-lg bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20">Remove</button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Colour + speed */}
      <Card className={cn("grid gap-5 p-5 sm:grid-cols-2", !enabled && "pointer-events-none opacity-50")}>
        <div>
          <h3 className="font-display text-base font-bold text-mist-100">Colour</h3>
          <p className="mt-0.5 text-sm text-mist-400">The glow / ring colour.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c || "default"}
                onClick={() => setColor(c)}
                title={c || "Theme violet (default)"}
                className={cn("size-8 rounded-full border-2 transition", (color || "") === c ? "border-white" : "border-transparent hover:border-white/40")}
                style={{ background: c || "#7c5cfc" }}
              >{!c && <span className="text-[9px] font-bold text-white/90">def</span>}</button>
            ))}
            <label className="ml-1 flex items-center gap-2 text-xs text-mist-400">
              Custom
              <input type="color" value={color || "#7c5cfc"} onChange={(e) => setColor(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-line bg-ink-800" />
            </label>
          </div>
        </div>
        <div>
          <h3 className="font-display text-base font-bold text-mist-100">Speed</h3>
          <p className="mt-0.5 text-sm text-mist-400">How fast the effect animates.</p>
          <div className="mt-3 flex gap-2">
            {(["slow", "normal", "fast"] as const).map((sp) => (
              <button
                key={sp}
                onClick={() => setSpeed(sp)}
                className={cn("flex-1 rounded-lg border px-3 py-2 text-sm font-semibold capitalize transition", speed === sp ? "border-lotus-400 bg-lotus-500/15 text-lotus-100" : "border-line bg-ink-900 text-mist-300 hover:border-white/20")}
              >{sp}</button>
            ))}
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-mist-500">Applies to every voice room instantly. Custom uploaded animations (GIF / PNG / WebP) are supported above; Lottie (JSON) is a later addition.</p>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save speaking effect"}</Button>
      </div>
    </div>
  );
}
