import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { adminResetGame, adminResetLobby, adminForceCloseMatches, adminResetRoomState, adminResetPlayerStatus, listRunningGamesForAdmin, listRoomsForReset, listUsersForReset, sweepStuckGames, listResetLog } from "@/server/repo";

export const runtime = "nodejs";

// Reset & Recovery snapshot — the running matches AND stuck lobbies the admin can
// reset, the room list for the room-name autocomplete, and the reset history.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const [running, rooms, users, history] = await Promise.all([listRunningGamesForAdmin(), listRoomsForReset(), listUsersForReset(), listResetLog(200)]);
  return ok({ running, rooms, users, history });
}

// Perform a recovery action. Every action REQUIRES a reason (audited with Admin ID,
// date/time, Room ID, Match ID and Reason).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const b = await readJson<{ action?: string; reason?: string; sessionId?: string; lobbyId?: string; roomId?: string; userId?: string; scope?: string }>(req);
  const reason = (b.reason ?? "").trim();
  if (!reason) return fail("A reason is required for every reset action.", 400);
  const adminId = user.publicId ?? user.id;

  switch (b.action) {
    case "resetGame": {
      if (!b.sessionId) return fail("sessionId is required");
      const r = await adminResetGame(String(b.sessionId), user.fullName, adminId, reason);
      return r.ok ? ok(r) : fail(r.error ?? "Could not reset the game", 400);
    }
    case "resetLobby": {
      // Un-stick a game frozen in the lobby (e.g. "STARTING" that never began).
      if (!b.lobbyId) return fail("lobbyId is required");
      const r = await adminResetLobby(String(b.lobbyId), user.fullName, adminId, reason);
      return r.ok ? ok(r) : fail(r.error ?? "Could not reset the lobby", 400);
    }
    case "forceCloseMatches": {
      // scope "all" closes every running match; otherwise a roomId scopes it.
      const roomId = b.scope === "all" ? undefined : (b.roomId ? String(b.roomId) : undefined);
      if (b.scope !== "all" && !roomId) return fail("Provide a Room ID, or choose 'all rooms'.");
      const r = await adminForceCloseMatches(roomId, user.fullName, adminId, reason);
      return r.ok ? ok(r) : fail(r.error ?? "Could not force-close matches", 400);
    }
    case "resetRoom": {
      if (!b.roomId) return fail("roomId is required");
      const r = await adminResetRoomState(String(b.roomId), user.fullName, adminId, reason);
      return r.ok ? ok(r) : fail(r.error ?? "Could not reset the room", 400);
    }
    case "resetPlayer": {
      if (!b.userId) return fail("userId is required");
      const r = await adminResetPlayerStatus(String(b.userId), user.fullName, adminId, reason);
      return r.ok ? ok(r) : fail(r.error ?? "Could not reset the player", 400);
    }
    case "cleanupNow": {
      // "Clean up now" — the same sweep the automatic cleanup runs, on demand.
      // `manual` makes it work even when auto-reset is switched off.
      const r = await sweepStuckGames({ by: `${user.fullName} (manual)`, auto: false, manual: true });
      return ok({ ok: true, ...r });
    }
    default:
      return fail("Unknown action");
  }
}
