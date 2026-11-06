import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getConfig, enterLuckyDraw } from "@/server/repo";
import { getDB } from "@/server/db";

export const runtime = "nodejs";

// Submit or edit a user's number pick(s). Charges the entry fee once (held on the entry).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const cfg = await getConfig();
  if (cfg.features?.luckyNumber === false) return fail("The Lucky Number game is currently turned off.", 403);
  // A multi-round game must only ever be played through the engine
  // (/api/lucky-games), which reserves numbers atomically and LOCKS them. This
  // legacy route lets a player change their pick, so it is refused outright —
  // otherwise a cached page could quietly bypass the rules.
  const db = await getDB();
  if ((db.luckyDraws ?? []).find((g) => g.id === id)?.totalRounds) {
    return fail("This is a multi-round game — open it from the Lucky Number game list to play.", 400);
  }
  const body = await readJson(req);
  const raw = Array.isArray(body.numbers) ? body.numbers : body.number != null ? [body.number] : [];
  const nums = raw.map((x: unknown) => Number(x));
  const r = await enterLuckyDraw(id, user.id, nums);
  if (!r.ok) return fail(r.error ?? "Could not submit your number", 400);
  return ok({ ok: true, numbers: r.numbers });
}
