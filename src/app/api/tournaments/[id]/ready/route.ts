import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { setTournamentReady } from "@/server/repo";

export const runtime = "nodejs";

// PLAYER endpoint: press READY for my tournament match. When every player in
// the room is ready (and auto-start is on) the match goes LIVE by itself.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const { roomId } = await readJson<{ roomId?: string }>(req);
  if (!roomId) return fail("roomId is required");
  const r = await setTournamentReady(id, String(roomId), user.id);
  if (!r.ok) return fail(r.error ?? "Could not set READY", 400);
  return ok({ allReady: r.allReady });
}
