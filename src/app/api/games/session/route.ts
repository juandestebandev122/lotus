import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { startGameSession, endGameSession, reopenGameSession, getGameSession, syncGameState, markSeatLeft, recordSpectator, liveSpectatorCount, liveSpectatorNames, reapAbandonedSessions, getConfig, spendCoins, listActiveSessionsForRoom, getRoomRecord, agencyBadgeOfUser, forceEndGameSession, addAdminLog } from "@/server/repo";

export const runtime = "nodejs";

// A cheap, stable fingerprint of the live state string. Players poll this
// endpoint several times a second between them; when the board has not changed
// there is no reason to send the whole board back down a mobile connection.
function stateFingerprint(s: string | null | undefined): string {
  if (!s) return "0";
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  return `${s.length.toString(36)}.${h.toString(36)}`;
}

// Read a session: status + live state (for spectators) + spectator count.
// Pass ?watch=1 to register a spectator heartbeat.
// Pass ?sh=<fingerprint> to have the state omitted when it has not changed.
// Pass ?lite=1 (the playing clients do) to skip the room/agency lookup, which
// only the spectator view needs — it is two extra database walks per poll.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return fail("id required");
  if (url.searchParams.get("watch")) {
    const user = await getCurrentUser();
    if (user) await recordSpectator(id, user.id);
  }
  let session = await getGameSession(id);
  if (!session) return ok({ session: null });
  // Auto-close the game if its room has emptied out, so a spectator watching an
  // abandoned match sees it end (no game running with nobody playing). This is
  // throttled per room inside the reaper — it makes a LiveKit call and a write,
  // so it must not run on every poll of a live match.
  if (session.status === "running") {
    await reapAbandonedSessions(session.roomId);
    session = (await getGameSession(id)) ?? session;
  }
  const lite = url.searchParams.get("lite") === "1";
  // The agency that manages this game's room (owner's agency) — labelled next to
  // the room name in the spectator view, same as everywhere else.
  const gameRoom = lite ? null : await getRoomRecord(session.roomId);
  const agency = gameRoom ? await agencyBadgeOfUser(gameRoom.ownerId) : null;

  const fp = stateFingerprint(session.state);
  const unchanged = url.searchParams.get("sh") === fp;

  return ok({
    session: {
      id: session.id,
      game: session.game,
      roomId: session.roomId,
      roomName: session.roomName,
      agencyName: agency?.name,
      agencyId: agency?.id,
      players: session.players,
      playerIds: session.playerIds ?? [],
      status: session.status,
      winner: session.winner ?? null,
      state: unchanged ? null : (session.state ?? null),
      stateHash: fp,
      stateUnchanged: unchanged,
      // Liveness only — refreshed by the reaper whenever the room is occupied.
      // Kept for spectator/admin views. NOT a move witness (see lastMoveAt).
      lastActiveAt: session.lastActiveAt ?? null,
      // When the server last saw ANY player push a move. The turn timer needs
      // this: if the server has seen a NEW move since a turn began, the player
      // whose turn it is IS playing, and no device may take their turn away just
      // because its own copy of the board has not caught up yet. Null on a
      // session that predates this field — the client then falls back to its
      // timers alone, which errs towards keeping the game moving.
      lastMoveAt: session.lastMoveAt ?? null,
      leftSeats: session.leftSeats ?? [],
      spectators: liveSpectatorCount(session),
      spectatorNames: await liveSpectatorNames(session),
    },
  });
}

// Start (or reuse) a game session for a room.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const body = await readJson<{ roomId?: string; roomName?: string; game?: string; players?: string[]; playerIds?: string[] }>(req);
  if (!body.roomId || !body.game) return fail("roomId and game are required");
  // Guard against a malformed client sending a non-string game (e.g. an object),
  // which would be stored as-is and later crash the admin Active-Games page.
  if (typeof body.roomId !== "string" || typeof body.game !== "string") return fail("roomId and game must be text");

  // Admin game controls: a disabled game can't be started, and a game with a
  // coin cost charges the host who starts it (Ludo is free). Reusing a running
  // session is free (joiners/rejoiners never pay) — only the first start charges.
  const cfg = await getConfig();
  if (cfg.features?.games === false) return fail("The games section is currently turned off.", 403);
  const gameItem = (cfg.games ?? []).find((g) => g.id === body.game);
  if (gameItem && gameItem.enabled === false) return fail("This game is currently disabled by the admin.", 403);
  // MEMBER PERMISSION: members can start games by default; only blocked when the
  // Host/Co-Host has explicitly switched the "Games" permission OFF.
  const room = await getRoomRecord(body.roomId);
  if (room) {
    const isRoomMod = room.ownerId === user.id || (room.coAdminIds ?? []).includes(user.id) || user.role === "admin";
    if (!isRoomMod && room.memberPerms?.games === false) {
      return fail("Only the Host and Co-Host can start games in this room.", 403);
    }
  }
  // COIN-FREE GAMES (client policy): games never charge coins to start unless an
  // admin explicitly turns game-coins back ON (config.settings.gameCoinsEnabled).
  // By default this is OFF, so no coins are used/deducted through any game.
  const cost = cfg.settings?.gameCoinsEnabled === true ? (gameItem?.coinCost ?? 0) : 0;
  if (cost > 0) {
    const alreadyRunning = (await listActiveSessionsForRoom(body.roomId)).some((s) => s.game === body.game);
    if (!alreadyRunning) {
      const charge = await spendCoins(user.id, user.fullName, cost, `Started ${gameItem?.name ?? body.game} game`);
      if (!charge.ok) {
        return fail(charge.error === "Insufficient coins" ? `You need ${cost} coins to start ${gameItem?.name ?? "this game"}. Add coins in your Wallet.` : (charge.error ?? "Could not start the game"), 402);
      }
    }
  }

  const session = await startGameSession({
    roomId: body.roomId,
    roomName: body.roomName || "Room",
    game: body.game,
    players: Array.isArray(body.players) ? body.players.slice(0, 8) : [],
    playerIds: Array.isArray(body.playerIds) ? body.playerIds.filter((x) => typeof x === "string").slice(0, 8) : [],
    startedByName: user.fullName,
  });
  return ok({ id: session.id });
}

// Push live state, or end the session with the winner.
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const body = await readJson<{ id?: string; winner?: string; state?: string; reopen?: boolean; leftSeat?: string; forceEnd?: boolean; reason?: string }>(req);
  if (!body.id) return fail("id required");
  // HOST / CO-HOST (or admin) "End Game" — force-close the match for EVERYONE. This
  // is the escape hatch for a match that won't end on its own (stuck on a player's
  // turn, or a Play-Again loop the host wants to stop). Authorized server-side by
  // the room's host / co-host list so a normal player can never end others' games.
  if (body.forceEnd) {
    const session = await getGameSession(body.id);
    if (!session) return fail("Game not found", 404);
    const room = await getRoomRecord(session.roomId);
    // Same room-mod definition the client's End-game button uses (host / owner /
    // co-host) plus admin — so the button is never shown to someone the server
    // would 403. hostId is included to match the client's `r.host?.id === myId`.
    const isMod = user.role === "admin" || (!!room && (room.hostId === user.id || room.ownerId === user.id || (room.coAdminIds ?? []).includes(user.id)));
    if (!isMod) return fail("Only the Host or Co-Host can end the match.", 403);
    await forceEndGameSession(body.id);
    if (user.role === "admin") await addAdminLog(user.fullName, `Force-ended game ${body.id} in room ${session.roomId}${body.reason ? ` — ${body.reason}` : ""}`);
    return ok({ ok: true, ended: true });
  }
  // "Play Again": re-open a finished session BEFORE syncing the fresh state.
  if (body.reopen) await reopenGameSession(body.id);
  // A player pressed Leave → mark their seat left (server-authoritative removal).
  if (typeof body.leftSeat === "string" && body.leftSeat) await markSeatLeft(body.id, body.leftSeat);
  if (typeof body.state === "string") await syncGameState(body.id, body.state);
  if (body.winner !== undefined) await endGameSession(body.id, typeof body.winner === "string" ? body.winner : undefined);
  return ok({ ok: true });
}
