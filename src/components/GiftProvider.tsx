"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Gift as GiftIcon, X } from "lucide-react";
import { GIFTS, type Gift } from "@/lib/gifts";
import { useAuth } from "@/lib/auth";
import { useConfig } from "@/lib/config";
import { useToast } from "@/components/ui/Toast";
import { sendGift } from "@/lib/wallet";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";

// ============================================================
// App-wide gift sheet. Any avatar / player can call openGift(recipients,
// presetTo, roomId) to pop the gift picker pre-targeted to a specific person.
// Gifts sent inside a room are broadcast so EVERYONE sees an animation burst
// on the receiver's avatar (see GiftBurst + RoomGiftListener below).
// ============================================================

// An active animation playing on a receiver's avatar (keyed by name).
interface Burst { emoji: string; key: number }

interface GiftContextValue {
  openGift: (recipients: string[], presetTo?: string, roomId?: string) => void;
  // The latest gift emoji a player received — stays pinned on their avatar
  // until they receive another gift. Keyed by display name (and first name).
  lastGiftFor: (name: string) => string | undefined;
  // Fire the avatar burst animation for `name` (called by the sender locally and
  // by RoomGiftListener for everyone else from the broadcast feed).
  triggerBurst: (name: string, emoji: string) => void;
  // The burst currently animating on `name`'s avatar, if any.
  burstFor: (name: string) => Burst | undefined;
}

const GiftContext = createContext<GiftContextValue | null>(null);

const LAST_GIFTS_KEY = "lotus.lastGifts";
const nameKeys = (name: string) => {
  const lc = (name || "").trim().toLowerCase();
  return Array.from(new Set([lc, lc.split(" ")[0]].filter(Boolean)));
};

export function GiftProvider({ children }: { children: React.ReactNode }) {
  const { user, updateUser } = useAuth();
  const { config } = useConfig();
  const { toast } = useToast();
  const pathname = usePathname();
  const router = useRouter();
  // One-tap jump to buy coins (used from the gift sheet + insufficient-coins prompt).
  const goBuyCoins = () => { setOpen(false); router.push(withBase("/wallet")); };

  // Gifts come from the ADMIN-managed catalog (Admin → Gifts); fall back to the
  // built-in set if the admin hasn't configured any yet.
  const giftList: Gift[] = useMemo(() => {
    const active = (config.giftCatalog ?? []).filter((g) => g.active);
    return active.length ? active : GIFTS.filter((g) => g.active !== false);
  }, [config.giftCatalog]);

  // Where the gift was sent from — recorded in the admin gift log.
  const contextLabel = () => {
    const p = pathname || "";
    if (p.includes("/games/ludo")) return "Ludo game";
    if (p.includes("/games/chess")) return "Chess game";
    if (p.includes("/games/snake")) return "Snake & Ladder game";
    if (p.includes("/rooms/")) return "Voice room";
    if (p.includes("/u/") || p.includes("/profile")) return "Profile";
    return "App";
  };
  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [to, setTo] = useState("");
  const [roomId, setRoomId] = useState<string | undefined>(undefined);
  const [flying, setFlying] = useState<{ gift: Gift; to: string } | null>(null);
  const [lastGifts, setLastGifts] = useState<Record<string, string>>({});

  // Live avatar-burst animations, keyed by lowercased name (+ first name).
  const [bursts, setBursts] = useState<Record<string, Burst>>({});
  const burstSeq = useRef(0);
  const triggerBurst = useCallback((name: string, emoji: string) => {
    if (!name || !emoji) return;
    const key = ++burstSeq.current;
    setBursts((prev) => {
      const next = { ...prev };
      for (const k of nameKeys(name)) next[k] = { emoji, key };
      return next;
    });
    // Clear after the animation finishes so the avatar returns to normal.
    setTimeout(() => {
      setBursts((prev) => {
        const next = { ...prev };
        for (const k of nameKeys(name)) if (next[k]?.key === key) delete next[k];
        return next;
      });
    }, 2600);
  }, []);
  const burstFor = useCallback(
    (name: string) => {
      for (const k of nameKeys(name)) if (bursts[k]) return bursts[k];
      return undefined;
    },
    [bursts],
  );

  // Persist the "latest gift per player" so it survives reloads.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_GIFTS_KEY);
      if (raw) setLastGifts(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const pinGift = useCallback((name: string, emoji: string) => {
    setLastGifts((prev) => {
      const next = { ...prev, [name.toLowerCase()]: emoji, [name.split(" ")[0].toLowerCase()]: emoji };
      try {
        localStorage.setItem(LAST_GIFTS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const lastGiftFor = useCallback(
    (name: string) => (name ? lastGifts[name.toLowerCase()] ?? lastGifts[name.split(" ")[0].toLowerCase()] : undefined),
    [lastGifts],
  );

  const coins = user?.coins ?? 0;

  // NOBODY CAN GIFT THEMSELVES.
  //
  // Every gift sheet in the app opens through here, so self is stripped ONCE,
  // at the door, instead of relying on each caller to remember. (The Ludo board
  // built its list from the voice participants, and a player who was not
  // connected to voice fell through to a fallback that included themselves —
  // which is how "Sending to Admin" appeared while signed in as Admin.)
  // The server refuses a self-gift as well, so this is presentation only.
  const myName = (user?.fullName ?? "").trim().toLowerCase();
  const openGift = useCallback((recips: string[], presetTo?: string, rid?: string) => {
    const list = Array.from(new Set(recips.filter(Boolean))).filter((n) => n.trim().toLowerCase() !== myName);
    setRecipients(list);
    const preset = presetTo && presetTo.trim().toLowerCase() !== myName && list.includes(presetTo) ? presetTo : list[0] ?? "";
    setTo(preset);
    setRoomId(rid);
    setOpen(true);
  }, [myName]);

  const target = recipients.includes(to) ? to : recipients[0] ?? "";

  const send = async (gift: Gift) => {
    if (!target) {
      toast("No one to send a gift to right now.", "error");
      return;
    }
    // Deliver the gift to the recipient's profile + notify them, and deduct
    // the cost from the sender (only charges if a real recipient is found).
    // roomId lets the server broadcast it so EVERYONE sees the avatar burst.
    const res = await sendGift(target, gift.id, contextLabel(), roomId);
    if (!res.ok) {
      const msg =
        res.error === "Insufficient coins"
          ? `Not enough coins — ${gift.name} costs ${gift.cost}. Tap "+ Buy coins" above to top up.`
          : res.error === "Recipient not found"
            ? `${target} isn't a registered player yet, so the gift couldn't be delivered. No coins were charged.`
            : res.error ?? "Could not send the gift.";
      toast(msg, "error");
      return;
    }
    if (res.balance !== undefined) updateUser({ coins: res.balance });
    // Pin this gift on the recipient's avatar until they get another.
    pinGift(target, gift.emoji);
    if (res.recipientName) pinGift(res.recipientName, gift.emoji);
    // Immediate burst on the receiver's avatar for the sender (everyone else
    // gets it from the room broadcast — RoomGiftListener skips the sender so it
    // never double-fires).
    triggerBurst(res.recipientName ?? target, gift.emoji);
    setFlying({ gift, to: res.recipientName ?? target });
    toast(`${gift.emoji} ${gift.name} sent to ${res.recipientName ?? target} — it's on their profile!`, "success");
    setOpen(false);
    setTimeout(() => setFlying(null), 1700);
  };

  const value = useMemo(() => ({ openGift, lastGiftFor, triggerBurst, burstFor }), [openGift, lastGiftFor, triggerBurst, burstFor]);

  return (
    <GiftContext.Provider value={value}>
      {children}

      {flying && (
        <div className="pointer-events-none fixed inset-0 z-[300] grid place-items-center">
          <div className="animate-gift-pop flex flex-col items-center">
            <span className="text-[88px] leading-none drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)]">{flying.gift.emoji}</span>
            <span className="mt-1 rounded-full bg-black/60 px-3 py-1 text-sm font-semibold text-white">To {flying.to}</span>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[210] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-t-2xl border border-white/10 bg-ink-850 p-4 shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-amber-400 to-pink-500 text-white">
                <GiftIcon className="size-4" />
              </span>
              <h3 className="font-display text-lg font-bold text-mist-100">Send a gift</h3>
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-gold-500/15 px-2.5 py-1 text-xs font-bold text-gold-300">
                🪙 {coins.toLocaleString()}
              </span>
              {/* One-tap Buy Coins — no hunting through screens (client request). */}
              <button onClick={goBuyCoins} className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-bold text-white transition hover:bg-emerald-400" title="Buy coins">
                + Buy coins
              </button>
              <button onClick={() => setOpen(false)} className="grid size-7 place-items-center rounded-md text-mist-400 hover:bg-white/10">
                <X className="size-4" />
              </button>
            </div>

            {recipients.length > 1 && (
              <div className="mb-3">
                <p className="mb-1.5 text-xs font-semibold text-mist-300">Send to</p>
                <div className="flex flex-wrap gap-1.5">
                  {recipients.map((r) => (
                    <button
                      key={r}
                      onClick={() => setTo(r)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold transition",
                        target === r ? "bg-lotus-500/30 text-white ring-1 ring-lotus-400" : "bg-ink-800 text-mist-300 hover:bg-ink-700",
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {recipients.length === 1 && (
              <p className="mb-3 text-xs text-mist-400">
                Sending to <span className="font-semibold text-mist-200">{target}</span>
              </p>
            )}

            <div className="grid max-h-[46vh] grid-cols-4 gap-2 overflow-y-auto">
              {giftList.map((g) => {
                const afford = coins >= g.cost;
                return (
                  <button
                    key={g.id}
                    onClick={() => send(g)}
                    disabled={!afford}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border bg-ink-800 p-2 transition",
                      afford ? "border-white/8 hover:border-amber-400/50 hover:bg-ink-700" : "cursor-not-allowed border-white/5 opacity-40",
                    )}
                  >
                    <span className="text-3xl leading-none">{g.emoji}</span>
                    <span className="text-[10px] font-medium text-mist-300">{g.name}</span>
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-gold-300">🪙 {g.cost}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </GiftContext.Provider>
  );
}

export function useGift(): GiftContextValue {
  const ctx = useContext(GiftContext);
  return ctx ?? { openGift: () => {}, lastGiftFor: () => undefined, triggerBurst: () => {}, burstFor: () => undefined };
}

// ============================================================
// GiftBurst — the attractive animation that plays ON the receiver's avatar
// when a gift arrives. Drop it inside any `relative` avatar wrapper:
//   <span className="relative ..."><Avatar .../><GiftBurst name={playerName} /></span>
// It shows a glow ring + a big gift emoji that pops and floats up + sparkles.
// ============================================================
export function GiftBurst({ name, className }: { name: string; className?: string }) {
  const { burstFor } = useGift();
  const burst = burstFor(name);
  if (!burst) return null;
  return (
    // key restarts the animation every time a new gift lands.
    <span key={burst.key} className={cn("pointer-events-none absolute inset-0 z-30 grid place-items-center", className)}>
      {/* glow ring pulse on the avatar */}
      <span className="absolute inset-0 animate-gift-glow rounded-full ring-2 ring-amber-300/80" />
      {/* the gift emoji: pops big then floats up and fades */}
      <span className="animate-gift-burst text-3xl leading-none drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]">{burst.emoji}</span>
      {/* sparkle particles flying outward from each corner */}
      {[
        { pos: "-left-1 -top-1", sx: "-14px", sy: "-16px" },
        { pos: "-right-1 -top-1", sx: "14px", sy: "-16px" },
        { pos: "-left-1 -bottom-1", sx: "-14px", sy: "14px" },
        { pos: "-right-1 -bottom-1", sx: "14px", sy: "14px" },
      ].map((s, i) => (
        <span
          key={i}
          className={cn("absolute animate-gift-spark text-xs", s.pos)}
          style={{ animationDelay: `${i * 60}ms`, ["--sx" as string]: s.sx, ["--sy" as string]: s.sy }}
        >
          ✨
        </span>
      ))}
    </span>
  );
}

// ============================================================
// RoomGiftListener — mount inside a room/game (with its roomId). Polls the
// room gift feed and fires the avatar burst for EVERYONE (so the receiver and
// all bystanders see it), skipping gifts the local user just sent (the sender
// already animated it locally).
// ============================================================
export function RoomGiftListener({ roomId }: { roomId: string }) {
  const { triggerBurst } = useGift();
  const { user } = useAuth();
  const myName = user?.fullName ?? "";
  const seen = useRef<Set<string>>(new Set());
  const first = useRef(true);

  useEffect(() => {
    if (!roomId) return;
    let on = true;
    const tick = async () => {
      if (typeof document !== "undefined" && document.hidden) return; // pause when backgrounded
      try {
        const res = await fetch(withBase(`/api/rooms/${roomId}/gifts`), { credentials: "include", cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        const gifts = (data.gifts as { id: string; toName: string; toFirst: string; fromName: string; emoji: string }[]) ?? [];
        if (!on) return;
        // On first load, swallow the backlog (don't replay old gifts on entry).
        if (first.current) {
          gifts.forEach((g) => seen.current.add(g.id));
          first.current = false;
          return;
        }
        for (const g of gifts) {
          if (seen.current.has(g.id)) continue;
          seen.current.add(g.id);
          if (g.fromName && g.fromName === myName) continue; // I already animated my own send
          triggerBurst(g.toName || g.toFirst, g.emoji);
        }
        if (seen.current.size > 400) seen.current = new Set(gifts.map((g) => g.id));
      } catch {
        /* ignore */
      }
    };
    tick();
    const t = setInterval(tick, 2500);
    return () => { on = false; clearInterval(t); };
  }, [roomId, myName, triggerBurst]);

  return null;
}
