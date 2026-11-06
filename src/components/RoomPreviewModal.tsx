"use client";

// Full-screen "Preview Room" — a faithful mockup of a voice room rendered from the
// admin's CURRENT (unsaved) per-room settings, so they can see exactly how the
// theme / background / banner / logo / welcome message + seats / chat / gift areas
// will look before publishing. Desktop / Mobile toggle. Uses the SAME roomAppearance
// resolver the live room uses, so the preview matches reality.

import { useState } from "react";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { roomAppearance, roomFeatureOn, type RoomFeatures } from "@/lib/room-features";
import { Avatar } from "@/components/ui/Avatar";
import {
  X, Monitor, Smartphone, Radio, Mic, Users, Hand, Crown, Lock,
  Gamepad2, Sticker, Gift as GiftIcon, Music, Send, Paperclip,
} from "lucide-react";

const asSrc = (u: string) => (/^(https?:|data:)/i.test(u) ? u : withBase(u));
const cssUrl = (u: string) => asSrc(u).replace(/["'\\)]/g, ""); // safe inside CSS url("…")
const MOCK = ["Aisha", "Kumar", "Sara", "Ravi", "Mona", "Zaid", "Lina", "Omar"];

export function RoomPreviewModal({ features, roomName, roomImage, onClose }: {
  features: RoomFeatures; roomName: string; roomImage?: string; onClose: () => void;
}) {
  const [device, setDevice] = useState<"desktop" | "mobile">("mobile");
  const a = roomAppearance(features);
  const showChat = roomFeatureOn(features, "textChat") && !roomFeatureOn(features, "blockChat");
  const showGift = roomFeatureOn(features, "virtualGifts");
  const showStickers = roomFeatureOn(features, "stickers");
  const showGames = roomFeatureOn(features, "games");
  const showMusic = roomFeatureOn(features, "musicPlayer");
  const isMobile = device === "mobile";

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-black/70 backdrop-blur-sm" onClick={onClose}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-ink-900 px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-base font-bold text-mist-100">Room preview <span className="text-mist-500">· {roomName}</span></h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-line bg-ink-800 p-0.5">
            <button onClick={() => setDevice("mobile")} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition", isMobile ? "bg-lotus-600 text-white" : "text-mist-400 hover:text-mist-100")}><Smartphone className="size-3.5" /> Mobile</button>
            <button onClick={() => setDevice("desktop")} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition", !isMobile ? "bg-lotus-600 text-white" : "text-mist-400 hover:text-mist-100")}><Monitor className="size-3.5" /> Desktop</button>
          </div>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-lg bg-white/5 text-mist-300 hover:bg-white/10"><X className="size-5" /></button>
        </div>
      </div>

      {/* Preview stage */}
      <div className="flex flex-1 items-start justify-center overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
        <div className={cn("w-full overflow-hidden rounded-3xl border-4 border-ink-700 bg-ink-950 shadow-2xl", isMobile ? "max-w-[380px]" : "max-w-3xl")}>
          {/* Room content (mirrors the live room structure) */}
          <div
            className={cn("relative min-h-[70vh] p-3", a.bgImage && "bg-cover bg-center bg-no-repeat")}
            style={a.bgImage ? { backgroundImage: `linear-gradient(rgba(9,7,18,0.84), rgba(9,7,18,0.92)), url("${cssUrl(a.bgImage)}")` } : undefined}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 text-mist-300">
              <span className="text-xs">← Rooms</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 px-3 py-1 text-[10px] font-bold uppercase text-rose-300"><Radio className="size-3" /> Live</span>
            </div>

            {/* Banner */}
            {a.banner && (
              // eslint-disable-next-line @next/next/no-img-element
              <div className="mt-3 overflow-hidden rounded-2xl border border-white/10"><img src={asSrc(a.banner)} alt="" className="max-h-32 w-full object-cover" /></div>
            )}
            {/* Welcome */}
            {a.welcome && (
              <div className="mt-3 flex items-start gap-2 rounded-2xl border border-lotus-400/25 bg-lotus-500/[0.08] px-3 py-2.5 text-xs text-mist-100">
                <Hand className="mt-0.5 size-3.5 shrink-0 text-lotus-300" /> <span>{a.welcome}</span>
              </div>
            )}

            {/* Identity */}
            <div className="mt-3 flex items-center gap-3">
              <Avatar name={roomName} src={roomImage || undefined} size="lg" ring />
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-display text-lg font-extrabold text-mist-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {a.logo && <img src={asSrc(a.logo)} alt="" className="size-6 rounded object-contain" />}
                  {roomName || "Room name"}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-mist-300">
                  Voice Room <span className="text-mist-500">·</span> <Mic className="size-3 text-emerald-400" /> 3/8 seated <span className="text-mist-500">·</span> <Users className="size-3 text-lotus-300" /> 12 in room
                </div>
              </div>
            </div>

            {/* Control chips */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              {showGames && <Chip icon={Gamepad2} label="Games" />}
              {showStickers && <Chip icon={Sticker} label="Stickers" />}
              {showGift && <Chip icon={GiftIcon} label="Gift" gold />}
              {showMusic && <Chip icon={Music} label="Media" />}
            </div>

            {/* Seat stage */}
            <div className="mt-4 rounded-2xl border border-white/10 bg-ink-900 p-3" style={a.accent ? { borderColor: a.accent } : undefined}>
              <div className={cn("grid gap-x-2 gap-y-3", isMobile ? "grid-cols-4" : "grid-cols-5")}>
                {MOCK.slice(0, isMobile ? 8 : 10).map((n, i) => (
                  <div key={n + i} className="flex flex-col items-center gap-1">
                    <div className="relative">
                      <Avatar name={n} size="md" />
                      {i === 0 && <Crown className="absolute -right-1 -top-1 size-3.5 text-gold-300" />}
                    </div>
                    <span className="max-w-14 truncate text-[10px] text-mist-300">{n}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-300"><span className="size-2 rounded-full bg-emerald-400" /> {MOCK[0]} is speaking…</div>
            </div>

            {/* Chat */}
            {showChat ? (
              <div className="mt-3 rounded-2xl border border-white/10 bg-ink-900/60 p-3">
                <div className="mb-2 text-xs font-semibold text-mist-300">Group chat</div>
                <div className="space-y-2">
                  <Bubble name="Sara" text="Hi everyone 👋" />
                  <Bubble name="Ravi" text="Welcome to the room!" />
                  <Bubble me text="Great to be here" />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-ink-800 text-mist-400"><Paperclip className="size-4" /></span>
                  {showStickers && <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-ink-800 text-lotus-300"><Sticker className="size-4" /></span>}
                  <span className="h-9 flex-1 rounded-lg border border-line bg-ink-800 px-3 text-xs leading-9 text-mist-500">Message the group…</span>
                  {showGift && <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-gradient-to-r from-amber-400 to-pink-500 px-3 text-xs font-bold leading-9 text-white"><GiftIcon className="size-3.5" /> Gift</span>}
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-lotus-600 text-white"><Send className="size-4" /></span>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-ink-900/60 px-4 py-3 text-xs text-mist-500"><Lock className="size-3.5" /> Chat is turned off for this room.</div>
            )}
          </div>
        </div>
      </div>

      <p className="border-t border-white/10 bg-ink-900 px-4 py-2 text-center text-[11px] text-mist-500" onClick={(e) => e.stopPropagation()}>
        Live preview of your current settings — seats, messages and people shown are examples. Save the room settings to publish.
      </p>
    </div>
  );
}

function Chip({ icon: Icon, label, gold }: { icon: typeof Mic; label: string; gold?: boolean }) {
  return (
    <div className={cn("flex items-center justify-center gap-1.5 rounded-2xl border border-line bg-ink-800 px-2 py-2 text-xs font-semibold", gold ? "text-amber-300" : "text-mist-200")}>
      <Icon className={cn("size-3.5", gold && "text-amber-400")} /> {label}
    </div>
  );
}

function Bubble({ name, text, me }: { name?: string; text: string; me?: boolean }) {
  return (
    <div className={cn("flex", me && "justify-end")}>
      <div className={cn("max-w-[80%] rounded-2xl px-3 py-1.5 text-xs", me ? "bg-lotus-600 text-white" : "bg-ink-800 text-mist-200")}>
        {!me && name && <span className="mr-1 font-semibold text-lotus-300">{name}:</span>}{text}
      </div>
    </div>
  );
}
