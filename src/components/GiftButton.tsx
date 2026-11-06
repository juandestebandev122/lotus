"use client";

import { Gift as GiftIcon } from "lucide-react";
import { useGift } from "@/components/GiftProvider";
import { cn } from "@/lib/cn";

/**
 * A "Gift" button. Opens the app-wide gift sheet (GiftProvider) targeted at
 * the given recipients. Players can also tap each other's avatars in a game
 * to open the same sheet pre-targeted to that person.
 */
export function GiftButton({
  recipients,
  roomId,
  className,
  compact,
  variant,
}: {
  recipients: string[];
  roomId?: string;
  className?: string;
  compact?: boolean;
  variant?: "card"; // "card" = uniform room-controls card (matches Games/Media/etc.)
}) {
  const { openGift } = useGift();
  if (variant === "card") {
    return (
      <button
        onClick={() => openGift(recipients, undefined, roomId)}
        title="Send a gift"
        className={cn("flex shrink-0 items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-mist-100 transition hover:bg-white/[0.08] active:scale-95", className)}
      >
        <GiftIcon className="size-5 text-amber-400" /> Gift
      </button>
    );
  }
  return (
    <button
      onClick={() => openGift(recipients, undefined, roomId)}
      title="Send a gift"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-pink-500 font-semibold text-white shadow-sm transition hover:brightness-110",
        compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
        className,
      )}
    >
      <GiftIcon className={compact ? "size-3.5" : "size-4"} /> Gift
    </button>
  );
}
