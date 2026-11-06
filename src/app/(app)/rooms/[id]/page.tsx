"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Mic,
  MicOff,
  Hand,
  LogOut,
  Radio,
  RefreshCw,
  Crown,
  Star,
  Info,
  Plus,
  Music,
  Video,
  AudioLines,
  Upload,
  Gamepad2,
  Dices,
  Play,
  Pause,
  Square,
  Link2 as LinkIcon,
  Settings,
  Megaphone,
  Lock,
  Unlock,
  UserCheck,
  Minimize2,
  Maximize2,
  Columns2,
  MoreHorizontal,
  ChevronDown,
  Trash2,
  UserX,
  VolumeX,
  Volume2,
  ShieldCheck,
  ShieldAlert,
  X,
  MessageCircle,
  Send,
  Paperclip,
  FileText,
  Loader2,
  Check,
  Clock,
  UserPlus,
  UserPlus2,
  Users,
  Eye,
  EyeOff,
  Flag,
  ImagePlus,
  Image as ImageIcon,
  Coins,
  Sticker,
  SlidersHorizontal,
  ScrollText,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { StickerPanel } from "@/components/chat/StickerPanel";
import { CaptureGuard } from "@/components/CaptureGuard";
import { frameImageOf } from "@/lib/frames";
import { framesOnIn } from "@/lib/module-frames";
import { speakingFxWrap, SpeakingFxOverlay } from "@/lib/speaking-fx";
import { Avatar } from "@/components/ui/Avatar";
import { profileHrefOf } from "@/lib/profile-href";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AgencyBadge } from "@/components/AgencyBadge";
import { CompetitionPanel } from "@/components/CompetitionPanel";
import { RoomShare } from "@/components/RoomShare";
import { RoomInviteFriends } from "@/components/RoomInviteFriends";
import { RoomInvitePicker } from "@/components/RoomInvitePicker";
import { PaidZoneCallBilling } from "@/components/PaidZoneCallBilling";
import { GiftButton } from "@/components/GiftButton";
import { EnableMicButton } from "@/components/EnableMicButton";
import { VoiceBgTip } from "@/components/VoiceBgTip";
import { GiftBurst, RoomGiftListener } from "@/components/GiftProvider";
import { RoomVideo } from "@/components/RoomVideo";
import { RoomRecorder } from "@/components/RoomRecorder";
import { RoomModerationPanel } from "@/components/RoomModerationPanel";
import { useBackgroundMedia } from "@/lib/MediaProvider";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth";
import { fileToDataUrl } from "@/lib/image";
import { usePhotoEdit } from "@/components/usePhotoEdit";
import { useConfig } from "@/lib/config";
import { requestFeature, requestGroupDeletion, fetchMyRoomRequests, type FeatureRequest } from "@/lib/feature-requests";
import { gameIcon } from "@/lib/game-icons";
import { withBase } from "@/lib/base-path";
import { roomAppearance } from "@/lib/room-features";
import { reportUser } from "@/lib/admin";
import { IS_PROD_SITE } from "@/lib/prod";
import {
  fetchRoom,
  fetchRoomMediaState,
  updateRoom,
  setRoomMedia,
  deleteRoom,
  kickRoomParticipant,
  requestSeat,
  decideSeat,
  leaveSeat,
  logRoomEvent,
  fetchRoomEvents,
  fetchRoomMembers,
  roomEventText,
  USERS,
  ME,
  type RoomView,
  type RoomMedia,
  type SpeakerUser,
  type RoomEventView,
  type PresenceMember,
} from "@/lib/rooms";
import { fetchMediaLibrary, purchaseMediaAccess, uploadRoomMedia, DEFAULT_MEDIA_ACCESS, type MediaItem, type MediaAccess, type MediaTypeKey } from "@/lib/media-library";
import { MediaLibraryBrowser } from "@/components/MediaLibraryBrowser";
import { RoomOverlays, RoomSeatOverlay, RoomZoneOverlay } from "@/components/RoomOverlays";
import { CustomUploads } from "@/components/CustomUploads";
import { uploadFile } from "@/lib/upload";
import { useVoice, type VoiceParticipant } from "@/lib/VoiceProvider";
import { checkMicPermission, micFailureShouldBlock } from "@/lib/mic-permission";
import { useKeepAwake } from "@/lib/useKeepAwake";
import { useBackGuard } from "@/lib/use-back-guard";
import { useUserProfiles } from "@/lib/useUserProfiles";

const REACTIONS = ["❤️", "😂", "👏", "🔥", "🎉", "🪷"];

interface FloatingReaction {
  id: number;
  emoji: string;
  left: number;
}

type SeatRole = "host" | "cohost" | "member";

/**
 * The size of the part of the screen the keyboard ISN'T covering.
 *
 * `interactiveWidget: "resizes-content"` (see app/layout.tsx) already handles
 * this on Android, but iOS Safari ignores that hint: there the keyboard slides
 * over the page, so a `fixed inset-0` panel keeps its full height, its bottom
 * row (the message box) ends up behind the keys, and the browser scrolls the
 * view to reveal it — which drags the seat strip off the top.
 *
 * Measuring the visual viewport pins the panel to what is genuinely visible on
 * every phone: the seats stay put, only the chat gets shorter, and the message
 * box sits directly above the keyboard. Returns null until measured, and while
 * the panel is closed, so nothing is applied when it isn't needed.
 */
function useVisibleViewport(active: boolean): { height: number; top: number } | null {
  const [box, setBox] = useState<{ height: number; top: number } | null>(null);
  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    let frame = 0;
    const apply = () => {
      cancelAnimationFrame(frame);
      // The keyboard animates open; measure on the next frame so we read the
      // settled size rather than a value mid-animation.
      frame = requestAnimationFrame(() => setBox({ height: Math.round(vv.height), top: Math.round(vv.offsetTop) }));
    };
    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      setBox(null);
    };
  }, [active]);
  return box;
}

/**
 * True on a computer-sized screen (Tailwind's `lg`, 1024px).
 *
 * Only for the few places where a *prop* has to change with the screen size —
 * here, the compact seats in the phone strip. Anything achievable with an `lg:`
 * class should use one instead: no JavaScript, and no flicker. Starts false and
 * corrects on mount so the server and first client render agree.
 */
function useIsLargeScreen(): boolean {
  const [large, setLarge] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setLarge(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return large;
}

export default function RoomStagePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const id = params?.id ? String(params.id) : "";
  // Super Admin silent monitoring (?monitor=1) — observe without joining a seat.
  const [monitorMode, setMonitorMode] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") setMonitorMode(new URLSearchParams(window.location.search).get("monitor") === "1");
  }, []);

  // While the room page is on screen, ITS media player handles playback. The moment
  // we navigate away (into a game, another page…) this flips to background, and the
  // app-level MediaProvider keeps the room audio playing until we leave the room.
  const { setForeground } = useBackgroundMedia();
  useEffect(() => {
    setForeground(true);
    return () => setForeground(false);
  }, [setForeground]);

  const [room, setRoom] = useState<RoomView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchRoom(id).then((r) => {
      if (active) {
        setRoom(r ?? null);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="grid place-items-center py-24 text-mist-400">
        <span className="size-8 animate-spin rounded-full border-2 border-lotus-500/30 border-t-lotus-400" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-ink-800">
          <Radio className="size-8 text-mist-400" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold text-mist-100">Room has ended</h1>
        <p className="mt-2 text-mist-300">This room is no longer live.</p>
        <Button className="mt-6" onClick={() => router.push("/rooms")}>
          <ArrowLeft className="size-4" /> Back to rooms
        </Button>
      </div>
    );
  }

  const me: SpeakerUser = user
    ? { id: user.id, fullName: user.fullName, username: user.username, avatar: user.avatar }
    : ME;
  // ADMIN VISIBILITY: a group set to "Hide Admin" puts every admin into silent
  // (invisible) mode automatically — no ?monitor=1 needed. They keep full control.
  // An admin who HOSTS/co-hosts this room stays visible — they run it.
  const runsThisRoom = !!user && (room.ownerId === user.id || (room.coAdminIds ?? []).includes(user.id));
  const hiddenAdminHere = user?.role === "admin" && room.hideAdmins === true && !runsThisRoom;
  return <Stage room={room} setRoom={setRoom} myId={user?.id} me={me} monitorMode={monitorMode || hiddenAdminHere} isAdmin={user?.role === "admin"} />;
}

function Stage({
  room,
  setRoom,
  myId,
  me,
  monitorMode,
  isAdmin,
}: {
  room: RoomView;
  setRoom: (r: RoomView) => void;
  myId?: string;
  me: SpeakerUser;
  monitorMode?: boolean;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { config: appConfig } = useConfig();
  // Always points at the latest room prop — so interval closures (e.g. the fast
  // media-sync poll) can read the current media without a stale capture.
  const roomRef = useRef(room);
  roomRef.current = room;
  // Effective co-host limit = the admin base + any EXTRA slots this room paid for.
  // A per-room "Maximum Co-Hosts" override (Admin → Room Settings) wins when set.
  const roomMaxCoHosts = room.features?.maxCoHosts;
  const coHostLimit = (typeof roomMaxCoHosts === "number" && roomMaxCoHosts > 0 ? roomMaxCoHosts : (appConfig.coHostLimit ?? 3)) + (room.coHostBonus ?? 0);

  const iAmHost = !!room.ownerId && room.ownerId === myId;
  const iAmCoHost = !!myId && (room.coAdminIds ?? []).includes(myId);
  // When the host/co-host makes a change (mute, co-host, audience, media, seats…)
  // we stamp this. The background room poll then REFUSES to overwrite our state for
  // a short window, so an already-in-flight fetch that returns the PRE-change room
  // can't revert what we just did (the "Remove Co-Host / Move to Audience showed a
  // toast but nothing changed" bug — the change applied, then a stale poll undid it).
  const roomMutatedAtRef = useRef(0);
  const markRoomMutated = useCallback(() => { roomMutatedAtRef.current = Date.now(); }, []);
  // ADMIN OUTRANKS THE HOST — everywhere, always (client rule).
  //
  // This used to read `(!!isAdmin && !!monitorMode)`: a platform admin only got the
  // room controls if they had entered through the Moderation Center's "Monitor"
  // link. Walking into a room normally left them as an ordinary member, so a host
  // could lock THE ADMIN out — the reported case was an admin staring at "Chat is
  // locked", and the same gate blocked media, games, seats and the manage menu.
  // (The SERVER already treated admins as moderators, so the message would in fact
  // have sent — it was purely this screen refusing to let them try.)
  //
  // An admin now always has the full set. Monitor mode still exists, but only to
  // keep an observing admin OFF the seats, not to decide what they may control.
  const canModerate = iAmHost || iAmCoHost || !!isAdmin;
  const canManage = canModerate;
  // MEMBER PERMISSIONS — a room is host-controlled by default: normal members
  // can take a seat / use mic / camera / chat / play games BY DEFAULT (this is a
  // social room — members are expected to participate). A permission is only
  // taken away when the Host/Co-Host explicitly switches it OFF (stores `false`).
  // Host & co-hosts are never restricted.
  const perms = room.memberPerms ?? {};
  // Per-room feature overrides (Admin → Room Settings) layer ON TOP of the host's
  // member permissions: a member may use a feature only if BOTH the host allows it
  // AND the admin hasn't turned it off for this room. `!== false` keeps unset =
  // allowed, so untouched rooms behave exactly as before. Mods are never gated.
  const rf = room.features ?? {};
  // Per-room visual appearance (background image, banner, logo, welcome, theme accent)
  // — now rendered LIVE (previously saved-only). The same values drive the Preview.
  const appear = roomAppearance(rf);
  const appearSrc = (u: string) => (/^(https?:|data:)/i.test(u) ? u : withBase(u));
  // Safe for embedding inside a CSS url("…") — strip quotes/backslashes/parens so a
  // malformed value can't break out of the inline style.
  const cssUrl = (u: string) => appearSrc(u).replace(/["'\\)]/g, "");
  const mSeat = canModerate || perms.seat !== false;
  const mMic = canModerate || (perms.mic !== false && rf.mic !== false);
  const mCam = canModerate || (perms.camera !== false && rf.camera !== false);
  const mChat = canModerate || (perms.chat !== false && rf.textChat !== false && rf.blockChat !== true);
  const mGames = canModerate || (perms.games !== false && rf.games !== false);
  // "Allow media" is opt-IN per member (grant model): only the host/co-hosts and
  // members the host has explicitly allowed may play room media.
  const canControlMedia = canModerate || (!!myId && (room.mediaAllowedIds ?? []).includes(myId));

  // Seeded people to make the room feel alive. Each room gets a DIFFERENT line-up:
  // the member list is shuffled deterministically from the room id, so opening
  // another room shows other people (not the same set every time).
  const pool = useMemo(() => {
    const others = USERS.filter((u) => u.id !== room.host.id);
    let seed = 0;
    for (let i = 0; i < room.id.length; i++) seed = (seed * 31 + room.id.charCodeAt(i)) >>> 0;
    const arr = [...others];
    for (let i = arr.length - 1; i > 0; i--) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      const j = seed % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [room.id, room.host.id]);
  // On the REAL site, rooms are not pre-filled with sample people — only the
  // host and members who actually join appear.
  const cohost = IS_PROD_SITE ? undefined : pool[0];
  const memberPool = IS_PROD_SITE ? [] : pool.slice(1);
  // Rooms feel differently populated (3–6 members), also derived from the room id.
  const FILLED_MEMBERS = useMemo(() => {
    if (IS_PROD_SITE) return 0;
    let s = 0;
    for (let i = 0; i < room.id.length; i++) s += room.id.charCodeAt(i);
    return 3 + (s % 4);
  }, [room.id]);

  const [mySeat, setMySeat] = useState<number | null>(iAmHost ? 0 : null);
  const [micLevel, setMicLevel] = useState(0);
  const [micDenied, setMicDenied] = useState(false);
  // Group chat opened as its own screen (client request). Kept as state rather
  // than a route so the room, the seats and the voice connection stay mounted —
  // going full screen must never disturb the call.
  const [chatFullScreen, setChatFullScreen] = useState(false);
  // The SEAT area opened as its own screen (client request) — the same idea as
  // the chat, so the seats and every room option get the whole display.
  const [fullRoom, setFullRoom] = useState(false);
  // THE THIRD full screen (client request): the seat area and the group chat
  // shown TOGETHER on one screen. The two single-area options above are left
  // exactly as they were — this is an additional choice, not a replacement.
  const [fullBoth, setFullBoth] = useState(false);
  // The phone's BACK button should close whichever full screen is open and
  // return to the room, not leave the room screen entirely.
  const closeChatFullScreen = useCallback(() => setChatFullScreen(false), []);
  useBackGuard(chatFullScreen, closeChatFullScreen);
  const closeFullRoom = useCallback(() => setFullRoom(false), []);
  useBackGuard(fullRoom && !chatFullScreen, closeFullRoom);
  const closeFullBoth = useCallback(() => setFullBoth(false), []);
  useBackGuard(fullBoth && !chatFullScreen && !fullRoom, closeFullBoth);
  // Stop the page behind a full-screen view from scrolling under it.
  useEffect(() => {
    if ((!chatFullScreen && !fullRoom && !fullBoth) || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [chatFullScreen, fullRoom, fullBoth]);
  // Only ONE full screen is ever open — opening any of the three closes the
  // others rather than stacking overlays on top of each other.
  useEffect(() => { if (chatFullScreen) { setFullRoom(false); setFullBoth(false); } }, [chatFullScreen]);
  useEffect(() => { if (fullBoth) setFullRoom(false); }, [fullBoth]);
  const openFullBoth = useCallback(() => { setChatFullScreen(false); setFullRoom(false); setFullBoth(true); }, []);
  const isLargeScreen = useIsLargeScreen();
  // Keeps the Seats + Chat screen sized to the part of the display the keyboard
  // is NOT covering, so the seat strip stays pinned at the top while you type.
  const visibleBox = useVisibleViewport(fullBoth);
  const [raised, setRaised] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [selfMenuOpen, setSelfMenuOpen] = useState(false);
  // Empty-seat action sheet: which seat index the user tapped "+" on (or null).
  // Tapping any free seat now opens a small menu with "Take this seat" — works in
  // live voice too (previously the + was inert once real voice was connected).
  const [seatSheetIdx, setSeatSheetIdx] = useState<number | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const reactionSeq = useRef(0);

  // Admin / moderation. Co-Host status is persisted (so it's real-time for
  // everyone via the room poll); mute / audience / removal are per-session.
  const [manageOpen, setManageOpen] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false); // group sticker panel
  const [peopleOpen, setPeopleOpen] = useState(false); // "N in room" → everyone connected
  const [modPanelOpen, setModPanelOpen] = useState(false); // host/co-host Reports & Moderation panel
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Host-mute is PERSISTED on the room so it's enforced for everyone (the muted
  // user's mic is actually disabled until the host unmutes them).
  const mutedMembers = room.mutedMemberIds ?? [];
  const [removedMembers, setRemovedMembers] = useState<string[]>([]);
  // Listener/audience list is PERSISTED on the room (room.audienceIds) so a
  // "move to listener" is real for everyone + survives refresh (was per-session).
  const audienceMembers = useMemo(() => room.audienceIds ?? [], [room.audienceIds]);
  // Server-side presence (everyone in the room per the backend) — the reliable
  // source for the seat grid, independent of each viewer's LiveKit voice link.
  const [presenceMembers, setPresenceMembers] = useState<PresenceMember[]>([]);
  const [manageTarget, setManageTarget] = useState<SpeakerUser | null>(null);
  // Whether the manage menu was opened from a chat message (vs a seat tap) —
  // chat context hides seat-only actions and shows friend/invite.
  const [manageFromChat, setManageFromChat] = useState(false);

  // ===== Live voice (LiveKit) — GLOBAL & PERSISTENT across navigation =====
  // The connection, microphone state and room presence all live in the
  // app-level VoiceProvider (mounted above the page). That means opening your
  // profile, editing your photo, sending a message, joining a game, viewing
  // another user or refreshing a sub-screen NO LONGER disconnects you, resets
  // your mic, or forces a rejoin. You join here on entry and only leave on the
  // explicit "Leave room" action below (or logout).
  const voice = useVoice();
  const { connect: voiceConnect, setForceMuted: voiceSetForceMuted } = voice;
  // Force-muted if the host muted me specifically OR locked member voice for all
  // (e.g. during a game) — the host & co-hosts can always speak.
  // Seat approval: when "Automatic Seat Approval" is OFF, a member must be
  // approved to be ON a seat (i.e. to speak). Host & co-hosts are always on.
  // Members need host approval to take a speaking seat when auto-approval is OFF
  // OR when the host has explicitly locked the "Seat" member-permission.
  const needsApproval = room.autoSeatApproval === false || !mSeat;
  // Seat-gating applies to NORMAL voice rooms only. Paid Zone 1:1 calls and
  // Competition rooms (their own turn-based flow) keep the old "everyone present
  // can speak" behaviour — mirrors the server token's canPublish exemption.
  const seatGatedRoom = room.category !== "Paid Zone" && room.category !== "Competition";
  // ===== SEAT-GATED SPEAKING =====
  // A member can ONLY speak while they OCCUPY A SEAT. Being present in the room is
  // NOT enough — you join as AUDIENCE (listen-only) and must take a seat (auto-
  // granted in Auto mode, host-approved otherwise) to enable your mic. The host &
  // co-hosts are always seated. `stageApprovedIds` is the granted-seat list; the
  // listener area (audienceIds) always overrides. This mirrors the server token's
  // canPublish gate, so an audience member genuinely cannot be heard.
  const iAmOnSeat =
    iAmHost || iAmCoHost || !seatGatedRoom ||
    (!!myId && (room.stageApprovedIds ?? []).includes(myId) && !(room.audienceIds ?? []).includes(myId));
  const iAmApproved = iAmOnSeat; // kept for the "you're approved" toast below
  // GAMES eligibility — ONLY members actually sitting on a voice seat may start,
  // join or be invited to a game. LISTENERS are excluded. This mirrors the server's
  // isSeated() exactly (no "ungated room" shortcut) so the button can never appear
  // for someone the server would then reject.
  const iAmSeatedForGames =
    iAmHost || iAmCoHost ||
    (!!myId && (room.stageApprovedIds ?? []).includes(myId) && !(room.audienceIds ?? []).includes(myId));
  // The host & co-hosts can ALWAYS speak — they are never force-muted, even if
  // they were muted by the host before being promoted to co-host. Everyone else
  // is force-muted (mic off, can't unmute) UNTIL they occupy a seat.
  const iAmMuted =
    !!myId && !iAmHost && !iAmCoHost &&
    (!mMic || // host explicitly locked the mic for members
      mutedMembers.includes(myId) ||
      !!room.voiceLocked ||
      !iAmOnSeat); // audience / not seated = listen-only, cannot speak
  const muted = voice.muted;
  const setMuted = voice.setMuted;
  const joinBlock = voice.joinBlock;
  const liveVoice = voice.configured;

  // Join this room's live session on entry. No-op if we're already in it, so
  // navigating back into the room never reconnects. Re-runs only when our
  // name/photo changes, which refreshes our seat live for everyone.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // MANUAL REJOIN — opening the room is a deliberate act: if the host had
      // REMOVED (kicked) me earlier, lift the kick BEFORE joining so I re-enter
      // as a normal member (listener; I can request a seat again). Only this
      // page-mount path calls it — the VoiceProvider's auto-reconnects never do,
      // so a kick still ejects reliably and can't be undone in the background.
      // BLOCKED users get 403 here and the access poll bounces them back out.
      try {
        await fetch(withBase(`/api/rooms/${room.id}/rejoin`), { method: "POST", credentials: "include" });
      } catch { /* best-effort — a kicked user just stays kicked until it works */ }
      if (cancelled) return;
      // Normal users join to participate; an ADMIN in ?monitor=1 joins as a HIDDEN,
      // muted observer so they can HEAR the room + see who's speaking live, while
      // staying invisible and unable to be heard.
      voiceConnect(room.id, { name: me.fullName, username: me.username, avatar: me.avatar }, room.name, { monitor: !!monitorMode && !!isAdmin });
    })();
    return () => { cancelled = true; };
  }, [room.id, room.name, monitorMode, isAdmin, me.fullName, me.username, me.avatar, voiceConnect]);

  // Keep the host's LOCAL kicked-list in sync with the server: when a kicked
  // member manually rejoins (their kick entry is lifted server-side), drop them
  // from the local list too so they reappear in the grids/counts for everyone.
  useEffect(() => {
    setRemovedMembers((m) => m.filter((id) => (room.removedMemberIds ?? []).includes(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.removedMemberIds]);

  // (The force-mute mirror lives further down — it also folds in the "no host /
  //  co-host present" gate, which is computed after the moderator-presence check.)

  // Defensive: a LiveKit server-mute can't be lifted by the user themselves. If
  // I'm a host/co-host (incl. someone muted BEFORE being promoted), clear any
  // stale server-mute on myself once so I can actually unmute. Doesn't force my
  // mic on — it only removes the block; my own mute choice still applies.
  const selfUnmutedRef = useRef(false);
  useEffect(() => {
    if (!liveVoice || !myId) return;
    if (iAmHost || iAmCoHost) {
      if (selfUnmutedRef.current) return;
      selfUnmutedRef.current = true;
      fetch(withBase(`/api/rooms/${room.id}/mute`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ targetUserId: myId, muted: false }),
      }).catch(() => {});
    } else {
      selfUnmutedRef.current = false; // demoted → allow re-clear if re-promoted
    }
  }, [iAmHost, iAmCoHost, liveVoice, myId, room.id]);

  // Real profile photos/names for everyone shown in the room, resolved from the
  // SERVER by user id. The live-voice metadata can't carry large data-URL
  // avatars reliably, so without this other members appear as plain initials.
  const memberProfiles = useUserProfiles([
    room.host.id,
    ...voice.participants.map((p) => p.id),
    ...presenceMembers.map((m) => m.id),
    // Co-hosts too — so an absent/off-seat co-host still resolves to a real name
    // in the Manage panel (the Host must be able to remove them even when they're
    // not currently in the room).
    ...(room.coAdminIds ?? []),
  ]);

  // Real people in the room (everyone except the host, who has their own seat).
  // Built from BOTH the live voice participants AND the server-side presence list
  // so a member who has joined the room always shows up — even if their LiveKit
  // voice connection hasn't reached us yet (the bug where an approved member's
  // seat stayed empty). Live participants supply real-time mic/speaking state;
  // presence-only members appear seated and silent until their voice connects.
  const liveMembers = useMemo<SpeakerUser[]>(() => {
    const list: SpeakerUser[] = [];
    const seen = new Set<string>([room.host.id]);
    if (liveVoice) {
      for (const p of voice.participants) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        const prof = memberProfiles[p.id];
        list.push({
          id: p.id,
          // For MY OWN seat always use the LIVE values (so changing my photo shows
          // instantly); for others prefer the server profile, then voice metadata.
          fullName: p.isLocal ? me.fullName : prof?.fullName || p.name,
          username: p.isLocal ? me.username : prof?.username || p.username || p.name,
          avatar: p.isLocal ? me.avatar : prof?.avatar || p.avatar || "",
          // MY OWN frame: local account first (instant after a purchase), then
          // the server profile (covers a stale cached login) — so I always see
          // my own frame, exactly like everyone else does.
          equippedFrame: p.isLocal ? (me.equippedFrame || prof?.equippedFrame) : prof?.equippedFrame,
        });
      }
    }
    // Keep MY OWN seat visible immediately while the voice channel (re)connects,
    // so the seating area doesn't flicker/empty on refresh.
    if (myId && !seen.has(myId)) {
      seen.add(myId);
      list.unshift({ id: myId, fullName: me.fullName, username: me.username, avatar: me.avatar, equippedFrame: me.equippedFrame || memberProfiles[myId]?.equippedFrame });
    }
    // Merge anyone present per the server who isn't already shown via live voice.
    for (const pm of presenceMembers) {
      if (seen.has(pm.id)) continue;
      seen.add(pm.id);
      const prof = memberProfiles[pm.id];
      list.push({
        id: pm.id,
        fullName: prof?.fullName || pm.fullName,
        username: prof?.username || pm.username,
        avatar: prof?.avatar || pm.avatar || "",
        equippedFrame: prof?.equippedFrame,
      });
    }
    return list;
  }, [liveVoice, voice.participants, room.host.id, me, myId, memberProfiles, presenceMembers]);

  // Quick lookup of live audio state (speaking / muted) by user id.
  const voiceById = useMemo(() => {
    const m = new Map<string, VoiceParticipant>();
    if (liveVoice) voice.participants.forEach((p) => m.set(p.id, p));
    return m;
  }, [liveVoice, voice.participants]);

  // Co-Hosts come straight from the persisted room record — assigning or
  // removing one updates the backend so every member sees it within seconds.
  const coAdmins = room.coAdminIds ?? [];

  // GROUP-CHAT AUTO-LOCK: when enabled (default ON) and NO host/co-host is live
  // in the room, regular members can't post. Moderators can always post and
  // their presence auto-unlocks it. (Mirrors the server-side enforcement.)
  // An ADMIN in the room counts as a moderator being present, so the chat and the
  // seats don't stay auto-locked for everyone else while an administrator is
  // standing right there. (Mirrors the server, which already exempts admins.)
  const moderatorPresent =
    voiceById.has(room.host.id) || coAdmins.some((cid) => voiceById.has(cid)) ||
    (!!isAdmin && !monitorMode);

  // ===== NO HOST / CO-HOST PRESENT → members can't hold a live seat =====
  // A normal room must have a host OR a co-host present for members to speak
  // (mirrors the group-chat auto-lock above). This stops a room running with
  // people talking while nobody is moderating it. Debounced (~6s) so a brief
  // host reconnect / seat flicker never flips it. Host/co-hosts are exempt, and
  // Paid Zone + Competition rooms (their own flow) are never gated.
  const [noModerator, setNoModerator] = useState(false);
  useEffect(() => {
    if (moderatorPresent || iAmHost || iAmCoHost || !seatGatedRoom || !liveVoice || !voice.connected) {
      setNoModerator(false);
      return;
    }
    const t = setTimeout(() => setNoModerator(true), 6000);
    return () => clearTimeout(t);
  }, [moderatorPresent, iAmHost, iAmCoHost, seatGatedRoom, liveVoice, voice.connected]);
  // A seated normal member is silenced while no moderator is present.
  const mutedNoModerator = noModerator && iAmOnSeat && !iAmHost && !iAmCoHost;
  // Combined force-mute (host force-mute / seat-gating OR no-moderator gate) →
  // mirrored into the live session so the user genuinely can't self-unmute.
  const amForceMuted = iAmMuted || mutedNoModerator;
  useEffect(() => {
    voiceSetForceMuted(amForceMuted);
  }, [amForceMuted, voiceSetForceMuted]);
  // A member is locked out when the host MANUALLY locked the chat, OR auto-lock
  // is on and no host/co-host is present. Moderators can always post.
  const chatLocked =
    !canModerate &&
    (!mChat || // chat permission locked for members (host-controlled by default)
      room.chatLockedNow === true ||
      (room.autoLockChat !== false && liveVoice && !moderatorPresent));

  // ===== Seat request approval =====
  const seatRequests = room.seatRequests ?? [];
  const myPendingRequest = !!myId && seatRequests.some((r) => r.userId === myId);
  // Show the "take a seat" prompt to anyone who is in the room but NOT on a seat
  // (audience) — in both Auto and manual modes. Hidden once they're seated. A
  // silent observer (admin monitoring / hidden admin) never takes a seat: being
  // heard would contradict being invisible.
  const showRequestSeat = !iAmHost && !iAmCoHost && !iAmOnSeat && !monitorMode;
  // In Auto mode taking a seat is instant; otherwise it's a request for approval.
  const seatIsInstant = room.autoSeatApproval !== false && mSeat;

  // Ask for MICROPHONE permission (once) before taking a seat. Requesting it
  // here — on a real tap — is what browsers require. Returns false + a clear
  // "enable it in Settings" message if the user has blocked the mic.
  // Users reported "Microphone access is blocked" on phones whose site settings
  // clearly said Microphone: Allowed — because the OLD check treated EVERY
  // getUserMedia failure as a denial. The commonest failure on Android is the mic
  // being BUSY (our own live voice connection is already holding it), which is
  // not a permission problem at all. checkMicPermission tells the cases apart,
  // and only a genuine denial / missing device stops the user now.
  const ensureMicPermission = useCallback(async (): Promise<boolean> => {
    const v = await checkMicPermission({ alreadyLive: voice.connected && !voice.micError });
    if (v.ok) return true;
    toast(v.message, micFailureShouldBlock(v) ? "error" : "info");
    return !micFailureShouldBlock(v);
  }, [toast, voice.connected, voice.micError]);

  const handleRequestSeat = useCallback(async () => {
    // A member can only take a speaking seat when a host or co-host is present to
    // moderate the room (no host/co-host = no one to run it).
    if (noModerator) {
      toast("You can take a seat once the host or a co-host is in the room.", "info");
      return;
    }
    // #3 — request mic permission the first time they join a seat.
    if (!(await ensureMicPermission())) return;
    const { autoApproved } = await requestSeat(room.id);
    toast(
      autoApproved
        ? "Auto-Join is enabled. You have joined the voice seat automatically."
        : "Your request has been submitted. Waiting for Host/Co-Host approval.",
      autoApproved ? "success" : "info",
    );
    const fresh = await fetchRoom(room.id);
    if (fresh) setRoom(fresh);
  }, [room.id, toast, setRoom, ensureMicPermission, noModerator]);

  // Step DOWN from a seat back to the audience — releases the seat + silences the
  // mic at the server, so a member who leaves their seat can no longer speak.
  const handleLeaveSeat = useCallback(async () => {
    setMuted(true);
    // Optimistic: drop myself from the approved-seat list so the UI reflects it now.
    if (myId) setRoom({ ...room, stageApprovedIds: (room.stageApprovedIds ?? []).filter((x) => x !== myId) });
    await leaveSeat(room.id);
    const fresh = await fetchRoom(room.id);
    if (fresh) setRoom(fresh);
    toast("You left your seat. You're listening only now.", "info");
  }, [room, myId, setRoom, setMuted, toast]);

  const handleSeatDecision = useCallback(
    async (targetUserId: string, approve: boolean) => {
      markRoomMutated();
      setRoom({
        ...room,
        seatRequests: (room.seatRequests ?? []).filter((r) => r.userId !== targetUserId),
        ...(approve
          ? { stageApprovedIds: [...new Set([...(room.stageApprovedIds ?? []), targetUserId])] }
          : {}),
      });
      await decideSeat(room.id, targetUserId, approve);
      const fresh = await fetchRoom(room.id);
      markRoomMutated();
      if (fresh) setRoom(fresh);
    },
    [room, setRoom, markRoomMutated],
  );

  // The Host/Co-Host has asked ME to come up and take a seat. Accepting seats me
  // immediately (the server does the same thing it does when a host approves a
  // seat request), so there is nothing else for the member to do afterwards.
  const mySeatInvite = useMemo(
    () => (myId ? (room.seatInvites ?? []).find((s) => s.userId === myId) : undefined),
    [room.seatInvites, myId],
  );
  const [inviteBusy, setInviteBusy] = useState(false);
  const answerSeatInvite = useCallback(
    async (accept: boolean) => {
      setInviteBusy(true);
      // Ask for the mic BEFORE seating, exactly as "Request a seat" does —
      // otherwise the browser prompt lands after they're already live.
      if (accept) { try { await ensureMicPermission(); } catch { /* seat them anyway */ } }
      markRoomMutated();
      try {
        await fetch(withBase(`/api/rooms/${room.id}/seat-invite`), {
          method: "POST", headers: { "Content-Type": "application/json" },
          credentials: "include", body: JSON.stringify({ accept }),
        });
      } catch { /* the refresh below tells us what really happened */ }
      const fresh = await fetchRoom(room.id);
      markRoomMutated();
      if (fresh) setRoom(fresh);
      setInviteBusy(false);
      if (accept) { setMuted(false); toast("You're on a seat — your mic is on. You can speak now. 🎙️", "success"); }
      else toast("Invitation declined.", "info");
    },
    [room.id, setRoom, markRoomMutated, toast, ensureMicPermission, setMuted],
  );

  /** Host/Co-Host withdrawing a seat invitation nobody answered. */
  const cancelSeatInvite = useCallback(
    async (targetUserId: string) => {
      markRoomMutated();
      setRoom({ ...room, seatInvites: (room.seatInvites ?? []).filter((s) => s.userId !== targetUserId) });
      try {
        await fetch(withBase(`/api/rooms/${room.id}/seat-invite`), {
          method: "POST", headers: { "Content-Type": "application/json" },
          credentials: "include", body: JSON.stringify({ cancel: true, targetUserId }),
        });
      } catch { /* the next poll re-syncs */ }
      const fresh = await fetchRoom(room.id);
      markRoomMutated();
      if (fresh) setRoom(fresh);
    },
    [room, setRoom, markRoomMutated],
  );

  // Tell the member the moment they're approved.
  const prevApproved = useRef(iAmApproved);
  useEffect(() => {
    if (needsApproval && !prevApproved.current && iAmApproved) {
      toast(amForceMuted ? "You've been approved to join the voice seat. Tap Unmute to speak." : "You're approved — your mic is on. You can speak now. 🎙️", "success");
    }
    prevApproved.current = iAmApproved;
  }, [iAmApproved, needsApproval, amForceMuted, toast]);

  // AUTO-UNMUTE on taking a seat — the moment the user is on a LIVE seat and NOT
  // restricted (host mute / mute-all / mic-locked / no-moderator), turn their mic ON so
  // they can speak immediately (client). They can mute manually afterwards. The
  // force-mute backstop (amForceMuted → voiceSetForceMuted) still silences a restricted
  // user even if this flips the state, so it can never override a host restriction.
  const prevOnSeat = useRef(iAmOnSeat);
  useEffect(() => {
    if (iAmOnSeat && !prevOnSeat.current && liveVoice && !amForceMuted) setMuted(false);
    prevOnSeat.current = iAmOnSeat;
  }, [iAmOnSeat, liveVoice, amForceMuted, setMuted]);

  // Resolve a member's first name from whoever is present, then their fetched
  // profile — works for co-hosts who are NOT currently in the room too.
  const firstNameOf = useCallback(
    (uid: string) => (liveMembers.find((x) => x.id === uid)?.fullName || memberProfiles[uid]?.fullName || USERS.find((u) => u.id === uid)?.fullName || "Member").split(" ")[0],
    [liveMembers, memberProfiles],
  );

  const setCoHost = useCallback(
    (id: string, make: boolean) => {
      const name = firstNameOf(id);
      markRoomMutated(); // freeze the poll so this change can't be reverted by a stale fetch
      if (make) {
        // Assigning a co-host. Enforce the room's max: if adding this one would go
        // OVER the limit, the OLDEST co-host(s) automatically STEP DOWN to make
        // room. In a single-co-host room (limit 1) this means a new assignment
        // instantly REPLACES the previous co-host — the client's "only one active
        // co-host at a time; assigning a new one removes the previous". (Was: a
        // hard error when full, so the host had to manually remove first.)
        let base = coAdmins.filter((x) => x !== id);
        let stepped: string[] = [];
        const overflow = base.length + 1 - Math.max(1, coHostLimit);
        if (overflow > 0) { stepped = base.slice(0, overflow); base = base.slice(overflow); }
        const nextCo = [...base, id];
        // The NEW co-host can always speak — clear any host-mute and bring them
        // onto the stage (out of the listener area, keep them approved).
        const nextMuted = (room.mutedMemberIds ?? []).filter((x) => x !== id);
        const nextAudience = (room.audienceIds ?? []).filter((x) => x !== id);
        const nextApproved = [...new Set([...(room.stageApprovedIds ?? []), id])];
        const patch: Partial<RoomView> = { coAdminIds: nextCo, mutedMemberIds: nextMuted, audienceIds: nextAudience, stageApprovedIds: nextApproved };
        setRoom({ ...room, ...patch });
        updateRoom(room.id, patch).then((u) => { if (u) { markRoomMutated(); setRoom(u); } });
        // CRITICAL: a LiveKit server-mute can't be cleared by the user themselves,
        // so explicitly UN-mute the new co-host at the voice server — otherwise
        // they'd be unable to unmute even though the button is enabled.
        fetch(withBase(`/api/rooms/${room.id}/mute`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ targetUserId: id, muted: false }),
        }).catch(() => {});
        toast(
          stepped.length
            ? `${name} is now the Co-Host — ${stepped.map(firstNameOf).join(", ")} stepped down`
            : `${name} is now a Co-Host`,
          "success",
        );
        logRoomEvent(room.id, "cohost", name); // show "became co-host" in the activity panel
      } else {
        // Removing a co-host: strip ONLY the moderator role. Keep them exactly
        // where they are — a normal member still on their speaker seat. Do NOT
        // dump them into the Listener area (the client didn't want removed
        // co-hosts auto-demoted to Listener). Keep their stage approval so a
        // room with seat-approval on doesn't bounce them off the stage either.
        // Works whether or not the co-host is currently seated/present.
        const nextCo = coAdmins.filter((x) => x !== id);
        const nextApproved = [...new Set([...(room.stageApprovedIds ?? []), id])];
        const nextAudience = (room.audienceIds ?? []).filter((x) => x !== id);
        const patch: Partial<RoomView> = { coAdminIds: nextCo, audienceIds: nextAudience, stageApprovedIds: nextApproved };
        setRoom({ ...room, ...patch }); // optimistic — instant locally
        updateRoom(room.id, patch).then((u) => { if (u) { markRoomMutated(); setRoom(u); } });
        toast(`${name} is no longer a Co-Host`, "success");
        logRoomEvent(room.id, "uncohost", name); // show "no longer co-host" in the activity panel
      }
    },
    [coAdmins, room, setRoom, toast, coHostLimit, markRoomMutated, firstNameOf],
  );

  const toggleMuteMember = useCallback((id: string) => {
    markRoomMutated();
    const name =
      liveMembers.find((m) => m.id === id)?.fullName.split(" ")[0] ??
      USERS.find((u) => u.id === id)?.fullName.split(" ")[0] ??
      "Member";
    const current = room.mutedMemberIds ?? [];
    const nowMuted = !current.includes(id);
    const next = nowMuted ? [...current, id] : current.filter((x) => x !== id);
    setRoom({ ...room, mutedMemberIds: next }); // optimistic — instant locally
    updateRoom(room.id, { mutedMemberIds: next }).then((u) => { if (u) { markRoomMutated(); setRoom(u); } });
    // Immediate, authoritative mute at the voice server (LiveKit).
    fetch(withBase(`/api/rooms/${room.id}/mute`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ targetUserId: id, muted: nowMuted }),
    }).catch(() => {});
    logRoomEvent(room.id, nowMuted ? "mute" : "unmute", name);
    toast(nowMuted ? `${name} has been muted` : `${name} can speak again`, "info");
  }, [room, setRoom, liveMembers, toast, markRoomMutated]);

  // 🔊 SPEAKER OFF — a per-listener control that is completely separate from Mute.
  // It silences one member's audio ON THIS DEVICE ONLY: their microphone keeps
  // running, the room is untouched, and everyone else still hears them. Anyone can
  // use it on anyone (no host rights needed) and the choice is remembered locally.
  const toggleSpeakerFor = useCallback((id: string) => {
    if (!id || id === myId) return;
    const name =
      liveMembers.find((m) => m.id === id)?.fullName.split(" ")[0] ??
      memberProfiles[id]?.fullName?.split(" ")[0] ??
      "Member";
    const nowOff = !voice.isSpeakerOff(id);
    voice.setSpeakerOff(id, nowOff);
    toast(
      nowOff
        ? `Speaker off — you will not hear ${name}. Their mic is untouched.`
        : `Speaker on — you can hear ${name} again.`,
      "info",
    );
  }, [voice, myId, liveMembers, memberProfiles, toast]);

  // Host/co-host grants or revokes "Allow media" for a single member — persisted
  // on the room so it takes effect for that member immediately (they get the Media
  // button + can play; revoking hides it again).
  const toggleMediaAllowed = useCallback((id: string) => {
    markRoomMutated();
    const cur = room.mediaAllowedIds ?? [];
    const nowAllowed = !cur.includes(id);
    const next = nowAllowed ? [...new Set([...cur, id])] : cur.filter((x) => x !== id);
    setRoom({ ...room, mediaAllowedIds: next }); // optimistic
    updateRoom(room.id, { mediaAllowedIds: next }).then((u) => { if (u) { markRoomMutated(); setRoom(u); } });
    const name = liveMembers.find((m) => m.id === id)?.fullName.split(" ")[0] ?? "Member";
    toast(nowAllowed ? `${name} can now play media` : `${name} can no longer play media`, "info");
  }, [room, setRoom, liveMembers, toast, markRoomMutated]);

  // Host/Co-Host quick controls (shared by the in-room bar AND the Option menu so
  // they're immediately accessible in every room type).
  const toggleMuteAll = useCallback(async () => {
    markRoomMutated();
    const next = !room.voiceLocked;
    setRoom({ ...room, voiceLocked: next });
    const u = await updateRoom(room.id, { voiceLocked: next });
    markRoomMutated();
    if (u) setRoom(u);
    toast(next ? "Members muted — only host & co-hosts can speak" : "Members can speak again", "info");
  }, [room, setRoom, toast, markRoomMutated]);
  const toggleSeatApproval = useCallback(async () => {
    markRoomMutated();
    const next = room.autoSeatApproval === false; // OFF→ON (Auto), ON→OFF (Approve)
    setRoom({ ...room, autoSeatApproval: next });
    const u = await updateRoom(room.id, { autoSeatApproval: next });
    markRoomMutated();
    if (u) setRoom(u);
    toast(next ? "Automatic seat approval ON — members join instantly" : "Seat approval is now manual — you'll approve requests", "info");
  }, [room, setRoom, toast, markRoomMutated]);

  // Host/co-host video moderation — persisted on the room, applied live (no
  // reconnect): force a user's camera off, or allow/deny members' video.
  const closeUserCamera = useCallback((userId: string, off: boolean) => {
    markRoomMutated();
    const cur = room.cameraOffIds ?? [];
    const next = off ? [...new Set([...cur, userId])] : cur.filter((x) => x !== userId);
    setRoom({ ...room, cameraOffIds: next });
    updateRoom(room.id, { cameraOffIds: next }).then((u) => { if (u) { markRoomMutated(); setRoom(u); } });
    const name = liveMembers.find((m) => m.id === userId)?.fullName.split(" ")[0] ?? "Member";
    toast(off ? `${name}'s camera was turned off` : `${name} can use their camera again`, "info");
  }, [room, setRoom, liveMembers, toast, markRoomMutated]);

  const toggleMembersVideo = useCallback((allowed: boolean) => {
    markRoomMutated();
    // Camera is part of the unified member-permission set.
    const nextPerms = { ...(room.memberPerms ?? {}), camera: allowed };
    setRoom({ ...room, memberPerms: nextPerms });
    updateRoom(room.id, { memberPerms: nextPerms }).then((u) => { if (u) { markRoomMutated(); setRoom(u); } });
    toast(allowed ? "Camera allowed — members can now turn on their camera" : "Camera locked — only the host & co-hosts can use their camera", "info");
  }, [room, setRoom, toast, markRoomMutated]);

  const nameOf = useCallback(
    (id: string) =>
      liveMembers.find((m) => m.id === id)?.fullName.split(" ")[0] ??
      USERS.find((u) => u.id === id)?.fullName.split(" ")[0] ??
      "Member",
    [liveMembers],
  );

  // Persist a room PATCH DURABLY. The 6s background poll can REVERT an optimistic
  // change if the PATCH silently fails (updateRoom → null on any non-2xx / network
  // error — common on a flaky connection), because the "apply the authoritative
  // room + re-stamp the guard" step only ran on success. That is exactly the
  // "removed member snaps back onto the seat after a few seconds" bug. This helper
  // re-stamps the mutation guard on EVERY attempt (so the poll stays frozen for the
  // whole retry window), retries a few times, and surfaces a real error instead of
  // letting a stale poll win.
  const persistRoomPatch = useCallback(
    async (patch: Record<string, unknown>, attempts = 4): Promise<boolean> => {
      for (let i = 0; i < attempts; i++) {
        markRoomMutated(); // keep the poll from applying stale server state
        const u = await updateRoom(room.id, patch);
        if (u) { markRoomMutated(); setRoom(u); return true; }
        await new Promise((r) => setTimeout(r, 600 * (i + 1))); // backoff before retry
      }
      markRoomMutated(); // final: keep the optimistic state pinned for this tick
      toast("Couldn't save that change — check your connection and try again.", "error");
      return false;
    },
    [room.id, setRoom, markRoomMutated, toast],
  );

  // Move a member to the LISTENER area (off the speaker seats) or bring them back
  // — PERSISTED on the room so it applies to everyone and survives refresh.
  const toggleAudience = useCallback((id: string) => {
    markRoomMutated(); // freeze the poll so this change can't be reverted by a stale fetch
    const cur = room.audienceIds ?? [];
    const goingToAudience = !cur.includes(id);
    const nextAudience = goingToAudience ? [...new Set([...cur, id])] : cur.filter((x) => x !== id);
    const patch: Partial<RoomView> = { audienceIds: nextAudience };
    if (goingToAudience) {
      // Moving to the listener area = leaving the seat → drop their granted seat
      // so they're truly audience (can't speak) until re-seated. The server syncs
      // their LiveKit publish permission (revoke + mute) when this PATCH lands.
      patch.stageApprovedIds = (room.stageApprovedIds ?? []).filter((x) => x !== id);
      // A CO-HOST is ALWAYS drawn on the co-host seat (that placement ignores the
      // audience list), so "Move to Audience" on a co-host wouldn't visibly move
      // them. Demote them at the same time so they truly go to the Listener area.
      if ((room.coAdminIds ?? []).includes(id)) {
        patch.coAdminIds = (room.coAdminIds ?? []).filter((x) => x !== id);
      }
    } else {
      // Bringing someone BACK to the stage: grant them a seat (both Auto and
      // approval modes) so they aren't instantly dropped back into the audience.
      patch.stageApprovedIds = [...new Set([...(room.stageApprovedIds ?? []), id])];
    }
    setRoom({ ...room, ...patch }); // optimistic
    void persistRoomPatch(patch); // durable write — the poll can't revert it if the PATCH fails
    toast(goingToAudience ? `${nameOf(id)} moved to the Listener area` : `${nameOf(id)} brought back to the stage`, "info");
    // Reflect the seat change in the activity panel (removed from seat / joined seat).
    logRoomEvent(room.id, goingToAudience ? "seat_left" : "seat_approved", nameOf(id));
  }, [room, setRoom, nameOf, toast, markRoomMutated, persistRoomPatch]);

  // FULL REMOVE (kick): persist removedMemberIds so the voice token is denied +
  // force-disconnect from the SFU now. They can't re-enter until re-invited.
  const removeMember = useCallback(
    (id: string) => {
      markRoomMutated();
      const name = nameOf(id);
      setRemovedMembers((m) => [...new Set([...m, id])]); // instant local UI
      const nextRemoved = [...new Set([...(room.removedMemberIds ?? []), id])];
      const nextCo = coAdmins.filter((x) => x !== id);
      // Clear EVERY trace of their membership (seat approval + listener list) so the
      // removal is complete — not just "off the seat but still in the room".
      const nextAudience = (room.audienceIds ?? []).filter((x) => x !== id);
      const nextApproved = (room.stageApprovedIds ?? []).filter((x) => x !== id);
      setRoom({ ...room, removedMemberIds: nextRemoved, coAdminIds: nextCo, audienceIds: nextAudience, stageApprovedIds: nextApproved });
      void persistRoomPatch({ removedMemberIds: nextRemoved, coAdminIds: nextCo, audienceIds: nextAudience, stageApprovedIds: nextApproved });
      kickRoomParticipant(room.id, id);
      logRoomEvent(room.id, "remove", name);
      toast(`${name} was removed from the room`, "success");
    },
    [room, setRoom, coAdmins, nameOf, toast, markRoomMutated, persistRoomPatch],
  );

  // BLOCK (ban until unblock): denied entry/view/voice/chat permanently. Also
  // kicks them now and strips co-host.
  const blockMember = useCallback(
    (id: string) => {
      markRoomMutated();
      const name = nameOf(id);
      // Ask WHY — recorded in the room's moderation log (who blocked whom & why).
      const reason = window.prompt(`Block ${name} from this room?\nOptional: give a reason (kept in the moderation log):`, "") ?? "";
      setRemovedMembers((m) => [...new Set([...m, id])]);
      const nextBlocked = [...new Set([...(room.blockedMemberIds ?? []), id])];
      const nextRemoved = [...new Set([...(room.removedMemberIds ?? []), id])];
      const nextCo = coAdmins.filter((x) => x !== id);
      setRoom({ ...room, blockedMemberIds: nextBlocked, removedMemberIds: nextRemoved, coAdminIds: nextCo });
      void persistRoomPatch({ blockedMemberIds: nextBlocked, removedMemberIds: nextRemoved, coAdminIds: nextCo, modReason: reason.trim() || undefined });
      kickRoomParticipant(room.id, id);
      logRoomEvent(room.id, "ban", name);
      toast(`${name} has been blocked from this room`, "success");
    },
    [room, setRoom, coAdmins, nameOf, toast, markRoomMutated, persistRoomPatch],
  );

  // UNBLOCK: clears both the block and the kick so they may rejoin.
  const unblockMember = useCallback(
    (id: string) => {
      markRoomMutated();
      const name = nameOf(id);
      setRemovedMembers((m) => m.filter((x) => x !== id));
      const nextBlocked = (room.blockedMemberIds ?? []).filter((x) => x !== id);
      const nextRemoved = (room.removedMemberIds ?? []).filter((x) => x !== id);
      setRoom({ ...room, blockedMemberIds: nextBlocked, removedMemberIds: nextRemoved });
      void persistRoomPatch({ blockedMemberIds: nextBlocked, removedMemberIds: nextRemoved });
      toast(`${name} has been unblocked`, "success");
    },
    [room, setRoom, nameOf, toast, markRoomMutated, persistRoomPatch],
  );

  // Presence (one-room-at-a-time + join/leave activity) is handled by the
  // VoiceProvider so it survives navigation — see connect()/leave() there.

  // Keep the screen awake while inside an active room (no auto-sleep/close).
  useKeepAwake(!joinBlock);

  // The BACK button must NEVER make the user leave the VOICE GROUP. Voice now
  // persists across navigation (VoiceProvider + the mini dock), so pressing Back
  // simply leaves the room SCREEN while staying connected to the group — the
  // dock keeps you live, and only the explicit "Leave room" button disconnects.
  // (The old history-guard that re-armed via setTimeout had a race where a fast
  // double-Back escaped it and felt like leaving — removed entirely.)

  // Poll the room so members receive the host's "now playing" media (and any
  // room changes) in near-real-time. Also refresh the authoritative member
  // presence so seats fill/empty as people join & leave — even when their voice
  // link hasn't propagated to us yet.
  useEffect(() => {
    let active = true;
    const tick = async () => {
      if (typeof document !== "undefined" && document.hidden) return; // pause when backgrounded
      const startedAt = Date.now();
      const [fresh, members] = await Promise.all([fetchRoom(room.id), fetchRoomMembers(room.id)]);
      if (!active) return;
      // (Removed/blocked enforcement is handled globally by the VoiceProvider's
      // access poll + VoiceDock, so it works on any screen, not just here.)
      // The synced player is keyed by media.src + startedAt, so a refresh with
      // unchanged media doesn't restart playback.
      // GUARD: if the host made a change AT/AFTER this fetch began, this snapshot is
      // stale — skip it so it can't revert the change (co-host/audience/mute/etc.).
      // Our own optimistic + saved state (and the NEXT poll) carry the truth.
      if (fresh && roomMutatedAtRef.current < startedAt) setRoom(fresh);
      setPresenceMembers(members); // presence is additive — safe to always refresh
    };
    tick(); // immediate, so a member appears without waiting a full interval
    const t = setInterval(tick, 6000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [room.id, setRoom]);

  // FAST MEDIA SYNC: a tiny, frequent poll of ONLY the room's media state so the
  // host's play / pause / resume / skip / stop reaches EVERY member in ~2s (the
  // full-room poll above is every 6s and would feel laggy for music controls).
  // Only touches state when the media actually changed (so it never restarts
  // playback needlessly).
  useEffect(() => {
    let active = true;
    const sig = (m: RoomMedia | null | undefined) =>
      m ? `${m.src}|${m.startedAt}|${m.paused ? 1 : 0}|${m.pausedAtSec ?? 0}|${m.mutedForAll ? 1 : 0}` : "";
    const tick = async () => {
      if (typeof document !== "undefined" && document.hidden) return; // paused when backgrounded
      const m = await fetchRoomMediaState(room.id);
      if (!active || m === undefined) return; // network error → keep current state
      const cur = roomRef.current;
      if (cur && sig(cur.media) !== sig(m)) setRoom({ ...cur, media: m });
    };
    const t = setInterval(tick, 2000);
    return () => { active = false; clearInterval(t); };
  }, [room.id, setRoom]);

  // MEDIA OWNERSHIP AUTO-STOP: if the member who started the music/video has
  // left (no longer a live voice participant), stop it for EVERYONE so there's
  // no orphaned playback. A manager performs the clear; the 4s poll propagates.
  useEffect(() => {
    const m = room.media;
    if (!m || !m.ownerId || !canModerate || !voice.connected) return;
    if (voiceById.has(m.ownerId)) return; // owner still here
    const t = setTimeout(() => { setRoomMedia(room.id, null); }, 6000);
    return () => clearTimeout(t);
  }, [room.media, voiceById, canModerate, voice.connected, room.id]);

  const hostProfile = memberProfiles[room.host.id];
  const host: SpeakerUser = {
    id: room.host.id,
    fullName: room.host.fullName,
    username: hostProfile?.username || room.host.username,
    avatar: hostProfile?.avatar || room.host.avatar,
    equippedFrame: hostProfile?.equippedFrame,
  };

  // Rooms are capped at 10 seats (1 host + 1 co-host + 8 members).
  // A per-room "Maximum Participants" override (Admin → Room Settings) caps the seat
  // grid for THIS room; 0/unset falls back to the room's normal capacity.
  const roomMaxPart = room.features?.maxParticipants;
  const seatCount = Math.min(typeof roomMaxPart === "number" && roomMaxPart > 0 ? roomMaxPart : room.capacity, 50);

  // Kicked/blocked → gone entirely.
  const isBannedLocal = useCallback(
    (id: string) =>
      removedMembers.includes(id) ||
      (room.removedMemberIds ?? []).includes(id) ||
      (room.blockedMemberIds ?? []).includes(id),
    [removedMembers, room.removedMemberIds, room.blockedMemberIds],
  );

  // Not yet on a seat (and not host/co-host) → LISTENING, not on a speaker seat.
  // This now applies in BOTH Auto and manual modes: a member is audience until
  // they actually TAKE a seat (added to stageApprovedIds). In Auto mode taking a
  // seat is instant; otherwise it needs host approval. This is what stops a
  // just-joined member from speaking without occupying a seat.
  const isUnapproved = useCallback(
    (id: string) =>
      seatGatedRoom &&
      id !== room.host.id &&
      !coAdmins.includes(id) &&
      !(room.stageApprovedIds ?? []).includes(id),
    [seatGatedRoom, room.host.id, coAdmins, room.stageApprovedIds],
  );

  // Build the seat list from capacity. Removed/blocked are dropped; members moved
  // to the audience OR awaiting seat approval are kept OFF the speaker seats.
  // A CO-HOST is ALWAYS on the stage — never shown as a Listener — even if they
  // somehow linger in the audience list (fixes "co-hosts moved to Listener").
  const offStage = useCallback(
    (id?: string) =>
      !!id && !coAdmins.includes(id) && (isBannedLocal(id) || audienceMembers.includes(id) || isUnapproved(id)),
    [isBannedLocal, audienceMembers, isUnapproved, coAdmins],
  );

  // Host "away" detection — DEBOUNCED so the host seat doesn't flash empty on
  // refresh. The host is only shown as away after a few seconds of confirmed
  // absence (not during the brief voice (re)connect window).
  const hostPresent = !liveVoice || iAmHost || voiceById.has(room.host.id);
  const [hostAway, setHostAway] = useState(false);
  useEffect(() => {
    if (hostPresent || !voice.connected) { setHostAway(false); return; }
    const t = setTimeout(() => setHostAway(true), 4000);
    return () => clearTimeout(t);
  }, [hostPresent, voice.connected]);

  // Members shown on the stage. On the real site we always show MY OWN seat
  // immediately — even before the voice channel finishes (re)connecting — so the
  // seating area never disappears/flickers on refresh.
  const realMode = liveVoice || IS_PROD_SITE;
  // STABLE seat order: remember the order each member first appeared in, so a new
  // person joining APPENDS to the next free seat instead of reshuffling everyone
  // (the live-voice list can reorder on join/reconnect, which made seated users
  // look like they were bumped out of their seat).
  const seatOrderRef = useRef<{ map: Map<string, number>; seq: number }>({ map: new Map(), seq: 0 });
  const orderedMembers = useMemo(() => {
    const st = seatOrderRef.current;
    for (const m of liveMembers) if (!st.map.has(m.id)) st.map.set(m.id, st.seq++);
    return [...liveMembers].sort((a, b) => (st.map.get(a.id) ?? 0) - (st.map.get(b.id) ?? 0));
  }, [liveMembers]);
  const displayMembers = useMemo<SpeakerUser[]>(() => {
    // On the real site, always use the merged live-voice + server-presence list
    // (it already includes me + everyone present), so members never disappear
    // just because a viewer's own voice link is briefly reconnecting.
    if (realMode) return orderedMembers;
    return memberPool; // demo/showcase build
  }, [realMode, orderedMembers, memberPool]);

  const seats = useMemo(() => {
    const list: { role: SeatRole; user?: SpeakerUser }[] = [];
    // Host away → the host seat shows EMPTY (no "seated + away" confusion).
    // When I'M the host, make sure MY OWN frame shows on my seat too (local
    // account first, server profile as fallback for a stale cached login).
    list.push({ role: "host", user: iAmHost ? { ...me, equippedFrame: me.equippedFrame || memberProfiles[me.id]?.equippedFrame } : hostAway ? undefined : host });
    const visible = displayMembers.filter((m) => !offStage(m.id));
    if (realMode) {
      // Real people. The assigned Co-Host always sits in Seat #2; others fill in.
      const coMember = visible.find((m) => coAdmins.includes(m.id));
      const others = visible.filter((m) => m.id !== coMember?.id);
      list.push({ role: "cohost", user: coMember });
      for (let i = 0; i < seatCount - 2; i++) {
        list.push({ role: "member", user: others[i] });
      }
    } else {
      // Demo/showcase build — seeded member pool.
      if (!offStage(cohost?.id)) list.push({ role: "cohost", user: cohost });
      else list.push({ role: "cohost", user: undefined });
      for (let i = 0; i < seatCount - 2; i++) {
        list.push({ role: "member", user: i < FILLED_MEMBERS ? visible[i] : undefined });
      }
    }
    return list;
  }, [seatCount, iAmHost, host, cohost, displayMembers, realMode, offStage, FILLED_MEMBERS, me, coAdmins, hostAway, memberProfiles]);

  // People the host/co-host moved to listen-only mode (shown below the stage).
  const audienceList = useMemo(() => {
    if (realMode) {
      // Live members who are off the stage = listening (moved to audience OR
      // waiting for seat approval), excluding the host, co-hosts, and anyone
      // removed/blocked (a co-host is always a speaker, never a Listener).
      return displayMembers.filter(
        (m) => m.id !== room.host.id && !coAdmins.includes(m.id) && !isBannedLocal(m.id) && (audienceMembers.includes(m.id) || isUnapproved(m.id)),
      );
    }
    return [cohost, ...memberPool].filter(
      (m) => !!m && audienceMembers.includes(m.id) && !removedMembers.includes(m.id),
    ) as SpeakerUser[];
  }, [realMode, displayMembers, room.host.id, coAdmins, isBannedLocal, audienceMembers, isUnapproved, cohost, memberPool, removedMembers]);

  const occupants = useMemo(
    () =>
      realMode
        ? seats.filter((s) => s.user).length
        : seats.filter((s) => s.user).length + (mySeat !== null && !iAmHost ? 1 : 0),
    [seats, mySeat, iAmHost, realMode],
  );

  // TOTAL people in the room (speakers + listeners) — a DISTINCT count across
  // every source: seated members, the audience/listeners and any present member,
  // deduplicated by user id so nobody is double-counted.
  //
  // THE HOST USED TO BE ADDED UNCONDITIONALLY ("counts even when away"), which is
  // why a room whose host had gone showed "2 in room" while that host's seat
  // plainly said AWAY — the badge and the number contradicted each other on the
  // same screen. The host is now counted only while actually present, gated on
  // the SAME `hostAway` flag that draws the badge, so the two can never disagree.
  // (hostAway carries a 4s debounce and is never set while we're off voice, so a
  // refresh or a brief voice reconnect still doesn't make the count flicker.)
  //
  // Everyone else already falls out on their own: liveMembers is built from live
  // voice participants plus server presence, so a member who leaves disappears
  // from both.
  const totalInRoom = useMemo(() => {
    const ids = new Set<string>();
    // Anyone removed/blocked is NOT in the room — drop them from the count straight
    // away so a "Remove from room" is reflected instantly (their own client is
    // ejected by the access poll a moment later).
    const add = (id?: string) => { if (id && !isBannedLocal(id)) ids.add(id); };
    for (const s of seats) if (s.user) add(s.user.id);
    for (const m of audienceList) add(m.id);
    for (const m of liveMembers) add(m.id);
    if (!hostAway) add(room.host?.id);
    return ids.size;
  }, [seats, audienceList, liveMembers, room.host?.id, isBannedLocal, hostAway]);

  // EVERY person currently connected to the room (host, co-hosts, speakers on a
  // seat, listeners and anyone else present), deduplicated and labelled — powers
  // the "N in room" tap-through list so the host can see & manage everyone, not
  // just the people sitting on a seat.
  const peopleInRoom = useMemo(() => {
    const byId = new Map<string, { user: SpeakerUser; role: string }>();
    const put = (u: SpeakerUser | undefined | null, role: string) => {
      if (!u?.id || isBannedLocal(u.id) || byId.has(u.id)) return;
      byId.set(u.id, { user: u, role });
    };
    // Same rule as the count above: an away host isn't in the room, so they don't
    // belong in the "who's here" list either. (When I AM the host, hostAway is
    // never true, so I always see myself.)
    if (!hostAway) put(iAmHost ? me : host, "Host");
    const pool = [...displayMembers, ...liveMembers];
    for (const id of coAdmins) put(pool.find((m) => m.id === id), "Co-Host");
    for (const s of seats) if (s.user) put(s.user, "On a seat");
    for (const m of audienceList) put(m, "Listener");
    for (const m of pool) put(m, "In room");
    return [...byId.values()];
  }, [iAmHost, me, host, displayMembers, liveMembers, coAdmins, seats, audienceList, isBannedLocal, hostAway]);

  // Each seated member's OWN agency (from the presence list) → shown under their
  // name on the seat. Keyed by user id.
  const agencyByUser = useMemo(() => {
    const m = new Map<string, { name: string; id?: string }>();
    for (const p of presenceMembers) if (p.agencyName) m.set(p.id, { name: p.agencyName, id: p.agencyId });
    return m;
  }, [presenceMembers]);

  // First name of whoever is speaking right now (for the indicator under the seats).
  const speakingName = liveVoice
    ? (voice.participants.find((p) => p.isSpeaking)?.name.split(" ")[0] ?? null)
    : typeof speakingId === "string"
      ? (memberPool.find((m) => m.id === speakingId)?.fullName.split(" ")[0] ?? null)
      : null;

  // Gift recipients = EVERY real person in the voice room (host, co-hosts and
  // all members), so the sender can pick anyone — and the host can gift too.
  // (Previously this used the demo member pool, which is empty in production, so
  // it left only the host → users could only gift the host and the host had no
  // one to gift.) We pull from ALL member sources (live voice, server presence,
  // seated users, audience) so it's never empty when anyone is present. Names
  // are full names; the server resolves them + never lets you gift yourself.
  const giftRecipients = useMemo(() => {
    const set = new Set<string>();
    const add = (u?: { fullName?: string } | null) => { if (u?.fullName) set.add(u.fullName); };
    add(room.host);
    if (realMode) {
      liveMembers.forEach(add);
      presenceMembers.forEach(add);
      seats.forEach((s) => add(s.user));
      audienceList.forEach(add);
    } else {
      [cohost, ...memberPool].forEach(add);
    }
    set.delete(me.fullName);
    return [...set];
  }, [room.host, realMode, liveMembers, presenceMembers, seats, audienceList, cohost, memberPool, me.fullName]);

  // Real microphone level for the signed-in user when seated + unmuted.
  // Skipped when LiveKit is active (it captures the mic + reports speaking).
  useEffect(() => {
    if (liveVoice || mySeat === null || muted) {
      setMicLevel(0);
      return;
    }
    let raf = 0;
    let ctx: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        ctx = new AudioContext();
        const src = ctx.createMediaStreamSource(s);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (const v of data) {
            const x = (v - 128) / 128;
            sum += x * x;
          }
          setMicLevel(Math.min(1, Math.sqrt(sum / data.length) * 3.2));
          raf = requestAnimationFrame(tick);
        };
        setMicDenied(false); // it worked — clear any earlier warning
        tick();
      })
      // Only a REAL permission denial raises the red banner. A busy mic
      // (NotReadableError — another app or tab holding the hardware) is not a
      // permission problem and must not be reported as one; that mislabelling is
      // why users with "Microphone: Allowed" were told they were blocked.
      .catch((err: unknown) => {
        const n = (err as { name?: string })?.name ?? "";
        setMicDenied(n === "NotAllowedError" || n === "PermissionDeniedError" || n === "SecurityError");
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close();
    };
  }, [mySeat, muted, liveVoice]);

  // Random seeded speaker animation — demo only; real speaking comes from LiveKit.
  useEffect(() => {
    if (liveVoice) return;
    const live = seats.filter((s) => s.user).map((s) => s.user!.id);
    if (!live.length) return;
    const t = setInterval(() => {
      const pick = live[Math.floor(Math.random() * live.length)];
      setSpeakingId(pick);
      setTimeout(() => setSpeakingId(null), 700);
    }, 1500);
    return () => clearInterval(t);
  }, [seats, liveVoice]);

  const react = useCallback((emoji: string) => {
    const rid = reactionSeq.current++;
    const left = 8 + Math.random() * 84;
    setReactions((r) => [...r, { id: rid, emoji, left }]);
    setTimeout(() => setReactions((r) => r.filter((x) => x.id !== rid)), 2200);
  }, []);

  const takeSeat = (index: number) => {
    if (iAmHost || mySeat !== null) return;
    if (noModerator) { toast("You can take a seat once the host or a co-host is in the room.", "info"); return; }
    setMySeat(index);
    setMuted(true);
    setRaised(false);
  };

  // Shared Media props — used by BOTH the always-mounted "now playing" player
  // (so audio never stops) and the "Media" menu button's selection sheet.
  const mediaProps = {
    canControl: canControlMedia,
    iAmHost,
    isCoHost: iAmCoHost,
    hostId: room?.host.id ?? "",
    myId: myId ?? "",
    roomId: room?.id ?? "",
    media: room?.media ?? null,
    onSetMedia: async (m: { kind: "audio" | "video" | "youtube" | "image"; src: string; name?: string } | null) => {
      if (!room) return;
      const withOwner = m ? { ...m, ownerId: myId, ownerName: me.fullName, startedAt: Date.now() } : null;
      setRoom({ ...room, media: withOwner }); // optimistic
      const updated = await setRoomMedia(room.id, withOwner);
      if (updated) setRoom(updated);
    },
    onUpdateMedia: async (patch: Partial<RoomMedia>) => {
      if (!room || !room.media) return;
      const merged = { ...room.media, ...patch };
      setRoom({ ...room, media: merged }); // optimistic
      const updated = await setRoomMedia(room.id, merged);
      if (updated) setRoom(updated);
    },
  };

  // ── THE ROOM'S ACTION BUTTONS, DEFINED ONCE ─────────────────────────────
  // Rendered both in the normal layout and inside the full-screen room view.
  // Keeping one definition is the point: two copies would quietly drift as
  // buttons get added, and the full-screen view would end up missing options.
  const roomActionButtons = (
    <>
      {/* GAMES — only for members ON A SEAT. A listener sees a disabled button
          telling them to take a seat first (they can't start/join a game). */}
      {room.category !== "Paid Zone" && mGames && (
        iAmSeatedForGames
          ? <GamesButton roomId={room.id} roomName={room.name} features={room.features} />
          : (
            <button
              type="button"
              disabled
              title="Take a voice seat to play games"
              onClick={() => toast("Take a voice seat to play games — listeners can't join a game.", "info")}
              className="room-ctrl flex cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-line bg-ink-800/60 px-3 py-3 text-sm font-semibold text-mist-500 opacity-60"
            >
              <Gamepad2 className="size-4" /> Games
            </button>
          )
      )}
      {/* CHAT — opens the group chat as its own screen. */}
      {mChat && (
        <button
          type="button"
          onClick={() => setChatFullScreen(true)}
          className="room-ctrl flex items-center justify-center gap-2 rounded-2xl border border-line bg-ink-800 px-3 py-3 text-sm font-semibold text-mist-200 transition hover:border-lotus-400/50 hover:bg-ink-750 hover:text-mist-100"
        >
          <MessageCircle className="size-4 text-lotus-300" /> Chat
        </button>
      )}
      {/* STICKERS — every member can send; only host/co-hosts curate the set. */}
      {mChat && rf.stickers !== false && (
        <button
          type="button"
          onClick={() => setStickersOpen(true)}
          className="room-ctrl flex items-center justify-center gap-2 rounded-2xl border border-line bg-ink-800 px-3 py-3 text-sm font-semibold text-mist-200 transition hover:border-lotus-400/50 hover:bg-ink-750 hover:text-mist-100"
        >
          <Sticker className="size-4 text-lotus-300" /> Stickers
        </button>
      )}
      {rf.virtualGifts !== false && <GiftButton recipients={giftRecipients} roomId={room.id} variant="card" className="room-ctrl justify-center" />}
      {canControlMedia && rf.musicPlayer !== false && rf.blockMediaSharing !== true && <MediaButton {...mediaProps} />}
      <RoomOptionsMenu roomId={room.id} roomName={room.name} isPaidZone={room.category === "Paid Zone"} canManage={canManage} onManage={() => setManageOpen(true)} voiceLocked={!!room.voiceLocked} seatApprovalManual={room.autoSeatApproval === false} onToggleMuteAll={toggleMuteAll} onToggleSeatApproval={toggleSeatApproval} isAdmin={isAdmin} />
      <MinimizeButton />
    </>
  );

  // ---- HOST MODERATION CLUSTER, defined once and shown in every view --------
  // These used to live far below the chat, so a host had to scroll past the whole
  // conversation to approve someone — and in the full-screen views they were not
  // reachable at all. Defined here (like roomActionButtons) they can sit right
  // under the seats in every view, and can never go missing from one of them.

  /** Pending seat requests. Renders nothing when there are none, so it costs no
   *  space in normal use — which is what lets it live in the full-screen views. */
  const seatRequestsPanel = canModerate && seatRequests.length > 0 ? (
    <div className="rounded-xl border border-amber-400/30 bg-amber-500/[0.07] p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-200">
        <UserCheck className="size-3.5" /> Seat requests ({seatRequests.length})
      </p>
      <div className="space-y-1.5">
        {seatRequests.map((r) => (
          <div key={r.userId} className="flex items-center gap-2 rounded-lg bg-ink-850/70 px-2.5 py-1.5">
            <Avatar name={r.userName} src={r.avatar} size="xs" />
            <span className="min-w-0 flex-1 truncate text-sm text-mist-100">{r.userName}</span>
            <button
              onClick={() => handleSeatDecision(r.userId, true)}
              className="shrink-0 rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30"
            >
              Approve
            </button>
            <button
              onClick={() => handleSeatDecision(r.userId, false)}
              className="shrink-0 rounded-lg bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/25"
            >
              Reject
            </button>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  /** Mute all · seat approval mode · manage. Host and co-hosts only. */
  const hostQuickControls = canManage ? (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" onClick={toggleMuteAll} className={room.voiceLocked ? "!text-rose-300" : undefined}>
        {room.voiceLocked ? <Lock className="size-4" /> : <Mic className="size-4" />}
        {room.voiceLocked ? "Allow voice" : "Mute all"}
      </Button>
      <Button size="sm" variant="secondary" onClick={toggleSeatApproval} title="Automatic Seat Approval">
        {room.autoSeatApproval === false ? <Hand className="size-4" /> : <UserCheck className="size-4" />}
        Seats: {room.autoSeatApproval === false ? "Approve" : "Auto"}
      </Button>
      <Button size="sm" variant="secondary" onClick={() => setManageOpen(true)}>
        <Settings className="size-4" /> Manage
      </Button>
    </div>
  ) : null;

  /** Everyone listening without a seat — belongs directly under the seats, since
   *  it is part of "who is in this room". */
  const audiencePanel = audienceList.length > 0 ? (
    <div className="rounded-2xl border border-white/10 bg-ink-850/40 p-3.5">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-mist-300">
        <Hand className="size-3.5 text-mist-400" /> Audience · listening ({audienceList.length})
      </p>
      <div className="flex flex-wrap gap-3">
        {audienceList.map((m) => {
          const canManageThis = canManage && m.id !== room.host.id;
          return (
            <button
              key={m.id}
              onClick={canManageThis ? () => { setManageTarget(m); setManageFromChat(false); } : undefined}
              disabled={!canManageThis}
              className={cn("flex flex-col items-center gap-1", canManageThis ? "cursor-pointer" : "cursor-default")}
            >
              <Avatar name={m.fullName} src={m.avatar} size="md" className="opacity-80" frameImage={framesOnIn(appConfig, "voiceRoom") && m.equippedFrame ? frameImageOf(appConfig, m.equippedFrame) : undefined} />
              <span className="max-w-16 truncate text-[11px] text-mist-300">{m.fullName.split(" ")[0]}</span>
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  // The mic status bar is likewise defined ONCE, so it can be shown inside the
  // full-screen views too — an overlay that covered the room used to take the
  // mute/unmute control away with it.
  const micStatusButton = liveVoice ? (
    <button
      onClick={() => { if (!amForceMuted) { setMuted(!muted); setMicDenied(false); voice.startAudio(); } }}
      disabled={amForceMuted}
      className={cn(
        "mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition",
        amForceMuted
          ? "cursor-default bg-ink-800 text-mist-400"
          : muted
            ? "bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/30 hover:bg-rose-500/30"
            : "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/40 hover:bg-emerald-500/30",
      )}
    >
      {mutedNoModerator && !iAmMuted ? (
        <><MicOff className="size-4" /> Waiting for a host or co-host</>
      ) : iAmMuted ? (
        <><MicOff className="size-4" /> Muted by host</>
      ) : muted ? (
        <><MicOff className="size-4" /> You&apos;re muted — tap to unmute</>
      ) : (
        <><Mic className="size-4" /> <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/70" /><span className="relative inline-flex size-2 rounded-full bg-emerald-400" /></span> You&apos;re live — tap to mute</>
      )}
    </button>
  ) : null;

  return (
    <div
      className={cn("relative mx-auto max-w-3xl", appear.bgImage && "rounded-2xl bg-cover bg-center bg-no-repeat p-2 sm:p-3")}
      style={appear.bgImage ? { backgroundImage: `linear-gradient(rgba(9,7,18,0.84), rgba(9,7,18,0.92)), url("${cssUrl(appear.bgImage)}")` } : undefined}
    >
      {/* Admin-placed image overlays (banners / logos / decorations) on the room screen. */}
      <RoomOverlays roomId={room.id} isHost={canModerate || !!isAdmin} isVip={!!(me as { vip?: boolean })?.vip} />
      {/* Paid Zone calls: screenshot/recording protection (admin-controlled,
          admins exempt) — shield, watermark, share-block, warnings. */}
      {(room.category === "Paid Zone" || appConfig.captureProtection?.allScreens || appConfig.captureProtection?.modules?.voiceRoom) && <CaptureGuard label={room.category === "Paid Zone" ? "Paid Zone call" : "voice room"} />}
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => setConfirmLeave(true)}
          className="inline-flex items-center gap-2 text-sm text-mist-300 hover:text-mist-100"
        >
          <ArrowLeft className="size-4" /> Rooms
        </button>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-rose-300">
            <Radio className="size-3.5" /> {room.category === "Paid Zone" ? "Private call" : "Live"}
          </span>
        </div>
      </div>

      {/* Per-room BANNER image (appearance) — a wide image strip at the top. */}
      {appear.banner && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={appearSrc(appear.banner)} alt="" className="max-h-40 w-full object-cover" />
        </div>
      )}
      {/* Per-room WELCOME message (appearance) — greets members at the top of the room. */}
      {appear.welcome && (
        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-lotus-400/25 bg-lotus-500/[0.08] px-4 py-3 text-sm text-mist-100">
          <Hand className="mt-0.5 size-4 shrink-0 text-lotus-300" />
          <span className="min-w-0">{appear.welcome}</span>
        </div>
      )}

      {/* The room now flows TOP→BOTTOM as: title → controls menu → SEATS →
          management/config, so the seats sit high on the screen and the host
          management block drops below them (client request). Ordered via flex.
          In the "Seats + Chat" full screen this same wrapper becomes the screen,
          so both areas are the SAME elements — they can never drift apart from
          the in-room versions. */}
      <div
        className={cn(
          fullBoth
            // Pinned to the top of the visible area rather than stretched to the
            // full page: when the keyboard opens the screen gets SHORTER, so the
            // seat strip stays exactly where it is and only the chat gives up
            // room. Falls back to inset-0 where the browser can't report it.
            ? "fixed inset-x-0 z-[84] flex flex-col overflow-hidden bg-ink-950 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
            : "mt-2 flex flex-col",
        )}
        style={
          fullBoth
            ? visibleBox
              ? { top: visibleBox.top, height: visibleBox.height }
              : { top: 0, bottom: 0 }
            : undefined
        }
      >

      {/* Seats + Chat header — room identity and the way back. */}
      {fullBoth && (
        <div className="order-first w-full shrink-0 border-b border-white/10 pb-2">
          <div className="flex items-center gap-3">
            <button
              onClick={closeFullBoth}
              title="Back to the room"
              className="grid size-9 shrink-0 place-items-center rounded-full text-mist-300 transition hover:bg-white/[0.06] hover:text-mist-100"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-mist-100">{room.name}</p>
              <p className="text-[11px] text-mist-500">
                Seats &amp; chat · {occupants}/{seatCount} seated · {totalInRoom} in room
              </p>
            </div>
            <button
              onClick={closeFullBoth}
              title="Close"
              className="grid size-9 shrink-0 place-items-center rounded-full text-mist-400 transition hover:bg-white/[0.06] hover:text-mist-100"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
      )}

      {/* Room identity (name / category / seats) — stays at the top. */}
      <div className={cn("order-1 mt-2 flex min-w-0 items-center gap-3", fullBoth && "hidden")}>
        <Avatar name={room.name || room.host.fullName} src={room.image || undefined} size="xl" ring />
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-x-2 gap-y-1 font-display text-2xl font-extrabold text-mist-100">
            {/* Per-room LOGO (appearance) — small badge beside the room name. */}
            {appear.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={appearSrc(appear.logo)} alt="" className="size-7 rounded object-contain" />
            )}
            {room.name}
            {room.type === "private" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-ink-700 px-2 py-0.5 text-[11px] font-semibold text-mist-300">
                <Lock className="size-3" /> Private
              </span>
            )}
            {/* Agency that manages this room — the room owner's agency, shown to
                everyone and separate from the Host role. Auto-updates from the DB;
                tap it to open the agency's profile. */}
            <AgencyBadge name={room.agencyName} id={room.agencyId} />
          </h1>
          {/* Category · seated speakers (out of seats) · TOTAL people in the room
              (speakers + listeners), so users see both at a glance. */}
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-mist-300">
            <span>{room.category}</span>
            <span aria-hidden className="text-mist-500">·</span>
            <span className="inline-flex items-center gap-1"><Mic className="size-3.5 text-emerald-400" /> {occupants}/{seatCount} seated</span>
            <span aria-hidden className="text-mist-500">·</span>
            {/* Tap the count to see EVERYONE connected to the room (speakers +
                listeners), with manage actions for the Host / Co-Hosts. */}
            <button
              onClick={() => setPeopleOpen(true)}
              title="See everyone in this room"
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold text-lotus-200 underline decoration-lotus-400/40 underline-offset-2 transition hover:bg-lotus-500/15 hover:text-lotus-100"
            >
              <Users className="size-3.5 text-lotus-300" /> {totalInRoom} in room
            </button>
          </p>
          {room.description && <p className="mt-1 max-w-xl text-sm text-mist-400">{room.description}</p>}
        </div>
      </div>

      {/* Competition layer — renders ONLY in a Competition Voice Room (returns null
          otherwise, so normal rooms are unaffected). Sits above the menu bar. */}
      <CompetitionPanel roomId={room.id} myId={myId} />

      {/* Top controls menu bar — Games · Gift · Media · Option · Minimize (right
          above the seats). Laid out as a 3-column GRID so the buttons sit on TWO
          rows (client request) and are all visible at once — no side-scrolling. */}
      {/* The room actions are defined ONCE (above the render) so the full-screen
          room view renders exactly the same set — the two can never drift. */}
      {/* ALIGNMENT: the number of buttons here CHANGES with the room — Games,
          Stickers, Gift and Media each appear only when that feature is on, so
          a room shows anywhere from two to seven. Fixed column counts therefore
          left a single button stranded on its own row, or stretched four
          buttons across seven columns with gaps between them. `auto-fit` sizes
          the columns to however many buttons there actually are, so every view
          comes out evenly spaced and the rows always look deliberate. */}
      <div
        className={cn(
          "order-2 grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(5.25rem,1fr))]",
          // "Seats + Chat" on a COMPUTER: one full-width row of options across
          // the top, above both panes — the layout the client approved. On a
          // phone these move into a narrow vertical rail beside the chat
          // instead (see below), which is what buys the chat its height.
          fullBoth ? "mb-3 hidden shrink-0 lg:grid" : "mt-3",
        )}
      >
        {roomActionButtons}
      </div>

      {/* LIVE GAME STRIP — always visible when a game is running: listeners get "Watch",
          seated players get a prominent "Return to Game" so they can jump back in quickly
          after switching to the voice room (client request). */}
      {/* A running game still gets its strip here — it stays reachable from the
          Seats + Chat screen, it just doesn't get to steal height from them. */}
      <div className={cn(fullBoth && "order-2 shrink-0")}>
        <LiveGamesWatch roomId={room.id} spectatorOn={rf.spectatorMode !== false} iAmSeated={iAmSeatedForGames} roomName={room.name} />
      </div>

      {/* ===== Management & config — MOVED BELOW the seats (client request) =====
          Hidden in "Seats + Chat": that screen is deliberately only the two areas
          the client marked, so neither gets squeezed. Everything here is one tap
          away again on closing it. */}
      <div className={cn("order-4 mt-2 flex flex-col", fullBoth && "hidden")}>
      {/* Mute all · Seats · Manage moved UP to sit directly under the seats
          (rendered from `hostQuickControls` in the seat card), so a host no
          longer scrolls past the whole conversation to reach them. */}

      {room.announcement && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-gold-400/30 bg-gold-400/10 px-3.5 py-2.5 text-sm text-gold-200">
          <Megaphone className="mt-0.5 size-4 shrink-0" />
          <span><span className="font-semibold">Announcement:</span> {room.announcement}</span>
        </div>
      )}

      {/* 🎙️ THE HOST HAS INVITED ME UP. This is deliberately the loudest thing on
          the screen and sits ABOVE the "you're listening only" bar — the whole
          complaint was that an invitation never actually reached the listener. */}
      {mySeatInvite && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-400/40 bg-emerald-500/[0.12] px-3.5 py-3 text-sm text-emerald-50">
          <span className="flex min-w-0 items-center gap-2">
            <Hand className="size-4 shrink-0 text-emerald-300" />
            <span className="min-w-0">
              <b>{mySeatInvite.byName}</b> invited you to take a seat.
              <span className="block text-[11px] text-emerald-200/80">Accept and you&apos;ll be moved to a seat straight away — you&apos;ll be able to speak.</span>
            </span>
          </span>
          <span className="flex shrink-0 gap-2">
            <Button size="sm" disabled={inviteBusy} onClick={() => answerSeatInvite(true)}>
              {inviteBusy ? "Joining…" : "Accept & take seat"}
            </Button>
            <Button size="sm" variant="secondary" disabled={inviteBusy} onClick={() => answerSeatInvite(false)}>
              Decline
            </Button>
          </span>
        </div>
      )}

      {/* Member: you're in the audience — take a seat to speak. Shown whenever
          you're not on a seat (both Auto and approval modes). */}
      {showRequestSeat && !mySeatInvite && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-lotus-400/30 bg-lotus-500/10 px-3.5 py-2.5 text-sm text-lotus-100">
          {!mSeat ? (
            <span className="flex items-center gap-2"><Hand className="size-4" /> You&apos;re listening. The host has locked seats — you can&apos;t speak right now.</span>
          ) : myPendingRequest ? (
            <span className="flex items-center gap-2"><Hand className="size-4" /> Waiting for Host/Co-Host approval…</span>
          ) : (
            <>
              <span className="flex items-center gap-2"><Hand className="size-4" /> You&apos;re listening only. Take a seat to speak.</span>
              <Button size="sm" onClick={handleRequestSeat}>{seatIsInstant ? "Take a seat" : "Request a seat"}</Button>
            </>
          )}
        </div>
      )}

      {/* Seat requests moved UP under the seats (rendered from
          `seatRequestsPanel`, which also appears in the full-screen views). */}

      {/* Host/Co-Host: seat invitations THEY have sent and nobody has answered
          yet — so "did my invite go out?" is answerable without guessing. */}
      {canModerate && (room.seatInvites ?? []).length > 0 && (
        <div className="mt-3 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.06] p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-200">
            <UserPlus2 className="size-3.5" /> Seat invitations sent ({(room.seatInvites ?? []).length})
          </p>
          <div className="space-y-1.5">
            {(room.seatInvites ?? []).map((s) => (
              <div key={s.userId} className="flex items-center gap-2 rounded-lg bg-ink-850/70 px-2.5 py-1.5">
                <Avatar name={s.userName} size="xs" />
                <span className="min-w-0 flex-1 truncate text-sm text-mist-100">
                  {s.userName}
                  <span className="block text-[11px] text-mist-500">Waiting for them to accept · invited by {s.byName}</span>
                </span>
                <button
                  onClick={() => cancelSeatInvite(s.userId)}
                  className="rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-mist-300 hover:text-mist-100"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Host / co-host room recording control — shown ONLY when the admin has
          turned room recording ON (Admin → Record Management → Settings → Room
          recording). When it's OFF the whole option is hidden. */}
      {canModerate && room.category !== "Paid Zone" && appConfig.recording?.master === true && appConfig.recording?.roomEnabled === true && rf.audioRecording !== false && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-ink-900/50 px-3.5 py-2.5">
          <span className="flex items-center gap-1.5 text-sm text-mist-300"><span className="text-xs">🔴</span> Record this room&apos;s audio</span>
          <RoomRecorder roomId={room.id} canRecord={canModerate} />
        </div>
      )}

      {/* Host / co-host Reports & Moderation — view reports, warn/kick/block, and
          manage blocked/banned members from one place. */}
      {canModerate && (
        <button onClick={() => setModPanelOpen(true)} className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-ink-900/50 px-3.5 py-2.5 transition hover:border-lotus-400/40">
          <span className="flex items-center gap-1.5 text-sm text-mist-300"><ShieldAlert className="size-4 text-lotus-300" /> Reports &amp; moderation</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-lotus-500/90 px-3 py-1 text-xs font-semibold text-white">Open</span>
        </button>
      )}
      {canModerate && (
        <RoomModerationPanel
          roomId={room.id}
          open={modPanelOpen}
          onClose={() => setModPanelOpen(false)}
          blockedIds={room.blockedMemberIds ?? []}
          kickedIds={room.removedMemberIds ?? []}
          onBlock={blockMember}
          onKick={removeMember}
          onUnblock={unblockMember}
        />
      )}

      {/* "Being recorded" notice — shown only when the admin's Recording Notification
          is ON for this room type, with the admin-editable text. When OFF, no notice
          is shown even though recording continues. */}
      {room.recording && (() => {
        const n = appConfig.recording?.notify;
        if (n?.enabled === false) return null;
        const isComp = (room as { isCompetition?: boolean }).isCompetition;
        const typeOn = room.category === "Paid Zone" ? n?.paidZoneCall
          : isComp ? n?.competition
          : room.type === "private" ? n?.privateRoom
          : n?.voiceRoom;
        if (typeOn === false) return null;
        return (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-200">
            <span className="inline-block size-2.5 shrink-0 animate-pulse rounded-full bg-rose-400" />
            <span><span className="font-semibold">Recording in progress.</span> {n?.text || "This room is being recorded."}</span>
          </div>
        );
      })()}

      {monitorMode && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-lotus-400/40 bg-lotus-500/10 px-3.5 py-2.5 text-sm text-lotus-100">
          <ShieldCheck className="size-4 shrink-0 text-lotus-300" />
          {room.hideAdmins ? (
            <span>
              <span className="font-semibold">Hidden Admin mode.</span> This group is set to <span className="font-semibold">Hide Admin</span>, so members can&apos;t see you in the member list — but you keep full control. Switch it to <span className="font-semibold">Show Admin</span> in Manage room to appear (and speak) normally.
            </span>
          ) : (
            <span><span className="font-semibold">Silent monitor mode.</span> You&apos;re observing as Super Admin — you are not shown as a participant.</span>
          )}
        </div>
      )}

      {/* Host away — shown to everyone (the host seat itself appears empty). */}
      {hostAway && !iAmCoHost && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-200">
          <Info className="size-4 shrink-0" />
          <span><span className="font-semibold">The host is away.</span> A Co-Host may be looking after the room.</span>
        </div>
      )}

      {/* Co-Host control — clear when the host is away you still run the room. */}
      {iAmCoHost && !iAmHost && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-lotus-400/40 bg-lotus-500/10 px-3.5 py-2.5 text-sm text-lotus-100">
          <ShieldCheck className="size-4 shrink-0 text-lotus-300" />
          <span>
            <span className="font-semibold">You&apos;re a Co-Host.</span>{" "}
            {hostAway
              ? "The host is away — you have full control of this room (manage members, media & settings)."
              : "You can manage members, media and room settings."}
          </span>
        </div>
      )}

      {/* MEMBER PERMISSIONS — host/co-host control of what normal members may do.
          Everything is OFF (host & co-hosts only) by default; unlock as needed. */}
      {canManage && room.category !== "Paid Zone" && (
        <MemberPermsPanel
          perms={room.memberPerms ?? {}}
          onToggle={(key, value) => {
            const next = { ...(room.memberPerms ?? {}), [key]: value };
            setRoom({ ...room, memberPerms: next });
            updateRoom(room.id, { memberPerms: next }).then((u) => { if (u) { markRoomMutated(); setRoom(u); } });
            toast(`${PERM_LABEL[key]} ${value ? "unlocked for members" : "locked (host & co-hosts only)"}`, "info");
          }}
        />
      )}

      {/* ADMIN VISIBILITY — platform admins only. Controls whether an admin shows
          up in THIS group's member list. Hidden admins keep every power. */}
      {isAdmin && (
        <AdminVisibilityPanel
          hidden={room.hideAdmins === true}
          onToggle={(hide) => {
            setRoom({ ...room, hideAdmins: hide });
            updateRoom(room.id, { hideAdmins: hide }).then((u) => { if (u) { markRoomMutated(); setRoom(u); } });
            toast(hide ? "Hide Admin ON — admins are invisible to members in this group" : "Show Admin ON — admins appear in the member list", "info");
          }}
        />
      )}

      {/* Paid Zone call — per-minute billing banner + auto-disconnect on empty balance. */}
      {room.category === "Paid Zone" && (
        <PaidZoneCallBilling roomId={room.id} isCaller={room.ownerId === myId} videoCall={!!room.videoUnlocked} />
      )}

      {/* Video panel — only when the admin has unlocked video for this room. */}
      {room.videoUnlocked && appConfig.roomControls?.videoEnabled !== false && rf.videoChat !== false && (
        <RoomVideo
          unlocked
          myId={myId ?? ""}
          iAmHost={canModerate}
          hostId={room.host.id}
          coHostIds={coAdmins}
          cameraOffIds={room.cameraOffIds ?? []}
          videoMembersAllowed={mCam}
          mutedIds={room.mutedMemberIds ?? []}
          onToggleMute={toggleMuteMember}
          onCloseUserCamera={closeUserCamera}
          onToggleMembersVideo={toggleMembersVideo}
          autoStart={room.category === "Paid Zone"}
        />
      )}
      </div>{/* ===== end management & config (order-4) ===== */}

      {/* Seats + chat are grouped so the seat area stays PINNED (sticky) and
          visible while members read/type in the chat — you always see who's
          seated AND the messages together on one screen. The stickiness is
          bounded to this group, so scrolling down to the media/game panels
          releases it normally. */}
      {/* In "Seats + Chat" this same group becomes the two panes SIDE BY SIDE —
          seats on the left, chat on the right — on EVERY screen size, phone
          included. This is the layout the client approved. Stacking them top and
          bottom was tried instead and rejected: it hid seats behind a scroll,
          and the seats are the point of the view. */}
      <div
        className={cn(
          "relative flex",
          fullBoth
            // PHONE: seats become a sticky horizontal strip across the top, then
            // a narrow options rail beside a full-height chat.
            // COMPUTER: unchanged — seats left, chat right, side by side.
            ? "order-3 min-h-0 w-full flex-1 flex-col items-stretch gap-2 overflow-hidden sm:gap-3 lg:flex-row"
            : "order-3 flex-col",
        )}
      >
      {/* SINGLE-SCREEN LAYOUT (client request): the seat stage is PINNED at the top on
          EVERY device (was desktop-only), the group chat sits directly beneath it
          (order-2) so only the message list scrolls, and the secondary panels (mic
          status, media, reconnect, audience) move BELOW the chat (order-3). Result:
          seats + chat + input are visible together and the seats never move. */}
      {/* Admin "above the seats" overlay band (client request) — a separate display
          section that sits ABOVE the seat card, independent of the existing overlays. */}
      <RoomZoneOverlay zone="aboveSeats" roomId={room.id} isHost={canModerate || !!isAdmin} isVip={!!(me as { vip?: boolean })?.vip} className={cn("order-first mt-5", fullBoth && "hidden")} />
      {/* Admin banners / scrolling notice targeted at the INSIDE of a voice room. */}
      <CustomUploads placement="room-marquee" variant="marquee" className={cn("order-first mt-3", fullBoth && "hidden")} />
      <CustomUploads placement="room" className={cn("order-first mt-3", fullBoth && "hidden")} />
      {/* THREE SHAPES, ONE SEAT AREA. In the room it's the pinned card under the
          header; opened full screen it becomes its own screen — room title, ALL
          the room options grouped, and the seat grid given the whole height so
          nothing is squeezed by the chat below; in "Seats + Chat" it's the same
          card again, sharing the screen with the chat. Same seats and same
          buttons in all three, so they can never disagree. */}
      <div
        className={cn(
          fullRoom
            ? "fixed inset-0 z-[85] flex flex-col overflow-y-auto bg-ink-950 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
            : fullBoth
              // PHONE: the seat STRIP at the very top — two compact lines, every
              // seat visible at once, and `shrink-0` so it keeps its exact height
              // no matter what happens below it (including the keyboard opening).
              // COMPUTER: the left-hand seat column of the approved design.
              ? "relative order-1 flex w-full shrink-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-ink-900 p-1.5 lg:h-full lg:min-h-0 lg:w-[38%] lg:rounded-2xl lg:p-4"
              : "relative z-30 order-1 mt-5 overflow-hidden rounded-2xl border border-white/10 bg-ink-900 p-4 shadow-lg shadow-black/20 sticky top-14 sm:top-16 sm:bg-ink-900/95 sm:p-5 sm:backdrop-blur-md",
        )}
        style={!fullRoom && appear.accent ? { borderColor: appear.accent } : undefined}
      >
        {/* Full-screen header — who's room this is, and the way back. */}
        {fullRoom && (
          <div className="mb-3 flex shrink-0 items-center gap-3 border-b border-white/10 pb-3">
            <button
              onClick={() => setFullRoom(false)}
              title="Back to the room"
              className="grid size-9 shrink-0 place-items-center rounded-full text-mist-300 transition hover:bg-white/[0.06] hover:text-mist-100"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-mist-100">{room.name}</p>
              <p className="text-[11px] text-mist-500">
                {room.category} · {occupants}/{seatCount} seated · {totalInRoom} in room
              </p>
            </div>
            <button
              onClick={() => setFullRoom(false)}
              title="Close"
              className="grid size-9 shrink-0 place-items-center rounded-full text-mist-400 transition hover:bg-white/[0.06] hover:text-mist-100"
            >
              <X className="size-5" />
            </button>
          </div>
        )}

        {/* Every room option, in its group — the same buttons as the room screen.
            In "Seats + Chat" these sit in a full-width row ABOVE both panes
            instead (see above), so they are not repeated here. */}
        {fullRoom && (
          // Same auto-fit rule as the normal view, so the full-screen room lays
          // these out identically instead of using its own column count.
          <div className="mb-4 grid shrink-0 gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(5.25rem,1fr))]">{roomActionButtons}</div>
        )}

        {/* Admin overlay set to "cover seats" — fills the whole seat area, behind the seats. */}
        <RoomSeatOverlay roomId={room.id} isHost={canModerate || !!isAdmin} isVip={!!(me as { vip?: boolean })?.vip} />
        {/* Real-time flash (joins, chat, activity) right over the seating area. */}
        <RoomFlash roomId={room.id} myId={myId} />
        {/* Broadcasts gifts so the burst animates on the receiver's avatar for everyone. */}
        {rf.giftAnimation !== false && <RoomGiftListener roomId={room.id} />}
        {reactions.map((r) => (
          <span
            key={r.id}
            className="pointer-events-none absolute bottom-4 z-10 text-3xl"
            style={{ left: `${r.left}%`, animation: "lotus-float-up 2.2s ease-out forwards" }}
          >
            {r.emoji}
          </span>
        ))}

        {/* Cap the seat grid so a very full room still leaves the chat visible
            below the pinned seats; small rooms never reach this and don't scroll.
            Extra TOP padding (pt-7) + slightly larger row gap so a purchased avatar
            FRAME — which extends above the photo — is fully visible and never
            overlaps the controls above or the seat rows (client request). */}
        {/* Full screen: the grid takes the leftover height and gets more columns,
            so a full room is readable instead of scrolling inside a small box. */}
        <div
          className={cn(
            // `items-start` keeps every seat anchored to the top of its cell, so
            // a row of seats reads as one straight line instead of each seat
            // floating at a different height.
            "grid items-start px-1",
            // The generous top padding and row gap exist so a purchased avatar
            // FRAME (which sticks out above the photo) is never clipped. The
            // compact phone strip has no frames big enough to need it, so it
            // uses tight spacing instead — that padding was most of its height.
            fullRoom
              ? "mt-2 min-h-0 flex-1 grid-cols-3 gap-x-3 gap-y-4 overflow-y-auto pt-6 sm:grid-cols-5 sm:gap-y-7 sm:pt-7 lg:grid-cols-6"
              : fullBoth
                // PHONE: TWO compact lines, every seat visible, no scrolling.
                // Seats now read LEFT TO RIGHT (the column count is set inline
                // below), so seat 1 is the Host and seat 2 — the Co-Host — sits
                // BESIDE them. Filling down columns instead put the Co-Host
                // underneath the Host, which is what was reported.
                // COMPUTER: the usual grid, scrolling down inside its column.
                ? "shrink-0 gap-x-1 gap-y-1 overflow-hidden pt-1 lg:mt-2 lg:min-h-0 lg:flex-1 lg:grid-cols-4 lg:gap-x-3 lg:gap-y-7 lg:overflow-y-auto lg:pt-7"
                : "mt-2 max-h-[26vh] grid-cols-4 gap-x-3 gap-y-4 overflow-y-auto pt-6 sm:max-h-[44vh] sm:grid-cols-5 sm:gap-y-7 sm:pt-7",
          )}
          // TWO ROWS, WHATEVER THE ROOM SIZE. Half the seats per row means the
          // first row always starts Host, Co-Host — side by side. Set inline
          // because the number depends on the room (an 8-seat room needs 4
          // columns, a 12-seat room needs 6) and a class name built by joining
          // strings together is never generated by the stylesheet. At least two
          // columns, so even a 2-seat room puts them beside each other rather
          // than stacked. Phone only — the computer layout keeps its own grid.
          style={
            fullBoth && !isLargeScreen
              ? { gridTemplateColumns: `repeat(${Math.max(2, Math.ceil(seats.length / 2))}, minmax(0, 1fr))` }
              : undefined
          }
        >
          {seats.map((seat, i) => {
            // With live voice, "me" is identified by user id (I appear as a real
            // participant). In the demo build, my seat is the one I picked.
            const isMine = liveVoice ? !!seat.user && seat.user.id === myId : mySeat === i;
            const occupant = liveVoice ? seat.user : isMine ? me : seat.user;
            const vp = liveVoice && occupant ? voiceById.get(occupant.id) : undefined;
            const speaking = liveVoice
              ? !!vp?.isSpeaking
              : isMine
                ? !muted && micLevel > 0.08
                : speakingId === occupant?.id;
            const level = liveVoice ? (speaking ? 0.6 : 0) : isMine ? micLevel : speaking ? 0.6 : 0;
            const isCoHostSeat = !!occupant && coAdmins.includes(occupant.id);
            const modMuted = !!occupant && mutedMembers.includes(occupant.id);
            const seatMuted = liveVoice ? (isMine ? muted : !!vp?.muted) : isMine ? muted : true;
            // Host & Co-Hosts can manage anyone seated except themselves and the Host.
            const canManageThis = canManage && !!occupant && !isMine && occupant.id !== room.host.id;
            return (
              <Seat
                key={i}
                role={seat.role}
                isCoHost={isCoHostSeat}
                occupant={occupant}
                agency={occupant ? agencyByUser.get(occupant.id) : undefined}
                isMine={isMine}
                muted={seatMuted}
                mutedByMod={modMuted}
                speakerOff={!!occupant && !isMine && voice.isSpeakerOff(occupant.id)}
                speaking={speaking && !modMuted}
                level={level}
                canJoin={!seat.user && seat.role === "member" && ((!iAmHost && !iAmCoHost && !iAmOnSeat && mySeat === null) || canManage)}
                onJoin={() => setSeatSheetIdx(i)}
                canManageThis={canManageThis}
                canView={!!occupant && !isMine}
                onManage={() => { if (occupant) { setManageTarget(occupant); setManageFromChat(false); } }}
                onSelf={isMine ? () => setSelfMenuOpen(true) : undefined}
                awayHost={seat.role === "host" && !occupant && hostAway && !iAmHost ? { name: host.fullName, avatar: host.avatar } : undefined}
                // Small two-line strip on a phone in Seats + Chat; full size everywhere else.
                compact={fullBoth && !isLargeScreen}
              />
            );
          })}
        </div>

        {/* Who's speaking now — right under the seats (the controls menu bar
            lives at the TOP of the room, above the seats). */}
        {/* WHO IS SPEAKING — shown in EVERY view, including Seats + Chat on a
            phone, where it used to be hidden to save space. The name is never
            truncated now: on a narrow screen the line takes the full width and
            the full-screen buttons drop to their own row beneath it, instead of
            all three fighting over one row and clipping the name to "srikavin
            is spe…". */}
        <div
          className={cn(
            "flex min-w-0 border-t border-white/10 text-xs",
            // Its own line first, buttons under it; side by side once there's room.
            "flex-col items-start gap-2 sm:flex-row sm:items-center",
            (fullRoom || fullBoth) && "shrink-0",
            // Tighter inside the compact phone strip so it costs almost no height.
            fullBoth ? "mt-1.5 pt-1.5" : "mt-4 pt-3",
          )}
        >
          <span className="flex min-w-0 max-w-full items-center gap-2">
            {speakingName ? (
              <>
                <span className="relative flex size-2.5 shrink-0">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/70" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" />
                </span>
                <span className="min-w-0 text-emerald-300">
                  <span className="font-semibold">{speakingName}</span> is speaking…
                </span>
              </>
            ) : (
              <span className="flex items-center gap-1.5 text-mist-400"><Volume2 className="size-3.5 shrink-0" /> No one is speaking</span>
            )}
          </span>
          {/* THREE full-screen choices, all kept side by side (client request):
              the seats alone, the chat alone, or both together. */}
          {!fullRoom && !fullBoth && (
            <span className="flex shrink-0 flex-wrap items-center gap-1.5 sm:ml-auto">
              <button
                onClick={() => setFullRoom(true)}
                title="Open the seats and room options in full screen"
                className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-mist-300 transition hover:bg-white/[0.12] hover:text-mist-100"
              >
                <Maximize2 className="size-3" /> Full screen
              </button>
              <button
                onClick={openFullBoth}
                title="Open the seats and the chat together on one screen"
                className="inline-flex items-center gap-1 rounded-full bg-lotus-500/15 px-2.5 py-1 text-[11px] font-semibold text-lotus-200 transition hover:bg-lotus-500/25 hover:text-lotus-100"
              >
                <Columns2 className="size-3" /> Seats + Chat
              </button>
            </span>
          )}
        </div>

        {/* SEAT REQUESTS — directly under the seats, in EVERY view including the
            full-screen ones, so a host can approve someone without leaving the
            screen they are on. Renders nothing when there are no requests, which
            is why it costs no space in the compact phone strip. */}
        {seatRequestsPanel && <div className="mt-2 shrink-0">{seatRequestsPanel}</div>}

        {/* Host controls and the listener list join them in the full-screen
            SEATS view, which has the room for them. */}
        {fullRoom && hostQuickControls && <div className="mt-2 shrink-0">{hostQuickControls}</div>}
        {fullRoom && audiencePanel && <div className="mt-2 shrink-0 overflow-y-auto">{audiencePanel}</div>}

        {/* Mute / unmute stays reachable inside the full-screen views — the
            overlay covers the room's own mic bar. On a phone in Seats + Chat it
            lives at the foot of the options rail instead (see below). */}
        {fullRoom && <div className="shrink-0">{micStatusButton}</div>}
        {fullBoth && <div className="hidden shrink-0 lg:block">{micStatusButton}</div>}
      </div>

      {/* ===== Directly under the seats, in the NORMAL room view =====
          Who is listening, then the host's controls — the client asked for both
          to sit beside the seats rather than below the whole conversation. In
          the full-screen views these render inside the seat card above. */}
      {!fullRoom && !fullBoth && (audiencePanel || hostQuickControls) && (
        <div className="order-1 mt-3 flex flex-col gap-3">
          {audiencePanel}
          {hostQuickControls}
        </div>
      )}

      {/* Secondary panels (mic status, media, reconnect, audience) — moved BELOW the
          chat (order-3) so the seats + chat + input sit together on one screen.
          Hidden in "Seats + Chat" — that screen is only the two marked areas. */}
      <div className={cn("order-3 flex flex-col", fullBoth && "hidden")}>
      {/* Clear, always-visible MIC STATUS + one-tap toggle. Defined ONCE above
          the render (micStatusButton) so every full-screen view keeps it. */}
      {micStatusButton}

      {/* "Now playing" music player — sits right under the live/mic bar (client
          request), above Group chat. ALWAYS mounted so audio keeps playing for
          everyone even while the Media menu is closed; renders nothing when idle. */}
      {room.media && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-ink-850/60 px-4 pb-3 pt-1">
          <MediaPanel {...mediaProps} part="player" />
        </div>
      )}

      {/* Explicit "Enable Microphone" button — asks the device for mic permission
          on a real tap. Stays out of the way once mic access is already granted,
          but is prominent (and retryable) for anyone who needs to grant it. */}
      <EnableMicButton className="mt-2" hideWhenGranted />

      {/* RECONNECT VOICE — restore audio without leaving the room or the seat, so a
          user with a stalled mic / dropped connection never has to exit + rejoin. */}
      {liveVoice && (
        <button
          onClick={() => { void voice.reconnectVoice(); }}
          title="Restart the voice connection without leaving the room"
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-xs font-semibold text-mist-300 transition hover:bg-white/[0.1] hover:text-mist-100"
        >
          <RefreshCw className="size-3.5" /> Reconnect voice
        </button>
      )}

      {/* Mobile-browser users: install the app for uninterrupted background voice. */}
      {liveVoice && <div className="mt-2"><VoiceBgTip /></div>}


      {/* The listener list moved UP to sit directly under the seats
          (rendered from `audiencePanel` in the seat card). */}

      </div>{/* end secondary panels */}

      {/* Group text chat — pinned directly under the fixed seats (order-2). Only the
          message list scrolls; the seats never move while you read or type.
          In "Seats + Chat" it becomes the second pane and takes the rest of the
          height beside (or below) the seats. */}
      {/* PHONE ONLY: a narrow options rail beside the chat, so the buttons cost
          almost no height and the conversation gets the screen. `lg:contents`
          makes this wrapper disappear on a computer, leaving the chat as a direct
          sibling of the seat column — i.e. the approved side-by-side design. */}
      <div className={cn(fullBoth ? "order-2 flex min-h-0 min-w-0 flex-1 gap-2 lg:contents" : "contents")}>
        {fullBoth && (
          <div className="room-rail flex w-[4.5rem] shrink-0 flex-col gap-1.5 overflow-y-auto overscroll-contain pb-1 lg:hidden">
            {roomActionButtons}
            {/* Mute / unmute, pinned at the foot of the rail. */}
            {micStatusButton}
          </div>
        )}
      <div className={cn(fullBoth ? "flex h-full min-h-0 min-w-0 flex-1 flex-col" : "order-2")}>
      <RoomChat
        roomId={room.id}
        myId={myId}
        meName={me.fullName}
        locked={chatLocked}
        canManage={canModerate}
        manualLocked={room.chatLockedNow === true}
        autoLockChat={room.autoLockChat !== false}
        onToggleManualLock={async () => {
          const next = !(room.chatLockedNow === true);
          setRoom({ ...room, chatLockedNow: next });
          const u = await updateRoom(room.id, { chatLockedNow: next });
          if (u) setRoom(u);
          toast(next ? "Chat locked — only the host & co-hosts can post now." : "Chat unlocked — members can chat again.", "info");
        }}
        onToggleAutoLock={async () => {
          const next = room.autoLockChat === false; // OFF→ON, ON→OFF
          setRoom({ ...room, autoLockChat: next });
          const u = await updateRoom(room.id, { autoLockChat: next });
          if (u) setRoom(u);
          toast(
            next
              ? "Auto-lock ON — the group chat locks for members whenever no host/co-host is in the room."
              : "Auto-lock OFF — members can always send messages.",
            "info",
          );
        }}
        onOpenUser={(u) => { setManageTarget(u); setManageFromChat(true); }}
        giftButton={rf.virtualGifts !== false ? <GiftButton recipients={giftRecipients} roomId={room.id} compact className="shrink-0 !rounded-full !px-3 !py-2.5" /> : undefined}
        onSticker={mChat && rf.stickers !== false ? () => setStickersOpen(true) : undefined}
        fullScreen={chatFullScreen}
        fill={fullBoth}
        onToggleFullScreen={() => setChatFullScreen((v) => !v)}
        onOpenBoth={openFullBoth}
        roomName={room.name}
        peopleCount={totalInRoom}
      />
      </div>{/* end chat wrapper */}
      </div>{/* end rail + chat row (lg:contents — gone on a computer) */}
      {/* Admin "below the group chat" overlay band (client request) — a separate display
          section directly under the chat, with its own optional close button. order-2
          keeps it right after the chat (order-2) and above the order-3 side panels. */}
      <RoomZoneOverlay zone="belowChat" roomId={room.id} isHost={canModerate || !!isAdmin} isVip={!!(me as { vip?: boolean })?.vip} className={cn("order-2 mt-3", fullBoth && "hidden")} />
      </div>
      </div>{/* ===== end room flow wrapper (title · menu · seats · config) ===== */}

      {/* Live room activity — HOST / CO-HOST / ADMIN only. Regular members get
          the lightweight flash notifications (RoomFlash) instead. */}
      {canModerate && (
        <RoomActivity
          roomId={room.id}
          online={occupants + audienceList.length}
          speakers={occupants}
          listeners={audienceList.length}
          speakingNow={liveVoice
            ? (voice.participants.find((p) => p.isSpeaking)?.name.split(" ")[0] ?? null)
            : typeof speakingId === "string" ? (memberPool.find((m) => m.id === speakingId)?.fullName.split(" ")[0] ?? null) : null}
          canSeeHistory={canModerate}
        />
      )}

      {/* Status note */}
      <p className="mt-4 flex items-start gap-2 rounded-xl bg-lotus-500/10 px-3.5 py-2.5 text-xs text-lotus-200/90">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        {liveVoice
          ? (voice.connected
              ? "Live voice is on — everyone in this room hears each other in real time. Tap Unmute to talk."
              : "Connecting to live voice…")
          : "Preview: your own mic and media playback are real. Hearing other people across devices turns on once live voice is connected."}
      </p>

      {/* Reaction bar (the Gift option now lives under the seats, above). */}
      {rf.emoji !== false && (
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {REACTIONS.map((e) => (
          <button
            key={e}
            onClick={() => react(e)}
            className="grid size-11 place-items-center rounded-full bg-ink-800 text-xl transition hover:scale-110 hover:bg-ink-700 active:scale-95"
          >
            {e}
          </button>
        ))}
      </div>
      )}

      {/* Audio playback blocked by the browser → one tap enables sound. */}
      {liveVoice && voice.audioBlocked && (
        <button
          onClick={() => voice.startAudio()}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/15 px-4 py-3 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/25"
        >
          🔊 Tap to enable sound — so you can hear everyone
        </button>
      )}
      {/* micError means the mic track could not be published. That is usually the
          hardware being busy or suspended — NOT a permission denial — so this no
          longer tells people to go and change a setting that is already correct.
          It offers the action that actually fixes it. */}
      {liveVoice && voice.micError && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-2.5 text-center text-xs text-rose-200">
          <MicOff className="size-4 shrink-0" />
          <span>Your microphone didn&apos;t start. It may be in use by another app, or it went to sleep in the background.</span>
          <button
            onClick={() => { void voice.reconnectVoice(); }}
            className="rounded-full bg-rose-500/25 px-3 py-1 font-bold text-rose-100 transition hover:bg-rose-500/40"
          >
            Try again
          </button>
        </div>
      )}
      {iAmMuted && (
        <p className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-2.5 text-center text-xs text-rose-200">
          <MicOff className="size-4" /> You have been muted by the host. Your mic is off until they unmute you.
        </p>
      )}
      {mutedNoModerator && !iAmMuted && (
        <p className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-2.5 text-center text-xs text-amber-200">
          <Info className="size-4" /> The host and co-host have left. You&apos;ll be able to speak again once a host or co-host is in the room.
        </p>
      )}

      {/* Control bar.
          Live voice: a clean hint — your own options (mute / photo / leave) live
          in the menu that opens when you tap YOUR seat. Demo build keeps buttons. */}
      {liveVoice ? (
        !iAmOnSeat && !iAmHost && !iAmCoHost ? (
          // AUDIENCE control bar — you're listening only. Take a seat to speak, or
          // leave. (Audience members have no seat photo to tap for options.)
          <div className="sticky bottom-4 mt-5 flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-ink-850/90 p-3 backdrop-blur">
            {mSeat ? (
              <Button onClick={handleRequestSeat} disabled={myPendingRequest}>
                <Hand className="size-4" /> {myPendingRequest ? "Waiting for approval…" : seatIsInstant ? "Take a seat to speak" : "Request a seat"}
              </Button>
            ) : (
              <span className="px-2 text-xs text-mist-400">🔒 Seats are locked — you&apos;re listening only.</span>
            )}
            <Button variant="danger" onClick={() => setConfirmLeave(true)}>
              <LogOut className="size-4" /> Leave
            </Button>
          </div>
        ) : (
          <div className="sticky bottom-4 mt-5 flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-ink-850/90 px-4 py-3 text-center text-xs text-mist-400 backdrop-blur">
            <Settings className="size-3.5 shrink-0 text-lotus-300" />
            Tap <span className="font-semibold text-mist-200">your photo</span> on the stage for your options — mute, leave seat &amp; more.
          </div>
        )
      ) : (
        <div className="sticky bottom-4 mt-5 flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-ink-850/90 p-3 backdrop-blur">
          {mySeat !== null ? (
            <Button
              variant={muted ? "secondary" : "primary"}
              onClick={() => { setMuted(!muted); setMicDenied(false); }}
            >
              {muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
              {muted ? "Unmute" : "Mute"}
            </Button>
          ) : (
            <Button
              variant={raised ? "secondary" : "outline"}
              onClick={() => {
                setRaised(true);
                const empty = seats.findIndex((s, i) => s.role === "member" && !s.user && i >= 2);
                setTimeout(() => takeSeat(empty === -1 ? 2 : empty), 900);
              }}
              disabled={raised}
            >
              <Hand className="size-4" />
              {raised ? "Joining…" : "Request a seat"}
            </Button>
          )}
          <Button variant="secondary" onClick={() => setPhotoOpen(true)} title="Change your profile photo">
            <ImagePlus className="size-4" /> Photo
          </Button>
          <Button variant="danger" onClick={() => setConfirmLeave(true)}>
            <LogOut className="size-4" /> Leave
          </Button>
        </div>
      )}

      {/* Your own options — opens when you tap your seat (live voice). */}
      {selfMenuOpen && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={() => setSelfMenuOpen(false)}>
          <div className="w-full max-w-sm rounded-t-2xl border border-white/10 bg-ink-850 p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center gap-3 border-b border-white/8 pb-3">
              <Avatar name={me.fullName} src={me.avatar} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-mist-100">{me.fullName}</p>
                <p className="text-xs text-mist-400">You</p>
              </div>
              <button onClick={() => setSelfMenuOpen(false)} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
            </div>
            <div className="mt-2 space-y-0.5">
              {!iAmOnSeat && !iAmHost && !iAmCoHost ? (
                // Audience (listen-only) — the mic is unavailable; they must take
                // a seat to speak. Tapping this starts the take-a-seat flow.
                <button
                  disabled={!mSeat}
                  onClick={() => { setSelfMenuOpen(false); handleRequestSeat(); }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-lotus-200 transition hover:bg-white/[0.06] disabled:opacity-50"
                >
                  <Hand className="size-[18px] text-lotus-300" />
                  {!mSeat ? "Seats locked by host" : seatIsInstant ? "Take a seat to speak" : "Request a seat to speak"}
                </button>
              ) : (
                <button
                  disabled={amForceMuted}
                  onClick={() => { if (amForceMuted) return; setMuted(!muted); setMicDenied(false); voice.startAudio(); setSelfMenuOpen(false); }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-mist-200 transition hover:bg-white/[0.06] disabled:opacity-50"
                >
                  {muted || amForceMuted ? <MicOff className="size-[18px] text-mist-300" /> : <Mic className="size-[18px] text-emerald-300" />}
                  {mutedNoModerator && !iAmMuted ? "Waiting for a host or co-host" : iAmMuted ? "Muted by host" : muted ? "Unmute my mic" : "Mute my mic"}
                </button>
              )}
              {/* Seated members (not host/co-host) can step down to the audience. */}
              {iAmOnSeat && !iAmHost && !iAmCoHost && (
                <button
                  onClick={() => { setSelfMenuOpen(false); handleLeaveSeat(); }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-mist-200 transition hover:bg-white/[0.06]"
                >
                  <MicOff className="size-[18px] text-amber-300" /> Leave seat (listen only)
                </button>
              )}
              <button
                onClick={() => { setSelfMenuOpen(false); setPhotoOpen(true); }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-mist-200 transition hover:bg-white/[0.06]"
              >
                <ImagePlus className="size-[18px] text-lotus-300" /> Profile photo
              </button>
              {/* Keep the voice room running while the phone is locked / the app
                  is in the background. OFF = the mic is freed for other apps. */}
              <button
                onClick={() => voice.setBgVoice(!voice.bgVoice)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-mist-200 transition hover:bg-white/[0.06]"
              >
                <Volume2 className="size-[18px] text-sky-300" />
                <span className="flex-1 leading-tight">
                  Keep voice in background
                  <span className="block text-[11px] font-normal text-mist-400">
                    {voice.bgVoice ? "Voice keeps running when you lock/switch apps" : "Mic is freed for other apps when you leave"}
                  </span>
                </span>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold", voice.bgVoice ? "bg-emerald-500/20 text-emerald-300" : "bg-ink-800 text-mist-400")}>
                  {voice.bgVoice ? "ON" : "OFF"}
                </span>
              </button>
              <button
                onClick={() => { setSelfMenuOpen(false); setConfirmLeave(true); }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-rose-300 transition hover:bg-rose-500/10"
              >
                <LogOut className="size-[18px]" /> Leave group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty-seat action sheet — opens when anyone taps a free "+" seat. A
          listener gets "Take this seat" (works in live voice too, which the bare +
          used to ignore); a host / co-host gets quick invite + manage actions, so
          the + is never a dead tap. */}
      {seatSheetIdx !== null && (() => {
        // Am I already able to speak from a seat? Host, co-hosts and any approved
        // speaker are. A LISTENER (in the room but not on a seat) is not — they are
        // the ones who take a seat. The seat action is shown to EVERYONE except the
        // fixed host (seat 1) so the "Take seat" option is never missing: a listener
        // gets a working Take/Request; an already-seated user gets a clear note.
        const iAmSeated = iAmHost || iAmCoHost || iAmOnSeat || mySeat !== null;
        const iCanTakeSeat = !iAmSeated;
        const showSeatAction = !iAmHost;
        return (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={() => setSeatSheetIdx(null)}>
          <div className="w-full max-w-sm rounded-t-2xl border border-white/10 bg-ink-850 p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center gap-3 border-b border-white/8 pb-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-dashed border-lotus-400/50 text-lotus-300"><Plus className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-mist-100">Seat {seatSheetIdx + 1}</p>
                <p className="text-xs text-mist-400">{iCanTakeSeat ? (!mSeat ? "Seat-taking is locked" : seatIsInstant ? "Join instantly and speak" : "The host approves seat requests") : iAmSeated ? "You already have a speaking seat" : "This seat is open"}</p>
              </div>
              <button onClick={() => setSeatSheetIdx(null)} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
            </div>
            <div className="space-y-0.5">
              {showSeatAction && (
                <button
                  disabled={iAmSeated || !mSeat || myPendingRequest}
                  onClick={() => {
                    if (iAmSeated) return; // already a speaker — nothing to take
                    const idx = seatSheetIdx;
                    setSeatSheetIdx(null);
                    if (liveVoice) handleRequestSeat();
                    else if (idx !== null) takeSeat(idx);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-lotus-200 transition hover:bg-white/[0.06] disabled:opacity-60"
                >
                  <Hand className="size-[18px] text-lotus-300" />
                  {iAmSeated
                    ? "You already have a seat — you can speak"
                    : !mSeat
                      ? "Seats are locked by the host"
                      : myPendingRequest
                        ? "Seat request pending…"
                        : seatIsInstant
                          ? "Take this seat"
                          : "Request this seat"}
                </button>
              )}
              {canManage && (
                <div className="rounded-xl px-1 py-1">
                  <p className="mb-1 px-2 text-[11px] font-semibold text-mist-400">Invite someone to this seat</p>
                  <RoomInviteFriends roomId={room.id} variant="row" />
                </div>
              )}
              <button
                onClick={() => setSeatSheetIdx(null)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-mist-300 transition hover:bg-white/[0.06]"
              >
                <X className="size-[18px] text-mist-400" /> Cancel
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {photoOpen && <RoomPhotoEditor onClose={() => setPhotoOpen(false)} />}

      {confirmLeave && (
        <ConfirmDialog
          title="Leave this room?"
          message="You'll leave the group room. Any game in progress keeps your spot saved, and you can rejoin anytime."
          confirmLabel="Leave room"
          cancelLabel="Stay"
          danger
          onConfirm={async () => {
            setConfirmLeave(false);
            // If I own the now-playing media, stop it for everyone as I leave.
            if (room.media?.ownerId === myId) await setRoomMedia(room.id, null);
            await voice.leave();
            router.push("/rooms");
          }}
          onCancel={() => setConfirmLeave(false)}
        />
      )}

      {micDenied && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200">
          <MicOff className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 flex-1">
            <b>Microphone is blocked for this site.</b> Set Microphone to <b>Allow</b> in your browser&apos;s site settings
            (or <b>Settings → Apps → this browser → Permissions → Microphone</b>), then <b>reload this page</b> —
            a permission you change while the page is open doesn&apos;t reach it until it reloads.
            <button onClick={() => window.location.reload()} className="ml-2 rounded-full bg-rose-500/25 px-2.5 py-0.5 font-bold text-rose-100 hover:bg-rose-500/40">
              Reload now
            </button>
          </span>
        </div>
      )}

      {/* One-room-at-a-time conflict */}
      {joinBlock && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-ink-850 p-5 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-rose-500/15 text-rose-300">
              <Lock className="size-6" />
            </span>
            <h2 className="mt-3 font-display text-lg font-bold text-mist-100">Switch voice room?</h2>
            <p className="mt-2 text-sm text-mist-300">
              You are currently connected to another voice room. Joining this room will automatically
              exit your current room. Do you want to continue?
            </p>
            <div className="mt-4 flex gap-2">
              <Button block variant="secondary" onClick={() => router.push("/rooms")}>
                Cancel
              </Button>
              <Button
                block
                onClick={async () => {
                  await voice.retryJoin();
                  toast("You have left the previous room and joined this room successfully.", "success");
                }}
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Per-member manage menu (tap a member on the stage) */}
      {manageTarget && (
        <MemberManageMenu
          member={manageTarget}
          roomId={room.id}
          myId={myId}
          fromChat={manageFromChat}
          iAmHost={iAmHost}
          isCoHost={coAdmins.includes(manageTarget.id)}
          isMuted={mutedMembers.includes(manageTarget.id)}
          speakerOff={voice.isSpeakerOff(manageTarget.id)}
          isBlocked={(room.blockedMemberIds ?? []).includes(manageTarget.id)}
          inAudience={audienceMembers.includes(manageTarget.id)}
          // Are they on a seat right now? Drives whether "Invite" offers them a
          // SEAT (they're here, listening) or invites them to the room at all.
          targetSeated={
            manageTarget.id === room.host.id ||
            coAdmins.includes(manageTarget.id) ||
            ((room.stageApprovedIds ?? []).includes(manageTarget.id) && !audienceMembers.includes(manageTarget.id))
          }
          seatInvited={(room.seatInvites ?? []).some((s) => s.userId === manageTarget.id)}
          mediaAllowed={(room.mediaAllowedIds ?? []).includes(manageTarget.id)}
          // A co-host can't act on the room's own host, but a platform ADMIN can —
          // admin outranks the host, including on the host themselves.
          canManage={canModerate && (!!isAdmin || manageTarget.id !== room.host.id)}
          onClose={() => setManageTarget(null)}
          onToggleMute={() => toggleMuteMember(manageTarget.id)}
          onToggleSpeaker={() => toggleSpeakerFor(manageTarget.id)}
          onToggleMedia={() => { toggleMediaAllowed(manageTarget.id); setManageTarget(null); }}
          onToggleAudience={() => toggleAudience(manageTarget.id)}
          onToggleCoHost={() => setCoHost(manageTarget.id, !coAdmins.includes(manageTarget.id))}
          onRemove={() => {
            removeMember(manageTarget.id);
            setManageTarget(null);
          }}
          onToggleBlock={() => {
            if ((room.blockedMemberIds ?? []).includes(manageTarget.id)) unblockMember(manageTarget.id);
            else blockMember(manageTarget.id);
            setManageTarget(null);
          }}
        />
      )}

      {/* EVERYONE connected to the room — opened by tapping the "N in room" count.
          Shows speakers AND listeners (not just people on a seat) so the Host /
          Co-Host can see and manage every connected user. */}

      {/* Group sticker collection — every member can send; only the host and
          co-hosts can add or remove (the server enforces that too). */}
      {stickersOpen && (
        <StickerPanel
          roomId={room.id}
          canManage={canModerate}
          onClose={() => setStickersOpen(false)}
        />
      )}

      {peopleOpen && (
        <div className="fixed inset-0 z-[70] grid place-items-end bg-black/60 sm:place-items-center sm:p-4" onClick={() => setPeopleOpen(false)}>
          <div className="w-full max-w-md rounded-t-2xl border border-white/10 bg-ink-850 p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100">
                <Users className="size-5 text-lotus-300" /> People in this room
                <span className="rounded-full bg-lotus-500/15 px-2 py-0.5 text-xs font-bold text-lotus-200">{peopleInRoom.length}</span>
              </h2>
              <button onClick={() => setPeopleOpen(false)} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-mist-300 transition hover:bg-white/20"><X className="size-4" /></button>
            </div>
            <div className="max-h-[60vh] space-y-1.5 overflow-y-auto">
              {peopleInRoom.map(({ user: u, role }) => {
                const isMe = u.id === myId;
                const canManageThis = canManage && !isMe && u.id !== room.host.id;
                return (
                  <div key={u.id} className="flex items-center gap-2.5 rounded-xl border border-line bg-ink-800 px-3 py-2">
                    <Avatar name={u.fullName} src={u.avatar} size="sm" frameImage={framesOnIn(appConfig, "voiceRoom") && u.equippedFrame ? frameImageOf(appConfig, u.equippedFrame) : undefined} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-mist-100">{u.fullName}{isMe && <span className="ml-1 text-xs text-lotus-300">(You)</span>}</div>
                      <div className="text-[11px] text-mist-400">
                        {u.publicId && <span className="mr-1.5 font-mono text-mist-500">ID {u.publicId}</span>}
                        {role}
                      </div>
                    </div>
                    {/* 🔊 Speaker Off / On — local to my device, open to everyone. */}
                    {!isMe && (
                      <button
                        onClick={() => toggleSpeakerFor(u.id)}
                        title={voice.isSpeakerOff(u.id) ? `Speaker On — hear ${u.fullName.split(" ")[0]} again` : `Speaker Off — stop hearing ${u.fullName.split(" ")[0]} on this device`}
                        aria-label={voice.isSpeakerOff(u.id) ? "Speaker On" : "Speaker Off"}
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-lg transition",
                          voice.isSpeakerOff(u.id) ? "bg-rose-500/15 text-rose-300 hover:bg-rose-500/25" : "bg-white/[0.06] text-mist-300 hover:bg-white/12 hover:text-mist-100",
                        )}
                      >
                        {voice.isSpeakerOff(u.id) ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                      </button>
                    )}
                    {canManageThis && (
                      <Button size="sm" variant="secondary" onClick={() => { setPeopleOpen(false); setManageFromChat(false); setManageTarget(u); }}>
                        <Settings className="size-3.5" /> Manage
                      </Button>
                    )}
                  </div>
                );
              })}
              {peopleInRoom.length === 0 && <p className="py-6 text-center text-sm text-mist-500">No one is connected right now.</p>}
            </div>
            <p className="mt-3 text-[11px] text-mist-500">Everyone connected is listed — people on a seat and listeners. Tap <b>Manage</b> to mute, make a listener, or remove someone from the room. The <b>🔊 speaker</b> button silences someone on <b>your device only</b> — their mic stays on and everyone else still hears them.</p>
          </div>
        </div>
      )}

      {/* Admin management */}
      {manageOpen && (
        <ManageRoomModal
          room={room}
          members={displayMembers.filter((m) => m.id !== room.host.id)}
          mutedMembers={mutedMembers}
          removedMembers={removedMembers}
          coAdmins={coAdmins}
          // Every co-host resolved to a name/avatar (present or not) so the Host
          // can remove ANY co-host from the Manage panel even off-seat/offline.
          coHostList={coAdmins.map((cid) => {
            const m = liveMembers.find((x) => x.id === cid);
            const prof = memberProfiles[cid];
            return { id: cid, fullName: m?.fullName || prof?.fullName || "Co-Host", avatar: m?.avatar || prof?.avatar || "", present: !!m };
          })}
          onClose={() => setManageOpen(false)}
          onSaved={(r) => setRoom(r)}
          onDelete={() => {
            setManageOpen(false);
            setConfirmDelete(true);
          }}
          onMute={toggleMuteMember}
          speakerOffIds={voice.speakerOff}
          onToggleSpeaker={toggleSpeakerFor}
          onRemove={removeMember}
          onPromote={(id) => setCoHost(id, !coAdmins.includes(id))}
          canDelete={iAmHost || (!!isAdmin && !!monitorMode)}
          iAmAdmin={!!isAdmin}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          danger
          title="Delete this room?"
          message="This permanently deletes the room for everyone. This cannot be undone."
          confirmLabel="Delete room"
          cancelLabel="Cancel"
          onConfirm={async () => {
            await deleteRoom(room.id);
            router.push("/rooms");
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

function ManageRoomModal({
  room,
  members,
  mutedMembers,
  removedMembers,
  coAdmins,
  coHostList,
  onClose,
  onSaved,
  onDelete,
  onMute,
  speakerOffIds,
  onToggleSpeaker,
  onRemove,
  onPromote,
  canDelete,
  iAmAdmin,
}: {
  room: RoomView;
  members: SpeakerUser[];
  mutedMembers: string[];
  removedMembers: string[];
  coAdmins: string[];
  coHostList: { id: string; fullName: string; avatar: string; present: boolean }[];
  onClose: () => void;
  onSaved: (r: RoomView) => void;
  onDelete: () => void;
  onMute: (id: string) => void;
  speakerOffIds: string[]; // people silenced on MY device (local only)
  onToggleSpeaker: (id: string) => void;
  onRemove: (id: string) => void;
  onPromote: (id: string) => void;
  canDelete: boolean;
  iAmAdmin?: boolean;
}) {
  const [description, setDescription] = useState(room.description ?? "");
  const [announcement, setAnnouncement] = useState(room.announcement ?? "");
  const [invited, setInvited] = useState<string[]>(room.invitedIds ?? []);
  const [saving, setSaving] = useState(false);
  // Primary-group deletion request (owner can't delete their first group directly).
  const [delForm, setDelForm] = useState(false);
  const [delReason, setDelReason] = useState("");
  const [delComments, setDelComments] = useState("");
  const [delSubmitting, setDelSubmitting] = useState(false);
  const [delSent, setDelSent] = useState(false);
  const { config: mrmConfig } = useConfig();
  // The OWNER of their PRIMARY group must request admin deletion — ONLY when the
  // admin has the "primary group needs approval" toggle ON (default). Admins always
  // delete directly. When the toggle is OFF, even the owner deletes directly.
  const requireGDApproval = mrmConfig.settings?.primaryGroupDeleteApproval !== false;
  const primaryLocked = !!room.isPrimary && !iAmAdmin && requireGDApproval;
  const submitDeletionRequest = async () => {
    if (!delReason.trim()) { toast("Please enter a reason for the deletion.", "error"); return; }
    setDelSubmitting(true);
    const res = await requestGroupDeletion(room.id, delReason.trim(), delComments.trim());
    setDelSubmitting(false);
    if (res.ok) { setDelSent(true); setDelForm(false); toast("Deletion request sent — waiting for admin approval.", "success"); }
    else toast(res.error ?? "Could not send the request", "error");
  };

  // Room picture — the owner / co-host / admin can set or change it any time. It
  // saves instantly (downscaled to 512px) so the change shows right away in the
  // rooms list and the room header. An empty value falls back to the host avatar.
  const [image, setImage] = useState(room.image ?? "");
  const [imgBusy, setImgBusy] = useState(false);
  const imgInput = useRef<HTMLInputElement>(null);
  const { pick: roomImgEdit, editor: roomImgEditor } = usePhotoEdit({ aspect: "square" });
  // Room picture now goes through the shared advanced editor (crop/zoom/rotate).
  const pickImage = (file: File | undefined) => {
    roomImgEdit(file, async (dataUrl) => {
      setImgBusy(true);
      try {
        const updated = await updateRoom(room.id, { image: dataUrl });
        if (updated) { setImage(dataUrl); onSaved(updated); toast("Room picture updated", "success"); }
        else toast("Could not update the picture (too large?)", "error");
      } catch { toast("Could not save that image", "error"); }
      setImgBusy(false);
    });
  };
  const removeImage = async () => {
    setImgBusy(true);
    const updated = await updateRoom(room.id, { image: "" });
    if (updated) { setImage(""); onSaved(updated); toast("Room picture removed", "success"); }
    setImgBusy(false);
  };

  // Room-name change + video unlock = admin-approved, coin-paid requests.
  const { config } = useConfig();
  const { toast } = useToast();
  const namePrice = config.featurePricing?.roomNameChange ?? 500;
  const videoPrice = config.featurePricing?.videoUnlock ?? 1000;
  const coHostPrice = config.featurePricing?.coHostSlot ?? 500;
  const coHostLimitNow = (config.coHostLimit ?? 3) + (room.coHostBonus ?? 0);
  const [newName, setNewName] = useState("");
  const [myReqs, setMyReqs] = useState<FeatureRequest[]>([]);
  const [reqBusy, setReqBusy] = useState<"" | "room_name" | "video" | "cohost">("");
  const loadReqs = useCallback(() => { fetchMyRoomRequests(room.id).then(setMyReqs); }, [room.id]);
  useEffect(() => { loadReqs(); }, [loadReqs]);
  const pendingName = myReqs.find((r) => r.type === "room_name" && r.status === "pending");
  const pendingVideo = myReqs.find((r) => r.type === "video" && r.status === "pending");
  const pendingCohost = myReqs.find((r) => r.type === "cohost" && r.status === "pending");

  const submitRequest = async (type: "room_name" | "video" | "cohost") => {
    if (type === "room_name" && !newName.trim()) return toast("Enter the new room name", "error");
    setReqBusy(type);
    const res = await requestFeature(room.id, type, type === "room_name" ? newName.trim() : undefined);
    setReqBusy("");
    if (res.ok) {
      toast(type === "room_name" ? "Name change sent to admin for approval" : type === "video" ? "Video unlock request sent to admin" : "Extra co-host slot request sent to admin", "success");
      setNewName("");
      loadReqs();
    } else {
      toast(res.error ?? "Could not submit request", "error");
    }
  };

  const save = async () => {
    setSaving(true);
    const updated = await updateRoom(room.id, { description, announcement });
    setSaving(false);
    if (updated) {
      onSaved(updated);
      onClose();
    }
  };

  const field = "h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none placeholder:text-mist-500 focus:border-lotus-400";

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div
        className="my-8 w-full max-w-md rounded-2xl border border-white/10 bg-ink-850 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100">
            <Settings className="size-5 text-lotus-300" /> Manage room
          </h2>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100">
            <X className="size-5" />
          </button>
        </div>

        {/* Room picture — owner/co-host/admin can change it any time (saves instantly) */}
        <div className="mt-4 rounded-xl border border-line bg-ink-800/50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-mist-300"><ImagePlus className="size-3.5 text-lotus-300" /> Room picture</p>
          <div className="mt-2 flex items-center gap-3">
            {roomImgEditor}
            <Avatar name={room.name || room.host.fullName} src={image || undefined} size="xl" ring />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <input ref={imgInput} type="file" accept="image/*" className="hidden" onChange={(e) => { pickImage(e.target.files?.[0]); e.target.value = ""; }} />
              <Button size="sm" variant="secondary" onClick={() => imgInput.current?.click()} disabled={imgBusy}>
                {imgBusy ? "Saving…" : image ? "Change picture" : "Upload picture"}
              </Button>
              {image && (
                <Button size="sm" variant="ghost" onClick={removeImage} disabled={imgBusy} className="text-rose-300">
                  Remove picture
                </Button>
              )}
              <p className="text-[11px] text-mist-500">Shown on the room card and header. JPG/PNG, under ~500KB.</p>
            </div>
          </div>
        </div>

        {/* Room name — locked for private rooms; otherwise a coin-paid admin-approved change */}
        <div className="mt-3 rounded-xl border border-line bg-ink-800/50 p-3">
          <p className="text-xs font-semibold text-mist-300">Room name</p>
          <p className="mt-0.5 text-sm font-bold text-mist-100">{room.name}</p>
          {room.type === "private" ? (
            <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-ink-800 px-2.5 py-1.5 text-xs text-mist-400">
              <Lock className="size-3.5" /> A private room&apos;s name is fixed after creation. Only an admin can change it.
            </p>
          ) : pendingName ? (
            <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-200">
              <Clock className="size-3.5" /> Change to &ldquo;{pendingName.payload}&rdquo; is awaiting admin approval.
            </p>
          ) : (
            <>
              <p className="mt-2 text-[11px] text-mist-500">
                The name can&apos;t be changed directly — request a change for <b className="text-gold-300">{namePrice} coins</b>; an admin approves it.
              </p>
              <div className="mt-2 flex gap-2">
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New room name" className={cn(field, "flex-1")} maxLength={60} />
                <Button size="sm" onClick={() => submitRequest("room_name")} disabled={reqBusy === "room_name"}>
                  {reqBusy === "room_name" ? "Sending…" : `Request · ${namePrice}`}
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Video unlock — admin-controlled, coin-paid + approval */}
        {config.roomControls?.videoEnabled && room.features?.videoChat !== false && (
          <div className="mt-3 rounded-xl border border-line bg-ink-800/50 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-mist-300"><Video className="size-3.5 text-lotus-300" /> Video feature</p>
            {room.videoUnlocked ? (
              <p className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-200"><Check className="size-3.5" /> Video is unlocked for this room.</p>
            ) : pendingVideo ? (
              <p className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-200"><Clock className="size-3.5" /> Video unlock is awaiting admin approval.</p>
            ) : (
              <>
                <p className="mt-1 text-[11px] text-mist-500">Unlock video for this room for <b className="text-gold-300">{videoPrice} coins</b> (admin approves).</p>
                <Button size="sm" className="mt-2" onClick={() => submitRequest("video")} disabled={reqBusy === "video"}>
                  {reqBusy === "video" ? "Sending…" : `Unlock video · ${videoPrice}`}
                </Button>
              </>
            )}
          </div>
        )}

        {/* Co-host slots — request more for coins (admin approves) */}
        <div className="mt-3 rounded-xl border border-line bg-ink-800/50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-mist-300"><ShieldCheck className="size-3.5 text-lotus-300" /> Co-host slots</p>
          <p className="mt-0.5 text-sm font-bold text-mist-100">This room allows up to {coHostLimitNow} co-host{coHostLimitNow === 1 ? "" : "s"}.</p>
          {pendingCohost ? (
            <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-200"><Clock className="size-3.5" /> An extra co-host slot request is awaiting admin approval.</p>
          ) : (
            <>
              <p className="mt-1 text-[11px] text-mist-500">Need more co-hosts? Request <b className="text-gold-300">+1 slot for {coHostPrice} coins</b> (admin approves).</p>
              <Button size="sm" className="mt-2" onClick={() => submitRequest("cohost")} disabled={reqBusy === "cohost"}>
                {reqBusy === "cohost" ? "Sending…" : `Request +1 slot · ${coHostPrice}`}
              </Button>
            </>
          )}
        </div>

        <label className="mt-3 block text-xs font-semibold text-mist-300">Description</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's this room about?"
          className={cn(field, "mt-1")}
        />

        <label className="mt-3 block text-xs font-semibold text-mist-300">Announcement</label>
        <input
          value={announcement}
          onChange={(e) => setAnnouncement(e.target.value)}
          placeholder="Pin a message for everyone"
          className={cn(field, "mt-1")}
        />

        <Button block className="mt-4" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>

        {/* Invite members — search & invite REAL users (controls private-room access) */}
        <div className="mt-5">
          <p className="mb-1 text-xs font-semibold text-mist-300">
            Invite members{" "}
            <span className="font-normal text-mist-500">({invited.length} invited)</span>
          </p>
          {room.type === "private" && (
            <p className="mb-2 text-[11px] text-lotus-300">
              This is a private room — only invited members can see and enter it.
            </p>
          )}
          <RoomInvitePicker
            roomId={room.id}
            invited={invited}
            isPrivate={room.type === "private"}
            onInvitedChange={(next) => { setInvited(next); onSaved({ ...room, invitedIds: next }); }}
          />
        </div>

        {/* Co-Hosts overview — lists EVERY co-host from the room record (present or
            not), each with a one-tap Remove. The Host can therefore remove a
            co-host at ANY time, even when that co-host isn't on a seat / is offline
            (previously removal lived only in the presence-filtered member list). */}
        <div className="mt-5">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-mist-300">
            <ShieldCheck className="size-3.5 text-lotus-300" /> Co-Hosts ({coHostList.length})
          </p>
          {coHostList.length === 0 ? (
            <p className="rounded-lg bg-ink-800 px-2.5 py-2 text-xs text-mist-400">
              No Co-Hosts yet. Tap the shield next to a member below to assign one.
            </p>
          ) : (
            <div className="space-y-1.5">
              {coHostList.map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded-lg bg-lotus-500/10 px-2.5 py-2">
                  <Avatar name={c.fullName} src={c.avatar || undefined} size="xs" />
                  <span className="truncate text-sm font-semibold text-lotus-100">{c.fullName.split(" ")[0]}</span>
                  <span className="rounded-full bg-lotus-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-lotus-200">Co-Host</span>
                  {!c.present && <span className="text-[10px] text-mist-500">not in room</span>}
                  {canDelete && (
                    <button
                      onClick={() => onPromote(c.id)}
                      title="Remove Co-Host"
                      className="ml-auto inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-300 transition hover:bg-rose-500/20"
                    >
                      <X className="size-3.5" /> Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Members */}
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold text-mist-300">Members ({members.filter((m) => !removedMembers.includes(m.id)).length})</p>
          <div className="space-y-1.5">
            {members
              .filter((m) => !removedMembers.includes(m.id))
              .map((m) => (
                <div key={m.id} className="flex items-center gap-2 rounded-lg bg-ink-800 px-2.5 py-2">
                  <Avatar name={m.fullName} size="xs" />
                  <span className="truncate text-sm text-mist-100">{m.fullName.split(" ")[0]}</span>
                  {coAdmins.includes(m.id) && (
                    <span className="rounded-full bg-lotus-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-lotus-300">
                      Co-Host
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-1">
                    {/* Assigning/removing a Co-Host is a HOST-only power. */}
                    {canDelete && (
                    <button
                      onClick={() => onPromote(m.id)}
                      title={coAdmins.includes(m.id) ? "Remove Co-Host" : "Make Co-Host"}
                      className="grid size-7 place-items-center rounded-md text-mist-300 hover:bg-white/10 hover:text-lotus-300"
                    >
                      <ShieldCheck className="size-4" />
                    </button>
                    )}
                    {/* 🎤 Mute — their MICROPHONE, for the whole room. */}
                    <button
                      onClick={() => onMute(m.id)}
                      title={mutedMembers.includes(m.id) ? "🎤 Unmute (mic on for everyone)" : "🎤 Mute (mic off for everyone)"}
                      className="grid size-7 place-items-center rounded-md text-mist-300 hover:bg-white/10"
                    >
                      {mutedMembers.includes(m.id) ? <MicOff className="size-4 text-rose-300" /> : <Mic className="size-4" />}
                    </button>
                    {/* 🔊 Speaker Off — MY device only; their mic is untouched. */}
                    <button
                      onClick={() => onToggleSpeaker(m.id)}
                      title={speakerOffIds.includes(m.id) ? "🔊 Speaker On — hear them again (your device)" : "🔊 Speaker Off — stop hearing them on your device only"}
                      className="grid size-7 place-items-center rounded-md text-mist-300 hover:bg-white/10"
                    >
                      {speakerOffIds.includes(m.id) ? <VolumeX className="size-4 text-sky-300" /> : <Volume2 className="size-4" />}
                    </button>
                    <button
                      onClick={() => onRemove(m.id)}
                      title="Remove from room"
                      className="grid size-7 place-items-center rounded-md text-mist-300 hover:bg-rose-500/15 hover:text-rose-300"
                    >
                      <UserX className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Delete is HOST-ONLY. A user's PRIMARY group can't be deleted directly —
            the owner must request admin approval (with a reason). Admins delete any room. */}
        {!canDelete ? (
          <p className="mt-5 rounded-lg border border-line bg-ink-800/60 px-3 py-2.5 text-center text-xs text-mist-500">
            Only the Host can delete this room.
          </p>
        ) : primaryLocked ? (
          // Primary group → deletion request flow.
          delSent ? (
            <div className="mt-5 rounded-lg border border-amber-400/30 bg-amber-500/[0.08] px-3 py-3 text-center text-xs text-amber-200">
              ⏳ <b>Deletion request sent</b> — status: <b>Pending Admin Approval</b>. This group stays active until an admin approves.
            </div>
          ) : delForm ? (
            <div className="mt-5 space-y-2.5 rounded-lg border border-rose-500/30 bg-rose-500/[0.06] p-3">
              <p className="text-sm font-semibold text-rose-200">Request Group Deletion</p>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-mist-400">
                <div className="rounded-md bg-ink-800/70 px-2 py-1.5"><span className="block text-mist-500">Group Name</span><span className="font-semibold text-mist-100">{room.name}</span></div>
                <div className="truncate rounded-md bg-ink-800/70 px-2 py-1.5"><span className="block text-mist-500">Group ID</span><span className="font-mono text-mist-100">{room.id}</span></div>
              </div>
              <label className="block text-xs text-mist-300">Reason for deletion <span className="text-rose-300">*</span>
                <textarea value={delReason} onChange={(e) => setDelReason(e.target.value)} rows={2} maxLength={300} placeholder="Why do you want this group removed?" className="mt-1 block w-full resize-none rounded-lg border border-line bg-ink-800 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400" />
              </label>
              <label className="block text-xs text-mist-300">Additional comments <span className="text-mist-500">(optional)</span>
                <textarea value={delComments} onChange={(e) => setDelComments(e.target.value)} rows={2} maxLength={300} placeholder="Anything else the admin should know" className="mt-1 block w-full resize-none rounded-lg border border-line bg-ink-800 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400" />
              </label>
              <div className="flex gap-2">
                <button onClick={() => setDelForm(false)} className="flex-1 rounded-lg border border-line py-2 text-xs font-semibold text-mist-300 hover:bg-white/[0.06]">Cancel</button>
                <button onClick={submitDeletionRequest} disabled={delSubmitting || !delReason.trim()} className="flex-1 rounded-lg bg-rose-500 py-2 text-xs font-bold text-white transition hover:bg-rose-400 disabled:opacity-50">{delSubmitting ? "Sending…" : "Send request"}</button>
              </div>
            </div>
          ) : (
            <div className="mt-5">
              <button
                onClick={() => setDelForm(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 py-2.5 text-sm font-semibold text-rose-300 hover:bg-rose-500/20"
              >
                <Trash2 className="size-4" /> Request Group Deletion
              </button>
              <p className="mt-1.5 text-center text-[11px] text-mist-500">This is your <b className="text-mist-300">Primary Group</b> — it can't be deleted directly. Send a request and an admin will review it.</p>
            </div>
          )
        ) : (
          <button
            onClick={onDelete}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 py-2.5 text-sm font-semibold text-rose-300 hover:bg-rose-500/20"
          >
            <Trash2 className="size-4" /> Delete room
          </button>
        )}
      </div>
    </div>
  );
}

function Seat({
  role,
  isCoHost,
  occupant,
  agency,
  isMine,
  muted,
  mutedByMod,
  speakerOff,
  speaking,
  level,
  canJoin,
  onJoin,
  canManageThis,
  canView,
  onManage,
  onSelf,
  awayHost,
  compact = false,
}: {
  role: SeatRole;
  isCoHost?: boolean;
  occupant?: SpeakerUser;
  agency?: { name: string; id?: string };
  isMine?: boolean;
  muted: boolean;
  mutedByMod?: boolean;
  speakerOff?: boolean; // I turned their speaker off on MY device (mic untouched)
  speaking: boolean;
  level: number;
  canJoin: boolean;
  onJoin: () => void;
  canManageThis?: boolean;
  canView?: boolean; // any user can tap an occupied seat to view profile / message (frameImage via useConfig below)
  onManage?: () => void;
  onSelf?: () => void;
  // When the Host is away, the (empty) Host seat still shows WHOSE room it is +
  // an "Away" tag, so members aren't confused by a blank Host slot.
  awayHost?: { name: string; avatar?: string };
  // COMPACT: the two-line seat strip at the top of the phone "Seats + Chat"
  // screen. Everything shrinks and the secondary lines (ID, agency) are dropped
  // so all eight seats fit at once above the conversation. Tapping a seat still
  // does exactly the same thing, so nothing is lost — only repeated.
  compact?: boolean;
}) {
  // Frame-store: resolve the occupant's equipped frame image from the catalog.
  const { config: seatConfig } = useConfig();
  const isHost = role === "host";
  // Co-Host badge appears ONLY when the person is an assigned co-host.
  const label = isHost ? "Host" : isCoHost ? "Co-Host" : null;
  // Tapping your OWN seat opens your options; tapping anyone else opens their
  // card (view profile / message — plus management actions for host/co-host).
  const tappable = canManageThis || canView || (isMine && !!onSelf);
  const onTap = isMine && onSelf ? onSelf : canManageThis || canView ? onManage : undefined;

  if (!occupant) {
    // Host away → keep the seat empty BUT show whose room it is + an "Away" tag,
    // so a member never sees a blank "Host" slot and wonders if the room has no host.
    if (isHost && awayHost) {
      return (
        <div className="flex flex-col items-center gap-1.5" title={`${awayHost.name} (host) — away`}>
          <span className="relative grid size-16 place-items-center rounded-full border-2 border-dashed border-amber-400/40">
            <Avatar name={awayHost.name} src={awayHost.avatar} size="lg" className="opacity-40 grayscale" />
            <span className="absolute -bottom-1 rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[9px] font-bold text-amber-950">AWAY</span>
          </span>
          {/* Same fixed text block, so an away Host lines up with the others. */}
          <span className="flex min-h-[3.25rem] w-full flex-col items-center justify-start pt-0.5">
            <span className="max-w-[72px] truncate text-[11px] leading-tight text-mist-400">{awayHost.name.split(" ")[0]}</span>
            <span className="text-[10px] leading-tight text-mist-600">Host</span>
          </span>
        </div>
      );
    }
    return (
      <button
        onClick={canJoin ? onJoin : undefined}
        disabled={!canJoin}
        className={cn(
          "flex flex-col items-center",
          compact ? "min-w-0 gap-0.5" : "gap-1.5",
          canJoin ? "cursor-pointer" : "cursor-default",
        )}
      >
        <span
          className={cn(
            "grid place-items-center rounded-full border-2 border-dashed",
            compact ? "size-9" : "size-16",
            canJoin
              ? "border-lotus-400/50 text-lotus-300 hover:bg-lotus-500/10"
              : "border-white/10 text-mist-600",
          )}
        >
          <Plus className={compact ? "size-3.5" : "size-5"} />
        </span>
        {/* Same fixed text block as an occupied seat, so an empty seat lines up
            with its neighbours instead of sitting higher than them. */}
        <span className={cn("flex w-full flex-col items-center justify-start", compact ? "min-h-[1.6rem]" : "min-h-[3.25rem] pt-0.5")}>
          <span className={cn("text-mist-500", compact ? "text-[9px] leading-none" : "text-[11px] leading-tight")}>{isHost ? "Host" : "Seat"}</span>
        </span>
      </button>
    );
  }

  const showMuted = muted || mutedByMod;
  const Wrapper = tappable ? "button" : "div";
  return (
    <Wrapper
      onClick={tappable ? onTap : undefined}
      className={cn(
        "flex flex-col items-center outline-none",
        compact ? "min-w-0 gap-0.5" : "gap-1.5",
        tappable && "cursor-pointer rounded-2xl focus-visible:ring-2 focus-visible:ring-lotus-400",
      )}
      title={isMine ? "Your options" : canManageThis ? `Manage ${occupant.fullName.split(" ")[0]}` : undefined}
    >
      <div className="relative">
        {(() => {
          // Speaking effect is admin-controlled (config.speakingFx): style, colour,
          // speed, on/off. Calm steady glow by default — no mic-level flicker/jitter.
          const fx = speakingFxWrap(seatConfig.speakingFx, speaking);
          return (
            <span className={cn("relative grid place-items-center rounded-full", fx.className)} style={fx.style}>
              <SpeakingFxOverlay cfg={seatConfig.speakingFx} speaking={speaking} />
              <Avatar
                name={occupant.fullName}
                src={occupant.avatar}
                size={compact ? "sm" : "lg"}
                frameImage={framesOnIn(seatConfig, "voiceRoom") && occupant.equippedFrame ? frameImageOf(seatConfig, occupant.equippedFrame) : undefined}
                className={cn(canManageThis && "hover:brightness-110")}
              />
            </span>
          );
        })()}
        {/* Gift animation burst when this member receives a gift (globally gated by
            the RoomGiftListener above — no broadcast fires when Gift Animation is off). */}
        <GiftBurst name={occupant.fullName} />
        {isHost && seatConfig.roomControls?.showHostCrown !== false && (
          <span className={cn("absolute -top-1 -right-1 grid place-items-center rounded-full bg-gold-400 text-amber-950 shadow", compact ? "size-4" : "size-6")}>
            <Crown className={compact ? "size-2.5" : "size-3.5"} />
          </span>
        )}
        {/* Co-Host ★ badge — hidden when the admin switches it off. */}
        {!isHost && isCoHost && seatConfig.roomControls?.showCoHostStar !== false && (
          <span className={cn("absolute -top-1 -right-1 grid place-items-center rounded-full bg-lotus-500 text-white shadow", compact ? "size-4" : "size-6")} title="Co-Host">
            <Star className={compact ? "size-2.5" : "size-3.5"} />
          </span>
        )}
        {/* The ⚙ "Settings" symbol hinting this avatar is manageable. Admin-switchable
            (Admin → Rooms): OFF hides the symbol only — tapping the seat still opens
            the manage menu exactly as before, so no control is lost. */}
        {canManageThis && seatConfig.roomControls?.showSeatGear !== false && (
          <span className="absolute -left-1 -top-1 grid size-5 place-items-center rounded-full bg-ink-700 text-mist-200 ring-1 ring-white/15">
            <Settings className="size-3" />
          </span>
        )}
        <span
          className={cn(
            "absolute -bottom-1 left-1/2 grid -translate-x-1/2 place-items-center rounded-full border-2 border-ink-850",
            compact ? "size-4" : "size-6",
            mutedByMod ? "bg-rose-500 text-white" : showMuted ? "bg-ink-700 text-mist-400" : "bg-emerald-500 text-white",
          )}
          title={mutedByMod ? "Muted by host" : showMuted ? "Muted" : "Speaking"}
        >
          {showMuted ? <MicOff className={compact ? "size-2.5" : "size-3"} /> : <Mic className={compact ? "size-2.5" : "size-3"} />}
        </span>
        {/* 🔊 I've turned this person's speaker off — a SEPARATE badge from the mic
            one, so it's obvious the silence is only on my own device. */}
        {speakerOff && (
          <span
            className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full border-2 border-ink-850 bg-sky-500 text-white"
            title="Speaker off — you are not hearing this person (their mic is still on for everyone else)"
          >
            <VolumeX className="size-3" />
          </span>
        )}
      </div>
      {/* ALIGNMENT: a seat carries between one and four lines under the avatar —
          the name always, then the member ID, a Host/Co-Host label and an agency
          only when they apply. Left to size themselves, seats in the same row
          ended up different heights and the rows read as ragged. The block below
          is a fixed height, so every avatar sits on the same line and every row
          is evenly spaced no matter what each member happens to have. */}
      <span
        className={cn(
          "flex w-full flex-col items-center",
          compact ? "min-h-[1.6rem] justify-start" : "min-h-[3.25rem] justify-start pt-0.5",
        )}
      >
        {/* In the compact strip the column can be as narrow as a sixth of the
            screen, so the name is capped to the COLUMN (max-w-full) rather than a
            fixed width that would spill into its neighbour. */}
        <span className={cn("truncate font-medium text-mist-200", compact ? "max-w-full text-[9px] leading-tight" : "max-w-16 text-xs")}>
          {occupant.fullName.split(" ")[0]}
          {isMine && <span className="text-mist-500"> (You)</span>}
        </span>
        {/* Permanent member ID under the seat name — names repeat, IDs don't. */}
        {!compact && occupant.publicId && <span className="font-mono text-[9px] leading-tight text-mist-500">ID {occupant.publicId}</span>}
        {label && <span className={cn("text-mist-500", compact ? "text-[8px] leading-none" : "text-[10px] leading-tight")}>{label}</span>}
        {/* The member's OWN agency — shown under their name so everyone can see
            which agency a user belongs to (separate from Host/Co-Host). */}
        {!compact && agency?.name && (
          <span className="max-w-[4.5rem] truncate text-[9px] font-semibold leading-tight text-lotus-300" title={`Agency: ${agency.name}`}>
            🏛️ {agency.name}
          </span>
        )}
      </span>
    </Wrapper>
  );
}

// ---------- Per-member manage menu (Host / Co-Host) ----------
function MemberManageMenu({
  member,
  roomId,
  myId,
  fromChat = false,
  iAmHost,
  isCoHost,
  isMuted,
  speakerOff,
  isBlocked,
  inAudience,
  targetSeated = false,
  seatInvited = false,
  mediaAllowed,
  canManage,
  onClose,
  onToggleMute,
  onToggleSpeaker,
  onToggleMedia,
  onToggleAudience,
  onToggleCoHost,
  onRemove,
  onToggleBlock,
}: {
  member: SpeakerUser;
  roomId: string;
  myId?: string;
  fromChat?: boolean; // opened from a chat message (hides seat-only actions)
  iAmHost: boolean;
  isCoHost: boolean;
  isMuted: boolean;
  speakerOff: boolean; // I have turned this person's speaker off on MY device
  isBlocked: boolean;
  inAudience: boolean;
  targetSeated?: boolean;  // they already hold a speaking seat
  seatInvited?: boolean;   // a seat invitation is already waiting for them
  mediaAllowed: boolean;
  canManage: boolean; // viewer is host/co-host AND target isn't the host
  onClose: () => void;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onToggleMedia: () => void;
  onToggleAudience: () => void;
  onToggleCoHost: () => void;
  onRemove: () => void;
  onToggleBlock: () => void;
}) {
  const first = member.fullName.split(" ")[0];
  const isSelf = !!myId && member.id === myId;
  const item =
    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition";
  const { toast } = useToast();
  const { config: modalConfig } = useConfig(); // frame-store lookup for the header avatar
  const [reporting, setReporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const REPORT_CATEGORIES = ["Abusive language", "Harassment", "Spam", "Inappropriate behaviour", "Other"];
  const submitReport = async (category: string) => {
    const res = await reportUser(member.id, category, `Reported from a voice room`);
    toast(res.ok ? "Report sent to admins. Thank you." : res.error ?? "Could not send report", res.ok ? "success" : "error");
    setReporting(false);
    onClose();
  };

  const addFriend = async () => {
    setBusy(true);
    try {
      const res = await fetch(withBase("/api/friends"), {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ otherId: member.id, action: "add" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) toast((data as { error?: string }).error ?? "Could not send request", "error");
      else if ((data as { state?: string }).state === "friends") toast(`You're already friends with ${first}.`, "info");
      else toast(`Friend request sent to ${first}.`, "success");
    } catch { toast("Network error", "error"); }
    setBusy(false);
    onClose();
  };

  const inviteToRoom = async () => {
    setBusy(true);
    try {
      const res = await fetch(withBase(`/api/rooms/${roomId}/invite`), {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ targetUserId: member.id }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; kind?: string };
      // Say which of the two invitations actually went out, so the host isn't
      // left guessing whether the listener was asked up or asked to join.
      toast(
        res.ok
          ? data.kind === "seat"
            ? `${first} has been invited to take a seat — they'll see it in the room.`
            : `Invitation sent to ${first}.`
          : data.error ?? "Could not invite",
        res.ok ? "success" : "error",
      );
    } catch { toast("Network error", "error"); }
    setBusy(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-t-2xl border border-white/10 bg-ink-850 p-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/8 pb-3">
          <Avatar name={member.fullName} src={member.avatar} size="md" frameImage={framesOnIn(modalConfig, "voiceRoom") && member.equippedFrame ? frameImageOf(modalConfig, member.equippedFrame) : undefined} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-mist-100">{member.fullName}</p>
            <p className="truncate text-xs text-mist-400">
              {member.username && <span>@{member.username}</span>}
              {member.publicId && <span className="ml-1.5 font-mono text-mist-500">ID {member.publicId}</span>}
            </p>
          </div>
          {isCoHost && (
            <span className="rounded-full bg-lotus-500/15 px-2 py-0.5 text-[10px] font-semibold text-lotus-300">
              Co-Host
            </span>
          )}
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100">
            <X className="size-5" />
          </button>
        </div>

        {/* Actions */}
        <div className="mt-2 space-y-0.5">
          <Link href={profileHrefOf(member.username, undefined, member.id)} className={cn(item, "text-mist-200 hover:bg-white/[0.06]")}>
            <Avatar name={member.fullName} size="xs" /> View profile
          </Link>
          <Link
            href={`/messages?to=${encodeURIComponent(member.username || member.id)}`}
            className={cn(item, "text-mist-200 hover:bg-white/[0.06]")}
          >
            <MessageCircle className="size-[18px] text-mist-300" /> Send private message
          </Link>

          {/* Universal social actions — available to everyone (not for self). */}
          {!isSelf && (
            <>
              <button onClick={addFriend} disabled={busy} className={cn(item, "text-mist-200 hover:bg-white/[0.06] disabled:opacity-50")}>
                <UserPlus className="size-[18px] text-lotus-300" /> Add friend
              </button>
              {/* One button, two meanings — a listener who is already here is
                  invited UP TO A SEAT, not asked to join a room they're in. */}
              <button onClick={inviteToRoom} disabled={busy || seatInvited} className={cn(item, "text-mist-200 hover:bg-white/[0.06] disabled:opacity-50")}>
                <UserPlus2 className="size-[18px] text-emerald-300" />
                <span className="min-w-0 flex-1">
                  {seatInvited ? `Seat invitation sent — waiting for ${first}` : canManage && !targetSeated ? "Invite to a seat" : "Invite to room"}
                  {canManage && !targetSeated && !seatInvited && (
                    <span className="block text-[11px] font-normal text-mist-500">They&apos;re listening — this asks them up to speak</span>
                  )}
                </span>
              </button>
            </>
          )}

          {/* 🎤 MUTE — the host turning this member's MICROPHONE off for the whole
              room. Host / Co-Host only, and only from a seat (not a chat message). */}
          {canManage && !fromChat && (
            <button onClick={() => { onToggleMute(); onClose(); }} className={cn(item, "text-mist-200 hover:bg-white/[0.06]")}>
              {isMuted ? <Mic className="size-[18px] text-emerald-300" /> : <MicOff className="size-[18px] text-amber-300" />}
              {isMuted ? "🎤 Unmute member (mic on for everyone)" : "🎤 Mute member (mic off for everyone)"}
            </button>
          )}

          {/* 🔊 SPEAKER OFF — a completely SEPARATE control, available to everyone.
              It only stops this person's audio on MY device: their microphone keeps
              working and every other member still hears them exactly as before. */}
          {!isSelf && (
            <button onClick={onToggleSpeaker} className={cn(item, "text-mist-200 hover:bg-white/[0.06]")}>
              {speakerOff ? <Volume2 className="size-[18px] text-emerald-300" /> : <VolumeX className="size-[18px] text-sky-300" />}
              <span className="min-w-0 flex-1">
                {speakerOff ? `🔊 Speaker On — hear ${first} again` : `🔊 Speaker Off — stop hearing ${first}`}
                <span className="block text-[11px] font-normal text-mist-500">Only on your device · does not mute their mic</span>
              </span>
            </button>
          )}

          {/* Seat-only management actions — Host / Co-Host, and only when this
              menu was opened from a seat (not from a chat message). */}
          {canManage && !fromChat && (
            <>
              {/* A co-host is always a speaker — no "move to audience" for them
                  (use "Remove Co-Host" first if you want to move them off stage). */}
              {!isCoHost && (
                <button onClick={() => { onToggleAudience(); onClose(); }} className={cn(item, "text-mist-200 hover:bg-white/[0.06]")}>
                  {inAudience ? <Mic className="size-[18px] text-lotus-300" /> : <Hand className="size-[18px] text-mist-300" />}
                  {inAudience ? "Bring back to stage" : "Move to audience (listener)"}
                </button>
              )}

              {/* Assign / Remove Co-Host — available to the Host, Co-Hosts and
                  admins (anyone who can manage the room). */}
              <button onClick={() => { onToggleCoHost(); onClose(); }} className={cn(item, "text-mist-200 hover:bg-white/[0.06]")}>
                <ShieldCheck className={cn("size-[18px]", isCoHost ? "text-rose-300" : "text-lotus-300")} />
                {isCoHost ? "Remove Co-Host" : "Assign as Co-Host"}
              </button>

              {/* Allow / disallow this member to PLAY room media (per-user). */}
              {!isCoHost && (
                <button onClick={() => onToggleMedia()} className={cn(item, "text-mist-200 hover:bg-white/[0.06]")}>
                  <Music className={cn("size-[18px]", mediaAllowed ? "text-rose-300" : "text-pink-400")} />
                  {mediaAllowed ? "Disallow media" : "Allow media"}
                </button>
              )}
            </>
          )}

          {reporting ? (
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/[0.06] p-2">
              <p className="px-1 pb-1.5 text-xs font-semibold text-rose-200">Report {first} for:</p>
              <div className="grid gap-1">
                {REPORT_CATEGORIES.map((c) => (
                  <button key={c} onClick={() => submitReport(c)} className="rounded-lg px-3 py-2 text-left text-sm text-mist-200 transition hover:bg-rose-500/15 hover:text-rose-200">{c}</button>
                ))}
              </div>
              <button onClick={() => setReporting(false)} className="mt-1 w-full rounded-lg px-3 py-1.5 text-xs text-mist-400 hover:text-mist-200">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setReporting(true)} className={cn(item, "text-rose-300 hover:bg-rose-500/10")}>
              <Flag className="size-[18px]" /> Report {first}
            </button>
          )}

          {canManage && (
            <>
              <button onClick={onRemove} className={cn(item, "text-rose-300 hover:bg-rose-500/10")}>
                <UserX className="size-[18px]" /> Remove {first} from room
              </button>

              <button onClick={onToggleBlock} className={cn(item, isBlocked ? "text-emerald-300 hover:bg-emerald-500/10" : "text-rose-400 hover:bg-rose-500/10")}>
                <Lock className="size-[18px]" /> {isBlocked ? `Unblock ${first}` : `Block ${first} (ban)`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Media (music / audio / video) — played from the admin library ----------

function MediaPanel({
  canControl,
  iAmHost,
  isCoHost,
  hostId,
  myId,
  roomId,
  media,
  onSetMedia,
  onUpdateMedia,
  part = "all",
}: {
  canControl: boolean;
  iAmHost: boolean;
  isCoHost: boolean;
  hostId: string;
  myId: string;
  roomId: string;
  media: RoomMedia | null;
  onSetMedia: (m: { kind: "audio" | "video" | "youtube" | "image"; src: string; name?: string } | null) => void;
  onUpdateMedia: (patch: Partial<RoomMedia>) => void;
  part?: "all" | "controls" | "player"; // "player" = just the now-playing bar (always mounted)
}) {
  const { toast } = useToast();
  const { updateUser } = useAuth();
  // Host PRIORITY: while the Host is the current media owner, a Co-Host cannot
  // start their own media (only one source at a time; Host wins).
  const hostIsPlaying = !!media && media.ownerId === hostId;
  const coHostLocked = isCoHost && !iAmHost && hostIsPlaying;
  const canManage = canControl && !coHostLocked;
  const [tab, setTab] = useState<MediaTypeKey>("audio");
  const [library, setLibrary] = useState<MediaItem[]>([]);
  const [access, setAccess] = useState<MediaAccess>(DEFAULT_MEDIA_ACCESS);
  const [loadingLib, setLoadingLib] = useState(false);
  const [buying, setBuying] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Host/co-host picks their OWN audio/video file from their device to play in
  // the room (in addition to the admin library).
  const pickOwnFile = async (file: File | undefined) => {
    if (!file) return;
    // Images were left out of this check, which is why the Image tab had no way
    // to add anything from your own device.
    if (tab !== "audio" && tab !== "video" && tab !== "image") return;
    setUploadingFile(true);
    const res = await uploadRoomMedia(file, tab);
    setUploadingFile(false);
    if (res.ok && res.url) {
      onSetMedia({ kind: tab, src: res.url, name: res.name });
      toast(tab === "image" ? "Showing your image to the room" : `Now playing your ${tab} file`, "success");
    } else toast(res.error ?? "Upload failed", "error");
  };

  // PLAY BY LINK — paste a YouTube link or a direct .mp3/.mp4 URL and play it
  // instantly for the room (no upload, streams straight from the source).
  const playLink = () => {
    const url = linkUrl.trim();
    if (!url) return;
    // Convert a YouTube watch/share/shorts link into an embeddable player URL.
    const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
    if (yt) {
      onSetMedia({ kind: "youtube", src: `https://www.youtube.com/embed/${yt[1]}`, name: "YouTube video" });
    } else if (/^https?:\/\//i.test(url)) {
      const clean = url.split(/[?#]/)[0].toLowerCase();
      const isVideo = tab === "video" || /\.(mp4|webm|mov|m4v|mkv)$/.test(clean);
      const name = decodeURIComponent(url.split("/").pop() || "").replace(/\.[^.]+$/, "").slice(0, 60) || "Link media";
      onSetMedia({ kind: isVideo ? "video" : "audio", src: url, name });
    } else {
      toast("Enter a valid link (YouTube, or a direct .mp3 / .mp4 URL).", "error");
      return;
    }
    toast("Now playing from link", "success");
    setLinkUrl("");
  };

  // Load the admin-curated library + this user's ACCESS (which types are on,
  // free/paid, and unlocked). Fetched for everyone so the master "library off"
  // switch hides the panel for all; only Host/Co-Host see the pick list.
  useEffect(() => {
    if (part === "player") return; // player-only instance doesn't need the library
    setLoadingLib(true);
    fetchMediaLibrary().then(({ items, access }) => { setLibrary(items); setAccess(access); setLoadingLib(false); });
  }, [roomId, part]);

  // Items for the CURRENT tab (audio / video+youtube / image). Search, sort,
  // folders, favourites & recents are all handled inside <MediaLibraryBrowser>.
  const tabItems = library.filter((it) =>
    tab === "video" ? (it.kind === "video" || it.kind === "youtube") : tab === "image" ? it.kind === "image" : it.kind === "audio",
  );
  const play = (it: MediaItem) => onSetMedia({ kind: it.kind, src: it.src, name: it.name });
  const tabAccess = access[tab];
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const buy = async () => {
    setBuying(true);
    const res = await purchaseMediaAccess(tab);
    setBuying(false);
    if (!res.ok) { toast(res.error === "Insufficient coins" ? "Not enough coins to unlock this." : (res.error ?? "Could not unlock"), "error"); return; }
    if (res.access) setAccess(res.access);
    if (res.balance !== undefined) updateUser({ coins: res.balance });
    toast(`${cap(tab)} media unlocked — enjoy!`, "success");
  };

  // The always-mounted "player" instance renders ONLY the synced now-playing bar
  // (no wrapper/selection UI) so audio keeps playing while the Media menu is closed.
  if (part === "player") {
    return <SyncedPlayer media={media} canControl={canControl} onStop={() => onSetMedia(null)} onUpdateMedia={onUpdateMedia} />;
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-ink-850/60 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-mist-200">
        <Music className="size-4 text-lotus-300" /> Media
      </div>

      {!access.libraryAccess ? (
        <p className="rounded-lg bg-white/[0.03] px-3 py-5 text-center text-xs text-mist-500">The media library is currently turned off by the admin.</p>
      ) : (
        <>
          {/* Audio / Video / Image */}
          <div className="grid grid-cols-3 gap-1.5">
            {([
              { k: "audio", label: "Audio", Icon: AudioLines },
              { k: "video", label: "Video", Icon: Video },
              { k: "image", label: "Image", Icon: ImageIcon },
            ] as const).map(({ k, label, Icon }) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={cn(
                  "flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition",
                  tab === k ? "bg-lotus-600 text-white" : "bg-ink-800 text-mist-300 hover:text-mist-100",
                )}
              >
                <Icon className="size-3.5" /> {label}
              </button>
            ))}
          </div>

          {canManage ? (
            <div className="mt-3">
              {!tabAccess.enabled ? (
                <p className="rounded-lg bg-white/[0.03] px-3 py-4 text-center text-xs text-mist-500">{cap(tab)} media is currently turned off by the admin.</p>
              ) : tabAccess.paid && !tabAccess.unlocked ? (
                // Paid type the user hasn't bought yet → one-time coin unlock.
                <div className="rounded-lg border border-gold-400/30 bg-gold-500/[0.06] px-3 py-4 text-center">
                  <Lock className="mx-auto size-6 text-gold-300" />
                  <p className="mt-2 text-xs text-mist-200">Unlock <span className="capitalize">{tab}</span> media to play it for your room.</p>
                  <button onClick={buy} disabled={buying} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-gold-500 px-3.5 py-1.5 text-xs font-bold text-ink-900 transition hover:bg-gold-400 disabled:opacity-60">
                    <Coins className="size-3.5" /> {buying ? "Unlocking…" : `Unlock for ${tabAccess.price} coins`}
                  </button>
                  <p className="mt-1.5 text-[10px] text-mist-500">One-time purchase — stays unlocked for you. Charged to your wallet.</p>
                </div>
              ) : (
                <>
                  {/* Choose a file from your own device (audio / video) to play in the
                      room — the PRIMARY action, one obvious tap. The accept list names
                      both MIME wildcards AND concrete extensions so phone pickers show
                      every playable file (music, downloads, recordings — incl. mkv/3gp
                      files the phone may not have registered as video/*). The phone's
                      own picker decides the folders it shows; private app folders
                      (WhatsApp/IMO/Telegram voice notes) are not exposed by the OS. */}
                  {(tab === "audio" || tab === "video" || tab === "image") && (
                    <div className="mb-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={tab === "audio"
                          ? "audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.opus,.flac,.amr"
                          : tab === "video"
                            ? "video/*,.mp4,.mkv,.avi,.mov,.m4v,.webm,.3gp,.3g2"
                            : "image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.avif"}
                        className="hidden"
                        onChange={(e) => { pickOwnFile(e.target.files?.[0]); e.target.value = ""; }}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingFile}
                        className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-lotus-500 px-4 py-3.5 text-left transition hover:bg-lotus-400 disabled:opacity-60"
                      >
                        {uploadingFile ? (
                          <span className="text-sm font-bold text-white">Uploading your file…</span>
                        ) : (
                          <>
                            {tab === "audio" ? <AudioLines className="size-5 shrink-0 text-white" />
                              : tab === "video" ? <Video className="size-5 shrink-0 text-white" />
                              : <ImageIcon className="size-5 shrink-0 text-white" />}
                            <span className="min-w-0">
                              <span className="block text-sm font-bold text-white">
                                Choose {tab === "audio" ? "audio" : tab === "video" ? "video" : "an image"} from my device
                              </span>
                              <span className="block text-[11px] font-medium text-white/75">
                                {tab === "audio" ? "Music, MP3s, downloads & recordings on your phone"
                                  : tab === "video" ? "Any video on your phone — MP4, MKV, AVI, MOV, 3GP…"
                                  : "Any photo on your phone — JPG, PNG, WebP, GIF, HEIC…"}
                              </span>
                            </span>
                          </>
                        )}
                      </button>
                      <p className="mt-1 text-center text-[10px] text-mist-500">
                        {tab === "image" ? "Shows to everyone in the room" : "Plays for everyone in the room together"}
                      </p>
                    </div>
                  )}

                  {/* PLAY BY LINK — paste a YouTube link or a direct .mp3/.mp4 URL. */}
                  {(tab === "audio" || tab === "video") && (
                    <div className="mb-2 flex items-center gap-1.5">
                      <input
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") playLink(); }}
                        placeholder="Paste a YouTube or .mp3/.mp4 link…"
                        className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-ink-800 px-3 text-xs text-mist-100 outline-none placeholder:text-mist-500 focus:border-lotus-400"
                      />
                      <button
                        onClick={playLink}
                        disabled={!linkUrl.trim()}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-lotus-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-lotus-500 disabled:opacity-40"
                      >
                        <LinkIcon className="size-3.5" /> Play
                      </button>
                    </div>
                  )}

                  {/* …or pick from the admin-curated media library — a fast browser
                      with List/Grid views, folders, sort, search, Favourites, Recent
                      and one-tap playback (see MediaLibraryBrowser). */}
                  {loadingLib ? (
                    <p className="py-6 text-center text-xs text-mist-500">Loading library…</p>
                  ) : library.length === 0 && tabItems.length === 0 ? (
                    <p className="rounded-lg bg-white/[0.03] px-3 py-4 text-center text-xs text-mist-500">
                      {tab === "image"
                        ? "No images in the library yet — use “Choose an image from my device” above to show your own."
                        : `No ${tab} in the library yet — use “Choose ${tab === "audio" ? "audio" : "video"} from my device” above to play your own.`}
                    </p>
                  ) : (
                    <MediaLibraryBrowser items={tabItems} tab={tab} currentSrc={media?.src} onPlay={play} />
                  )}
                </>
              )}
              <p className="mt-1.5 text-[11px] text-mist-500">
                Shows for <strong className="text-mist-300">everyone</strong> in the room. You can play a file from your
                own device, or pick from the library the admin manages.
              </p>
            </div>
          ) : coHostLocked ? (
            <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              The Host is currently playing media. Co-Host controls are disabled until the Host stops.
            </p>
          ) : (
            <p className="mt-3 text-xs text-mist-500">
              Only the Host &amp; Co-Host choose the media — everyone hears and watches it below.
            </p>
          )}
        </>
      )}

      {/* Synced "now playing" — only in the full/legacy layout; the compact menu
          renders the player separately (always mounted) so audio never stops. */}
      {part === "all" && (
        <SyncedPlayer
          media={media}
          canControl={canControl}
          onStop={() => onSetMedia(null)}
          onUpdateMedia={onUpdateMedia}
        />
      )}
    </div>
  );
}

/** The room's shared media, synced (roughly) to all members via the start offset.
 * The owner/host can Pause/Resume + Mute-for-all + Stop — all synced to everyone.
 * Voice chat is a SEPARATE track and is never muted by media playback. */
function SyncedPlayer({
  media,
  canControl,
  onStop,
  onUpdateMedia,
}: {
  media: RoomMedia | null;
  canControl: boolean;
  onStop: () => void;
  onUpdateMedia: (patch: Partial<RoomMedia>) => void;
}) {
  const ref = useRef<HTMLMediaElement | null>(null);
  // App-level Maximize / Minimize for the VIDEO (available to everyone — it's a
  // viewing control, not a playback control). Toggling only restyles the same
  // element (no re-mount), so playback keeps going.
  const [maximized, setMaximized] = useState(false);
  // Live playback position + length for the custom (stylish) audio player. Fed by
  // the audio element's own timeupdate/metadata events, so the bar shows the true
  // position for everyone.
  const [curTime, setCurTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState<number | null>(null); // while the host drags the bar
  // Where playback should be: frozen position while paused, else live offset.
  const startSec = useMemo(
    () =>
      media
        ? media.paused
          ? Math.max(0, Math.floor(media.pausedAtSec ?? 0))
          : Math.max(0, Math.floor((Date.now() - media.startedAt) / 1000))
        : 0,
    [media?.src, media?.startedAt, media?.paused, media?.pausedAtSec],
  );

  // Enforce the shared paused / muted-for-all state AND re-sync the playback
  // POSITION on every member's player — so the host's pause / resume / skip keeps
  // everyone together (not just at first load). Runs whenever the shared timeline
  // (startedAt / pausedAtSec / paused / muted) changes for anyone in the room.
  useEffect(() => {
    const el = ref.current;
    if (!el || !media || media.kind === "youtube") return;
    el.muted = !!media.mutedForAll;
    if (media.paused) {
      el.pause();
      const target = Math.max(0, Math.floor(media.pausedAtSec ?? 0));
      if (Number.isFinite(el.duration) && Math.abs(el.currentTime - target) > 1) {
        try { el.currentTime = target; } catch { /* seek not ready */ }
      }
    } else {
      const target = Math.max(0, Math.floor((Date.now() - media.startedAt) / 1000));
      if (Number.isFinite(el.duration) && Math.abs(el.currentTime - target) > 1.5) {
        try { el.currentTime = target; } catch { /* seek not ready */ }
      }
      el.play().catch(() => {});
    }
  }, [media?.paused, media?.mutedForAll, media?.src, media?.startedAt, media?.pausedAtSec]);

  if (!media) return null;

  const togglePause = () => {
    if (media.paused) {
      onUpdateMedia({ paused: false, startedAt: Date.now() - (media.pausedAtSec ?? 0) * 1000 });
    } else {
      const pos = ref.current?.currentTime ?? Math.floor((Date.now() - media.startedAt) / 1000);
      onUpdateMedia({ paused: true, pausedAtSec: Math.floor(pos) });
    }
  };

  // Host drags the progress bar → BROADCAST the new position (via startedAt /
  // pausedAtSec) so EVERY listener jumps to the same spot — the seek "works for
  // all users", not just the host's own device.
  const seekTo = (sec: number) => {
    const s = Math.max(0, Math.min(Math.floor(sec), Math.floor(duration || sec)));
    if (media.paused) onUpdateMedia({ pausedAtSec: s });
    else onUpdateMedia({ startedAt: Date.now() - s * 1000 });
  };
  const fmtT = (t: number) => {
    const s = Math.max(0, Math.floor(t));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const shownTime = seeking ?? curTime;

  const isVideoMedia = media.kind === "video" || media.kind === "youtube";
  const canMaximize = isVideoMedia || media.kind === "image"; // images can go full-screen too
  const hasAudioControls = media.kind === "audio" || media.kind === "video"; // pause/mute only for playable audio
  const overlay = maximized && canMaximize;
  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 flex-col">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-lotus-300">
            <Music className="size-3.5 shrink-0" />
            <span className="truncate">{media.name ? `Now playing: ${media.name}` : "Now playing for everyone"}</span>
          </span>
          {media.ownerName && <span className="truncate pl-[18px] text-[11px] text-mist-400">Played by: {media.ownerName}</span>}
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          {canControl && hasAudioControls && (
            <>
              {/* Audio has a big play/pause in the bar below — video keeps a pill here. */}
              {media.kind === "video" && (
                <button onClick={togglePause} className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-mist-200 hover:bg-white/10">
                  {media.paused ? <><Play className="size-3.5" /> Resume</> : <><Pause className="size-3.5" /> Pause</>}
                </button>
              )}
              <button onClick={() => onUpdateMedia({ mutedForAll: !media.mutedForAll })} className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-mist-200 hover:bg-white/10">
                {media.mutedForAll ? <><Volume2 className="size-3.5" /> Unmute all</> : <><VolumeX className="size-3.5" /> Mute all</>}
              </button>
              <button onClick={onStop} className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/25">
                <Square className="size-3.5" /> Stop
              </button>
            </>
          )}
          {canControl && (media.kind === "youtube" || media.kind === "image") && (
            <button onClick={onStop} className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/25">
              <Square className="size-3.5" /> Stop for all
            </button>
          )}
          {/* Maximize video/image to fill the screen — available to EVERYONE (it's a
              viewing control, not a playback control). Minimize is inside the overlay. */}
          {canMaximize && (
            <button onClick={() => setMaximized(true)} title="Maximize" className="inline-flex items-center gap-1 text-mist-300 hover:text-mist-100">
              <Maximize2 className="size-4" />
            </button>
          )}
        </div>
      </div>
      {media.mutedForAll && hasAudioControls && (
        <p className="mb-1 text-[11px] text-amber-300">🔇 Media muted for the room by the host (voice chat still works).</p>
      )}
      {/* The media element (below) keeps the SAME instance whether inline or
          maximized — we only restyle the wrapper — so maximizing/minimizing
          never restarts or desyncs playback. */}
      <div className={overlay ? "fixed inset-0 z-[120] flex flex-col bg-black/95 p-3" : ""}>
        {overlay && (
          <div className="mb-2 flex items-center justify-between text-white">
            <span className="min-w-0 truncate text-sm font-semibold">{media.name ? `Now playing: ${media.name}` : "Now playing"}</span>
            <button onClick={() => setMaximized(false)} title="Minimize" className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold hover:bg-white/20">
              <Minimize2 className="size-4" /> Minimize
            </button>
          </div>
        )}
        <div className={overlay ? "min-h-0 flex-1" : ""}>
          {media.kind === "youtube" ? (
            <div className={overlay ? "size-full" : "aspect-video w-full overflow-hidden rounded-lg"}>
              <iframe
                src={`${media.src}${media.src.includes("?") ? "&" : "?"}autoplay=1&start=${startSec}`}
                title="Now playing"
                className="size-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : media.kind === "video" ? (
            <video
              ref={ref as React.RefObject<HTMLVideoElement>}
              key={media.src}
              src={media.src}
              controls={canControl}
              autoPlay
              playsInline
              muted={!!media.mutedForAll}
              onLoadedMetadata={(e) => {
                if (startSec) e.currentTarget.currentTime = startSec;
              }}
              onEnded={() => { if (canControl) onStop(); }}
              className={overlay ? "size-full bg-black object-contain" : "w-full rounded-lg"}
            />
          ) : media.kind === "image" ? (
            // A shared image shown to everyone in the room (tap Maximize to enlarge).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={media.src}
              alt={media.name || "Shared image"}
              className={overlay ? "size-full bg-black object-contain" : "max-h-96 w-full rounded-lg bg-ink-900 object-contain"}
            />
          ) : (
            <>
              {/* Hidden audio element — the actual playback; the STYLISH bar below
                  drives it. No native controls (they only moved the host's own
                  device and desynced everyone else). */}
              <audio
                ref={ref as React.RefObject<HTMLAudioElement>}
                key={media.src}
                src={media.src}
                autoPlay
                muted={!!media.mutedForAll}
                onLoadedMetadata={(e) => { if (startSec) e.currentTarget.currentTime = startSec; setDuration(e.currentTarget.duration || 0); }}
                onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
                onTimeUpdate={(e) => { if (seeking === null) setCurTime(e.currentTarget.currentTime); }}
                onEnded={() => { if (canControl) onStop(); }}
                className="hidden"
              />
              {/* Stylish player: gradient card, big play/pause, a synced seek bar
                  (host-draggable → jumps EVERYONE to the same spot). */}
              <div className="mt-1 flex items-center gap-3 rounded-2xl border border-lotus-400/20 bg-gradient-to-r from-lotus-500/10 via-ink-850 to-fuchsia-500/10 p-3">
                {canControl ? (
                  <button
                    onClick={togglePause}
                    className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-lotus-500 to-fuchsia-500 text-white shadow-lg transition hover:brightness-110 active:scale-95"
                    title={media.paused ? "Resume for everyone" : "Pause for everyone"}
                  >
                    {media.paused ? <Play className="size-5" /> : <Pause className="size-5" />}
                  </button>
                ) : (
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-lotus-500/15 text-lotus-300">
                    {media.paused ? <Pause className="size-5" /> : <AudioLines className="size-5 animate-pulse" />}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <input
                    type="range"
                    min={0}
                    max={Math.max(1, Math.floor(duration || 0))}
                    value={Math.min(shownTime, duration || shownTime)}
                    disabled={!canControl || !duration}
                    onChange={(e) => setSeeking(Number(e.target.value))}
                    onPointerUp={() => { if (seeking !== null) { setCurTime(seeking); seekTo(seeking); setSeeking(null); } }}
                    onTouchEnd={() => { if (seeking !== null) { setCurTime(seeking); seekTo(seeking); setSeeking(null); } }}
                    className="lotus-range h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-lotus-400 disabled:cursor-default"
                    aria-label="Seek"
                  />
                  <div className="mt-1 flex items-center justify-between text-[11px] font-medium text-mist-400">
                    <span>{fmtT(shownTime)}</span>
                    <span>{duration ? fmtT(duration) : "--:--"}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Group text chat ----------
interface ChatMsg {
  id: string;
  fromMe: boolean;
  author: string;
  text: string;
  at?: string;
  // Sender identity — lets the chat link to their profile + offer actions.
  userId: string;
  fullName: string;
  username: string;
  publicId?: string;
  avatar: string;
  // Sticker / image / video / audio / file messages carry media instead of text.
  type?: string;
  mediaUrl?: string;
  mediaName?: string;
  mediaMime?: string;
}

/** "12 Jun, 03:40 pm" — date + time shown on every chat message. */
// Every speaker keeps the SAME name colour for as long as the chat is open, the
// way group chats elsewhere do — the fastest way to tell at a glance who is
// talking when several people are typing at once. Only colours that exist in
// this app's theme are used.
const CHAT_NAME_COLORS = [
  "text-lotus-300", "text-emerald-300", "text-sky-300",
  "text-amber-300", "text-rose-300", "text-gold-300", "text-petal-400",
] as const;
function chatNameColor(key?: string): string {
  if (!key) return CHAT_NAME_COLORS[0];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return CHAT_NAME_COLORS[h % CHAT_NAME_COLORS.length];
}

function chatStamp(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-SA", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

interface ServerChatMsg {
  id: string;
  userId: string;
  userName: string;
  username?: string;
  publicId?: string;
  avatar?: string;
  text: string;
  at: string;
  type?: string;
  mediaUrl?: string;
  mediaName?: string;
  mediaMime?: string;
}

function toChatMsg(m: ServerChatMsg, myId?: string): ChatMsg {
  return {
    id: m.id,
    fromMe: !!myId && m.userId === myId,
    author: (m.userName || "Member").split(" ")[0],
    text: m.text,
    at: m.at,
    userId: m.userId,
    fullName: m.userName || "Member",
    username: m.username || "",
    publicId: m.publicId,
    avatar: m.avatar || "",
    type: m.type,
    mediaUrl: m.mediaUrl,
    mediaName: m.mediaName,
    mediaMime: m.mediaMime,
  };
}

function RoomChat({
  roomId,
  myId,
  meName,
  locked,
  canManage,
  manualLocked,
  autoLockChat,
  onToggleManualLock,
  onToggleAutoLock,
  onOpenUser,
  giftButton,
  onSticker,
  fullScreen = false,
  fill = false,
  onToggleFullScreen,
  onOpenBoth,
  roomName,
  peopleCount,
}: {
  roomId: string;
  myId?: string;
  meName: string;
  locked: boolean;
  canManage: boolean;
  manualLocked: boolean;
  autoLockChat: boolean;
  onToggleManualLock: () => void;
  onToggleAutoLock: () => void;
  onOpenUser: (u: SpeakerUser) => void;
  giftButton?: ReactNode;         // compact Gift control, shown in the chat input row
  onSticker?: () => void;         // open the sticker/emoji panel from the chat input row
  fullScreen?: boolean;           // render as a dedicated full-screen chat screen
  fill?: boolean;                 // fill the height the parent gives it (Seats + Chat view)
  onToggleFullScreen?: () => void;
  onOpenBoth?: () => void;        // open the combined Seats + Chat screen
  roomName?: string;              // shown in the full-screen header
  peopleCount?: number;
}) {
  const { toast: chatToast } = useToast();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [uploadingChat, setUploadingChat] = useState(false);
  const chatFileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Only auto-scroll to the newest message when the reader is ALREADY at the bottom.
  // Without this, the 5s poll (which replaces the list every cycle) yanked a reader
  // who had scrolled UP to read history straight back down — making older messages
  // impossible to read. `stickToBottom` tracks whether they're near the bottom; a
  // reader who scrolls up is left in place, and a "New messages" pill lets them jump
  // back down when they choose. Defaults true so a fresh chat still follows new lines.
  const stickToBottom = useRef(true);
  const [hasNewBelow, setHasNewBelow] = useState(false);
  const onChatScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (stickToBottom.current) setHasNewBelow(false);
  };
  const jumpToLatest = () => {
    stickToBottom.current = true;
    setHasNewBelow(false);
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  };

  // Show a brief "chat reopened" notice when a moderator becomes active.
  const [justReopened, setJustReopened] = useState(false);
  const prevLocked = useRef(locked);
  useEffect(() => {
    if (prevLocked.current && !locked) {
      setJustReopened(true);
      const t = setTimeout(() => setJustReopened(false), 5000);
      prevLocked.current = locked;
      return () => clearTimeout(t);
    }
    prevLocked.current = locked;
  }, [locked]);

  // Load + poll the room's shared chat so EVERY member sees the same messages.
  useEffect(() => {
    let on = true;
    const load = async () => {
      if (typeof document !== "undefined" && document.hidden) return; // pause when backgrounded
      try {
        const res = await fetch(withBase(`/api/rooms/${roomId}/chat`), { credentials: "include", cache: "no-store" });
        const data = await res.json();
        if (!on) return;
        const list = ((data.messages as ServerChatMsg[]) ?? []).map((m) => toChatMsg(m, myId));
        setMessages(list);
      } catch {
        /* ignore */
      }
    };
    load();
    const t = setInterval(load, 5000);
    return () => { on = false; clearInterval(t); };
  }, [roomId, myId]);

  // Track the newest message id so the poll (which replaces the array every 5s even
  // when nothing changed) can't raise a false "New messages" flag.
  const lastMsgIdRef = useRef<string | null>(null);
  useEffect(() => {
    const lastId = messages.length ? messages[messages.length - 1].id : null;
    const grew = lastId !== null && lastId !== lastMsgIdRef.current;
    lastMsgIdRef.current = lastId;
    // Only move the chat when a message ACTUALLY arrived — NOT on every 5s poll (the
    // poll replaces the array each time, so the old code auto-scrolled every 5s, which
    // read as the screen "automatically moving"). Instant jump (no smooth animation).
    if (!grew) return;
    if (stickToBottom.current) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    else setHasNewBelow(true); // a new message arrived while scrolled up
  }, [messages]);

  const send = async () => {
    if (locked) return;
    const body = text.trim();
    if (!body) return;
    setText("");
    stickToBottom.current = true; // sending my own message always follows to the bottom
    setHasNewBelow(false);
    // Optimistic append (replaced by the server copy on the next poll).
    const tmpId = `tmp_${Date.now()}`;
    setMessages((m) => [...m, { id: tmpId, fromMe: true, author: meName.split(" ")[0], text: body, userId: myId ?? "", fullName: meName, username: "", avatar: "" }]);
    try {
      const post = await fetch(withBase(`/api/rooms/${roomId}/chat`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: body }),
      });
      // SAFETY NET: if the server rejected it (chat locked), remove the message
      // so nothing ever appears, and tell the user why.
      if (!post.ok) {
        setMessages((m) => m.filter((x) => x.id !== tmpId));
        const d = (await post.json().catch(() => ({}))) as { error?: string };
        chatToast(d.error || "Your message could not be sent — the chat is locked.", "info");
        return;
      }
      // Pull the canonical list so other members' messages show too.
      const res = await fetch(withBase(`/api/rooms/${roomId}/chat`), { credentials: "include", cache: "no-store" });
      const data = await res.json();
      const list = ((data.messages as ServerChatMsg[]) ?? []).map((m) => toChatMsg(m, myId));
      setMessages(list);
    } catch {
      /* ignore */
    }
  };

  // Upload + send a photo / video / audio / document to the group chat.
  const sendMedia = async (file?: File) => {
    if (!file || locked || uploadingChat) return;
    if (file.size > 50 * 1024 * 1024) { chatToast("File is too large (max 50 MB).", "error"); return; }
    const type = file.type.startsWith("image") ? "image" : file.type.startsWith("video") ? "video" : file.type.startsWith("audio") ? "audio" : "file";
    setUploadingChat(true);
    try {
      const up = await uploadFile(file, "chatmedia");
      if (!up.ok || !up.file) { chatToast(up.error ?? "Upload failed", "error"); return; }
      const post = await fetch(withBase(`/api/rooms/${roomId}/chat`), {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ type, mediaUrl: up.file.url, mediaName: up.file.originalName, mediaMime: file.type }),
      });
      if (!post.ok) { const d = (await post.json().catch(() => ({}))) as { error?: string }; chatToast(d.error || "Could not send the file.", "info"); return; }
      stickToBottom.current = true; setHasNewBelow(false);
      const res = await fetch(withBase(`/api/rooms/${roomId}/chat`), { credentials: "include", cache: "no-store" });
      const data = await res.json();
      setMessages(((data.messages as ServerChatMsg[]) ?? []).map((m) => toChatMsg(m, myId)));
    } catch { chatToast("Could not send the file.", "error"); }
    finally { setUploadingChat(false); }
  };

  return (
    // THREE SHAPES, ONE CHAT. In the room it's a card under the seats; opened full
    // screen it becomes its own screen — header, a message area that takes ALL the
    // remaining height so you can scroll back through the history, and the input
    // pinned to the bottom. `fill` is the third: the same card, but stretched to
    // whatever height the Seats + Chat screen hands it. Same component in all
    // three, so the messages, the sender colours and the sending logic can never
    // drift apart between them.
    <div
      className={cn(
        fullScreen
          ? "fixed inset-0 z-[80] flex flex-col bg-ink-950"
          : fill
            ? "flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-850/60 p-4"
            : "mt-4 rounded-2xl border border-white/10 bg-ink-850/60 p-4",
      )}
      id={`chat-${roomId}`}
    >
      {/* Full-screen header — room identity + a clear way back. */}
      {fullScreen && (
        <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-ink-900 px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))]">
          <button
            onClick={onToggleFullScreen}
            title="Back to the room"
            className="grid size-9 shrink-0 place-items-center rounded-full text-mist-300 transition hover:bg-white/[0.06] hover:text-mist-100"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-mist-100">{roomName || "Group chat"}</p>
            <p className="text-[11px] text-mist-500">
              Group chat{typeof peopleCount === "number" ? ` · ${peopleCount} in room` : ""}
            </p>
          </div>
          <button
            onClick={onToggleFullScreen}
            title="Close"
            className="grid size-9 shrink-0 place-items-center rounded-full text-mist-400 transition hover:bg-white/[0.06] hover:text-mist-100"
          >
            <X className="size-5" />
          </button>
        </div>
      )}

      <div className={cn("mb-3 flex items-center justify-between gap-2 text-sm font-semibold text-mist-200", fullScreen && "hidden")}>
        <span className="flex flex-wrap items-center gap-2">
          <MessageCircle className="size-4 text-lotus-300" /> Group chat
          {/* Open the chat as its own screen — the whole screen becomes the
              conversation, which is what a busy room needs. */}
          {onToggleFullScreen && !fill && (
            <button
              onClick={onToggleFullScreen}
              title="Open chat in full screen"
              className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-mist-300 transition hover:bg-white/[0.12] hover:text-mist-100"
            >
              <Maximize2 className="size-3" /> Full screen
            </button>
          )}
          {/* …or open the seats AND the chat together on one screen (client
              request). The two single-area options above are unchanged. */}
          {onOpenBoth && !fill && (
            <button
              onClick={onOpenBoth}
              title="Open the seats and the chat together on one screen"
              className="inline-flex items-center gap-1 rounded-full bg-lotus-500/15 px-2.5 py-1 text-[11px] font-semibold text-lotus-200 transition hover:bg-lotus-500/25 hover:text-lotus-100"
            >
              <Columns2 className="size-3" /> Seats + Chat
            </button>
          )}
        </span>
        {canManage && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={onToggleManualLock}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
                manualLocked ? "bg-rose-500/20 text-rose-300" : "bg-ink-800 text-mist-400 hover:text-mist-100",
              )}
              title="Lock the chat now (members can't post until you unlock)"
            >
              {manualLocked ? <Lock className="size-3" /> : <Unlock className="size-3" />}
              {manualLocked ? "Locked" : "Lock chat"}
            </button>
            <button
              onClick={onToggleAutoLock}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
                autoLockChat ? "bg-amber-500/15 text-amber-300" : "bg-ink-800 text-mist-400 hover:text-mist-100",
              )}
              title="Automatically lock the chat when no host/co-host is present"
            >
              Auto-lock: {autoLockChat ? "On" : "Off"}
            </button>
          </div>
        )}
      </div>
      {canManage && manualLocked && (
        <div className="mb-2 flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
          <Lock className="mt-0.5 size-3 shrink-0" />
          <span>You locked the chat. <span className="font-semibold">Members can&apos;t post</span> until you tap <span className="font-semibold">Locked</span> to unlock. You &amp; co-hosts can still post.</span>
        </div>
      )}
      {canManage && !manualLocked && autoLockChat && (
        <div className="mb-2 flex items-start gap-2 rounded-xl border border-white/10 bg-ink-800/60 px-3 py-2 text-[11px] text-mist-400">
          <Lock className="mt-0.5 size-3 shrink-0 text-amber-300" />
          <span>Auto-lock is <span className="font-semibold text-amber-300">On</span>: members can&apos;t chat while no host/co-host is in the room. Use <span className="font-semibold">Lock chat</span> to lock it right now.</span>
        </div>
      )}
      {locked && (
        <div className="mb-2 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <Lock className="mt-0.5 size-3.5 shrink-0" />
          <span>{manualLocked ? "The chat has been locked by the host." : "This chat room is temporarily locked. Messages can be sent once the Host or Co-Host joins the room."}</span>
        </div>
      )}
      {justReopened && !locked && (
        <div className="mb-2 flex items-start gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          <Unlock className="mt-0.5 size-3.5 shrink-0" />
          <span>The Host/Co-Host is now active. The chat room has been reopened.</span>
        </div>
      )}
      {/* Full screen: this takes ALL the leftover height, so the whole screen is
          scrollable history. In the card it keeps its measured height. */}
      <div className={cn("relative", fullScreen && "min-h-0 flex-1 px-3", fill && "min-h-0 flex-1")}>
      <div
        ref={scrollRef}
        onScroll={onChatScroll}
        className={cn(
          "overflow-y-auto pr-1",
          fullScreen ? "h-full pt-3" : fill ? "h-full" : "h-[min(46vh,440px)] min-h-[240px] sm:h-[min(50vh,440px)]",
        )}
      >
        {messages.length === 0 && (
          <div className="grid h-full place-items-center px-4 text-center text-sm text-mist-500">
            <span>No messages yet — say hi to the room! 👋</span>
          </div>
        )}
        {/* WHO IS SPEAKING. Each incoming message carries its sender's photo, and
            every speaker keeps one name colour. Runs from the same person are
            grouped and the gap between DIFFERENT speakers is wider than the gap
            inside a run, so a name can never look like it belongs to the message
            above it — which is exactly how it read before. */}
        {messages.map((m, i) => {
          const prev = i > 0 ? messages[i - 1] : undefined;
          const sameSender = !!prev && prev.fromMe === m.fromMe && (m.fromMe || prev.userId === m.userId);
          const startsRun = !sameSender;
          return (
          <div
            key={m.id}
            className={cn(
              "flex gap-2",
              m.fromMe ? "justify-end" : "justify-start",
              i === 0 ? "" : startsRun ? "mt-3" : "mt-1",
            )}
          >
            {/* Avatar rail — kept even mid-run so the bubbles stay lined up. */}
            {!m.fromMe && (
              <div className="w-8 shrink-0">
                {startsRun && (
                  <button
                    type="button"
                    onClick={() => m.userId && onOpenUser({ id: m.userId, fullName: m.fullName, username: m.username, avatar: m.avatar, verified: false })}
                    title={`Options for ${m.fullName}`}
                    className="block"
                  >
                    <Avatar name={m.fullName} src={m.avatar} size="xs" />
                  </button>
                )}
              </div>
            )}
            <div className="min-w-0 max-w-[78%]">
              {startsRun && (
              <span className={cn("mb-1 flex flex-wrap items-baseline gap-x-1.5 px-1 text-xs", m.fromMe ? "justify-end" : "justify-start")}>
                {m.fromMe ? (
                  <span className="font-bold text-mist-200">You</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => m.userId && onOpenUser({ id: m.userId, fullName: m.fullName, username: m.username, avatar: m.avatar, verified: false })}
                    className={cn("font-bold underline-offset-2 hover:underline", chatNameColor(m.userId || m.fullName))}
                    title={`Options for ${m.fullName}`}
                  >
                    {m.fullName}
                  </button>
                )}
                {/* Sender's permanent ID beside their name in room chat. */}
                {!m.fromMe && m.publicId && <span className="font-mono text-[10px] text-mist-500">ID {m.publicId}</span>}
                {m.at && <span className="text-[10px] text-mist-500">{chatStamp(m.at)}</span>}
              </span>
              )}
              {/* Media (sticker / image / video / audio / file) shows without a chat
                  bubble, the way messaging apps do. */}
              {(m.type === "sticker" || m.type === "image") && m.mediaUrl ? (
                <div className={cn("flex", m.fromMe ? "justify-end" : "justify-start")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={withBase(m.mediaUrl)}
                    alt={m.type === "sticker" ? "Sticker" : "Photo"}
                    loading="lazy"
                    className={cn("rounded-xl object-contain", m.type === "sticker" ? "size-28" : "max-h-56 max-w-[13rem]")}
                  />
                </div>
              ) : m.type === "video" && m.mediaUrl ? (
                <div className={cn("flex", m.fromMe ? "justify-end" : "justify-start")}>
                  {/* playsInline keeps a chat video INSIDE the page. Without it iOS
                      (and some Androids) open a full-screen player, which backgrounds
                      the page and interrupts the voice connection. */}
                  <video src={withBase(m.mediaUrl)} controls playsInline preload="metadata" className="max-h-56 max-w-[13rem] rounded-xl bg-black" />
                </div>
              ) : m.type === "audio" && m.mediaUrl ? (
                <div className={cn("flex", m.fromMe ? "justify-end" : "justify-start")}>
                  <audio src={withBase(m.mediaUrl)} controls preload="metadata" className="max-w-[14rem]" />
                </div>
              ) : m.type === "file" && m.mediaUrl ? (
                <div className={cn("flex", m.fromMe ? "justify-end" : "justify-start")}>
                  <a href={withBase(m.mediaUrl)} download={m.mediaName} target="_blank" rel="noopener noreferrer"
                    className="inline-flex max-w-[14rem] items-center gap-2 rounded-xl border border-line bg-ink-800 px-3 py-2 text-xs text-mist-100 transition hover:border-lotus-400/50">
                    <FileText className="size-4 shrink-0 text-lotus-300" />
                    <span className="truncate">{m.mediaName || "Document"}</span>
                  </a>
                </div>
              ) : (
                <div
                  className={cn(
                    "rounded-[var(--bubble-radius,1rem)] px-3.5 py-2 text-[length:var(--bubble-font,0.875rem)]",
                    m.fromMe
                      ? "rounded-br-md bg-lotus-600 text-white"
                      : "rounded-bl-md bg-ink-800 text-mist-100",
                  )}
                >
                  {m.text}
                </div>
              )}
            </div>
          </div>
          );
        })}
      </div>
        {/* When the reader has scrolled up and new messages arrive, offer a jump-down
            instead of yanking them to the bottom (so chat history stays readable). */}
        {hasNewBelow && (
          <button onClick={jumpToLatest} className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-lotus-600 px-3 py-1 text-xs font-semibold text-white shadow-lg ring-1 ring-white/15 transition hover:bg-lotus-500">
            New messages ↓
          </button>
        )}
      </div>
      {/* THE COMPOSER IS DOCKED (client request: "keep the message/chat section
          fixed at the bottom for easy access"). It sticks to the bottom of the
          screen while you're reading the chat, so you never scroll to reach it —
          and it clears the mobile bottom nav (and the phone's home indicator)
          rather than hiding underneath them. */}
      <div
        className={cn(
          "z-20 border-t border-white/10 bg-ink-850/95 py-2.5 backdrop-blur-md",
          fullScreen
            // Own screen: the last row of the flex column — always on screen, and
            // clear of the phone's home indicator.
            ? "shrink-0 px-3 pb-[max(0.625rem,env(safe-area-inset-bottom))]"
            : fill
              // Seats + Chat: the last row of the chat pane, so the composer is
              // always reachable without the seats above it moving.
              ? "shrink-0 -mx-4 -mb-4 mt-3 rounded-b-2xl px-4 pb-[max(0.625rem,env(safe-area-inset-bottom))]"
              // In the room card: docked to the bottom of the viewport, above the
              // app's bottom menu bar.
              : "sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] -mx-4 -mb-4 mt-3 rounded-b-2xl px-4 lg:bottom-0",
        )}
      >
        <div className="flex items-center gap-1.5">
          {/* Attach a photo / video / audio / document */}
          <input ref={chatFileRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" hidden onChange={(e) => { sendMedia(e.target.files?.[0]); e.target.value = ""; }} />
          {/* THE MESSAGE BOX MUST ALWAYS FIT. In the narrow Seats + Chat column
              on a phone, four fixed-width buttons beside the input squeezed it
              down to a few pixels — the send arrow was pushed off screen and
              there was no visible way to send a message at all. Attach, sticker
              and gift are hidden there (they are all in the options rail beside
              the chat), leaving the input and Send with the full width. */}
          <button
            onClick={() => chatFileRef.current?.click()}
            disabled={locked || uploadingChat}
            title="Send a photo, video or file"
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full text-mist-400 transition hover:bg-white/[0.06] hover:text-mist-100 disabled:opacity-40",
              fill && "hidden lg:grid",
            )}
          >
            {uploadingChat ? <Loader2 className="size-[18px] animate-spin" /> : <Paperclip className="size-[18px]" />}
          </button>
          {/* Sticker / emoji panel — reachable right from the chat input (client request). */}
          {onSticker && (
            <button
              onClick={onSticker}
              title="Send a sticker / emoji"
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-full text-lotus-300 transition hover:bg-white/[0.06] hover:text-lotus-200",
                fill && "hidden lg:grid",
              )}
            >
              <Sticker className="size-[18px]" />
            </button>
          )}
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={locked}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={locked ? "Chat is locked until a host/co-host joins…" : "Message the group…"}
            className="h-10 min-w-0 flex-1 rounded-full border border-line bg-ink-900 px-4 text-sm text-mist-100 outline-none placeholder:text-mist-500 focus:border-lotus-400 disabled:opacity-60"
          />
          {/* Gift — beside the input so it's always reachable without scrolling.
              Hidden in the narrow phone column, where it is in the rail instead. */}
          {giftButton && <span className={fill ? "hidden lg:contents" : "contents"}>{giftButton}</span>}
          <button
            onClick={send}
            disabled={!text.trim() || locked}
            title="Send"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-lotus-600 text-white transition-colors hover:bg-lotus-500 disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** ADMIN VISIBILITY — Show Admin / Hide Admin for one group (platform admins only).
 *  Hide Admin makes admins invisible to members here: they're stripped from the
 *  member list, the seat grid, the head-count and the voice channel — while
 *  keeping every administrative power (monitor, manage members, settings). */
function AdminVisibilityPanel({ hidden, onToggle }: { hidden: boolean; onToggle: (hide: boolean) => void }) {
  return (
    <div className="mt-3 rounded-2xl border border-lotus-400/20 bg-ink-850/60 p-3.5">
      <div className="flex items-center gap-3">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", hidden ? "bg-lotus-500/15 text-lotus-300" : "bg-emerald-500/15 text-emerald-300")}>
          {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-mist-100">
            Admin visibility <span className={cn("ml-1 text-[10px] font-bold", hidden ? "text-lotus-300" : "text-emerald-300")}>· {hidden ? "HIDE ADMIN" : "SHOW ADMIN"}</span>
          </p>
          <p className="text-[11px] text-mist-400">
            {hidden
              ? "Admins are invisible to members in this group — but keep full control."
              : "Admins appear in the member list like any other member."}
          </p>
        </div>
        <button
          onClick={() => onToggle(!hidden)}
          role="switch"
          aria-checked={!hidden}
          aria-label="Show admin in this group"
          className={cn("relative h-6 w-11 shrink-0 rounded-full transition", hidden ? "bg-ink-600" : "bg-emerald-500")}
        >
          <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition-all", hidden ? "left-0.5" : "left-[22px]")} />
        </button>
      </div>
      <p className="mt-2 px-0.5 text-[11px] text-mist-500">
        Hidden admins can still monitor the group, manage members, enter at any time and perform every administrative action. Note: while hidden you listen only — switch to Show Admin to speak.
      </p>
    </div>
  );
}

// Labels for member-permission toggles (also used for the toast text).
const PERM_LABEL: Record<string, string> = { seat: "Seats", mic: "Microphone", camera: "Camera", chat: "Chat", games: "Games" };

type PermKey = "seat" | "mic" | "camera" | "chat" | "games";

// Host / Co-Host control panel: what NON-host/co-host members may do. Every
// permission is OFF (host & co-hosts only) by default — the host unlocks each as
// needed. Music/video PLAYBACK controls are always host & co-host only (v70).
function MemberPermsPanel({
  perms,
  onToggle,
}: {
  perms: { seat?: boolean; mic?: boolean; camera?: boolean; chat?: boolean; games?: boolean };
  onToggle: (key: PermKey, value: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const rows: { key: PermKey; label: string; hint: string; icon: typeof Mic }[] = [
    { key: "seat", label: "Take a seat", hint: "Members can join a speaking seat", icon: UserCheck },
    { key: "mic", label: "Microphone", hint: "Members can talk on the mic", icon: Mic },
    { key: "camera", label: "Camera", hint: "Members can turn on their camera", icon: Video },
    { key: "chat", label: "Chat", hint: "Members can send messages", icon: MessageCircle },
    { key: "games", label: "Games", hint: "Members can start & play games", icon: Gamepad2 },
  ];
  const onCount = rows.filter((r) => perms[r.key] !== false).length;
  return (
    <div className="mt-3 rounded-2xl border border-lotus-400/20 bg-ink-850/60 p-3.5">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-left">
        <ShieldCheck className="size-4 shrink-0 text-lotus-300" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-mist-100">Member permissions</p>
          <p className="text-[11px] text-mist-400">What normal members can do · {onCount}/5 allowed · tap to {open ? "hide" : "manage"}</p>
        </div>
        <ChevronDown className={cn("size-4 shrink-0 text-mist-400 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-3 space-y-1.5">
          <p className="px-0.5 text-[11px] text-mist-500">On = every member can do it (the normal setting). Turn a switch off to restrict it to just you &amp; co-hosts. Music / video playback is always host &amp; co-host only.</p>
          {rows.map((r) => {
            const on = perms[r.key] !== false;
            const Icon = r.icon;
            return (
              <div key={r.key} className="flex items-center gap-3 rounded-xl border border-line bg-ink-800 px-3 py-2.5">
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", on ? "bg-emerald-500/15 text-emerald-300" : "bg-ink-700 text-mist-400")}><Icon className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-mist-100">{r.label} <span className={cn("ml-1 text-[10px] font-bold", on ? "text-emerald-300" : "text-mist-500")}>{on ? "· ON" : "· OFF"}</span></p>
                  <p className="truncate text-[11px] text-mist-500">{r.hint}</p>
                </div>
                <button
                  onClick={() => onToggle(r.key, !on)}
                  role="switch"
                  aria-checked={on}
                  aria-label={`${r.label} for members`}
                  className={cn("relative h-6 w-11 shrink-0 rounded-full transition", on ? "bg-emerald-500" : "bg-ink-600")}
                >
                  <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition-all", on ? "left-[22px]" : "left-0.5")} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Uniform "control card" styling for the room's TOP menu bar (Games · Gift ·
// Media · Option · Minimize) — a rounded card with a coloured icon + label,
// matching the client's reference design.
// `room-ctrl` is a marker class, not a style: it lets the mobile Seats + Chat
// rail restyle these into a narrow vertical strip (icon over label) from one
// place, without any of them needing to know about that view.
const ROOM_CTRL_PILL = "room-ctrl flex items-center justify-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-mist-100 transition hover:bg-white/[0.08] active:scale-95";

// "Options" menu — room-wide actions: Manage room (host/co-host), Invite, Share.
// The five per-group admin tools that used to be reachable ONLY from Admin →
// Rooms. Each opens the SAME panel there, for this group, via a deep link — so
// there is one implementation of each, not two that drift apart.
const ADMIN_ROOM_TOOLS: { key: string; label: string; desc: string; icon: LucideIcon; tone: string }[] = [
  { key: "activity", label: "Activity", desc: "Who joined and who left this group", icon: Radio, tone: "bg-sky-500/15 text-sky-300" },
  { key: "manage", label: "Manage group", desc: "Owner, co-hosts, members, suspend or restore", icon: Settings, tone: "bg-lotus-500/15 text-lotus-300" },
  { key: "actions", label: "Actions", desc: "Moderation actions on this group", icon: SlidersHorizontal, tone: "bg-amber-500/15 text-amber-300" },
  { key: "report", label: "Report", desc: "Full report — members, blocks, reports, gifts, features", icon: ScrollText, tone: "bg-emerald-500/15 text-emerald-300" },
  { key: "reset", label: "Reset", desc: "Reset this group's settings or a stuck game", icon: RotateCcw, tone: "bg-rose-500/15 text-rose-300" },
];

function RoomOptionsMenu({ roomId, roomName, isPaidZone, canManage, onManage, voiceLocked, seatApprovalManual, onToggleMuteAll, onToggleSeatApproval, isAdmin }: { roomId: string; roomName: string; isPaidZone: boolean; canManage: boolean; onManage: () => void; voiceLocked?: boolean; seatApprovalManual?: boolean; onToggleMuteAll?: () => void; onToggleSeatApproval?: () => void; isAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const item = "flex w-full items-center gap-3 rounded-xl border border-line bg-ink-800 px-3.5 py-3 text-left text-sm font-semibold text-mist-100 transition hover:bg-ink-700";
  return (
    <>
      <button onClick={() => setOpen(true)} title="Options" className={ROOM_CTRL_PILL}>
        <Settings className="size-5 text-sky-400" /> Option
      </button>
      {open && (
        <div className="fixed inset-0 z-[110] grid place-items-end bg-black/60 sm:place-items-center sm:p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-white/10 bg-ink-900 p-3 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="flex items-center gap-2 font-display text-base font-bold text-mist-100"><Settings className="size-5 text-sky-400" /> Options</h2>
              <button onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-lg text-mist-400 hover:bg-white/[0.06] hover:text-mist-100"><X className="size-5" /></button>
            </div>
            <div className="space-y-1.5">
              {/* HOST / CO-HOST management — surfaced here so it's one tap away in
                  EVERY room type (public, private, all categories). */}
              {canManage && (
                <>
                  <p className="px-1 pt-1 text-[11px] font-bold uppercase tracking-wide text-mist-500">Host controls</p>
                  {onToggleMuteAll && (
                    <button onClick={onToggleMuteAll} className={item}>
                      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", voiceLocked ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/15 text-emerald-300")}>{voiceLocked ? <Lock className="size-4" /> : <Mic className="size-4" />}</span>
                      <span className="flex-1">{voiceLocked ? "Allow voice (unmute all)" : "Mute all seats"}<span className="block text-[11px] font-normal text-mist-500">{voiceLocked ? "Members are muted — only host/co-hosts speak" : "Silence all members instantly"}</span></span>
                    </button>
                  )}
                  {onToggleSeatApproval && (
                    <button onClick={onToggleSeatApproval} className={item}>
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-amber-300">{seatApprovalManual ? <Hand className="size-4" /> : <UserCheck className="size-4" />}</span>
                      <span className="flex-1">Seat approval: {seatApprovalManual ? "Approve" : "Auto"}<span className="block text-[11px] font-normal text-mist-500">{seatApprovalManual ? "Every seat request needs your approval" : "Members join a seat instantly — tap to require approval"}</span></span>
                    </button>
                  )}
                  <button onClick={() => { setOpen(false); onManage(); }} className={item}>
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-lotus-500/15 text-lotus-300"><Settings className="size-4" /></span>
                    <span className="flex-1">Manage room (all)<span className="block text-[11px] font-normal text-mist-500">Name, seats, co-hosts, member permissions, room picture &amp; more</span></span>
                  </button>
                </>
              )}
              {isPaidZone
                ? <p className="px-1 py-3 text-center text-xs text-mist-500">This is a private call — no invite or share options.</p>
                : <>
                    <RoomInviteFriends roomId={roomId} variant="row" />
                    <RoomShare roomName={roomName} variant="row" />
                  </>}

              {/* ADMIN TOOLS, inside the group. These controls existed only on
                  Admin → Rooms, so an administrator had to leave the group to
                  reach them. Each one opens that same panel for THIS group. */}
              {isAdmin && (
                <>
                  <p className="px-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-mist-500">Admin tools — this group</p>
                  {ADMIN_ROOM_TOOLS.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => { setOpen(false); router.push(`/admin/rooms?room=${encodeURIComponent(roomId)}&open=${t.key}`); }}
                      className={item}
                    >
                      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", t.tone)}><t.icon className="size-4" /></span>
                      <span className="flex-1">{t.label}<span className="block text-[11px] font-normal text-mist-500">{t.desc}</span></span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// "Minimize" — its own button: keep voice live and browse the rest of the app.
function MinimizeButton() {
  const router = useRouter();
  const { toast } = useToast();
  return (
    <button
      onClick={() => { toast("Room minimized. You can continue browsing the app.", "info"); router.push("/rooms"); }}
      title="Minimize — stay in voice while you browse"
      className={ROOM_CTRL_PILL}
    >
      <Minimize2 className="size-5 text-emerald-400" /> Minimize
    </button>
  );
}

// "Media" menu — opens the media SELECTION UI. The now-playing player is mounted
// separately (always) so audio keeps playing when this menu is closed.
function MediaButton(props: Omit<React.ComponentProps<typeof MediaPanel>, "part">) {
  const [open, setOpen] = useState(false);
  // When a track actually starts playing, auto-close this selection sheet so it
  // "minimizes" out of the way (the always-mounted Now-Playing bar keeps control).
  const propsAutoClose = {
    ...props,
    onSetMedia: (m: Parameters<typeof props.onSetMedia>[0]) => {
      const r = props.onSetMedia(m);
      if (m) setOpen(false); // picked/started something → close the picker
      return r;
    },
  };
  return (
    <>
      <button onClick={() => setOpen(true)} title="Media" className={ROOM_CTRL_PILL}>
        <Music className="size-5 text-pink-400" /> Media
      </button>
      {open && (
        <div className="fixed inset-0 z-[110] grid place-items-end bg-black/60 sm:place-items-center sm:p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-white/10 bg-ink-900 p-3 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="flex items-center gap-2 font-display text-base font-bold text-mist-100"><Music className="size-5 text-lotus-300" /> Media</h2>
              <button onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-lg text-mist-400 hover:bg-white/[0.06] hover:text-mist-100"><X className="size-5" /></button>
            </div>
            <MediaPanel {...propsAutoClose} part="controls" />
          </div>
        </div>
      )}
    </>
  );
}

// ---------- Game play (group-only) ----------
// Compact "Games" button (sits next to the Gift button, under the seats). Tap it
// to open the 3 games in a popup — same content as the full games panel.
// Always-visible "watch a live game" strip for members who aren't seated for games
// (listeners), so spectating is available to everyone — not just seated players who
// can open the Games popup. Hidden when the room's Spectator Mode is turned off.
function LiveGamesWatch({ roomId, spectatorOn, iAmSeated = false, roomName = "" }: { roomId: string; spectatorOn: boolean; iAmSeated?: boolean; roomName?: string }) {
  const [live, setLive] = useState<{ id: string; game: string; players: string[]; spectators: number }[]>([]);
  useEffect(() => {
    let on = true;
    const fetchLive = async () => {
      try {
        const res = await fetch(withBase(`/api/games/active?room=${encodeURIComponent(roomId)}`), { credentials: "include" });
        const data = await res.json();
        if (on) setLive(data.sessions ?? []);
      } catch { /* ignore */ }
    };
    fetchLive();
    const t = setInterval(fetchLive, 8000);
    return () => { on = false; clearInterval(t); };
  }, [roomId]);
  // Show the strip if the player can spectate OR they're a seated player who can jump
  // back into the running match (client: a quick "Return to Game" from the room).
  if ((!spectatorOn && !iAmSeated) || live.length === 0) return null;
  const q = `?room=${encodeURIComponent(roomId)}&group=${encodeURIComponent(roomName)}&join=1`;
  return (
    <div className="mt-3 space-y-2">
      {live.map((s) => (
        <div key={s.id} className="flex items-center justify-between gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2.5">
          <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-emerald-200">
            <Radio className="size-3.5 shrink-0" /> <span className="truncate">{s.game} is live{s.spectators > 0 ? ` · ${s.spectators} watching` : ""}</span>
          </span>
          {iAmSeated ? (
            <Link href={`/games/${(s.game || "ludo").toLowerCase()}${q}`} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-400">
              <Play className="size-3.5" /> Return to Game
            </Link>
          ) : (
            <Link href={`/watch?session=${s.id}`} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/12 bg-ink-800 px-3 py-1.5 text-xs font-bold text-mist-200 transition hover:bg-ink-700">
              <Eye className="size-3.5" /> Watch
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

function GamesButton({ roomId, roomName, features }: { roomId: string; roomName: string; features?: Record<string, boolean | number | string> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} title="Play a game" className={ROOM_CTRL_PILL}>
        <Gamepad2 className="size-5 text-violet-400" /> Games
      </button>
      {open && (
        <div className="fixed inset-0 z-[110] grid place-items-end bg-black/60 p-0 sm:place-items-center sm:p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-white/10 bg-ink-900 p-3 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-center justify-between px-1">
              <h2 className="flex items-center gap-2 font-display text-base font-bold text-mist-100"><Gamepad2 className="size-5 text-petal-400" /> Games</h2>
              <button onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-lg text-mist-400 hover:bg-white/[0.06] hover:text-mist-100"><X className="size-5" /></button>
            </div>
            {/* Reuse the full games panel (live/ongoing + the 3 games). Tapping a
                game navigates away, which closes this popup. */}
            <GamePanel roomId={roomId} roomName={roomName} features={features} />
          </div>
        </div>
      )}
    </>
  );
}

function GamePanel({ roomId, roomName, features }: { roomId: string; roomName: string; features?: Record<string, boolean | number | string> }) {
  const q = `?room=${encodeURIComponent(roomId)}&group=${encodeURIComponent(roomName)}`;
  const { config } = useConfig();
  // Playable games = enabled built-ins (those with a route). New games added in
  // the admin without a route show as "coming soon" rather than launchable.
  // A per-room game toggle (Admin → Room Settings, e.g. Ludo/Chess) can hide an
  // individual game for THIS room; `!== false` keeps unset = shown, so other rooms
  // and games the admin never touched are unaffected.
  const gameAllowed = (id: string) => features?.[id] !== false;
  const allPlayable = config.games.filter((g) => g.enabled && g.route && gameAllowed(g.id));
  // Board games are played WITH this group (they open a match for the room).
  // Lucky Number and anything else outside /games/ is an app-wide draw, not a
  // group match — listing it under "play with your group" made it look broken.
  const playable = allPlayable.filter((g) => (g.route ?? "").startsWith("/games/"));
  const soloGames = allPlayable.filter((g) => !(g.route ?? "").startsWith("/games/"));
  const comingSoon = config.games.filter((g) => g.enabled && !g.route && gameAllowed(g.id));
  const noneEnabled = playable.length === 0 && soloGames.length === 0 && comingSoon.length === 0;

  // Detect an ongoing game saved for this room → offer "Return to Game".
  const [ongoing, setOngoing] = useState<"ludo" | "chess" | "snake" | null>(null);
  useEffect(() => {
    try {
      const ludo = localStorage.getItem(`lotus.ludo.${roomId}`);
      if (ludo) {
        const g = JSON.parse(ludo);
        if (g && !g.winner && g.players?.length) {
          setOngoing("ludo");
          return;
        }
      }
      const snake = localStorage.getItem(`lotus.snake.${roomId}`);
      if (snake) {
        const g = JSON.parse(snake);
        if (g && !g.winner && g.players?.length) {
          setOngoing("snake");
          return;
        }
      }
      const chess = localStorage.getItem(`lotus.chess.${roomId}`);
      if (chess) {
        const g = JSON.parse(chess);
        if (g && (g.status === "playing" || g.status === "check") && !g.winner) setOngoing("chess");
      }
    } catch {
      /* ignore */
    }
  }, [roomId]);

  const ongoingLabel = ongoing === "ludo" ? "Ludo" : ongoing === "chess" ? "Chess" : "Snake & Ladder";

  // Live games happening in this room right now → offer "Watch" (spectator mode).
  const [live, setLive] = useState<{ id: string; game: string; players: string[]; spectators: number }[]>([]);
  useEffect(() => {
    let on = true;
    const fetchLive = async () => {
      try {
        const res = await fetch(withBase(`/api/games/active?room=${encodeURIComponent(roomId)}`), { credentials: "include" });
        const data = await res.json();
        if (on) setLive(data.sessions ?? []);
      } catch {
        /* ignore */
      }
    };
    fetchLive();
    const t = setInterval(fetchLive, 8000);
    return () => {
      on = false;
      clearInterval(t);
    };
  }, [roomId]);

  return (
    <div className="rounded-2xl border border-white/10 bg-ink-850/60 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-mist-200">
        <Gamepad2 className="size-4 text-petal-400" /> Play a game with your group
      </div>
      {live.length > 0 && (
        <div className="mb-3 space-y-2">
          {live.map((s) => {
            const slug = (s.game || "").toLowerCase().split(" ")[0]; // ludo | snake | chess
            return (
              <div key={s.id} className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-2.5">
                <p className="mb-2 flex items-center gap-1.5 px-0.5 text-xs font-semibold text-emerald-200">
                  <Radio className="size-3.5" /> {s.game} is live{s.spectators > 0 ? ` · ${s.spectators} watching` : ""}
                </p>
                {/* TWO clear, separate choices: Rejoin as a player, or just Watch. */}
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href={`/games/${slug}${q}&join=1`}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-lotus-500 to-petal-500 px-3 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-110"
                  >
                    <Play className="size-4" /> Rejoin
                  </Link>
                  {features?.spectatorMode !== false && (
                    <Link
                      href={`/watch?session=${s.id}`}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-ink-800 px-3 py-2.5 text-sm font-bold text-mist-200 transition hover:bg-ink-700"
                    >
                      <Eye className="size-4" /> Watch
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {ongoing && (
        <Link
          href={`/games/${ongoing}${q}`}
          className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2.5 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
        >
          <Play className="size-4" /> Return to Game
          <span className="ml-auto text-xs font-normal text-emerald-300/80">{ongoingLabel} in progress</span>
        </Link>
      )}
      {noneEnabled ? (
        <p className="rounded-xl border border-white/8 bg-ink-800 px-3 py-4 text-center text-xs text-mist-400">
          Games are temporarily unavailable. Please check back soon.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {playable.map((g) => {
            const Icon = gameIcon(g.icon);
            return (
              <Link
                key={g.id}
                href={`${g.route}${q}`}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-white/8 bg-ink-800 p-3 text-center transition hover:border-petal-400/40 hover:bg-ink-700"
              >
                <span className="grid size-10 place-items-center rounded-lg bg-petal-500/15 text-petal-300">
                  <Icon className="size-5" />
                </span>
                <span className="text-xs font-semibold text-mist-100">{g.name}</span>
                {g.coinCost && g.coinCost > 0 ? (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-gold-500/15 px-1.5 py-0.5 text-[9px] font-bold text-gold-300">🪙 {g.coinCost}</span>
                ) : (
                  <span className="rounded-full bg-emerald-500/12 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">FREE</span>
                )}
              </Link>
            );
          })}
          {comingSoon.map((g) => {
            const Icon = gameIcon(g.icon);
            return (
              <div
                key={`soon-${g.id}`}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-white/8 bg-ink-800/60 p-3 text-center opacity-70"
                title="Coming soon"
              >
                <span className="grid size-10 place-items-center rounded-lg bg-white/[0.04] text-mist-300">
                  <Icon className="size-5" />
                </span>
                <span className="text-xs font-semibold text-mist-100">{g.name}</span>
                <span className="text-[9px] font-semibold uppercase text-amber-300">Soon</span>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-2 text-[11px] text-mist-500">Only members of this group can play together.</p>

      {/* App-wide games (Lucky Number). Kept OUT of the group grid above, with
          their own heading, so nobody expects them to start a match here. */}
      {soloGames.length > 0 && (
        <div className="mt-4 border-t border-white/8 pt-3">
          <p className="mb-2 text-xs font-semibold text-mist-300">Also available</p>
          <div className="grid grid-cols-3 gap-2">
            {soloGames.map((g) => {
              const Icon = gameIcon(g.icon);
              return (
                <Link
                  key={g.id}
                  href={g.route}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-white/8 bg-ink-800 p-3 text-center transition hover:border-lotus-400/40 hover:bg-ink-700"
                >
                  <span className="grid size-10 place-items-center rounded-lg bg-lotus-500/15 text-lotus-300">
                    <Icon className="size-5" />
                  </span>
                  <span className="text-xs font-semibold text-mist-100">{g.name}</span>
                  <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-bold text-mist-300">Open draw</span>
                </Link>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-mist-500">Played across the whole app — not a match inside this group.</p>
        </div>
      )}
    </div>
  );
}

// ---------- Live room activity (counts + join/leave/mute feed) ----------
const EVENT_DOT: Record<string, string> = {
  join: "bg-emerald-400", leave: "bg-mist-500", mute: "bg-amber-400", unmute: "bg-emerald-400",
  remove: "bg-rose-400", suspend: "bg-rose-400", ban: "bg-rose-500", cohost: "bg-lotus-400",
  uncohost: "bg-mist-500", rejoin_blocked: "bg-rose-500",
  seat_request: "bg-amber-400", seat_approved: "bg-sky-400", seat_declined: "bg-rose-400", seat_left: "bg-mist-400",
};

// Change your profile photo / cover WITHOUT leaving the room — uses the same
// instant-save as the profile page, so the voice connection + seat are kept.
function RoomPhotoEditor({ onClose }: { onClose: () => void }) {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  if (!user) return null;

  const pickAvatar = async (file?: File) => {
    if (!file) return;
    try { updateUser({ avatar: await fileToDataUrl(file, 256, 0.72) }); toast("Profile photo updated", "success"); }
    catch { toast("Could not read that image", "error"); }
  };
  const pickCover = async (file?: File) => {
    if (!file) return;
    try { updateUser({ cover: await fileToDataUrl(file, 900, 0.7) }); toast("Cover image updated", "success"); }
    catch { toast("Could not read that image", "error"); }
  };

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-mist-100">Edit your photo</h2>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>
        <p className="mb-4 text-xs text-mist-400">You&apos;ll stay in the room and your voice stays connected.</p>
        <input ref={avatarInput} type="file" accept="image/*" hidden onChange={(e) => { pickAvatar(e.target.files?.[0]); e.target.value = ""; }} />
        <input ref={coverInput} type="file" accept="image/*" hidden onChange={(e) => { pickCover(e.target.files?.[0]); e.target.value = ""; }} />
        <div className="flex items-center gap-4">
          <Avatar name={user.fullName} src={user.avatar} size="xl" />
          <div className="flex flex-1 flex-col gap-2">
            <Button size="sm" onClick={() => avatarInput.current?.click()}><ImagePlus className="size-4" /> Change photo</Button>
            <Button size="sm" variant="secondary" onClick={() => coverInput.current?.click()}><ImagePlus className="size-4" /> Change cover</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Transient flash overlay INSIDE the room: new group-chat messages on top,
// new room-activity notifications below. The full Room Activity history section
// (with all events) stays unchanged below the stage.
function RoomFlash({ roomId, myId }: { roomId: string; myId?: string }) {
  const [chatFlash, setChatFlash] = useState<{ id: string; author: string; text: string }[]>([]);
  const [actFlash, setActFlash] = useState<{ id: string; text: string }[]>([]);
  const seenChat = useRef<Set<string>>(new Set());
  const seenAct = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  useEffect(() => {
    let on = true;
    const load = async () => {
      if (typeof document !== "undefined" && document.hidden) return; // pause when backgrounded
      try {
        const [chatData, events] = await Promise.all([
          fetch(withBase(`/api/rooms/${roomId}/chat`), { credentials: "include", cache: "no-store" })
            .then((r) => r.json())
            .catch(() => ({})),
          fetchRoomEvents(roomId),
        ]);
        if (!on) return;
        const chats = ((chatData.messages as { id: string; userId: string; userName: string; text: string }[]) ?? []);
        if (firstLoad.current) {
          chats.forEach((c) => seenChat.current.add(c.id));
          events.forEach((e) => seenAct.current.add(e.id));
          firstLoad.current = false;
          return;
        }
        const newChats = chats.filter((c) => !seenChat.current.has(c.id) && c.userId !== myId);
        chats.forEach((c) => seenChat.current.add(c.id));
        if (newChats.length) {
          setChatFlash((prev) =>
            [...prev, ...newChats.map((c) => ({ id: c.id, author: (c.userName || "Member").split(" ")[0], text: c.text }))].slice(-3),
          );
          newChats.forEach((c) => setTimeout(() => { if (on) setChatFlash((p) => p.filter((x) => x.id !== c.id)); }, 6000));
        }
        const newActs = [...events].reverse().filter((e) => !seenAct.current.has(e.id));
        events.forEach((e) => seenAct.current.add(e.id));
        if (newActs.length) {
          setActFlash((prev) => [...prev, ...newActs.map((e) => ({ id: e.id, text: roomEventText(e) }))].slice(-3));
          newActs.forEach((e) => setTimeout(() => { if (on) setActFlash((p) => p.filter((x) => x.id !== e.id)); }, 6000));
        }
      } catch {
        /* ignore */
      }
    };
    load();
    const t = setInterval(load, 5000);
    return () => { on = false; clearInterval(t); };
  }, [roomId, myId]);

  if (!chatFlash.length && !actFlash.length) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-20 mx-auto w-full max-w-sm space-y-1.5 px-3">
      {/* Group chat messages — TOP */}
      {chatFlash.map((f) => (
        <div key={f.id} className="animate-rise rounded-xl border border-lotus-400/40 bg-ink-850/95 px-3.5 py-2 text-sm shadow-lg backdrop-blur">
          <MessageCircle className="mr-1 inline size-3.5 text-lotus-300" />
          <span className="font-semibold text-lotus-300">{f.author}:</span>{" "}
          <span className="text-mist-100">{f.text}</span>
        </div>
      ))}
      {/* Room activity — BELOW */}
      {actFlash.map((f) => (
        <div key={f.id} className="animate-rise rounded-xl border border-white/10 bg-ink-850/90 px-3.5 py-1.5 text-xs text-mist-300 shadow backdrop-blur">
          <Radio className="mr-1 inline size-3 text-petal-400" /> {f.text}
        </div>
      ))}
    </div>
  );
}

function RoomActivity({
  roomId, online, speakers, listeners, speakingNow, canSeeHistory,
}: {
  roomId: string;
  online: number;
  speakers: number;
  listeners: number;
  speakingNow: string | null;
  canSeeHistory: boolean;
}) {
  const [events, setEvents] = useState<RoomEventView[]>([]);

  useEffect(() => {
    let on = true;
    const load = () => fetchRoomEvents(roomId).then((e) => { if (on) setEvents(e); });
    load();
    const t = setInterval(load, 4000);
    return () => { on = false; clearInterval(t); };
  }, [roomId]);

  const shown = events.slice(0, canSeeHistory ? 40 : 10);

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-ink-850/60 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-mist-200">
        <Radio className="size-4 text-petal-400" /> Room activity
      </div>

      {/* Live counts */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-white/[0.04] px-3 py-2 text-center">
          <div className="font-display text-lg font-bold text-emerald-300">{online}</div>
          <div className="text-[11px] text-mist-400">Online</div>
        </div>
        <div className="rounded-xl bg-white/[0.04] px-3 py-2 text-center">
          <div className="font-display text-lg font-bold text-lotus-300">{speakers}</div>
          <div className="text-[11px] text-mist-400">Speakers</div>
        </div>
        <div className="rounded-xl bg-white/[0.04] px-3 py-2 text-center">
          <div className="font-display text-lg font-bold text-sky-300">{listeners}</div>
          <div className="text-[11px] text-mist-400">Listeners</div>
        </div>
      </div>

      {speakingNow && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-mist-300">
          <span className="inline-flex gap-0.5">
            <span className="h-3 w-0.5 animate-pulse rounded-full bg-emerald-400" />
            <span className="h-3 w-0.5 animate-pulse rounded-full bg-emerald-400 [animation-delay:150ms]" />
            <span className="h-3 w-0.5 animate-pulse rounded-full bg-emerald-400 [animation-delay:300ms]" />
          </span>
          <span className="font-semibold text-emerald-300">{speakingNow}</span> is speaking
        </p>
      )}

      {/* Activity feed */}
      <div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto">
        {shown.map((e) => (
          <div key={e.id} className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm">
            <span className={cn("size-2 shrink-0 rounded-full", EVENT_DOT[e.type] ?? "bg-mist-500")} />
            <span className="min-w-0 flex-1 truncate text-mist-200">{roomEventText(e)}</span>
            <span className="shrink-0 text-[11px] text-mist-500">{new Date(e.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        ))}
        {shown.length === 0 && <p className="py-4 text-center text-xs text-mist-500">No activity yet. Joins, leaves &amp; moderation actions appear here live.</p>}
      </div>
      {canSeeHistory && <p className="mt-2 text-[11px] text-mist-500">Moderator view — full activity history with entry/exit times.</p>}
    </div>
  );
}
