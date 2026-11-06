import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getRoomRecord, canViewRoom, listRoomPresence, touchRoomPresence, agencyBadgesForUsers } from "@/server/repo";

export const runtime = "nodejs";

// Authoritative member list for a room — everyone CURRENTLY present per
// server-side presence (activeRoomId). Unlike the LiveKit participant list,
// this doesn't depend on the viewer's voice connection, so a member who joined
// always appears in the seat grid even if their voice link is still connecting.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);

  const room = await getRoomRecord(id);
  if (!room) return fail("Room not found", 404);
  if (!canViewRoom(room, user.id, user.role)) return fail("This is a private room", 403);

  // Polling this also serves as a heartbeat for the caller's own presence.
  await touchRoomPresence(user.id, id);
  // Attach each member's own agency (name + id) so their agency shows on the seat,
  // next to their name. Resolved for the whole room in ONE db read.
  // The viewer is passed so a group set to "Hide Admin" strips admins from the
  // list MEMBERS receive (admins still see everyone).
  const members = await listRoomPresence(id, { id: user.id, role: user.role });
  const agencyMap = await agencyBadgesForUsers(members.map((m) => m.id));
  return ok({ members: members.map((m) => ({ ...m, agencyName: agencyMap[m.id]?.name, agencyId: agencyMap[m.id]?.id })) });
}
