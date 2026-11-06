import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getRoomRecord, leaveRoom, reapAbandonedSessions } from "@/server/repo";
import { removeRoomParticipant } from "@/server/livekit";

export const runtime = "nodejs";

// Host / Co-Host / Admin forcibly disconnects a member from the voice server
// (kick or block). The persisted removedMemberIds/blockedMemberIds list (set via
// the room PATCH) is what keeps them OUT; this just makes the disconnect instant.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);

  const room = await getRoomRecord(id);
  const isHostOrCoHost =
    !room ||
    room.ownerId === user.id ||
    (room.coAdminIds ?? []).includes(user.id) ||
    user.role === "admin";
  if (!isHostOrCoHost) return fail("Only the host or a co-host can remove members", 403);
  // PER-ROOM MODERATION (Admin → Room Settings): "Kick Users" turned off disables
  // removing members in THIS room. Admins are exempt (they set/override it). Unset = allowed.
  if (room && room.features?.kickUsers === false && user.role !== "admin") return fail("Removing members is turned off in this room", 403);

  const { targetUserId } = await readJson<{ targetUserId?: string }>(req);
  if (!targetUserId) return fail("Missing target user");

  // Drop their presence + force-disconnect them from the SFU immediately.
  await leaveRoom(targetUserId, id);
  await removeRoomParticipant(`room_${id}`, targetUserId);
  // If the room is now empty, auto-close any game still running in it.
  await reapAbandonedSessions(id);
  // Admin notification center: surface kicks to admins (Room Activities feed).
  try {
    const { notifyAdmins } = await import("@/server/repo");
    await notifyAdmins(`A member was removed from “${room?.name ?? id}” by ${user.fullName}.`, { label: "Room Activities", href: "/admin/room-activities" });
  } catch { /* non-fatal */ }
  return ok({ ok: true });
}
