"use client";

import { withBase } from "./base-path";

export interface CompetitionParticipantView {
  userId: string; name: string; username: string; avatar: string;
  status: "pending" | "approved" | "rejected" | "disqualified"; order?: number;
  isCurrent: boolean; myMark?: number;
  total?: number; average?: number; voteCount?: number; rank?: number; adjustment?: number;
}
export interface CompetitionRoundResult { userId: string; name: string; total: number; average: number; voteCount: number; rank: number; qualified?: boolean }
export interface CompetitionRound {
  id: string; name: string; order: number; status: "pending" | "active" | "completed";
  enabled?: boolean; qualifyCount?: number;
  results?: CompetitionRoundResult[]; startedAt?: string; completedAt?: string;
}
export interface CompetitionPrize { position: number; coins: number; enabled: boolean; label?: string }
export interface CompModEvent {
  id: string; at: string; actorId: string; actorName: string; targetId: string; targetName: string;
  action: "warn" | "penalty" | "disqualify" | "restore" | "remove" | "ban" | "score"; reason?: string; note?: string; coins?: number;
  prevScore?: number; newScore?: number;
}
export interface CompetitionView {
  id: string; roomId: string; roomName: string; title: string; prize?: string;
  hostId: string; hostName: string;
  status: "setup" | "live" | "paused" | "ended" | "results";
  registrationOpen: boolean; votingEnabled: boolean; giftsEnabled: boolean;
  performanceSeconds: number; currentIndex: number; turnStartedAt?: string;
  turnPausedElapsedSec?: number; // seconds already consumed before the running segment (Pause preserves time)
  votingStats?: { inRoom: number; eligible: number; voted: number; notVoted: number; percent: number; totalVotes: number; distinctVoters: number };
  participants: CompetitionParticipantView[];
  pending: CompetitionParticipantView[];
  disqualified: CompetitionParticipantView[];
  currentPerformer?: { userId: string; name: string; avatar: string };
  canSeeScores: boolean;
  role: "admin" | "host" | "cohost" | "participant" | "listener";
  iAmController: boolean; iAmRegistered: boolean; myRegStatus?: string; iAmApproved: boolean;
  winners: { userId: string; name: string; avatar: string; total: number; average: number; rank: number }[];
  reports: { participants: number; audience: number; votes: number; gifts: number; giftCoins: number };
  staff: { userId: string; name: string; avatar: string; role: string; permissions: string[] }[];
  myPerms: string[]; myStaffRole?: string;
  registrationFeeCoins: number; winnerPrizeCoins: number; speakingSeats?: number;
  totalSeats?: number; registrationOpensAt?: string; registrationClosesAt?: string; matchAt?: string;
  rounds: CompetitionRound[]; currentRoundId?: string; prizes: CompetitionPrize[]; modLog: CompModEvent[];
  createdAt: string; startedAt?: string; endedAt?: string; resultsAt?: string;
}
export interface CompetitionCard { roomId: string; title: string; prize?: string; status: CompetitionView["status"]; registrationOpen: boolean; hostName: string; participantCount: number; audience: number; image?: string }

async function post(roomId: string, body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; balance?: number }> {
  try {
    const r = await fetch(withBase(`/api/competitions/${encodeURIComponent(roomId)}`), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, error: d.error, balance: d.balance };
  } catch { return { ok: false, error: "Network error" }; }
}

export async function fetchCompetitions(): Promise<CompetitionCard[]> {
  try { const r = await fetch(withBase("/api/competitions"), { credentials: "include", cache: "no-store" }); return (await r.json()).competitions ?? []; } catch { return []; }
}
export async function createCompetition(title: string, prize?: string, opts?: { registrationFeeCoins?: number; winnerPrizeCoins?: number; speakingSeats?: number }): Promise<{ ok: boolean; error?: string; roomId?: string }> {
  try {
    const r = await fetch(withBase("/api/competitions"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, prize, ...(opts ?? {}) }) });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, error: d.error, roomId: d.roomId };
  } catch { return { ok: false, error: "Network error" }; }
}
export async function fetchCompetition(roomId: string): Promise<CompetitionView | null> {
  try { const r = await fetch(withBase(`/api/competitions/${encodeURIComponent(roomId)}`), { credentials: "include", cache: "no-store" }); if (!r.ok) return null; return (await r.json()).competition ?? null; } catch { return null; }
}
export const registerForCompetition = (roomId: string) => post(roomId, { action: "register" });
export const markSinger = (roomId: string, participantId: string, mark: number) => post(roomId, { action: "vote", participantId, mark });
export const giftSinger = (roomId: string, toUserId: string, coins: number) => post(roomId, { action: "gift", toUserId, coins });
export const competitionAction = (roomId: string, action: string, targetId?: string, value?: number) => post(roomId, { action, targetId, value });
export async function searchUsersForStaff(q: string): Promise<{ id: string; fullName: string; username: string; avatar?: string }[]> {
  try { const r = await fetch(withBase(`/api/users?q=${encodeURIComponent(q)}`), { credentials: "include", cache: "no-store" }); return ((await r.json()).users ?? []).slice(0, 15); } catch { return []; }
}
export const assignCompetitionStaff = (roomId: string, targetId: string, role: string, permissions?: string[]) => post(roomId, { action: "assignStaff", targetId, role, permissions });
export const removeCompetitionStaff = (roomId: string, targetId: string) => post(roomId, { action: "removeStaff", targetId });
export const editCompetition = (roomId: string, patch: Record<string, unknown>) => post(roomId, { action: "edit", patch });
// Multi-round management: create | rename | delete | start | complete | setQualify | setEnabled.
export const manageCompetitionRound = (roomId: string, roundAction: string, opts?: { roundId?: string; name?: string; qualifyCount?: number; enabled?: boolean }) => post(roomId, { action: "manageRound", roundAction, ...(opts ?? {}) });
// Moderation: warn | penalty | disqualify | restore (with reason / note / coins).
export const moderateCompetition = (roomId: string, modAction: string, targetId: string, opts?: { reason?: string; note?: string; coins?: number }) => post(roomId, { action: "moderate", modAction, targetId, ...(opts ?? {}) });
// Admin score editing: add/deduct (delta) or set exact (setTo), with a reason (audited).
export const adjustCompetitionScore = (roomId: string, targetId: string, opts: { delta?: number; setTo?: number; reason?: string }) => post(roomId, { action: "moderate", modAction: "score", targetId, ...opts });
