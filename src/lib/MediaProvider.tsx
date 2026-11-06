"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useVoice } from "@/lib/VoiceProvider";
import { fetchRoomMediaState, type RoomMedia } from "@/lib/rooms";
import { withBase } from "@/lib/base-path";

// APP-LEVEL background media keeper. The room's shared media player (SyncedPlayer)
// lives inside the room page, so it STOPS the moment you navigate away — into a
// game, another section, etc. That was the "media stops in the background" report.
//
// This provider mounts ONCE at the app level (inside VoiceProvider, so it survives
// every route change) and keeps a single hidden <audio> element alive. While the
// room page is in the FOREGROUND, that page's own player handles playback and this
// provider stays idle (so there's never double audio). The moment you leave the
// room page (e.g. open a game), this provider takes over: it polls the room's
// synced media state and keeps the AUDIO playing — honouring the host's
// pause / resume / seek / mute / stop — until you actually leave the room or it's
// stopped. Voice chat is a separate track and is unaffected.

type MediaCtx = { setForeground: (v: boolean) => void };
const Ctx = createContext<MediaCtx>({ setForeground: () => {} });

/** Room pages call this so the background keeper only plays while the room page is
 *  NOT on screen (avoids double playback with the in-room player). */
export function useBackgroundMedia() { return useContext(Ctx); }

const srcUrl = (s: string) => (s.startsWith("http") || s.startsWith("blob:") || s.startsWith("data:") ? s : withBase(s));

export function MediaProvider({ children }: { children: React.ReactNode }) {
  const voice = useVoice();
  const roomId = voice.roomId; // the room I'm connected to (persists across navigation)
  const [foreground, setForegroundState] = useState(true);
  const setForeground = useCallback((v: boolean) => setForegroundState(v), []);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [media, setMedia] = useState<RoomMedia | null>(null);

  // Poll the room's media state ONLY while backgrounded (the room page owns it in
  // the foreground). `undefined` = network hiccup → keep the current state.
  useEffect(() => {
    if (!roomId || foreground) return;
    let on = true;
    const load = async () => {
      const m = await fetchRoomMediaState(roomId);
      if (on && m !== undefined) setMedia(m);
    };
    load();
    const t = setInterval(load, 3000);
    return () => { on = false; clearInterval(t); };
  }, [roomId, foreground]);

  // Whenever we're back in the foreground, or have left the room, hand playback
  // back to the room player / stop — never leave a stray background track running.
  useEffect(() => {
    if (foreground || !roomId) { audioRef.current?.pause(); setMedia(null); }
  }, [foreground, roomId]);

  // Drive the hidden <audio> from the synced media state. Plays AUDIO (and a
  // video's audio track) in the background; youtube/image can't play headless.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const playable = !foreground && media && (media.kind === "audio" || media.kind === "video") ? media : null;
    if (!playable) { el.pause(); return; }
    const url = srcUrl(playable.src);
    if (!el.src.endsWith(url)) { el.src = url; }
    el.muted = !!playable.mutedForAll;
    if (playable.paused) {
      el.pause();
      const target = Math.max(0, Math.floor(playable.pausedAtSec ?? 0));
      if (Number.isFinite(el.duration) && Math.abs(el.currentTime - target) > 1) { try { el.currentTime = target; } catch { /* seek not ready */ } }
    } else {
      const target = Math.max(0, Math.floor((Date.now() - playable.startedAt) / 1000));
      if (Number.isFinite(el.duration) && Math.abs(el.currentTime - target) > 1.5) { try { el.currentTime = target; } catch { /* seek not ready */ } }
      el.play().catch(() => { /* autoplay may need a gesture — retried on the next poll */ });
    }
    // Tell the OS this is active media so mobile keeps it alive in the background
    // and can show lock-screen controls.
    //
    // CRITICAL: while the user is in a VOICE ROOM, the Media Session already
    // belongs to the CALL — VoiceProvider publishes the room as an ongoing call
    // and keeps `playbackState = "playing"`, which is exactly what stops Android
    // suspending the tab (and with it the microphone and the incoming audio).
    // Overwriting it here — especially setting "paused" when a track pauses —
    // told the OS the tab had stopped playing, so the voice connection was
    // allowed to drop in the background. So we only touch the Media Session when
    // we are NOT in a room; inside a room the call metadata stays untouched and
    // the media simply plays alongside it.
    try {
      if ("mediaSession" in navigator && !roomId) {
        const ms = navigator.mediaSession;
        ms.metadata = new MediaMetadata({ title: playable.name || "Now playing", artist: "Lotus" });
        ms.playbackState = playable.paused ? "paused" : "playing";
      }
    } catch { /* MediaSession unsupported — ignore */ }
  }, [media, foreground, roomId]);

  return (
    <Ctx.Provider value={{ setForeground }}>
      {children}
      {/* Persistent, invisible audio sink for background playback. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} className="hidden" playsInline preload="none" />
    </Ctx.Provider>
  );
}
