import { cn } from "@/lib/cn";
import { avatarLabel, avatarLabelScale, avatarDefaultImage, avatarShowName } from "@/lib/avatar-label";

// Deterministic vibrant gradient from a string seed
const GRADIENTS = [
  "bg-gradient-to-br from-lotus-500 to-petal-500",
  "bg-gradient-to-br from-petal-500 to-gold-400",
  "bg-gradient-to-br from-sky-500 to-lotus-600",
  "bg-gradient-to-br from-emerald-500 to-teal-600",
  "bg-gradient-to-br from-rose-500 to-lotus-600",
  "bg-gradient-to-br from-amber-500 to-petal-600",
  "bg-gradient-to-br from-cyan-500 to-blue-600",
  "bg-gradient-to-br from-fuchsia-500 to-violet-600",
];

function seedIndex(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % GRADIENTS.length;
}

// The text inside a photo-less avatar lives in lib/avatar-label.ts — it is
// emoji-safe (the old one sliced surrogate pairs in half and drew "◆S") and
// admin-configurable (initials / first name / full name). See config.defaultAvatar.

const SIZES: Record<string, string> = {
  xs: "size-7 text-[10px]",
  sm: "size-9 text-xs",
  md: "size-11 text-sm",
  lg: "size-14 text-base",
  xl: "size-20 text-xl",
  "2xl": "size-28 text-3xl",
};

export type AvatarSize = keyof typeof SIZES;

const GIFT_BADGE: Record<string, string> = {
  xs: "size-4 text-[9px] -top-1 -right-1",
  sm: "size-5 text-[11px] -top-1 -right-1",
  md: "size-6 text-xs -top-1.5 -right-1.5",
  lg: "size-7 text-sm -top-1.5 -right-1.5",
  xl: "size-9 text-lg -top-1 -right-1",
  "2xl": "size-11 text-2xl -top-1 -right-1",
};

export function Avatar({
  name,
  src,
  size = "md",
  status,
  ring,
  frame,
  frameImage,
  gift,
  className,
}: {
  name: string;
  src?: string;
  size?: AvatarSize;
  status?: "online" | "offline" | "in-room" | "playing";
  ring?: boolean;
  frame?: string; // level-tier frame — a CSS gradient ring around the avatar
  frameImage?: string; // PURCHASED avatar frame (transparent PNG) drawn over the photo
  gift?: string; // latest gift emoji — pinned on the avatar until a new gift arrives
  className?: string;
}) {
  const grad = GRADIENTS[seedIndex(name)];
  // No photo → the house default picture (if the admin set one) and/or the
  // member's NAME. Never a lone letter, and never a sliced-in-half emoji.
  const houseImg = src ? "" : avatarDefaultImage();
  // At 28px a name is physically unreadable, so the smallest size always uses
  // initials no matter what the admin picked. Every larger size honours it.
  const label = src || (houseImg && !avatarShowName())
    ? ""
    : avatarLabel(name, size === "xs" ? { mode: "initials", maxChars: 2 } : undefined);
  const statusColor =
    status === "online"
      ? "bg-emerald-400"
      : status === "in-room"
        ? "bg-lotus-400"
        : status === "playing"
          ? "bg-gold-400"
          : "bg-mist-500";

  return (
    <span className={cn("relative inline-grid shrink-0 place-items-center", className)}>
      {/* Level-tier frame: a gradient ring drawn just outside the avatar.
          When a purchased frame is worn, it shrinks together with the photo. */}
      {frame && (
        <span
          aria-hidden
          className={cn("pointer-events-none absolute rounded-full", frameImage && "scale-[.78]")}
          style={{ inset: "-3px", background: frame, WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))", mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))" }}
        />
      )}
      {/* Purchased avatar frame (frame shop). Two guarantees, per client spec:
          1. The frame is painted BEHIND the photo (photo has z-[1]) — so no
             frame artwork can EVER cover any part of the picture, whatever the
             frame's shape (square, wreath, animated GIF/APNG/WebP…).
          2. The photo shrinks to 78% while the frame spans 144%, leaving an
             equal transparent gap on ALL FOUR sides (top included) — the frame
             forms a complete outer border around the fully visible photo.
          Everything is percentage-based, so it auto-scales for every avatar
          size with the same relative spacing. */}
      {frameImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img aria-hidden src={frameImage} alt="" draggable={false} loading="lazy" decoding="async" className="pointer-events-none absolute select-none" style={{ inset: "-22%", width: "144%", height: "144%", maxWidth: "none", objectFit: "contain" }} />
      )}
      <span
        className={cn(
          "relative grid place-items-center overflow-hidden rounded-full font-semibold text-white",
          grad,
          SIZES[size],
          ring && "ring-2 ring-lotus-400/70 ring-offset-2 ring-offset-ink-900",
          // Worn frame → photo sits above the frame with an even gap around it.
          frameImage && "z-[1] scale-[.78]",
        )}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={name} loading="lazy" decoding="async" className="size-full object-cover" />
        ) : (
          <>
            {houseImg && (
              // eslint-disable-next-line @next/next/no-img-element
              <img aria-hidden src={houseImg} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
            )}
            {label && (
              <span
                className={cn(
                  "relative px-[6%] text-center leading-tight drop-shadow",
                  // Long names shrink so the whole name fits the circle.
                  avatarLabelScale(label),
                  houseImg && "[text-shadow:0_1px_3px_rgba(0,0,0,.75)]",
                )}
                style={{ wordBreak: "break-word" }}
              >
                {label}
              </span>
            )}
          </>
        )}
      </span>
      {/* Show the status dot ONLY for ACTIVE states. An offline user gets NO
          badge (callers dim the row instead) — so a green "online" dot always
          means the person is genuinely active right now. */}
      {status && status !== "offline" && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-2 border-ink-900",
            statusColor,
            size === "xs" || size === "sm" ? "size-2.5" : "size-3.5",
          )}
        />
      )}
      {gift && (
        <span
          title="Latest gift received"
          className={cn(
            "absolute grid place-items-center rounded-full border-2 border-ink-900 bg-gradient-to-br from-amber-400 to-pink-500 shadow-md",
            GIFT_BADGE[size],
          )}
        >
          {gift}
        </span>
      )}
    </span>
  );
}
