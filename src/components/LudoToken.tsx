import { Star, Crown, Diamond } from "lucide-react";
import { cn } from "@/lib/cn";
import { withBase } from "@/lib/base-path";
import type { TokenSkinId } from "@/lib/cosmetics";

// Premium 3D lotus-token artwork (client-provided catalog), one image per player
// colour → served from /public/tokens. Each themed skin maps to its own image set.
// Rendered for every "*-lotus" image skin (royal / animal / butterfly / peacock).
const IMG_TOKENS: Record<string, Record<string, string>> = {
  "royal-lotus": {
    red: "/tokens/lotus-red.png", green: "/tokens/lotus-green.png",
    yellow: "/tokens/lotus-gold.png", blue: "/tokens/lotus-blue.png",
  },
  "animal-lotus": {
    red: "/tokens/animal-red.png", green: "/tokens/animal-green.png",
    yellow: "/tokens/animal-gold.png", blue: "/tokens/animal-blue.png",
  },
  "butterfly-lotus": {
    red: "/tokens/butterfly-red.png", green: "/tokens/butterfly-green.png",
    yellow: "/tokens/butterfly-gold.png", blue: "/tokens/butterfly-blue.png",
  },
  "peacock-lotus": {
    red: "/tokens/peacock-red.png", green: "/tokens/peacock-green.png",
    yellow: "/tokens/peacock-gold.png", blue: "/tokens/peacock-blue.png",
  },
  "shiva-lotus": {
    red: "/tokens/shiva-red.png", green: "/tokens/shiva-green.png",
    yellow: "/tokens/shiva-gold.png", blue: "/tokens/shiva-blue.png",
  },
};

const GRAD: Record<string, string> = {
  red: "from-rose-400 to-rose-600",
  green: "from-emerald-400 to-green-600",
  yellow: "from-amber-300 to-yellow-500",
  blue: "from-sky-400 to-blue-600",
};

// Classic Ludo PAWN piece — per-player fill stops for the standing-pawn SVG
// (round head + flared base), matching the traditional plastic Ludo token.
const PAWN: Record<string, { light: string; main: string; dark: string }> = {
  red: { light: "#fb7185", main: "#e11d48", dark: "#9f1239" },
  green: { light: "#34d399", main: "#059669", dark: "#065f46" },
  yellow: { light: "#fde047", main: "#eab308", dark: "#a16207" },
  blue: { light: "#38bdf8", main: "#2563eb", dark: "#1e40af" },
};

// Colour coin: disc gradient, rim shade and embossed-symbol tint per player.
const COIN: Record<string, { disc: string; rim: string; sym: string }> = {
  red: { disc: "from-rose-400 to-rose-600", rim: "ring-rose-800/60", sym: "text-rose-200" },
  green: { disc: "from-emerald-400 to-green-600", rim: "ring-green-900/60", sym: "text-emerald-100" },
  yellow: { disc: "from-amber-300 to-yellow-500", rim: "ring-yellow-800/60", sym: "text-amber-50" },
  blue: { disc: "from-sky-400 to-blue-600", rim: "ring-blue-900/60", sym: "text-sky-100" },
};

/** A glossy 3D highlight overlay for round tokens. */
function Gloss() {
  return (
    <>
      <span className="pointer-events-none absolute left-[16%] top-[10%] size-[42%] rounded-full bg-white/70 blur-[1.5px]" />
      <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/30" />
    </>
  );
}

/** A single Ludo token rendered in the player's chosen skin, with a premium 3D finish.
 *  `skin` is a string so admin-added CUSTOM design ids are accepted too; a custom
 *  design passes its uploaded `image` (used for every colour). */
export function LudoToken({
  color,
  skin,
  image,
  className,
}: {
  color: string;
  skin: TokenSkinId | string;
  image?: string;
  className?: string;
}) {
  const grad = GRAD[color] ?? GRAD.red;
  const ball = cn(
    "relative block size-full bg-gradient-to-br shadow-[0_4px_10px_-2px_rgba(0,0,0,0.65),inset_0_-3px_6px_rgba(0,0,0,0.35),inset_0_2px_4px_rgba(255,255,255,0.5)]",
    grad,
    className,
  );

  // Admin CUSTOM design → render the uploaded image (same picture for all colours).
  if (image) {
    return (
      <span className={cn("relative block size-full", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={withBase(image)}
          alt=""
          draggable={false}
          className="pointer-events-none size-full select-none object-contain drop-shadow-[0_3px_5px_rgba(0,0,0,0.6)]"
        />
      </span>
    );
  }

  // Premium 3D artwork skins (per player colour). object-contain keeps the token
  // crisp at any board size; a soft drop-shadow grounds it on the cell.
  const imgSet = IMG_TOKENS[skin];
  if (imgSet) {
    const src = imgSet[color] ?? imgSet.red;
    return (
      <span className={cn("relative block size-full", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={withBase(src)}
          alt=""
          draggable={false}
          className="pointer-events-none size-full select-none object-contain drop-shadow-[0_3px_5px_rgba(0,0,0,0.6)]"
        />
      </span>
    );
  }

  switch (skin) {
    case "lotus-bloom": {
      // A clean, elegant top-down LOTUS bloom rendered per player colour (a flat,
      // vector alternative to the photoreal Royal Lotus) — 8 outer + 8 inner petals
      // around a golden seed-pod. Pure lotus theme, no image asset needed.
      const p = PAWN[color] ?? PAWN.red;
      const gid = `bloom-${color}`;
      const outer = [0, 45, 90, 135, 180, 225, 270, 315];
      const inner = [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5];
      return (
        <span className={cn("relative block size-full", className)}>
          <svg viewBox="0 0 48 48" className="size-full drop-shadow-[0_2px_5px_rgba(0,0,0,0.55)]" aria-hidden="true">
            <defs>
              <radialGradient id={gid} cx="50%" cy="42%" r="62%">
                <stop offset="0%" stopColor={p.light} />
                <stop offset="60%" stopColor={p.main} />
                <stop offset="100%" stopColor={p.dark} />
              </radialGradient>
            </defs>
            {outer.map((a) => (
              <ellipse key={`o${a}`} cx="24" cy="9.5" rx="4.4" ry="12" fill={`url(#${gid})`} stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" transform={`rotate(${a} 24 24)`} />
            ))}
            {inner.map((a) => (
              <ellipse key={`i${a}`} cx="24" cy="15" rx="3.3" ry="8" fill={p.light} stroke="rgba(255,255,255,0.45)" strokeWidth="0.4" transform={`rotate(${a} 24 24)`} />
            ))}
            <circle cx="24" cy="24" r="4.2" fill="#fde68a" stroke={p.dark} strokeWidth="0.7" />
            <circle cx="24" cy="24" r="1.6" fill={p.dark} />
          </svg>
        </span>
      );
    }
    case "coin": {
      const c = COIN[color] ?? COIN.red;
      const SymIcon = color === "red" ? Crown : color === "blue" ? Star : Diamond;
      return (
        <span
          className={cn(
            "relative grid size-full place-items-center rounded-full bg-gradient-to-b shadow-[0_4px_10px_-2px_rgba(0,0,0,0.6),inset_0_-3px_5px_rgba(0,0,0,0.3),inset_0_2px_4px_rgba(255,255,255,0.55)] ring-2 ring-inset",
            c.disc,
            c.rim,
            className,
          )}
        >
          <span className="absolute inset-[10%] rounded-full ring-2 ring-inset ring-white/25" />
          {color === "yellow" ? (
            <>
              <span className="absolute size-[48%] rounded-full ring-[3px] ring-inset ring-amber-50/90" />
              <span className="size-[16%] rounded-full bg-amber-50/90" />
            </>
          ) : (
            <SymIcon
              className={cn("relative z-10 size-[44%] drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]", c.sym)}
              fill="currentColor"
            />
          )}
          <span className="pointer-events-none absolute left-[20%] top-[12%] size-[34%] rounded-full bg-white/45 blur-[2px]" />
        </span>
      );
    }
    case "gem":
      return (
        <span
          className={cn(
            "relative block size-full rotate-45 rounded-[22%] bg-gradient-to-br shadow-[0_4px_10px_-2px_rgba(0,0,0,0.6),inset_0_2px_4px_rgba(255,255,255,0.6)] ring-2 ring-inset ring-white/70",
            grad,
            className,
          )}
        >
          <span className="pointer-events-none absolute left-[14%] top-[12%] size-[34%] -rotate-45 rounded-sm bg-white/70 blur-[1px]" />
        </span>
      );
    case "ring":
      return (
        <span className={cn(ball, "rounded-full ring-[3px] ring-inset ring-white")}>
          <span className="absolute inset-1/3 rounded-full bg-white/90 shadow-inner" />
          <Gloss />
        </span>
      );
    case "star":
      return (
        <span className={cn(ball, "grid place-items-center rounded-full")}>
          <Star className="relative z-10 size-1/2 text-white drop-shadow" fill="currentColor" />
          <Gloss />
        </span>
      );
    case "crown":
      return (
        <span className={cn(ball, "grid place-items-center rounded-full")}>
          <Crown className="relative z-10 size-1/2 text-white drop-shadow" fill="currentColor" />
          <Gloss />
        </span>
      );
    case "pin":
      return (
        <span className={cn(ball, "-rotate-45 rounded-full rounded-br-none")}>
          <span className="absolute left-1/2 top-1/2 size-1/3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-white/90 shadow-inner" />
        </span>
      );
    case "pawn": {
      // The classic standing Ludo pawn: a round head on a flared base, shaded
      // top-light → bottom-dark for a 3D plastic look, coloured per player.
      const p = PAWN[color] ?? PAWN.red;
      const gid = `pawn-${color}`;
      return (
        <span className={cn("relative block size-full", className)}>
          <svg viewBox="0 0 40 46" className="size-full drop-shadow-[0_3px_4px_rgba(0,0,0,0.55)]" aria-hidden="true">
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={p.light} />
                <stop offset="55%" stopColor={p.main} />
                <stop offset="100%" stopColor={p.dark} />
              </linearGradient>
            </defs>
            {/* flared base */}
            <path d="M13 19 C13 26 7 30 5.5 39 L34.5 39 C33 30 27 26 27 19 C22 22.5 18 22.5 13 19 Z" fill={`url(#${gid})`} stroke="rgba(0,0,0,0.18)" strokeWidth="0.6" />
            {/* base rim */}
            <ellipse cx="20" cy="39.5" rx="15.5" ry="3.6" fill={p.dark} />
            <ellipse cx="20" cy="38.6" rx="15.5" ry="3.2" fill={`url(#${gid})`} />
            {/* round head */}
            <circle cx="20" cy="12.5" r="10.5" fill={`url(#${gid})`} stroke="rgba(0,0,0,0.18)" strokeWidth="0.6" />
            {/* glossy highlight */}
            <ellipse cx="16" cy="8.5" rx="3.6" ry="4.6" fill="rgba(255,255,255,0.55)" />
          </svg>
        </span>
      );
    }
    case "pearl":
      return (
        <span
          className={cn(
            "relative block size-full rounded-full bg-gradient-to-br from-white via-slate-100 to-slate-300 shadow-[0_4px_10px_-2px_rgba(0,0,0,0.55),inset_0_-3px_6px_rgba(0,0,0,0.15),inset_0_2px_4px_rgba(255,255,255,0.9)] ring-2 ring-inset",
            color === "red" && "ring-rose-300",
            color === "green" && "ring-emerald-300",
            color === "yellow" && "ring-amber-300",
            color === "blue" && "ring-sky-300",
            className,
          )}
        >
          <span className="pointer-events-none absolute left-[18%] top-[12%] size-[38%] rounded-full bg-white blur-[1px]" />
        </span>
      );
    case "glossy":
    case "classic":
    default:
      return (
        <span className={cn(ball, "rounded-full")}>
          <Gloss />
        </span>
      );
  }
}
