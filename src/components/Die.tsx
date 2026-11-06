import { cn } from "@/lib/cn";
import { diceBodyStyle, faceStyleFor, pipClipPath, type DiceModel } from "@/lib/dice-model";

// Standard pip layout for each face (3×3 grid positions).
const FACES: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

const COLORS: Record<string, string> = {
  red: "from-rose-400 to-rose-600",
  blue: "from-sky-400 to-blue-600",
  green: "from-emerald-400 to-green-600",
  yellow: "from-amber-300 to-yellow-500",
  white: "from-white to-zinc-200",
  gold: "from-gold-300 to-gold-500",
};

// A realistic 3D die: perfect square, softly rounded corners, glossy white body,
// and BLACK RECESSED pips (drilled-in look) — modelled on a real acrylic die.
//
// When a `model` is supplied (Admin → Dice Models) it takes over the whole
// appearance: body colour/gradient, texture, shape, corners, border, glow, and
// how each number 1–6 is drawn (dots, a digit, a symbol, or its own picture).
// Without a model the die renders exactly as it always did, so every existing
// caller is unaffected.
export function Die({
  face = 5,
  color = "white",
  className,
  pip = "bg-zinc-900",
  showNumber = false,
  surface,
  pipClass,
  blank = false,
  faceImage,
  model,
}: {
  face?: 1 | 2 | 3 | 4 | 5 | 6;
  color?: keyof typeof COLORS;
  className?: string;
  pip?: string;
  /** Overlay the rolled number in the corner so it's unmistakable. */
  showNumber?: boolean;
  /** Skin override for the die surface (Tailwind classes). */
  surface?: string;
  /** Skin override for the pips (Tailwind classes). */
  pipClass?: string;
  /** Show NO pips — used before the first roll so the die never implies a "1". */
  blank?: boolean;
  /** Admin-uploaded picture shown on the die instead of pips (idle face). */
  faceImage?: string;
  /** The admin's full dice model — takes over the entire look when present. */
  model?: DiceModel;
}) {
  const dark = color === "white" || color === "yellow" || color === "gold";
  const pipStyle = pipClass ?? (dark ? "bg-zinc-900" : pip);

  // ---- MODEL-DRIVEN DIE (Admin → Dice Models) ----
  if (model) {
    const f = faceStyleFor(model, face);
    // `faceImage` is the caller's idle picture and still wins — that's what keeps
    // the lotus showing before the first roll.
    const idleImg = faceImage;
    const showFaceImage = !blank && !idleImg && f.mode === "image" && !!f.image;
    const showSymbol = !blank && !idleImg && f.mode === "symbol" && !!(f.symbol ?? "").trim();
    const showDigit = !blank && !idleImg && f.mode === "number";
    const showPips = !blank && !idleImg && f.mode === "pips";
    const clip = pipClipPath(f.pipShape);
    const pipSize = Math.max(30, Math.min(95, model.pipSizePct ?? 64));

    return (
      <div
        className={cn("relative grid aspect-square grid-cols-3 grid-rows-3 gap-0 p-[12%]", className)}
        style={diceBodyStyle(model)}
      >
        {idleImg && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={idleImg} alt="" draggable={false} onError={(e) => { e.currentTarget.style.display = "none"; }} className="pointer-events-none absolute inset-[10%] size-[80%] select-none rounded-[14%] object-contain" />
        )}
        {showFaceImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.image} alt="" draggable={false} onError={(e) => { e.currentTarget.style.display = "none"; }} className="pointer-events-none absolute inset-[8%] size-[84%] select-none object-contain" />
        )}
        {showSymbol && (
          <span className="pointer-events-none absolute inset-0 grid select-none place-items-center text-[52%] leading-none" style={{ color: f.pipColor }}>
            {f.symbol}
          </span>
        )}
        {showDigit && (
          <span className="pointer-events-none absolute inset-0 grid select-none place-items-center font-display text-[54%] font-black leading-none" style={{ color: f.pipColor }}>
            {face}
          </span>
        )}
        {Array.from({ length: 9 }).map((_, i) => {
          const r = Math.floor(i / 3);
          const c = i % 3;
          const pips = FACES[face] ?? FACES[1];
          const on = showPips && pips.some(([fr, fc]) => fr === r && fc === c);
          return (
            <span key={i} className="grid place-items-center">
              {on && (
                <span
                  style={{
                    width: `${pipSize}%`,
                    height: `${pipSize}%`,
                    background: f.pipColor,
                    ...(clip ? { clipPath: clip } : {}),
                    ...(f.pipShape === "circle" ? { borderRadius: "9999px" } : {}),
                    ...(f.pipShape === "square" ? { borderRadius: "12%" } : {}),
                  }}
                />
              )}
            </span>
          );
        })}
        {showNumber && !blank && (
          <span className="absolute -top-2 -right-2 grid size-7 place-items-center rounded-full border-2 border-white bg-ink-900 text-sm font-black text-white shadow-md">
            {face}
          </span>
        )}
      </div>
    );
  }

  // ---- ORIGINAL DIE (unchanged) ----
  return (
    <div
      className={cn(
        "relative grid aspect-square grid-cols-3 grid-rows-3 gap-0 rounded-[20%] p-[12%]",
        // The 3D volume: outer drop shadow + a bright top light-edge + bottom shade.
        "shadow-[0_14px_30px_-10px_rgba(0,0,0,0.6),inset_0_3px_5px_rgba(255,255,255,0.95),inset_0_-8px_14px_rgba(0,0,0,0.14)]",
        surface ?? cn("bg-gradient-to-br", COLORS[color]),
        className,
      )}
    >
      {/* (Removed the glossy "sunlight" sheen reflection at the client's request —
          the die now shows its clean colour without a light-glare highlight.) */}
      {/* Admin-uploaded idle face — covers the die instead of pips. If the image
          ever fails to load, hide it cleanly (blank die) instead of showing a
          broken-image icon. */}
      {faceImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={faceImage} alt="" draggable={false} onError={(e) => { e.currentTarget.style.display = "none"; }} className="pointer-events-none absolute inset-[10%] size-[80%] select-none rounded-[14%] object-contain" />
      )}
      {Array.from({ length: 9 }).map((_, i) => {
        const r = Math.floor(i / 3);
        const c = i % 3;
        // Defensive: an out-of-range face (only possible from a corrupted/old
        // cached state, never normal play) falls back to the 1-pip layout
        // instead of throwing and blanking the board.
        const pips = FACES[face] ?? FACES[1];
        // `blank`/`faceImage` → draw NO pips (so a fresh die never looks like a "1").
        const on = !blank && !faceImage && pips.some(([fr, fc]) => fr === r && fc === c);
        return (
          <span key={i} className="grid place-items-center">
            {on && (
              // Recessed pip: a black circle carved into the surface — inset shadow
              // (dark top) + a thin bottom rim highlight = a "drilled hole" look.
              <span
                className={cn(
                  "size-[64%] rounded-full",
                  pipStyle,
                  "shadow-[inset_0_2px_3px_rgba(0,0,0,0.9),inset_0_-1px_1px_rgba(255,255,255,0.2),0_1px_0_rgba(255,255,255,0.55)]",
                )}
              />
            )}
          </span>
        );
      })}
      {showNumber && !blank && !faceImage && (
        <span
          className={cn(
            "absolute -top-2 -right-2 grid size-7 place-items-center rounded-full border-2 border-white bg-ink-900 text-sm font-black text-white shadow-md",
          )}
        >
          {face}
        </span>
      )}
    </div>
  );
}
