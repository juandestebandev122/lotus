// Theme Management — Phase 1. A "theme" is a saved bundle of the app's EXISTING, safe
// appearance controls (accent colours, button/bubble shape, custom CSS). Activating a
// theme just writes these into config.themeColor / themeColor2 / uiStyle / customCss,
// which the existing live injectors apply — so a theme change can only alter appearance,
// never functionality. Ready-made themes ship as `builtin` (can be activated/duplicated
// but not deleted). Admins can create unlimited custom themes on top.

export interface ThemePreset {
  id: string;
  name: string;
  builtin?: boolean;
  primary?: string;    // hex → config.themeColor (primary accent). "" = app default violet.
  secondary?: string;  // hex → config.themeColor2 (secondary accent). "" = app default pink.
  buttonShape?: "sharp" | "rounded" | "pill";   // → config.uiStyle.buttonShape
  chatBubbleShape?: "sharp" | "rounded" | "round"; // → config.uiStyle.chatBubbleShape
  customCss?: string;  // → config.customCss (advanced, app-wide)
  // ---- SURFACES (what makes the app feel light or dark) --------------------
  surface?: string;          // hex tint for every panel/card/canvas ("" = built-in violet)
  surfaceBrightness?: number; // 0 = deepest, 100 = much lighter & airier
  glow?: number;              // 0–100 strength of the colourful background glows
  bgImage?: string;           // optional background picture behind everything
  createdAt?: string;
  createdBy?: string;
}

// Professional starter themes. Colours drive the accent ramps; surfaces stay the app's
// dark base (a full light/surface re-skin is Phase 2). Tuned to look distinct + clean.
export const DEFAULT_THEMES: ThemePreset[] = [
  // The original look, untouched.
  { id: "classic", name: "Default / Classic", builtin: true, primary: "", secondary: "", surface: "", surfaceBrightness: 0, glow: 100, buttonShape: "rounded", chatBubbleShape: "rounded" },

  // ---- BRIGHTER, MORE COLOURFUL (the "less dark" family) ------------------
  { id: "daylight", name: "Daylight — bright & airy", builtin: true, primary: "#6d5cff", secondary: "#ff6fae", surface: "#8f88c9", surfaceBrightness: 92, glow: 55, buttonShape: "rounded", chatBubbleShape: "round" },
  { id: "softcloud", name: "Soft Cloud — light neutral", builtin: true, primary: "#5b6cff", secondary: "#22c3a6", surface: "#9aa0b8", surfaceBrightness: 88, glow: 40, buttonShape: "rounded", chatBubbleShape: "round" },
  { id: "sunrise", name: "Sunrise — warm & friendly", builtin: true, primary: "#f97316", secondary: "#ec4899", surface: "#c2857a", surfaceBrightness: 78, glow: 80, buttonShape: "pill", chatBubbleShape: "round" },
  { id: "mint", name: "Fresh Mint — calm & clean", builtin: true, primary: "#10b981", secondary: "#38bdf8", surface: "#7fae9f", surfaceBrightness: 80, glow: 55, buttonShape: "rounded", chatBubbleShape: "round" },
  { id: "sky", name: "Open Sky — light blue", builtin: true, primary: "#2563eb", secondary: "#06b6d4", surface: "#8098c4", surfaceBrightness: 85, glow: 50, buttonShape: "rounded", chatBubbleShape: "rounded" },

  // ---- MID-TONE (colourful but still easy on the eyes) --------------------
  { id: "ocean", name: "Ocean — deep blue", builtin: true, primary: "#38bdf8", secondary: "#818cf8", surface: "#1e3a8a", surfaceBrightness: 38, glow: 90, buttonShape: "rounded", chatBubbleShape: "round" },
  { id: "emerald", name: "Emerald — rich green", builtin: true, primary: "#34d399", secondary: "#a3e635", surface: "#064e3b", surfaceBrightness: 34, glow: 85, buttonShape: "rounded", chatBubbleShape: "rounded" },
  { id: "plum", name: "Plum — warm purple", builtin: true, primary: "#c084fc", secondary: "#f472b6", surface: "#4c1d95", surfaceBrightness: 36, glow: 95, buttonShape: "pill", chatBubbleShape: "round" },
  { id: "sunset", name: "Sunset — orange & rose", builtin: true, primary: "#fb923c", secondary: "#f43f5e", surface: "#7c2d12", surfaceBrightness: 32, glow: 95, buttonShape: "pill", chatBubbleShape: "round" },
  { id: "teal", name: "Teal — cool & modern", builtin: true, primary: "#2dd4bf", secondary: "#60a5fa", surface: "#134e4a", surfaceBrightness: 36, glow: 80, buttonShape: "rounded", chatBubbleShape: "rounded" },
  { id: "royal", name: "Royal — indigo & gold", builtin: true, primary: "#818cf8", secondary: "#fbbf24", surface: "#312e81", surfaceBrightness: 34, glow: 90, buttonShape: "pill", chatBubbleShape: "round" },

  // ---- DEEP (the original dark family, re-tuned) ---------------------------
  { id: "modern", name: "Modern", builtin: true, primary: "#6366f1", secondary: "#22d3ee", surface: "#1e1b4b", surfaceBrightness: 12, glow: 100, buttonShape: "rounded", chatBubbleShape: "rounded" },
  { id: "business", name: "Business", builtin: true, primary: "#2563eb", secondary: "#0ea5e9", surface: "#0f172a", surfaceBrightness: 10, glow: 45, buttonShape: "sharp", chatBubbleShape: "sharp" },
  { id: "luxury", name: "Luxury", builtin: true, primary: "#a855f7", secondary: "#f59e0b", surface: "#1c1130", surfaceBrightness: 8, glow: 100, buttonShape: "pill", chatBubbleShape: "round" },
  { id: "gaming", name: "Gaming", builtin: true, primary: "#22d3ee", secondary: "#a3e635", surface: "#0b1220", surfaceBrightness: 6, glow: 100, buttonShape: "sharp", chatBubbleShape: "rounded" },
  { id: "social", name: "Social", builtin: true, primary: "#3b82f6", secondary: "#ec4899", surface: "#1a1430", surfaceBrightness: 16, glow: 100, buttonShape: "pill", chatBubbleShape: "round" },
  { id: "minimal", name: "Minimal", builtin: true, primary: "#64748b", secondary: "#94a3b8", surface: "#111827", surfaceBrightness: 14, glow: 0, buttonShape: "rounded", chatBubbleShape: "rounded" },
  { id: "premium", name: "Premium", builtin: true, primary: "#7c3aed", secondary: "#d4af37", surface: "#17122b", surfaceBrightness: 10, glow: 85, buttonShape: "pill", chatBubbleShape: "round" },
  { id: "festival", name: "Festival / Event", builtin: true, primary: "#f43f5e", secondary: "#fb923c", surface: "#3b0764", surfaceBrightness: 30, glow: 100, buttonShape: "rounded", chatBubbleShape: "round" },
  { id: "midnight", name: "Midnight — deepest", builtin: true, primary: "#8b5cf6", secondary: "#ec4899", surface: "#0a0a12", surfaceBrightness: 0, glow: 30, buttonShape: "rounded", chatBubbleShape: "rounded" },
];

/** Sanitize one theme object from untrusted input (config route / import). */
export function sanitizeThemePreset(o: unknown): ThemePreset | null {
  if (!o || typeof o !== "object") return null;
  const t = o as Record<string, unknown>;
  const hex = (v: unknown) => (typeof v === "string" && /^#?[0-9a-f]{0,8}$/i.test(v.trim()) ? v.trim().slice(0, 9) : "");
  const shape = <T extends string>(v: unknown, allowed: readonly T[], d: T): T => (allowed.includes(v as T) ? (v as T) : d);
  const name = typeof t.name === "string" && t.name.trim() ? t.name.trim().slice(0, 60) : "Theme";
  const id = typeof t.id === "string" && /^[a-z0-9_-]{1,40}$/i.test(t.id) ? t.id : `th_${Math.random().toString(36).slice(2, 10)}`;
  const pct = (v: unknown, d: number) => (typeof v === "number" && isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : d);
  // A background picture may only be one of OUR OWN uploaded media paths, so an
  // imported theme file can never point the app at an off-site image.
  const media = (v: unknown) => {
    const s = typeof v === "string" ? v.trim().slice(0, 400) : "";
    return /^\/api\/(media|file)\/[\w.-]+$/i.test(s) ? s : "";
  };
  return {
    id, name, builtin: t.builtin === true,
    primary: hex(t.primary), secondary: hex(t.secondary),
    surface: hex(t.surface),
    surfaceBrightness: pct(t.surfaceBrightness, 0),
    glow: pct(t.glow, 100),
    bgImage: media(t.bgImage),
    buttonShape: shape(t.buttonShape, ["sharp", "rounded", "pill"] as const, "rounded"),
    chatBubbleShape: shape(t.chatBubbleShape, ["sharp", "rounded", "round"] as const, "rounded"),
    customCss: typeof t.customCss === "string" ? t.customCss.slice(0, 20000) : "",
    createdAt: typeof t.createdAt === "string" ? t.createdAt : undefined,
    createdBy: typeof t.createdBy === "string" ? t.createdBy.slice(0, 60) : undefined,
  };
}
