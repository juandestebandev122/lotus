import { USERS, CURRENT_USER } from "./mock-data";
import type { User, VoiceRoom } from "./types";
import { withBase } from "./base-path";
import { IS_PROD_SITE } from "./prod";

// ============================================================
// Voice-room helpers. User-created rooms are now PERSISTED on the
// backend (`/api/rooms`), so they survive logout and re-login.
// The seeded ROOMS remain as always-on demo rooms.
// ============================================================

export type SpeakerUser = Pick<User, "id" | "fullName" | "username" | "avatar" | "verified"> & { equippedFrame?: string; publicId?: string };

export interface RoomMedia {
  kind: "audio" | "video" | "youtube" | "image";
  src: string;
  startedAt: number;
  name?: string; // file/track name shown to everyone
  ownerId?: string; // who started it — playback stops if they leave the room
  ownerName?: string;
  live?: boolean; // streamed live from the owner's device (no upload/storage)
  paused?: boolean; // host paused for everyone
  pausedAtSec?: number; // playback position (s) when paused, for resume sync
  mutedForAll?: boolean; // host muted the media audio for the whole room
}

/** A room as the UI consumes it (VoiceRoom + management fields). */
export type RoomView = VoiceRoom & {
  ownerId?: string;
  agencyName?: string; // the agency that manages this room (shown next to the name)
  agencyId?: string; // the managing agency's id (links the badge to its profile)
  image?: string; // custom room picture (falls back to the host avatar)
  description?: string;
  announcement?: string;
  coAdminIds?: string[];
  coHostBonus?: number;
  mutedMemberIds?: string[];
  removedMemberIds?: string[];
  blockedMemberIds?: string[];
  voiceLocked?: boolean;
  autoLockChat?: boolean;
  chatLockedNow?: boolean;
  autoSeatApproval?: boolean;
  hideAdmins?: boolean;
  seatRequests?: SeatRequest[];
  seatInvites?: SeatInvite[];
  stageApprovedIds?: string[];
  audienceIds?: string[];
  invitedIds?: string[];
  media?: RoomMedia | null;
  recording?: boolean;
  videoUnlocked?: boolean;
  cameraOffIds?: string[];
  videoMembersAllowed?: boolean;
  memberPerms?: { seat?: boolean; mic?: boolean; camera?: boolean; chat?: boolean; games?: boolean };
  mediaAllowedIds?: string[];
  features?: Record<string, boolean | number | string>; // per-room feature overrides (see lib/room-features)
  isPrimary?: boolean; // owner's first/oldest group — can't be deleted directly (admin request)
};

export interface SeatRequest {
  userId: string;
  userName: string;
  username?: string;  // @handle
  publicId?: string;  // member ID number
  avatar?: string;
  at: string;
}

/** The other direction: a Host/Co-Host asking a listener to take a seat. */
export interface SeatInvite {
  userId: string;
  userName: string;
  byId: string;
  byName: string;
  at: string;
}

interface RoomRecordJSON {
  id: string;
  name: string;
  ownerId: string;
  hostId: string;
  hostName: string;
  hostUsername?: string;
  hostAvatar?: string;
  agencyName?: string; // the agency that manages this room (room owner's agency)
  agencyId?: string; // the managing agency's id (for the profile link)
  category: string;
  type: VoiceRoom["type"];
  capacity: number;
  tags: string[];
  live: boolean;
  createdAt: string;
  image?: string;
  description?: string;
  announcement?: string;
  coAdminIds?: string[];
  coHostBonus?: number;
  mutedMemberIds?: string[];
  removedMemberIds?: string[];
  blockedMemberIds?: string[];
  voiceLocked?: boolean;
  autoLockChat?: boolean;
  chatLockedNow?: boolean;
  autoSeatApproval?: boolean;
  hideAdmins?: boolean;
  seatRequests?: SeatRequest[];
  seatInvites?: SeatInvite[];
  stageApprovedIds?: string[];
  audienceIds?: string[];
  invitedIds?: string[];
  media?: RoomMedia | null;
  recording?: boolean;
  videoUnlocked?: boolean;
  cameraOffIds?: string[];
  videoMembersAllowed?: boolean;
  memberPerms?: { seat?: boolean; mic?: boolean; camera?: boolean; chat?: boolean; games?: boolean };
  mediaAllowedIds?: string[];
  features?: Record<string, boolean | number | string>;
  liveCount?: number;
  isPrimary?: boolean; // owner's first/oldest group — can't be deleted directly
}

function toView(r: RoomRecordJSON): RoomView {
  return {
    id: r.id,
    name: r.name,
    host: { id: r.hostId, fullName: r.hostName, username: r.hostUsername ?? "", avatar: r.hostAvatar ?? "" },
    category: r.category,
    type: r.type,
    speakers: r.liveCount ?? 0,
    listeners: 0,
    capacity: r.capacity,
    live: r.live,
    tags: r.tags ?? [],
    ownerId: r.ownerId,
    agencyName: r.agencyName,
    agencyId: r.agencyId,
    image: r.image,
    description: r.description,
    announcement: r.announcement,
    coAdminIds: r.coAdminIds,
    coHostBonus: r.coHostBonus,
    mutedMemberIds: r.mutedMemberIds,
    removedMemberIds: r.removedMemberIds,
    blockedMemberIds: r.blockedMemberIds,
    voiceLocked: r.voiceLocked,
    autoLockChat: r.autoLockChat,
    chatLockedNow: r.chatLockedNow,
    autoSeatApproval: r.autoSeatApproval,
    hideAdmins: r.hideAdmins,
    seatRequests: r.seatRequests,
    seatInvites: r.seatInvites,
    stageApprovedIds: r.stageApprovedIds,
    audienceIds: r.audienceIds,
    invitedIds: r.invitedIds,
    media: r.media ?? null,
    recording: r.recording,
    videoUnlocked: r.videoUnlocked,
    cameraOffIds: r.cameraOffIds,
    videoMembersAllowed: r.videoMembersAllowed,
    memberPerms: r.memberPerms,
    mediaAllowedIds: r.mediaAllowedIds,
    features: r.features,
    isPrimary: r.isPrimary,
  };
}

/** Real rooms (+ seeded demo rooms only on the showcase build). */
export async function fetchRooms(): Promise<RoomView[]> {
  // NO SEEDED DEMO ROOMS. Ever.
  //
  // These used to be injected unless NEXT_PUBLIC_LOTUS_PROD was set at BUILD
  // time. That is a build-time inline, so one build run without the env file
  // silently put four fake rooms ("Chill Hangout", "Music Lovers", "Game On",
  // "Tamil Community") hosted by people who do not exist back in front of real
  // members — who then tapped them and got 404s, because r1–r4 are not real
  // rooms. A live platform must never show invented rooms, so the fallback is
  // gone rather than merely switched off.
  const seeded: RoomView[] = [];
  try {
    // no-store: always show the live room list (e.g. a room renamed by an approved
    // request must appear with its NEW name, not a browser-cached old copy).
    const res = await fetch(withBase("/api/rooms"), { credentials: "include", cache: "no-store" });
    const json = await res.json();
    const mine = ((json.rooms as RoomRecordJSON[]) ?? []).map(toView);
    return [...mine, ...seeded];
  } catch {
    return seeded;
  }
}

export async function fetchRoom(id: string): Promise<RoomView | undefined> {
  // No demo rooms — see the note in fetchRooms. A request for a mock id (r1–r4)
  // now correctly resolves to "room not found" instead of opening a fake room.
  const seeded = undefined as RoomView | undefined;
  if (seeded) return { ...seeded };
  try {
    const res = await fetch(withBase(`/api/rooms/${id}`), { credentials: "include", cache: "no-store" });
    if (!res.ok) return undefined;
    const json = await res.json();
    return json.room ? toView(json.room as RoomRecordJSON) : undefined;
  } catch {
    return undefined;
  }
}

export interface PresenceMember { id: string; fullName: string; username: string; publicId?: string; avatar: string; agencyName?: string; agencyId?: string; }

// Server-side presence: everyone currently in the room (independent of each
// viewer's LiveKit voice link). Used to fill the seat grid reliably so a member
// who joined always shows up.
export async function fetchRoomMembers(id: string): Promise<PresenceMember[]> {
  try {
    const res = await fetch(withBase(`/api/rooms/${id}/members`), { credentials: "include", cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.members as PresenceMember[]) ?? [];
  } catch {
    return [];
  }
}

export interface CreateRoomResult {
  room?: RoomView;
  requiresRequest?: boolean; // user's free public room is used → needs an admin-approved coin request
  cost?: number; // coins an extra public room costs
  requested?: boolean; // the extra-public-room request was sent to the admin
  error?: string;
}

export async function createRoom(input: {
  name: string;
  category: string;
  type: VoiceRoom["type"];
  requestExtra?: boolean; // confirm paying + requesting an EXTRA public room
}): Promise<CreateRoomResult> {
  try {
    const res = await fetch(withBase("/api/rooms"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { error: (json?.error as string) ?? "Could not create the room" };
    if (json.requiresRequest) return { requiresRequest: true, cost: json.cost as number };
    if (json.requested) return { requested: true };
    return { room: json.room ? toView(json.room as RoomRecordJSON) : undefined };
  } catch {
    return { error: "Could not create the room" };
  }
}

// Rooms list + the requester's id and joined-room ids (for the sectioned page).
export async function fetchRoomsView(): Promise<{ rooms: RoomView[]; myId: string; joined: string[] }> {
  const seeded: RoomView[] = []; // no demo rooms — see fetchRooms
  try {
    // "View as user": an ADMIN previewing the member experience must see the list
    // a MEMBER would see. Admins normally bypass the room-list visibility rule
    // (so they can always monitor every room) — which made the rule look broken
    // when an admin tested it. Passing this flag drops that bypass for the preview.
    let asUser = false;
    try { asUser = typeof window !== "undefined" && localStorage.getItem("lotus.viewAsUser") === "1"; } catch { /* ignore */ }
    const res = await fetch(withBase(`/api/rooms${asUser ? "?asUser=1" : ""}`), { credentials: "include", cache: "no-store" });
    const json = await res.json();
    const mine = ((json.rooms as RoomRecordJSON[]) ?? []).map(toView);
    return { rooms: [...mine, ...seeded], myId: (json.myId as string) ?? "", joined: (json.joined as string[]) ?? [] };
  } catch {
    return { rooms: seeded, myId: "", joined: [] };
  }
}

export async function setRoomCapacity(id: string, capacity: number): Promise<RoomView | null> {
  return updateRoom(id, { capacity });
}

// ---- Room activity events (join/leave/mute/etc.) for the live activity feed ----
export type RoomEventType =
  | "join" | "leave" | "mute" | "unmute" | "remove" | "suspend" | "ban" | "cohost" | "uncohost" | "rejoin_blocked"
  | "seat_request" | "seat_approved" | "seat_declined" | "seat_left" | "seat_invited" | "seat_invite_declined";

export interface RoomEventView {
  id: string;
  roomId: string;
  type: RoomEventType;
  target: string;
  actorName: string;
  actorId: string;
  at: string;
}

/** Log a room activity event (fire-and-forget). */
export async function logRoomEvent(roomId: string, type: RoomEventType, target?: string): Promise<void> {
  try {
    await fetch(withBase(`/api/rooms/${roomId}/events`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ type, target }),
    });
  } catch {
    /* ignore */
  }
}

export async function fetchRoomEvents(roomId: string): Promise<RoomEventView[]> {
  try {
    const res = await fetch(withBase(`/api/rooms/${roomId}/events`), { credentials: "include", cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.events as RoomEventView[]) ?? [];
  } catch {
    return [];
  }
}

/** Human-readable line for a room event (used by the activity feed). */
export function roomEventText(e: RoomEventView): string {
  const t = e.target || "Someone";
  switch (e.type) {
    case "join": return `${t} joined the room`;
    case "leave": return `${t} left the room`;
    case "mute": return `${t} has been muted by ${e.actorName}`;
    case "unmute": return `${t} has been unmuted`;
    case "remove": return `${t} was removed from the room`;
    case "suspend": return `${t} has been suspended`;
    case "ban": return `${t} has been banned`;
    case "cohost": return `${t} was made a co-host`;
    case "uncohost": return `${t} is no longer a co-host`;
    case "rejoin_blocked": return `${t} (blocked) tried to rejoin`;
    case "seat_request": return `${t} requested to join a seat`;
    case "seat_approved": return `${t} joined a seat`;
    case "seat_declined": return `${t}'s seat request was declined`;
    case "seat_left": return `${t} left the seat`;
    case "seat_invited": return `${e.actorName} invited ${t} to take a seat`;
    case "seat_invite_declined": return `${t} declined the seat invitation`;
    default: return `${t}`;
  }
}

/** Host/co-host: broadcast "now playing" media to everyone (null = stop). */
export async function setRoomMedia(
  id: string,
  media: Partial<RoomMedia> & { kind: "audio" | "video" | "youtube" | "image" } | null,
): Promise<RoomView | null> {
  return updateRoom(id, { media });
}

/** Lightweight poll of JUST the room's media state (host play/pause/skip/stop),
 *  so every member stays in sync in ~2s. Returns `undefined` on error (leave the
 *  current state untouched), `null` when nothing is playing, or the media object. */
export async function fetchRoomMediaState(id: string): Promise<RoomMedia | null | undefined> {
  try {
    const res = await fetch(withBase(`/api/rooms/${id}/media`), { credentials: "include", cache: "no-store" });
    if (!res.ok) return undefined;
    const d = await res.json().catch(() => ({}));
    return (d.media ?? null) as RoomMedia | null;
  } catch {
    return undefined;
  }
}

/** Member: ask to join a voice seat. Returns whether they were auto-approved. */
export async function requestSeat(roomId: string): Promise<{ autoApproved: boolean }> {
  try {
    const res = await fetch(withBase(`/api/rooms/${roomId}/seat-request`), { method: "POST", credentials: "include" });
    const data = await res.json().catch(() => ({}));
    return { autoApproved: !!data.autoApproved };
  } catch {
    return { autoApproved: false };
  }
}

/** Member: step down from a speaker seat back to the audience (listen-only). */
export async function leaveSeat(roomId: string): Promise<void> {
  try {
    await fetch(withBase(`/api/rooms/${roomId}/leave-seat`), { method: "POST", credentials: "include" });
  } catch {
    /* ignore — the next poll reflects it */
  }
}

/** Host/Co-Host: approve or reject a pending seat request. */
export async function decideSeat(roomId: string, targetUserId: string, approve: boolean): Promise<void> {
  try {
    await fetch(withBase(`/api/rooms/${roomId}/seat-decision`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ targetUserId, approve }),
    });
  } catch {
    /* ignore — the next poll reflects the queue */
  }
}

/** Host/Co-Host: force-disconnect a member from the voice server immediately
 * (used alongside persisting removedMemberIds/blockedMemberIds). */
export async function kickRoomParticipant(roomId: string, targetUserId: string): Promise<void> {
  try {
    await fetch(withBase(`/api/rooms/${roomId}/kick`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ targetUserId }),
    });
  } catch {
    /* best-effort — the persisted ban + denied token still enforce it */
  }
}

/** Patch a room (host/co-admin): name, description, announcement, capacity, transfer, etc. */
export async function updateRoom(
  id: string,
  patch: Record<string, unknown>,
): Promise<RoomView | null> {
  try {
    const res = await fetch(withBase(`/api/rooms/${id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(patch),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.room ? toView(json.room as RoomRecordJSON) : null;
  } catch {
    return null;
  }
}

export async function deleteRoom(id: string): Promise<boolean> {
  try {
    const res = await fetch(withBase(`/api/rooms/${id}`), {
      method: "DELETE",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Mark active in a room. Returns null on success, or an error message (e.g. already in another room). */
export async function enterRoom(id: string): Promise<string | null> {
  try {
    const res = await fetch(withBase(`/api/rooms/${id}/presence`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "join" }),
    });
    if (res.ok) return null;
    const json = await res.json().catch(() => ({}));
    return (json.error as string) ?? "Couldn't join this room";
  } catch {
    return null; // network issue — don't block the demo
  }
}

export async function exitRoom(id: string): Promise<void> {
  try {
    await fetch(withBase(`/api/rooms/${id}/presence`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "leave" }),
      keepalive: true,
    });
  } catch {
    /* ignore */
  }
}

/** The speakers on stage for a room: the host plus seeded users. */
export function speakersFor(room: VoiceRoom): SpeakerUser[] {
  const others = USERS.filter((u) => u.id !== room.host.id);
  const list: SpeakerUser[] = [room.host, ...others];
  return list.slice(0, Math.max(1, room.speakers));
}

/** A handful of listener avatars for the room stage. */
export function listenersFor(room: VoiceRoom): SpeakerUser[] {
  const speakerIds = new Set(speakersFor(room).map((s) => s.id));
  return USERS.filter((u) => !speakerIds.has(u.id) && u.id !== CURRENT_USER.id).slice(0, 8);
}

export const ME: SpeakerUser = CURRENT_USER;

// On the real site we never expose the demo people. Games still need
// opponents/seat-fillers, so swap them for neutral, generic players
// ("Player 2"…"Player 9") instead of the sample social users.
const GENERIC_PLAYERS: User[] = Array.from({ length: 8 }, (_, i) => ({
  ...USERS[i],
  id: `bot_${i + 2}`,
  fullName: `Player ${i + 2}`,
  username: `player_${i + 2}`,
  avatar: "",
  verified: false,
}));

const GAME_USERS: User[] = IS_PROD_SITE ? GENERIC_PLAYERS : USERS;
export { GAME_USERS as USERS };
