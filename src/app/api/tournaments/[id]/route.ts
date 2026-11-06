import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { updateTournamentRecord, deleteTournamentRecord, getTournamentRecord, addAdminLog, parseTournamentPrizes } from "@/server/repo";
import type { TournamentRecord } from "@/server/db";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const body = await readJson(req);
  const patch: Partial<TournamentRecord> = {};
  if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim().slice(0, 80);
  if (body.game === "Ludo" || body.game === "Chess") patch.game = body.game;
  if (body.prize !== undefined) patch.prize = Math.max(0, Number(body.prize) || 0);
  if (Array.isArray(body.prizes)) patch.prizes = parseTournamentPrizes(body.prizes);
  if (typeof body.poster === "string") patch.poster = body.poster.slice(0, 3_000_000) || undefined;
  if (typeof body.description === "string") patch.description = body.description.slice(0, 1000) || undefined;
  if (body.entry !== undefined) patch.entry = Math.max(0, Number(body.entry) || 0);
  if (body.capacity !== undefined) patch.capacity = Math.max(2, Number(body.capacity) || 8);
  if (body.status === "upcoming" || body.status === "live" || body.status === "completed" || body.status === "cancelled") patch.status = body.status;
  if (typeof body.regOpen === "boolean") patch.regOpen = body.regOpen;
  if (typeof body.regStart === "string") patch.regStart = body.regStart || undefined;
  if (typeof body.regEnd === "string") patch.regEnd = body.regEnd || undefined;
  if (typeof body.startAt === "string") patch.startAt = body.startAt || undefined;
  // Match Configuration — editable before the tournament goes Live / rooms play.
  if (body.tournamentType === "public" || body.tournamentType === "private") patch.tournamentType = body.tournamentType;
  if (body.matchType === "1v1" || body.matchType === "4player") patch.matchType = body.matchType;
  if ([1, 2, 3].includes(Number(body.winnersPerRoom))) patch.winnersPerRoom = Number(body.winnersPerRoom) as 1 | 2 | 3;
  if (typeof body.autoNextRound === "boolean") patch.autoNextRound = body.autoNextRound;
  if (typeof body.autoPrizeDist === "boolean") patch.autoPrizeDist = body.autoPrizeDist;

  const updated = await updateTournamentRecord(id, patch);
  if (!updated) return fail("Tournament not found", 404);
  await addAdminLog(user.fullName, `Updated tournament "${updated.title}"`);
  return ok({ tournament: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const t = await getTournamentRecord(id);
  const res = await deleteTournamentRecord(id, { adminName: user.fullName, adminId: user.publicId ?? user.id });
  if (t) await addAdminLog(user.fullName, `Deleted tournament "${t.title}" — ${res.roomsRemoved} auto-created room(s) removed; archived to Deleted Tournaments`);
  return ok({ deleted: true, roomsRemoved: res.roomsRemoved });
}
