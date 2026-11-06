// Build a full accent shade ramp (50→900) from ONE admin-chosen base colour, so the
// app's violet accent (the Tailwind `lotus-*` tokens) can be re-coloured live from the
// Admin panel. We keep the base's hue + saturation and apply a fixed lightness ramp
// tuned to match the built-in violet ramp, so any accent looks coherent.

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(100, s)) / 100; l = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

// Lightness per shade, matching the built-in violet ramp (50 lightest → 900 darkest).
const SHADE_L: Record<number, number> = { 50: 96, 100: 92, 200: 86, 300: 79, 400: 71, 500: 62, 600: 55, 700: 47, 800: 39, 900: 31 };
export const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

/** hex base → { 50: "#..", ..., 900: "#.." }, or null if the base isn't a valid hex. */
export function buildAccentRamp(baseHex: string): Record<number, string> | null {
  const hsl = hexToHsl(baseHex);
  if (!hsl) return null;
  const s = Math.max(45, Math.min(100, hsl.s)); // keep it vibrant
  const ramp: Record<number, string> = {};
  for (const shade of SHADES) ramp[shade] = hslToHex(hsl.h, s, SHADE_L[shade]);
  return ramp;
}

// ---------------------------------------------------------------------------
// SURFACE THEMING — the page canvas, cards and inputs (the `ink-*` tokens).
//
// This is what actually answers "the app looks too dark": instead of one fixed
// near-black violet, the admin picks a surface COLOUR (the tint of every panel)
// and a BRIGHTNESS (how light the canvas is). We keep light text on a coloured
// canvas, which stays readable everywhere, while letting the app go from deep
// midnight to a soft, colourful mid-tone.
// ---------------------------------------------------------------------------

/** Lightness of each surface step at brightness 0 (the current, darkest look). */
const SURFACE_BASE_L: Record<number, number> = { 950: 9, 900: 13, 850: 17, 800: 21, 700: 27, 600: 34 };
export const SURFACE_SHADES = [950, 900, 850, 800, 700, 600];

/**
 * hex tint + brightness (0–100) → the six `ink-*` surface colours.
 * `brightness` lifts every step together: 0 = today's deep canvas, 100 = a much
 * lighter, airier surface. Saturation is kept modest so text stays readable.
 */
export function buildSurfaceRamp(baseHex: string, brightness = 0): Record<number, string> | null {
  const hsl = hexToHsl(baseHex);
  if (!hsl) return null;
  const lift = Math.max(0, Math.min(100, brightness)) * 0.28; // up to +28 lightness
  const s = Math.max(8, Math.min(55, hsl.s)); // tinted, never neon
  const ramp: Record<number, string> = {};
  for (const shade of SURFACE_SHADES) {
    ramp[shade] = hslToHex(hsl.h, s, Math.min(72, SURFACE_BASE_L[shade] + lift));
  }
  return ramp;
}

/** A hairline border that suits the surface brightness (lighter canvas → darker line). */
export function surfaceLineColor(brightness = 0): string {
  const b = Math.max(0, Math.min(100, brightness));
  // Dark canvas → a white hairline; bright canvas → a soft dark hairline.
  return b < 55 ? `rgba(255,255,255,${(0.10 + b * 0.0012).toFixed(3)})` : `rgba(20,16,40,${(0.10 + (b - 55) * 0.004).toFixed(3)})`;
}

/** The page background: the surface colour plus optional colourful glows. */
export function buildBodyBackground(ink900: string, glowPct = 100, accent?: string, secondary?: string): string {
  const g = Math.max(0, Math.min(100, glowPct)) / 100;
  if (g <= 0) return ink900;
  const a = accent || "#7c5cfc";
  const b = secondary || "#ec4899";
  const rgba = (hex: string, alpha: number) => {
    const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
    if (!m) return `rgba(124,92,252,${alpha})`;
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  };
  return [
    `radial-gradient(1100px 700px at 100% -10%, ${rgba(b, 0.18 * g)}, transparent 55%)`,
    `radial-gradient(900px 700px at 0% 0%, ${rgba(a, 0.20 * g)}, transparent 55%)`,
    `radial-gradient(900px 700px at 50% 120%, ${rgba(b, 0.16 * g)}, transparent 60%)`,
    `radial-gradient(800px 600px at 90% 110%, ${rgba(a, 0.12 * g)}, transparent 60%)`,
    ink900,
  ].join(", ");
}

// The SECONDARY accent (the built-in pink "petal") only exposes three tokens.
export const PETAL_SHADES = [400, 500, 600];

/** hex base → petal ramp { 400, 500, 600 }, or null if invalid. Reuses the accent ramp. */
export function buildSecondaryRamp(baseHex: string): Record<number, string> | null {
  const full = buildAccentRamp(baseHex);
  if (!full) return null;
  return { 400: full[400], 500: full[500], 600: full[600] };
}
