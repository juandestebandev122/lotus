import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { addRoomEvent, listRoomEvents, getRoomRecord, notifyUser, isBannedFromRoom } from "@/server/repo";
import type { RoomEvent } from "@/server/db";

export const runtime = "nodejs";

const VALID: RoomEvent["type"][] = ["join", "leave", "mute", "unmute", "remove", "suspend", "ban", "cohost", "uncohost", "rejoin_blocked", "seat_request", "seat_approved", "seat_declined", "seat_left", "seat_invited", "seat_invite_declined"];

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return fail("Not authenticated", 401);
  const { id } = await params;
  return ok({ events: await listRoomEvents(id) });
}

// Log a room activity event. Body: { type, target? }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return fail("Not authenticated", 401);
  const { id } = await params;

  const body = await readJson<{ type?: string; target?: string }>(req);
  const type = body.type as RoomEvent["type"] | undefined;
  if (!type || !VALID.includes(type)) return fail("Invalid event type");

  const myName = me.fullName.split(" ")[0];
  const target = typeof body.target === "string" && body.target.trim() ? body.target.trim() : myName;

  const room = await getRoomRecord(id);
  // Removed / blocked members cannot post room activity (join/etc.).
  if (room && isBannedFromRoom(room, me.id, me.role)) return fail("You no longer have access to this room", 403);

  // A muted user trying to (re)join → log a blocked-rejoin event + alert the host.
  if (type === "join" && room && (room.mutedUserIds ?? []).includes(me.id)) {
    const blocked = await addRoomEvent(id, "rejoin_blocked", myName, myName, me.id);
    if (room.hostId !== me.id) {
      await notifyUser(room.hostId, `🚫 ${myName} (muted) tried to rejoin "${room.name}".`, { label: "Open room", href: `/rooms/${id}` }, "system");
    }
    return ok({ event: blocked });
  }

  const ev = await addRoomEvent(id, type, target, myName, me.id);

  // Alert the host about joins/leaves in a monitored (recording) room.
  if (room && room.recording && (type === "join" || type === "leave") && room.hostId !== me.id) {
    await notifyUser(room.hostId, `${myName} ${type === "join" ? "joined" : "left"} your monitored room "${room.name}".`, { label: "Open room", href: `/rooms/${id}` }, "system");
  }
  return ok({ event: ev });
}
