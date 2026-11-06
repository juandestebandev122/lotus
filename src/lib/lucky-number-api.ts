"use client";

import { withBase } from "./base-path";

export type LuckyStatus = "scheduled" | "open" | "closed" | "drawn" | "cancelled";

export interface LuckyWinner { userId: string; name: string; publicId?: string; numbers: number[]; prize: number }
export interface LuckyEntry { userId: string; name: string; publicId?: string; numbers: number[]; at: string; feeCharged?: number }

export interface LuckyGame {
  id: string; name: string; status: LuckyStatus; enabled: boolean;
  minNumber: number; maxNumber: number;
  startAt?: string; endAt?: string; drawAt?: string;
  entryFee: number; maxPicksPerUser: number; allowEditPick: boolean;
  prize: number; prizeDetail?: string; splitPrize: boolean;
  roomId?: string; roomName?: string;
  createdAt: string; createdBy?: string; drawnAt?: string; drawnBy?: string; cancelledReason?: string;
  entriesCount: number; participantsCount: number;
  winningNumber?: number;
  winners?: LuckyWinner[];
  myNumbers: number[];
  canEnter: boolean;
  canDraw: boolean;
  // admin-only:
  drawMethod?: "auto" | "manual";
  manualNumber?: number;
  numberLocked?: boolean;
  entries?: LuckyEntry[];
  numberTally?: { number: number; count: number }[];
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(withBase(path), { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch { return null; }
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
  } catch { return { ok: false, error: "Network error" }; }
}

export async function fetchLuckyGames(): Promise<LuckyGame[]> {
  const d = await getJson<{ games: LuckyGame[] }>("/api/lucky-number");
  return d?.games ?? [];
}

export async function createLuckyGame(input: Partial<LuckyGame>): Promise<{ ok: boolean; error?: string }> {
  const r = await send("/api/lucky-number", "POST", input);
  return { ok: r.ok, error: r.error };
}

export async function updateLuckyGame(id: string, patch: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const r = await send(`/api/lucky-number/${id}`, "PATCH", patch);
  return { ok: r.ok, error: r.error };
}

export async function deleteLuckyGame(id: string): Promise<{ ok: boolean; error?: string }> {
  const r = await send(`/api/lucky-number/${id}`, "DELETE");
  return { ok: r.ok, error: r.error };
}

export async function enterLucky(id: string, numbers: number[]): Promise<{ ok: boolean; error?: string; numbers?: number[] }> {
  const r = await send(`/api/lucky-number/${id}/enter`, "POST", { numbers });
  return { ok: r.ok, error: r.error, numbers: (r.data as { numbers?: number[] })?.numbers };
}

export async function drawLucky(id: string): Promise<{ ok: boolean; error?: string; winningNumber?: number; winnerCount?: number; prizePer?: number }> {
  const r = await send(`/api/lucky-number/${id}/draw`, "POST");
  return { ok: r.ok, error: r.error, winningNumber: (r.data as { winningNumber?: number })?.winningNumber, winnerCount: (r.data as { winnerCount?: number })?.winnerCount, prizePer: (r.data as { prizePer?: number })?.prizePer };
}
