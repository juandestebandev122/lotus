import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listGameSessions, forceEndGameSession, addAdminLog, liveSpectatorCount, reapAbandonedSessions } from "@/server/repo";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  // Auto-close abandoned games before listing so empty rooms don't show as active.
  await reapAbandonedSessions();
  const all = await listGameSessions();
  // Sanitize each record so a legacy/corrupt session (e.g. a non-string `game`
  // field) can never be sent as an object — that crashed the admin page render
  // (React error #31). Force every display field to a safe string/array.
  const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : v == null ? fallback : typeof v === "number" ? String(v) : fallback);
  const clean = (raw: (typeof all)[number]) => {
    const s = raw as unknown as Record<string, unknown>;
    return {
      ...s,
      state: undefined,
      game: str(s.game),
      roomName: str(s.roomName, "Room"),
      startedByName: str(s.startedByName),
      winner: s.winner == null ? undefined : str(s.winner),
      players: Array.isArray(s.players) ? s.players.filter((p): p is string => typeof p === "string") : [],
    };
  };
  const active = all.filter((s) => s.status === "running").map((s) => ({ ...clean(s), spectatorCount: liveSpectatorCount(s) }));
  const history = all.filter((s) => s.status !== "running").map((s) => clean(s));

  // Players currently in more than one running game.
  const counts = new Map<string, number>();
  for (const s of active) for (const p of s.players) counts.set(p, (counts.get(p) ?? 0) + 1);
  const multiGamePlayers = [...counts.entries()].filter(([, c]) => c > 1).map(([name, count]) => ({ name, count }));

  return ok({ active, history, multiGamePlayers });
}

// Force-end a running game.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const { id } = await readJson<{ id?: string }>(req);
  if (!id) return fail("Session id required");
  const s = await forceEndGameSession(id);
  if (!s) return fail("Session not found", 404);
  await addAdminLog(user.fullName, `Force-ended ${s.game} in room "${s.roomName}"`);
  return ok({ ok: true });
}
