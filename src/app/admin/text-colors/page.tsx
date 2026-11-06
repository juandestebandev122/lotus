"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { cn } from "@/lib/cn";
import {
  TEXT_COLOR_FIELDS, buildTextColorCss, isValidColor, toHex, contrastRatio,
  FONT_FAMILIES, TEXT_ALIGNS, fontStack, hasStyle,
  type TextColors, type TextStyle, type TextAlign,
} from "@/lib/text-colors";
import { Type, Check, Eye, EyeOff, RotateCcw, Loader2, AlertTriangle, Save } from "lucide-react";

/**
 * TEXT COLOUR MANAGEMENT — separate from Theme Management by design.
 *
 * Theme Management styles the app (accents, surfaces, button shape). It has no
 * business deciding what colour a paragraph is, and a theme change must never
 * repaint or fade text an admin chose deliberately. Everything on this page is
 * independent: each category can be set on its own, and a category left blank
 * simply keeps the app's built-in colour for that part of the UI.
 */

const PRESETS = ["#ffffff", "#f7f4ff", "#e0d8f5", "#bcb1de", "#968abb", "#756a9c", "#a78bfa", "#7c5cfc", "#f472b6", "#fbbf24", "#34d399", "#38bdf8", "#f87171", "#111827"];

/** A compact labelled slider for the per-category style controls. */
function MiniSlider({ label, value, min, max, step, suffix, onChange }: {
  label: string; value: number; min: number; max: number; step: number; suffix: string; onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 flex items-center justify-between text-[10px]">
        <span className="font-semibold text-mist-400">{label}</span>
        <span className="font-mono text-mist-500">{value}{suffix}</span>
      </span>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--color-lotus-500)]"
      />
    </label>
  );
}

export default function TextColorsAdminPage() {
  const { config, reload } = useConfig();
  const { toast } = useToast();

  const [tc, setTc] = useState<TextColors>({});
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    setTc(config.textColors ?? { enabled: false });
    setLoaded(true);
  }, [config.textColors, loaded]);

  /**
   * Setting a COLOUR switches the system on automatically.
   *
   * Previously an admin could colour all eleven categories, press Save, and see
   * absolutely nothing change — because the master switch was still off and the
   * save honoured it. Picking a colour is an unambiguous "I want this used", so
   * it now turns the system on rather than silently discarding the intent. The
   * master switch stays, for deliberately turning everything off again.
   */
  const set = (k: keyof TextColors, v: string | boolean) =>
    setTc((p) => {
      const next = { ...p, [k]: v };
      if (k !== "enabled" && typeof v === "string" && v.trim() && p.enabled !== true) next.enabled = true;
      return next;
    });

  // The stylesheet the live app would use — for the REAL current settings.
  // It must not pretend the system is on: that is exactly what made Preview
  // disagree with what actually shipped.
  const css = useMemo(() => buildTextColorCss(tc), [tc]);
  // Any colour actually chosen? Used to warn when they'd be discarded.
  const hasColours = TEXT_COLOR_FIELDS.some((f) => ((tc[f.key] ?? "") as string).trim());

  // LIVE PREVIEW — paints the real admin panel with these colours so the effect
  // is visible on actual UI, not just a swatch. Removed the moment it's off.
  useEffect(() => {
    const ID = "lotus-text-colors-preview";
    document.getElementById(ID)?.remove();
    if (!preview) return;
    const el = document.createElement("style");
    el.id = ID;
    el.textContent = css;
    document.head.appendChild(el);
    return () => { document.getElementById(ID)?.remove(); };
  }, [preview, css]);
  // Never leave a preview stuck on after navigating away.
  useEffect(() => () => { document.getElementById("lotus-text-colors-preview")?.remove(); }, []);

  const save = async () => {
    setSaving(true);
    // Send the WHOLE textColors object — the config API replaces the key.
    const res = await saveConfig({ textColors: tc });
    setSaving(false);
    if (res.ok) {
      // Don't claim it's live when the master switch is off — that was the whole
      // problem: a cheerful "saved" while nothing changed for anybody.
      toast(
        tc.enabled === true
          ? "Text colours saved — live across the whole app"
          : "Saved. Custom text colours are switched OFF, so the app keeps its built-in colours.",
        tc.enabled === true ? "success" : "info",
      );
      void reload();
    } else toast(res.error ?? "Could not save", "error");
  };

  /**
   * RESET TO DEFAULT — clears every colour AND every style, and SAVES IMMEDIATELY.
   *
   * Two things were wrong before:
   *   1. It only cleared the keys locally. The config API reads a MISSING key as
   *      "leave this one alone", so pressing Save afterwards put the old colours
   *      straight back.
   *   2. Even once that was fixed, the button only changed the form — the admin
   *      had to spot a second "Save & apply" for anything to happen. A button
   *      called "Reset to default" that doesn't reset anything until you press
   *      something else is the same bug from the user's side.
   * So it now writes the cleared state to the server there and then.
   */
  const resetAll = async () => {
    if (!window.confirm("Reset every text colour and style back to the app's defaults?")) return;
    const cleared: TextColors = { enabled: tc.enabled };
    for (const f of TEXT_COLOR_FIELDS) cleared[f.key] = "";
    cleared.styles = {}; // an EMPTY object means "clear"; omitting it would mean "keep"
    setTc(cleared);
    setSaving(true);
    const res = await saveConfig({ textColors: cleared });
    setSaving(false);
    if (res.ok) {
      void reload();
      toast("Reset — every text colour and style is back to the app default.", "success");
    } else {
      toast(res.error ?? "Could not reset", "error");
    }
  };

  /** Change one style property of one category. */
  const setStyle = (key: string, patch: Partial<TextStyle>) =>
    setTc((p) => {
      const styles = { ...(p.styles ?? {}) };
      styles[key] = { ...(styles[key] ?? {}), ...patch };
      // Choosing a style is an unambiguous "use this", same as choosing a colour.
      return { ...p, styles, enabled: p.enabled === true ? true : true };
    });

  /** Clear just this category's styling (colour left alone). */
  const clearStyle = (key: string) =>
    setTc((p) => {
      const styles = { ...(p.styles ?? {}) };
      delete styles[key];
      return { ...p, styles };
    });

  // The surface these colours actually sit on, so the contrast warning is real.
  const surfaceHex = (config.themeSurface || "#1a1430").trim();

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* ===== Header ===== */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
            <Type className="size-6 text-lotus-300" /> Text Colours
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-mist-400">
            Complete control over every kind of text in the app — headings, body copy, labels,
            buttons, placeholders, icons, links and the menu — each one set independently.
            This is a <b className="text-mist-200">separate system from Theme Management</b>:
            themes style the app, and they can no longer repaint or fade the colours you choose here.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant={preview ? "primary" : "secondary"} onClick={() => setPreview((v) => !v)}>
            {preview ? <><EyeOff className="size-4" /> Stop preview</> : <><Eye className="size-4" /> Preview</>}
          </Button>
          <Button variant="secondary" onClick={resetAll}><RotateCcw className="size-4" /> Reset to default</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save &amp; apply
          </Button>
        </div>
      </div>

      {/* THE trap this page used to set: colours chosen, master switch off, Save
          pressed, nothing happens anywhere. Say so plainly and offer the fix. */}
      {hasColours && tc.enabled !== true && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          <AlertTriangle className="size-5 shrink-0 text-rose-300" />
          <span className="min-w-0 flex-1">
            You have chosen colours, but <b>custom text colours are switched OFF</b> — saving now would change nothing in the app.
          </span>
          <Button size="sm" onClick={() => set("enabled", true)}>Turn on</Button>
        </div>
      )}

      {preview && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-100">
          <Eye className="size-4 shrink-0" />
          {tc.enabled === true ? (
            <>Previewing on this admin panel — <b>not saved yet</b>. Press <b>Save &amp; apply</b> to make it live for everyone.</>
          ) : (
            <>Preview shows nothing because custom text colours are <b>switched off</b> — this is exactly what members would see.</>
          )}
        </div>
      )}

      {/* ===== Master switch ===== */}
      <Card className="p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={tc.enabled === true}
            onChange={(e) => set("enabled", e.target.checked)}
            className="mt-0.5 size-4 accent-[var(--color-lotus-500)]"
          />
          <span className="min-w-0">
            <span className="block text-sm font-bold text-mist-100">Use custom text colours across the whole website</span>
            <span className="mt-0.5 block text-xs text-mist-400">
              When off, the app keeps its built-in text colours and nothing on this page has any effect.
              When on, every category you set below applies everywhere — menus, headers, footers, pages,
              buttons, popups, forms, chat and labels.
            </span>
          </span>
        </label>
      </Card>

      {/* ===== Categories ===== */}
      <div className="grid gap-3 lg:grid-cols-2">
        {TEXT_COLOR_FIELDS.map((f) => {
          const value = (tc[f.key] ?? "") as string;
          const effective = value || f.fallback;
          const valid = !value || isValidColor(value);
          const ratio = contrastRatio(effective, surfaceHex);
          const low = ratio !== null && ratio < 4.5;
          const st: TextStyle = tc.styles?.[f.key] ?? {};
          // The sample below shows the REAL result — colour and style together.
          const sampleStyle: React.CSSProperties = {
            color: effective,
            ...(fontStack(st.font) ? { fontFamily: fontStack(st.font) } : {}),
            ...(st.sizePct && st.sizePct !== 100 ? { fontSize: `${st.sizePct}%` } : {}),
            ...(st.bold === true ? { fontWeight: 700 } : st.bold === false ? { fontWeight: 400 } : {}),
            ...(st.italic ? { fontStyle: "italic" as const } : {}),
            ...(st.underline ? { textDecoration: "underline" } : {}),
            ...(st.align ? { textAlign: st.align } : {}),
            ...(st.letterSpacing ? { letterSpacing: `${st.letterSpacing}px` } : {}),
            ...(st.lineHeight ? { lineHeight: st.lineHeight } : {}),
          };
          return (
            <Card key={f.key} className="p-4">
              <div className="flex items-start gap-3">
                {/* The round indicator the colour selector shows — always filled
                    with the colour that category is actually using. */}
                <span
                  className="mt-0.5 size-8 shrink-0 rounded-full border-2 border-white/20 shadow-inner"
                  style={{ background: effective }}
                  title={effective}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-mist-100">{f.label}</span>
                    {!value && <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase text-mist-400">default</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-mist-400">{f.desc}</p>

                  {/* Picker + HEX/RGB box */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <input
                      type="color"
                      value={toHex(effective) || "#ffffff"}
                      onChange={(e) => set(f.key, e.target.value)}
                      aria-label={`${f.label} colour picker`}
                      className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-ink-800 p-1"
                    />
                    <input
                      value={value}
                      onChange={(e) => set(f.key, e.target.value)}
                      placeholder={`${f.fallback} (default)`}
                      spellCheck={false}
                      className={cn(
                        "h-9 min-w-0 flex-1 rounded-lg border bg-ink-800 px-3 font-mono text-xs text-mist-100 outline-none",
                        valid ? "border-line focus:border-lotus-400/50" : "border-rose-400/60",
                      )}
                    />
                    <button
                      onClick={() => set(f.key, "")}
                      title="Reset this one to the built-in colour"
                      className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-line bg-ink-800 px-2.5 text-[11px] font-semibold text-mist-300 hover:text-mist-100"
                    >
                      <RotateCcw className="size-3.5" /> Default
                    </button>
                  </div>

                  {/* Quick swatches */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {PRESETS.map((p) => (
                      <button
                        key={p}
                        onClick={() => set(f.key, p)}
                        title={p}
                        aria-label={`Use ${p}`}
                        className={cn(
                          "size-5 rounded-full border transition hover:scale-110",
                          toHex(value) === p ? "border-white ring-2 ring-lotus-400" : "border-white/20",
                        )}
                        style={{ background: p }}
                      />
                    ))}
                  </div>

                  {/* Live sample + readability check */}
                  <div className="mt-2.5 rounded-lg border border-line px-3 py-2" style={{ background: surfaceHex }}>
                    {/* Shows colour AND style together, so what you see here is
                        what members will see. */}
                    <p className="text-sm" style={sampleStyle}>
                      The quick brown fox — {f.label}
                    </p>
                  </div>
                  {!valid && (
                    <p className="mt-1.5 text-[11px] font-semibold text-rose-300">
                      Not a colour. Use #7c5cfc, #fff or rgb(124, 92, 252).
                    </p>
                  )}
                  {valid && low && (
                    <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300">
                      <AlertTriangle className="size-3.5" />
                      Low contrast on this background ({ratio!.toFixed(1)}:1) — hard to read. 4.5:1 or more is comfortable.
                    </p>
                  )}
                  {valid && !low && ratio !== null && (
                    <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-emerald-300">
                      <Check className="size-3.5" /> Clearly readable ({ratio.toFixed(1)}:1)
                    </p>
                  )}

                  {/* ===== TEXT STYLE for this category ===== */}
                  <div className="mt-3 rounded-lg border border-line bg-ink-900/60 p-2.5">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-mist-400">Text style</span>
                      {hasStyle(st) && (
                        <button onClick={() => clearStyle(f.key)} className="inline-flex items-center gap-1 text-[10px] font-semibold text-mist-500 hover:text-rose-300">
                          <RotateCcw className="size-3" /> Clear style
                        </button>
                      )}
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-semibold text-mist-400">Font</span>
                        <select
                          value={st.font ?? ""}
                          onChange={(e) => setStyle(f.key, { font: e.target.value })}
                          className="h-8 w-full rounded-lg border border-line bg-ink-800 px-2 text-xs text-mist-100 outline-none focus:border-lotus-400/50"
                        >
                          {FONT_FAMILIES.map((ff) => <option key={ff.id} value={ff.id}>{ff.label}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-semibold text-mist-400">Alignment</span>
                        <select
                          value={st.align ?? ""}
                          onChange={(e) => setStyle(f.key, { align: (e.target.value || undefined) as TextAlign | undefined })}
                          className="h-8 w-full rounded-lg border border-line bg-ink-800 px-2 text-xs text-mist-100 outline-none focus:border-lotus-400/50"
                        >
                          <option value="">App default</option>
                          {TEXT_ALIGNS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                        </select>
                      </label>
                    </div>

                    {/* Bold / Italic / Underline */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {([
                        { k: "bold" as const, label: "B", title: "Bold", cls: "font-black" },
                        { k: "italic" as const, label: "I", title: "Italic", cls: "italic font-serif" },
                        { k: "underline" as const, label: "U", title: "Underline", cls: "underline" },
                      ]).map((b) => (
                        <button
                          key={b.k}
                          onClick={() => setStyle(f.key, { [b.k]: !st[b.k] } as Partial<TextStyle>)}
                          title={b.title}
                          aria-pressed={!!st[b.k]}
                          className={cn(
                            "grid size-8 place-items-center rounded-lg border text-sm transition",
                            b.cls,
                            st[b.k] ? "border-lotus-400 bg-lotus-500/20 text-lotus-100" : "border-line bg-ink-800 text-mist-300 hover:text-mist-100",
                          )}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>

                    <div className="mt-2 space-y-2">
                      <MiniSlider label="Size" value={st.sizePct ?? 100} min={50} max={200} step={5} suffix="%" onChange={(v) => setStyle(f.key, { sizePct: v })} />
                      <MiniSlider label="Letter spacing" value={st.letterSpacing ?? 0} min={-2} max={10} step={0.5} suffix="px" onChange={(v) => setStyle(f.key, { letterSpacing: v })} />
                      <MiniSlider label="Line height" value={st.lineHeight ?? 1.5} min={1} max={2.5} step={0.05} suffix="×" onChange={(v) => setStyle(f.key, { lineHeight: v })} />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* ===== Footer actions (repeated, so a long page doesn't need scrolling back) ===== */}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-xs text-mist-400">
          Saving applies these colours to the entire website — menus, headers, footers, pages, buttons,
          popups, forms, chat and labels — for every member, on every device.
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setPreview((v) => !v)}>{preview ? "Stop preview" : "Preview"}</Button>
          <Button variant="secondary" onClick={resetAll}><RotateCcw className="size-4" /> Reset to default</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save &amp; apply
          </Button>
        </div>
      </Card>
    </div>
  );
}
