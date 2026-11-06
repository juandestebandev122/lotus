"use client";
import { withBase } from "./base-path";

export interface LobbySeatView { color: string; id?: string; name?: string; joinedAt?: string }
export interface LobbyLogRow { at: string; event: string; actor?: string; detail?: string }
export interface LobbyView {
  id: string;
  roomId: string;
  game: string;
  gameName: string;
  hostId: string;
  hostName: string;
  startedByRole: string;
  mode: "manual" | "auto" | null;
  status: "choosing" | "open" | "starting" | "started" | "cancelled";
  seats: LobbySeatView[];
  locked: boolean;
  publicJoin: boolean;
  banned: string[];
  paused: boolean;
  countdownSeconds: number;
  createdAt: string;
  startedAt?: string;
  remaining: number | null;
  startingIn: number | null;
  canControl: boolean;
  role: "host" | "coHost" | "admin" | null;
  mySeat: string | null;
  filledCount: number;
  emptyCount: number;
  builderId: string | null;
  amBanned: boolean;
  present: boolean;
  minPlayers: number;
  maxPlayers: number;
  startingSeconds: number;
  log: LobbyLogRow[];
}

export async function fetchLobby(roomId: string, game: string): Promise<LobbyView | null> {
  try {
    const res = await fetch(withBase(`/api/games/lobby?room=${encodeURIComponent(roomId)}&game=${encodeURIComponent(game)}`), { credentials: "include" });
    const d = await res.json().catch(() => ({}));
    return (d.lobby as LobbyView) ?? null;
  } catch { return null; }
}

export async function lobbyDo(roomId: string, game: string, action: string, extra: { mode?: string; color?: string; targetId?: string } = {}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/games/lobby"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ room: roomId, game, action, ...extra }),
    });
    const d = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, error: (d.error as string) ?? "Action failed" };
  } catch { return { ok: false, error: "Network error" }; }
}
