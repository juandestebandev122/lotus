import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getRoomRecord, updateRoomRecord, findById, notifyUser, addRoomEvent, listRoomPresence } from "@/server/repo";

export const runtime = "nodejs";

// Invite a user to this room. Anyone in the room can send the invite (a
// notification with a link); a host/co-host/admin also grants access to a
// private room by adding the invitee to its allow-list.
//
// TWO DIFFERENT INVITES. Sending "join the room" to somebody who is ALREADY
// sitting in the listener area is useless — that was the bug: the host invited
// a listener up, and all the listener got (if anything) was a notification
// telling them to join a room they were already in. So when the target is
// present in the room and not on a seat, a Host/Co-Host/Admin sends a SEAT
// invitation instead, which the listener accepts from inside the room and is
// seated immediately.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return fail("Please log in first", 401);
  const { id } = await params;

  const { targetUserId } = await readJson<{ targetUserId?: string }>(req);
  if (!targetUserId) return fail("Missing user");
  if (targetUserId === me.id) return fail("You can't invite yourself");

  const room = await getRoomRecord(id);
  if (!room) return fail("Room not found", 404);

  const target = await findById(targetUserId);
  if (!target) return fail("User not found", 404);

  const canManage = room.ownerId === me.id || (room.coAdminIds ?? []).includes(me.id) || me.role === "admin";

  // Is this person already here, listening? Either the host explicitly moved
  // them to the listener area, or they are present but have no seat.
  const seated =
    room.ownerId === targetUserId ||
    (room.coAdminIds ?? []).includes(targetUserId) ||
    ((room.stageApprovedIds ?? []).includes(targetUserId) && !(room.audienceIds ?? []).includes(targetUserId));
  const present =
    (room.audienceIds ?? []).includes(targetUserId) ||
    (await listRoomPresence(id)).some((p) => p.id === targetUserId);

  if (canManage && present && !seated) {
    const already = (room.seatInvites ?? []).some((s) => s.userId === targetUserId);
    if (!already) {
      const invites = [
        ...(room.seatInvites ?? []).filter((s) => s.userId !== targetUserId),
        { userId: targetUserId, userName: target.fullName, byId: me.id, byName: me.fullName, at: new Date().toISOString() },
      ];
      await updateRoomRecord(id, { seatInvites: invites });
      await addRoomEvent(id, "seat_invited", target.fullName.split(" ")[0], me.fullName.split(" ")[0], me.id);
    }
    await notifyUser(
      targetUserId,
      `${me.fullName} invited you to take a seat in “${room.name}”.`,
      { label: "Take the seat", href: `/rooms/${id}` },
      "room_invite",
    );
    return ok({ ok: true, kind: "seat", already });
  }

  // Grant private-room access when the inviter is a host/co-host/admin.
  if (canManage && room.type !== "public") {
    const invited = new Set(room.invitedIds ?? []);
    if (!invited.has(targetUserId)) {
      invited.add(targetUserId);
      await updateRoomRecord(id, { invitedIds: [...invited] });
    }
  }

  await notifyUser(
    targetUserId,
    `${me.fullName} invited you to join the room "${room.name}".`,
    { label: "Join room", href: `/rooms/${id}` },
    "room_invite",
  );
  return ok({ ok: true, kind: "room" });
}
