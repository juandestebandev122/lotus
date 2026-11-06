import type { CSSProperties } from "react";
import type { AppConfig } from "./config";

/**
 * BOARD ELEMENT VISIBILITY + SAFE-ZONE STAR EDITOR.
 *
 * Two admin-facing ideas live here, both APPEARANCE-ONLY:
 *
 *  1. A Show / Hide / Transparent switch for each visual element of the board
 *     (the client's element table). "Hide" removes the element completely;
 *     "Transparent" keeps its space but paints nothing — which is what lets an
 *     uploaded board design show through while everything still lines up.
 *
 *  2. A complete editor for the safe-zone star: icon source, colour, size,
 *     opacity, border, glow, shadow, rotation, X/Y nudge and visibility.
 *
 * Neither can change a rule. Hiding the star never removes the protection on that
 * square; the ONLY thing that moves a safe square is the separate "safe cells"
 * list, which is applied to the engine itself (see lib/ludo.ts → configureSafeCells).
 */

export type ElementVis = "show" | "hide" | "transparent";

export type BoardElement =
  | "board"          // the default board surface (theme colours)
  | "grid"           // the 15×15 grid lines
  | "safeStar"       // the star / icon on protected squares
  | "startArrow"     // the entry arrow on each colour's start cell
  | "pathNumbers"    // the "squares to home" numbers on the coloured run
  | "tokenAreaBg"    // the white box behind the four parked tokens
  | "tokenSlot"      // the empty parking-slot rings
  | "cellBorder"     // the outline around every path square
  | "homeArea";      // the whole coloured corner yard

export const BOARD_ELEMENTS: { key: BoardElement; label: string; desc: string }[] = [
  { key: "board", label: "Default Board", desc: "The built-in board surface. Hide or make it transparent when you use your own board picture." },
  { key: "grid", label: "Grid", desc: "The lines that divide the 15×15 squares." },
  { key: "safeStar", label: "Safe Star", desc: "The star (or your icon) on protected squares. Hiding it never removes the protection." },
  { key: "startArrow", label: "Start Arrow", desc: "The arrow showing where each colour's coins enter the track." },
  { key: "pathNumbers", label: "Path Numbers", desc: "The 5→1 “squares to home” numbers on the coloured run." },
  { key: "tokenAreaBg", label: "Token Area Background", desc: "The white box behind the four parked tokens in each home." },
  { key: "tokenSlot", label: "Token Slot", desc: "The dashed rings marking the four parking spots." },
  { key: "cellBorder", label: "Cell Border", desc: "The outline drawn around every path square." },
  { key: "homeArea", label: "Home Area", desc: "The whole coloured corner yard, frame included." },
];

export type SafeVisibility = "visible" | "hidden" | "transparent" | "gameplayOnly";
export type SafeIconMode = "default" | "custom" | "none";

export const SAFE_VISIBILITY: { value: SafeVisibility; label: string; desc: string }[] = [
  { value: "visible", label: "Visible", desc: "Star shown normally." },
  { value: "hidden", label: "Hidden", desc: "Star not drawn at all. The squares stay safe." },
  { value: "transparent", label: "Transparent", desc: "Star drawn very faintly, so a custom board shows through." },
  { value: "gameplayOnly", label: "Gameplay only", desc: "No star, but the safe-square tint stays so players can still read the board." },
];

export const SAFE_ICON_MODES: { value: SafeIconMode; label: string }[] = [
  { value: "default", label: "Default star" },
  { value: "custom", label: "Custom star / uploaded icon" },
  { value: "none", label: "No icon" },
];

/** How one element should be drawn. Unset = "show" (unchanged behaviour). */
export function elementVis(config: AppConfig, key: BoardElement): ElementVis {
  const v = config.gameBoard?.elements?.[key];
  return v === "hide" || v === "transparent" ? v : "show";
}

/** Convenience: is this element drawn at all? */
export function elementOn(config: AppConfig, key: BoardElement): boolean {
  return elementVis(config, key) !== "hide";
}

/** Opacity multiplier for an element ("transparent" = barely there, but still
 *  occupying its space so nothing on the board shifts). */
export function elementOpacity(config: AppConfig, key: BoardElement): number {
  const v = elementVis(config, key);
  return v === "hide" ? 0 : v === "transparent" ? 0.15 : 1;
}

/** Everything the renderer needs for the safe-zone star, fully defaulted. */
export interface ResolvedSafeStar {
  /** draw the star / icon at all */
  show: boolean;
  /** draw the coloured tint + ring on the square */
  showTint: boolean;
  iconMode: SafeIconMode;
  icon: string;          // uploaded icon URL (only meaningful for "custom")
  color: string;
  opacity: number;       // 0..1, already folded with the visibility mode
  sizePct: number;
  rotateDeg: number;
  xPct: number;          // nudge inside the square
  yPct: number;
  border: boolean;
  borderColor: string;
  glow: boolean;
  glowPx: number;        // glow intensity in px
  shadow: boolean;
  shadowOpacity: number; // 0..1
}

export function resolveSafeStar(config: AppConfig): ResolvedSafeStar {
  const d = config.gameBoard?.decor ?? {};
  const vis: SafeVisibility = d.safeVisibility ?? "visible";
  const elem = elementVis(config, "safeStar");

  // The element table and the star's own visibility both apply; the more
  // restrictive one wins, so neither control can be silently overridden.
  const hidden = vis === "hidden" || vis === "gameplayOnly" || elem === "hide" || d.safeIconShow === false || d.safeIconMode === "none";
  const faded = vis === "transparent" || elem === "transparent";

  const baseOpacity = Math.max(0, Math.min(100, d.safeOpacityPct ?? 100)) / 100;
  const color = (d.safeColor ?? "").trim() || "#10b981";

  return {
    show: !hidden,
    // "Gameplay only" keeps the tint (so players can still see which squares are
    // safe) but drops the star. The element table can still switch the tint off.
    showTint: d.safeHighlight !== false && elem !== "hide",
    iconMode: d.safeIconMode ?? ((d.safeIcon ?? "").trim() ? "custom" : "default"),
    icon: (d.safeIcon ?? "").trim(),
    color,
    opacity: faded ? Math.min(baseOpacity, 0.2) : baseOpacity,
    sizePct: Math.max(20, Math.min(200, d.safeSizePct ?? 100)),
    rotateDeg: Math.max(-180, Math.min(180, d.safeRotateDeg ?? 0)),
    xPct: Math.max(-50, Math.min(50, d.safePosXPct ?? 0)),
    yPct: Math.max(-50, Math.min(50, d.safePosYPct ?? 0)),
    border: d.safeBorder === true,
    borderColor: (d.safeBorderColor ?? "").trim() || color,
    glow: d.safeGlow === true,
    glowPx: Math.max(1, Math.min(24, d.safeGlowPx ?? 4)),
    shadow: d.safeShadow !== false,
    shadowOpacity: Math.max(0, Math.min(100, d.safeShadowOpacityPct ?? 55)) / 100,
  };
}

/** The inline style for the star / icon itself. */
export function safeStarStyle(s: ResolvedSafeStar, isImage: boolean): CSSProperties {
  const filters: string[] = [];
  if (s.glow) filters.push(`drop-shadow(0 0 ${s.glowPx}px ${s.color})`);
  if (s.shadow) filters.push(`drop-shadow(0 1px 2px rgba(0,0,0,${s.shadowOpacity}))`);
  return {
    opacity: s.opacity,
    transform: `translate(${s.xPct}%, ${s.yPct}%) scale(${s.sizePct / 100}) rotate(${s.rotateDeg}deg)`,
    ...(filters.length ? { filter: filters.join(" ") } : {}),
    ...(isImage ? {} : { color: s.color }),
    ...(s.border ? { borderRadius: "9999px", boxShadow: `0 0 0 1.5px ${s.borderColor}` } : {}),
  };
}
