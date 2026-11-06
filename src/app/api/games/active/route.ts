import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listActiveSessionsForRoom, getConfig, liveSpectatorCount, reapAbandonedSessions, isTournamentMatchRoom } from "@/server/repo";

export const runtime = "nodejs";

// Active games in a room — used to show "Watch" buttons to non-players.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const roomId = new URL(req.url).searchParams.get("room");
  if (!roomId) return fail("room required");

  // Auto-close any game in this room that's been abandoned (empty room).
  await reapAbandonedSessions(roomId);

  const config = await getConfig();
  const spectatorOn = (name: string) => {
    const g = config.games.find((x) => x.name === name);
    return g ? g.spectator !== false : true;
  };

  const sessions = (await listActiveSessionsForRoom(roomId))
    .filter((s) => spectatorOn(s.game))
    .map((s) => ({ id: s.id, game: s.game, players: s.players, playerIds: s.playerIds ?? [], spectators: liveSpectatorCount(s) }));
  // Whether this is a tournament match room — the client forces certified fair dice here.
  const tournament = await isTournamentMatchRoom(roomId);
  return ok({ sessions, tournament });
}
