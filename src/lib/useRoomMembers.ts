"use client";

import { useEffect, useState } from "react";
import { withBase } from "./base-path";

export interface RoomMember {
  id: string;
  name: string;
  /** Permanent member ID number — shown beside the name everywhere. */
  publicId?: string;
  avatar?: string;
}

/**
 * The people currently seated in a room's live voice channel — the source of
 * truth for who can be invited to a game. Polls so the list stays current as
 * people join/leave. Returns [] until loaded (and when no one is in voice).
 */
export function useRoomMembers(roomId: string | undefined, intervalMs = 5000): RoomMember[] {
  const [members, setMembers] = useState<RoomMember[]>([]);
  useEffect(() => {
    if (!roomId) return;
    let on = true;
    const load = async () => {
      try {
        const res = await fetch(withBase(`/api/rooms/${roomId}/participants`), { credentials: "include" });
        const data = await res.json();
        if (on) setMembers((data.members as RoomMember[]) ?? []);
      } catch {
        /* ignore */
      }
    };
    load();
    const t = setInterval(load, intervalMs);
    return () => { on = false; clearInterval(t); };
  }, [roomId, intervalMs]);
  return members;
}
