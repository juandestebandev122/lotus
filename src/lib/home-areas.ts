import type { CSSProperties } from "react";
import type { AppConfig } from "./config";
import { withBase } from "./base-path";

/**
 * TOKEN PLACEMENT AREA (the four "home" corners) — full admin control.
 *
 * Each player's home (Red / Green / Yellow / Blue) is configured INDEPENDENTLY:
 * its background can be shown, hidden, made transparent, painted a custom colour,
 * given a custom image, or forced white — and the white box behind the four parked
 * tokens can be switched off entirely ("Hide White Token Area") so an uploaded
 * board design shows through untouched.
 *
 * Inside every home the four token slots are configured one by one: position,
 * width/height, token size, rotation, visibility, background, border, opacity and
 * which layer they sit on.
 *
 * IMPORTANT — appearance only. Everything here changes how the board LOOKS.
 * Hiding a slot, a background or a whole home area never removes a token, never
 * blocks a move and never changes a rule: the Ludo engine keeps running exactly
 * as before while the uploaded board controls the visuals.
 */

export type HomeColor = "red" | "green" | "yellow" | "blue";
export const HOME_COLORS: HomeColor[] = ["red", "green", "yellow", "blue"];
export const HOME_LABEL: Record<HomeColor, string> = { red: "Red Home", green: "Green Home", yellow: "Yellow Home", blue: "Blue Home" };
export const HOME_SWATCH: Record<HomeColor, string> = { red: "#ef4444", green: "#22c55e", yellow: "#eab308", blue: "#3b82f6" };

/** How the home area's own background is painted. */
export type HomeBgMode = "default" | "show" | "hide" | "transparent" | "white" | "color" | "image";
/** How ONE token slot's background is painted. */
export type SlotBgMode = "default" | "transparent" | "white" | "color" | "image";
/** Which layer a visual sits on. "hidden" draws nothing (gameplay untouched). */
export type LayerMode = "aboveBoard" | "behindBoard" | "aboveTokens" | "hidden";

export const HOME_BG_MODES: { value: HomeBgMode; label: string }[] = [
  { value: "default", label: "Default (theme)" },
  { value: "show", label: "Show background" },
  { value: "hide", label: "Hide background" },
  { value: "transparent", label: "Transparent" },
  { value: "white", label: "White background" },
  { value: "color", label: "Custom colour" },
  { value: "image", label: "Custom image" },
];

export const SLOT_BG_MODES: { value: SlotBgMode; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "transparent", label: "Transparent" },
  { value: "white", label: "White" },
  { value: "color", label: "Custom colour" },
  { value: "image", label: "Custom image" },
];

export const LAYER_MODES: { value: LayerMode; label: string }[] = [
  { value: "aboveBoard", label: "Above board" },
  { value: "behindBoard", label: "Behind board" },
  { value: "aboveTokens", label: "Above tokens" },
  { value: "hidden", label: "Hidden" },
];

export interface TokenSlotCfg {
  visible?: boolean;        // draw this slot's decoration (token still plays either way)
  xPct?: number;            // X position — nudge, % of the slot cell
  yPct?: number;            // Y position
  widthPct?: number;        // slot box width  (100 = the whole cell)
  heightPct?: number;       // slot box height
  tokenSizePct?: number;    // token size inside the slot
  rotateDeg?: number;       // token rotation
  bgMode?: SlotBgMode;
  bgColor?: string;
  bgImage?: string;
  border?: boolean;
  borderColor?: string;
  opacityPct?: number;      // slot opacity
  layer?: LayerMode;
}

export interface HomeAreaCfg {
  hideWhite?: boolean;      // "Hide White Token Area" — ON = fully transparent
  bgMode?: HomeBgMode;
  bgColor?: string;
  bgImage?: string;
  bgOpacityPct?: number;    // image / colour opacity
  showBorder?: boolean;     // the coloured frame around the corner yard
  layer?: LayerMode;
  slots?: TokenSlotCfg[];   // exactly four
}

export interface HomeAreasCfg {
  enabled?: boolean;                            // master switch for this whole panel
  areas?: Partial<Record<HomeColor, HomeAreaCfg>>;
}

export function defaultSlot(): Required<Pick<TokenSlotCfg, "visible" | "xPct" | "yPct" | "widthPct" | "heightPct" | "tokenSizePct" | "rotateDeg" | "bgMode" | "border" | "opacityPct" | "layer">> & TokenSlotCfg {
  return {
    visible: true, xPct: 0, yPct: 0, widthPct: 100, heightPct: 100,
    tokenSizePct: 100, rotateDeg: 0, bgMode: "default", border: true,
    borderColor: "", opacityPct: 100, layer: "aboveBoard", bgColor: "", bgImage: "",
  };
}

export function defaultHomeArea(): HomeAreaCfg {
  return {
    hideWhite: false, bgMode: "default", bgColor: "", bgImage: "", bgOpacityPct: 100,
    showBorder: true, layer: "aboveBoard",
    slots: [defaultSlot(), defaultSlot(), defaultSlot(), defaultSlot()],
  };
}

export function defaultHomeAreas(): HomeAreasCfg {
  return {
    enabled: false,
    areas: { red: defaultHomeArea(), green: defaultHomeArea(), yellow: defaultHomeArea(), blue: defaultHomeArea() },
  };
}

/** Everything the board needs for one home, with every value filled in. */
export interface ResolvedHomeArea {
  on: boolean;              // the per-home panel is in charge (false = legacy look)
  hideWhite: boolean;
  showBorder: boolean;
  layer: LayerMode;
  bgMode: HomeBgMode;
  bgColor: string;
  bgImage: string;
  bgOpacity: number;        // 0..1
  slots: Required<TokenSlotCfg>[];
}

/**
 * Merge the admin's settings with the OLD global controls so nothing changes
 * until the new panel is switched on:
 *   • `decor.hideHomeBg`   → the legacy "hide the white home box" switch
 *   • `decor.homeBgColor`  → the legacy single home colour
 *   • `gameBoard.tokenSlots` → the legacy shared 4-slot nudge/scale/rotate
 */
export function resolveHomeArea(config: AppConfig, color: HomeColor): ResolvedHomeArea {
  const gb = config.gameBoard ?? {};
  const decor = gb.decor ?? {};
  const cfg = gb.homeAreas ?? {};
  const on = cfg.enabled === true;
  const area = (cfg.areas ?? {})[color] ?? {};

  // Legacy fallbacks (exactly the behaviour before this panel existed).
  const legacyHide = decor.hideHomeBg === true;
  const legacyColor = (decor.homeBgColor ?? "").trim();
  const legacySlotsOn = gb.tokenSlots?.enabled === true;
  const legacySlots = gb.tokenSlots?.slots ?? [];

  const d = defaultSlot();
  const slots: Required<TokenSlotCfg>[] = [0, 1, 2, 3].map((i) => {
    const s = (on ? area.slots?.[i] : undefined) ?? {};
    const legacy = legacySlotsOn ? legacySlots[i] ?? {} : {};
    return {
      visible: s.visible ?? d.visible,
      xPct: s.xPct ?? legacy.dxPct ?? d.xPct,
      yPct: s.yPct ?? legacy.dyPct ?? d.yPct,
      widthPct: s.widthPct ?? d.widthPct,
      heightPct: s.heightPct ?? d.heightPct,
      tokenSizePct: s.tokenSizePct ?? legacy.sizePct ?? d.tokenSizePct,
      rotateDeg: s.rotateDeg ?? legacy.rotateDeg ?? d.rotateDeg,
      bgMode: s.bgMode ?? d.bgMode,
      bgColor: s.bgColor ?? "",
      bgImage: s.bgImage ?? "",
      border: s.border ?? d.border,
      borderColor: s.borderColor ?? "",
      opacityPct: s.opacityPct ?? d.opacityPct,
      layer: s.layer ?? d.layer,
    };
  });

  // The white token area: the new per-home switch wins when the panel is on,
  // otherwise the old global switch still applies.
  const hideWhite = on ? area.hideWhite === true || area.bgMode === "hide" || area.bgMode === "transparent" : legacyHide;
  const bgMode: HomeBgMode = on ? area.bgMode ?? "default" : legacyColor ? "color" : "default";

  return {
    on,
    hideWhite,
    showBorder: on ? area.showBorder !== false && !hideWhite : !legacyHide,
    layer: on ? area.layer ?? "aboveBoard" : "aboveBoard",
    bgMode,
    bgColor: on ? (area.bgColor ?? "").trim() : legacyColor,
    bgImage: on ? (area.bgImage ?? "").trim() : "",
    bgOpacity: Math.max(0, Math.min(100, on ? area.bgOpacityPct ?? 100 : 100)) / 100,
    slots,
  };
}

/** z-index for a layer choice. Parked tokens sit at 20–30 inside the home box. */
export function layerZ(layer: LayerMode): number | undefined {
  switch (layer) {
    case "behindBoard": return -1;
    case "aboveTokens": return 40;
    case "hidden": return undefined;
    default: return 5;
  }
}

/**
 * The inline style for the home area's inner box (the "white token area").
 * Returns null when nothing should be painted — the board art shows through.
 */
export function homeAreaBoxStyle(r: ResolvedHomeArea): CSSProperties | null {
  if (r.layer === "hidden" || r.hideWhite) return null;
  const z = layerZ(r.layer);
  const base: CSSProperties = { ...(z !== undefined ? { zIndex: z } : {}) };
  switch (r.bgMode) {
    case "hide":
    case "transparent":
      return null;
    case "white":
      return { ...base, background: "#ffffff", opacity: r.bgOpacity };
    case "color":
      return r.bgColor ? { ...base, background: r.bgColor, opacity: r.bgOpacity } : base;
    case "image":
      return r.bgImage
        ? { ...base, backgroundImage: `url(${withBase(r.bgImage)})`, backgroundSize: "cover", backgroundPosition: "center", opacity: r.bgOpacity }
        : base;
    case "show":
      return { ...base, background: r.bgColor || "#ffffff", opacity: r.bgOpacity };
    default:
      // "default" — the board theme's own white home box (a class handles it),
      // unless the admin picked a colour on the legacy control.
      return r.bgColor ? { ...base, background: r.bgColor, opacity: r.bgOpacity } : base;
  }
}

/** True when the built-in white home box class should still be applied. */
export function usesDefaultWhiteBox(r: ResolvedHomeArea): boolean {
  return !r.hideWhite && r.layer !== "hidden" && r.bgMode === "default" && !r.bgColor;
}

/** Position / size / rotation wrapper for one token slot. */
export function slotWrapperStyle(s: Required<TokenSlotCfg>): CSSProperties {
  const z = layerZ(s.layer);
  return {
    width: `${s.widthPct}%`,
    height: `${s.heightPct}%`,
    transform: `translate(${s.xPct}%, ${s.yPct}%)`,
    opacity: Math.max(0, Math.min(100, s.opacityPct)) / 100,
    ...(z !== undefined ? { zIndex: z } : {}),
  };
}

/** The token itself: size + rotation, applied on top of the slot box. */
export function slotTokenStyle(s: Required<TokenSlotCfg>): CSSProperties {
  return { transform: `scale(${Math.max(10, s.tokenSizePct) / 100}) rotate(${s.rotateDeg}deg)` };
}

/** The slot's own background plate (behind the token). Null = draw nothing. */
export function slotPlateStyle(s: Required<TokenSlotCfg>): CSSProperties | null {
  if (!s.visible || s.layer === "hidden") return null;
  const border = s.border ? { border: `2px dashed ${s.borderColor || "rgba(0,0,0,0.2)"}` } : {};
  switch (s.bgMode) {
    case "transparent":
      return { background: "transparent", ...border };
    case "white":
      return { background: "#ffffff", ...border };
    case "color":
      return { background: s.bgColor || "transparent", ...border };
    case "image":
      return s.bgImage
        ? { backgroundImage: `url(${withBase(s.bgImage)})`, backgroundSize: "cover", backgroundPosition: "center", ...border }
        : { background: "transparent", ...border };
    default:
      return null; // "default" → the board's own dashed-ring look
  }
}
