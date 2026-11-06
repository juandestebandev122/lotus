"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { withBase } from "./base-path";
import type { Room } from "livekit-client";

export interface VoiceParticipant {
  id: string; // user id (LiveKit identity)
  name: string;
  username?: string;
  avatar?: string;
  isLocal: boolean;
  isSpeaking: boolean;
  muted: boolean;
}

export interface VoiceRoomState {
  configured: boolean; // LiveKit is set up on the server
  connected: boolean;
  participants: VoiceParticipant[];
  audioBlocked: boolean; // browser blocked autoplay — needs a tap to enable sound
  micError: boolean; // mic permission denied / unavailable
  error: string | null;
  startAudio: () => void; // call on a user gesture to unblock playback
}

/**
 * Connect the signed-in user to a room's live voice channel (LiveKit).
 * - `enabled`: connect only while actually in the room (not monitoring/blocked)
 * - `micOn`: publish the microphone (seated + unmuted) — otherwise listen only
 * Returns live participants so the UI can show real people + who is speaking.
 * Safely no-ops (configured:false) when LiveKit isn't set up on the server.
 */
export function useVoiceRoom(
  roomId: string,
  enabled: boolean,
  micOn: boolean,
  selfMeta?: { name?: string; username?: string; avatar?: string },
): VoiceRoomState {
  const [state, setState] = useState<Omit<VoiceRoomState, "startAudio">>({
    configured: false,
    connected: false,
    participants: [],
    audioBlocked: false,
    micError: false,
    error: null,
  });
  const roomRef = useRef<Room | null>(null);

  const startAudio = useCallback(() => {
    roomRef.current
      ?.startAudio()
      .then(() => setState((s) => ({ ...s, audioBlocked: false })))
      .catch(() => {});
  }, []);

  // Connect / disconnect with the room lifecycle.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let room: Room | null = null;

    (async () => {
      try {
        const res = await fetch(withBase(`/api/rooms/${roomId}/token`), { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!data?.configured || !data?.token || !data?.url) {
          setState((s) => ({ ...s, configured: false }));
          return;
        }
        setState((s) => ({ ...s, configured: true }));

        const lk = await import("livekit-client");
        const { Room, RoomEvent } = lk;
        room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        const snapshot = () => {
          if (!room) return;
          const map = (p: import("livekit-client").Participant, isLocal: boolean): VoiceParticipant => {
            let meta: { username?: string; avatar?: string } = {};
            try { meta = p.metadata ? JSON.parse(p.metadata) : {}; } catch {}
            return {
              id: p.identity,
              name: p.name || meta.username || "Guest",
              username: meta.username,
              avatar: meta.avatar,
              isLocal,
              isSpeaking: p.isSpeaking,
              muted: !p.isMicrophoneEnabled,
            };
          };
          const list: VoiceParticipant[] = [map(room.localParticipant, true)];
          room.remoteParticipants.forEach((p) => list.push(map(p, false)));
          setState((s) => ({ ...s, participants: list }));
        };

        const attachAudio = (track: import("livekit-client").RemoteTrack) => {
          if (track.kind !== "audio") return;
          const el = track.attach() as HTMLAudioElement;
          el.setAttribute("data-lk-audio", "1");
          el.style.display = "none";
          el.autoplay = true;
          (el as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
          document.body.appendChild(el);
          el.play().catch(() => {}); // best-effort; the Enable-sound button covers blocks
        };

        room
          .on(RoomEvent.ParticipantConnected, snapshot)
          .on(RoomEvent.ParticipantDisconnected, snapshot)
          .on(RoomEvent.ActiveSpeakersChanged, snapshot)
          .on(RoomEvent.TrackMuted, snapshot)
          .on(RoomEvent.TrackUnmuted, snapshot)
          // CRITICAL: actually play other people's audio by attaching the track.
          .on(RoomEvent.TrackSubscribed, (track) => { attachAudio(track); snapshot(); })
          .on(RoomEvent.TrackUnsubscribed, (track) => {
            if (track.kind === "audio") track.detach().forEach((el) => el.remove());
            snapshot();
          })
          .on(RoomEvent.LocalTrackPublished, snapshot)
          .on(RoomEvent.LocalTrackUnpublished, snapshot)
          .on(RoomEvent.ParticipantMetadataChanged, snapshot)
          // Autoplay status — show the "Enable sound" prompt when the browser blocks it.
          .on(RoomEvent.AudioPlaybackStatusChanged, () => {
            setState((s) => ({ ...s, audioBlocked: !!room && !room.canPlaybackAudio }));
          })
          .on(RoomEvent.Connected, () => { setState((s) => ({ ...s, connected: true })); snapshot(); })
          .on(RoomEvent.Disconnected, () => setState((s) => ({ ...s, connected: false })));

        await room.connect(data.url, data.token);
        if (cancelled) { await room.disconnect(); return; }
        snapshot();
        // Try to start audio immediately; if blocked, surface the prompt + a
        // one-time global click fallback (any tap enables sound).
        room.startAudio().catch(() => {});
        setState((s) => ({ ...s, audioBlocked: !!room && !room.canPlaybackAudio }));
        const resume = () => { startAudio(); document.removeEventListener("click", resume); };
        document.addEventListener("click", resume);
      } catch (e) {
        if (!cancelled) setState((s) => ({ ...s, error: e instanceof Error ? e.message : "Voice connection failed" }));
      }
    })();

    return () => {
      cancelled = true;
      const r = roomRef.current;
      roomRef.current = null;
      r?.disconnect();
      // Remove any audio elements we attached for remote participants.
      document.querySelectorAll("[data-lk-audio]").forEach((el) => el.remove());
      setState((s) => ({ ...s, connected: false, participants: [] }));
    };
  }, [roomId, enabled, startAudio]);

  // Publish/unpublish the microphone as the mute state changes; capture errors.
  useEffect(() => {
    const room = roomRef.current;
    if (!room || !state.connected) return;
    room.localParticipant
      .setMicrophoneEnabled(micOn)
      .then(() => setState((s) => ({ ...s, micError: false })))
      .catch(() => { if (micOn) setState((s) => ({ ...s, micError: true })); });
  }, [micOn, state.connected]);

  // Push the user's latest name/avatar to the room live, so changing your photo
  // updates your seat for EVERYONE without rejoining.
  useEffect(() => {
    const room = roomRef.current;
    if (!room || !state.connected || !selfMeta) return;
    try {
      room.localParticipant.setMetadata(JSON.stringify({ username: selfMeta.username, avatar: selfMeta.avatar }));
      if (selfMeta.name) room.localParticipant.setName(selfMeta.name);
    } catch {
      /* ignore — requires canUpdateOwnMetadata grant */
    }
  }, [selfMeta?.name, selfMeta?.avatar, selfMeta?.username, state.connected]);

  return { ...state, startAudio };
}
