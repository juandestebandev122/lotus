"use client";

import { useEffect, useRef, useState } from "react";
import { useVoice } from "@/lib/VoiceProvider";
import { useConfig } from "@/lib/config";
import { Avatar } from "@/components/ui/Avatar";
import { Video, VideoOff, Mic, MicOff, Maximize2, Minimize2, X, MoreVertical, EyeOff, Eye, SwitchCamera, Crown, Star, Lock, Unlock } from "lucide-react";
import { cn } from "@/lib/cn";

export interface RoomVideoProps {
  unlocked: boolean;
  myId: string;
  iAmHost: boolean; // host OR co-host (can moderate)
  hostId: string;
  coHostIds: string[];
  cameraOffIds: string[]; // members whose camera the host force-closed
  videoMembersAllowed: boolean; // can members (non host/co-host) use video?
  mutedIds: string[]; // room.mutedMemberIds — for the mic-mute state
  onToggleMute: (userId: string) => void;
  onCloseUserCamera: (userId: string, off: boolean) => void;
  onToggleMembersVideo: (allowed: boolean) => void;
  autoStart?: boolean; // Paid Zone video call — turn my camera on automatically.
}

// One participant's camera tile — attaches the LiveKit camera track to <video>.
function VideoTile({
  id, name, cameraOn, muted, speaking, isHost, isCoHost, fill, onTap,
}: {
  id: string; name: string; cameraOn: boolean; muted: boolean; speaking: boolean;
  isHost: boolean; isCoHost: boolean; fill?: boolean; onTap?: () => void;
}) {
  const { attachVideo } = useVoice();
  const { config: videoCfg } = useConfig();
  const showCrown = videoCfg.roomControls?.showHostCrown !== false;
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!cameraOn || !ref.current) return;
    return attachVideo(id, ref.current);
  }, [id, cameraOn, attachVideo]);

  return (
    <div
      onClick={onTap}
      className={cn(
        "relative overflow-hidden rounded-xl border bg-ink-900",
        fill ? "h-full w-full" : "aspect-video cursor-pointer",
        speaking ? "border-emerald-400/70" : "border-white/10",
      )}
    >
      {cameraOn ? (
        <video ref={ref} autoPlay playsInline muted className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center bg-ink-850"><Avatar name={name} size={fill ? "2xl" : "lg"} /></div>
      )}
      <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">
        {muted ? <MicOff className="size-3 text-rose-300" /> : <Mic className="size-3 text-emerald-300" />}
        {/* Host crown — hidden when the admin turns "Show Crown Badge" off
            (Admin → Rooms), so the toggle behaves the same on every room surface. */}
        {isHost && showCrown && <Crown className="size-3 text-gold-300" />}
        {isCoHost && <Star className="size-3 text-lotus-300" />}
        <span className="max-w-28 truncate">{name}</span>
      </span>
    </div>
  );
}

export function RoomVideo(props: RoomVideoProps) {
  const { unlocked, myId, iAmHost, hostId, coHostIds, cameraOffIds, videoMembersAllowed, mutedIds, onToggleMute, onCloseUserCamera, onToggleMembersVideo, autoStart } = props;
  const voice = useVoice();
  const autoStartedRef = useRef(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set()); // locally hidden (per-viewer)
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState<string | null>(null);

  const myForcedOff = cameraOffIds.includes(myId);
  const allowed = videoMembersAllowed !== false; // members may use their camera?
  const myVideoBlocked = myForcedOff || (!iAmHost && !allowed);

  // If the host force-closed my camera (or members-video was switched off), make
  // sure my camera actually turns off — no reconnect, just stops my track.
  useEffect(() => {
    if (myVideoBlocked && voice.videoEnabled) voice.setVideoEnabled(false);
  }, [myVideoBlocked, voice.videoEnabled, voice.setVideoEnabled]);

  // Paid Zone video call: turn my camera on automatically (once) so video
  // appears for both sides without anyone hunting for a "Turn on camera" button.
  useEffect(() => {
    if (!autoStart || autoStartedRef.current || myVideoBlocked) return;
    if (!voice.connected) return; // wait until I'm actually in the LiveKit room
    autoStartedRef.current = true;
    if (!voice.videoEnabled) voice.setVideoEnabled(true);
  }, [autoStart, myVideoBlocked, voice.connected, voice.videoEnabled, voice.setVideoEnabled]);

  if (!unlocked) return null;

  const onCamera = voice.participants.filter((p) => p.cameraOn);
  const fsP = fullscreen ? voice.participants.find((p) => p.id === fullscreen) : null;

  const label = (p: { id: string; name: string; isLocal: boolean }) => (p.isLocal ? "You" : p.name);
  const roleOf = (id: string) => ({ isHost: id === hostId, isCoHost: coHostIds.includes(id) });

  return (
    <div className="mt-4 rounded-2xl border border-lotus-400/20 bg-ink-850/60 p-3">
      {/* Header: title + my camera controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-mist-200">
          <Video className="size-4 text-lotus-300" /> Video
          {onCamera.length > 0 && <span className="text-xs font-normal text-mist-500">· {onCamera.length} on camera</span>}
        </span>
        <div className="flex items-center gap-1.5">
          {voice.videoEnabled && (
            <button onClick={() => voice.switchCamera()} title="Switch camera (front/back)" className="grid size-8 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20">
              <SwitchCamera className="size-4" />
            </button>
          )}
          <button
            onClick={() => !myVideoBlocked && voice.setVideoEnabled(!voice.videoEnabled)}
            disabled={myVideoBlocked}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
              myVideoBlocked ? "cursor-not-allowed bg-ink-800 text-mist-500" : voice.videoEnabled ? "bg-rose-500/15 text-rose-300 hover:bg-rose-500/25" : "bg-lotus-500/90 text-white hover:bg-lotus-500",
            )}
          >
            {voice.videoEnabled ? <><VideoOff className="size-3.5" /> Turn off</> : <><Video className="size-3.5" /> Turn on camera</>}
          </button>
        </div>
      </div>

      {/* HOST CAMERA CONTROL — host / co-host lock or allow members' cameras.
          Locked = members can't turn on their camera; Allowed = they can (if they
          granted camera permission on their device). Only shown to host/co-host. */}
      {iAmHost && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-ink-900/50 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            {allowed ? <Video className="size-4 shrink-0 text-emerald-300" /> : <VideoOff className="size-4 shrink-0 text-amber-300" />}
            <div className="min-w-0 leading-tight">
              <p className="text-xs font-bold text-mist-100">Member cameras</p>
              <p className="truncate text-[11px] text-mist-400">
                {allowed ? "Members can turn on their camera" : "Locked — only host & co-hosts can use camera"}
              </p>
            </div>
          </div>
          <button
            onClick={() => onToggleMembersVideo(!allowed)}
            title={allowed ? "Lock members' cameras" : "Allow members to use their camera"}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition",
              allowed
                ? "bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/30 hover:bg-rose-500/25"
                : "bg-emerald-500/90 text-white hover:bg-emerald-500",
            )}
          >
            {allowed ? <><Lock className="size-3.5" /> Lock Camera</> : <><Unlock className="size-3.5" /> Allow Camera</>}
          </button>
        </div>
      )}

      {myVideoBlocked && (
        <p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-1.5 text-center text-[11px] text-amber-200">
          {myForcedOff ? "The host turned your camera off." : "The host has locked cameras — only the host & co-hosts can use their camera right now."}
        </p>
      )}

      {/* Grid of everyone on camera */}
      {onCamera.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {onCamera.map((p) => {
            const r = roleOf(p.id);
            const isHidden = hidden.has(p.id);
            const canModerate = iAmHost && !p.isLocal;
            return (
              <div key={p.id} className="relative">
                {isHidden ? (
                  <div className="grid aspect-video place-items-center rounded-xl border border-white/10 bg-ink-900 text-center">
                    <button onClick={() => setHidden((s) => { const n = new Set(s); n.delete(p.id); return n; })} className="flex flex-col items-center gap-1 text-xs text-mist-400 hover:text-mist-200">
                      <Eye className="size-5" /> Show {label(p)}
                    </button>
                  </div>
                ) : (
                  <VideoTile id={p.id} name={label(p)} cameraOn={p.cameraOn} muted={p.muted} speaking={p.isSpeaking} isHost={r.isHost} isCoHost={r.isCoHost} onTap={() => setFullscreen(p.id)} />
                )}

                {/* Per-tile controls */}
                <div className="absolute right-1 top-1 flex items-center gap-1">
                  <button onClick={() => setFullscreen(p.id)} title="Full screen" className="grid size-6 place-items-center rounded-md bg-black/50 text-white hover:bg-black/70"><Maximize2 className="size-3" /></button>
                  {!p.isLocal && (
                    <button onClick={() => setMenuFor(menuFor === p.id ? null : p.id)} title="Options" className="grid size-6 place-items-center rounded-md bg-black/50 text-white hover:bg-black/70"><MoreVertical className="size-3" /></button>
                  )}
                </div>

                {menuFor === p.id && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setMenuFor(null)} />
                    <div className="absolute right-1 top-8 z-30 w-44 overflow-hidden rounded-xl border border-white/10 bg-ink-850 py-1 shadow-2xl">
                      {/* Anyone can hide a tile locally for themselves */}
                      <button onClick={() => { setHidden((s) => { const n = new Set(s); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n; }); setMenuFor(null); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-mist-200 hover:bg-white/[0.06]">
                        {isHidden ? <><Eye className="size-3.5" /> Show video</> : <><EyeOff className="size-3.5" /> Hide for me</>}
                      </button>
                      {canModerate && (
                        <>
                          <button onClick={() => { onToggleMute(p.id); setMenuFor(null); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-mist-200 hover:bg-white/[0.06]">
                            {mutedIds.includes(p.id) ? <><Mic className="size-3.5 text-emerald-300" /> Unmute mic</> : <><MicOff className="size-3.5 text-rose-300" /> Mute mic</>}
                          </button>
                          <button onClick={() => { onCloseUserCamera(p.id, !cameraOffIds.includes(p.id)); setMenuFor(null); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-mist-200 hover:bg-white/[0.06]">
                            {cameraOffIds.includes(p.id) ? <><Video className="size-3.5 text-emerald-300" /> Allow camera</> : <><VideoOff className="size-3.5 text-rose-300" /> Close camera</>}
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-2 rounded-lg bg-white/[0.03] px-3 py-2.5 text-center text-xs text-mist-500">
          Video is unlocked for this room. Tap <b className="text-mist-300">Turn on camera</b> to start — anyone on camera shows here.
        </p>
      )}

      {/* Full-screen / maximize a single participant */}
      {fsP && (
        <div className="fixed inset-0 z-[120] flex flex-col bg-black/95 p-3" onClick={() => setFullscreen(null)}>
          <div className="flex items-center justify-between text-white" onClick={(e) => e.stopPropagation()}>
            <span className="flex items-center gap-1.5 text-sm font-semibold">{label(fsP)} {fsP.muted ? <MicOff className="size-4 text-rose-300" /> : <Mic className="size-4 text-emerald-300" />}</span>
            {/* Clear MINIMIZE (restore) — plus the X and tapping the backdrop also close. */}
            <button onClick={() => setFullscreen(null)} title="Minimize" className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold hover:bg-white/20">
              <Minimize2 className="size-4" /> Minimize
            </button>
          </div>
          <div className="min-h-0 flex-1 py-3" onClick={(e) => e.stopPropagation()}>
            <VideoTile id={fsP.id} name={label(fsP)} cameraOn={fsP.cameraOn} muted={fsP.muted} speaking={fsP.isSpeaking} {...roleOf(fsP.id)} fill />
          </div>
          {/* Controls in fullscreen: own camera switch, or host moderation */}
          <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
            {fsP.isLocal && voice.videoEnabled && (
              <button onClick={() => voice.switchCamera()} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"><SwitchCamera className="size-4" /> Switch camera</button>
            )}
            {iAmHost && !fsP.isLocal && (
              <>
                <button onClick={() => onToggleMute(fsP.id)} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20">
                  {mutedIds.includes(fsP.id) ? <><Mic className="size-4" /> Unmute</> : <><MicOff className="size-4" /> Mute</>}
                </button>
                <button onClick={() => onCloseUserCamera(fsP.id, !cameraOffIds.includes(fsP.id))} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20">
                  {cameraOffIds.includes(fsP.id) ? <><Video className="size-4" /> Allow camera</> : <><VideoOff className="size-4" /> Close camera</>}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
