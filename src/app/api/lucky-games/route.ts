import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getDB } from "@/server/db";
import {
  listGameRooms, joinGame, selectNumber, refreshGame,
  startGame, startRound, setSelection, drawRound, completeRound, setJoining,
  roleForGame, mayDo,
} from "@/server/lucky-engine";

export const runtime = "nodejs";

// The player-facing game-room list (§1).
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return fail("Please log in first", 401);
  return ok({ games: await listGameRooms(me.id) });
}

/**
 * Player AND Host/Co-Host actions.
 *
 * Everything that decides an outcome happens in the engine on the server (§57);
 * this route only authenticates, works out the caller's role for THIS game, and
 * passes the request through.
 *
 * Before this, the only way to start a game or run a draw was the admin panel —
 * so a room's own Host could never run their own game. Host and Co-Host can now
 * do it, but only the actions the admin has allowed, and the winning number is
 * still decided entirely server-side.
 */
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return fail("Please log in first", 401);

  const body = await readJson<{ action?: string; gameId?: string; number?: number; open?: boolean; method?: string }>(req);
  const gameId = body.gameId ?? "";
  if (!gameId) return fail("Which game?");
  await refreshGame(gameId);

  // ---- anyone who is allowed in the game ----
  switch (body.action) {
    case "join": {
      const r = await joinGame(gameId, me.id, me.fullName, me.publicId, "auto");
      return r.ok ? ok({ ok: true }) : fail(r.error);
    }
    case "select": {
      const r = await selectNumber(gameId, me.id, me.fullName, Number(body.number));
      return r.ok ? ok({ ok: true, number: r.number }) : fail(r.error);
    }
  }

  // ---- from here on: Host / Co-Host / Admin only ----
  const db = await getDB();
  const g = (db.luckyDraws ?? []).find((x) => x.id === gameId);
  if (!g) return fail("Game not found", 404);
  const role = roleForGame(db, g, me.id, me.role === "admin");
  if (!role) return fail("Only the Host, Co-Host or an administrator can do that.", 403);

  /** Refuse politely when the admin has switched this control off for hosts. */
  const gate = (what: Parameters<typeof mayDo>[2]) =>
    mayDo(db, role, what) ? null : fail("The administrator has not allowed the Host to do that.", 403);

  switch (body.action) {
    case "start": {
      const bad = gate("start"); if (bad) return bad;
      const r = await startGame(gameId, me.fullName, role);
      return r.ok ? ok({ ok: true }) : fail(r.error);
    }
    case "startRound": {
      const bad = gate("round"); if (bad) return bad;
      const r = await startRound(gameId, me.fullName, role);
      return r.ok ? ok({ ok: true }) : fail(r.error);
    }
    case "selection": {
      const bad = gate("round"); if (bad) return bad;
      const r = await setSelection(gameId, body.open !== false, me.fullName, role);
      return r.ok ? ok({ ok: true }) : fail(r.error);
    }
    case "joining": {
      const bad = gate("joining"); if (bad) return bad;
      const r = await setJoining(gameId, body.open !== false, me.fullName, role);
      return r.ok ? ok({ ok: true }) : fail(r.error);
    }
    case "draw": {
      const bad = gate("draw"); if (bad) return bad;
      // A HOST may only ever run the random draw. Hand-picking the winning
      // number stays behind its own permission (off by default) — otherwise
      // "spin" would be decorative and the host could simply choose a winner.
      const wantsManual = body.method === "manual";
      if (wantsManual) {
        const badManual = gate("manualPick"); if (badManual) return badManual;
      }
      const r = await drawRound(
        gameId,
        wantsManual ? "manual" : "auto",
        wantsManual ? Number(body.number) : undefined,
        me.fullName,
        role,
      );
      return r.ok ? ok({ ok: true, winningNumber: r.winningNumber, winners: r.winners }) : fail(r.error);
    }
    case "complete": {
      const bad = gate("complete"); if (bad) return bad;
      const r = await completeRound(gameId, me.fullName, role);
      return r.ok ? ok({ ok: true, finished: r.finished }) : fail(r.error);
    }
    default:
      return fail("Unknown action");
  }
}
