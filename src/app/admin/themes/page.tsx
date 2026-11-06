"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig, type AppConfig } from "@/lib/config";
import { cn } from "@/lib/cn";
import { DEFAULT_THEMES, type ThemePreset } from "@/lib/theme-presets";
import {
  buildAccentRamp, buildSecondaryRamp, buildSurfaceRamp, buildBodyBackground, surfaceLineColor,
  SHADES, PETAL_SHADES, SURFACE_SHADES,
} from "@/lib/theme-color";
import { Palette, Check, Eye, EyeOff, Copy, Trash2, Pencil, Plus, Download, Upload, RotateCcw, Loader2, X } from "lucide-react";

// Live-apply a theme's accent colours to the WHOLE document (used for preview). Passing
// "" removes the override so the app default shows. Mirrors ThemeColorInjector.
function applyAccent(primary?: string, secondary?: string) {
  const root = document.documentElement;
  const r1 = primary ? buildAccentRamp(primary) : null;
  if (r1) for (const s of SHADES) root.style.setProperty(`--color-lotus-${s}`, r1[s]);
  else for (const s of SHADES) root.style.removeProperty(`--color-lotus-${s}`);
  const r2 = secondary ? buildSecondaryRamp(secondary) : null;
  if (r2) for (const s of PETAL_SHADES) root.style.setProperty(`--color-petal-${s}`, r2[s]);
  else for (const s of PETAL_SHADES) root.style.removeProperty(`--color-petal-${s}`);
}

/** Live-apply a theme's SURFACES (panels, cards, canvas) — the part that decides
 *  how light or dark the app looks. Used for the instant preview. */
function applySurfaces(t: Partial<ThemePreset>, accent?: string, secondary?: string) {
  const root = document.documentElement;
  const body = document.body;
  const ramp = t.surface ? buildSurfaceRamp(t.surface, t.surfaceBrightness ?? 0) : null;
  if (ramp) {
    for (const s of SURFACE_SHADES) root.style.setProperty(`--color-ink-${s}`, ramp[s]);
    root.style.setProperty("--app-line", surfaceLineColor(t.surfaceBrightness ?? 0));
    body.style.setProperty("background", buildBodyBackground(ramp[900], t.glow ?? 100, accent, secondary));
    body.style.setProperty("background-attachment", "fixed");
  } else {
    for (const s of SURFACE_SHADES) root.style.removeProperty(`--color-ink-${s}`);
    root.style.removeProperty("--app-line");
    body.style.removeProperty("background");
    body.style.removeProperty("background-attachment");
  }
}

const BTN_SHAPES = ["sharp", "rounded", "pill"] as const;
const BUBBLE_SHAPES = ["sharp", "rounded", "round"] as const;
const emptyDraft = (): ThemePreset => ({ id: `th_${Math.random().toString(36).slice(2, 10)}`, name: "New theme", primary: "#7c5cfc", secondary: "#ec4899", buttonShape: "rounded", chatBubbleShape: "rounded", customCss: "" });

export default function AdminThemesPage() {
  const { config, reload } = useConfig();
  const { toast } = useToast();
  const [themes, setThemes] = useState<ThemePreset[]>([]);
  const [activeId, setActiveId] = useState("classic");
  const [allowSwitch, setAllowSwitch] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<ThemePreset | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setThemes(config.themes && config.themes.length ? config.themes : DEFAULT_THEMES);
    setActiveId(config.activeThemeId ?? "classic");
    setAllowSwitch(config.allowUserThemeSwitch === true);
  }, [config.themes, config.activeThemeId, config.allowUserThemeSwitch]);

  // Stop any live preview when leaving the page (restore the active look).
  useEffect(() => () => {
    applyAccent(config.themeColor, config.themeColor2);
    applySurfaces({ surface: config.themeSurface, surfaceBrightness: config.themeSurfaceBrightness, glow: config.themeGlow }, config.themeColor, config.themeColor2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.themeColor, config.themeColor2, config.themeSurface, config.themeSurfaceBrightness, config.themeGlow]);

  const persist = async (patch: Partial<AppConfig>, msg: string) => {
    setBusy("save");
    const res = await saveConfig(patch);
    setBusy(null);
    if (res.ok) { await reload(); toast(msg, "success"); } else toast(res.error ?? "Could not save", "error");
  };

  const activate = async (t: ThemePreset) => {
    stopPreview();
    await persist({
      activeThemeId: t.id,
      themeColor: t.primary || "", themeColor2: t.secondary || "",
      // The SURFACES travel with the theme, so activating one changes the whole
      // app's look — panels, cards, borders and the page background together.
      themeSurface: t.surface || "",
      themeSurfaceBrightness: t.surfaceBrightness ?? 0,
      themeGlow: t.glow ?? 100,
      themeBgImage: t.bgImage || "",
      uiStyle: { ...(config.uiStyle ?? {}), buttonShape: t.buttonShape, chatBubbleShape: t.chatBubbleShape },
      customCss: t.customCss || "",
    }, `“${t.name}” is now the live theme.`);
  };

  const saveThemeList = (next: ThemePreset[], msg: string) => persist({ themes: next }, msg);
  const duplicate = (t: ThemePreset) => {
    const copy: ThemePreset = { ...t, id: `th_${Math.random().toString(36).slice(2, 10)}`, name: `${t.name} copy`, builtin: false, createdAt: new Date().toISOString() };
    void saveThemeList([...themes, copy], "Theme duplicated");
  };
  const remove = (t: ThemePreset) => {
    if (t.builtin) { toast("Ready-made themes can't be deleted (duplicate to customise).", "info"); return; }
    if (!confirm(`Delete theme “${t.name}”?`)) return;
    void saveThemeList(themes.filter((x) => x.id !== t.id), "Theme deleted");
  };
  const saveEdit = () => {
    if (!editing) return;
    if (!editing.name.trim()) { toast("Give the theme a name", "error"); return; }
    const exists = themes.some((x) => x.id === editing.id);
    const next = exists ? themes.map((x) => (x.id === editing.id ? { ...editing, builtin: x.builtin } : x)) : [...themes, editing];
    void saveThemeList(next, exists ? "Theme updated" : "Theme created");
    setEditing(null);
  };

  // Preview now includes the SURFACES, so "Preview" really shows how light or
  // dark the whole app becomes — not just the accent colour.
  const startPreview = (t: ThemePreset) => {
    applyAccent(t.primary, t.secondary);
    applySurfaces(t, t.primary, t.secondary);
    setPreviewId(t.id);
  };
  const stopPreview = () => {
    applyAccent(config.themeColor, config.themeColor2);
    applySurfaces(
      { surface: config.themeSurface, surfaceBrightness: config.themeSurfaceBrightness, glow: config.themeGlow },
      config.themeColor, config.themeColor2,
    );
    setPreviewId(null);
  };

  const exportTheme = (t: ThemePreset) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(t, null, 2)], { type: "application/json" }));
    a.download = `theme-${t.name.replace(/\W+/g, "-").toLowerCase()}.json`; a.click();
  };
  const importTheme = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        const arr: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
        const imported: ThemePreset[] = arr.map((o) => ({ ...(o as ThemePreset), id: `th_${Math.random().toString(36).slice(2, 10)}`, builtin: false, name: `${(o as ThemePreset)?.name || "Imported"} (imported)`, createdAt: new Date().toISOString() }));
        if (!imported.length) throw new Error("empty");
        void saveThemeList([...themes, ...imported], `Imported ${imported.length} theme${imported.length === 1 ? "" : "s"}`);
      } catch { toast("That file isn't a valid theme export.", "error"); }
    };
    reader.readAsText(file);
  };

  const activeName = useMemo(() => themes.find((t) => t.id === activeId)?.name ?? "—", [themes, activeId]);

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><Palette className="size-6 text-lotus-300" /> Theme Management</h1>
          <p className="mt-1 text-sm text-mist-400">Switch the whole app&rsquo;s look from here — no code changes. Activating a theme changes only <b className="text-mist-200">appearance</b> (colours, button &amp; chat style, custom CSS); it never affects features, data or accounts. Live theme: <b className="text-lotus-300">{activeName}</b>.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { importTheme(e.target.files?.[0]); if (importRef.current) importRef.current.value = ""; }} />
          <Button variant="secondary" onClick={() => importRef.current?.click()}><Upload className="size-4" /> Import</Button>
          <Button onClick={() => setEditing(emptyDraft())}><Plus className="size-4" /> New theme</Button>
        </div>
      </div>

      {previewId && (
        <Card className="flex flex-wrap items-center justify-between gap-2 border-amber-400/40 bg-amber-500/10 p-3">
          <span className="text-sm font-semibold text-amber-200"><Eye className="mr-1 inline size-4" /> Previewing “{themes.find((t) => t.id === previewId)?.name}” — not saved yet.</span>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { const t = themes.find((x) => x.id === previewId); if (t) void activate(t); }}><Check className="size-3.5" /> Activate this</Button>
            <Button size="sm" variant="ghost" onClick={stopPreview}><EyeOff className="size-3.5" /> Stop preview</Button>
          </div>
        </Card>
      )}

      <label className="flex items-center gap-2 rounded-xl border border-line bg-ink-900 px-4 py-3 text-sm text-mist-300">
        <input type="checkbox" checked={allowSwitch} onChange={(e) => { setAllowSwitch(e.target.checked); void persist({ allowUserThemeSwitch: e.target.checked }, `User theme switching turned ${e.target.checked ? "on" : "off"}`); }} className="size-4 accent-lotus-500" />
        <b className="text-mist-100">Allow users to switch themes</b> — when on, members can pick from the available themes themselves (user-facing picker ships in Phase 2).
      </label>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((t) => {
          const isActive = t.id === activeId;
          return (
            <Card key={t.id} className={cn("overflow-hidden p-0", isActive && "ring-2 ring-lotus-400/60")}>
              {/* Swatch preview */}
              <div className="relative h-20" style={{ background: `linear-gradient(120deg, ${t.primary || "#7c5cfc"}, ${t.secondary || "#ec4899"})` }}>
                <div className="absolute inset-0 flex items-end justify-between p-2.5">
                  <span className={cn("rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-bold text-black", t.buttonShape === "pill" && "rounded-full", t.buttonShape === "sharp" && "rounded-none")}>Button</span>
                  {isActive && <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-emerald-300">● LIVE</span>}
                </div>
              </div>
              <div className="p-3">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-mist-100">{t.name}</span>
                  {t.builtin && <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] uppercase text-mist-400">ready-made</span>}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-mist-500">
                  <span className="inline-block size-3 rounded-full" style={{ background: t.primary || "#7c5cfc" }} />
                  <span className="inline-block size-3 rounded-full" style={{ background: t.secondary || "#ec4899" }} />
                  <span className="capitalize">{t.buttonShape} buttons</span>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {!isActive && <Button size="sm" onClick={() => activate(t)} disabled={busy === "save"}>{busy === "save" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Activate</Button>}
                  <Button size="sm" variant="ghost" onClick={() => (previewId === t.id ? stopPreview() : startPreview(t))}>{previewId === t.id ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />} Preview</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing({ ...t })}><Pencil className="size-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => duplicate(t)}><Copy className="size-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => exportTheme(t)}><Download className="size-3.5" /></Button>
                  {!t.builtin && <Button size="sm" variant="ghost" onClick={() => remove(t)}><Trash2 className="size-3.5 text-rose-300" /></Button>}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-2 p-4">
        <div className="text-sm text-mist-400">Reset the app to the original look at any time.</div>
        <Button variant="secondary" onClick={() => { const c = themes.find((t) => t.id === "classic") ?? DEFAULT_THEMES[0]; void activate(c); }}><RotateCcw className="size-4" /> Reset to default</Button>
      </Card>

      {/* Edit / create modal */}
      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setEditing(null)}>
          <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-ink-900 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between"><h3 className="font-display text-lg font-bold text-mist-100">{themes.some((x) => x.id === editing.id) ? "Edit theme" : "New theme"}</h3><button onClick={() => setEditing(null)} className="text-mist-500 hover:text-mist-200"><X className="size-5" /></button></div>
            <div className="space-y-3">
              <Field label="Name"><input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={inp} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <ColorField label="Primary colour" value={editing.primary || ""} onChange={(v) => setEditing({ ...editing, primary: v })} />
                <ColorField label="Secondary colour" value={editing.secondary || ""} onChange={(v) => setEditing({ ...editing, secondary: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Button shape"><select value={editing.buttonShape} onChange={(e) => setEditing({ ...editing, buttonShape: e.target.value as ThemePreset["buttonShape"] })} className={inp}>{BTN_SHAPES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}</select></Field>
                <Field label="Chat bubble shape"><select value={editing.chatBubbleShape} onChange={(e) => setEditing({ ...editing, chatBubbleShape: e.target.value as ThemePreset["chatBubbleShape"] })} className={inp}>{BUBBLE_SHAPES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}</select></Field>
              </div>
              {/* ---- SURFACES: how light or dark the whole app looks ---------- */}
              <div className="rounded-xl border border-lotus-400/25 bg-lotus-500/[0.05] p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-lotus-200">Background &amp; surfaces</p>
                <p className="mb-2 mt-0.5 text-[11px] text-mist-400">
                  This is what decides how dark the app feels. The colour tints every card, panel and the page itself;
                  the brightness slider lifts them from deep to light and airy.
                </p>
                <ColorField label="Surface colour (cards, panels, page)" value={editing.surface || ""} onChange={(v) => setEditing({ ...editing, surface: v })} />
                <div className="mt-2 space-y-2">
                  <Slider label="Brightness — how light the app looks" value={editing.surfaceBrightness ?? 0} min={0} max={100} suffix="%" onChange={(v) => setEditing({ ...editing, surfaceBrightness: v })} />
                  <Slider label="Background glow" value={editing.glow ?? 100} min={0} max={100} suffix="%" onChange={(v) => setEditing({ ...editing, glow: v })} />
                </div>
                {!editing.surface && <p className="mt-1.5 text-[11px] text-mist-500">No surface colour set — the app keeps its built-in dark violet.</p>}
              </div>

              <Field label="Custom CSS (advanced, optional)"><textarea value={editing.customCss || ""} onChange={(e) => setEditing({ ...editing, customCss: e.target.value })} rows={4} placeholder=":root { }" className={cn(inp, "font-mono text-xs")} /></Field>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                <Button variant="secondary" onClick={() => { applyAccent(editing.primary, editing.secondary); applySurfaces(editing, editing.primary, editing.secondary); setPreviewId(editing.id); }}><Eye className="size-4" /> Preview</Button>
                <Button onClick={saveEdit} disabled={busy === "save"}>{busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inp = "h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400/50";
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-300">{label}</span>{children}</label>;
}
function Slider({ label, value, min, max, suffix, onChange }: {
  label: string; value: number; min: number; max: number; suffix?: string; onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold text-mist-300">{label}</span>
        <span className="tabular-nums text-mist-400">{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-lotus-400" />
    </label>
  );
}
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-mist-300">{label}</div>
      <div className="flex items-center gap-2">
        <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#7c5cfc"} onChange={(e) => onChange(e.target.value)} className="size-10 shrink-0 cursor-pointer rounded-lg border border-line bg-ink-800" />
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="#hex or blank = default" className={inp} />
      </div>
    </div>
  );
}
