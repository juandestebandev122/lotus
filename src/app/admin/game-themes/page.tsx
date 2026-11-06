"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { GAME_THEME_PRESETS, resolveGameTheme, type GameThemeCfg } from "@/lib/gameThemes";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { Palette, Check, RotateCcw, Upload, Trash2, Music, Play, Pause, Volume2 } from "lucide-react";

type AudioItem = { id: string; name: string; src: string; kind: string };

export default function AdminGameThemesPage() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();
  const [t, setT] = useState<GameThemeCfg>({ preset: "default", bgColor: "#1e293b", bgImage: "", accent: "#7dd3fc", music: { enabled: false, track: "", volumePct: 40 } });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tracks, setTracks] = useState<AudioItem[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (loading) return;
    const g = config.gameTheme ?? {};
    setT({
      preset: g.preset ?? "default",
      bgColor: g.bgColor || "#1e293b",
      bgImage: g.bgImage ?? "",
      accent: g.accent || "#7dd3fc",
      music: { enabled: g.music?.enabled ?? false, track: g.music?.track ?? "", volumePct: g.music?.volumePct ?? 40 },
    });
  }, [loading, config]);

  // Load the admin media-library audio tracks to choose background music from.
  useEffect(() => {
    fetch(withBase("/api/media-library"), { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setTracks(((d?.items ?? []) as AudioItem[]).filter((i) => i.kind === "audio")))
      .catch(() => {});
    return () => { audioRef.current?.pause(); };
  }, []);

  const preview = resolveGameTheme(t);
  const music = t.music ?? {};

  const setMusic = (next: Partial<NonNullable<GameThemeCfg["music"]>>) => setT((p) => ({ ...p, music: { ...p.music, ...next } }));

  const upload = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(withBase("/api/admin/tokens"), { method: "POST", body: fd, credentials: "include" });
      const d = await res.json();
      if (res.ok && d.url) { setT((p) => ({ ...p, bgImage: d.url as string })); toast("Background image uploaded — press Save changes.", "success"); }
      else toast(d.error ?? "Upload failed", "error");
    } catch { toast("Upload failed", "error"); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const togglePreviewTrack = () => {
    const src = music.track ? (music.track.startsWith("http") || music.track.startsWith("/") ? music.track : withBase(music.track)) : "";
    if (!src) { toast("Pick a track first.", "info"); return; }
    let el = audioRef.current;
    if (!el) { el = new Audio(); audioRef.current = el; }
    if (previewing) { el.pause(); setPreviewing(false); return; }
    if (!el.src.endsWith(src)) el.src = src;
    el.volume = Math.max(0, Math.min(1, (music.volumePct ?? 40) / 100));
    el.play().then(() => setPreviewing(true)).catch(() => toast("Could not play this track.", "error"));
    el.onended = () => setPreviewing(false);
  };

  const save = async () => {
    setSaving(true);
    const res = await saveConfig({ gameTheme: t });
    setSaving(false);
    if (res.ok) { await reload(); toast("Theme saved — live for all players.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const resetAll = () => {
    setT({ preset: "default", bgColor: "#1e293b", bgImage: "", accent: "#7dd3fc", music: { enabled: false, track: "", volumePct: 40 } });
    toast("Reset to Classic Blue — press Save changes to apply.", "info");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-24">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
          <Palette className="size-6 text-lotus-300" /> Game Themes
        </h1>
        <p className="mt-1 text-sm text-mist-400">
          Set the Ludo game&apos;s <b>background</b> and <b>accent colour</b> — pick a ready-made theme (including
          festival ones), or build a <b>Custom</b> look and add a <b>background image</b> and <b>background music</b>.
          The player colours and the board never change; only the look around them. Live for all players after you save.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_theme(width.72)]">
        <div className="space-y-5">
          {/* Preset grid */}
          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 font-display text-lg font-bold text-mist-100">Choose a theme</h2>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {GAME_THEME_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setT((prev) => ({ ...prev, preset: p.id }))}
                  className={cn("relative overflow-hidden rounded-xl border p-3 text-left transition", t.preset === p.id ? "border-lotus-400 ring-2 ring-lotus-400/60" : "border-line hover:border-mist-500")}
                  style={{ background: p.bg }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg">{p.emoji}</span>
                    {t.preset === p.id && <Check className="size-4 text-white drop-shadow" />}
                  </div>
                  <div className="mt-6 text-xs font-bold text-white drop-shadow">{p.label}</div>
                  {p.seasonal && <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-wide text-white/70">Festival</span>}
                  <span className="absolute bottom-2 right-2 size-3 rounded-full ring-2 ring-white/50" style={{ background: p.accent }} />
                </button>
              ))}
              {/* Custom */}
              <button
                onClick={() => setT((prev) => ({ ...prev, preset: "custom" }))}
                className={cn("relative overflow-hidden rounded-xl border p-3 text-left transition", t.preset === "custom" ? "border-lotus-400 ring-2 ring-lotus-400/60" : "border-line hover:border-mist-500")}
                style={{ background: t.bgColor || "#1e293b" }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg">🎨</span>
                  {t.preset === "custom" && <Check className="size-4 text-white drop-shadow" />}
                </div>
                <div className="mt-6 text-xs font-bold text-white drop-shadow">Custom</div>
                <span className="absolute bottom-2 right-2 size-3 rounded-full ring-2 ring-white/50" style={{ background: t.accent || "#7dd3fc" }} />
              </button>
            </div>

            {/* Custom colour pickers */}
            {t.preset === "custom" && (
              <div className="mt-4 flex flex-wrap items-center gap-5 border-t border-line/60 pt-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-mist-200">
                  Background
                  <input type="color" value={(t.bgColor || "#1e293b").slice(0, 7)} onChange={(e) => setT((p) => ({ ...p, bgColor: e.target.value }))} className="size-9 cursor-pointer rounded border border-line bg-transparent" />
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-mist-200">
                  Accent
                  <input type="color" value={(t.accent || "#7dd3fc").slice(0, 7)} onChange={(e) => setT((p) => ({ ...p, accent: e.target.value }))} className="size-9 cursor-pointer rounded border border-line bg-transparent" />
                </label>
              </div>
            )}
          </Card>

          {/* Background image (any theme) */}
          <Card className="p-4 sm:p-5">
            <h2 className="font-display text-lg font-bold text-mist-100">Background image (optional)</h2>
            <p className="mt-0.5 text-sm text-mist-400">Shown faintly behind the board on any theme. Leave empty for none.</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="grid h-16 w-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-ink-800">
                {t.bgImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={withBase(t.bgImage)} alt="" className="size-full object-cover" />
                ) : <span className="text-xs text-mist-600">None</span>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
              <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <Upload className="size-4" /> {uploading ? "Uploading…" : t.bgImage ? "Change image" : "Upload image"}
              </Button>
              {t.bgImage && <Button variant="ghost" onClick={() => setT((p) => ({ ...p, bgImage: "" }))}><Trash2 className="size-4" /> Remove</Button>}
            </div>
          </Card>

          {/* Background music */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Music className="size-5 text-lotus-300" /> Background music</h2>
              <button
                onClick={() => setMusic({ enabled: !music.enabled })}
                role="switch"
                aria-checked={!!music.enabled}
                className={cn("relative h-6 w-11 shrink-0 rounded-full transition", music.enabled ? "bg-emerald-500" : "bg-mist-600")}
              >
                <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", music.enabled ? "left-[22px]" : "left-0.5")} />
              </button>
            </div>
            <p className="mt-0.5 text-sm text-mist-400">Loops quietly during the game. Tracks come from your <b>Media Library</b> (Admin → Media). Players can still mute their own sound.</p>
            {music.enabled && (
              <div className="mt-3 space-y-3">
                {tracks.length === 0 ? (
                  <p className="rounded-lg bg-ink-800 p-3 text-xs text-mist-400">No audio tracks in the Media Library yet. Add some in <b>Admin → Media</b>, then pick one here.</p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={music.track ?? ""}
                      onChange={(e) => setMusic({ track: e.target.value })}
                      className="h-10 min-w-48 flex-1 rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400"
                    >
                      <option value="">— Choose a track —</option>
                      {tracks.map((tr) => <option key={tr.id} value={tr.src}>{tr.name}</option>)}
                    </select>
                    <Button variant="secondary" onClick={togglePreviewTrack} disabled={!music.track}>
                      {previewing ? <><Pause className="size-4" /> Stop</> : <><Play className="size-4" /> Test</>}
                    </Button>
                  </div>
                )}
                <label className="block">
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 font-semibold text-mist-200"><Volume2 className="size-4" /> Volume</span>
                    <span className="font-mono text-xs text-lotus-300">{music.volumePct ?? 40}%</span>
                  </div>
                  <input type="range" min={0} max={100} value={music.volumePct ?? 40} onChange={(e) => setMusic({ volumePct: Number(e.target.value) })} className="h-2 w-full cursor-pointer appearance-none rounded-full bg-ink-700 accent-lotus-400" />
                </label>
              </div>
            )}
          </Card>

          <button onClick={resetAll} className="inline-flex items-center gap-1.5 text-sm font-semibold text-mist-400 transition hover:text-mist-100">
            <RotateCcw className="size-4" /> Reset to Classic Blue
          </button>
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card className="p-4">
            <h3 className="mb-2 text-center text-xs font-bold uppercase tracking-wide text-mist-400">Live preview</h3>
            <div className="relative mx-auto aspect-[3/4] w-full max-w-56 overflow-hidden rounded-xl" style={{ background: preview.bg }}>
              {preview.bgImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={withBase(preview.bgImage)} alt="" className="absolute inset-0 size-full object-cover opacity-20" />
              )}
              <div className="absolute inset-0 opacity-[0.16]" style={{ backgroundImage: `repeating-linear-gradient(45deg, ${preview.accent} 0 2px, transparent 2px 18px), repeating-linear-gradient(-45deg, ${preview.accent} 0 2px, transparent 2px 18px)` }} />
              <div className="relative grid h-full place-items-center p-4">
                <div className="grid size-28 grid-cols-3 grid-rows-3 overflow-hidden rounded-lg shadow-lg ring-1 ring-white/20">
                  <span style={{ background: "#ef4444" }} /><span className="bg-white" /><span style={{ background: "#16a34a" }} />
                  <span className="bg-white" /><span style={{ background: "conic-gradient(from 45deg,#16a34a 0 90deg,#facc15 90deg 180deg,#2563eb 180deg 270deg,#ef4444 270deg 360deg)" }} /><span className="bg-white" />
                  <span style={{ background: "#2563eb" }} /><span className="bg-white" /><span style={{ background: "#facc15" }} />
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink-900/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <span className="text-xs text-mist-400">Changes apply to every player after you save.</span>
          <Button onClick={save} disabled={saving}><Check className="size-4" /> {saving ? "Saving…" : "Save changes"}</Button>
        </div>
      </div>
    </div>
  );
}
