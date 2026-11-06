import type { CSSProperties } from "react";
import { withBase } from "@/lib/base-path";

// ============================================================
// Speaking (active-speaker) effect — admin-selectable via config.speakingFx.
// Applied to a member's avatar in the voice-room seat grid while they talk.
// The renderer stays dumb: it takes the config + whether the person is speaking
// and returns (a) a className + CSS vars for the avatar wrapper, and (b) an
// optional overlay element for ring/wave styles. Everything is CSS keyframes
// defined in globals.css (the .sfx-* classes). Default is a CALM steady glow —
// it does NOT react to raw mic amplitude, so it never blinks/jitters.
// ============================================================

export type SpeakingStyle =
  | "glow" | "pulse" | "scale" | "float" | "neon"
  | "ringPulse" | "ripple" | "waves" | "rotatingRing" | "equalizer" | "custom" | "none";

export interface SpeakingFxConfig {
  enabled?: boolean;                    // master on/off (off = no speaking effect at all)
  style?: string;                       // which built-in effect (a SpeakingStyle value; kept loose for config storage)
  color?: string;                       // hex accent ("" = theme violet)
  speed?: "slow" | "normal" | "fast";   // animation speed
  imageUrl?: string;                    // admin-uploaded custom animation (GIF/PNG/WebP), used when style="custom"
}

// Admin-facing list (label + a friendly number, matching the client's "Style N").
export const SPEAKING_STYLES: { key: SpeakingStyle; label: string; n: string }[] = [
  { key: "glow", label: "Simple Glow", n: "1" },
  { key: "ringPulse", label: "Ring Pulse", n: "2" },
  { key: "equalizer", label: "Equalizer", n: "3" },
  { key: "waves", label: "Voice Waves", n: "4" },
  { key: "neon", label: "Neon Border", n: "5" },
  { key: "ripple", label: "Ripple Circle", n: "6" },
  { key: "rotatingRing", label: "Rotating Ring", n: "7" },
  { key: "float", label: "Floating Border", n: "8" },
  { key: "pulse", label: "Pulse", n: "9" },
  { key: "scale", label: "Zoom / Scale", n: "10" },
  { key: "custom", label: "Custom (uploaded)", n: "★" },
  { key: "none", label: "None (off)", n: "—" },
];

const WRAP_CLASS: Record<string, string> = {
  glow: "sfx-glow", pulse: "sfx-pulse", scale: "sfx-scale", float: "sfx-float", neon: "sfx-neon",
};

/** "#7c5cfc" → "124, 92, 252" (the rgb triple our CSS vars expect). Null if invalid. */
function hexToRgbTriple(hex?: string): string | null {
  if (!hex) return null;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

function durOf(speed?: string): string {
  return speed === "slow" ? "2.4s" : speed === "fast" ? "1s" : "1.6s";
}

/** Resolve the wrapper className + CSS vars for the avatar. Returns empty when the
 *  feature is off or the person isn't speaking, so callers can spread unconditionally. */
export function speakingFxWrap(cfg: SpeakingFxConfig | undefined, speaking: boolean): { className: string; style: CSSProperties } {
  if (!speaking || cfg?.enabled === false) return { className: "", style: {} };
  const style = cfg?.style ?? "glow";
  if (style === "none") return { className: "", style: {} };
  const vars: Record<string, string> = { "--sfx-dur": durOf(cfg?.speed) };
  const rgb = hexToRgbTriple(cfg?.color);
  if (rgb) vars["--sfx-col"] = rgb;
  const wrap = WRAP_CLASS[style];
  return { className: wrap ? `sfx ${wrap}` : "sfx", style: vars as CSSProperties };
}

/** The overlay element for ring/wave/rotate/equalizer styles (null for the rest).
 *  Rendered INSIDE the avatar wrapper so it inherits the --sfx-* vars. */
export function SpeakingFxOverlay({ cfg, speaking }: { cfg?: SpeakingFxConfig; speaking: boolean }) {
  if (!speaking || cfg?.enabled === false) return null;
  const style = cfg?.style ?? "glow";
  switch (style) {
    case "ringPulse":
      return <span className="sfx-ov sfx-ring-1" aria-hidden />;
    case "ripple":
    case "waves":
      return <>
        <span className="sfx-ov sfx-ripple-1" aria-hidden />
        <span className="sfx-ov sfx-ripple-2" aria-hidden />
        <span className="sfx-ov sfx-ripple-3" aria-hidden />
      </>;
    case "rotatingRing":
      return <span className="sfx-ov sfx-rotate-1" aria-hidden />;
    case "equalizer":
      return <span className="sfx-eq" aria-hidden><i /><i /><i /><i /><i /></span>;
    case "custom":
      // Admin-uploaded animation (GIF/PNG/WebP) as an aura around the avatar.
      // Best with a transparent-centre animation so the face stays visible.
      return cfg?.imageUrl
        ? <img src={withBase(cfg.imageUrl)} alt="" aria-hidden className="pointer-events-none absolute inset-0 m-auto object-contain" style={{ width: "175%", height: "175%", maxWidth: "none" }} />
        : null;
    default:
      return null;
  }
}
