"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Room } from "livekit-client";
import { withBase } from "./base-path";
import { enterRoom, exitRoom, logRoomEvent } from "./rooms";
import { lifelog } from "./lifelog";
import { useToast } from "@/components/ui/Toast";

// Fire-and-forget voice-connection diagnostics → server logs (so we can see why
// voice fails for a user without their browser console).
function reportVoiceDiag(payload: { stage: string; roomId: string; error?: string; ua?: string; ms?: number; ice?: string }) {
  try {
    fetch(withBase("/api/voice-diag"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      keepalive: true,
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {}
}

// A 1-second SILENT wav (inaudible). Looped on a real <audio> element, it keeps
// the page classified as "playing media" — which is what lets ANDROID keep the
// voice connection + microphone alive while the app is backgrounded / the screen
// is locked (a backgrounded tab with no playing media gets suspended).
let silentWavUri: string | null = null;
function getSilentWav(): string {
  if (silentWavUri) return silentWavUri;
  const sampleRate = 8000, n = sampleRate; // 1 second
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, "RIFF"); v.setUint32(4, 36 + n, true); ws(8, "WAVE"); ws(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate, true);
  v.setUint16(32, 1, true); v.setUint16(34, 8, true); ws(36, "data"); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128); // 8-bit unsigned silence = 128
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  silentWavUri = "data:audio/wav;base64," + btoa(bin);
  return silentWavUri;
}

export interface VoiceParticipant {
  id: string; // user id (LiveKit identity)
  name: string;
  username?: string;
  avatar?: string;
  isLocal: boolean;
  isSpeaking: boolean;
  muted: boolean;
  cameraOn: boolean; // publishing their camera (video feature)
}

export interface SelfMeta { name?: string; username?: string; avatar?: string }

interface VoiceContextValue {
  // which room we're currently joined to (persists across navigation)
  roomId: string | null;
  configured: boolean; // LiveKit is set up on the server
  connected: boolean;
  participants: VoiceParticipant[];
  audioBlocked: boolean;
  micError: boolean;
  muted: boolean; // the user's own mute choice
  forceMuted: boolean; // muted by the host (cannot unmute)
  joinBlock: string | null; // set when you're already active in another room
  kicked: { roomId: string; reason: "removed" | "blocked" } | null; // host removed/blocked me
  clearKicked: () => void;
  joinedAt: number | null; // epoch ms when we joined this room (for the session timer)
  error: string | null;

  // join a room — no-op if already joined to it (keeps the live session intact).
  // roomName is shown on the background call notification (lock screen / app-switch).
  connect: (roomId: string, self?: SelfMeta, roomName?: string, opts?: { monitor?: boolean }) => void;
  // leave the room for good (explicit user action / logout)
  leave: () => Promise<void>;
  setMuted: (m: boolean) => void;
  setForceMuted: (m: boolean) => void;
  startAudio: () => void;
  // ---- "Speaker Off" (per-listener, local only) --------------------------
  // COMPLETELY SEPARATE from Mute. Mute controls a MICROPHONE (the speaker's own,
  // or a host muting someone for the whole room). Speaker Off only stops that
  // person's audio from being heard ON THIS DEVICE — their mic keeps running and
  // everyone else still hears them normally. The choice is remembered on this
  // device and applies in voice rooms AND in gameplay.
  speakerOff: string[]; // user ids silenced for me
  isSpeakerOff: (userId: string) => boolean;
  setSpeakerOff: (userId: string, off: boolean) => void;
  clearSpeakerOff: () => void;
  // Video (camera) — only meaningful in rooms where the admin unlocked video.
  videoEnabled: boolean;
  setVideoEnabled: (on: boolean) => void;
  switchCamera: () => void;
  attachVideo: (participantId: string, el: HTMLVideoElement) => () => void;
  updateSelf: (self: SelfMeta) => void;
  retryJoin: () => Promise<void>;
  reconnectVoice: () => Promise<void>; // restore audio without leaving the room/seat
  // When true (default), the voice room keeps running while the app is in the
  // background (screen lock / app switch). When false, the mic is released the
  // moment the app is backgrounded (frees the mic for other apps). Either way,
  // closing the app fully disconnects.
  bgVoice: boolean;
  setBgVoice: (on: boolean) => void;
  // Recording: mix all live audio (remote speakers + my mic) into one stream for a
  // MediaRecorder. Returns null when there's nothing live to record.
  captureRoomAudio: () => { stream: MediaStream; stop: () => void } | null;
}

const BG_VOICE_KEY = "lotus.voice.bg";
// Per-device list of people the user has turned the SPEAKER OFF for. Kept on the
// device (never sent to the server) because it must not affect anybody else.
const SPEAKER_OFF_KEY = "lotus.voice.speakerOff";

const VoiceContext = createContext<VoiceContextValue | null>(null);

/**
 * Global voice session. Mounted ABOVE the page tree (in the app layout) so the
 * LiveKit connection, the microphone state and the room presence survive every
 * navigation — opening your profile, sending a message, joining a game, viewing
 * another user, or refreshing a sub-screen no longer disconnects you. The
 * session ends ONLY when the user explicitly leaves the room (or logs out).
 */
export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [state, setState] = useState({
    configured: false,
    connected: false,
    participants: [] as VoiceParticipant[],
    audioBlocked: false,
    micError: false,
    error: null as string | null,
  });
  const [muted, setMutedState] = useState(true);
  const [forceMuted, setForceMutedState] = useState(false);
  const [videoEnabled, setVideoEnabledState] = useState(false); // local camera on/off
  const [joinBlock, setJoinBlock] = useState<string | null>(null);
  // Keep voice running in the background by default (only OFF if the user chose).
  const [bgVoice, setBgVoiceState] = useState(true);
  const [kicked, setKicked] = useState<{ roomId: string; reason: "removed" | "blocked" } | null>(null);
  const [joinedAt, setJoinedAt] = useState<number | null>(null); // when we joined (for the timer)

  // Toasts for voice recovery ("Reconnecting voice…" / "Voice connection restored").
  // A ref keeps the long-lived LiveKit event handlers pointing at the latest toast fn.
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const roomRef = useRef<Room | null>(null);
  const selfRef = useRef<SelfMeta>({});
  const roomNameRef = useRef<string>(""); // shown on the background call notification
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const forceMutedRef = useRef(forceMuted);
  forceMutedRef.current = forceMuted;
  const bgVoiceRef = useRef(bgVoice);
  bgVoiceRef.current = bgVoice;
  // Set by the background effect; lets the mute effect refresh the call
  // notification's Mute/Unmute state whenever the mic toggles.
  const micReflectRef = useRef<() => void>(() => {});

  // Bring the microphone back to the user's intended state, re-acquiring a fresh
  // mic track if the OS suspended it (which happens after the app is
  // backgrounded — LiveKit still thinks the mic is "on" but no audio flows, so a
  // plain setMicrophoneEnabled(true) is a no-op). Used on foreground return AND
  // when the user toggles the mic, so unmuting always actually transmits.
  const recoveringRef = useRef(false);
  // Set true once a mic re-acquire has produced a genuinely live, unmuted track,
  // so the foreground-return retries can stop early instead of needlessly
  // restarting a mic that's already working (which would blip the audio).
  const micOkRef = useRef(false);
  // When set to a room id, the next teardown+reconnect of THAT room is a
  // transient reconnect (e.g. resuming after the OS killed the socket on
  // background) — NOT a real leave. We use it to keep the user's presence in
  // the group and suppress the spurious "left"/"joined" activity events that
  // otherwise make members look like they drop out and rejoin every few seconds.
  const reconnectingRef = useRef<string | null>(null);
  // Anti-flap guards for the voice socket:
  //  • dupCooldownRef — a timestamp until which we must NOT auto-reconnect after
  //    LiveKit kicked us for DUPLICATE IDENTITY (the SAME account is live in this
  //    room from another device / browser tab). Without this, both sessions keep
  //    reconnecting and kicking each other → an endless join/leave ping-pong that
  //    knocks everyone's voice out. We yield for a cooldown so the OTHER session
  //    stays stable; a stale tab (never foregrounded) then never fights back and
  //    the loop dies on its own.
  //  • lastFgReconnectRef — the last time onForeground fired a reconnect bounce,
  //    so a burst of focus/visibility/pageshow events can't abort an in-flight
  //    connect ("Client initiated disconnect") by bouncing the room id repeatedly.
  const dupCooldownRef = useRef(0);
  const lastFgReconnectRef = useRef(0);
  // MONITOR MODE: an admin is silently OBSERVING this room (join as a hidden,
  // listen-only participant). We never acquire their mic, and the token request
  // carries ?monitor=1 so the server issues a hidden/no-publish grant.
  const monitorRef = useRef(false);
  const recoverMic = useCallback(async (opts?: { force?: boolean }) => {
    if (monitorRef.current) return; // observers never open a microphone
    const r = roomRef.current;
    if (!r || r.state !== "connected") return;
    if (recoveringRef.current) return; // never run two mic re-acquisitions at once
    const shouldTalk = !mutedRef.current && !forceMutedRef.current;
    if (!shouldTalk) {
      try { await r.localParticipant.setMicrophoneEnabled(false); } catch { /* ignore */ }
      return;
    }
    recoveringRef.current = true;
    try {
      const pub = [...r.localParticipant.trackPublications.values()].find((p) => p.kind === "audio");
      const track = pub?.audioTrack;
      const mst = track?.mediaStreamTrack;
      // Decide whether we must re-acquire the REAL microphone hardware vs. just
      // (re)publish. On a foreground return we FORCE a re-acquire: after the app
      // is backgrounded the OS suspends the mic hardware yet the track often STILL
      // reports readyState "live" / muted false — so the flags can't be trusted
      // and a plain setMicrophoneEnabled(true) would be a no-op (you'd hear others
      // but no one hears you). A normal unmute only restarts when the track is
      // genuinely dead — cheaper and avoids a needless audio blip.
      const broken = !!track && (!mst || mst.readyState === "ended" || mst.muted === true);
      if (opts?.force) {
        // FOREGROUND RETURN — fully UNPUBLISH then REPUBLISH the mic. This is the
        // crucial fix for "I'm back but nobody can hear me": after the app is
        // backgrounded the OUTBOUND RTP sender goes stale, yet the local track
        // still reports live / unmuted — so `restartTrack` (which only swaps the
        // capture device on the SAME sender) LOOKS like it worked while no audio
        // actually reaches the server. Dropping the publication and re-adding it
        // forces LiveKit to renegotiate a BRAND-NEW sender, which is what
        // genuinely gets your voice flowing to everyone again.
        try { await r.localParticipant.setMicrophoneEnabled(false); } catch { /* ignore */ }
        await new Promise((res) => setTimeout(res, 150)); // let the OS fully release the mic first
        await r.localParticipant.setMicrophoneEnabled(true);
      } else if (track && broken) {
        if (typeof track.restartTrack === "function") {
          await track.restartTrack(); // re-acquire the real microphone
          if (pub?.isMuted) await pub.unmute().catch(() => {});
        } else {
          // Older SDK with no restartTrack → drop the stale track + republish.
          await r.localParticipant.setMicrophoneEnabled(false).catch(() => {});
          await r.localParticipant.setMicrophoneEnabled(true);
        }
      } else {
        await r.localParticipant.setMicrophoneEnabled(true);
      }
      // Record whether the mic is now genuinely transmitting so the foreground
      // retries can stop once it's healthy (avoids re-restarting a working mic).
      const okPub = [...r.localParticipant.trackPublications.values()].find((p) => p.kind === "audio");
      const okMst = okPub?.audioTrack?.mediaStreamTrack;
      micOkRef.current = !!okMst && okMst.readyState === "live" && okMst.muted !== true && !okPub?.isMuted;
      setState((s) => ({ ...s, micError: false }));
      // CLEAR any stale SERVER-SIDE (SFU) mute on our OWN track. A LiveKit server
      // mute can't be lifted by the client's setMicrophoneEnabled, so a lingering
      // one leaves you shown as "live" while NOBODY can hear you. Whenever we go
      // live we tell the server to unmute us (allowed for a non-force-muted self).
      const rid = r.name.replace(/^room_/, "");
      const uid = r.localParticipant.identity;
      fetch(withBase(`/api/rooms/${rid}/mute`), { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ targetUserId: uid, muted: false }) }).catch(() => {});
      // TEMP diagnostic: report the real mic/track state so we can see, from the
      // server log, why a user's voice isn't reaching others on their own device
      // (healthy-but-silent = e.g. a Bluetooth device that isn't capturing).
      lifelog("mic:live", { hasPub: !!okPub, pubMuted: !!okPub?.isMuted, trackLkMuted: !!okPub?.audioTrack?.isMuted, mst: okMst ? `${okMst.readyState}/mut=${okMst.muted}/en=${okMst.enabled}` : "none", device: (okMst?.label || "").slice(0, 45), forced: forceMutedRef.current });
    } catch {
      // Last resort: drop + re-publish a clean mic track; surface a mic error if
      // even that fails so the user knows to tap the mic to retry.
      micOkRef.current = false;
      try { await r.localParticipant.setMicrophoneEnabled(false); } catch { /* ignore */ }
      try { await r.localParticipant.setMicrophoneEnabled(true); setState((s) => ({ ...s, micError: false })); }
      catch { setState((s) => ({ ...s, micError: true })); }
    } finally {
      recoveringRef.current = false;
    }
  }, []);

  // Load the saved background-voice preference once on mount.
  useEffect(() => {
    try {
      const v = localStorage.getItem(BG_VOICE_KEY);
      if (v === "0") setBgVoiceState(false);
    } catch { /* ignore */ }
  }, []);

  const setBgVoice = useCallback((on: boolean) => {
    setBgVoiceState(on);
    try { localStorage.setItem(BG_VOICE_KEY, on ? "1" : "0"); } catch { /* ignore */ }
  }, []);

  const startAudio = useCallback(() => {
    roomRef.current
      ?.startAudio()
      .then(() => setState((s) => ({ ...s, audioBlocked: false })))
      .catch(() => {});
  }, []);

  // ---- Video (camera) — only used in rooms where the admin unlocked video ----
  const facingRef = useRef<"user" | "environment">("user");
  const setVideoEnabled = useCallback((on: boolean) => {
    const room = roomRef.current;
    if (!room || room.state !== "connected") return;
    setVideoEnabledState(on);
    // Low resolution + framerate keeps the video light on mobile data.
    room.localParticipant
      .setCameraEnabled(on, on ? { resolution: { width: 480, height: 360, frameRate: 20 }, facingMode: facingRef.current } : undefined)
      .catch(() => setVideoEnabledState(false));
  }, []);

  // Flip between the front (selfie) and back camera WITHOUT dropping voice/room.
  const switchCamera = useCallback(async () => {
    const r = roomRef.current;
    if (!r || r.state !== "connected") return;
    const next = facingRef.current === "user" ? "environment" : "user";
    try {
      const pub = [...r.localParticipant.trackPublications.values()].find((p) => p.kind === "video");
      const track = pub?.videoTrack;
      if (track && typeof track.restartTrack === "function") {
        await track.restartTrack({ facingMode: next });
      } else {
        await r.localParticipant.setCameraEnabled(true, { resolution: { width: 480, height: 360, frameRate: 20 }, facingMode: next });
      }
      facingRef.current = next;
    } catch { /* keep the current camera if the device has only one */ }
  }, []);

  // ---- "Speaker Off" — silence ONE person on THIS device only -------------
  // Nothing here touches the other user's microphone or the room: we simply turn
  // the incoming audio for that identity down to zero on our own side, so what
  // everyone else hears is completely unchanged.
  const [speakerOff, setSpeakerOffList] = useState<string[]>([]);
  const speakerOffRef = useRef<Set<string>>(new Set());

  // Restore the saved list once, on mount.
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(SPEAKER_OFF_KEY) : null;
      const arr = raw ? (JSON.parse(raw) as unknown) : null;
      if (Array.isArray(arr)) {
        const ids = arr.filter((x): x is string => typeof x === "string" && !!x);
        speakerOffRef.current = new Set(ids);
        setSpeakerOffList(ids);
      }
    } catch { /* ignore */ }
  }, []);

  // Push the current choice onto the live audio. Called on toggle, on every new
  // subscription and after (re)connect, so a re-joining speaker stays silenced.
  const applySpeakerOff = useCallback((identity?: string) => {
    const room = roomRef.current;
    if (!room) return;
    const set = speakerOffRef.current;
    room.remoteParticipants.forEach((p) => {
      if (identity && p.identity !== identity) return;
      const silence = set.has(p.identity);
      // Participant-level volume (works with the Android Web-Audio mix too).
      try { (p as unknown as { setVolume?: (v: number) => void }).setVolume?.(silence ? 0 : 1); } catch { /* ignore */ }
      try {
        p.audioTrackPublications.forEach((pub) => {
          const t = pub.audioTrack as unknown as
            | { setVolume?: (v: number) => void; attachedElements?: HTMLMediaElement[] }
            | undefined;
          if (!t) return;
          try { t.setVolume?.(silence ? 0 : 1); } catch { /* ignore */ }
          // Belt-and-braces: also mute the <audio> elements we attached (iOS uses
          // plain per-element playback, where element.muted is what actually counts).
          (t.attachedElements ?? []).forEach((el) => {
            el.muted = silence;
            try { el.volume = silence ? 0 : 1; } catch { /* ignore */ }
          });
        });
      } catch { /* ignore */ }
    });
  }, []);

  const setSpeakerOff = useCallback((userId: string, off: boolean) => {
    if (!userId) return;
    const set = new Set(speakerOffRef.current);
    if (off) set.add(userId);
    else set.delete(userId);
    speakerOffRef.current = set;
    const arr = [...set];
    setSpeakerOffList(arr);
    try { localStorage.setItem(SPEAKER_OFF_KEY, JSON.stringify(arr)); } catch { /* ignore */ }
    applySpeakerOff(userId);
  }, [applySpeakerOff]);

  const clearSpeakerOff = useCallback(() => {
    speakerOffRef.current = new Set();
    setSpeakerOffList([]);
    try { localStorage.removeItem(SPEAKER_OFF_KEY); } catch { /* ignore */ }
    applySpeakerOff();
  }, [applySpeakerOff]);

  const isSpeakerOff = useCallback((userId: string) => speakerOff.includes(userId), [speakerOff]);

  // Attach a participant's camera track to a <video> element. Returns a detach
  // cleanup. The caller re-runs this whenever cameraOn flips (tile re-renders).
  const attachVideo = useCallback((participantId: string, el: HTMLVideoElement): (() => void) => {
    const room = roomRef.current;
    if (!room) return () => {};
    const p =
      room.localParticipant.identity === participantId
        ? room.localParticipant
        : [...room.remoteParticipants.values()].find((x) => x.identity === participantId);
    if (!p) return () => {};
    let track: { attach: (e: HTMLVideoElement) => void; detach: (e: HTMLVideoElement) => void } | undefined;
    p.trackPublications.forEach((pub) => {
      const t = (pub as { videoTrack?: typeof track; source?: string; kind?: string }).videoTrack;
      if (t && ((pub as { source?: string }).source === "camera" || (pub as { kind?: string }).kind === "video")) track = t;
    });
    if (!track) return () => {};
    try { track.attach(el); } catch { /* ignore */ }
    return () => { try { track!.detach(el); } catch { /* ignore */ } };
  }, []);

  // ---- Connect / disconnect, keyed on the target room id ----------------
  // This effect only re-runs when we actually switch rooms (or the provider
  // unmounts on logout) — NOT on page navigation, so the session persists.
  useEffect(() => {
    if (!roomId) return;
    // Admin silent-observer: DON'T claim presence, DON'T log join/leave, and DON'T
    // touch the mic — the admin must be invisible in the room's member list &
    // activity feed. Captured per effect-run so teardown matches the join.
    const isMonitor = monitorRef.current;
    let cancelled = false;
    let room: Room | null = null;
    // Lets us detach the audio-unblock interaction listeners on teardown.
    const audioAc = new AbortController();

    (async () => {
      // Claim presence (one room at a time). A non-null result means the user
      // is already active in a different room — surface it as a join block.
      // A monitoring admin claims NO presence (stays invisible).
      const block = isMonitor ? null : await enterRoom(roomId);
      if (cancelled) return;
      if (block) {
        setJoinBlock(block);
        return;
      }
      setJoinBlock(null);
      setJoinedAt(Date.now());
      // Only announce a real join. A transient reconnect (socket died on
      // background, resumed on foreground) must not spam the room activity feed.
      if (reconnectingRef.current === roomId) {
        reconnectingRef.current = null;
      } else if (!isMonitor) {
        logRoomEvent(roomId, "join");
      }

      // Restore the user's saved mic choice for this room (survives a hard
      // refresh AND a leave/rejoin, so we never force them to unmute again).
      try {
        if (typeof window !== "undefined" && !isMonitor) {
          const v = localStorage.getItem(`lotus.mic.${roomId}`);
          if (v === "0") setMutedState(false);
          else if (v === "1") setMutedState(true);
        }
      } catch {}

      try {
        const res = await fetch(withBase(`/api/rooms/${roomId}/token${monitorRef.current ? "?monitor=1" : ""}`), { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!data?.configured || !data?.token || !data?.url) {
          setState((s) => ({ ...s, configured: false }));
          return;
        }
        setState((s) => ({ ...s, configured: true }));

        const lk = await import("livekit-client");
        const { Room, RoomEvent } = lk;
        // AUDIO QUALITY comes from the admin panel (Admin → Voice Quality) and
        // arrives with the token. Falls back to the clear-speech defaults if an
        // older server doesn't send it.
        const aq = (data.audio ?? {}) as Partial<{
          bitrateKbps: number; dtx: boolean; red: boolean; noiseSuppression: boolean;
          echoCancellation: boolean; autoGainControl: boolean; voiceIsolation: boolean; stereo: boolean;
        }>;
        const _bitrate = Math.max(8, Math.min(64, Math.round(aq.bitrateKbps ?? 32))) * 1000;
        // Mobile-DATA savers: DTX sends NOTHING during silence (the biggest win —
        // people are silent most of the time); a low-bitrate speech codec; no RED
        // redundancy. adaptiveStream + dynacast avoid sending media nobody needs.
        // webAudioMix mixes all remote audio through ONE Web Audio context so it
        // plays on the phone's LOUDSPEAKER (media channel) instead of the quiet
        // earpiece. That's great on Android, but on iOS/Safari (and iPadOS) piping a
        // REMOTE WebRTC stream through Web Audio hits a long-standing WebKit bug where
        // the audio is SILENT — the #1 cause of "connected but can't hear anyone".
        // So enable it ONLY on Android; iOS uses LiveKit's default per-<audio>-element
        // playback, which is reliably audible. (Fixes "voice not audible for all".)
        const _ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
        const _isIOS = /iPhone|iPad|iPod/i.test(_ua) || (/Macintosh/.test(_ua) && typeof document !== "undefined" && "ontouchend" in document);
        const _webAudioMix = /Android/i.test(_ua) && !_isIOS;
        room = new Room({
          adaptiveStream: true,
          dynacast: true,
          stopLocalTrackOnUnpublish: true,
          // Loudspeaker mixing — Android only (silent-remote-track bug on iOS/Safari).
          webAudioMix: _webAudioMix,
          // We manage background/close ourselves (keep voice alive on app-swap,
          // disconnect only on a real close), so LiveKit must NOT auto-disconnect
          // on pagehide/beforeunload.
          disconnectOnPageLeave: false,
          // WHAT THE MICROPHONE CAPTURES. Set explicitly rather than left to the
          // SDK's defaults, so each one is an admin setting: background-noise
          // removal, echo cancellation (stops the speaker being picked up again)
          // and auto-gain (evens out quiet and loud speakers).
          audioCaptureDefaults: {
            noiseSuppression: aq.noiseSuppression !== false,
            echoCancellation: aq.echoCancellation !== false,
            autoGainControl: aq.autoGainControl !== false,
            channelCount: aq.stereo === true ? 2 : 1,
            // Chrome's stronger voice-focus. Passed through as an extra
            // constraint: browsers that don't know it simply ignore it.
            ...(aq.voiceIsolation !== false ? ({ voiceIsolation: true } as Record<string, unknown>) : {}),
          },
          publishDefaults: {
            // WAS: 12 kbps + DTX + no RED — the lowest LiveKit offers, chosen to
            // save mobile data, and the reason voice sounded thin and dropped
            // out. All three are now admin settings, defaulting to clear speech.
            //
            // dtx  — stop sending during silence. Saves data but can clip the
            //        first syllable of a word. OFF by default now.
            // red  — send each packet twice over. Costs a little data and is what
            //        stops a single lost packet becoming an audible gap, which
            //        matters most on mobile data. ON by default now.
            dtx: aq.dtx === true,
            red: aq.red !== false,
            // Given as a plain object rather than a named preset so the exact
            // bitrate is whatever the admin chose, and so this doesn't break if
            // the SDK ever renames its presets.
            audioPreset: { maxBitrate: _bitrate },
          },
        });
        roomRef.current = room;

        // PRE-WARM the connection (DNS/TLS/ICE/TURN + WebSocket) the instant we have
        // the token, so the real connect() below — and therefore the first audio the
        // user hears — happens much faster (cuts the "5–10s before I can hear" delay).
        try { void (room as unknown as { prepareConnection?: (u: string, t: string) => Promise<void> }).prepareConnection?.(data.url, data.token); } catch { /* older client: no-op */ }

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
              cameraOn: p.isCameraEnabled,
            };
          };
          const list: VoiceParticipant[] = [map(room.localParticipant, true)];
          room.remoteParticipants.forEach((p) => list.push(map(p, false)));
          setState((s) => ({ ...s, participants: list }));
        };

        const attachAudio = (
          track: import("livekit-client").RemoteTrack,
          participant?: import("livekit-client").Participant,
        ) => {
          if (track.kind !== "audio") return;
          const el = track.attach() as HTMLAudioElement;
          el.setAttribute("data-lk-audio", "1");
          el.style.display = "none";
          el.autoplay = true;
          (el as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
          // Honour a "Speaker Off" choice the moment the track arrives, so someone
          // I silenced stays silent when they rejoin / republish their mic.
          const identity = participant?.identity;
          if (identity) el.setAttribute("data-lk-identity", identity);
          const silence = !!identity && speakerOffRef.current.has(identity);
          if (silence) {
            el.muted = true;
            try { el.volume = 0; } catch { /* ignore */ }
            try { (track as unknown as { setVolume?: (v: number) => void }).setVolume?.(0); } catch { /* ignore */ }
          }
          document.body.appendChild(el);
          el.play().catch(() => {});
        };

        room
          .on(RoomEvent.ParticipantConnected, () => { snapshot(); applySpeakerOff(); })
          .on(RoomEvent.ParticipantDisconnected, snapshot)
          .on(RoomEvent.ActiveSpeakersChanged, snapshot)
          .on(RoomEvent.TrackMuted, snapshot)
          .on(RoomEvent.TrackUnmuted, snapshot)
          .on(RoomEvent.TrackSubscribed, (track, _pub, participant) => { attachAudio(track, participant); applySpeakerOff(participant?.identity); snapshot(); })
          .on(RoomEvent.TrackUnsubscribed, (track) => {
            if (track.kind === "audio") track.detach().forEach((el) => el.remove());
            snapshot();
          })
          .on(RoomEvent.LocalTrackPublished, snapshot)
          .on(RoomEvent.LocalTrackUnpublished, snapshot)
          .on(RoomEvent.ParticipantMetadataChanged, snapshot)
          .on(RoomEvent.AudioPlaybackStatusChanged, () => {
            setState((s) => ({ ...s, audioBlocked: !!room && !room.canPlaybackAudio }));
          })
          .on(RoomEvent.Connected, () => { setState((s) => ({ ...s, connected: true })); snapshot(); applySpeakerOff(); })
          // LiveKit is silently re-establishing the socket (network blip / brief
          // background) → let the user know voice is coming back.
          .on(RoomEvent.Reconnecting, () => { toastRef.current("Reconnecting voice…", "info"); })
          // After LiveKit's OWN silent auto-reconnect (network blip / brief
          // background) the socket comes back but the previously-published mic
          // sender can be stale — and because `connected` never flipped, the
          // mute effect won't re-run to fix it. Force a clean mic republish here
          // so voice keeps reaching others after any reconnect.
          .on(RoomEvent.Reconnected, () => { micOkRef.current = false; recoverMic({ force: true }); snapshot(); applySpeakerOff(); toastRef.current("Voice connection restored.", "success"); })
          .on(RoomEvent.Disconnected, (reason?: number) => {
            setVideoEnabledState(false);
            setState((s) => ({ ...s, connected: false }));
            const uaNow = typeof navigator !== "undefined" ? navigator.userAgent : "";
            reportVoiceDiag({ stage: "disconnected", roomId, error: `reason=${reason ?? "?"}`, ua: uaNow });
            // Kicked because the SAME account joined this room elsewhere → do NOT
            // race to reconnect (that just kicks the other session back, forever).
            // Yield for a cooldown; onForeground respects it. If the other surface
            // is a stale/background tab it never fights back and the flap stops.
            const dup = (lk.DisconnectReason as { DUPLICATE_IDENTITY?: number } | undefined)?.DUPLICATE_IDENTITY;
            if (reason !== undefined && dup !== undefined && reason === dup) {
              dupCooldownRef.current = Date.now() + 25000;
            }
          });

        // Connect to the LiveKit voice channel, retrying a couple of times —
        // the first WebRTC attempt sometimes fails on flaky / restrictive mobile
        // networks but succeeds on retry. Report the outcome so we can diagnose.
        const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
        const t0 = Date.now();
        let connected = false;
        let lastErr: unknown = null;
        for (let attempt = 1; attempt <= 3 && !cancelled && !connected; attempt++) {
          try {
            await room.connect(data.url, data.token);
            connected = true;
          } catch (err) {
            lastErr = err;
            reportVoiceDiag({ stage: `connect-fail-${attempt}`, roomId, error: err instanceof Error ? err.message : String(err), ua });
            if (attempt < 3) await new Promise((r) => setTimeout(r, 600 * attempt));
          }
        }
        if (!connected) {
          reportVoiceDiag({ stage: "connect-gaveup", roomId, error: lastErr instanceof Error ? lastErr.message : String(lastErr), ua, ms: Date.now() - t0 });
          throw lastErr instanceof Error ? lastErr : new Error("Voice connection failed");
        }
        reportVoiceDiag({ stage: "connected", roomId, ua, ms: Date.now() - t0 });
        if (cancelled) { await room.disconnect(); return; }
        // Apply the latest self metadata right away so our seat shows correctly.
        try {
          const self = selfRef.current;
          room.localParticipant.setMetadata(JSON.stringify({ username: self.username }));
          if (self.name) room.localParticipant.setName(self.name);
        } catch {}
        snapshot();
        room.startAudio().catch(() => {});
        setState((s) => ({ ...s, audioBlocked: !!room && !room.canPlaybackAudio }));
        // Browsers block audio playback until the user interacts. Try to unblock
        // on ANY interaction (click / touch / key — mobile needs a real gesture),
        // and keep listening until playback is actually allowed.
        const resume = () => {
          const r = roomRef.current;
          if (!r) return;
          // Also (re)start the silent keep-alive element on a real gesture, so the
          // background-audio anchor is definitely playing once the user interacts.
          document.querySelectorAll<HTMLAudioElement>("[data-lk-silent]").forEach((el) => el.play().catch(() => {}));
          r.startAudio()
            .then(() => {
              const ok = r.canPlaybackAudio;
              setState((s) => ({ ...s, audioBlocked: !ok }));
              if (ok) audioAc.abort(); // success → stop listening
            })
            .catch(() => {});
        };
        document.addEventListener("click", resume, { signal: audioAc.signal });
        document.addEventListener("touchstart", resume, { signal: audioAc.signal });
        document.addEventListener("keydown", resume, { signal: audioAc.signal });
      } catch (e) {
        if (!cancelled) setState((s) => ({ ...s, error: e instanceof Error ? e.message : "Voice connection failed" }));
      }
    })();

    const leavingRoomId = roomId;
    return () => {
      cancelled = true;
      audioAc.abort(); // detach audio-unblock interaction listeners
      const r = roomRef.current;
      roomRef.current = null;
      r?.disconnect();
      document.querySelectorAll("[data-lk-audio]").forEach((el) => el.remove());
      // Release presence for the room we're leaving (switching rooms / logout).
      // BUT if this teardown is only a transient reconnect of the SAME room,
      // keep the user's presence in the group and don't log a "left" event —
      // otherwise every background→foreground bounce makes them look like they
      // left and rejoined within seconds.
      if (reconnectingRef.current !== leavingRoomId && !isMonitor) {
        exitRoom(leavingRoomId);
        logRoomEvent(leavingRoomId, "leave");
      }
      setJoinedAt(null);
      setState((s) => ({ ...s, connected: false, participants: [], configured: false }));
    };
  }, [roomId, startAudio, applySpeakerOff]);

  // ---- ROOM PRESENCE HEARTBEAT (app-level) --------------------------------
  // The server decides who is "in the room" from a heartbeat (activeRoomId +
  // a fresh roomSeenAt, default 60s TTL). That heartbeat used to be sent ONLY by
  // the room page — so the moment a member opened a GAME (or the watch screen, or
  // any other page) the room page unmounted, the beat stopped, and within a minute
  // the server treated them as gone: they showed as "Away" and were dropped from
  // the group even though their voice was still connected.
  //
  // The beat now lives HERE, next to the room connection itself, so it keeps
  // running on every screen for as long as the user is actually in the room.
  useEffect(() => {
    if (!roomId) return;
    let stopped = false;
    const beat = () => {
      if (stopped) return;
      // `access` is the lightweight endpoint that refreshes the presence stamp.
      fetch(withBase(`/api/rooms/${roomId}/access`), { credentials: "include", cache: "no-store" }).catch(() => {});
    };
    beat();
    // Well inside the 60s TTL, so a throttled background tab still stays present.
    const t = setInterval(beat, 15000);
    // Returning to the app re-asserts presence immediately.
    const onVis = () => { if (typeof document !== "undefined" && document.visibilityState === "visible") beat(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { stopped = true; clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [roomId]);

  // ---- Voice room background lifecycle ----------------------------------
  // IN BOTH MODES the user STOPS TRANSMITTING the moment the app leaves the
  // foreground — you are never unknowingly "live" while using another app — and
  // the CONNECTION is preserved so returning is seamless (no re-join, no lost room
  // state). What differs is how far we go:
  //  • bgVoice ON  → the voice room KEEPS RUNNING in the background (screen lock /
  //    app switch) so the user can still HEAR the room. The outgoing mic track is
  //    silenced (track disabled — no WebRTC renegotiation, so incoming audio is not
  //    disturbed) and restored on return.
  //  • bgVoice OFF → the mic is fully RELEASED (unpublished) so it can never block
  //    other apps and the OS "mic in use" indicator clears; the user stays
  //    connected to HEAR, and the mic is re-acquired when they return.
  // On return the mic is restored ONLY if the user is genuinely meant to be live —
  // a self-mute, a host force-mute or having no speaking seat all still apply.
  // A real CLOSE (beforeunload) releases the mic AND disconnects fully.
  useEffect(() => {
    if (!roomId || typeof window === "undefined") return;

    // Near-silent tone + Media Session help keep INCOMING audio playing while
    // backgrounded (so the user can still hear). Both are suspended/cleared the
    // moment we background so nothing keeps the audio session (or mic) alive
    // after a close.
    let keepCtx: AudioContext | null = null;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        keepCtx = new AC();
        const osc = keepCtx.createOscillator();
        const gain = keepCtx.createGain();
        gain.gain.value = 0.0001;
        osc.connect(gain).connect(keepCtx.destination);
        osc.start();
      }
    } catch { /* ignore */ }

    // Silent looping <audio> — the main thing that keeps ANDROID from suspending
    // the voice connection in the background. A real media element that keeps
    // "playing" (inaudible silence) marks the tab as active-media, so the OS lets
    // the WebRTC audio + mic keep running while backgrounded / screen-locked.
    let silent: HTMLAudioElement | null = null;
    const playSilent = () => { silent?.play().catch(() => {}); };
    try {
      silent = document.createElement("audio");
      silent.src = getSilentWav();
      silent.loop = true;
      silent.setAttribute("playsinline", "");
      (silent as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
      silent.setAttribute("data-lk-silent", "1");
      silent.style.display = "none";
      // If the OS/browser pauses our keep-alive audio when backgrounding, RESUME it
      // immediately — a continuously-"playing" media element is what keeps Android
      // from suspending the tab (and with it the voice + mic). Only while bgVoice is
      // ON and we're still in a room.
      silent.addEventListener("pause", () => { if (roomRef.current && bgVoiceRef.current) silent?.play().catch(() => {}); });
      document.body.appendChild(silent);
      playSilent();
    } catch { /* ignore */ }

    const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined;

    // RELEASE the microphone hardware (stops the local track → frees it for
    // other apps and clears the "mic in use" indicator).
    const releaseMic = () => {
      const r = roomRef.current;
      try { if (r && r.state === "connected") r.localParticipant.setMicrophoneEnabled(false).catch(() => {}); } catch { /* ignore */ }
    };

    const micPub = () => {
      const r = roomRef.current;
      if (!r || r.state !== "connected") return undefined;
      return [...r.localParticipant.trackPublications.values()].find((p) => p.kind === "audio");
    };

    // STOP TRANSMITTING while the app is in the background — without unpublishing.
    // Unpublishing renegotiates WebRTC and kills the INCOMING audio on mobile (that's
    // why it was never done here), but simply disabling the outgoing MediaStreamTrack
    // sends silence instantly with no renegotiation. Result: while you are in another
    // app nobody can hear you, yet you stay connected and can still hear the room.
    const silenceMic = () => {
      try {
        const track = micPub()?.audioTrack;
        if (track?.mediaStreamTrack) track.mediaStreamTrack.enabled = false;
        try { (track as unknown as { mute?: () => void })?.mute?.(); } catch { /* ignore */ }
      } catch { /* ignore */ }
    };

    // Back in the foreground → resume transmitting, but ONLY if the user is
    // actually meant to be live: never un-mute someone who muted themselves or was
    // muted by the host, and never for a listener who has no speaking seat.
    const unsilenceMic = () => {
      if (mutedRef.current || forceMutedRef.current) return;
      try {
        const track = micPub()?.audioTrack;
        if (track?.mediaStreamTrack) track.mediaStreamTrack.enabled = true;
        try { (track as unknown as { unmute?: () => void })?.unmute?.(); } catch { /* ignore */ }
      } catch { /* ignore */ }
    };

    // Back in the foreground → resume hearing + re-acquire the mic if unmuted.
    // Guarded on real visibility so a lock-screen "play" tap can't re-open the
    // mic while the app is still backgrounded.
    const onForeground = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      const r = roomRef.current;
      // If the OS suspended/killed the WebRTC socket while we were in another app,
      // RECONNECT (fresh token) so the voice room resumes the moment we return —
      // app-swapping never leaves you stuck disconnected.
      if (r && r.state === "disconnected" && roomId) {
        const nowMs = Date.now();
        // Still yielding after a duplicate-identity kick (account open elsewhere)?
        // Don't reconnect yet — that would restart the ping-pong.
        if (nowMs < dupCooldownRef.current) return;
        // Debounce: a burst of focus / visibility / pageshow events must not fire
        // repeated reconnects that abort each other's in-flight connect.
        if (nowMs - lastFgReconnectRef.current < 6000) return;
        lastFgReconnectRef.current = nowMs;
        const target = roomId;
        // Mark this null→target bounce as a reconnect so the teardown keeps our
        // presence and doesn't emit spurious leave/join room-activity events.
        reconnectingRef.current = target;
        setRoomId(null);
        setTimeout(() => setRoomId(target), 60);
        return;
      }
      keepCtx?.resume().catch(() => {});
      playSilent();
      r?.startAudio().catch(() => {});
      document.querySelectorAll<HTMLAudioElement>("[data-lk-audio]").forEach((el) => el.play().catch(() => {}));
      // Undo the background silence immediately (fast path) — respecting the user's
      // own mute and any host force-mute. recoverMic below is the robust fallback.
      unsilenceMic();
      // Re-acquire the mic with a FRESH published track NOW, then again on a few
      // delays — the backgrounded mic is suspended even when it still looks
      // "live", and after an app-switch the room may still be mid-(re)connect for
      // a moment (recoverMic no-ops safely until it's connected). Forcing a clean
      // republish is what fixes "I can hear them but they can't hear me" after
      // switching apps. Retries stop as soon as the mic is confirmed healthy.
      micOkRef.current = false;
      recoverMic({ force: true });
      setTimeout(() => { if (!micOkRef.current) recoverMic({ force: true }); }, 900);
      setTimeout(() => { if (!micOkRef.current) recoverMic({ force: true }); }, 2200);
      setTimeout(() => { if (!micOkRef.current) recoverMic({ force: true }); }, 4000);
      if (ms) { try { ms.playbackState = "playing"; } catch { /* ignore */ } }
    };

    // App left the foreground (lock / app-switch). Behaviour depends on bgVoice:
    const onBackground = () => {
      if (bgVoiceRef.current) {
        // KEEP the audio SESSION alive in the background (silent media element +
        // Web Audio + Media Session) so the user keeps HEARING the room. We do
        // NOT re-publish or toggle the mic here — doing so renegotiates WebRTC
        // and kills the incoming audio on mobile. The mic is re-acquired safely
        // on foreground return.
        // We DO silence the outgoing track, so the user is never unknowingly
        // transmitting while they're using another app.
        silenceMic();
        keepCtx?.resume().catch(() => {});
        playSilent();
        if (ms) { try { ms.playbackState = "playing"; } catch { /* ignore */ } }
        return;
      }
      // Release the mic so it doesn't block other apps; stay connected to hear.
      releaseMic();
      keepCtx?.suspend().catch(() => {});
      if (ms) { try { ms.playbackState = "none"; } catch { /* ignore */ } }
    };

    // REAL unload (desktop tab close / hard reload / external navigation) → release
    // the mic + disconnect so nothing lingers. This only runs from `beforeunload`.
    // We do NOT disconnect on `pagehide`, because on MOBILE app-switch / screen
    // lock the browser fires pagehide too — and disconnecting there is exactly
    // what was killing voice in the background. So pagehide = treat as background
    // (keep the room alive); a truly-closed mobile app is reaped server-side.
    const onClose = () => {
      releaseMic();
      try { roomRef.current?.disconnect(); } catch { /* ignore */ }
      try { keepCtx?.close(); } catch { /* ignore */ }
      if (ms) { try { ms.playbackState = "none"; ms.metadata = null; } catch { /* ignore */ } }
    };
    const onBeforeUnload = () => onClose();

    // Loose view of the Media Session "call" extensions (togglemicrophone /
    // hangup / setMicrophoneActive) — supported in Chromium (Android), absent on
    // iOS Safari. Casting keeps it type-safe without depending on the TS lib.
    const callMs = ms as (MediaSession & {
      setMicrophoneActive?: (active: boolean) => void;
      setCameraActive?: (active: boolean) => void;
    }) | undefined;
    const setCallAction = (action: string, handler: (() => void) | null) => {
      try { (ms?.setActionHandler as ((a: string, h: (() => void) | null) => void) | undefined)?.(action, handler); }
      catch { /* action not supported on this browser */ }
    };
    const reflectMic = () => {
      try { callMs?.setMicrophoneActive?.(!mutedRef.current && !forceMutedRef.current); } catch { /* ignore */ }
    };
    micReflectRef.current = reflectMic;

    if (ms) {
      try {
        // The persistent background call notification: the ROOM NAME as the title,
        // plus a Mute/Unmute toggle and an End-call button (Android lock screen /
        // notification shade). It stays until the user leaves or the app closes.
        if ("MediaMetadata" in window) {
          ms.metadata = new MediaMetadata({
            title: roomNameRef.current ? `🔊 ${roomNameRef.current}` : "Voice room",
            artist: "Lotus voice call — tap to return",
            album: "LotusPlay Connect",
          });
        }
        ms.playbackState = "playing";
        // The OS lock-screen controls must NEVER silently kill the call — the
        // room only ends from the in-app Leave / the End-call button. So the
        // media play/pause/stop just keep the session alive ("playing").
        ms.setActionHandler?.("play", () => onForeground());
        ms.setActionHandler?.("pause", () => { try { ms.playbackState = "playing"; } catch { /* ignore */ } });
        ms.setActionHandler?.("stop", () => { try { ms.playbackState = "playing"; } catch { /* ignore */ } });
        // CALL controls (Android): a Mute/Unmute button + an End-call button right
        // on the notification, so the user controls the call without opening the app.
        setCallAction("togglemicrophone", () => {
          if (forceMutedRef.current) return; // host force-muted → cannot unmute
          setMutedState(!mutedRef.current);
          // reflectMic runs from the muted effect once the state actually flips.
        });
        setCallAction("hangup", () => { setRoomId(null); setJoinBlock(null); }); // End call
        reflectMic();
      } catch { /* ignore */ }
    }

    // Visible → resume / reconnect. Hidden → background (keep voice per bgVoice).
    const onVisibility = () => {
      if (document.visibilityState === "visible") onForeground();
      else onBackground();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onForeground);
    window.addEventListener("pageshow", onForeground);
    window.addEventListener("pagehide", onBackground); // mobile background, NOT a disconnect
    window.addEventListener("beforeunload", onBeforeUnload);

    // Continuous keep-alive heartbeat: while we're in a room with bgVoice ON, keep
    // re-asserting the "playing" state — resume the audio context, replay the silent
    // element + incoming audio, and keep the Media Session marked playing. Browsers
    // throttle this in the background, but every time it DOES run it re-establishes
    // the keep-alive if the OS quietly paused it, which makes the voice survive a
    // screen-lock / app-switch far more reliably.
    const keepAlive = window.setInterval(() => {
      // FOREGROUND VOICE HEALTH CHECK (runs regardless of bgVoice): if the user SHOULD
      // be talking (unmuted, live connection, app visible) but the mic track has gone
      // dead/silent, auto re-acquire it — so a stalled mic recovers on its own and the
      // user never has to leave + rejoin to be heard. Foreground-only (touching the mic
      // in the background tears down incoming audio) + not during a duplicate cooldown.
      const rr = roomRef.current;
      if (rr && rr.state === "connected" && !monitorRef.current && !recoveringRef.current
        && !mutedRef.current && !forceMutedRef.current
        && typeof document !== "undefined" && document.visibilityState === "visible"
        && Date.now() >= dupCooldownRef.current) {
        const pub = [...rr.localParticipant.trackPublications.values()].find((p) => p.kind === "audio");
        const mst = pub?.audioTrack?.mediaStreamTrack;
        if (!pub || pub.isMuted || !mst || mst.readyState !== "live" || mst.muted === true) {
          micOkRef.current = false;
          recoverMic({ force: true });
        }
      }
      if (!bgVoiceRef.current) return;
      const r = roomRef.current;
      if (!r) return;
      try { if (keepCtx && keepCtx.state === "suspended") keepCtx.resume().catch(() => {}); } catch { /* ignore */ }
      if (silent && silent.paused) playSilent();
      // Resume LiveKit's OWN audio playback (its Web-Audio mixing context or muted
      // elements). The OS can suspend it in the background → the room goes silent
      // until the user taps. startAudio() is idempotent and cheap; calling it here
      // keeps INCOMING audio flowing without touching the mic. (Helps "can't hear
      // consistently", esp. after a screen-lock / app-switch.)
      try { void r.startAudio().catch(() => {}); } catch { /* ignore */ }
      if (document.visibilityState !== "visible") {
        // Keep INCOMING audio + the audio session alive so the user keeps HEARING
        // the room while the app is in the background.
        document.querySelectorAll<HTMLAudioElement>("[data-lk-audio]").forEach((el) => { if (el.paused) el.play().catch(() => {}); });
        if (ms) { try { ms.playbackState = "playing"; } catch { /* ignore */ } }
        // ⚠️ DO NOT touch the microphone here. Re-publishing / toggling the mic
        // while backgrounded RENEGOTIATES the WebRTC connection, and on mobile
        // that tears down the INCOMING audio too — so the user can't even HEAR
        // the room (the reported "after app-switch both mic AND speaker stopped"
        // regression). We therefore leave the mic completely alone in the
        // background and re-acquire it SAFELY only on foreground return
        // (onForeground → recoverMic({force:true})). Transmitting from a
        // backgrounded mobile browser is an OS limitation a website can't fully
        // beat; hearing, however, now stays reliable.
      }
    }, 8000);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onForeground);
      window.removeEventListener("pageshow", onForeground);
      window.removeEventListener("pagehide", onBackground);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.clearInterval(keepAlive);
      try { silent?.pause(); silent?.remove(); } catch { /* ignore */ }
      try { keepCtx?.close(); } catch { /* ignore */ }
      micReflectRef.current = () => {};
      if (ms) {
        try {
          ms.playbackState = "none";
          ms.setActionHandler?.("play", null);
          ms.setActionHandler?.("pause", null);
          ms.setActionHandler?.("stop", null);
          setCallAction("togglemicrophone", null);
          setCallAction("hangup", null);
          ms.metadata = null;
        } catch { /* ignore */ }
      }
    };
  }, [roomId, recoverMic]);

  // Remember the mic choice per room (survives a hard refresh within the tab).
  useEffect(() => {
    if (!roomId || typeof window === "undefined") return;
    try { localStorage.setItem(`lotus.mic.${roomId}`, muted ? "1" : "0"); } catch {}
  }, [muted, roomId]);

  // SCREEN WAKE LOCK — while in a voice room with the app in the FOREGROUND, keep
  // the screen awake so the phone doesn't AUTO-LOCK during a call. Auto screen-off
  // (idle timeout) is the single most common trigger of "voice stopped when the
  // screen turned off": once the screen sleeps, the mobile browser suspends mic
  // capture (and, on iOS, incoming audio too). Holding a wake lock while the call
  // screen is open prevents that auto-sleep entirely. The OS releases the lock when
  // the page is hidden, so we re-acquire it on return; it never runs in the
  // background and doesn't stop the user from manually locking if they choose.
  useEffect(() => {
    if (!roomId || typeof navigator === "undefined") return;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    if (!nav.wakeLock) return; // unsupported (older iOS/Safari) — skip silently
    let sentinel: { release: () => Promise<void> } | null = null;
    let stopped = false;
    const acquire = async () => {
      if (stopped || (typeof document !== "undefined" && document.visibilityState !== "visible")) return;
      try { sentinel = await nav.wakeLock!.request("screen"); } catch { /* denied — fine */ }
    };
    const onVis = () => { if (document.visibilityState === "visible") acquire(); };
    acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVis);
      try { sentinel?.release?.(); } catch { /* ignore */ }
    };
  }, [roomId]);

  // SECURITY: while connected, keep verifying we're still allowed in this room.
  // If the host removed or blocked us, drop the voice connection IMMEDIATELY —
  // this works on ANY screen (room page, a game, profile…), so a kicked member
  // genuinely can't keep speaking or hearing. The token is also denied on
  // auto-reconnect. A REMOVED member may rejoin manually later (opening the room
  // page lifts the kick); a BLOCKED member stays out until the host unblocks.
  useEffect(() => {
    if (!roomId) return;
    let on = true;
    let hiddenTicks = 0;
    const check = async () => {
      // While backgrounded we still MUST verify access (background voice keeps
      // audio playing, so a kicked member with a locked phone would otherwise
      // keep hearing the room forever) — just at a slower cadence to save data:
      // every 3rd tick (~15s) instead of every 5s.
      if (typeof document !== "undefined" && document.hidden) {
        hiddenTicks += 1;
        if (hiddenTicks % 3 !== 0) return;
      } else {
        hiddenTicks = 0;
      }
      try {
        const res = await fetch(withBase(`/api/rooms/${roomId}/access`), { credentials: "include", cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!on) return;
        if (data?.allowed === false && (data.reason === "removed" || data.reason === "blocked")) {
          setKicked({ roomId, reason: data.reason });
          setJoinBlock(null);
          setRoomId(null); // triggers full teardown (disconnect + presence release)
        }
      } catch {}
    };
    const t = setInterval(check, 5000);
    return () => { on = false; clearInterval(t); };
  }, [roomId]);

  // Publish / unpublish the mic from the combined mute state. Lives here so the
  // mic stays exactly as the user left it across every navigation. Uses
  // recoverMic so unmuting re-acquires a fresh track if the OS suspended it.
  useEffect(() => {
    const room = roomRef.current;
    if (!room || !state.connected) return;
    // recoverMic re-acquires a fresh track if the OS suspended it, and sets
    // micError itself on success/failure.
    recoverMic();
    // Keep the background call notification's Mute/Unmute button in sync.
    micReflectRef.current();
  }, [muted, forceMuted, state.connected, recoverMic]);

  const connect = useCallback((nextRoomId: string, self?: SelfMeta, roomName?: string, opts?: { monitor?: boolean }) => {
    if (self) selfRef.current = self;
    if (roomName) roomNameRef.current = roomName;
    setRoomId((cur) => {
      if (cur === nextRoomId) {
        // Already in this room — just refresh our live metadata, keep session.
        const room = roomRef.current;
        if (room && self) {
          try {
            room.localParticipant.setMetadata(JSON.stringify({ username: self.username }));
            if (self.name) room.localParticipant.setName(self.name);
          } catch {}
        }
        return cur;
      }
      // Join / re-enter a room → UNMUTED by default for everyone (smoother
      // conversation, no forced re-unmute). We only start muted if the user
      // DELIBERATELY muted themselves here before (saved "1"); the host's
      // force-mute / seat-approval still overrides this separately.
      let savedMuted = false; // unmuted by default
      try { if (localStorage.getItem(`lotus.mic.${nextRoomId}`) === "1") savedMuted = true; } catch { /* ignore */ }
      monitorRef.current = !!opts?.monitor; // admin silent-observer mode for THIS room session
      if (monitorRef.current) savedMuted = true; // an observing admin is always muted
      setMutedState(savedMuted);
      setForceMutedState(monitorRef.current); // observer cannot unmute

      // Fresh, deliberate join → clear any duplicate-identity yield so we connect now.
      dupCooldownRef.current = 0;
      lastFgReconnectRef.current = 0;
      return nextRoomId;
    });
  }, []);

  const leave = useCallback(async () => {
    monitorRef.current = false; // exit observer mode
    setRoomId(null); // triggers cleanup (disconnect + exitRoom + leave event)
    setJoinBlock(null);
  }, []);

  const updateSelf = useCallback((self: SelfMeta) => {
    selfRef.current = self;
    const room = roomRef.current;
    if (!room || !state.connected) return;
    try {
      room.localParticipant.setMetadata(JSON.stringify({ username: self.username }));
      if (self.name) room.localParticipant.setName(self.name);
    } catch {}
  }, [state.connected]);

  const retryJoin = useCallback(async () => {
    if (!roomId) return;
    dupCooldownRef.current = 0; // explicit user reconnect overrides any yield
    lastFgReconnectRef.current = 0;
    await exitRoom(roomId);
    const block = await enterRoom(roomId);
    setJoinBlock(block);
    if (!block) {
      // Force a fresh connect by toggling the target room id.
      const target = roomId;
      setRoomId(null);
      setTimeout(() => setRoomId(target), 0);
    }
  }, [roomId]);

  // "Reconnect Voice" — restore audio WITHOUT leaving the room or the seat.
  //  • Socket UP  → just re-acquire the mic + resume playback (fast; keeps everything).
  //  • Socket DOWN → a clean reconnect that KEEPS presence + seat (fresh token re-grants
  //    publish) and suppresses spurious leave/join activity events.
  // Toasts tell the user what's happening. Overrides any duplicate-identity/foreground
  // cooldown because it's an explicit user action.
  const reconnectVoice = useCallback(async () => {
    if (!roomId) return;
    toastRef.current("Reconnecting voice…", "info");
    dupCooldownRef.current = 0;
    lastFgReconnectRef.current = 0;
    const r = roomRef.current;
    if (r && r.state === "connected") {
      try { await r.startAudio(); } catch { /* ignore */ }
      setState((s) => ({ ...s, audioBlocked: false }));
      micOkRef.current = false;
      await recoverMic({ force: true });
      window.setTimeout(() => { if (!micOkRef.current && !mutedRef.current && !forceMutedRef.current) recoverMic({ force: true }); }, 900);
      window.setTimeout(() => {
        const ok = micOkRef.current || mutedRef.current || forceMutedRef.current;
        toastRef.current(ok ? "Voice connection restored." : "Voice refreshed — tap the mic if you still can't be heard.", ok ? "success" : "info");
      }, 1400);
    } else {
      const target = roomId;
      reconnectingRef.current = target; // keep presence, no leave/join spam
      setRoomId(null);
      window.setTimeout(() => setRoomId(target), 60);
      window.setTimeout(() => {
        const ok = roomRef.current?.state === "connected";
        toastRef.current(ok ? "Voice connection restored." : "Still reconnecting — please wait…", ok ? "success" : "info");
      }, 2600);
    }
  }, [roomId, recoverMic]);

  // RECORDING CAPTURE — mix every participant's audio (all remote speakers + my own
  // mic) into ONE MediaStream the caller can feed to a MediaRecorder. Returns the
  // mixed stream + a stop() that releases the audio graph, or null if there's no
  // live audio to record. Pure add-on: it only READS the existing LiveKit tracks and
  // never touches the connection / mic state.
  const captureRoomAudio = useCallback((): { stream: MediaStream; stop: () => void } | null => {
    const room = roomRef.current;
    if (!room || typeof window === "undefined") return null;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const tracks: MediaStreamTrack[] = [];
    try {
      // My own mic.
      const localMst = room.localParticipant?.audioTrackPublications
        ? [...room.localParticipant.audioTrackPublications.values()][0]?.audioTrack?.mediaStreamTrack
        : undefined;
      if (localMst && localMst.readyState === "live") tracks.push(localMst);
      // Every remote participant's audio.
      for (const p of room.remoteParticipants.values()) {
        for (const pub of p.audioTrackPublications.values()) {
          const mst = pub.audioTrack?.mediaStreamTrack;
          if (mst && mst.readyState === "live") tracks.push(mst);
        }
      }
    } catch { return null; }
    if (tracks.length === 0) return null;
    const ctx = new AC();
    const dest = ctx.createMediaStreamDestination();
    for (const t of tracks) {
      try { ctx.createMediaStreamSource(new MediaStream([t])).connect(dest); } catch { /* skip a bad track */ }
    }
    return {
      stream: dest.stream,
      stop: () => { try { ctx.close(); } catch { /* ignore */ } },
    };
  }, []);

  return (
    <VoiceContext.Provider
      value={{
        roomId,
        ...state,
        muted,
        forceMuted,
        joinBlock,
        kicked,
        clearKicked: () => setKicked(null),
        joinedAt,
        connect,
        leave,
        setMuted: setMutedState,
        setForceMuted: setForceMutedState,
        startAudio,
        speakerOff,
        isSpeakerOff,
        setSpeakerOff,
        clearSpeakerOff,
        videoEnabled,
        setVideoEnabled,
        switchCamera,
        attachVideo,
        updateSelf,
        retryJoin,
        reconnectVoice,
        bgVoice,
        setBgVoice,
        captureRoomAudio,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoice must be used within VoiceProvider");
  return ctx;
}
