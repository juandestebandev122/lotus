import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listTakenLudoColors, claimLudoColor } from "@/server/repo";

export const runtime = "nodejs";

// GET ?room=… → colours other players in the room have already reserved (Ludo).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const room = new URL(req.url).searchParams.get("room") ?? "";
  if (!room) return ok({ taken: [] });
  const res = await listTakenLudoColors(room, user.id);
  return ok(res);
}

// POST { room, color } → reserve this colour (empty color releases it). Returns
// the current taken set + whether the requested colour clashed (already taken).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const b = await readJson<{ room?: string; color?: string }>(req);
  if (!b.room) return fail("Missing room");
  const res = await claimLudoColor(user.id, String(b.room), String(b.color ?? ""));
  return ok(res);
}
