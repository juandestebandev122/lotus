import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getDB } from "@/server/db";
import { listTournaments, createTournamentRecord, toTournamentView, addAdminLog, parseTournamentPrizes } from "@/server/repo";
import { onlineStatus } from "@/server/presence";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  const db = await getDB();
  const byId = new Map(db.users.map((u) => [u.id, u]));
  const nameOf = (id: string) => byId.get(id)?.fullName ?? "Player";
  // Availability resolver — powers online badges, the waiting pool and the
  // online/offline counters. (Room passwords stay private to their players.)
  const info = (id: string) => {
    const u = byId.get(id);
    return { online: onlineStatus(u?.lastSeen) === "online", publicId: u?.publicId, lastSeen: u?.lastSeen, avatar: u?.avatar, level: u?.level };
  };
  // Live head-count of a match's voice room (for the control-center spectator metric).
  const liveCountOf = (voiceRoomId: string) => db.users.filter((u) => u.activeRoomId === voiceRoomId).length;
  const tournaments = (await listTournaments()).map((t) => toTournamentView(t, nameOf, user?.id, { isAdmin: user?.role === "admin", info, liveCountOf }));
  return ok({ tournaments });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const body = await readJson(req);
  if (!body.title || typeof body.title !== "string") return fail("Title is required");
  const game = body.game === "Chess" ? "Chess" : "Ludo";
  const t = await createTournamentRecord({
    title: body.title,
    game,
    prize: Math.max(0, Number(body.prize) || 0),
    prizes: parseTournamentPrizes(body.prizes),
    poster: typeof body.poster === "string" ? body.poster.slice(0, 3_000_000) : undefined,
    description: typeof body.description === "string" ? body.description.slice(0, 1000) : undefined,
    entry: Math.max(0, Number(body.entry) || 0),
    capacity: Math.max(2, Number(body.capacity) || 8),
    regOpen: body.regOpen !== false,
    regStart: typeof body.regStart === "string" ? body.regStart : undefined,
    regEnd: typeof body.regEnd === "string" ? body.regEnd : undefined,
    startAt: typeof body.startAt === "string" ? body.startAt : undefined,
    tournamentType: body.tournamentType === "private" ? "private" : "public",
    matchType: body.matchType === "4player" ? "4player" : body.matchType === "1v1" ? "1v1" : undefined,
    winnersPerRoom: [1, 2, 3].includes(Number(body.winnersPerRoom)) ? Number(body.winnersPerRoom) as 1 | 2 | 3 : undefined,
    autoNextRound: body.autoNextRound !== false,
    autoPrizeDist: body.autoPrizeDist === true,
  });
  await addAdminLog(user.fullName, `Created tournament "${t.title}"`);
  return ok({ tournament: t }, 201);
}
