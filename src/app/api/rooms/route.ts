import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listRooms, createRoomRecord, getConfig, findById, createFeatureRequest, myActivePublicRoomCount, agencyBadgesForUsers, listRoomPresence, duplicateNameError } from "@/server/repo";
import { avatarUrl, roomImageUrl } from "@/server/avatar";

export const runtime = "nodejs";

/**
 * ROOM / GROUP LIST VISIBILITY.
 *
 * The admin picks one mode (or builds a custom rule) and it applies to the Voice
 * Rooms list for every user. Nothing here touches how a room WORKS: a room that
 * isn't listed still runs, its members can still open it, invites and direct
 * links still work, and the host keeps every control. This is purely "what shows
 * up in the browse list".
 */
type ListedRoom = Awaited<ReturnType<typeof listRooms>>[number];
async function filterRoomList(
  rooms: ListedRoom[],
  presence: Map<string, string[]>,
  user: { id?: string; role?: string; joinedRoomIds?: string[] } | null,
  asUser = false,
): Promise<ListedRoom[]> {
  const cfg = (await getConfig()).roomList ?? {};
  const mode = cfg.mode ?? "all";
  const hideOffline = cfg.hideOffline === true;
  // "Show all" with no extra rule → nothing to do (the default, unchanged).
  if (mode === "all" && !hideOffline) return rooms;
  // Administrators see the complete list unless the admin turned that off — but
  // NOT while they're previewing the app as a regular user, where the whole point
  // is to see exactly what a member sees.
  if (user?.role === "admin" && cfg.adminSeesAll !== false && !asUser) return rooms;

  const mine = new Set(user?.joinedRoomIds ?? []);
  const keepMine = cfg.alwaysShowMine !== false;

  return rooms.filter((r) => {
    // A viewer never loses sight of their own rooms (theirs to host, or ones
    // they've already joined) — otherwise a rule could strand someone.
    if (keepMine && user?.id && (r.ownerId === user.id || r.hostId === user.id || mine.has(r.id))) return true;

    const live = presence.get(r.id) ?? [];
    if (hideOffline && live.length === 0) return false;

    const liveSet = new Set(live);
    const hostLive = liveSet.has(r.hostId) || liveSet.has(r.ownerId);
    const coHosts = r.coAdminIds ?? [];
    const coHostLive = coHosts.some((id) => liveSet.has(id));
    // "Member" = anyone live who isn't the host or a co-host.
    const memberLive = live.some((id) => id !== r.hostId && id !== r.ownerId && !coHosts.includes(id));

    switch (mode) {
      case "hostOnline": return hostLive;
      case "coHostOnline": return coHostLive;
      case "memberOnline": return memberLive;
      case "custom": {
        if (cfg.requireHost && !hostLive) return false;
        if (cfg.requireCoHost && !coHostLive) return false;
        if (cfg.requireMember && !memberLive) return false;
        const min = Math.max(0, cfg.minLive ?? 0);
        if (min > 0 && live.length < min) return false;
        return true;
      }
      default: return true; // "all" — only the hideOffline rule above applied
    }
  });
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  // Set by the client when an admin is in "View as user" mode.
  const asUser = new URL(req.url).searchParams.get("asUser") === "1";
  // Competition Voice Rooms live in their own /competitions section — keep them
  // OUT of the normal Voice Rooms browse list so the two stay separate.
  let rooms = (await listRooms(user?.id, user?.role)).filter((r) => !r.isCompetition);
  // Real "people in this room" = the SAME deduped presence count shown inside the
  // room ("N in room"): fresh DB heartbeats ∪ live LiveKit voice participants ∪
  // players in a running game, minus anyone the host removed/blocked. Using this
  // (instead of the LiveKit-only participant count) makes the card match what the
  // host sees inside the room — e.g. a 3-member room reads "3 members", not "1".
  // An empty room shows 0 BUT is NEVER auto-removed — a created room stays in the
  // list until the Host/Admin deletes it.
  // Live presence per room, captured once and reused for BOTH the member count
  // and the admin's room-list visibility rules below.
  const presence = new Map<string, string[]>();
  await Promise.all(
    rooms.map(async (r) => {
      try {
        const live = await listRoomPresence(r.id);
        presence.set(r.id, live.map((p) => p.id));
        r.liveCount = live.length;
      } catch {
        /* keep the heartbeat-based fallback count from listRooms() */
      }
    }),
  );

  // ROOM / GROUP LIST VISIBILITY (Admin → Rooms). Applied HERE, on the server, so
  // every user's list obeys the same rule. It only decides what is LISTED — a room
  // that isn't shown keeps working normally and stays reachable for its members,
  // by invite, or by a direct link.
  rooms = await filterRoomList(rooms, presence, user, asUser);
  // The agency that manages each room = the room OWNER's agency — labelled next to
  // the room name in the list. Resolved for the whole list in ONE db read.
  const agencyMap = await agencyBadgesForUsers(rooms.map((r) => r.ownerId));
  // Attach each host's real username + avatar (for profile / message links).
  const enriched = await Promise.all(
    rooms.map(async (r) => {
      const host = await findById(r.hostId);
      const agency = agencyMap[r.ownerId];
      // MOBILE DATA: this endpoint is polled constantly (tens of thousands of
      // times a day), so it must carry ONLY what the room LIST draws. It was
      // returning the whole room record, and `seatRequests` alone was 86% of a
      // 312 KB response — moderation state no list ever renders. Dropping the
      // internal-only fields here is the single biggest data saving in the app;
      // the room screen still gets everything from /api/rooms/[id].
      const {
        seatRequests: _seatRequests,
        modLog: _modLog,
        stageApprovedIds: _stageApprovedIds,
        chatMutedIds: _chatMutedIds,
        removedMemberIds: _removedMemberIds,
        blockedMemberIds: _blockedMemberIds,
        mutedMemberIds: _mutedMemberIds,
        audienceIds: _audienceIds,
        cameraOffIds: _cameraOffIds,
        mediaAllowedIds: _mediaAllowedIds,
        stickers: _stickers,
        announcement: _announcement,
        ...listFields
      } = r as typeof r & Record<string, unknown>;
      void _seatRequests; void _modLog; void _stageApprovedIds; void _chatMutedIds;
      void _removedMemberIds; void _blockedMemberIds; void _mutedMemberIds;
      void _audienceIds; void _cameraOffIds; void _mediaAllowedIds;
      void _stickers; void _announcement;
      return { ...listFields, image: roomImageUrl(r), hostUsername: host?.username ?? "", hostAvatar: avatarUrl(host), agencyName: agency?.name, agencyId: agency?.id };
    }),
  );
  // The requester's id + the rooms they've joined, so the page can split the list
  // into My Rooms / Joined / Public / Private.
  return ok({ rooms: enriched, myId: user?.id ?? "", joined: user?.joinedRoomIds ?? [] });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);

  const config = await getConfig();
  // Master feature switch: Voice Rooms can be turned off entirely (admins included,
  // so they can't accidentally create rooms while the feature is meant to be off).
  if (config.features?.voiceRooms === false) return fail("Voice Rooms are currently turned off.", 403);
  // Respect the admin "allow members to create rooms" switch (admins always can).
  if (user.role !== "admin" && !config.settings.roomCreation) {
    return fail("Room creation is currently disabled by the administrators.", 403);
  }

  const { name, category, type, requestExtra } = await readJson<{ name?: string; category?: string; type?: string; requestExtra?: boolean }>(req);
  if (!name || typeof name !== "string") return fail("Room name is required");
  const nameErr = await duplicateNameError("group", name);
  if (nameErr) return fail(nameErr, 409);
  // Private rooms can be disabled — fall back to a public room when off.
  const roomType = type === "private" || type === "community" || type === "password" ? type : "public";
  if (roomType === "private" && config.features?.privateRooms === false) return fail("Private rooms are currently turned off.", 403);

  const cat = typeof category === "string" ? category : "Just Chatting";
  const isPublic = roomType !== "private";
  const extraCost = config.featurePricing?.extraPublicRoom ?? 1000;

  // "1 free public room per user" — creating an EXTRA public room needs an
  // admin-approved coin request (private rooms are unlimited; admins are exempt).
  if (isPublic && user.role !== "admin") {
    // The user CONFIRMED they want to pay + request an extra public room.
    if (requestExtra) {
      const res = await createFeatureRequest({ type: "public_room", userId: user.id, payload: `${name}|||${cat}` });
      if (!res.ok) return fail(res.error ?? "Could not send the request", 400);
      return ok({ requested: true, balance: res.balance }, 201);
    }
    const owned = await myActivePublicRoomCount(user.id);
    if (owned >= 1) {
      // Tell the client to offer the "request an extra public room" flow.
      return ok({ requiresRequest: true, cost: extraCost });
    }
  }

  const room = await createRoomRecord({
    name,
    category: cat,
    type: roomType,
    ownerId: user.id,
    hostName: user.fullName,
    // New rooms always open with the admin's CURRENT default seat count (never
    // above the admin's max).
    capacity: Math.min(config.roomControls.defaultSeats, config.roomControls.maxSeats),
  });
  // Admin notification center: surface every new room to admins (Room Activities).
  try {
    const { notifyAdmins } = await import("@/server/repo");
    await notifyAdmins(`New room created: “${room.name}” by ${user.fullName}.`, { label: "Room Activities", href: "/admin/room-activities" });
  } catch { /* non-fatal */ }
  return ok({ room }, 201);
}
