"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Volume2, VolumeX, ChevronRight, Lock, Unlock, PhoneOff, GripVertical, Users } from "lucide-react";
import { useVoice } from "@/lib/VoiceProvider";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { fetchRoom, updateRoom, type RoomView } from "@/lib/rooms";
import { cn } from "@/lib/cn";

/**
 * A small persistent bar that appears whenever you're connected to a room's
 * voice but viewing ANOTHER screen (most importantly, while playing a game).
 * It proves voice is still live, lets you talk/mute, enable sound, jump back to
 * the room, and — for the host/co-host — mute or allow all members' voice.
 * Hidden on the room's own page (which has the full controls).
 */
export function VoiceDock() {
  const voice = useVoice();
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [room, setRoom] = useState<RoomView | null>(null);
  // "Who can I hear" panel — per-person Speaker Off / Speaker On for THIS device.
  const [speakersOpen, setSpeakersOpen] = useState(false);

  // If the host removed/blocked us, the provider drops voice on any screen — here
  // we tell the user and send them back to the rooms list.
  const { kicked, clearKicked } = voice;
  useEffect(() => {
    if (!kicked) return;
    toast(
      kicked.reason === "blocked"
        ? "You have been blocked from this room by the host."
        : "You were removed from this room by the host. You can join it again from the Rooms list.",
      "error",
    );
    clearKicked();
    router.push("/rooms");
  }, [kicked, clearKicked, router, toast]);

  const roomId = voice.roomId;
  const onRoomPage = !!roomId && pathname === `/rooms/${roomId}`;
  const show = !!roomId && !onRoomPage && voice.configured;

  // Keep the room name + my host status + the voice-lock state fresh.
  useEffect(() => {
    if (!show || !roomId) { setRoom(null); return; }
    let on = true;
    const load = () => {
      if (typeof document !== "undefined" && document.hidden) return; // pause when backgrounded
      fetchRoom(roomId).then((r) => { if (on) setRoom(r ?? null); });
    };
    load();
    const t = setInterval(load, 7000);
    return () => { on = false; clearInterval(t); };
  }, [show, roomId]);

  const iAmHost = !!room && !!user && room.ownerId === user.id;
  const iAmCoHost = !!room && !!user && (room.coAdminIds ?? []).includes(user.id);

  // Enforce host mute / voice-lock while I'm OFF the room page (e.g. in a game),
  // where the room page isn't mounted to do it. Mirrors the room page logic.
  const { setForceMuted } = voice;
  useEffect(() => {
    if (!show || !room || !user) return;
    // Host & co-hosts can always speak — never force-muted.
    const forced = !iAmHost && !iAmCoHost && ((room.mutedMemberIds ?? []).includes(user.id) || !!room.voiceLocked);
    setForceMuted(forced);
  }, [show, room, user, iAmHost, iAmCoHost, setForceMuted]);

  // Session timer — how long I've been in this room.
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!show || !voice.joinedAt) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [show, voice.joinedAt]);

  if (!show || !roomId) return null;

  const canLock = iAmHost || iAmCoHost || user?.role === "admin";
  const voiceLocked = !!room?.voiceLocked;
  const speaking = voice.participants.some((p) => p.isSpeaking);
  const hostName = room?.host?.fullName ? room.host.fullName.split(" ")[0] : "";

  const elapsed = voice.joinedAt ? Math.max(0, Math.floor((now - voice.joinedAt) / 1000)) : 0;
  const pad = (n: number) => String(n).padStart(2, "0");
  const timer =
    elapsed >= 3600
      ? `${Math.floor(elapsed / 3600)}:${pad(Math.floor((elapsed % 3600) / 60))}:${pad(elapsed % 60)}`
      : `${Math.floor(elapsed / 60)}:${pad(elapsed % 60)}`;

  const toggleLock = async () => {
    if (!room) return;
    const next = !voiceLocked;
    setRoom({ ...room, voiceLocked: next });
    await updateRoom(roomId, { voiceLocked: next });
  };

  const leaveRoom = async () => {
    await voice.leave();
    toast("You have left the room.", "info");
    router.push("/rooms");
  };

  return (
    <FloatingDock>
      <div className="pointer-events-auto flex w-[min(92vw,24rem)] cursor-grab items-center gap-1.5 rounded-2xl border border-lotus-400/30 bg-ink-900/70 p-2 pl-1 shadow-xl backdrop-blur-md active:cursor-grabbing" title="Drag anywhere to move this window">
        {/* Visual drag cue — but the WHOLE widget is draggable (grab it anywhere). */}
        <span className="grid h-9 w-5 shrink-0 place-items-center text-mist-500" aria-hidden>
          <GripVertical className="size-4" />
        </span>
        {/* Live indicator + jump back to the room */}
        <Link href={`/rooms/${roomId}`} draggable={false} className="flex min-w-0 flex-1 items-center gap-2">
          <span className="relative flex size-2.5 shrink-0">
            <span className={cn("absolute inline-flex size-full rounded-full", speaking ? "animate-ping bg-emerald-400/70" : "bg-emerald-500/40")} />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold text-mist-100">
              {room?.name ? room.name : "In voice room"}
            </span>
            <span className="block truncate text-[11px] text-mist-400">
              {voice.connected
                ? `${hostName ? `Host ${hostName} · ` : ""}${voice.participants.length} in voice · ⏱ ${timer}`
                : "Connecting…"}
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-mist-500" />
        </Link>

        {/* Enable sound (autoplay was blocked) */}
        {voice.audioBlocked && (
          <button
            onClick={() => voice.startAudio()}
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
            title="Enable sound"
          >
            <Volume2 className="size-4" />
          </button>
        )}

        {/* 🔊 Speakers — per-person "Speaker Off / On", MY DEVICE ONLY. Works on
            every screen (Ludo, Snake, Chess, chats…) so a player can silence one
            person during gameplay without touching that person's microphone. */}
        <button
          onClick={() => setSpeakersOpen((v) => !v)}
          className={cn(
            "relative grid size-9 shrink-0 place-items-center rounded-xl",
            voice.speakerOff.length ? "bg-sky-500/20 text-sky-300" : "bg-ink-800 text-mist-300 hover:text-mist-100",
          )}
          title="Speaker Off / Speaker On — choose who you hear on this device"
        >
          <Users className="size-4" />
          {voice.speakerOff.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-sky-500 px-1 text-[9px] font-bold text-white">
              {voice.speakerOff.length}
            </span>
          )}
        </button>

        {/* Host: mute / allow all members' voice (e.g. during a game) */}
        {canLock && (
          <button
            onClick={toggleLock}
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-xl",
              voiceLocked ? "bg-rose-500/15 text-rose-300 hover:bg-rose-500/25" : "bg-ink-800 text-mist-300 hover:text-mist-100",
            )}
            title={voiceLocked ? "Members muted — tap to allow voice" : "Mute all members' voice"}
          >
            {voiceLocked ? <Lock className="size-4" /> : <Unlock className="size-4" />}
          </button>
        )}

        {/* My mic */}
        <button
          onClick={() => { if (!voice.forceMuted) { voice.setMuted(!voice.muted); voice.startAudio(); } }}
          disabled={voice.forceMuted}
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-xl disabled:opacity-50",
            voice.muted || voice.forceMuted ? "bg-ink-800 text-mist-300" : "bg-emerald-500/20 text-emerald-300",
          )}
          title={voice.forceMuted ? "Muted by the host" : voice.muted ? "Unmute" : "Mute"}
        >
          {voice.muted || voice.forceMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
        </button>

        {/* Leave the room — separated from the mic button so it can't be mis-tapped. */}
        <span className="mx-0.5 h-6 w-px shrink-0 bg-white/10" aria-hidden />
        <button
          onClick={leaveRoom}
          className="grid size-9 shrink-0 place-items-center rounded-xl bg-rose-500/15 text-rose-300 hover:bg-rose-500/25"
          title="Leave room"
        >
          <PhoneOff className="size-4" />
        </button>
      </div>

      {/* Per-person speaker list. Local to this device: turning someone's speaker
          off never mutes their microphone and never changes what others hear. */}
      {speakersOpen && (
        <div className="pointer-events-auto mt-1.5 w-[min(92vw,24rem)] rounded-2xl border border-white/10 bg-ink-900/95 p-2 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between px-1.5 pb-1.5">
            <p className="text-[11px] font-semibold text-mist-200">🔊 Who you hear (this device only)</p>
            {voice.speakerOff.length > 0 && (
              <button onClick={() => voice.clearSpeakerOff()} className="text-[11px] font-semibold text-lotus-300 hover:text-lotus-200">
                Hear everyone
              </button>
            )}
          </div>
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {voice.participants.filter((p) => !p.isLocal).map((p) => {
              const off = voice.isSpeakerOff(p.id);
              return (
                <div key={p.id} className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-xs text-mist-100">{p.name}</span>
                  {/* 🎤 their mic state — read-only here, shown so the two ideas
                      never get confused with each other. */}
                  <span className={cn("grid size-6 shrink-0 place-items-center rounded-md", p.muted ? "bg-ink-800 text-mist-400" : "bg-emerald-500/20 text-emerald-300")} title={p.muted ? "Their microphone is off" : "Their microphone is on"}>
                    {p.muted ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
                  </span>
                  {/* 🔊 my speaker for them */}
                  <button
                    onClick={() => voice.setSpeakerOff(p.id, !off)}
                    className={cn(
                      "flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition",
                      off ? "bg-rose-500/15 text-rose-300 hover:bg-rose-500/25" : "bg-white/[0.06] text-mist-200 hover:bg-white/12",
                    )}
                    title={off ? "Speaker On — hear them again" : "Speaker Off — stop hearing them on this device"}
                  >
                    {off ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
                    {off ? "Speaker On" : "Speaker Off"}
                  </button>
                </div>
              );
            })}
            {voice.participants.filter((p) => !p.isLocal).length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-mist-500">No one else is in voice right now.</p>
            )}
          </div>
          <p className="px-1.5 pt-1.5 text-[10px] leading-snug text-mist-500">
            <b className="text-mist-400">🎤 Mute</b> turns a microphone off for the whole room. <b className="text-mist-400">🔊 Speaker Off</b> only stops the sound on <b>your</b> device — their mic keeps working and everyone else still hears them.
          </p>
        </div>
      )}
    </FloatingDock>
  );
}

/**
 * Positions its child as a FLOATING, DRAGGABLE widget the user can place anywhere
 * on the screen. The WHOLE widget is a drag surface (grab it anywhere — the grip
 * is just a visual cue), yet the inner buttons/link still work as normal taps: a
 * press that moves less than a few pixels is treated as a tap, anything more as a
 * drag (and the click that would follow is swallowed). The position is clamped to
 * the viewport and remembered in localStorage. Defaults to the top-right corner so
 * it never covers bottom-of-screen actions (e.g. the KYC submit button / bottom nav).
 */
const DRAG_THRESHOLD = 6; // px of movement before a press becomes a drag (not a tap)

function FloatingDock({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; startY: number; elX: number; elY: number; moved: boolean; id: number } | null>(null);
  const justDragged = useRef(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem("lotus.dock.pos");
      if (s) { const p = JSON.parse(s); if (typeof p?.x === "number" && typeof p?.y === "number") setPos(p); }
    } catch { /* ignore */ }
  }, []);

  const clamp = useCallback((x: number, y: number) => {
    const el = ref.current;
    const w = el?.offsetWidth ?? 320;
    const h = el?.offsetHeight ?? 56;
    const maxX = Math.max(8, window.innerWidth - w - 8);
    const maxY = Math.max(8, window.innerHeight - h - 8);
    return { x: Math.min(Math.max(8, x), maxX), y: Math.min(Math.max(8, y), maxY) };
  }, []);

  // Re-clamp into view on resize / orientation change so it can't get stranded off-screen.
  useEffect(() => {
    const onResize = () => setPos((p) => (p ? clamp(p.x, p.y) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clamp]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button != null && e.button > 0) return; // left button / touch / pen only
    justDragged.current = false;
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    // Grab anywhere on the widget; remember where it and the pointer started.
    drag.current = { startX: e.clientX, startY: e.clientY, elX: r.left, elY: r.top, moved: false, id: e.pointerId };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return; // still might be a tap
      d.moved = true;
      try { ref.current?.setPointerCapture(d.id); } catch { /* ignore */ }
    }
    e.preventDefault();
    setPos(clamp(d.elX + dx, d.elY + dy)); // absolute left/top from here on
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (d?.moved) {
      justDragged.current = true; // swallow the click that would otherwise fire
      setPos((p) => { if (p) { try { localStorage.setItem("lotus.dock.pos", JSON.stringify(p)); } catch { /* ignore */ } } return p; });
      try { ref.current?.releasePointerCapture(d.id); } catch { /* ignore */ }
    }
    drag.current = null;
  };
  // If the press turned into a drag, cancel the click so it doesn't open the room
  // or toggle a button. Reset happens on the next pointer-down.
  const onClickCapture = (e: React.MouseEvent) => {
    if (justDragged.current) { e.preventDefault(); e.stopPropagation(); }
  };

  // No saved/active position yet → default to the top-right corner (below the header).
  const style: React.CSSProperties = pos ? { left: pos.x, top: pos.y } : { top: 72, right: 12 };

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture}
      className="pointer-events-auto fixed z-[55] touch-none select-none"
      style={style}
    >
      {children}
    </div>
  );
}
