import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getDB } from "@/server/db";
import { adminSetRoomFeatures, addAdminLog } from "@/server/repo";
import { sanitizeRoomFeatures } from "@/lib/room-features";

export const runtime = "nodejs";

// Super-Admin: read THIS room's stored per-room feature overrides.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const { id } = await ctx.params;
  const db = await getDB();
  const room = db.rooms.find((r) => r.id === id);
  if (!room) return fail("Room not found", 404);
  return ok({ id: room.id, name: room.name, features: room.features ?? {} });
}

// Super-Admin: save THIS room's per-room feature configuration. Only affects this room.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const { id } = await ctx.params;
  const body = await readJson<{ features?: unknown }>(req);
  const features = sanitizeRoomFeatures(body.features);
  const res = await adminSetRoomFeatures(id, features, user.fullName);
  if (!res.ok) return fail(res.error ?? "Could not save room settings", 400);
  await addAdminLog(user.fullName, `Saved per-room settings for room ${id}`);
  return ok({ ok: true, features: res.features });
}
