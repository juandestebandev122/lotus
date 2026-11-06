"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { LudoToken } from "@/components/LudoToken";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import {
  HOME_COLORS, HOME_LABEL, HOME_SWATCH, HOME_BG_MODES, SLOT_BG_MODES, LAYER_MODES,
  defaultHomeArea, defaultSlot,
  type HomeAreaCfg, type HomeAreasCfg, type HomeColor, type TokenSlotCfg, type HomeBgMode, type SlotBgMode, type LayerMode,
} from "@/lib/home-areas";
import { Check, RotateCcw, Upload, Info, Trash2, SlidersHorizontal, Grid2x2, ArrowLeft } from "lucide-react";

// ---------------------------------------------------------------------------
// ADMIN → TOKEN PLACEMENT AREAS
// The four home corners (Red / Green / Yellow / Blue), each configured on its
// own, plus every one of their four token slots. Appearance only: the Ludo
// engine is never touched, so hiding a background, a slot or a whole home never
// disables a game function — the uploaded board controls the look while the
// engine keeps controlling the game.
// ---------------------------------------------------------------------------

type Areas = Record<HomeColor, HomeAreaCfg>;

function seedAreas(cfg?: HomeAreasCfg): Areas {
  const out = {} as Areas;
  for (const c of HOME_COLORS) {
    const a = cfg?.areas?.[c] ?? {};
    const d = defaultHomeArea();
    out[c] = {
      ...d,
      ...a,
      slots: [0, 1, 2, 3].map((i) => ({ ...defaultSlot(), ...(a.slots?.[i] ?? {}) })),
    };
  }
  return out;
}

export default function AdminTokenAreasPage() {
  const { toast } = useToast();
  const { config, reload, loading } = useConfig();

  const [enabled, setEnabled] = useState(config.gameBoard?.homeAreas?.enabled === true);
  const [areas, setAreas] = useState<Areas>(() => seedAreas(config.gameBoard?.homeAreas));
  const [active, setActive] = useState<HomeColor>("red");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const seeded = useRef(false);

  // Seed from the real saved config once it has loaded (the provider starts on
  // defaults, so seeding straight away would look like everything was reset).
  useEffect(() => {
    if (loading || seeded.current) return;
    seeded.current = true;
    setEnabled(config.gameBoard?.homeAreas?.enabled === true);
    setAreas(seedAreas(config.gameBoard?.homeAreas));
  }, [loading, config.gameBoard?.homeAreas]);

  const a = areas[active];
  const setArea = (patch: Partial<HomeAreaCfg>) => setAreas((s) => ({ ...s, [active]: { ...s[active], ...patch } }));
  const setSlot = (i: number, patch: Partial<TokenSlotCfg>) =>
    setAreas((s) => ({
      ...s,
      [active]: { ...s[active], slots: (s[active].slots ?? []).map((sl, idx) => (idx === i ? { ...sl, ...patch } : sl)) },
    }));

  const upload = async (apply: (url: string) => void) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploading(true);
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch(withBase("/api/admin/tokens"), { method: "POST", body: fd, credentials: "include" });
        const d = await res.json();
        if (res.ok && d.url) { apply(d.url as string); toast("Image uploaded — press Save to make it live.", "success"); }
        else toast(d.error ?? "Upload failed", "error");
      } catch { toast("Upload failed", "error"); }
      setUploading(false);
    };
    input.click();
  };

  const save = async () => {
    setSaving(true);
    const res = await saveConfig({ gameBoard: { ...(config.gameBoard ?? {}), homeAreas: { enabled, areas } } });
    setSaving(false);
    if (res.ok) { await reload(); toast("Token placement areas saved — live for all players.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const resetArea = () => { setAreas((s) => ({ ...s, [active]: defaultHomeArea() })); toast(`${HOME_LABEL[active]} reset — press Save to apply.`, "info"); };
  const copyToAll = () => {
    const src = areas[active];
    setAreas(() => {
      const out = {} as Areas;
      for (const c of HOME_COLORS) out[c] = JSON.parse(JSON.stringify(src)) as HomeAreaCfg;
      return out;
    });
    toast(`${HOME_LABEL[active]} copied to all four homes — press Save to apply.`, "info");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
            <Grid2x2 className="size-6 text-lotus-300" /> Token Placement Areas
          </h1>
          <p className="max-w-3xl text-sm text-mist-400">
            Full control of the four home corners and the sixteen token slots inside them. Set each home&apos;s background —
            show, hide, transparent, white, a custom colour or a custom image — and place, size, rotate and style every
            single token slot on its own.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/game-board" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium text-mist-300 transition hover:text-mist-100">
            <ArrowLeft className="size-4" /> Game Board
          </Link>
          <Button onClick={save} disabled={saving}><Check className="size-4" /> {saving ? "Saving…" : "Save changes"}</Button>
        </div>
      </div>

      {/* The one thing that matters most: the white area behind the tokens. */}
      <div className="flex items-start gap-2 rounded-xl border border-sky-400/25 bg-sky-500/[0.06] px-4 py-3 text-xs text-mist-300">
        <Info className="mt-0.5 size-4 shrink-0 text-sky-300" />
        <p>
          <b className="text-mist-100">Appearance only.</b> Hiding a background, a slot or an entire home area never removes a token,
          blocks a move or changes a rule — the uploaded board design controls how the board <i>looks</i> while the Ludo engine keeps
          controlling how it <i>plays</i>. Turn <b className="text-mist-100">Hide White Token Area</b> on to make the white box behind the four
          parked tokens completely transparent so your board art shows through.
        </p>
      </div>

      {/* Master switch */}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-mist-100">Use per-home placement settings</div>
          <p className="text-xs text-mist-500">
            Off — every home keeps the current look (including the older global &ldquo;hide white token area&rdquo; switch on the Game Board page).
            On — the settings below take over, one home at a time.
          </p>
        </div>
        <button onClick={() => setEnabled(!enabled)} aria-pressed={enabled} className={cn("relative h-7 w-14 shrink-0 rounded-full transition", enabled ? "bg-emerald-500" : "bg-mist-600")}>
          <span className={cn("absolute top-0.5 grid size-6 place-items-center rounded-full bg-white text-[9px] font-bold transition-all", enabled ? "left-[calc(100%-1.625rem)] text-emerald-600" : "left-0.5 text-mist-500")}>{enabled ? "ON" : "OFF"}</span>
        </button>
      </Card>

      {/* Which home are we editing */}
      <div className="flex flex-wrap gap-2">
        {HOME_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setActive(c)}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition",
              active === c ? "border-lotus-400/60 bg-lotus-500/15 text-mist-100" : "border-line bg-ink-900 text-mist-400 hover:text-mist-100",
            )}
          >
            <span className="size-3 rounded-full" style={{ background: HOME_SWATCH[c] }} />
            {HOME_LABEL[c]}
            {areas[c].hideWhite && <span className="rounded-full bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-300">white off</span>}
          </button>
        ))}
      </div>

      <div className={cn("grid gap-4 lg:grid-cols-[1fr_20rem]", !enabled && "pointer-events-none opacity-50")}>
        <div className="space-y-4">
          {/* ---- Home area background ---- */}
          <Card className="p-4 sm:p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100">
              <span className="size-3 rounded-full" style={{ background: HOME_SWATCH[active] }} /> {HOME_LABEL[active]} — background
            </h2>
            <p className="mt-0.5 text-sm text-mist-400">How the area behind this player&apos;s four parked tokens is painted.</p>

            <div className="mt-4 rounded-xl border border-sky-400/30 bg-sky-500/[0.06] p-3">
              <ToggleRow
                label="Hide White Token Area"
                desc="ON = the white box behind the four tokens becomes completely transparent, so the uploaded board design shows through untouched. The tokens themselves stay exactly where they are and stay playable."
                on={a.hideWhite === true}
                onToggle={() => setArea({ hideWhite: !a.hideWhite })}
              />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Background">
                <select value={a.bgMode ?? "default"} onChange={(e) => setArea({ bgMode: e.target.value as HomeBgMode })} className={selectCls}>
                  {HOME_BG_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </Field>
              <Field label="Layer">
                <select value={a.layer ?? "aboveBoard"} onChange={(e) => setArea({ layer: e.target.value as LayerMode })} className={selectCls}>
                  {LAYER_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </Field>
            </div>

            {(a.bgMode === "color" || a.bgMode === "show") && (
              <div className="mt-3 flex items-center gap-3">
                <span className="text-sm font-semibold text-mist-200">Custom colour</span>
                <input type="color" value={a.bgColor || "#ffffff"} onChange={(e) => setArea({ bgColor: e.target.value })} className="h-9 w-16 cursor-pointer rounded-lg border border-line bg-ink-900" />
                <input value={a.bgColor ?? ""} onChange={(e) => setArea({ bgColor: e.target.value })} placeholder="#ffffff" className="h-9 w-32 rounded-lg border border-line bg-ink-900 px-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400" />
                {a.bgColor && <button onClick={() => setArea({ bgColor: "" })} className="text-xs text-mist-500 hover:text-rose-300">clear</button>}
              </div>
            )}

            {a.bgMode === "image" && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-ink-900">
                  {a.bgImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={withBase(a.bgImage)} alt="" className="size-full object-cover" />
                  ) : <span className="text-[10px] text-mist-600">None</span>}
                </div>
                <Button size="sm" variant="secondary" onClick={() => upload((url) => setArea({ bgImage: url }))} disabled={uploading}>
                  <Upload className="size-4" /> {uploading ? "Uploading…" : "Upload image"}
                </Button>
                {a.bgImage && (
                  <button onClick={() => setArea({ bgImage: "" })} className="inline-flex items-center gap-1 text-xs text-mist-500 hover:text-rose-300"><Trash2 className="size-3.5" /> Remove</button>
                )}
              </div>
            )}

            <div className="mt-3 space-y-2.5">
              <Slider label="Image / colour opacity" value={a.bgOpacityPct ?? 100} min={0} max={100} suffix="%" onChange={(v) => setArea({ bgOpacityPct: v })} />
              <ToggleRow
                label="Show the coloured frame"
                desc="The coloured border drawn around this corner. Turn it off for a completely clean corner on a custom board."
                on={a.showBorder !== false}
                onToggle={() => setArea({ showBorder: a.showBorder === false })}
              />
            </div>
          </Card>

          {/* ---- Token slots ---- */}
          <Card className="p-4 sm:p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100">
              <SlidersHorizontal className="size-5 text-lotus-300" /> Token slots — {HOME_LABEL[active]}
            </h2>
            <p className="mt-0.5 text-sm text-mist-400">
              Each of this home&apos;s four token positions, controlled on its own. Hiding a slot only hides its decoration —
              a token parked there is still drawn and still playable.
            </p>

            <div className="mt-4 space-y-3">
              {(a.slots ?? []).map((s, i) => (
                <div key={i} className="rounded-xl border border-line bg-ink-800/50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-xs font-bold uppercase tracking-wide text-lotus-200">Token slot {i + 1}</div>
                    <button
                      onClick={() => setSlot(i, { visible: !(s.visible !== false) })}
                      className={cn("rounded-lg px-2.5 py-1 text-[11px] font-semibold transition", s.visible !== false ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300")}
                    >
                      Slot visibility: {s.visible !== false ? "ON" : "OFF"}
                    </button>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <Slider label="X position" value={s.xPct ?? 0} min={-150} max={150} suffix="%" onChange={(v) => setSlot(i, { xPct: v })} />
                    <Slider label="Y position" value={s.yPct ?? 0} min={-150} max={150} suffix="%" onChange={(v) => setSlot(i, { yPct: v })} />
                    <Slider label="Width" value={s.widthPct ?? 100} min={20} max={200} suffix="%" onChange={(v) => setSlot(i, { widthPct: v })} />
                    <Slider label="Height" value={s.heightPct ?? 100} min={20} max={200} suffix="%" onChange={(v) => setSlot(i, { heightPct: v })} />
                    <Slider label="Token size" value={s.tokenSizePct ?? 100} min={40} max={200} suffix="%" onChange={(v) => setSlot(i, { tokenSizePct: v })} />
                    <Slider label="Token rotation" value={s.rotateDeg ?? 0} min={-180} max={180} suffix="°" onChange={(v) => setSlot(i, { rotateDeg: v })} />
                    <Slider label="Slot opacity" value={s.opacityPct ?? 100} min={0} max={100} suffix="%" onChange={(v) => setSlot(i, { opacityPct: v })} />
                    <Field label="Slot layer">
                      <select value={s.layer ?? "aboveBoard"} onChange={(e) => setSlot(i, { layer: e.target.value as LayerMode })} className={selectCls}>
                        {LAYER_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Slot background">
                      <select value={s.bgMode ?? "default"} onChange={(e) => setSlot(i, { bgMode: e.target.value as SlotBgMode })} className={selectCls}>
                        {SLOT_BG_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Slot border">
                      <button
                        onClick={() => setSlot(i, { border: !(s.border !== false) })}
                        className={cn("h-9 w-full rounded-lg border px-2.5 text-left text-sm transition", s.border !== false ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200" : "border-line bg-ink-900 text-mist-400")}
                      >
                        {s.border !== false ? "Border ON" : "Border OFF"}
                      </button>
                    </Field>
                  </div>

                  {s.bgMode === "color" && (
                    <div className="mt-2.5 flex items-center gap-3">
                      <span className="text-xs font-semibold text-mist-300">Slot colour</span>
                      <input type="color" value={s.bgColor || "#ffffff"} onChange={(e) => setSlot(i, { bgColor: e.target.value })} className="h-8 w-14 cursor-pointer rounded-lg border border-line bg-ink-900" />
                    </div>
                  )}
                  {s.bgMode === "image" && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-3">
                      <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-ink-900">
                        {s.bgImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={withBase(s.bgImage)} alt="" className="size-full object-cover" />
                        ) : <span className="text-[9px] text-mist-600">None</span>}
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => upload((url) => setSlot(i, { bgImage: url }))} disabled={uploading}>
                        <Upload className="size-4" /> Upload
                      </Button>
                      {s.bgImage && <button onClick={() => setSlot(i, { bgImage: "" })} className="text-xs text-mist-500 hover:text-rose-300">remove</button>}
                    </div>
                  )}
                  {s.border !== false && (
                    <div className="mt-2.5 flex items-center gap-3">
                      <span className="text-xs font-semibold text-mist-300">Border colour</span>
                      <input type="color" value={s.borderColor || "#000000"} onChange={(e) => setSlot(i, { borderColor: e.target.value })} className="h-8 w-14 cursor-pointer rounded-lg border border-line bg-ink-900" />
                      {s.borderColor && <button onClick={() => setSlot(i, { borderColor: "" })} className="text-xs text-mist-500 hover:text-rose-300">default</button>}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-4">
              <button onClick={resetArea} className="inline-flex items-center gap-1.5 text-sm font-semibold text-mist-400 transition hover:text-mist-100"><RotateCcw className="size-4" /> Reset {HOME_LABEL[active]}</button>
              <button onClick={copyToAll} className="inline-flex items-center gap-1.5 text-sm font-semibold text-lotus-300 transition hover:text-lotus-200">Copy these settings to all four homes</button>
            </div>
          </Card>
        </div>

        {/* ---- Live preview ---- */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card className="p-4">
            <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-mist-500">{HOME_LABEL[active]} preview</p>
            <HomePreview color={active} area={a} />
            <p className="mt-2 text-center text-[10px] leading-snug text-mist-500">
              A rough preview of the home corner. Check it against your uploaded board on the Game Board page.
            </p>
          </Card>
        </div>
      </div>

      {!enabled && (
        <p className="rounded-lg bg-ink-800/60 px-3 py-2 text-xs text-mist-500">
          The panel is OFF — the settings above are saved but not applied. Switch it on to take control of the four home areas.
        </p>
      )}
    </div>
  );
}

const selectCls = "h-9 w-full rounded-lg border border-line bg-ink-900 px-2 text-sm text-mist-100 outline-none focus:border-lotus-400";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-mist-300">{label}</span>
      {children}
    </label>
  );
}

function ToggleRow({ label, desc, on, onToggle }: { label: string; desc: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-mist-100">{label}</div>
        <div className="text-xs text-mist-500">{desc}</div>
      </div>
      <button onClick={onToggle} className={cn("relative mt-0.5 h-7 w-14 shrink-0 rounded-full transition", on ? "bg-emerald-500" : "bg-mist-600")} aria-pressed={on}>
        <span className={cn("absolute top-0.5 grid size-6 place-items-center rounded-full bg-white text-[9px] font-bold transition-all", on ? "left-[calc(100%-1.625rem)] text-emerald-600" : "left-0.5 text-mist-500")}>{on ? "ON" : "OFF"}</span>
      </button>
    </div>
  );
}

function Slider({ label, value, min, max, suffix, onChange }: {
  label: string; value: number; min: number; max: number; suffix?: string; onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold text-mist-200">{label}</span>
        <span className="tabular-nums text-mist-400">{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-lotus-400" />
    </label>
  );
}

/** A rough live preview of one home corner with its four token slots. */
function HomePreview({ color, area }: { color: HomeColor; area: HomeAreaCfg }) {
  const hide = area.hideWhite === true || area.bgMode === "hide" || area.bgMode === "transparent" || area.layer === "hidden";
  const opacity = Math.max(0, Math.min(100, area.bgOpacityPct ?? 100)) / 100;
  const bg: React.CSSProperties = hide
    ? {}
    : area.bgMode === "image" && area.bgImage
      ? { backgroundImage: `url(${withBase(area.bgImage)})`, backgroundSize: "cover", backgroundPosition: "center", opacity }
      : area.bgMode === "color" || area.bgMode === "show"
        ? { background: area.bgColor || "#ffffff", opacity }
        : { background: "#ffffff", opacity };

  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-[15rem] rounded-xl border-2 p-2"
      style={{
        borderColor: area.showBorder === false ? "transparent" : HOME_SWATCH[color],
        // A checkerboard stands in for "the uploaded board shows through here".
        backgroundImage:
          "linear-gradient(45deg,#2a2a3a 25%,transparent 25%),linear-gradient(-45deg,#2a2a3a 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#2a2a3a 75%),linear-gradient(-45deg,transparent 75%,#2a2a3a 75%)",
        backgroundSize: "16px 16px",
        backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
      }}
    >
      <div className="relative grid size-full grid-cols-2 grid-rows-2 place-items-center gap-1.5 overflow-hidden rounded-lg p-2" style={bg}>
        {[0, 1, 2, 3].map((i) => {
          const s = { ...defaultSlot(), ...(area.slots?.[i] ?? {}) };
          const on = s.visible !== false && s.layer !== "hidden";
          return (
            <div
              key={i}
              className="grid place-items-center"
              style={{
                width: `${s.widthPct}%`,
                height: `${s.heightPct}%`,
                transform: `translate(${s.xPct}%, ${s.yPct}%)`,
                opacity: Math.max(0, Math.min(100, s.opacityPct)) / 100,
              }}
            >
              {on && (
                <span
                  className="grid size-4/5 place-items-center rounded-full"
                  style={{
                    ...(s.bgMode === "white" ? { background: "#fff" } : {}),
                    ...(s.bgMode === "color" && s.bgColor ? { background: s.bgColor } : {}),
                    ...(s.bgMode === "image" && s.bgImage ? { backgroundImage: `url(${withBase(s.bgImage)})`, backgroundSize: "cover" } : {}),
                    ...(s.border !== false ? { border: `2px dashed ${s.borderColor || "rgba(0,0,0,0.25)"}` } : {}),
                  }}
                >
                  <span className="block size-3/4" style={{ transform: `scale(${s.tokenSizePct / 100}) rotate(${s.rotateDeg}deg)` }}>
                    <LudoToken color={color} skin="royal-lotus" />
                  </span>
                </span>
              )}
              {!on && (
                <span className="block size-3/4" style={{ transform: `scale(${s.tokenSizePct / 100}) rotate(${s.rotateDeg}deg)` }}>
                  <LudoToken color={color} skin="royal-lotus" />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
