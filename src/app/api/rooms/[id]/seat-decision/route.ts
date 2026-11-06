import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getRoomRecord, updateRoomRecord, addRoomEvent, notifyUser } from "@/server/repo";
import { setParticipantCanPublish } from "@/server/livekit";

export const runtime = "nodejs";

// Host / Co-Host approves or rejects a pending seat request. The request is
// removed from the queue atomically so it disappears from every moderator's
// list (no duplicate actions).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);

  const room = await getRoomRecord(id);
  if (!room) return fail("Room not found", 404);
  const isMod = room.ownerId === user.id || (room.coAdminIds ?? []).includes(user.id) || user.role === "admin";
  if (!isMod) return fail("Only the host or a co-host can manage seat requests", 403);

  const { targetUserId, approve } = await readJson<{ targetUserId?: string; approve?: boolean }>(req);
  if (!targetUserId) return fail("Missing target user");

  const reqs = room.seatRequests ?? [];
  const target = reqs.find((r) => r.userId === targetUserId);
  const nextReqs = reqs.filter((r) => r.userId !== targetUserId);
  const name = (target?.userName || "Member").split(" ")[0];
  const actor = user.fullName.split(" ")[0];

  if (approve) {
    const approved = [...new Set([...(room.stageApprovedIds ?? []), targetUserId])];
    // Also lift any listen-only flag so approval actually seats them.
    const nextAudience = (room.audienceIds ?? []).filter((x) => x !== targetUserId);
    await updateRoomRecord(id, { seatRequests: nextReqs, stageApprovedIds: approved, audienceIds: nextAudience });
    // Grant PUBLISH at the SFU now so their mic works immediately (no reconnect).
    await setParticipantCanPublish(`room_${id}`, targetUserId, true);
    await addRoomEvent(id, "seat_approved", name, actor, user.id);
    await notifyUser(targetUserId, `You have been approved to join the voice seat in “${room.name}”.`, { label: "Open room", href: `/rooms/${id}` }, "system");
  } else {
    await updateRoomRecord(id, { seatRequests: nextReqs });
    await addRoomEvent(id, "seat_declined", name, actor, user.id);
    await notifyUser(targetUserId, `Your seat request in “${room.name}” was declined.`, undefined, "system");
  }
  return ok({ ok: true });
}
