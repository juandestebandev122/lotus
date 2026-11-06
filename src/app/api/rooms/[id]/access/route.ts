import { ok } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getRoomRecord, isBannedFromRoom, canViewRoom, touchRoomPresence } from "@/server/repo";

export const runtime = "nodejs";

// Lightweight "may I still be in this room?" check, polled by the voice session
// so a removed/blocked member is dropped from voice IMMEDIATELY — on any screen,
// not just the room page. Returns { allowed, reason }.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return ok({ allowed: false, reason: "auth" });

  const room = await getRoomRecord(id);
  if (!room) return ok({ allowed: true, reason: "ok" }); // seeded/demo room

  if (isBannedFromRoom(room, user.id, user.role)) {
    const blocked = (room.blockedMemberIds ?? []).includes(user.id);
    return ok({ allowed: false, reason: blocked ? "blocked" : "removed" });
  }
  if (!canViewRoom(room, user.id, user.role)) return ok({ allowed: false, reason: "private" });
  // Heartbeat: this poll confirms the user is still live in the room, keeping
  // their seat visible to everyone (and reaping ghosts who closed the app).
  await touchRoomPresence(user.id, id);
  return ok({ allowed: true, reason: "ok" });
}
