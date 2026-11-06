import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getRoomRecord } from "@/server/repo";

export const runtime = "nodejs";

// GET: just the room's current media state (tiny payload) so every member can
// poll it FAST — the host's play / pause / resume / skip / stop reaches everyone
// within ~2s instead of waiting for the heavier 6s full-room poll.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const room = await getRoomRecord(id);
  if (!room) return fail("Room not found", 404);
  return ok({ media: room.media ?? null });
}
