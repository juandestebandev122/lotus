import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { generateTournamentBracket, setTournamentMatchWinner, clearTournamentMatchWinner, distributeTournamentPrizes, cancelTournament, addAdminLog,
  generateTournamentRooms, qualifyRoomPlayer, unqualifyRoomPlayer, setTournamentRoomStatus, generateNextTournamentRound,
  addPlayerToTournamentRoom, replaceTournamentRoomPlayer, updateTournamentBatchSettings, closeTournamentRoom, seatWaitingPlayers, recoverTournament } from "@/server/repo";

export const runtime = "nodejs";

// Tournament play system — admin bracket + match-room controls.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const b = await readJson<{ action?: string; roundIdx?: number; matchIdx?: number; winnerId?: string; winnerName?: string; reason?: string; roomId?: string; userId?: string; status?: string;
    mode?: string; selectedIds?: string[]; outUserId?: string; inUserId?: string; roomCount?: number;
    readyCheck?: boolean; joinTimerMinutes?: number; autoReplace?: boolean; autoStartWhenReady?: boolean; autoNextRound?: boolean; allowSpectators?: boolean; autoCloseRoom?: boolean }>(req);

  // ----- Match Room + Qualification actions -----
  if (b.action === "generateRooms") {
    const mode = b.mode === "online" || b.mode === "manual" ? b.mode : "all";
    // ADMIN OVERRIDE of the auto room count (optional; 1..256).
    const roomCount = typeof b.roomCount === "number" && isFinite(b.roomCount) && b.roomCount >= 1 ? Math.min(256, Math.floor(b.roomCount)) : undefined;
    const r = await generateTournamentRooms(id, mode, Array.isArray(b.selectedIds) ? b.selectedIds.map(String) : undefined, roomCount);
    if (!r.ok) return fail(r.error ?? "Could not create rooms", 400);
    await addAdminLog(user.fullName, `Tournament ${id}: created ${r.roomCount} match rooms (${mode}${roomCount ? `, manual count ${roomCount}` : ""}: ${r.seated} seated, ${r.waiting} waiting)`);
    return ok(r);
  }
  // Waiting-Pool management: fill an open seat / swap a player.
  if (b.action === "addPlayer") {
    if (!b.roomId || !b.userId) return fail("roomId and userId are required");
    const r = await addPlayerToTournamentRoom(id, String(b.roomId), String(b.userId));
    if (!r.ok) return fail(r.error ?? "Could not add the player", 400);
    await addAdminLog(user.fullName, `Tournament ${id}: moved a waiting player into a room`);
    return ok(r);
  }
  if (b.action === "replacePlayer") {
    if (!b.roomId || !b.outUserId || !b.inUserId) return fail("roomId, outUserId and inUserId are required");
    const r = await replaceTournamentRoomPlayer(id, String(b.roomId), String(b.outUserId), String(b.inUserId));
    if (!r.ok) return fail(r.error ?? "Could not replace the player", 400);
    await addAdminLog(user.fullName, `Tournament ${id}: replaced a room player`);
    return ok(r);
  }
  // Per-tournament match settings (Ready check / timer / auto-replace / auto-start /
  // auto-next-round / allow-spectators / auto-close-room).
  if (b.action === "settings") {
    const r = await updateTournamentBatchSettings(id, { readyCheck: b.readyCheck, joinTimerMinutes: b.joinTimerMinutes, autoReplace: b.autoReplace, autoStartWhenReady: b.autoStartWhenReady, autoNextRound: b.autoNextRound, allowSpectators: b.allowSpectators, autoCloseRoom: b.autoCloseRoom });
    if (!r.ok) return fail(r.error ?? "Could not save settings", 400);
    await addAdminLog(user.fullName, `Tournament ${id}: updated match settings`);
    return ok(r);
  }
  if (b.action === "qualify") {
    if (!b.roomId || !b.userId) return fail("roomId and userId are required");
    const r = await qualifyRoomPlayer(id, String(b.roomId), String(b.userId));
    if (!r.ok) return fail(r.error ?? "Could not qualify player", 400);
    await addAdminLog(user.fullName, `Qualified a player in a match room`);
    return ok(r);
  }
  if (b.action === "unqualify") {
    if (!b.roomId || !b.userId) return fail("roomId and userId are required");
    const r = await unqualifyRoomPlayer(id, String(b.roomId), String(b.userId));
    if (!r.ok) return fail(r.error ?? "Could not update", 400);
    await addAdminLog(user.fullName, `Tournament ${id}: removed a qualification (room ${b.roomId}, user ${b.userId})`);
    return ok(r);
  }
  if (b.action === "roomStatus") {
    if (!b.roomId || !b.status) return fail("roomId and status are required");
    const r = await setTournamentRoomStatus(id, String(b.roomId), String(b.status));
    if (!r.ok) return fail(r.error ?? "Could not update room", 400);
    await addAdminLog(user.fullName, `Tournament ${id}: set room ${b.roomId} → ${b.status}`);
    return ok(r);
  }
  // Manually CLOSE a room (used when Auto-Close is OFF).
  if (b.action === "closeRoom") {
    if (!b.roomId) return fail("roomId is required");
    const r = await closeTournamentRoom(id, String(b.roomId));
    if (!r.ok) return fail(r.error ?? "Could not close the room", 400);
    await addAdminLog(user.fullName, `Tournament ${id}: manually closed room ${b.roomId}`);
    return ok(r);
  }
  if (b.action === "nextRound") {
    const r = await generateNextTournamentRound(id);
    if (!r.ok) return fail(r.error ?? "Could not generate next round", 400);
    await addAdminLog(user.fullName, `Generated the next tournament round`);
    return ok(r);
  }
  // UNIVERSAL RECOVERY: un-stick a live tournament — force-start stuck room matches
  // (clear absent/ready) + seat un-roomed players, OR (bracket) report matches that
  // still need a winner.
  if (b.action === "recover") {
    const r = await recoverTournament(id);
    if (!r.ok) return fail(r.error ?? "Could not recover the tournament", 400);
    await addAdminLog(user.fullName, r.kind === "room"
      ? `Tournament ${id}: RECOVERY — force-started ${r.forced} stuck match room(s), seated ${r.seated} waiting player(s)`
      : `Tournament ${id}: RECOVERY checked — ${r.needWinner} bracket match(es) still need a winner${b.reason ? ` — ${b.reason}` : ""}`);
    return ok(r);
  }
  // RECOVERY: create match rooms for every approved player still without one, so a
  // tournament can never soft-lock with players "waiting for a match to be created".
  if (b.action === "seatWaiting") {
    const r = await seatWaitingPlayers(id, b.mode === "online");
    if (!r.ok) return fail(r.error ?? "Could not seat waiting players", 400);
    await addAdminLog(user.fullName, `Tournament ${id}: seated ${r.seated} waiting player(s) into ${r.rooms} new room(s)${b.reason ? ` — ${b.reason}` : ""}`);
    return ok(r);
  }

  if (b.action === "generate") {
    const r = await generateTournamentBracket(id);
    if (!r.ok) return fail(r.error ?? "Could not create matches", 400);
    await addAdminLog(user.fullName, `Generated tournament bracket (${r.count} players)`);
    return ok(r);
  }
  if (b.action === "setWinner") {
    if (typeof b.roundIdx !== "number" || typeof b.matchIdx !== "number" || !b.winnerId) return fail("roundIdx, matchIdx and winnerId are required");
    const r = await setTournamentMatchWinner(id, b.roundIdx, b.matchIdx, String(b.winnerId), user.fullName);
    if (!r.ok) return fail(r.error ?? "Could not record the winner", 400);
    // Log WHICH tournament, WHICH match and WHICH player — the old message said
    // only "recorded a winner", which was impossible to audit afterwards.
    await addAdminLog(user.fullName, `Tournament ${id}: set winner of round ${b.roundIdx + 1} match ${b.matchIdx + 1} → ${b.winnerName || b.winnerId}`);
    return ok(r);
  }
  // Undo a result. The bracket is never permanent until prizes are paid.
  if (b.action === "clearWinner") {
    if (typeof b.roundIdx !== "number" || typeof b.matchIdx !== "number") return fail("roundIdx and matchIdx are required");
    const r = await clearTournamentMatchWinner(id, b.roundIdx, b.matchIdx, user.fullName);
    if (!r.ok) return fail(r.error ?? "Could not undo the result", 400);
    await addAdminLog(user.fullName, `Tournament ${id}: UNDID the result of round ${b.roundIdx + 1} match ${b.matchIdx + 1} (later rounds cleared)`);
    return ok(r);
  }
  if (b.action === "distributePrizes") {
    const r = await distributeTournamentPrizes(id);
    if (!r.ok) return fail(r.error ?? "Could not distribute prizes", 400);
    await addAdminLog(user.fullName, `Distributed tournament prizes (${(r.paid ?? []).length} winners)`);
    return ok(r);
  }
  if (b.action === "cancel") {
    const r = await cancelTournament(id, String(b.reason || ""), user.fullName);
    if (!r.ok) return fail(r.error ?? "Could not cancel", 400);
    await addAdminLog(user.fullName, `Cancelled a tournament`);
    return ok(r);
  }
  return fail("Unknown action");
}
