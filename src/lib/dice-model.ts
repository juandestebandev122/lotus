// ============================================================================
// DICE MODEL MANAGEMENT — the full dice customisation system.
//
// The old dice controls were an image upload and a handful of Tailwind classes:
// one picture shared by everybody, no per-face control, no colour, no shape, no
// animation control. This replaces that with a real model library.
//
// A MODEL describes an entire die:
//   • the body      — colour / gradient, texture, shape, corners, border, glow, size
//   • the pips      — colour, shape, size
//   • each face 1-6 — drawn pips, a big number, a symbol, or its OWN uploaded image
//   • the roll      — animation style, speed, duration and how it comes to rest
//
// Everything is plain data with no React imports, so the server config, the admin
// editor, the live preview and the in-game die all read the SAME definitions and
// can never drift apart.
// ============================================================================

export type DiceTexture = "glossy" | "matte" | "metal" | "wood" | "marble" | "glass" | "neon";
export type DiceShape = "rounded" | "soft" | "square" | "circle";
export type PipShape = "circle" | "square" | "diamond" | "star" | "heart" | "flower";
export type FaceMode = "pips" | "number" | "symbol" | "image";
export type RollStyle = "tumble" | "spin" | "flip" | "shake" | "bounce" | "wobble" | "zoom" | "roll2d";
export type RollStop = "snap" | "settle" | "wobble";

export const DICE_TEXTURES: { id: DiceTexture; label: string; hint: string }[] = [
  { id: "glossy", label: "Glossy", hint: "Shiny acrylic — the classic casino die" },
  { id: "matte", label: "Matte", hint: "Flat, no shine — clean and modern" },
  { id: "metal", label: "Metal", hint: "Brushed metallic sheen" },
  { id: "wood", label: "Wood", hint: "Warm wooden grain" },
  { id: "marble", label: "Marble", hint: "Polished stone" },
  { id: "glass", label: "Glass", hint: "Translucent, see-through" },
  { id: "neon", label: "Neon", hint: "Glowing edges, dark body" },
];

export const DICE_SHAPES: { id: DiceShape; label: string; corner: number }[] = [
  { id: "rounded", label: "Rounded", corner: 20 },
  { id: "soft", label: "Soft square", corner: 10 },
  { id: "square", label: "Sharp square", corner: 2 },
  { id: "circle", label: "Round", corner: 50 },
];

export const PIP_SHAPES: { id: PipShape; label: string }[] = [
  { id: "circle", label: "Dots" },
  { id: "square", label: "Squares" },
  { id: "diamond", label: "Diamonds" },
  { id: "star", label: "Stars" },
  { id: "heart", label: "Hearts" },
  { id: "flower", label: "Flowers" },
];

export const FACE_MODES: { id: FaceMode; label: string; hint: string }[] = [
  { id: "pips", label: "Dots", hint: "The usual dice dots for this number" },
  { id: "number", label: "Number", hint: "Show the digit itself, large" },
  { id: "symbol", label: "Symbol", hint: "Any emoji or character you type" },
  { id: "image", label: "Picture", hint: "Your own uploaded image for this number" },
];

export const ROLL_STYLES: { id: RollStyle; label: string; hint: string }[] = [
  { id: "tumble", label: "3-D Tumble", hint: "Realistic tumble on its axes (recommended)" },
  { id: "spin", label: "Spin", hint: "Fast flat spin" },
  { id: "flip", label: "Flip", hint: "Flips over vertically" },
  { id: "shake", label: "Shake", hint: "Quick side-to-side shake" },
  { id: "bounce", label: "Bounce", hint: "Hops while rolling" },
  { id: "wobble", label: "Wobble", hint: "Tilts and wobbles" },
  { id: "zoom", label: "Zoom pulse", hint: "Pulses bigger and smaller" },
  { id: "roll2d", label: "Flat roll", hint: "Simple 2-D spin (lightest)" },
];

export const ROLL_STOPS: { id: RollStop; label: string; hint: string }[] = [
  { id: "snap", label: "Snap", hint: "Stops dead on the number" },
  { id: "settle", label: "Settle", hint: "Eases to a stop (recommended)" },
  { id: "wobble", label: "Wobble", hint: "Rocks once before it settles" },
];

/** How ONE face (1-6) is drawn. Anything left unset falls back to the model. */
export interface DiceFaceStyle {
  mode?: FaceMode;
  /** Uploaded picture for THIS number (mode "image"). */
  image?: string;
  /** Emoji or character for THIS number (mode "symbol"). */
  symbol?: string;
  /** Per-face pip colour / shape override. */
  pipColor?: string;
  pipShape?: PipShape;
}

/** The roll behaviour of a model. Unset fields fall back to the global settings. */
export interface DiceRollCfg {
  style?: RollStyle;
  /** How long the roll animation plays, in milliseconds. */
  durationMs?: number;
  speed?: "slow" | "normal" | "fast";
  stop?: RollStop;
}

export interface DiceModel {
  id: string;
  name: string;
  enabled: boolean;
  /** Seeded models can be edited but never deleted, so a set always exists. */
  builtin?: boolean;
  order?: number;
  category?: string;
  /**
   * Coin price. 0 or unset = FREE for everyone (unchanged). Above 0 puts this
   * dice in the Store's Dice category on its own, and a player must buy it
   * before they can use it — the same rule as boards and tokens.
   */
  priceCoins?: number;
  /** How long a purchase lasts, in days. 0/unset = permanent (Frame Store rule). */
  validityDays?: number;

  // ---- body ----
  bodyColor?: string;
  /** Second colour — when set the body is a gradient from bodyColor to this. */
  bodyColor2?: string;
  texture?: DiceTexture;
  shape?: DiceShape;
  /** Corner rounding as a % of the die's size; overrides the shape's default. */
  cornerPct?: number;
  borderColor?: string;
  borderWidth?: number;
  /** Outer glow colour ("" = no glow). */
  glowColor?: string;
  shadow?: boolean;
  /** Overall size, as a % of the normal die (50-200). */
  sizePct?: number;
  /** One picture covering EVERY face (the simple case; per-face wins over it). */
  faceImage?: string;

  // ---- pips ----
  pipColor?: string;
  pipShape?: PipShape;
  /** Pip size as a % of its cell (30-95). */
  pipSizePct?: number;

  // ---- per-number styling ----
  faces?: Record<string, DiceFaceStyle>;

  // ---- rolling ----
  roll?: DiceRollCfg;
}

/** Six ready-made models so the admin starts with a real choice, not a blank page. */
export function defaultDiceModels(): DiceModel[] {
  return [
    {
      id: "classic-white", name: "Classic White", enabled: true, builtin: true, order: 0, category: "Free",
      bodyColor: "#ffffff", bodyColor2: "#e4e4e7", texture: "glossy", shape: "rounded",
      pipColor: "#18181b", pipShape: "circle", pipSizePct: 64, shadow: true, sizePct: 100,
      roll: { style: "tumble", durationMs: 700, speed: "normal", stop: "settle" },
    },
    {
      id: "midnight", name: "Midnight Black", enabled: true, builtin: true, order: 1, category: "Free",
      bodyColor: "#18181b", bodyColor2: "#3f3f46", texture: "matte", shape: "rounded",
      pipColor: "#fafafa", pipShape: "circle", pipSizePct: 62, shadow: true, sizePct: 100,
      roll: { style: "tumble", durationMs: 700, speed: "normal", stop: "settle" },
    },
    {
      id: "royal-gold", name: "Royal Gold", enabled: true, builtin: true, order: 2, category: "Premium",
      bodyColor: "#fbbf24", bodyColor2: "#b45309", texture: "metal", shape: "rounded",
      pipColor: "#3b1d00", pipShape: "diamond", pipSizePct: 60, shadow: true,
      borderColor: "#fde68a", borderWidth: 2, sizePct: 100,
      roll: { style: "tumble", durationMs: 800, speed: "normal", stop: "wobble" },
    },
    {
      id: "lotus-violet", name: "Lotus Violet", enabled: true, builtin: true, order: 3, category: "Free",
      bodyColor: "#7c5cfc", bodyColor2: "#4c1d95", texture: "glossy", shape: "rounded",
      pipColor: "#ffffff", pipShape: "flower", pipSizePct: 66, shadow: true, sizePct: 100,
      roll: { style: "tumble", durationMs: 700, speed: "normal", stop: "settle" },
    },
    {
      id: "neon-glow", name: "Neon Glow", enabled: true, builtin: true, order: 4, category: "Event",
      bodyColor: "#0b1020", bodyColor2: "#111a33", texture: "neon", shape: "soft",
      pipColor: "#22d3ee", pipShape: "circle", pipSizePct: 58, glowColor: "#22d3ee",
      borderColor: "#22d3ee", borderWidth: 2, shadow: true, sizePct: 100,
      roll: { style: "spin", durationMs: 900, speed: "fast", stop: "snap" },
    },
    {
      id: "wooden", name: "Wooden", enabled: true, builtin: true, order: 5, category: "Free",
      bodyColor: "#b98150", bodyColor2: "#7c4a21", texture: "wood", shape: "soft",
      pipColor: "#2b1608", pipShape: "circle", pipSizePct: 62, shadow: true, sizePct: 100,
      roll: { style: "bounce", durationMs: 750, speed: "normal", stop: "settle" },
    },
  ];
}

/** Admin edits merged over the built-ins, then any admin-added models appended. */
export function resolveDiceModels(cfg?: DiceModel[] | null): DiceModel[] {
  const base = defaultDiceModels();
  if (!cfg?.length) return base;
  const merged = base.map((b) => {
    const o = cfg.find((x) => x.id === b.id);
    return o ? { ...b, ...o, builtin: true, faces: { ...(b.faces ?? {}), ...(o.faces ?? {}) }, roll: { ...(b.roll ?? {}), ...(o.roll ?? {}) } } : b;
  });
  const extra = cfg.filter((c) => !base.some((b) => b.id === c.id));
  return [...merged, ...extra].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** Only the models players may actually get. */
export function enabledDiceModels(cfg?: DiceModel[] | null): DiceModel[] {
  return resolveDiceModels(cfg).filter((m) => m.enabled !== false);
}

/**
 * THE model the game must draw right now: the admin's active choice, falling back
 * to the first enabled model. This is the single lookup every game screen uses,
 * which is what makes one admin choice apply everywhere consistently.
 */
export function activeDiceModel(cfg?: DiceModel[] | null, activeId?: string): DiceModel {
  const all = resolveDiceModels(cfg);
  const found = activeId ? all.find((m) => m.id === activeId && m.enabled !== false) : undefined;
  return found ?? all.find((m) => m.enabled !== false) ?? all[0] ?? defaultDiceModels()[0];
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
/** Only a validated colour may reach an inline style. */
const color = (v?: string, fallback = "") => {
  const s = (v ?? "").trim();
  if (!s) return fallback;
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) return s;
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/i.test(s)) return s;
  return fallback;
};

/** The texture layer painted over the body colour. */
function textureLayer(t: DiceTexture | undefined): string {
  switch (t) {
    case "metal":
      return "linear-gradient(135deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 35%, rgba(0,0,0,0.18) 60%, rgba(255,255,255,0.35) 100%)";
    case "wood":
      return "repeating-linear-gradient(96deg, rgba(0,0,0,0.10) 0 2px, rgba(255,255,255,0.05) 2px 6px)";
    case "marble":
      return "radial-gradient(120% 90% at 20% 10%, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0) 45%), repeating-linear-gradient(115deg, rgba(0,0,0,0.06) 0 3px, rgba(255,255,255,0.05) 3px 9px)";
    case "glass":
      return "linear-gradient(160deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.08) 45%, rgba(255,255,255,0.30) 100%)";
    case "neon":
      return "radial-gradient(90% 70% at 50% 15%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 60%)";
    case "matte":
      return "";
    case "glossy":
    default:
      return "linear-gradient(160deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 42%)";
  }
}

/** Inline style for the die BODY, built from a model. */
export function diceBodyStyle(m: DiceModel): React.CSSProperties {
  const c1 = color(m.bodyColor, "#ffffff");
  const c2 = color(m.bodyColor2);
  const base = c2 ? `linear-gradient(160deg, ${c1} 0%, ${c2} 100%)` : c1;
  const tex = textureLayer(m.texture);
  const shapeCorner = DICE_SHAPES.find((s) => s.id === (m.shape ?? "rounded"))?.corner ?? 20;
  const corner = clamp(m.cornerPct ?? shapeCorner, 0, 50);
  const border = color(m.borderColor);
  const glow = color(m.glowColor);
  const shadows: string[] = [];
  if (m.shadow !== false) shadows.push("0 14px 30px -10px rgba(0,0,0,0.6)");
  if (m.texture !== "matte") shadows.push("inset 0 3px 5px rgba(255,255,255,0.55)", "inset 0 -8px 14px rgba(0,0,0,0.16)");
  if (glow) shadows.push(`0 0 14px ${glow}`, `0 0 30px ${glow}`);

  return {
    background: tex ? `${tex}, ${base}` : base,
    borderRadius: `${corner}%`,
    ...(border ? { border: `${clamp(m.borderWidth ?? 2, 1, 8)}px solid ${border}` } : {}),
    ...(shadows.length ? { boxShadow: shadows.join(", ") } : {}),
    ...(m.texture === "glass" ? { opacity: 0.9 } : {}),
  };
}

/** The clip-path that turns a square pip into the chosen shape. */
export function pipClipPath(shape: PipShape | undefined): string | undefined {
  switch (shape) {
    case "square": return undefined;
    case "diamond": return "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";
    case "star": return "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)";
    case "heart": return "path('M12 21s-8-4.9-8-10.4A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 3.6C20 16.1 12 21 12 21z')";
    case "flower": return "polygon(50% 0%, 65% 25%, 93% 20%, 80% 46%, 100% 68%, 71% 74%, 62% 100%, 42% 79%, 14% 89%, 18% 61%, 0% 40%, 27% 32%, 30% 4%)";
    case "circle":
    default: return undefined; // circles use border-radius, not a clip-path
  }
}

/** How ONE number is drawn, with the model's defaults filled in. */
export function faceStyleFor(m: DiceModel, face: number): Required<Pick<DiceFaceStyle, "mode">> & DiceFaceStyle {
  const f = m.faces?.[String(face)] ?? {};
  // A whole-die picture counts as "image" for every face the admin hasn't set.
  const fallbackMode: FaceMode = m.faceImage?.trim() ? "image" : "pips";
  return {
    mode: f.mode ?? fallbackMode,
    image: (f.image?.trim() || (f.mode ? "" : m.faceImage?.trim()) || "") || undefined,
    symbol: f.symbol,
    pipColor: color(f.pipColor) || color(m.pipColor, "#18181b"),
    pipShape: f.pipShape ?? m.pipShape ?? "circle",
  };
}

/** Milliseconds the roll animation should run for this model. */
export function rollDurationMs(m: DiceModel, globalSpeed?: "slow" | "normal" | "fast"): number {
  const speed = m.roll?.speed ?? globalSpeed ?? "normal";
  const explicit = m.roll?.durationMs;
  if (typeof explicit === "number" && isFinite(explicit)) return clamp(Math.round(explicit), 150, 5000);
  return speed === "slow" ? 1100 : speed === "fast" ? 420 : 700;
}

/** The easing that gives the chosen stopping style its feel. */
export function rollEasing(stop: RollStop | undefined): string {
  switch (stop) {
    case "snap": return "steps(8, end)";
    case "wobble": return "cubic-bezier(0.34, 1.56, 0.64, 1)";
    case "settle":
    default: return "cubic-bezier(0.16, 1, 0.3, 1)";
  }
}

/** A blank model for "add new" in the admin. */
export function newDiceModel(order: number): DiceModel {
  return {
    id: `dice_${Math.random().toString(36).slice(2, 9)}`,
    name: "New dice",
    enabled: true,
    order,
    category: "Free",
    bodyColor: "#ffffff",
    bodyColor2: "#d4d4d8",
    texture: "glossy",
    shape: "rounded",
    pipColor: "#18181b",
    pipShape: "circle",
    pipSizePct: 64,
    shadow: true,
    sizePct: 100,
    roll: { style: "tumble", durationMs: 700, speed: "normal", stop: "settle" },
  };
}
