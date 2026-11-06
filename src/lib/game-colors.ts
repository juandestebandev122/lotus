"use client";

import { withBase } from "./base-path";

// Live Ludo colour reservations, so two players never pick the same colour.

export async function fetchTakenColors(roomId: string): Promise<string[]> {
  try {
    const res = await fetch(withBase(`/api/games/color-status?room=${encodeURIComponent(roomId)}`), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return Array.isArray(d.taken) ? d.taken : [];
  } catch {
    return [];
  }
}

/** Reserve `color` (empty string releases). Returns the current taken set and
 *  whether the requested colour clashed (was already taken by someone else). */
export async function claimColor(roomId: string, color: string): Promise<{ taken: string[]; conflict: boolean }> {
  try {
    const res = await fetch(withBase("/api/games/color-status"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ room: roomId, color }) });
    const d = await res.json().catch(() => ({}));
    return { taken: Array.isArray(d.taken) ? d.taken : [], conflict: !!d.conflict };
  } catch {
    return { taken: [], conflict: false };
  }
}
