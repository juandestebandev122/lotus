import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getLobbyView, lobbyAction } from "@/server/repo";

export const runtime = "nodejs";

// Current lobby state for a room+game (null when the flow is off or no lobby exists).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const url = new URL(req.url);
  const roomId = url.searchParams.get("room");
  const game = (url.searchParams.get("game") || "ludo").toLowerCase();
  if (!roomId) return fail("room required");
  return ok({ lobby: await getLobbyView(roomId, game, user.id) });
}

// All lobby actions (open / mode / join / leave / host controls).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const b = await readJson<{ room?: string; game?: string; action?: string; mode?: string; color?: string; targetId?: string }>(req);
  if (!b.room || !b.action) return fail("room and action are required");
  const res = await lobbyAction(user.id, b.room, (b.game || "ludo").toLowerCase(), b.action, { mode: b.mode, color: b.color, targetId: b.targetId });
  return res.ok ? ok({ ok: true }) : fail(res.error ?? "Action failed", 400);
}
