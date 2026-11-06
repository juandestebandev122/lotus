import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getDB } from "@/server/db";
import { addAdminLog } from "@/server/repo";
import {
  createGame, setJoining, invitePlayer, removePlayer, startGame, pauseGame,
  startRound, setSelection, selectNumber, resetUserNumber, drawRound,
  overrideWinner, completeRound, assignHost, adminView, refreshGame,
  cancelGame, deleteGame,
  type CreateGameInput,
} from "@/server/lucky-engine";

export const runtime = "nodejs";

async function requireAdmin() {
  const me = await getCurrentUser();
  if (!me) return { err: fail("Please log in first", 401) };
  if (me.role !== "admin") return { err: fail("Administrator access required", 403) };
  return { me };
}

// GET — the admin dashboard list (§50), or one game in full with the
// player/number panel and audit trail (?id=).
export async function GET(req: Request) {
  const { me, err } = await requireAdmin();
  if (err || !me) return err!;
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    await refreshGame(id);
    const view = await adminView(id);
    return view ? ok(view) : fail("Game not found", 404);
  }
  const db = await getDB();
  const games = (db.luckyDraws ?? []).filter((g) => g.totalRounds);
  for (const g of games) await refreshGame(g.id);
  const fresh = (await getDB()).luckyDraws ?? [];
  const rows = fresh.filter((g) => g.totalRounds).map((g) => {
    const active = (g.players ?? []).filter((p) => p.status === "joined" || p.status === "eligible");
    const round = (g.rounds ?? []).find((r) => r.index === (g.currentRound ?? 1));
    return {
      id: g.id, name: g.name,
      gameStatus: g.gameStatus ?? "waiting",
      hostName: g.hostName ?? "—", coHostName: g.coHostName ?? "—",
      players: active.length, maxPlayers: g.maxPlayers ?? 50,
      totalRounds: g.totalRounds ?? 1, currentRound: g.currentRound ?? 1,
      roundStatus: round?.status ?? "pending",
      submitted: (round?.picks ?? []).filter((p) => !p.released).length,
      joiningOpen: !!g.joiningOpen,
      groupRoomName: g.groupRoomName,
      minNumber: g.minNumber, maxNumber: g.maxNumber,
      entryFee: g.entryFee ?? 0, prize: g.prize ?? 0, prizeMode: g.prizeMode ?? "round",
      createdAt: g.createdAt,
    };
  });
  const summary = {
    total: rows.length,
    active: rows.filter((r) => r.gameStatus === "started").length,
    waiting: rows.filter((r) => r.gameStatus === "waiting" || r.gameStatus === "joiningOpen").length,
    completed: rows.filter((r) => r.gameStatus === "completed").length,
    players: rows.reduce((s, r) => s + r.players, 0),
  };
  return ok({ games: rows, summary });
}

// POST — every admin / host control in §4 and §32, in one place.
export async function POST(req: Request) {
  const { me, err } = await requireAdmin();
  if (err || !me) return err!;
  const b = await readJson<Record<string, unknown>>(req);
  const action = String(b.action ?? "");
  const gameId = String(b.gameId ?? "");
  const by = me.fullName;

  if (action === "create") {
    const r = await createGame(b.game as unknown as CreateGameInput, by);
    if (!r.ok) return fail(r.error);
    await addAdminLog(by, `Created Lucky Number game "${(b.game as { name?: string })?.name ?? ""}"`);
    return ok({ game: r.game });
  }

  if (!gameId) return fail("Which game?");
  await refreshGame(gameId);

  const run = async () => {
    switch (action) {
      case "openJoining": return setJoining(gameId, true, by);
      case "closeJoining": return setJoining(gameId, false, by);
      case "invite": return invitePlayer(gameId, String(b.userId), String(b.userName), b.publicId as string | undefined, by);
      case "addPlayer": return joinAsAdmin(gameId, String(b.userId), String(b.userName), b.publicId as string | undefined);
      case "removePlayer": return removePlayer(gameId, String(b.userId), String(b.reason ?? ""), by);
      case "start": return startGame(gameId, by);
      case "pause": return pauseGame(gameId, true, by);
      case "resume": return pauseGame(gameId, false, by);
      case "startRound": return startRound(gameId, by);
      case "closeSelection": return setSelection(gameId, false, by);
      case "reopenSelection": return setSelection(gameId, true, by);
      case "setNumberFor": return selectNumber(gameId, String(b.userId), String(b.userName), Number(b.number));
      case "resetNumber": return resetUserNumber(gameId, String(b.userId), by);
      case "draw": return drawRound(gameId, (b.method === "manual" ? "manual" : "auto"), b.number as number | undefined, by);
      case "redraw": return drawRound(gameId, (b.method === "manual" ? "manual" : "auto"), b.number as number | undefined, by);
      case "overrideWinner": return overrideWinner(gameId, (b.userIds as string[]) ?? [], by);
      case "completeRound": return completeRound(gameId, by);
      case "assignHost": return assignHost(gameId, "host", (b.userId as string) || null, (b.userName as string) || null, by);
      case "assignCoHost": return assignHost(gameId, "coHost", (b.userId as string) || null, (b.userName as string) || null, by);
      // Cancelling and deleting both give every player their joining cost back.
      case "cancel": return cancelGame(gameId, String(b.reason ?? ""), by);
      case "delete": return deleteGame(gameId, by);
      default: return { ok: false as const, error: "Unknown action" };
    }
  };

  const r = await run();
  if (!r.ok) return fail(r.error);
  await addAdminLog(by, `Lucky Number: ${action}`);
  return ok(r as Record<string, unknown>);
}

// An admin adding somebody straight in bypasses the "joining open" gate but
// NEVER the group-membership rule — that check lives in the engine.
async function joinAsAdmin(gameId: string, userId: string, userName: string, publicId?: string) {
  const { joinGame } = await import("@/server/lucky-engine");
  return joinGame(gameId, userId, userName, publicId, "manual");
}
