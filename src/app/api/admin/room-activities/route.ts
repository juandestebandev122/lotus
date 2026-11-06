import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getRoomActivityDashboard, adminRoomControl, adminRoomMembers, type RaControlAction } from "@/server/repo";

export const runtime = "nodejs";

// Admin "Room Activities" dashboard — monitor & manage every room from one place.
// GET returns the full aggregated snapshot (bounded by ?from&to ISO dates and an
// optional ?roomId). POST performs an admin control action on a room.

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const url = new URL(req.url);
  // Member picker for the remove/transfer controls (on demand for one room).
  const membersOf = url.searchParams.get("members");
  if (membersOf) return ok({ members: await adminRoomMembers(membersOf) });
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;
  const roomId = url.searchParams.get("roomId") || undefined;
  const data = await getRoomActivityDashboard({ from, to, roomId });
  return ok(data);
}

const VALID: RaControlAction[] = ["lock", "unlock", "muteAll", "removeUser", "endRoom", "transferHost"];

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const b = await readJson<{ action?: string; roomId?: string; targetId?: string }>(req);
  if (!b.roomId) return fail("Missing room");
  if (!b.action || !VALID.includes(b.action as RaControlAction)) return fail("Unknown action");
  const res = await adminRoomControl(user.fullName, b.roomId, b.action as RaControlAction, b.targetId);
  return res.ok ? ok({ ok: true, message: res.message }) : fail(res.error ?? "Action failed", 400);
}
