import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getCompetition, voteCompetition, sendCompetitionGift, registerForCompetition, competitionAction, assignCompetitionStaff, removeCompetitionStaff, editCompetition, manageCompetitionRound, competitionModerate, getConfig } from "@/server/repo";

export const runtime = "nodejs";

// Competition state for a room (`id` = roomId). null when the room has none.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  return ok({ competition: await getCompetition(id, user?.id ?? "") });
}

// All competition actions. Body carries the fields each action needs.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const b = await readJson<{ action?: string; participantId?: string; mark?: number; toUserId?: string; coins?: number; targetId?: string; value?: number; role?: string; permissions?: string[]; patch?: Record<string, unknown>; roundAction?: string; roundId?: string; name?: string; qualifyCount?: number; enabled?: boolean; modAction?: string; reason?: string; note?: string; delta?: number; setTo?: number }>(req);

  // Admin master + per-feature toggles (Tournament & Competition Management).
  const cfg = await getConfig();
  if (cfg.features?.competitions === false && user.role !== "admin") return fail("Competitions are currently turned off.", 403);
  const tcc = cfg.tournamentControls ?? {};

  if (b.action === "vote") {
    if (tcc.competitionVoting === false) return fail("Voting is currently turned off for competitions.", 403);
    if (!b.participantId) return fail("Pick a singer to mark");
    const res = await voteCompetition(user.id, id, b.participantId, Number(b.mark));
    return res.ok ? ok({ ok: true }) : fail(res.error ?? "Could not mark", 400);
  }
  if (b.action === "gift") {
    if (tcc.competitionGifts === false) return fail("Gifts are currently turned off for competitions.", 403);
    if (!b.toUserId || !b.coins) return fail("Pick a singer and gift amount");
    const res = await sendCompetitionGift(user.id, id, b.toUserId, Number(b.coins));
    return res.ok ? ok({ ok: true, balance: res.balance }) : fail(res.error ?? "Could not send gift", 400);
  }
  if (b.action === "register") {
    if (tcc.competitionRegistration === false) return fail("Competition registration is currently closed.", 403);
    if (cfg.membership?.subscriberFeatures?.competitions && !user.vip && user.role !== "admin") {
      return fail("Competition registration is available to paid subscribers only.", 403);
    }
    const res = await registerForCompetition(user.id, id);
    return res.ok ? ok({ ok: true }) : fail(res.error ?? "Could not register", 400);
  }
  if (b.action === "assignStaff") {
    if (!b.targetId || !b.role) return fail("Pick a user and role");
    const res = await assignCompetitionStaff(user.id, id, b.targetId, b.role, b.permissions);
    return res.ok ? ok({ ok: true }) : fail(res.error ?? "Could not assign", 400);
  }
  if (b.action === "removeStaff") {
    if (!b.targetId) return fail("Pick a staff member");
    const res = await removeCompetitionStaff(user.id, id, b.targetId);
    return res.ok ? ok({ ok: true }) : fail(res.error ?? "Could not remove", 400);
  }
  if (b.action === "edit") {
    const res = await editCompetition(user.id, id, (b.patch ?? {}) as { title?: string; prize?: string; registrationFeeCoins?: number; winnerPrizeCoins?: number; speakingSeats?: number; totalSeats?: number; registrationOpensAt?: string; registrationClosesAt?: string; matchAt?: string });
    return res.ok ? ok({ ok: true }) : fail(res.error ?? "Could not edit", 400);
  }
  if (b.action === "manageRound") {
    if (!b.roundAction) return fail("Missing round action");
    const res = await manageCompetitionRound(user.id, id, b.roundAction, { roundId: b.roundId, name: b.name, qualifyCount: b.qualifyCount, enabled: b.enabled });
    return res.ok ? ok({ ok: true }) : fail(res.error ?? "Could not update round", 400);
  }
  if (b.action === "moderate") {
    if (!b.modAction || !b.targetId) return fail("Missing moderation action / target");
    const res = await competitionModerate(user.id, id, b.modAction, b.targetId, { reason: b.reason, note: b.note, coins: Number(b.coins) || 0, delta: typeof b.delta === "number" ? b.delta : undefined, setTo: typeof b.setTo === "number" ? b.setTo : undefined });
    return res.ok ? ok({ ok: true }) : fail(res.error ?? "Could not apply", 400);
  }
  const res = await competitionAction(user.id, id, b.action ?? "", b.targetId, b.value);
  if (res.ok && b.action === "start") {
    try { const { notifyAdmins } = await import("@/server/repo"); await notifyAdmins(`A competition just started (room ${id}).`, { label: "Room Activities", href: "/admin/room-activities" }); } catch { /* non-fatal */ }
  }
  return res.ok ? ok({ ok: true }) : fail(res.error ?? "Action failed", 400);
}
