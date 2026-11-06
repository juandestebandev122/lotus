"use client";

import { useEffect, useState } from "react";
import { X, FileText, Download } from "lucide-react";
import { useConfig } from "@/lib/config";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";

// A named placement zone for an overlay. "free" (or undefined) = the original
// free-position floating layer; the rest are fixed bands on specific screens.
export type OverlayZone = "free" | "aboveSeats" | "belowChat" | "roomList" | "gameTop";

// Admin-placed image overlays (banners / logos / decorations) drawn ON TOP of the
// voice-room screen. Position, size, opacity, on/off, audience and per-room targeting
// are all set live from Admin → Room Overlays — no app update. The container is an
// absolute layer, so the room's root element just needs to be `relative`.
type OverlayItem = NonNullable<ReturnType<typeof useConfig>["config"]["roomOverlays"]>[number];

/**
 * Draw one overlay's MEDIA. An overlay can now be a picture, a VIDEO (played
 * muted + looped in place, exactly like a moving banner), or any other uploaded
 * file — which shows as a tappable tile that opens/downloads it. Anything with no
 * recorded kind is treated as a picture, so every existing overlay is unchanged.
 */
function OverlayMedia({ o, className, style, cover = false }: {
  o: OverlayItem; className?: string; style?: React.CSSProperties; cover?: boolean;
}) {
  const src = o.image.startsWith("data:") ? o.image : withBase(o.image);
  const kind = o.mediaType ?? "image";

  if (kind === "video") {
    return (
      <video
        src={src}
        // Muted + inline + looping is what lets a video autoplay on every browser
        // (a banner must never ask for permission or make noise in a voice room).
        autoPlay muted loop playsInline
        className={cn(className, cover && "h-full w-full object-cover")}
        style={style}
      />
    );
  }
  if (kind === "audio") {
    return (
      <span className={cn("block rounded-lg bg-black/55 p-2", className)} style={style}>
        <audio src={src} controls className="w-full" />
      </span>
    );
  }
  if (kind === "pdf" || kind === "file") {
    return (
      <a
        href={src} target="_blank" rel="noopener noreferrer"
        className={cn("pointer-events-auto flex items-center gap-2 rounded-lg bg-black/60 px-3 py-2 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-black/75", className)}
        style={style}
      >
        <FileText className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{o.fileName || o.name}</span>
        <Download className="size-4 shrink-0 opacity-80" />
      </a>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={o.name} className={cn(className, cover && "h-full w-full object-cover")} style={style} draggable={false} />;
}

function visibleOverlays(config: ReturnType<typeof useConfig>["config"], roomId: string, isHost?: boolean, isVip?: boolean) {
  return (config.roomOverlays ?? []).filter((o) => {
    if (!o.enabled || !o.image) return false;
    if (o.scope === "specific" && !(o.roomIds ?? []).includes(roomId)) return false;
    if (o.visibility === "hosts" && !isHost) return false;
    if (o.visibility === "vip" && !isVip && !isHost) return false;
    return true;
  });
}

export function RoomOverlays({ roomId, isHost, isVip }: { roomId: string; isHost?: boolean; isVip?: boolean }) {
  const { config } = useConfig();
  // "Cover seats" overlays are drawn INSIDE the seat stage by <RoomSeatOverlay/>, and
  // zoned overlays (aboveSeats/belowChat/…) are drawn by <RoomZoneOverlay/> — exclude
  // both here so nothing is drawn twice. This keeps the ORIGINAL free-position overlay
  // behaviour EXACTLY as-is (default zone is "free"/undefined).
  const overlays = visibleOverlays(config, roomId, isHost, isVip).filter((o) => !o.coverSeats && (!o.zone || o.zone === "free"));
  if (overlays.length === 0) return null;
  return (
    // Contained to the ROOM column (the room root is `relative max-w-3xl`), NOT the whole
    // viewport — so a decoration/banner stays inside the room and never spills across the
    // navigation sidebar or the rest of the screen. Positioned as a % of the room column.
    // pointer-events-none → it never blocks the room; a clickable overlay re-enables its own.
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {overlays.map((o) => {
        // Clamp width so an over-sized overlay can't cover the whole room (max 100% of column).
        const style = { left: `${o.xPct}%`, top: `${o.yPct}%`, width: `${Math.min(100, o.widthPct)}%`, opacity: (o.opacity ?? 100) / 100 } as const;
        return o.link ? (
          <a key={o.id} href={o.link} target="_blank" rel="noopener noreferrer" className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2" style={style}>
            <OverlayMedia o={o} className="block w-full select-none" />
          </a>
        ) : (
          <span key={o.id} className="absolute w-full -translate-x-1/2 -translate-y-1/2" style={style}>
            <OverlayMedia o={o} className="block w-full select-none" />
          </span>
        );
      })}
    </div>
  );
}

// "Cover seats" overlays — an image that FILLS the entire seat area (object-cover).
// Mounted as the first child INSIDE the seat-stage container (which is `relative`
// + `overflow-hidden`), so the image is clipped exactly to the seat section and sits
// behind the seats. pointer-events-none → seats stay fully interactive.
export function RoomSeatOverlay({ roomId, isHost, isVip }: { roomId: string; isHost?: boolean; isVip?: boolean }) {
  const { config } = useConfig();
  const overlays = visibleOverlays(config, roomId, isHost, isVip).filter((o) => o.coverSeats);
  if (overlays.length === 0) return null;
  return (
    // -z-10 keeps the image behind the seats (which are static content of the seat
    // stage's stacking context) while still covering the stage's own background.
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl">
      {overlays.map((o) => (
        <OverlayMedia key={o.id} o={o} cover className="absolute inset-0 select-none" style={{ opacity: (o.opacity ?? 100) / 100 }} />
      ))}
    </div>
  );
}

// Fixed-ZONE overlay bands (Above seats / Below chat / Room list / Game top). Each is
// an in-flow horizontal band the parent places in the right spot — independent of the
// free-position layer. When an overlay is marked `closable`, each viewer gets a per-image
// X to dismiss it (remembered on their device), giving every display section its own
// separate close control. Existing free/cover-seat overlays are untouched.
const DISMISS_KEY = "lotus.overlayDismissed";
export function RoomZoneOverlay({ zone, roomId = "", isHost, isVip, className }: { zone: OverlayZone; roomId?: string; isHost?: boolean; isVip?: boolean; className?: string }) {
  const { config } = useConfig();
  const [dismissed, setDismissed] = useState<string[]>([]);
  useEffect(() => {
    try { setDismissed(JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]")); } catch { /* ignore */ }
  }, []);
  const dismiss = (id: string) => setDismissed((prev) => {
    const next = prev.includes(id) ? prev : [...prev, id];
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(next.slice(-300))); } catch { /* ignore */ }
    return next;
  });
  const overlays = visibleOverlays(config, roomId, isHost, isVip).filter((o) => o.zone === zone && !dismissed.includes(o.id));
  if (overlays.length === 0) return null;
  return (
    <div className={cn("flex w-full flex-col items-center gap-2", className)}>
      {overlays.map((o) => {
        const width = `${Math.max(5, Math.min(100, o.widthPct || 100))}%`;
        const img = (
          <OverlayMedia o={o} className="block w-full select-none rounded-lg" style={{ opacity: (o.opacity ?? 100) / 100 }} />
        );
        return (
          <div key={o.id} className="relative" style={{ width }}>
            {o.link ? <a href={o.link} target="_blank" rel="noopener noreferrer" className="block">{img}</a> : img}
            {o.closable && (
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); dismiss(o.id); }} aria-label={`Close ${o.name}`} className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-black/70 text-white ring-1 ring-white/25 transition hover:bg-black">
                <X className="size-3.5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
