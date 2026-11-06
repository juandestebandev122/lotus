import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getRoomRecord, canAccessRoom, joinRoom, leaveRoom, reapAbandonedSessions } from "@/server/repo";

export const runtime = "nodejs";

// POST { action: "join" | "leave" } — enforces one active room at a time.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);

  const { action } = await readJson(req);

  if (action === "leave") {
    // Force-clear the user's active room (prevents stale-state lockout).
    await leaveRoom(user.id);
    // NOTE: we intentionally do NOT drop the user's seat approval here. A brief
    // network reconnect (common on mobile/roaming) triggers a leave→rejoin, and
    // dropping approval on every such blip was kicking seated users off their
    // seat. A member now KEEPS their seat across reconnects — it's only released
    // when they explicitly leave their seat or a host/co-host removes them.
    // If that was the last person, auto-close any game still running in the room.
    await reapAbandonedSessions(id);
    return ok({ left: true });
  }

  // join — `room` is undefined for the always-on seeded demo rooms (treated public)
  const room = await getRoomRecord(id);
  if (room && !canAccessRoom(room, user.id, user.role)) return fail("This is a private room", 403);

  const res = await joinRoom(user.id, id);
  if (!res.ok) {
    const other = await getRoomRecord(res.activeRoomId);
    return fail(
      `You are already active in ${other?.name ?? "another room"}. Please leave your current room before joining a new one.`,
      409,
    );
  }
  return ok({ joined: true });
}
