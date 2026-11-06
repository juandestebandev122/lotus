import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getRoomRecord, updateRoomRecord, addRoomEvent, notifyUser, isBannedFromRoom, listActiveSessionsForRoom } from "@/server/repo";
import { setParticipantCanPublish } from "@/server/livekit";

export const runtime = "nodejs";

// A member asks to join a voice seat. If "Automatic Seat Approval" is ON they
// join instantly; otherwise the request is queued for the Host/Co-Host(s).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);

  const room = await getRoomRecord(id);
  if (!room) return ok({ autoApproved: true }); // seeded/demo room — no gating
  if (isBannedFromRoom(room, user.id, user.role)) return fail("You no longer have access to this room", 403);

  // The ROOM's own Host / Co-Hosts skip the seat queue (they ARE the approvers).
  // Super Admin / Admin skip it too: they must be able to enter and speak in ANY
  // room without waiting for approval or an invitation. (Note: this means an admin
  // using "View as user" preview also auto-seats — test manual seat approval with
  // a real member account, not an admin one.)
  const isRoomMod =
    user.role === "admin" ||
    room.ownerId === user.id ||
    room.hostId === user.id ||
    (room.coAdminIds ?? []).includes(user.id);
  const approved = room.stageApprovedIds ?? [];

  // HIDDEN ADMIN: in a group set to "Hide Admin" an admin who doesn't run the
  // room is a silent observer — never grant them a speaking seat, or they'd be
  // heard while invisible (a ghost voice). They keep every other admin power.
  const runsThisRoom = room.ownerId === user.id || room.hostId === user.id || (room.coAdminIds ?? []).includes(user.id);
  if (user.role === "admin" && room.hideAdmins === true && !runsThisRoom) {
    return ok({ autoApproved: false, hiddenAdmin: true });
  }

  if (isRoomMod || approved.includes(user.id)) {
    // An admin who isn't already on the approved list gets added, so their seat
    // survives a reconnect exactly like a host's does.
    if (user.role === "admin" && !approved.includes(user.id)) {
      await updateRoomRecord(id, { stageApprovedIds: [...new Set([...approved, user.id])] });
    }
    // Already seated — make sure they can actually publish (in case a stale
    // token or a prior revoke left them muted at the SFU).
    await setParticipantCanPublish(`room_${id}`, user.id, true);
    return ok({ autoApproved: true, alreadyOn: true });
  }

  const firstName = user.fullName.split(" ")[0];

  // If the Host has LOCKED the seat member-permission, members can't auto-take a
  // seat — their request is queued for the Host/Co-Host like manual approval.
  const seatLocked = room.memberPerms?.seat === false;

  // A Host/Co-Host explicitly moved this member to the Listener area (audienceIds).
  // That demotion is FINAL — auto-approval must NOT silently put them back on the
  // seat (this was a path the "removed user rejoins the seat" bug could exploit).
  // Queue their request for the host regardless of Auto mode; the host re-seats
  // them via "Bring back to stage".
  const inAudience = (room.audienceIds ?? []).includes(user.id);

  // GAME IN PROGRESS: when the Host or a Co-Host is currently PLAYING a game in
  // this room, every listener join request MUST wait for Host/Co-Host approval
  // (client rule) — never auto-seat while they're busy at the board. The request
  // is queued and surfaced inside the game with Approve/Reject.
  let gameGating = false;
  try {
    const sessions = await listActiveSessionsForRoom(id);
    const modIds = new Set([room.ownerId, room.hostId, ...(room.coAdminIds ?? [])].filter(Boolean) as string[]);
    gameGating = sessions.some((s) => (s.playerIds ?? []).some((pid) => modIds.has(pid)));
  } catch { /* if we can't tell, fall through to normal rules */ }

  // AUTO-approval ON (default) AND seats aren't locked AND not host-demoted AND no
  // game is gating → join the seat immediately. A per-room "Join Approval" override
  // (Admin → Room Settings) forces every join through the approval queue; unset =
  // unchanged.
  const forceApproval = room.features?.joinApproval === true;
  if (room.autoSeatApproval !== false && !forceApproval && !seatLocked && !inAudience && !gameGating) {
    await updateRoomRecord(id, {
      stageApprovedIds: [...new Set([...approved, user.id])],
      // Clear the listener flag too so the grant actually takes effect
      // (isSeated treats audienceIds as an override — a stale entry would
      // otherwise keep a genuinely re-seated user muted).
      audienceIds: (room.audienceIds ?? []).filter((x) => x !== user.id),
    });
    // Grant PUBLISH at the SFU right now so their mic works without a reconnect.
    await setParticipantCanPublish(`room_${id}`, user.id, true);
    await addRoomEvent(id, "seat_approved", firstName, "Auto-approval", user.id);
    await notifyUser(user.id, "Auto-Join is enabled. You have joined the voice seat automatically.", { label: "Open room", href: `/rooms/${id}` }, "system");
    return ok({ autoApproved: true });
  }

  // Approval required → add to the pending queue (deduped) + notify moderators.
  // Carry the requester's @username + member ID so the Host/Co-Host sees the full
  // identity (photo, name, @username, ID, time) on the Approve/Reject card.
  const reqs = room.seatRequests ?? [];
  if (!reqs.some((r) => r.userId === user.id)) {
    const next = [...reqs, { userId: user.id, userName: user.fullName, username: user.username, publicId: user.publicId, avatar: user.avatar, at: new Date().toISOString() }];
    await updateRoomRecord(id, { seatRequests: next });
    await addRoomEvent(id, "seat_request", firstName, firstName, user.id);
    for (const mid of new Set([room.ownerId, ...(room.coAdminIds ?? [])])) {
      if (mid !== user.id) {
        await notifyUser(mid, `${firstName} requested to join a seat in “${room.name}”.`, { label: "Open room", href: `/rooms/${id}` }, "system");
      }
    }
  }
  await notifyUser(user.id, "Your seat request has been submitted. Waiting for Host/Co-Host approval.", undefined, "system");
  return ok({ autoApproved: false, gated: gameGating });
}
