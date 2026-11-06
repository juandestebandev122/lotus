import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getRoomRecord, canAccessRoom, isBannedFromRoom, callRoomStatus, isSeated, getConfig } from "@/server/repo";
import { livekitCreds, credsComplete, createAccessToken } from "@/server/livekit";

export const runtime = "nodejs";

// Issue a LiveKit access token so the signed-in user can join the room's live
// voice channel. Returns { configured:false } when LiveKit isn't set up so the
// client keeps the (silent) fallback behaviour.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);

  const creds = await livekitCreds();
  if (!credsComplete(creds)) return ok({ configured: false });

  // ADMIN MONITOR: an admin opening a room with ?monitor=1 joins as a HIDDEN,
  // listen-only observer — they hear the room + see who's speaking, but are
  // invisible to everyone and can never be heard (silent oversight).
  const monitorParam = new URL(req.url).searchParams.get("monitor") === "1";

  // Seeded/demo rooms have no record and are treated as public. Admins always
  // have access (oversight) — they're never locked out of any room.
  const room = await getRoomRecord(id);
  const isAdmin = user.role === "admin";
  // ADMIN VISIBILITY: a group set to "Hide Admin" makes every admin enter hidden
  // by default — no ?monitor=1 needed. Same silent-observer transport. An admin
  // who HOSTS/co-hosts this room is excluded: they run it, so they stay visible
  // and can speak.
  const runsThisRoom = !!room && (room.ownerId === user.id || room.hostId === user.id || (room.coAdminIds ?? []).includes(user.id));
  const isAdminMonitor = isAdmin && (monitorParam || (room?.hideAdmins === true && !runsThisRoom));
  if (room && !isAdmin && isBannedFromRoom(room, user.id)) return fail("You no longer have access to this room", 403);
  if (room && !isAdmin && !canAccessRoom(room, user.id)) return fail("This is a private room", 403);
  // A Paid Zone CALL room whose record is gone but whose call ENDED (coins ran
  // out / hung up) must NOT hand out a fresh token — otherwise a reconnecting or
  // backgrounded client could re-join the closed voice channel and keep talking.
  if (!room && (await callRoomStatus(id)) === "ended") return fail("This call has ended.", 403);

  // PER-ROOM VOICE OFF: an admin turned "Voice Chat" off for THIS room (Admin →
  // Room Settings) → no voice channel at all; the client uses the silent fallback.
  // Unset / true = voice works exactly as before, so other rooms are unaffected.
  if (room && room.features?.voiceChat === false) return ok({ configured: false });

  // SEAT-GATED VOICE: in a normal voice room a member can only PUBLISH (speak)
  // when they occupy a seat — audience joins listen-only at the SFU and literally
  // cannot be heard until seated. Taking a seat live-grants publish via
  // UpdateParticipant. NOT seat-gated: Paid Zone 1:1 calls (both parties always
  // talk), Competition rooms (their own turn-based singing/judging flow), and
  // seeded/demo rooms (no record).
  const seatGated = !!room && room.category !== "Paid Zone" && !room.isCompetition;
  // Beyond seating, the SERVER also revokes publish for anyone the host has
  // silenced — host force-mute (mutedMemberIds), mute-all (voiceLocked), or a
  // locked member-mic permission. Enforcing it in the TOKEN means a muted member
  // genuinely cannot be heard even if they reconnect or tamper with the client
  // (fixes "some users can still speak after being muted"). Host/co-hosts/admins
  // are never silenced.
  const isMod = isAdmin || (!!room && (room.ownerId === user.id || room.hostId === user.id || (room.coAdminIds ?? []).includes(user.id)));
  const silenced = !!room && !isMod && (
    (room.mutedMemberIds ?? []).includes(user.id) ||
    room.voiceLocked === true ||
    room.memberPerms?.mic === false ||
    room.features?.mic === false // per-room "Microphone Permission" turned off for members
  );
  // A monitoring admin NEVER publishes (silent observer); otherwise normal seat gating.
  // MODERATORS (host + co-hosts) are ALWAYS publish-eligible — the seat requirement
  // must not apply to them. Previously the `isMod` exemption only fed `!silenced`, so
  // a co-host (or host) who was ever moved to the listener area (audienceIds) got
  // canPublish:false and could not speak, while the client still showed them "live" —
  // the root cause of "co-hosts / some participants can't speak". Now a mod always
  // publishes; only non-mods are seat-gated.
  const canPublish = isAdminMonitor ? false : (isMod || !seatGated || (isSeated(room, user.id) && !silenced));

  const token = createAccessToken(creds, {
    room: `room_${id}`,
    identity: user.id,
    name: user.fullName,
    // Avatar is resolved from the account by id (see /api/users/profiles), so we
    // keep the live-voice metadata small — large data-URL avatars don't belong
    // in token/participant metadata.
    metadata: JSON.stringify({ username: user.username }),
    canPublish,
    hidden: isAdminMonitor,
  });

  // AUDIO QUALITY travels with the token, so the client applies the admin's
  // current settings the moment it builds the LiveKit Room — no extra request,
  // and a change takes effect the next time anyone joins a room.
  const vq = (await getConfig()).voiceQuality ?? {};
  const audio = {
    bitrateKbps: typeof vq.bitrateKbps === "number" ? Math.max(8, Math.min(64, Math.round(vq.bitrateKbps))) : 32,
    dtx: vq.dtx === true,
    red: vq.red !== false,
    noiseSuppression: vq.noiseSuppression !== false,
    echoCancellation: vq.echoCancellation !== false,
    autoGainControl: vq.autoGainControl !== false,
    voiceIsolation: vq.voiceIsolation !== false,
    stereo: vq.stereo === true,
  };

  return ok({ configured: true, url: creds.url, token, audio });
}
