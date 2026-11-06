"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { Die } from "@/components/Die";
import {
  resolveDiceModels, newDiceModel, rollDurationMs, rollEasing,
  DICE_TEXTURES, DICE_SHAPES, PIP_SHAPES, FACE_MODES, ROLL_STYLES, ROLL_STOPS,
  type DiceModel, type DiceFaceStyle, type FaceMode, type PipShape,
} from "@/lib/dice-model";
import {
  Dices, Check, Plus, Copy, Trash2, Upload, RotateCcw, Loader2, Save, Play,
  Eye, EyeOff, ArrowUp, ArrowDown, Info,
} from "lucide-react";
import { CosmeticPriceControl } from "@/components/admin/CosmeticPriceControl";

/**
 * ADMIN → DICE MODELS.
 *
 * The complete dice customisation system: a library of models the admin can add
 * to, edit, activate, disable and delete, where each model controls the die's
 * body, its pips, the design of EACH number 1–6 (dots, a digit, a symbol, or its
 * own uploaded picture) and the roll animation.
 *
 * The model marked ACTIVE is what every player and spectator sees, in every game.
 */

const FACE_NUMS = [1, 2, 3, 4, 5, 6] as const;
const MAX_UPLOAD_MB = 8;

export default function DiceModelsAdminPage() {
  const { config, loading, reload } = useConfig();
  const { toast } = useToast();

  const [models, setModels] = useState<DiceModel[]>([]);
  const [activeId, setActiveId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [previewFace, setPreviewFace] = useState<1 | 2 | 3 | 4 | 5 | 6>(5);
  const seeded = useRef(false);

  useEffect(() => {
    if (loading || seeded.current) return;
    seeded.current = true;
    const list = resolveDiceModels(config.diceModels);
    setModels(list);
    setActiveId(config.activeDiceModelId || list.find((m) => m.enabled !== false)?.id || list[0]?.id || "");
    setEditingId(config.activeDiceModelId || list[0]?.id || "");
  }, [loading, config.diceModels, config.activeDiceModelId]);

  const editing = models.find((m) => m.id === editingId) ?? models[0];

  const patch = (p: Partial<DiceModel>) =>
    setModels((list) => list.map((m) => (m.id === editing?.id ? { ...m, ...p } : m)));
  const patchFace = (n: number, p: Partial<DiceFaceStyle>) =>
    setModels((list) => list.map((m) =>
      m.id === editing?.id ? { ...m, faces: { ...(m.faces ?? {}), [String(n)]: { ...(m.faces?.[String(n)] ?? {}), ...p } } } : m,
    ));
  const patchRoll = (p: Partial<NonNullable<DiceModel["roll"]>>) =>
    setModels((list) => list.map((m) => (m.id === editing?.id ? { ...m, roll: { ...(m.roll ?? {}), ...p } } : m)));

  /** Upload a picture and hand its URL back. Used for whole-die and per-face art. */
  const upload = (apply: (url: string) => void) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/gif,image/svg+xml";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
        toast(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_UPLOAD_MB} MB.`, "error");
        return;
      }
      setUploading(true);
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch(withBase("/api/admin/tokens"), { method: "POST", body: fd, credentials: "include" });
        const d = await res.json();
        if (res.ok && d.url) { apply(d.url as string); toast("Uploaded — press Save to make it live.", "success"); }
        else toast(d.error ?? "Upload failed", "error");
      } catch { toast("Upload failed", "error"); }
      setUploading(false);
    };
    input.click();
  };

  const addModel = () => {
    const m = newDiceModel(models.length);
    setModels((l) => [...l, m]);
    setEditingId(m.id);
    toast("New dice added — customise it, then Save.", "success");
  };
  const duplicate = (m: DiceModel) => {
    const copy: DiceModel = { ...m, id: `dice_${Math.random().toString(36).slice(2, 9)}`, name: `${m.name} copy`, builtin: false, order: models.length };
    setModels((l) => [...l, copy]);
    setEditingId(copy.id);
  };
  const remove = (m: DiceModel) => {
    if (m.builtin) { toast("Ready-made dice can't be deleted — switch it off instead.", "info"); return; }
    if (m.id === activeId) { toast("That dice is currently active. Activate another one first.", "error"); return; }
    setModels((l) => l.filter((x) => x.id !== m.id));
    if (editingId === m.id) setEditingId(models[0]?.id ?? "");
  };
  const move = (m: DiceModel, dir: -1 | 1) => {
    const list = [...models];
    const at = list.findIndex((x) => x.id === m.id);
    const to = at + dir;
    if (at < 0 || to < 0 || to >= list.length) return;
    [list[at], list[to]] = [list[to], list[at]];
    setModels(list.map((x, i) => ({ ...x, order: i })));
  };

  const save = async () => {
    setSaving(true);
    const res = await saveConfig({ diceModels: models.map((m, i) => ({ ...m, order: i })), activeDiceModelId: activeId });
    setSaving(false);
    if (res.ok) { await reload(); toast("Dice saved — live in every game.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  // Roll test: cycles the face while the chosen animation plays, then lands.
  const testRoll = () => {
    if (!editing || rolling) return;
    setRolling(true);
    const ms = rollDurationMs(editing, config.gameDiceSpeed);
    const spin = setInterval(() => setPreviewFace((((Math.random() * 6) | 0) + 1) as 1 | 2 | 3 | 4 | 5 | 6), 90);
    setTimeout(() => {
      clearInterval(spin);
      setPreviewFace((((Math.random() * 6) | 0) + 1) as 1 | 2 | 3 | 4 | 5 | 6);
      setRolling(false);
    }, ms);
  };

  const previewStyle = useMemo(() => {
    if (!editing || !rolling) return undefined;
    return {
      animation: `dice-preview-roll ${rollDurationMs(editing, config.gameDiceSpeed)}ms ${rollEasing(editing.roll?.stop)} 1`,
    } as React.CSSProperties;
  }, [editing, rolling, config.gameDiceSpeed]);

  if (!editing) {
    return <div className="grid place-items-center py-20 text-mist-400"><Loader2 className="size-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* keyframes for the preview roll — kept local to this page */}
      <style>{`@keyframes dice-preview-roll{0%{transform:rotate(0) scale(1)}25%{transform:rotate(160deg) scale(1.15)}50%{transform:rotate(300deg) scale(1.05)}75%{transform:rotate(460deg) scale(1.12)}100%{transform:rotate(720deg) scale(1)}}`}</style>

      {/* ===== Header ===== */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
            <Dices className="size-6 text-lotus-300" /> Dice Models
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-mist-400">
            The complete dice system. Pick a ready-made dice or build your own — body colour,
            texture, shape, border and glow; the dots&rsquo; colour, shape and size; a
            <b className="text-mist-200"> separate design for each number 1–6</b> (dots, the digit,
            a symbol, or your own uploaded picture); and the rolling animation, speed and how it
            comes to rest. The dice you mark <b className="text-mist-200">Active</b> is what every
            player sees, in every game.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="secondary" onClick={addModel}><Plus className="size-4" /> New dice</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-sky-400/25 bg-sky-500/[0.06] px-3 py-2 text-[11px] text-mist-300">
        <Info className="mt-0.5 size-3.5 shrink-0 text-sky-300" />
        <p><b className="text-mist-100">Appearance only.</b> Nothing here changes a dice roll. The numbers stay exactly as random (or as controlled in Dice Control) as they are now — this only decides how the die looks and how the roll is animated.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* ===== Library ===== */}
        <Card className="p-3">
          <h2 className="mb-2 px-1 text-sm font-bold text-mist-100">Dice library</h2>
          <div className="space-y-1.5">
            {models.map((m, i) => {
              const isActive = m.id === activeId;
              const isEditing = m.id === editing.id;
              return (
                <div
                  key={m.id}
                  className={cn(
                    "rounded-xl border p-2 transition",
                    isEditing ? "border-lotus-400/60 bg-lotus-500/10" : "border-line bg-ink-900 hover:border-lotus-400/30",
                    m.enabled === false && "opacity-55",
                  )}
                >
                  <button onClick={() => setEditingId(m.id)} className="flex w-full items-center gap-2.5 text-left">
                    <span className="grid size-11 shrink-0 place-items-center">
                      <Die face={5} model={m} className="size-10" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-mist-100">{m.name}</span>
                      <span className="block truncate text-[10px] text-mist-500">
                        {m.category ?? "Free"}{m.builtin ? " · ready-made" : ""}
                      </span>
                    </span>
                    {isActive && <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-300">● ACTIVE</span>}
                  </button>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {!isActive && (
                      <button onClick={() => setActiveId(m.id)} disabled={m.enabled === false} className="rounded-lg bg-lotus-500/15 px-2 py-1 text-[10px] font-bold text-lotus-200 hover:bg-lotus-500/25 disabled:opacity-40" title={m.enabled === false ? "Switch it on first" : "Use this dice in every game"}>
                        Activate
                      </button>
                    )}
                    <button onClick={() => setModels((l) => l.map((x) => (x.id === m.id ? { ...x, enabled: x.enabled === false } : x)))} className="rounded-lg px-2 py-1 text-[10px] font-semibold text-mist-400 hover:text-mist-100" title={m.enabled === false ? "Switch on" : "Switch off"}>
                      {m.enabled === false ? <><EyeOff className="mr-0.5 inline size-3" /> Off</> : <><Eye className="mr-0.5 inline size-3" /> On</>}
                    </button>
                    <button onClick={() => duplicate(m)} className="rounded-lg px-1.5 py-1 text-mist-400 hover:text-mist-100" title="Duplicate"><Copy className="size-3.5" /></button>
                    <button onClick={() => move(m, -1)} disabled={i === 0} className="rounded-lg px-1 py-1 text-mist-400 hover:text-mist-100 disabled:opacity-30" title="Move up"><ArrowUp className="size-3.5" /></button>
                    <button onClick={() => move(m, 1)} disabled={i === models.length - 1} className="rounded-lg px-1 py-1 text-mist-400 hover:text-mist-100 disabled:opacity-30" title="Move down"><ArrowDown className="size-3.5" /></button>
                    {!m.builtin && <button onClick={() => remove(m)} className="ml-auto rounded-lg px-1.5 py-1 text-rose-300 hover:bg-rose-500/10" title="Delete"><Trash2 className="size-3.5" /></button>}
                  </div>
                  {/* SELL THIS DICE. Give it a coin price and it appears in the
                      Store's Dice category on its own — players buy it and use it
                      in their own games. 0 keeps it free for everyone, exactly as
                      it is today. "Activate" above is separate: that is the dice
                      the app uses for anyone who has not chosen one. */}
                  <CosmeticPriceControl
                    kind="dice"
                    id={m.id}
                    price={m.priceCoins ?? 0}
                    onPrice={(v) => setModels((l) => l.map((x) => (x.id === m.id ? { ...x, priceCoins: v } : x)))}
                    validityDays={m.validityDays ?? 0}
                    onValidity={(v) => setModels((l) => l.map((x) => (x.id === m.id ? { ...x, validityDays: v } : x)))}
                    saved={!saving}
                    className="mt-1.5 border-t border-line/60 pt-1.5"
                  />
                </div>
              );
            })}
          </div>
        </Card>

        {/* ===== Editor ===== */}
        <div className="space-y-4">
          {/* Live preview */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-mist-100">Live preview</h2>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="secondary" onClick={testRoll} disabled={rolling}>
                  {rolling ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} Test roll
                </Button>
                {m_isNotActive(editing.id, activeId) && (
                  <Button size="sm" onClick={() => setActiveId(editing.id)} disabled={editing.enabled === false}>
                    <Check className="size-4" /> Use this dice
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-3 grid place-items-center rounded-xl border border-line bg-ink-950/60 py-7">
              <div style={previewStyle}>
                <Die face={previewFace} model={editing} className="size-24" />
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
                {FACE_NUMS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setPreviewFace(n)}
                    className={cn("grid size-8 place-items-center rounded-lg text-xs font-bold transition", previewFace === n ? "bg-lotus-500 text-white" : "bg-ink-800 text-mist-300 hover:text-mist-100")}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-mist-500">Tap a number to see that face. This is exactly how it draws in the game.</p>
            </div>

            {/* All six faces at once */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-3 rounded-xl border border-line bg-ink-900/50 py-3">
              {FACE_NUMS.map((n) => (
                <span key={n} className="grid place-items-center gap-1">
                  <Die face={n} model={editing} className="size-11" />
                  <span className="text-[10px] text-mist-500">{n}</span>
                </span>
              ))}
            </div>
          </Card>

          {/* Name + category */}
          <Card className="p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-mist-300">Dice name</span>
                <input value={editing.name} onChange={(e) => patch({ name: e.target.value })} className={inp} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-mist-300">Category</span>
                <select value={editing.category ?? "Free"} onChange={(e) => patch({ category: e.target.value })} className={inp}>
                  {["Free", "Premium", "VIP", "Event", "Seasonal"].map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
            </div>
          </Card>

          {/* ===== Body ===== */}
          <Card className="p-4">
            <h2 className="text-sm font-bold text-mist-100">Dice body</h2>
            <p className="mt-0.5 text-xs text-mist-400">Colour, texture, shape and edges of the die itself.</p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <ColorField label="Colour" value={editing.bodyColor ?? "#ffffff"} onChange={(v) => patch({ bodyColor: v })} />
              <ColorField label="Second colour (gradient)" value={editing.bodyColor2 ?? ""} onChange={(v) => patch({ bodyColor2: v })} clearable onClear={() => patch({ bodyColor2: "" })} hint="Leave empty for a flat colour." />
            </div>

            <div className="mt-3">
              <span className="mb-1.5 block text-xs font-semibold text-mist-300">Texture</span>
              <div className="grid gap-1.5 sm:grid-cols-4">
                {DICE_TEXTURES.map((t) => (
                  <button key={t.id} onClick={() => patch({ texture: t.id })} className={cn(pick, (editing.texture ?? "glossy") === t.id && pickOn)}>
                    <span className="block text-xs font-semibold text-mist-100">{t.label}</span>
                    <span className="block text-[10px] leading-snug text-mist-500">{t.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <span className="mb-1.5 block text-xs font-semibold text-mist-300">Shape</span>
              <div className="grid gap-1.5 sm:grid-cols-4">
                {DICE_SHAPES.map((s) => (
                  <button key={s.id} onClick={() => patch({ shape: s.id, cornerPct: undefined })} className={cn(pick, (editing.shape ?? "rounded") === s.id && pickOn)}>
                    <span className="block text-xs font-semibold text-mist-100">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 space-y-2.5">
              <Slider label="Corner rounding" value={editing.cornerPct ?? (DICE_SHAPES.find((s) => s.id === (editing.shape ?? "rounded"))?.corner ?? 20)} min={0} max={50} suffix="%" onChange={(v) => patch({ cornerPct: v })} />
              <Slider label="Dice size in game" value={editing.sizePct ?? 100} min={50} max={200} suffix="%" onChange={(v) => patch({ sizePct: v })} />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <ColorField label="Border colour" value={editing.borderColor ?? ""} onChange={(v) => patch({ borderColor: v })} clearable onClear={() => patch({ borderColor: "" })} hint="Leave empty for no border." />
              <ColorField label="Glow colour" value={editing.glowColor ?? ""} onChange={(v) => patch({ glowColor: v })} clearable onClear={() => patch({ glowColor: "" })} hint="Leave empty for no glow." />
            </div>
            {editing.borderColor && (
              <div className="mt-2.5"><Slider label="Border thickness" value={editing.borderWidth ?? 2} min={1} max={8} suffix="px" onChange={(v) => patch({ borderWidth: v })} /></div>
            )}
            <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm text-mist-300">
              <input type="checkbox" checked={editing.shadow !== false} onChange={(e) => patch({ shadow: e.target.checked })} className="size-4 accent-[var(--color-lotus-500)]" />
              Drop shadow (gives the die weight on the board)
            </label>
          </Card>

          {/* ===== Dots ===== */}
          <Card className="p-4">
            <h2 className="text-sm font-bold text-mist-100">Dots</h2>
            <p className="mt-0.5 text-xs text-mist-400">The default look of the dots. Any number can override this below.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <ColorField label="Dot colour" value={editing.pipColor ?? "#18181b"} onChange={(v) => patch({ pipColor: v })} />
              <div>
                <span className="mb-1.5 block text-xs font-semibold text-mist-300">Dot shape</span>
                <div className="flex flex-wrap gap-1.5">
                  {PIP_SHAPES.map((p) => (
                    <button key={p.id} onClick={() => patch({ pipShape: p.id })} className={cn("rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition", (editing.pipShape ?? "circle") === p.id ? "border-lotus-400/60 bg-lotus-500/15 text-lotus-100" : "border-line bg-ink-900 text-mist-300 hover:text-mist-100")}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3"><Slider label="Dot size" value={editing.pipSizePct ?? 64} min={30} max={95} suffix="%" onChange={(v) => patch({ pipSizePct: v })} /></div>
          </Card>

          {/* ===== Every number, individually ===== */}
          <Card className="p-4">
            <h2 className="text-sm font-bold text-mist-100">Each number 1–6</h2>
            <p className="mt-0.5 text-xs text-mist-400">
              Give every number its own design — the usual dots, the digit itself, any symbol you type,
              or your own uploaded picture for that number alone.
            </p>

            {/* One picture for the whole die (the simple case) */}
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-ink-900/50 p-3">
              <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-ink-950">
                {editing.faceImage
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={withBase(editing.faceImage)} alt="" className="size-full object-contain" />
                  : <span className="text-[10px] text-mist-600">None</span>}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-mist-100">One picture for the whole die</div>
                <div className="text-[11px] text-mist-500">Used for any number you haven&rsquo;t given its own design below. Square PNG, 256×256 is ideal.</div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => upload((url) => patch({ faceImage: url }))} disabled={uploading}>
                <Upload className="size-4" /> {uploading ? "Uploading…" : "Upload"}
              </Button>
              {editing.faceImage && <button onClick={() => patch({ faceImage: "" })} className="text-xs text-mist-500 hover:text-rose-300">Remove</button>}
            </div>

            <div className="mt-3 space-y-2">
              {FACE_NUMS.map((n) => {
                const f: DiceFaceStyle = editing.faces?.[String(n)] ?? {};
                const mode: FaceMode = f.mode ?? (editing.faceImage ? "image" : "pips");
                return (
                  <div key={n} className="rounded-xl border border-line bg-ink-900 p-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Die face={n} model={editing} className="size-12 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-mist-100">Number {n}</div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {FACE_MODES.map((fm) => (
                            <button
                              key={fm.id}
                              onClick={() => patchFace(n, { mode: fm.id })}
                              title={fm.hint}
                              className={cn("rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition", mode === fm.id ? "border-lotus-400/60 bg-lotus-500/15 text-lotus-100" : "border-line bg-ink-850 text-mist-300 hover:text-mist-100")}
                            >
                              {fm.label}
                            </button>
                          ))}
                          <button onClick={() => patchFace(n, { mode: undefined, image: "", symbol: "", pipColor: "", pipShape: undefined })} title="Back to this dice's default look" className="rounded-lg px-2 py-1 text-[11px] text-mist-500 hover:text-mist-200">
                            <RotateCcw className="mr-0.5 inline size-3" /> Default
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Mode-specific controls */}
                    {mode === "image" && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="secondary" onClick={() => upload((url) => patchFace(n, { mode: "image", image: url }))} disabled={uploading}>
                          <Upload className="size-4" /> Upload picture for {n}
                        </Button>
                        {f.image && <button onClick={() => patchFace(n, { image: "" })} className="text-xs text-mist-500 hover:text-rose-300">Remove</button>}
                        {!f.image && !editing.faceImage && <span className="text-[11px] text-amber-300">No picture yet — this number will look blank.</span>}
                      </div>
                    )}
                    {mode === "symbol" && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <input
                          value={f.symbol ?? ""}
                          onChange={(e) => patchFace(n, { mode: "symbol", symbol: e.target.value.slice(0, 4) })}
                          placeholder="e.g. ★  ♦  🌸  A"
                          className="h-9 w-40 rounded-lg border border-line bg-ink-800 px-3 text-center text-sm text-mist-100 outline-none focus:border-lotus-400/50"
                        />
                        <span className="text-[11px] text-mist-500">Any emoji or character. It takes the dot colour below.</span>
                      </div>
                    )}
                    {(mode === "pips" || mode === "number" || mode === "symbol") && (
                      <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                        <ColorField
                          label={mode === "pips" ? `Dot colour for ${n}` : `Colour for ${n}`}
                          value={f.pipColor ?? editing.pipColor ?? "#18181b"}
                          onChange={(v) => patchFace(n, { pipColor: v })}
                          clearable
                          onClear={() => patchFace(n, { pipColor: "" })}
                        />
                        {mode === "pips" && (
                          <div>
                            <span className="mb-1.5 block text-xs font-semibold text-mist-300">Dot shape for {n}</span>
                            <div className="flex flex-wrap gap-1">
                              {PIP_SHAPES.map((p) => (
                                <button key={p.id} onClick={() => patchFace(n, { pipShape: p.id as PipShape })} className={cn("rounded-lg border px-2 py-1 text-[11px] font-semibold transition", (f.pipShape ?? editing.pipShape ?? "circle") === p.id ? "border-lotus-400/60 bg-lotus-500/15 text-lotus-100" : "border-line bg-ink-850 text-mist-300 hover:text-mist-100")}>
                                  {p.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* ===== Rolling ===== */}
          <Card className="p-4">
            <h2 className="text-sm font-bold text-mist-100">Rolling animation</h2>
            <p className="mt-0.5 text-xs text-mist-400">How the die behaves from the moment a player taps Roll until it lands.</p>

            <div className="mt-3">
              <span className="mb-1.5 block text-xs font-semibold text-mist-300">Animation</span>
              <div className="grid gap-1.5 sm:grid-cols-4">
                {ROLL_STYLES.map((s) => (
                  <button key={s.id} onClick={() => patchRoll({ style: s.id })} className={cn(pick, (editing.roll?.style ?? "tumble") === s.id && pickOn)}>
                    <span className="block text-xs font-semibold text-mist-100">{s.label}</span>
                    <span className="block text-[10px] leading-snug text-mist-500">{s.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <span className="mb-1.5 block text-xs font-semibold text-mist-300">Speed</span>
              <div className="flex flex-wrap gap-1.5">
                {(["slow", "normal", "fast"] as const).map((s) => (
                  <button key={s} onClick={() => patchRoll({ speed: s, durationMs: s === "slow" ? 1100 : s === "fast" ? 420 : 700 })} className={cn("rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize transition", (editing.roll?.speed ?? "normal") === s ? "border-lotus-400/60 bg-lotus-500/15 text-lotus-100" : "border-line bg-ink-900 text-mist-300 hover:text-mist-100")}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <Slider label="Roll duration" value={editing.roll?.durationMs ?? 700} min={150} max={3000} step={50} suffix="ms" onChange={(v) => patchRoll({ durationMs: v })} />
            </div>

            <div className="mt-3">
              <span className="mb-1.5 block text-xs font-semibold text-mist-300">How it stops</span>
              <div className="grid gap-1.5 sm:grid-cols-3">
                {ROLL_STOPS.map((s) => (
                  <button key={s.id} onClick={() => patchRoll({ stop: s.id })} className={cn(pick, (editing.roll?.stop ?? "settle") === s.id && pickOn)}>
                    <span className="block text-xs font-semibold text-mist-100">{s.label}</span>
                    <span className="block text-[10px] leading-snug text-mist-500">{s.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <Button className="mt-3" variant="secondary" onClick={testRoll} disabled={rolling}>
              {rolling ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} Test this roll
            </Button>
          </Card>

          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-xs text-mist-400">
              The <b className="text-mist-200">Active</b> dice is what every player and spectator sees in Ludo and Snake &amp; Ladder.
            </p>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

const m_isNotActive = (id: string, activeId: string) => id !== activeId;

const inp = "h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400/50";
const pick = "rounded-lg border border-line bg-ink-900 p-2 text-left transition hover:border-lotus-400/40";
const pickOn = "border-lotus-400/60 bg-lotus-500/15";

function ColorField({ label, value, onChange, hint, clearable, onClear }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string;
  clearable?: boolean; onClear?: () => void;
}) {
  const hex = /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : "#ffffff";
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-mist-300">{label}</span>
      <span className="flex items-center gap-2">
        {/* Round indicator filled with the colour actually in use. */}
        <span className="size-7 shrink-0 rounded-full border-2 border-white/20" style={{ background: value || "transparent" }} />
        <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} className="h-9 w-11 shrink-0 cursor-pointer rounded-lg border border-line bg-ink-800 p-1" />
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="#ffffff" spellCheck={false} className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-ink-800 px-2.5 font-mono text-xs text-mist-100 outline-none focus:border-lotus-400/50" />
        {clearable && (
          <button onClick={onClear} title="Clear" className="shrink-0 rounded-lg border border-line bg-ink-800 px-2 py-1.5 text-[11px] text-mist-400 hover:text-mist-100">
            <RotateCcw className="size-3.5" />
          </button>
        )}
      </span>
      {hint && <span className="mt-1 block text-[10px] text-mist-500">{hint}</span>}
    </label>
  );
}

function Slider({ label, value, min, max, step = 1, suffix, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold text-mist-300">{label}</span>
        <span className="font-mono text-mist-400">{value}{suffix}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--color-lotus-500)]" />
    </label>
  );
}
