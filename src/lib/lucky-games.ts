// Client helpers for the multi-round Lucky Number game.
import { withBase } from "@/lib/base-path";

export interface LuckyRoomRow {
  id: string; name: string; hostName: string; coHostName: string;
  players: number; maxPlayers: number;
  totalRounds: number; currentRound: number;
  gameStatus: string; joiningOpen: boolean;
  groupRoomId?: string; groupRoomName?: string;
  canJoin: boolean; isMember: boolean; joined: boolean;
  myRole?: "Host" | "Co-Host" | null;
}

export interface LuckyRoundView {
  index: number;
  status: "pending" | "selection" | "closed" | "drawn" | "completed" | "skipped";
  selectionCloseAt?: string;
  takenNumbers: number[];
  myNumber: number | null;
  winningNumber: number | null;
  winners: string[];
  iWon: boolean;
}

export interface LuckyGameView {
  id: string; name: string; gameStatus: string;
  totalRounds: number; currentRound: number;
  minNumber: number; maxNumber: number;
  selectionMethod: "pick" | "type" | "both";
  hostName: string; coHostName: string;
  groupRoomId?: string; groupRoomName?: string;
  isGroupMember: boolean;
  myStatus: string | null;
  players: number; maxPlayers: number;
  round: LuckyRoundView | null;
  history: { index: number; winningNumber: number | null; winners: string[]; method: string | null }[];
  finalRanks: { userId: string; userName: string; wins: number; points: number; rank: number }[] | null;
  /** The VIEWER's standing in this game — null for an ordinary player. */
  myRole?: "Admin" | "Host" | "Co-Host" | null;
  /** Which run-the-game controls this viewer may use (the admin decides). */
  can?: { start: boolean; round: boolean; draw: boolean; manualPick: boolean; complete: boolean; joining: boolean };
  entryFee?: number;
  prize?: number;
  prizeDetail?: string;
  joiningOpen?: boolean;
}

/** Host / Co-Host / Admin controls for running a game from the game screen —
 *  no admin panel needed. The server re-checks the role and the permission on
 *  every one of these. */
export const luckyHost = {
  start: (gameId: string) => post({ action: "start", gameId }),
  startRound: (gameId: string) => post({ action: "startRound", gameId }),
  setSelection: (gameId: string, open: boolean) => post({ action: "selection", gameId, open }),
  setJoining: (gameId: string, open: boolean) => post({ action: "joining", gameId, open }),
  /** Spin / shuffle. Omit `number` for the random draw. */
  draw: (gameId: string, manualNumber?: number) =>
    post(manualNumber === undefined
      ? { action: "draw", gameId, method: "auto" }
      : { action: "draw", gameId, method: "manual", number: manualNumber }),
  complete: (gameId: string) => post({ action: "complete", gameId }),
};

async function post(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; number?: number }> {
  try {
    const res = await fetch(withBase("/api/lucky-games"), {
      method: "POST", headers: { "Content-Type": "application/json" },
      credentials: "include", body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (d as { error?: string }).error ?? "That didn't work" };
    return { ok: true, number: (d as { number?: number }).number };
  } catch {
    return { ok: false, error: "Network problem — please try again" };
  }
}

export async function fetchLuckyRooms(): Promise<LuckyRoomRow[]> {
  try {
    const res = await fetch(withBase("/api/lucky-games"), { credentials: "include", cache: "no-store" });
    const d = await res.json();
    return (d?.games ?? []) as LuckyRoomRow[];
  } catch { return []; }
}

export async function fetchLuckyGame(id: string): Promise<LuckyGameView | null> {
  try {
    const res = await fetch(withBase(`/api/lucky-games/${id}`), { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    const d = await res.json();
    return (d?.game ?? null) as LuckyGameView | null;
  } catch { return null; }
}

export const joinLuckyGame = (gameId: string) => post({ action: "join", gameId });
export const pickLuckyNumber = (gameId: string, number: number) => post({ action: "select", gameId, number });
