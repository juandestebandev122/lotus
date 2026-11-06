import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listGameResults, listGameSessions } from "@/server/repo";

export const runtime = "nodejs";

/** One dice row surfaced to the admin Dice Log. */
interface DiceRow {
  matchId: string;   // the game / session id (Match ID)
  game: string;      // ludo / snake / …
  roomName: string;
  turn: number;      // move sequence number within the match (Turn Number)
  player: string;    // roller display name
  playerId: string;  // resolved user id when known (Player ID)
  value: number;     // Dice Value 1–6
  passed: boolean;   // true = the roll produced no legal move / three-6s (turn passed)
  at: string;        // ISO timestamp of the roll (Timestamp)
  live: boolean;     // from a still-running match?
}

/**
 * READ-ONLY dice audit log. Flattens every recorded dice roll (Match ID, Player,
 * Turn Number, Dice Value, Timestamp) from finished matches AND live sessions, so
 * an admin can verify fairness at a glance. Also returns a per-value distribution
 * summary. No mutation — purely surfaces the move history the engine already keeps.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(5000, Number(url.searchParams.get("limit")) || 800));
  const gameFilter = (url.searchParams.get("game") || "").trim().toLowerCase();
  const matchFilter = (url.searchParams.get("match") || "").trim().toLowerCase();

  const [results, sessions] = await Promise.all([listGameResults(400), listGameSessions()]);

  const rows: DiceRow[] = [];
  const pushFrom = (
    src: { id: string; game: string; roomName?: string; playerNames?: string[]; playerIds?: string[]; moves?: { n: number; at: string; type: string; by?: string; value?: number }[] },
    live: boolean,
  ) => {
    if (!src.moves?.length) return;
    const names = src.playerNames ?? [];
    const ids = src.playerIds ?? [];
    const idOf = (name?: string) => {
      if (!name) return "";
      const i = names.findIndex((n) => n === name);
      return i >= 0 ? (ids[i] ?? "") : "";
    };
    for (const m of src.moves) {
      if ((m.type !== "roll" && m.type !== "pass") || typeof m.value !== "number") continue;
      rows.push({
        matchId: src.id,
        game: src.game,
        roomName: src.roomName ?? "",
        turn: m.n,
        player: m.by ?? "",
        playerId: idOf(m.by),
        value: m.value,
        passed: m.type === "pass",
        at: m.at,
        live,
      });
    }
  };

  for (const s of sessions) pushFrom(s as never, true);
  for (const r of results) pushFrom(r as never, false);

  let filtered = rows;
  if (gameFilter) filtered = filtered.filter((r) => r.game.toLowerCase() === gameFilter);
  if (matchFilter) filtered = filtered.filter((r) => r.matchId.toLowerCase().includes(matchFilter) || r.roomName.toLowerCase().includes(matchFilter) || r.player.toLowerCase().includes(matchFilter));

  // Newest first, then cap.
  filtered.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const capped = filtered.slice(0, limit);

  // Distribution summary over the CAPPED rows (what the admin is looking at).
  const dist = [0, 0, 0, 0, 0, 0, 0]; // index 1..6
  for (const r of capped) if (r.value >= 1 && r.value <= 6) dist[r.value]++;
  const total = capped.length;
  const summary = [1, 2, 3, 4, 5, 6].map((v) => ({
    value: v,
    count: dist[v],
    pct: total ? +((dist[v] / total) * 100).toFixed(2) : 0,
  }));

  return ok({ rows: capped, total, shown: capped.length, summary });
}
