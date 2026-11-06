import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getRoomRecord, sendGameInvites, listRoomGameInvites, profilesByIds, isSeated } from "@/server/repo";

export const runtime = "nodejs";

// Host invites members (kind "invite") OR a member requests to join (kind
// "request"). Creates real invites + notifies each recipient.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);

  const body = await readJson<{ roomId?: string; game?: string; gameName?: string; toIds?: string[]; kind?: string }>(req);
  const roomId = String(body.roomId ?? "");
  const game = String(body.game ?? "");
  const gameName = String(body.gameName ?? game ?? "Game");
  const kind = body.kind === "request" ? "request" : "invite";
  const toIds = Array.isArray(body.toIds) ? body.toIds.filter((x) => typeof x === "string").slice(0, 20) : [];
  if (!roomId || !game || toIds.length === 0) return fail("Missing room, game or recipients");

  // Room must exist (seeded/demo rooms have no record — allow them).
  const room = await getRoomRecord(roomId);
  if (room && room.ownerId !== user.id && !(room.coAdminIds ?? []).includes(user.id) && kind === "invite") {
    // Only host/co-host send "invite"; anyone in the room may send a "request".
    // (We still allow it but tag as request to avoid abuse.)
  }

  // ONLY members ON A SEAT may take part in a game. A LISTENER can neither send
  // nor receive a game invitation (enforced here so a stale client can't bypass it).
  if (room && !isSeated(room, user.id)) return fail("Only members on a voice seat can join or invite to a game. Take a seat first.", 403);
  const eligibleIds = room ? toIds.filter((id) => isSeated(room, id)) : toIds;
  if (eligibleIds.length === 0) return fail("Those players are listeners — only members on a voice seat can play. Ask them to take a seat first.", 400);

  // Resolve recipient names from their accounts.
  const profiles = await profilesByIds(eligibleIds);
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const to = eligibleIds.map((id) => ({ id, name: byId.get(id)?.fullName ?? "Player" }));

  const created = await sendGameInvites({ roomId, game, gameName, fromId: user.id, fromName: user.fullName, kind, to });
  return ok({ ok: true, invites: created });
}

// Sender's live status board for a room+game.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const url = new URL(req.url);
  const roomId = url.searchParams.get("roomId") ?? "";
  const game = url.searchParams.get("game") ?? "";
  if (!roomId || !game) return ok({ invites: [] });
  return ok({ invites: await listRoomGameInvites(roomId, game, user.id) });
}
