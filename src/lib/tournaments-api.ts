"use client";

import { withBase } from "./base-path";

export type TGame = "Ludo" | "Chess";
export type TStatus = "upcoming" | "live" | "completed" | "cancelled";
export type ReqStatus = "pending" | "approved" | "rejected";
export type MyStatus = "none" | "pending" | "approved" | "rejected" | "joined";

export interface TRequest {
  userId: string;
  userName: string;
  status: ReqStatus;
  at: string;
}

export interface TPrize {
  place: 1 | 2 | 3 | 4;
  amount: number;
  detail?: string;
}

export interface TournamentView {
  id: string;
  title: string;
  game: TGame;
  prize: number;
  prizes: TPrize[];
  poster: string;
  description: string;
  entry: number;
  capacity: number;
  status: TStatus;
  createdAt: string;
  regStart: string;
  regEnd: string;
  startAt: string;
  regOpenRaw: boolean;
  regOpen: boolean;
  isFull: boolean;
  stats: { totalSlots: number; joined: number; pending: number; approved: number; rejected: number; remaining: number };
  myStatus: MyStatus;
  joinedNames: string[];
  joinedIds?: string[];
  requests: TRequest[];
  // Real bracket (admin-recorded results) + final standings.
  bracketRounds?: { name: string; matches: { aId: string | null; bId: string | null; aName: string | null; bName: string | null; winnerId: string | null; winnerName?: string | null; bye?: boolean; decidedBy?: string | null; decidedAt?: string | null }[] }[] | null;
  championId?: string | null;
  championName?: string | null;
  runnerUpId?: string | null;
  runnerUpName?: string | null;
  thirdNames?: string[];
  prizesPaid?: boolean;
  cancelledReason?: string;
  // ---- Match Room + Qualification system ----
  tournamentType?: "public" | "private";
  matchType?: "1v1" | "4player" | null;
  winnersPerRoom?: number;
  autoNextRound?: boolean;
  autoPrizeDist?: boolean;
  currentRound?: number;
  rooms?: TRoom[];
  roomStats?: { totalRooms: number; activeRooms: number; completedRooms: number; qualifiedPlayers: number; eliminatedPlayers: number; currentRound: number; onlineApproved?: number; offlineApproved?: number };
  // ---- Availability-aware batching (v357) ----
  readyCheck?: boolean;
  joinTimerMinutes?: number;
  autoReplace?: boolean;
  autoStartWhenReady?: boolean;
  allowSpectators?: boolean;
  autoCloseRoom?: boolean;
  waitingPool?: { id: string; name: string; online: boolean; publicId?: string; lastSeen?: string }[];
}

export type RoomStatus = "waiting" | "live" | "qualifying" | "completed" | "cancelled" | "paused";
export interface TRoomPlayer { id: string; name: string; avatar?: string; level?: number; qualified: boolean; eliminated: boolean; ready?: boolean; absent?: boolean; online?: boolean }
export interface TRoom {
  id: string; roundNumber: number; roomNumber: number; matchNumber: number;
  name: string; password: string; winnersRequired: number; status: RoomStatus;
  players: TRoomPlayer[]; qualifiedCount: number;
  joinDeadline?: string;
  voiceRoomId?: string | null; // auto-created match voice room to deep-link into
  liveCount?: number;          // live spectators in the match room
  startAt?: string;
}

export interface MyTournamentRequest {
  tournamentId: string;
  title: string;
  game: string;
  status: ReqStatus;
  at: string;
  joined: boolean;
  prize: number;
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(withBase(path), { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
async function send(path: string, method: string, body?: unknown): Promise<{ ok: boolean; error?: string; data?: Record<string, unknown> }> {
  try {
    const res = await fetch(withBase(path), {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, error: (data as { error?: string }).error, data };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function fetchTournaments(): Promise<TournamentView[]> {
  const data = await getJson<{ tournaments: TournamentView[] }>("/api/tournaments");
  return data?.tournaments ?? [];
}
export async function fetchTournament(id: string): Promise<TournamentView | null> {
  const all = await fetchTournaments();
  return all.find((t) => t.id === id) ?? null;
}
export async function createTournament(input: {
  title: string; game: TGame; prize: number; entry: number; capacity: number; regOpen: boolean; regStart?: string; regEnd?: string; startAt?: string;
  prizes?: TPrize[]; poster?: string; description?: string;
  tournamentType?: "public" | "private"; matchType?: "1v1" | "4player"; winnersPerRoom?: number; autoNextRound?: boolean; autoPrizeDist?: boolean;
}): Promise<boolean> {
  return (await send("/api/tournaments", "POST", input)).ok;
}
export async function updateTournament(id: string, patch: Record<string, unknown>): Promise<boolean> {
  return (await send(`/api/tournaments/${id}`, "PATCH", patch)).ok;
}
export async function deleteTournament(id: string): Promise<boolean> {
  return (await send(`/api/tournaments/${id}`, "DELETE")).ok;
}
export async function requestJoin(id: string): Promise<{ ok: boolean; error?: string }> {
  return send(`/api/tournaments/${id}/request`, "POST");
}
export async function decideRequest(id: string, userId: string, decision: "approved" | "rejected" | "removed"): Promise<boolean> {
  return (await send(`/api/tournaments/${id}/decide`, "POST", { userId, decision })).ok;
}
export async function openRegistration(id: string): Promise<boolean> {
  return (await send(`/api/tournaments/${id}/decide`, "POST", { action: "openRegistration" })).ok;
}
// ---- Bracket / play system (admin) ----
export async function generateBracket(id: string): Promise<{ ok: boolean; error?: string }> {
  const r = await send(`/api/tournaments/${id}/bracket`, "POST", { action: "generate" });
  return { ok: r.ok, error: (r.data as { error?: string })?.error };
}
export async function setMatchWinner(id: string, roundIdx: number, matchIdx: number, winnerId: string, winnerName?: string): Promise<{ ok: boolean; error?: string }> {
  const r = await send(`/api/tournaments/${id}/bracket`, "POST", { action: "setWinner", roundIdx, matchIdx, winnerId, winnerName });
  return { ok: r.ok, error: (r.data as { error?: string })?.error };
}
/** Undo a recorded match result (clears every later round that depended on it). */
export async function clearMatchWinner(id: string, roundIdx: number, matchIdx: number): Promise<{ ok: boolean; error?: string }> {
  const r = await send(`/api/tournaments/${id}/bracket`, "POST", { action: "clearWinner", roundIdx, matchIdx });
  return { ok: r.ok, error: (r.data as { error?: string })?.error };
}
export async function distributePrizes(id: string): Promise<{ ok: boolean; error?: string; paid?: { place: number; name: string; coins: number }[] }> {
  const r = await send(`/api/tournaments/${id}/bracket`, "POST", { action: "distributePrizes" });
  return { ok: r.ok, error: (r.data as { error?: string })?.error, paid: (r.data as { paid?: { place: number; name: string; coins: number }[] })?.paid };
}
export async function cancelTournament(id: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  const r = await send(`/api/tournaments/${id}/bracket`, "POST", { action: "cancel", reason });
  return { ok: r.ok, error: (r.data as { error?: string })?.error };
}
// ---- Match Room + Qualification actions (admin) ----
export async function generateRooms(id: string, mode: "online" | "all" | "manual" = "all", selectedIds?: string[], roomCount?: number): Promise<{ ok: boolean; error?: string; roomCount?: number; seated?: number; waiting?: number }> {
  const r = await send(`/api/tournaments/${id}/bracket`, "POST", { action: "generateRooms", mode, selectedIds, roomCount });
  const d = r.data as { roomCount?: number; seated?: number; waiting?: number };
  return { ok: r.ok, error: r.error, roomCount: d?.roomCount, seated: d?.seated, waiting: d?.waiting };
}
export async function addRoomPlayer(id: string, roomId: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  const r = await send(`/api/tournaments/${id}/bracket`, "POST", { action: "addPlayer", roomId, userId });
  return { ok: r.ok, error: r.error };
}
export async function replaceRoomPlayer(id: string, roomId: string, outUserId: string, inUserId: string): Promise<{ ok: boolean; error?: string }> {
  const r = await send(`/api/tournaments/${id}/bracket`, "POST", { action: "replacePlayer", roomId, outUserId, inUserId });
  return { ok: r.ok, error: r.error };
}
export async function saveBatchSettings(id: string, patch: { readyCheck?: boolean; joinTimerMinutes?: number; autoReplace?: boolean; autoStartWhenReady?: boolean; autoNextRound?: boolean; allowSpectators?: boolean; autoCloseRoom?: boolean }): Promise<{ ok: boolean; error?: string }> {
  const r = await send(`/api/tournaments/${id}/bracket`, "POST", { action: "settings", ...patch });
  return { ok: r.ok, error: r.error };
}
export async function closeRoom(id: string, roomId: string): Promise<{ ok: boolean; error?: string }> {
  const r = await send(`/api/tournaments/${id}/bracket`, "POST", { action: "closeRoom", roomId });
  return { ok: r.ok, error: r.error };
}
// ---- Player action: press READY for my match room ----
export async function pressReady(id: string, roomId: string): Promise<{ ok: boolean; error?: string; allReady?: boolean }> {
  const r = await send(`/api/tournaments/${id}/ready`, "POST", { roomId });
  return { ok: r.ok, error: r.error, allReady: (r.data as { allReady?: boolean })?.allReady };
}
export async function qualifyPlayer(id: string, roomId: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  const r = await send(`/api/tournaments/${id}/bracket`, "POST", { action: "qualify", roomId, userId });
  return { ok: r.ok, error: r.error };
}
export async function unqualifyPlayer(id: string, roomId: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  const r = await send(`/api/tournaments/${id}/bracket`, "POST", { action: "unqualify", roomId, userId });
  return { ok: r.ok, error: r.error };
}
export async function setRoomStatus(id: string, roomId: string, status: string): Promise<{ ok: boolean; error?: string }> {
  const r = await send(`/api/tournaments/${id}/bracket`, "POST", { action: "roomStatus", roomId, status });
  return { ok: r.ok, error: r.error };
}
export async function generateNextRound(id: string): Promise<{ ok: boolean; error?: string }> {
  const r = await send(`/api/tournaments/${id}/bracket`, "POST", { action: "nextRound" });
  return { ok: r.ok, error: r.error };
}
/** RECOVERY: create match rooms for every approved player who still has none
 *  (unblocks "N players waiting for a match to be created"). */
export async function seatWaiting(id: string, onlineOnly = false, reason?: string): Promise<{ ok: boolean; error?: string; seated?: number; rooms?: number }> {
  const r = await send(`/api/tournaments/${id}/bracket`, "POST", { action: "seatWaiting", mode: onlineOnly ? "online" : "all", reason });
  return { ok: r.ok, error: r.error, seated: (r as { seated?: number }).seated, rooms: (r as { rooms?: number }).rooms };
}
/** UNIVERSAL RECOVERY: un-stick a live tournament (force-start stuck room matches +
 *  seat waiting players; or report bracket matches still needing a winner). */
export async function recoverTournament(id: string): Promise<{ ok: boolean; error?: string; kind?: "room" | "bracket"; forced?: number; seated?: number; needWinner?: number }> {
  const r = await send(`/api/tournaments/${id}/bracket`, "POST", { action: "recover" });
  return { ok: r.ok, error: r.error, kind: (r as { kind?: "room" | "bracket" }).kind, forced: (r as { forced?: number }).forced, seated: (r as { seated?: number }).seated, needWinner: (r as { needWinner?: number }).needWinner };
}
export async function fetchMyRequests(): Promise<MyTournamentRequest[]> {
  const data = await getJson<{ requests: MyTournamentRequest[] }>("/api/tournaments/my-requests");
  return data?.requests ?? [];
}

// ---------- Single-elimination bracket from the joined participants ----------
export interface TMatch { a: string | null; b: string | null; winner?: "a" | "b" }
export interface TRound { name: string; matches: TMatch[] }

const hash = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};
function roundName(slots: number): string {
  if (slots === 2) return "Final";
  if (slots === 4) return "Semifinals";
  if (slots === 8) return "Quarterfinals";
  return `Round of ${slots}`;
}

export function buildBracket(names: string[], status: TStatus): TRound[] {
  const decidedRounds = status === "completed" ? Infinity : status === "live" ? 1 : 0;
  let size = 1;
  while (size < Math.max(2, names.length)) size *= 2;
  let current: (string | null)[] = [...names];
  while (current.length < size) current.push(null);

  const rounds: TRound[] = [];
  let r = 0;
  while (current.length > 1) {
    const decided = r < decidedRounds;
    const matches: TMatch[] = [];
    const next: (string | null)[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const a = current[i];
      const b = current[i + 1];
      const m: TMatch = { a, b };
      if (decided && (a || b)) {
        if (a && b) {
          const win: "a" | "b" = hash(a) >= hash(b) ? "a" : "b";
          m.winner = win;
          next.push(win === "a" ? a : b);
        } else {
          m.winner = a ? "a" : "b";
          next.push(a ?? b);
        }
      } else {
        next.push(null);
      }
      matches.push(m);
    }
    rounds.push({ name: roundName(current.length), matches });
    current = next;
    r += 1;
  }
  return rounds;
}

export function champion(t: TournamentView): string | null {
  if (t.status !== "completed" || t.joinedNames.length === 0) return null;
  const rounds = buildBracket(t.joinedNames, t.status);
  const final = rounds[rounds.length - 1]?.matches[0];
  if (!final?.winner) return null;
  return final.winner === "a" ? final.a : final.b;
}
