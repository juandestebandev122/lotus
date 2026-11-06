"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { buildAccentRamp, buildSecondaryRamp, SHADES, PETAL_SHADES } from "@/lib/theme-color";
import { applyUiStyle, type UiStyle } from "@/lib/ui-style";
import { NAV_ITEMS } from "@/components/app-shell/nav-items";
import { cn } from "@/lib/cn";
import { Palette, Check, RotateCcw, Eye, MousePointerClick, Menu as MenuIcon, GripVertical, EyeOff, Code2, Download, Upload, AlertTriangle } from "lucide-react";

const DEFAULT_ACCENT = "#7c5cfc";
const DEFAULT_SECONDARY = "#ec4899";
const PRESETS = [
  { name: "Violet (default)", hex: "#7c5cfc" }, { name: "Royal blue", hex: "#3b82f6" }, { name: "Emerald", hex: "#10b981" },
  { name: "Rose", hex: "#f43f5e" }, { name: "Amber", hex: "#f59e0b" }, { name: "Fuchsia", hex: "#d946ef" },
  { name: "Cyan", hex: "#06b6d4" }, { name: "Orange", hex: "#f97316" }, { name: "Teal", hex: "#14b8a6" }, { name: "Indigo", hex: "#6366f1" },
];

// Apply an accent ramp to the live document (preview). Pass "" to clear overrides.
function applyLive(hex: string) {
  const root = document.documentElement;
  const ramp = hex ? buildAccentRamp(hex) : null;
  if (ramp) for (const s of SHADES) root.style.setProperty(`--color-lotus-${s}`, ramp[s]);
  else for (const s of SHADES) root.style.removeProperty(`--color-lotus-${s}`);
}
// Apply the SECONDARY (petal) ramp live. Pass "" to clear overrides → built-in pink.
function applySecondaryLive(hex: string) {
  const root = document.documentElement;
  const ramp = hex ? buildSecondaryRamp(hex) : null;
  if (ramp) for (const s of PETAL_SHADES) root.style.setProperty(`--color-petal-${s}`, ramp[s]);
  else for (const s of PETAL_SHADES) root.style.removeProperty(`--color-petal-${s}`);
}

// A small segmented-control for choosing one of a few string options.
function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-line">
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} className={cn("px-3 py-1.5 text-xs font-semibold transition", value === o.v ? "bg-lotus-500/25 text-white" : "bg-ink-800 text-mist-400 hover:text-mist-100")}>{o.label}</button>
      ))}
    </div>
  );
}

type MenuRow = { href: string; label: string; icon: (typeof NAV_ITEMS)[number]["icon"]; hidden: boolean };

export default function AdminAppearancePage() {
  const { toast } = useToast();
  const { config, loading, reload } = useConfig();

  // ---- Accent colour ----
  const saved = (config.themeColor ?? "").trim();
  const [color, setColor] = useState(saved || DEFAULT_ACCENT);
  const [savingColor, setSavingColor] = useState(false);
  useEffect(() => { setColor(saved || DEFAULT_ACCENT); }, [saved]);
  useEffect(() => { applyLive(color); }, [color]);
  useEffect(() => () => { applyLive(saved); }, [saved]);

  // ---- Secondary colour (petal) ----
  const saved2 = (config.themeColor2 ?? "").trim();
  const [color2, setColor2] = useState(saved2 || DEFAULT_SECONDARY);
  const [savingColor2, setSavingColor2] = useState(false);
  useEffect(() => { setColor2(saved2 || DEFAULT_SECONDARY); }, [saved2]);
  useEffect(() => { applySecondaryLive(color2); }, [color2]);
  useEffect(() => () => { applySecondaryLive(saved2); }, [saved2]);

  // ---- Custom CSS (advanced) ----
  const savedCss = config.customCss ?? "";
  const [css, setCss] = useState(savedCss);
  const [savingCss, setSavingCss] = useState(false);
  useEffect(() => { setCss(savedCss); }, [savedCss]);

  // ---- Theme import ----
  const importRef = useRef<HTMLInputElement>(null);

  // ---- UI style (button + chat) ----
  const savedUi = useMemo<UiStyle>(() => ({
    buttonShape: config.uiStyle?.buttonShape ?? "rounded",
    chatBubbleShape: config.uiStyle?.chatBubbleShape ?? "rounded",
    chatFontSize: config.uiStyle?.chatFontSize ?? "normal",
  }), [config.uiStyle]);
  const [ui, setUi] = useState<UiStyle>(savedUi);
  const [savingUi, setSavingUi] = useState(false);
  useEffect(() => { setUi(savedUi); }, [savedUi]);
  // Live-preview UI style across the whole app while editing; restore saved on leave.
  useEffect(() => { applyUiStyle(ui); }, [ui]);
  useEffect(() => () => { applyUiStyle(config.uiStyle); }, [config.uiStyle]);

  // ---- Menu builder ----
  const [rows, setRows] = useState<MenuRow[]>([]);
  const [savingMenu, setSavingMenu] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  useEffect(() => {
    const hidden = new Set(config.menuLayout?.hidden ?? []);
    const order = config.menuLayout?.order ?? [];
    const rank = new Map(order.map((h, i) => [h, i]));
    const base: MenuRow[] = NAV_ITEMS.map((it) => ({ href: it.href, label: it.label, icon: it.icon, hidden: hidden.has(it.href) }));
    base.sort((a, b) => {
      const ra = rank.has(a.href) ? (rank.get(a.href) as number) : Infinity;
      const rb = rank.has(b.href) ? (rank.get(b.href) as number) : Infinity;
      if (ra !== rb) return ra - rb;
      return NAV_ITEMS.findIndex((n) => n.href === a.href) - NAV_ITEMS.findIndex((n) => n.href === b.href);
    });
    setRows(base);
  }, [config.menuLayout]);

  const moveRow = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) return;
    setRows((r) => { const next = [...r]; const [it] = next.splice(from, 1); next.splice(to, 0, it); return next; });
  };
  const toggleHidden = (href: string) => setRows((r) => r.map((it) => (it.href === href ? { ...it, hidden: !it.hidden } : it)));

  const saveColorFn = async () => {
    setSavingColor(true);
    const res = await saveConfig({ themeColor: color.toLowerCase() });
    setSavingColor(false);
    if (res.ok) { await reload(); toast("Accent colour saved — live across the whole app", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };
  const restoreColor = async () => {
    setColor(DEFAULT_ACCENT); setSavingColor(true);
    const res = await saveConfig({ themeColor: "" });
    setSavingColor(false);
    if (res.ok) { await reload(); applyLive(""); toast("Reset to the default violet.", "info"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const saveUiFn = async () => {
    setSavingUi(true);
    const res = await saveConfig({ uiStyle: ui });
    setSavingUi(false);
    if (res.ok) { await reload(); toast("Button & chat style saved — live for everyone", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };
  const restoreUi = async () => {
    const def: UiStyle = { buttonShape: "rounded", chatBubbleShape: "rounded", chatFontSize: "normal" };
    setUi(def); setSavingUi(true);
    const res = await saveConfig({ uiStyle: {} });
    setSavingUi(false);
    if (res.ok) { await reload(); toast("Button & chat style reset to default.", "info"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const saveMenuFn = async () => {
    setSavingMenu(true);
    const menuLayout = { order: rows.map((r) => r.href), hidden: rows.filter((r) => r.hidden).map((r) => r.href) };
    const res = await saveConfig({ menuLayout });
    setSavingMenu(false);
    if (res.ok) { await reload(); toast("Menu layout saved — live for all users", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };
  const restoreMenu = async () => {
    setSavingMenu(true);
    const res = await saveConfig({ menuLayout: {} });
    setSavingMenu(false);
    if (res.ok) { await reload(); toast("Menu reset to the default order (all shown).", "info"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const saveColor2Fn = async () => {
    setSavingColor2(true);
    const res = await saveConfig({ themeColor2: color2.toLowerCase() });
    setSavingColor2(false);
    if (res.ok) { await reload(); toast("Secondary colour saved — live across the app", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };
  const restoreColor2 = async () => {
    setColor2(DEFAULT_SECONDARY); setSavingColor2(true);
    const res = await saveConfig({ themeColor2: "" });
    setSavingColor2(false);
    if (res.ok) { await reload(); applySecondaryLive(""); toast("Secondary colour reset to default pink.", "info"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const saveCssFn = async () => {
    setSavingCss(true);
    const res = await saveConfig({ customCss: css });
    setSavingCss(false);
    if (res.ok) { await reload(); toast("Custom CSS saved — live across the whole app", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };
  const clearCss = async () => {
    if (!confirm("Remove all custom CSS?")) return;
    setCss(""); setSavingCss(true);
    const res = await saveConfig({ customCss: "" });
    setSavingCss(false);
    if (res.ok) { await reload(); toast("Custom CSS cleared.", "info"); }
    else toast(res.error ?? "Could not save", "error");
  };

  // ---- Export / import / reset the WHOLE theme (colours + styles + custom CSS) ----
  const exportTheme = () => {
    const theme = { themeColor: saved, themeColor2: saved2, uiStyle: config.uiStyle ?? {}, menuLayout: config.menuLayout ?? {}, customCss: savedCss, _app: "lotus-theme", _v: 1 };
    const blob = new Blob([JSON.stringify(theme, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `lotus-theme-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const importTheme = async (file: File | null | undefined) => {
    if (!file) return;
    try {
      const t = JSON.parse(await file.text()) as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      if (typeof t.themeColor === "string") patch.themeColor = t.themeColor;
      if (typeof t.themeColor2 === "string") patch.themeColor2 = t.themeColor2;
      if (t.uiStyle && typeof t.uiStyle === "object") patch.uiStyle = t.uiStyle;
      if (t.menuLayout && typeof t.menuLayout === "object") patch.menuLayout = t.menuLayout;
      if (typeof t.customCss === "string") patch.customCss = t.customCss;
      if (Object.keys(patch).length === 0) { toast("That file isn't a Lotus theme.", "error"); return; }
      const res = await saveConfig(patch);
      if (res.ok) { await reload(); toast("Theme imported and applied.", "success"); }
      else toast(res.error ?? "Could not import", "error");
    } catch { toast("Could not read that theme file.", "error"); }
    if (importRef.current) importRef.current.value = "";
  };
  const resetAllTheme = async () => {
    if (!confirm("Reset the ENTIRE theme (colours, button/chat style, menu order & custom CSS) back to the defaults?")) return;
    const res = await saveConfig({ themeColor: "", themeColor2: "", uiStyle: {}, menuLayout: {}, customCss: "" });
    if (res.ok) { await reload(); applyLive(""); applySecondaryLive(""); applyUiStyle(undefined); toast("Everything reset to the default theme.", "info"); }
    else toast(res.error ?? "Could not reset", "error");
  };

  const ramp = buildAccentRamp(color) ?? {};

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><Palette className="size-6 text-lotus-300" /> Appearance &amp; Theme</h1>
        <p className="mt-1 text-sm text-mist-400">Customise the look of the whole app — primary &amp; secondary colours, button &amp; chat style, the menu, and <b className="text-mist-200">Custom CSS</b> for total control with no code changes. Every change <b className="text-mist-200">previews live</b> and goes out only when you press <b className="text-mist-200">Save</b>. Only a Super Admin can open this page.</p>
      </div>

      {/* Theme file: export / import / reset everything */}
      <Card className="flex flex-wrap items-center gap-2 p-4">
        <span className="mr-auto text-sm font-semibold text-mist-100">Theme file</span>
        <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void importTheme(e.target.files?.[0])} />
        <Button size="sm" variant="secondary" onClick={exportTheme}><Download className="size-4" /> Export</Button>
        <Button size="sm" variant="secondary" onClick={() => importRef.current?.click()}><Upload className="size-4" /> Import</Button>
        <Button size="sm" variant="ghost" onClick={resetAllTheme}><RotateCcw className="size-4" /> Reset all</Button>
      </Card>

      {/* ===== 1. Colours (primary + secondary) ===== */}
      <Card className="space-y-4 p-5">
        <div className="flex items-center gap-2 text-sm font-bold text-mist-100"><Palette className="size-4 text-lotus-300" /> Colours</div>
        {/* Primary */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-mist-500">Primary accent</div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-3">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="size-14 cursor-pointer rounded-lg border border-line bg-transparent" />
              <input value={color} onChange={(e) => setColor(e.target.value)} className="w-28 rounded-lg border border-line bg-ink-800 px-2 py-1 font-mono text-sm text-mist-100 outline-none focus:border-lotus-400" />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button key={p.hex} onClick={() => setColor(p.hex)} title={p.name} className={cn("size-8 rounded-full border-2 transition", color.toLowerCase() === p.hex ? "border-white" : "border-white/20 hover:border-white/50")} style={{ background: p.hex }} />
              ))}
            </div>
          </div>
          <div className="flex overflow-hidden rounded-lg border border-line">
            {SHADES.map((s) => <div key={s} className="h-6 flex-1" style={{ background: ramp[s] }} title={`primary-${s}`} />)}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={saveColorFn} disabled={savingColor || loading}><Check className="size-4" /> {savingColor ? "Saving…" : "Save primary"}</Button>
            <Button size="sm" variant="ghost" onClick={restoreColor} disabled={savingColor}><RotateCcw className="size-4" /> Default</Button>
          </div>
        </div>
        {/* Secondary */}
        <div className="space-y-2 border-t border-white/5 pt-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-mist-500">Secondary accent (gradients &amp; highlights)</div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-3">
              <input type="color" value={color2} onChange={(e) => setColor2(e.target.value)} className="size-12 cursor-pointer rounded-lg border border-line bg-transparent" />
              <input value={color2} onChange={(e) => setColor2(e.target.value)} className="w-28 rounded-lg border border-line bg-ink-800 px-2 py-1 font-mono text-sm text-mist-100 outline-none focus:border-lotus-400" />
            </label>
            <span className="rounded-lg px-3 py-1.5 text-sm font-bold text-white" style={{ background: `linear-gradient(90deg, ${color}, ${color2})` }}>Gradient preview</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={saveColor2Fn} disabled={savingColor2 || loading}><Check className="size-4" /> {savingColor2 ? "Saving…" : "Save secondary"}</Button>
            <Button size="sm" variant="ghost" onClick={restoreColor2} disabled={savingColor2}><RotateCcw className="size-4" /> Default</Button>
          </div>
        </div>
      </Card>

      {/* ===== 2. Button & chat style ===== */}
      <Card className="space-y-4 p-5">
        <div className="flex items-center gap-2 text-sm font-bold text-mist-100"><MousePointerClick className="size-4 text-lotus-300" /> Button &amp; chat style</div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-mist-500">Button corners</div>
            <Segmented value={ui.buttonShape ?? "rounded"} onChange={(v) => setUi((u) => ({ ...u, buttonShape: v }))} options={[{ v: "sharp", label: "Sharp" }, { v: "rounded", label: "Rounded" }, { v: "pill", label: "Pill" }]} />
          </div>
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-mist-500">Chat bubble corners</div>
            <Segmented value={ui.chatBubbleShape ?? "rounded"} onChange={(v) => setUi((u) => ({ ...u, chatBubbleShape: v }))} options={[{ v: "sharp", label: "Sharp" }, { v: "rounded", label: "Rounded" }, { v: "round", label: "Round" }]} />
          </div>
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-mist-500">Chat text size</div>
            <Segmented value={ui.chatFontSize ?? "normal"} onChange={(v) => setUi((u) => ({ ...u, chatFontSize: v }))} options={[{ v: "small", label: "Small" }, { v: "normal", label: "Normal" }, { v: "large", label: "Large" }]} />
          </div>
        </div>

        {/* Live preview — buttons + chat bubbles reflect the choices above instantly. */}
        <div className="space-y-3 rounded-xl border border-line bg-ink-900/40 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-mist-300"><Eye className="size-3.5 text-lotus-300" /> Live preview</div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm">Primary</Button>
            <Button size="sm" variant="secondary">Secondary</Button>
            <Button size="sm" variant="outline">Outline</Button>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-start"><div className="max-w-[75%] rounded-[var(--bubble-radius,1rem)] rounded-bl-md bg-ink-800 px-3.5 py-2 text-[length:var(--bubble-font,0.875rem)] text-mist-100">Hey! How are you doing today?</div></div>
            <div className="flex justify-end"><div className="max-w-[75%] rounded-[var(--bubble-radius,1rem)] rounded-br-md bg-lotus-600 px-3.5 py-2 text-[length:var(--bubble-font,0.875rem)] text-white">All good — playing Ludo 🎲</div></div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={saveUiFn} disabled={savingUi || loading}><Check className="size-4" /> {savingUi ? "Saving…" : "Save button & chat style"}</Button>
          <Button variant="ghost" onClick={restoreUi} disabled={savingUi}><RotateCcw className="size-4" /> Reset to default</Button>
        </div>
        <p className="text-[11px] text-mist-500">These apply everywhere buttons and chat bubbles appear. Colours follow the accent above. (Button <b>size</b> stays fixed per screen on purpose so nothing overlaps.)</p>
      </Card>

      {/* ===== 3. Menu builder ===== */}
      <Card className="space-y-4 p-5">
        <div className="flex items-center gap-2 text-sm font-bold text-mist-100"><MenuIcon className="size-4 text-lotus-300" /> Menu — order &amp; visibility</div>
        <p className="text-xs text-mist-400">Drag the handle to reorder the menu items users see in the sidebar and mobile bar. Use the eye to show or hide an item. This is the live preview — the list below is exactly the order it will appear in.</p>
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div
              key={r.href}
              draggable
              onDragStart={() => setDragFrom(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (dragFrom !== null) moveRow(dragFrom, i); setDragFrom(null); }}
              onDragEnd={() => setDragFrom(null)}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2 transition",
                dragFrom === i ? "border-lotus-400/60 bg-lotus-500/10" : "border-line bg-ink-900/40",
                r.hidden && "opacity-50",
              )}
            >
              <GripVertical className="size-4 shrink-0 cursor-grab text-mist-500" />
              <r.icon className="size-[18px] shrink-0 text-lotus-300" />
              <span className="flex-1 truncate text-sm text-mist-100">{r.label}</span>
              <span className="hidden font-mono text-[10px] text-mist-600 sm:inline">{r.href}</span>
              <button onClick={() => toggleHidden(r.href)} title={r.hidden ? "Hidden — click to show" : "Shown — click to hide"} className={cn("grid size-8 place-items-center rounded-lg transition", r.hidden ? "text-mist-500 hover:bg-white/8 hover:text-mist-200" : "text-lotus-300 hover:bg-lotus-500/15")}>
                {r.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={saveMenuFn} disabled={savingMenu || loading}><Check className="size-4" /> {savingMenu ? "Saving…" : "Save menu layout"}</Button>
          <Button variant="ghost" onClick={restoreMenu} disabled={savingMenu}><RotateCcw className="size-4" /> Reset to default order</Button>
        </div>
        <p className="text-[11px] text-mist-500">Items switched off by a master feature (Admin → Features) or shown only to agency owners still follow those rules on top of this. Renaming a menu item is done in Admin → Text &amp; Labels.</p>
      </Card>

      {/* ===== 4. Custom CSS (advanced — total control, no source edits) ===== */}
      <Card className="space-y-3 p-5">
        <div className="flex items-center gap-2 text-sm font-bold text-mist-100"><Code2 className="size-4 text-lotus-300" /> Custom CSS <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-mist-400">Advanced</span></div>
        <p className="text-xs text-mist-400">Write your own CSS to restyle <b className="text-mist-200">anything</b> — backgrounds, borders, shadows, fonts, cards, tables, buttons, the login page — across both the admin panel and the user app, with no code changes. It applies live everywhere the moment you save.</p>
        <textarea
          value={css}
          onChange={(e) => setCss(e.target.value)}
          spellCheck={false}
          placeholder={"/* Example: softer cards + a custom page background */\nbody { background: #0b0b14; }\n.rounded-2xl { border-radius: 20px; }"}
          className="h-56 w-full resize-y rounded-lg border border-line bg-ink-900 p-3 font-mono text-xs leading-relaxed text-mist-100 outline-none focus:border-lotus-400"
        />
        {/* Live preview of UNSAVED edits only. On a fresh load (css === savedCss) nothing is
            applied here, so this page always stays usable — even if the saved CSS is broken,
            reloading /admin/appearance gives back working Clear/Reset controls. */}
        {css.trim() && css !== savedCss && <style dangerouslySetInnerHTML={{ __html: css.replace(/<\/?\s*(style|script)/gi, "/**/") }} />}
        <div className="flex flex-wrap gap-2">
          <Button onClick={saveCssFn} disabled={savingCss || loading}><Check className="size-4" /> {savingCss ? "Saving…" : "Save custom CSS"}</Button>
          <Button variant="ghost" onClick={clearCss} disabled={savingCss}><RotateCcw className="size-4" /> Clear</Button>
          <span className="ml-auto self-center text-[11px] text-mist-600">{css.length.toLocaleString()} / 20,000</span>
        </div>
        <div className="flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-500/[0.04] p-3 text-[11px] leading-relaxed text-mist-400">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" />
          <span>Powerful — this styles the <b className="text-mist-200">whole app for everyone</b>. Bad CSS can hide or break parts of the UI; if something looks wrong, press <b className="text-mist-200">Clear</b> to remove it. (Only CSS is allowed — scripts/HTML are stripped for safety.)</span>
        </div>
      </Card>
    </div>
  );
}
