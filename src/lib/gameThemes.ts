// Game themes (§7) — a theme sets the Ludo screen's BACKGROUND and an ACCENT
// colour (used to tint the background pattern + a few highlights). Admin picks a
// built-in preset (incl. event/seasonal ones) or a Custom look, from
// /admin/game-themes; the game reads config.gameTheme live and applies it, so no
// app update is needed. The player colours (red/green/blue/yellow) and the board
// layout NEVER change — only the surrounding look — so gameplay is untouched.

export type GameThemePreset = {
  id: string;
  label: string;
  emoji: string;
  bg: string;      // CSS background for the full-screen game root
  accent: string;  // hex accent (tints the diamond pattern + the title)
  seasonal?: boolean;
};

export const GAME_THEME_PRESETS: GameThemePreset[] = [
  { id: "default", label: "Classic Blue", emoji: "🔷", bg: "radial-gradient(120% 70% at 50% 0%, #1e40af 0%, #14296b 40%, #0a1330 100%)", accent: "#7dd3fc" },
  { id: "rose", label: "Lotus Rose", emoji: "🪷", bg: "radial-gradient(120% 70% at 50% 0%, #9d174d 0%, #4c0d26 45%, #1c0410 100%)", accent: "#fb7185" },
  { id: "emerald", label: "Emerald", emoji: "💚", bg: "radial-gradient(120% 70% at 50% 0%, #065f46 0%, #043d2e 45%, #021a13 100%)", accent: "#6ee7b7" },
  { id: "royal", label: "Royal Violet", emoji: "👑", bg: "radial-gradient(120% 70% at 50% 0%, #5b21b6 0%, #3b0d70 45%, #16052e 100%)", accent: "#c4b5fd" },
  { id: "midnight", label: "Midnight", emoji: "🌌", bg: "radial-gradient(120% 70% at 50% 0%, #1e293b 0%, #0f172a 45%, #020617 100%)", accent: "#94a3b8" },
  // Event / seasonal
  { id: "diwali", label: "Diwali", emoji: "🪔", bg: "radial-gradient(120% 70% at 50% 0%, #b45309 0%, #7c2d12 42%, #1a0a04 100%)", accent: "#fbbf24", seasonal: true },
  { id: "eid", label: "Eid", emoji: "🌙", bg: "radial-gradient(120% 70% at 50% 0%, #047857 0%, #053b2c 45%, #021a13 100%)", accent: "#34d399", seasonal: true },
  { id: "ramadan", label: "Ramadan", emoji: "🕌", bg: "radial-gradient(120% 70% at 50% 0%, #6d28d9 0%, #2a0847 45%, #120321 100%)", accent: "#c4b5fd", seasonal: true },
  { id: "newyear", label: "New Year", emoji: "🎆", bg: "radial-gradient(120% 70% at 50% 0%, #312e81 0%, #111031 45%, #05040f 100%)", accent: "#f0abfc", seasonal: true },
  { id: "national", label: "Saudi Green", emoji: "🇸🇦", bg: "radial-gradient(120% 70% at 50% 0%, #166534 0%, #0c3d20 45%, #041a0e 100%)", accent: "#86efac", seasonal: true },
];

export type GameThemeCfg = {
  preset?: string;   // preset id, or "custom"
  bgColor?: string;  // used when preset === "custom" (any CSS background value / hex)
  bgImage?: string;  // optional image layered (faintly) behind the board
  accent?: string;   // used when preset === "custom"
  music?: { enabled?: boolean; track?: string; volumePct?: number };
};

export const DEFAULT_GAME_THEME: GameThemeCfg = {
  preset: "default",
  bgColor: "",
  bgImage: "",
  accent: "",
  music: { enabled: false, track: "", volumePct: 40 },
};

/** The effective look to apply, resolved from config. */
export function resolveGameTheme(cfg?: GameThemeCfg): { bg: string; accent: string; bgImage: string } {
  const def = GAME_THEME_PRESETS[0];
  if (!cfg || !cfg.preset || cfg.preset === "default") {
    return { bg: def.bg, accent: def.accent, bgImage: cfg?.bgImage?.trim() || "" };
  }
  if (cfg.preset === "custom") {
    return {
      bg: (cfg.bgColor && cfg.bgColor.trim()) || def.bg,
      accent: (cfg.accent && cfg.accent.trim()) || def.accent,
      bgImage: cfg.bgImage?.trim() || "",
    };
  }
  const preset = GAME_THEME_PRESETS.find((p) => p.id === cfg.preset) ?? def;
  return { bg: preset.bg, accent: preset.accent, bgImage: cfg.bgImage?.trim() || "" };
}
