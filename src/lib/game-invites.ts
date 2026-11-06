"use client";

import { withBase } from "./base-path";

export type GInviteStatus = "pending" | "accepted" | "rejected" | "expired" | "cancelled";

export interface GameInviteView {
  id: string;
  roomId: string;
  game: string;
  gameName: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  kind: "invite" | "request";
  status: GInviteStatus;
  at: string;
  respondedAt?: string;
  color?: string; // the colour the invitee chose when accepting (Ludo)
}

export async function sendGameInvites(input: {
  roomId: string; game: string; gameName: string; toIds: string[]; kind?: "invite" | "request";
}): Promise<{ ok: boolean; invites: GameInviteView[]; error?: string }> {
  try {
    const res = await fetch(withBase("/api/games/invite"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ kind: "invite", ...input }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, invites: (data.invites as GameInviteView[]) ?? [], error: data.error };
  } catch {
    return { ok: false, invites: [], error: "Network error" };
  }
}

export async function respondGameInvite(id: string, accept: boolean, color?: string): Promise<{ ok: boolean; error?: string; invite?: GameInviteView }> {
  try {
    const res = await fetch(withBase("/api/games/invite/respond"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, accept, color }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, error: data.error, invite: data.invite as GameInviteView };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function fetchRoomInviteStatus(roomId: string, game: string): Promise<GameInviteView[]> {
  try {
    const res = await fetch(withBase(`/api/games/invite?roomId=${encodeURIComponent(roomId)}&game=${encodeURIComponent(game)}`), { credentials: "include", cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    return (data.invites as GameInviteView[]) ?? [];
  } catch {
    return [];
  }
}

export async function fetchMyGameInvites(): Promise<GameInviteView[]> {
  try {
    const res = await fetch(withBase("/api/games/invite/mine"), { credentials: "include", cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    return (data.invites as GameInviteView[]) ?? [];
  } catch {
    return [];
  }
}
