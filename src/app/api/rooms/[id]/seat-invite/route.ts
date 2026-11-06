import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getRoomRecord, updateRoomRecord, addRoomEvent, notifyUser, isBannedFromRoom } from "@/server/repo";
import { setParticipantCanPublish } from "@/server/livekit";

export const runtime = "nodejs";

/**
 * The listener's answer to "come up and take a seat".
 *
 * Accepting seats them THERE AND THEN — the same state change the Host makes
 * when approving a seat request (stageApprovedIds + off the listener list +
 * publish granted at the SFU), so the mic works without a reconnect.
 *
 * A Host/Co-Host may also call this with `cancel` to withdraw an invitation.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);

  const room = await getRoomRecord(id);
  if (!room) return fail("Room not found", 404);

  const { accept, cancel, targetUserId } = await readJson<{ accept?: boolean; cancel?: boolean; targetUserId?: string }>(req);
  const invites = room.seatInvites ?? [];

  // --- Host/Co-Host withdrawing an invitation -------------------------------
  if (cancel) {
    const isMod = room.ownerId === user.id || (room.coAdminIds ?? []).includes(user.id) || user.role === "admin";
    if (!isMod) return fail("Only the host or a co-host can do that", 403);
    const who = targetUserId ?? "";
    await updateRoomRecord(id, { seatInvites: invites.filter((s) => s.userId !== who) });
    return ok({ ok: true });
  }

  // --- The invitee answering -------------------------------------------------
  const mine = invites.find((s) => s.userId === user.id);
  if (!mine) return fail("That invitation is no longer available.", 404);
  if (isBannedFromRoom(room, user.id, user.role)) return fail("You no longer have access to this room", 403);

  const rest = invites.filter((s) => s.userId !== user.id);
  const firstName = user.fullName.split(" ")[0];

  if (accept === false) {
    await updateRoomRecord(id, { seatInvites: rest });
    await addRoomEvent(id, "seat_invite_declined", firstName, firstName, user.id);
    await notifyUser(mine.byId, `${firstName} declined your invitation to take a seat in “${room.name}”.`, undefined, "system");
    return ok({ ok: true, seated: false });
  }

  // ACCEPTED — seat them now. Clearing audienceIds matters: a host who moved
  // this member to the listener area is the same host now inviting them back,
  // and that flag otherwise overrides the seat grant and keeps them muted.
  await updateRoomRecord(id, {
    seatInvites: rest,
    stageApprovedIds: [...new Set([...(room.stageApprovedIds ?? []), user.id])],
    audienceIds: (room.audienceIds ?? []).filter((x) => x !== user.id),
    // Drop any seat request of their own that is still queued — they're seated.
    seatRequests: (room.seatRequests ?? []).filter((r) => r.userId !== user.id),
  });
  await setParticipantCanPublish(`room_${id}`, user.id, true);
  await addRoomEvent(id, "seat_approved", firstName, mine.byName.split(" ")[0], user.id);
  await notifyUser(mine.byId, `${firstName} accepted your invitation and is now on a seat in “${room.name}”.`, undefined, "system");
  return ok({ ok: true, seated: true });
}
