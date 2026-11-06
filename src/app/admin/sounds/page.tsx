"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { configureSounds, previewEffect, type SoundEffectKey, type SoundPack } from "@/lib/sound";
import {
  Volume2, Music, Save, Play, Upload, RotateCcw, Dice5, Footprints, Zap, Home as HomeIcon,
  Trophy, Frown, Timer, Bell, MousePointerClick, ExternalLink,
} from "lucide-react";

// The nine admin-controllable game sound effects.
const EFFECTS: { key: SoundEffectKey; icon: typeof Dice5; label: string; hint: string }[] = [
  { key: "diceRoll", icon: Dice5, label: "Dice Roll Sound", hint: "The clacks while the dice rolls" },
  { key: "tokenMove", icon: Footprints, label: "Token Move Sound", hint: "A soft tick for every step a coin takes" },
  { key: "capture", icon: Zap, label: "Token Kill Sound", hint: "The zap when a coin captures another" },
  { key: "home", icon: HomeIcon, label: "Home / Finish Sound", hint: "The chime when a coin reaches the centre" },
  { key: "win", icon: Trophy, label: "Winner Sound", hint: "The victory fanfare — only the winner hears it" },
  { key: "lose", icon: Frown, label: "Loser Sound", hint: "A gentle tone for the players who didn't win" },
  { key: "countdown", icon: Timer, label: "Countdown Sound", hint: "Ticks in the last 3 seconds of a player's turn" },
  { key: "notification", icon: Bell, label: "Notification Sound", hint: "The \"it's your turn\" ping" },
  { key: "click", icon: MousePointerClick, label: "Button Click Sound", hint: "The confirming pop when the dice lands" },
];

const PACKS: { key: SoundPack; label: string; desc: string }[] = [
  { key: "classic", label: "Classic", desc: "The original Lotus sounds" },
  { key: "modern", label: "Modern", desc: "Clean, soft, higher tones" },
  { key: "premium", label: "Premium", desc: "Rich, layered, fuller sound" },
  { key: "casino", label: "Casino Style", desc: "Bright, jackpot-like tones" },
  { key: "arcade", label: "Arcade Style", desc: "Fast retro 8-bit blips" },
  { key: "fantasy", label: "Fantasy Style", desc: "Deep, magical, long tones" },
  { key: "silent", label: "Silent Mode", desc: "Every game sound off" },
];

// The screens that can each have their own background music.
const SCREENS: { key: string; label: string; note?: string }[] = [
  { key: "home", label: "Home Screen" },
  { key: "lobby", label: "Games Lobby" },
  { key: "voiceRoom", label: "Voice Room", note: "Plays under the voices — keep the volume low" },
  { key: "ludo", label: "Ludo", note: "Replaces the Game-Theme track when set" },
  { key: "snake", label: "Snake & Ladder" },
  { key: "tournament", label: "Tournament pages" },
  { key: "waiting", label: "Waiting Room" },
  { key: "result", label: "Result Screen", note: "Takes over when a Ludo game ends" },
];

type FxState = Record<string, { enabled: boolean; url: string }>;
type ScreenState = Record<string, { enabled: boolean; url: string }>;

export default function AdminSoundsPage() {
  const { toast } = useToast();
  const { config, loading, reload } = useConfig();
  const [pack, setPack] = useState<SoundPack>("classic");
  const [fx, setFx] = useState<FxState>({});
  const [saving, setSaving] = useState(false);
  const [uploadingFx, setUploadingFx] = useState("");
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Background music state
  const [bmEnabled, setBmEnabled] = useState(false);
  const [bmVol, setBmVol] = useState(35);
  const [screens, setScreens] = useState<ScreenState>({});
  const [tracks, setTracks] = useState<{ src: string; name: string }[]>([]);
  const previewRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (loading) return;
    const gs = config.gameSound ?? {};
    setPack((gs.pack as SoundPack) ?? "classic");
    const f: FxState = {};
    for (const e of EFFECTS) {
      const cur = gs.effects?.[e.key] ?? {};
      f[e.key] = { enabled: cur.enabled !== false, url: cur.url ?? "" };
    }
    setFx(f);
    const bm = config.bgMusic ?? {};
    setBmEnabled(bm.enabled === true);
    setBmVol(bm.volumePct ?? 35);
    const s: ScreenState = {};
    for (const sc of SCREENS) {
      const cur = (bm.screens as Record<string, { enabled?: boolean; url?: string }> | undefined)?.[sc.key] ?? {};
      s[sc.key] = { enabled: cur.enabled === true, url: cur.url ?? "" };
    }
    setScreens(s);
  }, [loading, config]);

  // Audio tracks from the Media Library for the per-screen selectors.
  useEffect(() => {
    fetch(withBase("/api/media-library"), { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setTracks(((d.items ?? []) as { kind: string; src: string; name: string }[]).filter((i) => i.kind === "audio").map((i) => ({ src: i.src, name: i.name }))))
      .catch(() => {});
  }, []);

  const save = async (nextPack = pack, nextFx = fx, nextBm?: { enabled: boolean; vol: number; screens: ScreenState }) => {
    setSaving(true);
    const b = nextBm ?? { enabled: bmEnabled, vol: bmVol, screens };
    const res = await saveConfig({
      gameSound: { pack: nextPack, effects: Object.fromEntries(Object.entries(nextFx).map(([k, v]) => [k, { enabled: v.enabled, url: v.url }])) },
      bgMusic: { enabled: b.enabled, volumePct: b.vol, screens: Object.fromEntries(Object.entries(b.screens).map(([k, v]) => [k, { enabled: v.enabled, url: v.url }])) },
    });
    setSaving(false);
    if (res.ok) { setPack(nextPack); setFx(nextFx); await reload(); toast("Sound settings saved — live for everyone.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const preview = (key: SoundEffectKey) => {
    // Hear it exactly as players will: current pack + custom file when set.
    configureSounds({ pack, effects: {} });
    previewEffect(key, fx[key]?.url || undefined);
  };

  const uploadFx = async (key: SoundEffectKey, file: File | undefined) => {
    if (!file) return;
    setUploadingFx(key);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("effect", key);
    const res = await fetch(withBase("/api/admin/sounds"), { method: "POST", credentials: "include", body: fd });
    const d = await res.json().catch(() => ({}));
    setUploadingFx("");
    if (res.ok && d.url) {
      setFx((f) => ({ ...f, [key]: { ...f[key], url: d.url } }));
      toast("Custom sound uploaded — press Save to make it live.", "success");
    } else toast(d.error ?? "Upload failed", "error");
  };

  const previewTrack = (url: string) => {
    if (!url) return;
    if (!previewRef.current) previewRef.current = new Audio();
    const el = previewRef.current;
    if (el.paused || !el.src.includes(url)) { el.src = withBase(url); el.volume = Math.max(0, Math.min(1, bmVol / 100)); void el.play().catch(() => {}); }
    else el.pause();
  };
  useEffect(() => () => { previewRef.current?.pause(); }, []);

  const field = "h-9 rounded-lg border border-line bg-ink-800 px-2 text-sm text-mist-100 outline-none focus:border-lotus-400";

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><Volume2 className="size-6 text-lotus-300" /> Sound &amp; Music</h1>
        <p className="mt-1 text-sm text-mist-400">
          Every game sound has its own ON/OFF switch, can be replaced with your own uploaded sound, and the whole set can
          switch between sound packs. Changes apply instantly to all players — no app update. Players can still mute their own device.
        </p>
      </div>

      {/* Sound packs */}
      <Card className="space-y-3 p-5">
        <h2 className="font-display text-lg font-bold text-mist-100">Sound pack</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PACKS.map((p) => (
            <button
              key={p.key}
              onClick={() => { setPack(p.key); if (p.key !== "silent") { configureSounds({ pack: p.key, effects: {} }); previewEffect("win"); } }}
              className={cn("rounded-xl border p-3 text-left transition", pack === p.key ? "border-lotus-400 bg-lotus-500/10" : "border-line bg-ink-900 hover:bg-white/[0.04]")}
            >
              <div className="text-sm font-bold text-mist-100">{p.label}</div>
              <div className="mt-0.5 text-[11px] text-mist-500">{p.desc}</div>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-mist-500">Tapping a pack plays a preview. Custom uploaded sounds always play as uploaded, whatever the pack.</p>
      </Card>

      {/* Per-effect switches + custom sounds */}
      <Card className="p-0">
        <div className="border-b border-white/5 px-5 py-4">
          <h2 className="font-display text-lg font-bold text-mist-100">Game sound effects</h2>
          <p className="mt-0.5 text-xs text-mist-500">Turn each sound on/off, hear it, upload your own (MP3, WAV, OGG — max 10 MB), or restore the built-in sound.</p>
        </div>
        <div className="divide-y divide-white/5">
          {EFFECTS.map((e) => {
            const st = fx[e.key] ?? { enabled: true, url: "" };
            return (
              <div key={e.key} className="flex flex-wrap items-center gap-2.5 px-5 py-3">
                <e.icon className="size-4 shrink-0 text-lotus-300" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-mist-100">{e.label}</p>
                  <p className="text-[11px] text-mist-500">{e.hint}{st.url && <span className="ml-1.5 rounded-full bg-lotus-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-lotus-300">custom sound</span>}</p>
                </div>
                <button onClick={() => preview(e.key)} className="grid size-8 place-items-center rounded-lg bg-white/[0.05] text-mist-300 transition hover:bg-white/10 hover:text-lotus-200" title="Preview">
                  <Play className="size-4" />
                </button>
                <input ref={(el) => { fileRefs.current[e.key] = el; }} type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a" className="hidden" onChange={(ev) => { void uploadFx(e.key, ev.target.files?.[0]); ev.target.value = ""; }} />
                <button onClick={() => fileRefs.current[e.key]?.click()} disabled={uploadingFx === e.key} className="grid size-8 place-items-center rounded-lg bg-white/[0.05] text-mist-300 transition hover:bg-white/10 hover:text-lotus-200 disabled:opacity-50" title="Upload a custom sound">
                  <Upload className="size-4" />
                </button>
                {st.url && (
                  <button onClick={() => setFx((f) => ({ ...f, [e.key]: { ...f[e.key], url: "" } }))} className="grid size-8 place-items-center rounded-lg bg-white/[0.05] text-mist-300 transition hover:bg-white/10 hover:text-amber-300" title="Restore the built-in sound">
                    <RotateCcw className="size-4" />
                  </button>
                )}
                <button
                  onClick={() => setFx((f) => ({ ...f, [e.key]: { ...f[e.key], enabled: !st.enabled } }))}
                  className={cn("relative h-6 w-11 shrink-0 rounded-full transition", st.enabled ? "bg-emerald-500" : "bg-white/10")}
                  aria-pressed={st.enabled}
                >
                  <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition-all", st.enabled ? "left-[22px]" : "left-0.5")} />
                </button>
              </div>
            );
          })}
        </div>
        <div className="border-t border-white/5 px-5 py-4">
          <Button onClick={() => save()} disabled={saving}><Save className="size-4" /> {saving ? "Saving…" : "Save sound settings"}</Button>
        </div>
      </Card>

      {/* Background music per screen */}
      <Card className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Music className="size-5 text-lotus-300" /> Background music</h2>
            <p className="mt-0.5 text-xs text-mist-500">
              A different track for every screen. Tracks come from your <Link href="/admin/media" className="font-semibold text-lotus-300 hover:underline">Media Library <ExternalLink className="inline size-3" /></Link> (upload music there first).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-mist-300">
              Volume
              <input type="range" min={0} max={100} value={bmVol} onChange={(e) => setBmVol(Number(e.target.value))} className="w-28 accent-lotus-500" />
              <span className="w-8 tabular-nums">{bmVol}%</span>
            </label>
            <button
              onClick={() => setBmEnabled((v) => !v)}
              className={cn("relative h-6 w-11 shrink-0 rounded-full transition", bmEnabled ? "bg-emerald-500" : "bg-white/10")}
              aria-pressed={bmEnabled}
              title={bmEnabled ? "Turn background music off" : "Turn background music on"}
            >
              <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition-all", bmEnabled ? "left-[22px]" : "left-0.5")} />
            </button>
          </div>
        </div>
        <div className="divide-y divide-white/5">
          {SCREENS.map((sc) => {
            const st = screens[sc.key] ?? { enabled: false, url: "" };
            return (
              <div key={sc.key} className="flex flex-wrap items-center gap-2.5 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-mist-100">{sc.label}</p>
                  {sc.note && <p className="text-[11px] text-mist-500">{sc.note}</p>}
                </div>
                <select
                  value={st.url}
                  onChange={(e) => setScreens((s) => ({ ...s, [sc.key]: { ...st, url: e.target.value } }))}
                  className={cn(field, "w-48")}
                >
                  <option value="">— no track —</option>
                  {tracks.map((t) => <option key={t.src} value={t.src}>{t.name}</option>)}
                </select>
                <button onClick={() => previewTrack(st.url)} disabled={!st.url} className="grid size-8 place-items-center rounded-lg bg-white/[0.05] text-mist-300 transition hover:bg-white/10 hover:text-lotus-200 disabled:opacity-40" title="Preview / stop">
                  <Play className="size-4" />
                </button>
                <button
                  onClick={() => setScreens((s) => ({ ...s, [sc.key]: { ...st, enabled: !st.enabled } }))}
                  className={cn("relative h-6 w-11 shrink-0 rounded-full transition", st.enabled ? "bg-emerald-500" : "bg-white/10")}
                  aria-pressed={st.enabled}
                >
                  <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition-all", st.enabled ? "left-[22px]" : "left-0.5")} />
                </button>
              </div>
            );
          })}
        </div>
        <div className="border-t border-white/5 px-5 py-4">
          <Button onClick={() => save()} disabled={saving}><Save className="size-4" /> {saving ? "Saving…" : "Save music settings"}</Button>
        </div>
      </Card>
    </div>
  );
}
