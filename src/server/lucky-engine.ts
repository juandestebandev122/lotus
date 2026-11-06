// ---------------------------------------------------------------------------
// LUCKY NUMBER — multi-round game engine (client specification, phase 1).
//
// Everything that decides an outcome lives HERE, on the server (§57): number
// reservation, eligibility, the draw and the winner calculation. The client
// only ever asks; it never decides.
//
// The three rules the whole game hangs on:
//   §12  one user may hold ONE number per round
//   §13  one number may be held by ONE user per round
//   §14  the FIRST successful server write wins — never browser time
//
// `withDB` gives us a single-writer transaction over the JSON store: the whole
// callback runs to completion before the file is persisted and before any other
// writer is admitted. Doing the "is it free? then take it" check and the write
// inside ONE callback is what makes the reservation atomic (§55). Splitting it
// into a read followed by a separate write would reintroduce the race.
// ---------------------------------------------------------------------------

import { withDB, getDB, type DBShape, type LuckyDrawRecord, type LuckyRound, type LuckyPlayer, type LuckyPlayerStatus } from "./db";
import { chargeLuckyEntry, refundLuckyEntry, payLuckyWinner, pushNotifySync } from "./repo";

export type EngineResult<T = unknown> = ({ ok: true } & Partial<T>) | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const nowIso = () => new Date().toISOString();
const rid = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

function findGame(db: DBShape, gameId: string): LuckyDrawRecord | undefined {
  return (db.luckyDraws ?? []).find((g) => g.id === gameId);
}

/** The round currently in play (1-based `currentRound`). */
function activeRound(g: LuckyDrawRecord): LuckyRound | undefined {
  if (!g.rounds?.length) return undefined;
  const idx = g.currentRound ?? 1;
  return g.rounds.find((r) => r.index === idx);
}

function log(g: LuckyDrawRecord, role: "Admin" | "Host" | "Co-Host" | "Player" | "System", actor: string, action: string, detail?: string, actorId?: string) {
  if (!g.audit) g.audit = [];
  g.audit.push({ at: nowIso(), actor, actorId, role, action, detail });
  // Keep the log bounded but generous — history must not be lost casually (§52).
  if (g.audit.length > 5000) g.audit.splice(0, g.audit.length - 5000);
}

// ---------------------------------------------------------------------------
// §6 / §7 — GROUP MEMBERSHIP IS MANDATORY and overrides game membership.
//
// Being on a seat, listening or viewing is explicitly NOT enough. The user must
// be a real member of the designated group.
// ---------------------------------------------------------------------------

export function isGroupMember(db: DBShape, roomId: string | undefined, userId: string): boolean {
  if (!roomId) return true; // no group designated → the game is open to everyone
  const room = db.rooms.find((r) => r.id === roomId);
  if (!room) return false;

  // Kicked or blocked is never a member, whatever else is true.
  if ((room.blockedMemberIds ?? []).includes(userId)) return false;
  if ((room.removedMemberIds ?? []).includes(userId)) return false;

  // The owner and co-hosts are always members.
  if (room.ownerId === userId) return true;
  if ((room.coAdminIds ?? []).includes(userId)) return true;

  // Invited members of a private / invite-only group.
  if ((room.invitedIds ?? []).includes(userId)) return true;

  // A PUBLIC group has open membership, so anyone not barred belongs to it.
  // (A private or invite-only group falls through to false, which is what makes
  // §6 bite: being seated or listening there is not membership.)
  const forcedPrivate = room.features?.inviteOnly === true || room.features?.publicRoom === false;
  return room.type !== "private" && !forcedPrivate;
}

/** A player may act only when they pass ALL THREE checks (§7). */
function eligible(db: DBShape, g: LuckyDrawRecord, userId: string): boolean {
  const p = (g.players ?? []).find((x) => x.userId === userId);
  if (!p) return false;                                  // game membership
  if (p.status !== "joined" && p.status !== "eligible") return false;
  return isGroupMember(db, g.groupRoomId, userId);       // group membership
}

// ---------------------------------------------------------------------------
// §8 — a player removed from the group must lose the game immediately.
//
// Called before every sensitive operation so a stale membership can never let
// somebody select a number or win a round.
// ---------------------------------------------------------------------------

export function syncGroupMembership(db: DBShape, g: LuckyDrawRecord): number {
  if (!g.groupRoomId || !g.players?.length) return 0;
  let removed = 0;
  const round = activeRound(g);
  for (const p of g.players) {
    if (p.status === "removedFromGroup" || p.status === "leftGame" || p.status === "disqualified") continue;
    if (isGroupMember(db, g.groupRoomId, p.userId)) continue;
    p.status = "removedFromGroup";
    p.removedAt = nowIso();
    p.removeReason = "No longer a member of the game group";
    removed++;
    // §41 — release their number while selection is still open, so it returns
    // to the pool for other eligible players. After selection closes the pick
    // stays on record but the player simply cannot win (§22).
    if (round && round.status === "selection") {
      const pick = round.picks.find((x) => x.userId === p.userId && !x.released);
      if (pick) {
        pick.released = true;
        pick.releasedAt = nowIso();
        pick.releaseReason = "Player removed from the group";
      }
    }
    log(g, "System", "System", "Removed player", `${p.userName} — left/removed from the group`, p.userId);
  }
  return removed;
}

// ---------------------------------------------------------------------------
// Game creation & configuration (§2, §3)
// ---------------------------------------------------------------------------

export interface CreateGameInput {
  name: string;
  description?: string;
  groupRoomId?: string;
  groupRoomName?: string;
  hostId?: string; hostName?: string;
  coHostId?: string; coHostName?: string;
  totalRounds: number;
  minNumber: number;
  maxNumber: number;
  maxPlayers?: number;
  minPlayers?: number;
  joiningMode?: "manual" | "auto" | "both";
  selectionSeconds?: number;
  selectionMethod?: "pick" | "type" | "both";
  winnerContinuation?: "continue" | "removed" | "noWin";
  finalRankBy?: "wins" | "points" | "firstToTarget" | "manual";
  pointsPerWin?: number;
  entryFee?: number;
  prize?: number;
  splitPrize?: boolean;
  prizeMode?: "round" | "final";
  startAt?: string;
}

export async function createGame(input: CreateGameInput, by: string): Promise<EngineResult<{ game: LuckyDrawRecord }>> {
  const name = (input.name ?? "").trim();
  if (!name) return fail("Give the game a name.");
  const totalRounds = Math.max(1, Math.min(100, Math.floor(input.totalRounds || 1)));
  const minNumber = Math.floor(input.minNumber);
  const maxNumber = Math.floor(input.maxNumber);
  if (!Number.isFinite(minNumber) || !Number.isFinite(maxNumber) || maxNumber <= minNumber) {
    return fail("The number range is not valid — the highest number must be above the lowest.");
  }
  if (maxNumber - minNumber + 1 > 10000) return fail("That number range is too large (max 10,000 numbers).");

  return withDB((db) => {
    if (!db.luckyDraws) db.luckyDraws = [];
    // §3 — fixing the total rounds up front CREATES every round immediately, so
    // the admin can see and manage all of them before the game starts.
    const rounds: LuckyRound[] = Array.from({ length: totalRounds }, (_, i) => ({
      id: rid("lr"),
      index: i + 1,
      status: "pending" as const,
      picks: [],
    }));

    const game: LuckyDrawRecord = {
      id: rid("lg"),
      name,
      prizeDetail: input.description,
      status: "scheduled",
      enabled: true,
      minNumber, maxNumber,
      drawMethod: "auto",
      entries: [],
      createdAt: nowIso(),
      createdBy: by,
      // spec model
      totalRounds,
      currentRound: 1,
      maxPlayers: Math.max(2, Math.min(10000, input.maxPlayers ?? 50)),
      minPlayers: Math.max(1, input.minPlayers ?? 2),
      hostId: input.hostId, hostName: input.hostName,
      coHostId: input.coHostId, coHostName: input.coHostName,
      groupRoomId: input.groupRoomId, groupRoomName: input.groupRoomName,
      joiningMode: input.joiningMode ?? "both",
      joiningOpen: false,
      selectionSeconds: Math.max(5, Math.min(3600, input.selectionSeconds ?? 60)),
      selectionMethod: input.selectionMethod ?? "both",
      winnerContinuation: input.winnerContinuation ?? "continue",
      finalRankBy: input.finalRankBy ?? "wins",
      pointsPerWin: Math.max(0, input.pointsPerWin ?? 100),
      entryFee: Math.max(0, input.entryFee ?? 0),
      prize: Math.max(0, input.prize ?? 0),
      splitPrize: input.splitPrize === true,
      prizeMode: input.prizeMode === "final" ? "final" : "round",
      startAt: input.startAt,
      gameStatus: "waiting",
      players: [],
      rounds,
      audit: [],
    };

    // §34 — the host and co-host must themselves be group members.
    if (game.hostId && !isGroupMember(db, game.groupRoomId, game.hostId)) {
      return fail("That user cannot be Host because they are not a member of the game group.");
    }
    if (game.coHostId && !isGroupMember(db, game.groupRoomId, game.coHostId)) {
      return fail("That user cannot be Co-Host because they are not a member of the game group.");
    }

    log(game, "Admin", by, "Created game", `${name} · ${totalRounds} rounds · numbers ${minNumber}–${maxNumber}`);
    db.luckyDraws.push(game);
    return { ok: true as const, game };
  });
}

// ---------------------------------------------------------------------------
// Joining (§5, §10)
// ---------------------------------------------------------------------------

export async function setJoining(gameId: string, open: boolean, by: string, role: "Admin" | "Host" | "Co-Host" = "Admin"): Promise<EngineResult> {
  return withDB((db) => {
    const g = findGame(db, gameId);
    if (!g) return fail("Game not found.");
    g.joiningOpen = open;
    // Opening or closing joining must NOT rewind a game that is already
    // running — an admin letting latecomers in mid-game was knocking the whole
    // game back to "joining", which hid the live round from every player.
    // The lifecycle status only tracks joining BEFORE the game starts.
    const running = g.gameStatus === "started" || g.gameStatus === "paused" || g.gameStatus === "completed";
    if (!running) g.gameStatus = open ? "joiningOpen" : "joiningClosed";
    log(g, role, by, open ? "Opened joining" : "Closed joining");
    return { ok: true as const };
  });
}

export async function joinGame(gameId: string, userId: string, userName: string, publicId: string | undefined, how: "manual" | "auto"): Promise<EngineResult> {
  return withDB((db) => {
    const g = findGame(db, gameId);
    if (!g) return fail("Game not found.");
    if (g.gameStatus === "completed" || g.gameStatus === "cancelled") return fail("This game has finished.");
    if (!g.joiningOpen && how === "auto") return fail("Joining is closed for this game.");

    // §6 — the hard gate. Sitting in the room is not membership.
    if (!isGroupMember(db, g.groupRoomId, userId)) {
      return fail("You must be a member of the game group to participate in Lucky Number.");
    }

    if (!g.players) g.players = [];
    const existing = g.players.find((p) => p.userId === userId);
    if (existing) {
      // §9 — a player who was removed does NOT come back automatically.
      if (existing.status === "removedFromGroup" || existing.status === "disqualified") {
        return fail("You were removed from this game. An admin has to add you back.");
      }
      if (existing.status === "invited") {
        // An invitation still costs the joining fee — it is only taken now,
        // when they actually accept, and only if they haven't paid already.
        if (!existing.feeCharged) {
          const f = chargeLuckyEntry(db, userId, g.entryFee ?? 0, g.name);
          if (!f.ok) return fail(f.error ?? "Could not take the joining cost.");
          existing.feeCharged = f.charged;
        }
        existing.status = "joined";
        existing.joinedAt = nowIso();
        log(g, "Player", userName, "Accepted invitation", existing.feeCharged ? `Paid ${existing.feeCharged} coins` : undefined, userId);
        return { ok: true as const };
      }
      return { ok: true as const }; // already in
    }

    const active = g.players.filter((p) => p.status === "joined" || p.status === "eligible").length;
    if (active >= (g.maxPlayers ?? 50)) return fail("ROOM FULL — this game has reached its maximum players.");

    // The joining cost, taken once when the player actually joins. Charged LAST,
    // after every other check, so nobody is billed for a join that then fails.
    const fee = chargeLuckyEntry(db, userId, g.entryFee ?? 0, g.name);
    if (!fee.ok) return fail(fee.error ?? "Could not take the joining cost.");

    g.players.push({
      userId, userName, publicId,
      status: "joined",
      invitationType: how,
      joinedAt: nowIso(),
      feeCharged: fee.charged,
    });
    log(g, "Player", userName, "Joined", `${how === "auto" ? "Automatic joining" : "Accepted invitation"}${fee.charged ? ` · paid ${fee.charged} coins` : ""}`, userId);
    return { ok: true as const };
  });
}

export async function invitePlayer(gameId: string, userId: string, userName: string, publicId: string | undefined, by: string): Promise<EngineResult> {
  return withDB((db) => {
    const g = findGame(db, gameId);
    if (!g) return fail("Game not found.");
    if (!isGroupMember(db, g.groupRoomId, userId)) {
      return fail(`${userName} is not a member of the game group, so they cannot be invited.`);
    }
    if (!g.players) g.players = [];
    if (g.players.some((p) => p.userId === userId)) return fail(`${userName} is already in this game.`);
    g.players.push({ userId, userName, publicId, status: "invited", invitationType: "manual", invitedBy: by });
    log(g, "Admin", by, "Invited player", userName, userId);
    return { ok: true as const };
  });
}

/** §4 / §8 — admin removes a player, releasing their number when appropriate. */
export async function removePlayer(gameId: string, userId: string, reason: string, by: string): Promise<EngineResult> {
  return withDB((db) => {
    const g = findGame(db, gameId);
    if (!g) return fail("Game not found.");
    const p = (g.players ?? []).find((x) => x.userId === userId);
    if (!p) return fail("That player is not in this game.");
    p.status = "disqualified";
    p.removedAt = nowIso();
    p.removeReason = reason || "Removed by an admin";
    // Someone taken out of the game did not get to play for their money.
    if ((p.feeCharged ?? 0) > 0) {
      refundLuckyEntry(db, p.userId, p.feeCharged!, g.name);
      pushNotifySync(db, p.userId, `You were removed from “${g.name}” — your ${p.feeCharged} coin joining cost has been refunded.`);
      p.feeCharged = 0;
    }
    const round = activeRound(g);
    if (round && round.status === "selection") {
      const pick = round.picks.find((x) => x.userId === userId && !x.released);
      if (pick) { pick.released = true; pick.releasedAt = nowIso(); pick.releaseReason = "Player removed"; }
    }
    log(g, "Admin", by, "Removed player", `${p.userName} — ${p.removeReason}`, userId);
    return { ok: true as const };
  });
}

// ---------------------------------------------------------------------------
// Game & round control (§11, §32)
// ---------------------------------------------------------------------------

// ===========================================================================
// WHO MAY RUN THE GAME
//
// The engine has always accepted a Host / Co-Host role, but nothing outside the
// admin panel ever passed one — so in practice a game could only be run by an
// administrator. These two helpers are what let the room's own Host and Co-Host
// run their game, within limits the admin sets.
// ===========================================================================

/** What the ADMIN allows a Host / Co-Host to do. Defaults are permissive for
 *  running a game (that is the whole point) but never for the hidden draw
 *  number, which stays admin-only. */
export interface LuckyHostPerms {
  start: boolean;        // start the game once people have joined
  round: boolean;        // open number selection for a round
  draw: boolean;         // run the spin / shuffle
  manualPick: boolean;   // choose the winning number by hand (off by default)
  complete: boolean;     // close a round and move to the next
  joining: boolean;      // open / close joining
}

export const DEFAULT_HOST_PERMS: LuckyHostPerms = {
  start: true, round: true, draw: true, manualPick: false, complete: true, joining: true,
};

export function hostPermsOf(db: DBShape): LuckyHostPerms {
  const c = (db.config?.luckyNumber ?? {}) as Partial<LuckyHostPerms>;
  return { ...DEFAULT_HOST_PERMS, ...c };
}

/** This user's role for THIS game. Admins always outrank the room. */
export function roleForGame(
  db: DBShape,
  g: LuckyDrawRecord,
  userId: string,
  isAdmin: boolean,
): "Admin" | "Host" | "Co-Host" | null {
  if (isAdmin) return "Admin";
  if (g.hostId && g.hostId === userId) return "Host";
  if (g.coHostId && g.coHostId === userId) return "Co-Host";
  // A linked voice room's own host / co-hosts run the game there too, which is
  // what "Host or Co-host should be able to start" means in practice.
  const room = g.groupRoomId ? (db.rooms ?? []).find((r) => r.id === g.groupRoomId) : undefined;
  if (room) {
    if (room.hostId === userId || room.ownerId === userId) return "Host";
    if ((room.coAdminIds ?? []).includes(userId)) return "Co-Host";
  }
  return null;
}

/** Is this role allowed to perform `what`? Admin may always. */
export function mayDo(db: DBShape, role: "Admin" | "Host" | "Co-Host" | null, what: keyof LuckyHostPerms): boolean {
  if (role === "Admin") return true;
  if (!role) return false;
  return hostPermsOf(db)[what] === true;
}

export async function startGame(gameId: string, by: string, role: "Admin" | "Host" | "Co-Host" = "Admin"): Promise<EngineResult> {
  return withDB((db) => {
    const g = findGame(db, gameId);
    if (!g) return fail("Game not found.");
    if (!g.rounds?.length) return fail("This game has no rounds configured.");
    syncGroupMembership(db, g);
    const active = (g.players ?? []).filter((p) => p.status === "joined" || p.status === "eligible").length;
    if (active < (g.minPlayers ?? 1)) return fail(`Not enough players yet — ${active} joined, ${g.minPlayers ?? 1} needed.`);
    g.gameStatus = "started";
    g.status = "open";
    g.startedAt = nowIso();
    g.currentRound = 1;
    // Joining closes on start by default, but an admin may reopen it at any
    // time to let latecomers in (§4) without disturbing the running game.
    g.joiningOpen = false;
    log(g, role, by, "Started game", `${active} players · ${g.totalRounds} rounds`);
    return { ok: true as const };
  });
}

export async function pauseGame(gameId: string, paused: boolean, by: string, role: "Admin" | "Host" | "Co-Host" = "Admin"): Promise<EngineResult> {
  return withDB((db) => {
    const g = findGame(db, gameId);
    if (!g) return fail("Game not found.");
    g.gameStatus = paused ? "paused" : "started";
    log(g, role, by, paused ? "Paused game" : "Resumed game");
    return { ok: true as const };
  });
}

/** §11 + §21 — open number selection for the current round and start its clock. */
export async function startRound(gameId: string, by: string, role: "Admin" | "Host" | "Co-Host" = "Admin"): Promise<EngineResult> {
  return withDB((db) => {
    const g = findGame(db, gameId);
    if (!g) return fail("Game not found.");
    if (g.gameStatus === "paused") return fail("The game is paused — resume it first.");
    const r = activeRound(g);
    if (!r) return fail("No round to start.");
    if (r.status === "completed") return fail("That round is already complete.");
    syncGroupMembership(db, g);
    r.status = "selection";
    r.startedAt = r.startedAt ?? nowIso();
    r.selectionOpenAt = nowIso();
    r.selectionCloseAt = new Date(Date.now() + (g.selectionSeconds ?? 60) * 1000).toISOString();
    r.hostId = g.hostId; r.coHostId = g.coHostId;
    log(g, role, by, "Started round", `Round ${r.index} / ${g.totalRounds}`);
    return { ok: true as const };
  });
}

export async function setSelection(gameId: string, open: boolean, by: string, role: "Admin" | "Host" | "Co-Host" = "Admin"): Promise<EngineResult> {
  return withDB((db) => {
    const g = findGame(db, gameId);
    if (!g) return fail("Game not found.");
    const r = activeRound(g);
    if (!r) return fail("No active round.");
    if (open) {
      r.status = "selection";
      r.selectionCloseAt = new Date(Date.now() + (g.selectionSeconds ?? 60) * 1000).toISOString();
      log(g, role, by, "Reopened number selection", `Round ${r.index}`);
    } else {
      r.status = "closed";
      r.closedAt = nowIso();
      log(g, role, by, "Closed number selection", `Round ${r.index}`);
    }
    return { ok: true as const };
  });
}

// ---------------------------------------------------------------------------
// §12–§16 — NUMBER SELECTION. The atomic core of the whole game.
// ---------------------------------------------------------------------------

export async function selectNumber(gameId: string, userId: string, userName: string, num: number): Promise<EngineResult<{ number: number }>> {
  return withDB((db) => {
    const g = findGame(db, gameId);
    if (!g) return fail("Game not found.");
    if (g.gameStatus === "paused") return fail("The game is paused.");

    const r = activeRound(g);
    if (!r) return fail("No round is running.");

    // 1. the round must be open — and the countdown must not have run out (§21).
    if (r.status !== "selection") return fail("NUMBER SELECTION CLOSED — no new numbers can be submitted.");
    if (r.selectionCloseAt && Date.now() > Date.parse(r.selectionCloseAt)) {
      r.status = "closed";
      r.closedAt = nowIso();
      return fail("NUMBER SELECTION CLOSED — the time for this round is up.");
    }

    // 2 + 3. group membership, then game membership + eligibility (§7, §15).
    syncGroupMembership(db, g);
    if (!isGroupMember(db, g.groupRoomId, userId)) {
      return fail("You must be a member of the game group to participate in Lucky Number.");
    }
    if (!eligible(db, g, userId)) return fail("You are not an eligible player in this game.");

    // §31 — a past winner may be barred from playing on.
    if (g.winnerContinuation === "removed") {
      const p = (g.players ?? []).find((x) => x.userId === userId);
      if ((p?.wins ?? 0) > 0) return fail("You already won a round — this game removes winners from later rounds.");
    }

    // 4. the number must be inside the configured range.
    const n = Math.floor(num);
    if (!Number.isFinite(n) || n < g.minNumber || n > g.maxNumber) {
      return fail(`Pick a number between ${g.minNumber} and ${g.maxNumber}.`);
    }

    // 5. §12 — this user must not already hold a number this round.
    const mine = r.picks.find((p) => p.userId === userId && !p.released);
    if (mine) return fail(`You already picked ${mine.number} for this round. One number per round.`);

    // 6. §13 + §14 — the number must be free. This read and the write below are
    // in the SAME transaction, so two players submitting the same number cannot
    // both pass: the first to be admitted here takes it, the second is rejected.
    const taken = r.picks.find((p) => p.number === n && !p.released);
    if (taken) {
      log(g, "Player", userName, "Failed selection", `${n} already taken by ${taken.userName}`, userId);
      return fail(`Number ${n} has already been selected by another player. Please select another available number.`);
    }

    // 7. reserve it. From this instant the number is gone for everyone else.
    r.picks.push({ userId, userName, number: n, at: nowIso() });
    const p = (g.players ?? []).find((x) => x.userId === userId);
    if (p) p.status = "eligible";
    log(g, "Player", userName, "Selected number", String(n), userId);
    return { ok: true as const, number: n };
  });
}

/** §18 / §19 — only an admin may undo a lock, and it is always logged. */
export async function resetUserNumber(gameId: string, userId: string, by: string): Promise<EngineResult> {
  return withDB((db) => {
    const g = findGame(db, gameId);
    if (!g) return fail("Game not found.");
    const r = activeRound(g);
    if (!r) return fail("No active round.");
    const pick = r.picks.find((p) => p.userId === userId && !p.released);
    if (!pick) return fail("That player has no number to reset in this round.");
    pick.released = true;
    pick.releasedAt = nowIso();
    pick.releaseReason = "Reset by an admin";
    log(g, "Admin", by, "Reset user number", `${pick.userName} — released ${pick.number}`, userId);
    return { ok: true as const };
  });
}

// ---------------------------------------------------------------------------
// §22–§28 — THE DRAW.
// ---------------------------------------------------------------------------

/**
 * Pay the game's prize to a set of winners and tell them. `splitPrize` divides
 * the pot between them; otherwise each winner receives the full amount.
 * Everything goes through payLuckyWinner, so the Lotus economy applies exactly
 * as it does everywhere else rewards are paid.
 */
function payPrizeTo(db: DBShape, g: LuckyDrawRecord, winners: { userId: string; userName: string }[], why: string): void {
  const pot = Math.max(0, Math.floor(g.prize ?? 0));
  if (pot <= 0 || winners.length === 0) return;
  const per = g.splitPrize ? Math.floor(pot / winners.length) : pot;
  if (per <= 0) return;
  for (const w of winners) {
    const paid = payLuckyWinner(db, w.userId, per, g.name, why, g.id);
    if (!paid) continue;
    const p = (g.players ?? []).find((x) => x.userId === w.userId);
    if (p) p.prizePaid = (p.prizePaid ?? 0) + per;
    pushNotifySync(db, w.userId, `🎉 You won in “${g.name}”! ${why} — you received ${paid.userGot} ${paid.unit}.`, { label: "Open game", href: "/lucky-number" });
    log(g, "System", "System", "Prize paid", `${w.userName} +${per} (${paid.userGot} ${paid.unit})`, w.userId);
  }
}

export async function drawRound(gameId: string, method: "auto" | "manual", manualNumber: number | undefined, by: string, role: "Admin" | "Host" | "Co-Host" = "Admin"): Promise<EngineResult<{ winningNumber: number; winners: { userId: string; userName: string }[] }>> {
  return withDB((db) => {
    const g = findGame(db, gameId);
    if (!g) return fail("Game not found.");
    const r = activeRound(g);
    if (!r) return fail("No active round.");
    if (r.status === "drawn" || r.status === "completed") return fail("This round has already been drawn.");

    // Close selection first so nothing can land mid-draw.
    if (r.status === "selection") { r.status = "closed"; r.closedAt = nowIso(); }

    // §22 — re-check eligibility immediately BEFORE deciding the winner, so a
    // player who lost group membership cannot win.
    syncGroupMembership(db, g);

    let winning: number;
    if (method === "manual") {
      const n = Math.floor(manualNumber ?? NaN);
      if (!Number.isFinite(n) || n < g.minNumber || n > g.maxNumber) {
        return fail(`Enter a winning number between ${g.minNumber} and ${g.maxNumber}.`);
      }
      winning = n;
    } else {
      // §24 — server-side randomisation. The client never influences this.
      const span = g.maxNumber - g.minNumber + 1;
      winning = g.minNumber + Math.floor(Math.random() * span);
    }

    r.winningNumber = winning;
    r.drawMethod = method;
    r.drawnBy = by;
    r.drawAt = nowIso();
    r.status = "drawn";

    // §25 / §26 — every ELIGIBLE player holding the number wins.
    const winners = r.picks
      .filter((p) => !p.released && p.number === winning && eligible(db, g, p.userId))
      .map((p) => ({ userId: p.userId, userName: p.userName }));
    r.winnerIds = winners.map((w) => w.userId);

    for (const w of winners) {
      const p = (g.players ?? []).find((x) => x.userId === w.userId);
      if (p) {
        p.wins = (p.wins ?? 0) + 1;
        p.points = (p.points ?? 0) + (g.pointsPerWin ?? 100);
      }
    }

    // §28 — THE PRIZE. Paid here when the admin awards it per round; when the
    // game pays "final" instead, completeRound settles it once at the end.
    if ((g.prizeMode ?? "round") === "round") {
      payPrizeTo(db, g, winners, `Round ${r.index} — winning number ${winning}`);
    }

    log(g, role, by, method === "auto" ? "Auto draw" : "Manual draw", String(winning));
    if (winners.length) log(g, "System", "System", "Winner identified", winners.map((w) => w.userName).join(", "));
    else log(g, "System", "System", "No winner", `Nobody selected ${winning}`);

    return { ok: true as const, winningNumber: winning, winners };
  });
}

/** §33 — admin replaces the system result. Always confirmed and logged. */
export async function overrideWinner(gameId: string, userIds: string[], by: string): Promise<EngineResult> {
  return withDB((db) => {
    const g = findGame(db, gameId);
    if (!g) return fail("Game not found.");
    const r = activeRound(g);
    if (!r) return fail("No active round.");
    // Roll back the points from the previous result before applying the new one.
    for (const id of r.winnerIds ?? []) {
      const p = (g.players ?? []).find((x) => x.userId === id);
      if (p) { p.wins = Math.max(0, (p.wins ?? 1) - 1); p.points = Math.max(0, (p.points ?? 0) - (g.pointsPerWin ?? 100)); }
    }
    r.winnerIds = userIds;
    r.overridden = true;
    for (const id of userIds) {
      const p = (g.players ?? []).find((x) => x.userId === id);
      if (p) { p.wins = (p.wins ?? 0) + 1; p.points = (p.points ?? 0) + (g.pointsPerWin ?? 100); }
    }
    const names = userIds.map((id) => (g.players ?? []).find((x) => x.userId === id)?.userName ?? id).join(", ");
    log(g, "Admin", by, "Override winner", `Round ${r.index} → ${names || "no winner"}`);
    return { ok: true as const };
  });
}

/** §30 / §46 — finish the round and advance, or end the game after the last one. */
export async function completeRound(gameId: string, by: string, role: "Admin" | "Host" | "Co-Host" = "Admin"): Promise<EngineResult<{ finished: boolean }>> {
  return withDB((db) => {
    const g = findGame(db, gameId);
    if (!g) return fail("Game not found.");
    const r = activeRound(g);
    if (!r) return fail("No active round.");
    r.status = "completed";
    r.completedAt = nowIso();
    log(g, role, by, "Completed round", `Round ${r.index} / ${g.totalRounds}`);

    const last = r.index >= (g.totalRounds ?? 1);
    if (last) {
      g.gameStatus = "completed";
      g.status = "drawn";
      g.completedAt = nowIso();
      g.finalRanks = computeFinalRanks(g);
      // When the prize is awarded ONCE at the end, it goes to whoever finished
      // first (all of them, if the ranking ties at the top).
      if ((g.prizeMode ?? "round") === "final") {
        const top = (g.finalRanks ?? []).filter((f) => f.rank === 1 && f.wins > 0);
        payPrizeTo(db, g, top.map((f) => ({ userId: f.userId, userName: f.userName })), "Overall winner");
      }
      log(g, "System", "System", "Game completed", `Final winners: ${(g.finalRanks ?? []).slice(0, 4).map((f) => `${f.rank}. ${f.userName}`).join(" · ")}`);
      return { ok: true as const, finished: true };
    }
    g.currentRound = r.index + 1;
    return { ok: true as const, finished: false };
  });
}

// ---------------------------------------------------------------------------
// §48 — FINAL RANKING, by the configured method.
// ---------------------------------------------------------------------------

export function computeFinalRanks(g: LuckyDrawRecord): { userId: string; userName: string; wins: number; points: number; rank: number }[] {
  const players = (g.players ?? []).filter((p) => p.status !== "invited");
  const method = g.finalRankBy ?? "wins";

  // "firstToTarget" ranks by WHEN a player reached their win count, so an early
  // finisher beats a later one on the same number of wins.
  const firstWinAt = new Map<string, number>();
  if (method === "firstToTarget") {
    for (const r of g.rounds ?? []) {
      for (const id of r.winnerIds ?? []) {
        if (!firstWinAt.has(id) && r.drawAt) firstWinAt.set(id, Date.parse(r.drawAt));
      }
    }
  }

  const sorted = [...players].sort((a, b) => {
    const aw = a.wins ?? 0, bw = b.wins ?? 0;
    const ap = a.points ?? 0, bp = b.points ?? 0;
    if (method === "points") return bp - ap || bw - aw;
    if (method === "firstToTarget") {
      if (bw !== aw) return bw - aw;
      return (firstWinAt.get(a.userId) ?? Infinity) - (firstWinAt.get(b.userId) ?? Infinity);
    }
    return bw - aw || bp - ap; // "wins" (default) and "manual" until set by hand
  });

  return sorted.map((p, i) => ({
    userId: p.userId,
    userName: p.userName,
    wins: p.wins ?? 0,
    points: p.points ?? 0,
    rank: i + 1,
  }));
}

// ---------------------------------------------------------------------------
// §37–§39 — HOST / CO-HOST changes and recovery.
// ---------------------------------------------------------------------------

/** Give every player their joining cost back. Safe to call twice — a refunded
 *  player has feeCharged 0 and is skipped. */
function refundEveryone(db: DBShape, g: LuckyDrawRecord): number {
  let n = 0;
  for (const p of g.players ?? []) {
    if ((p.feeCharged ?? 0) > 0) {
      refundLuckyEntry(db, p.userId, p.feeCharged!, g.name);
      pushNotifySync(db, p.userId, `“${g.name}” was cancelled — your ${p.feeCharged} coin joining cost has been refunded.`);
      p.feeCharged = 0;
      n += 1;
    }
  }
  return n;
}

/** Cancel a game that is still running. Joining costs are given back; the game
 *  and its history stay on record. */
export async function cancelGame(gameId: string, reason: string, by: string): Promise<EngineResult<{ refunded: number }>> {
  return withDB((db) => {
    const g = findGame(db, gameId);
    if (!g) return fail("Game not found.");
    if (g.gameStatus === "completed") return fail("That game has already finished.");
    const refunded = refundEveryone(db, g);
    g.gameStatus = "cancelled";
    g.status = "cancelled";
    g.cancelledReason = reason || undefined;
    log(g, "Admin", by, "Cancelled game", `${reason || "no reason given"} · ${refunded} refund(s)`);
    return { ok: true as const, refunded };
  });
}

/** Delete a game outright. Any joining costs still held are refunded first. */
export async function deleteGame(gameId: string, by: string): Promise<EngineResult<{ refunded: number }>> {
  return withDB((db) => {
    const g = findGame(db, gameId);
    if (!g) return fail("Game not found.");
    const refunded = refundEveryone(db, g);
    db.luckyDraws = (db.luckyDraws ?? []).filter((x) => x.id !== gameId);
    void by;
    return { ok: true as const, refunded };
  });
}

export async function assignHost(gameId: string, which: "host" | "coHost", userId: string | null, userName: string | null, by: string): Promise<EngineResult> {
  return withDB((db) => {
    const g = findGame(db, gameId);
    if (!g) return fail("Game not found.");
    if (userId && !isGroupMember(db, g.groupRoomId, userId)) {
      return fail(`${userName ?? "That user"} cannot be assigned because they are not a member of the game group.`);
    }
    if (which === "host") { g.hostId = userId ?? undefined; g.hostName = userName ?? undefined; }
    else { g.coHostId = userId ?? undefined; g.coHostName = userName ?? undefined; }
    log(g, "Admin", by, which === "host" ? "Assigned Host" : "Assigned Co-Host", userName ?? "cleared", userId ?? undefined);
    return { ok: true as const };
  });
}

/**
 * §37–§39 — if the host stops being a group member their role is revoked at
 * once. The co-host is promoted when there is one; otherwise the game is left
 * intact for an admin to recover. The game state is never discarded.
 */
export function reconcileHosts(db: DBShape, g: LuckyDrawRecord): "ok" | "promoted" | "noHost" {
  const hostOk = !g.hostId || isGroupMember(db, g.groupRoomId, g.hostId);
  const coOk = !g.coHostId || isGroupMember(db, g.groupRoomId, g.coHostId);
  if (hostOk && coOk) return "ok";

  if (!coOk && g.coHostId) {
    log(g, "System", "System", "Co-Host revoked", `${g.coHostName ?? g.coHostId} left the group`);
    g.coHostId = undefined; g.coHostName = undefined;
  }
  if (!hostOk && g.hostId) {
    log(g, "System", "System", "Host revoked", `${g.hostName ?? g.hostId} left the group`);
    g.hostId = undefined; g.hostName = undefined;
    if (g.coHostId) {
      g.hostId = g.coHostId; g.hostName = g.coHostName;
      g.coHostId = undefined; g.coHostName = undefined;
      log(g, "System", "System", "Co-Host promoted to Host", g.hostName);
      return "promoted";
    }
    log(g, "System", "System", "HOST AND CO-HOST UNAVAILABLE", "Admin action needed — game state preserved");
    return "noHost";
  }
  return "ok";
}

/** Run the housekeeping every read should see: membership + host reconciliation. */
export async function refreshGame(gameId: string): Promise<void> {
  await withDB((db) => {
    const g = findGame(db, gameId);
    if (!g || !g.totalRounds) return;
    syncGroupMembership(db, g);
    reconcileHosts(db, g);
    // Auto-close a round whose countdown has expired (§21).
    const r = activeRound(g);
    if (r && r.status === "selection" && r.selectionCloseAt && Date.now() > Date.parse(r.selectionCloseAt)) {
      r.status = "closed";
      r.closedAt = nowIso();
      log(g, "System", "System", "Selection closed", `Round ${r.index} — time expired`);
    }
  });
}

// ---------------------------------------------------------------------------
// Views — what each audience is allowed to see.
// ---------------------------------------------------------------------------

/** §1 — the game-room list. */
export async function listGameRooms(userId: string): Promise<unknown[]> {
  const db = await getDB();
  return (db.luckyDraws ?? [])
    .filter((g) => g.totalRounds && g.enabled && g.gameStatus !== "cancelled")
    .map((g) => {
      const active = (g.players ?? []).filter((p) => p.status === "joined" || p.status === "eligible");
      return {
        id: g.id,
        name: g.name,
        hostName: g.hostName ?? "—",
        coHostName: g.coHostName ?? "—",
        players: active.length,
        maxPlayers: g.maxPlayers ?? 50,
        totalRounds: g.totalRounds ?? 1,
        currentRound: g.currentRound ?? 1,
        gameStatus: g.gameStatus ?? "waiting",
        joiningOpen: !!g.joiningOpen,
        groupRoomId: g.groupRoomId,
        groupRoomName: g.groupRoomName,
        canJoin: !!g.joiningOpen && active.length < (g.maxPlayers ?? 50) && isGroupMember(db, g.groupRoomId, userId),
        isMember: isGroupMember(db, g.groupRoomId, userId),
        // So a Host can see at a glance which games are theirs to run. Admins
        // are not flagged here — they would be flagged on every single row.
        myRole: roleForGame(db, g, userId, false),
        joined: (g.players ?? []).some((p) => p.userId === userId && (p.status === "joined" || p.status === "eligible")),
      };
    });
}

/**
 * §44 — the player's own view. Deliberately withholds anything that would let a
 * client predict or influence the draw: no manual number, no other players'
 * unrevealed picks beyond which numbers are taken.
 */
export async function playerView(gameId: string, userId: string, isAdmin = false): Promise<unknown | null> {
  const db = await getDB();
  const g = findGame(db, gameId);
  if (!g || !g.totalRounds) return null;
  const r = activeRound(g);
  const me = (g.players ?? []).find((p) => p.userId === userId);
  const myPick = r?.picks.find((p) => p.userId === userId && !p.released);
  const takenNumbers = (r?.picks ?? []).filter((p) => !p.released).map((p) => p.number);

  // What THIS viewer may do — so the Host/Co-Host see their controls and nobody
  // else does. The server re-checks every action; this only decides the UI.
  const role = roleForGame(db, g, userId, isAdmin);
  const can = {
    start: mayDo(db, role, "start"),
    round: mayDo(db, role, "round"),
    draw: mayDo(db, role, "draw"),
    manualPick: mayDo(db, role, "manualPick"),
    complete: mayDo(db, role, "complete"),
    joining: mayDo(db, role, "joining"),
  };

  return {
    id: g.id,
    name: g.name,
    // The viewer's own standing in this game.
    myRole: role,
    can,
    entryFee: g.entryFee ?? 0,
    prize: g.prize ?? 0,
    prizeDetail: g.prizeDetail ?? "",
    joiningOpen: g.joiningOpen !== false,
    gameStatus: g.gameStatus ?? "waiting",
    totalRounds: g.totalRounds,
    currentRound: g.currentRound ?? 1,
    minNumber: g.minNumber,
    maxNumber: g.maxNumber,
    selectionMethod: g.selectionMethod ?? "both",
    hostName: g.hostName ?? "—",
    coHostName: g.coHostName ?? "—",
    groupRoomId: g.groupRoomId,
    groupRoomName: g.groupRoomName,
    isGroupMember: isGroupMember(db, g.groupRoomId, userId),
    myStatus: me?.status ?? null,
    players: (g.players ?? []).filter((p) => p.status === "joined" || p.status === "eligible").length,
    maxPlayers: g.maxPlayers ?? 50,
    round: r
      ? {
          index: r.index,
          status: r.status,
          selectionCloseAt: r.selectionCloseAt,
          takenNumbers,
          myNumber: myPick?.number ?? null,
          winningNumber: r.status === "drawn" || r.status === "completed" ? r.winningNumber ?? null : null,
          winners: r.status === "drawn" || r.status === "completed"
            ? (r.winnerIds ?? []).map((id) => (g.players ?? []).find((p) => p.userId === id)?.userName ?? id)
            : [],
          iWon: (r.winnerIds ?? []).includes(userId),
        }
      : null,
    // §29 — completed rounds are public history.
    history: (g.rounds ?? [])
      .filter((x) => x.status === "completed" || x.status === "drawn")
      .map((x) => ({
        index: x.index,
        winningNumber: x.winningNumber ?? null,
        winners: (x.winnerIds ?? []).map((id) => (g.players ?? []).find((p) => p.userId === id)?.userName ?? id),
        method: x.drawMethod ?? null,
      })),
    finalRanks: g.gameStatus === "completed" ? g.finalRanks ?? [] : null,
  };
}

/** §50–§52 — the admin view: everything, including the audit trail. */
export async function adminView(gameId: string): Promise<unknown | null> {
  const db = await getDB();
  const g = findGame(db, gameId);
  if (!g || !g.totalRounds) return null;
  const r = activeRound(g);
  return {
    game: g,
    activeRound: r ?? null,
    // §51 — the player / number panel, with BOTH statuses side by side.
    panel: (g.players ?? []).map((p) => {
      const pick = r?.picks.find((x) => x.userId === p.userId && !x.released);
      return {
        userId: p.userId,
        userName: p.userName,
        publicId: p.publicId,
        groupStatus: isGroupMember(db, g.groupRoomId, p.userId) ? "Member" : "Removed",
        gameStatus: p.status,
        number: pick?.number ?? null,
        numberStatus: pick ? "Selected" : p.status === "removedFromGroup" || p.status === "disqualified" ? "Removed" : "Pending",
        wins: p.wins ?? 0,
        points: p.points ?? 0,
      };
    }),
    availableCount: (g.maxNumber - g.minNumber + 1) - ((r?.picks ?? []).filter((p) => !p.released).length),
    takenCount: (r?.picks ?? []).filter((p) => !p.released).length,
  };
}
