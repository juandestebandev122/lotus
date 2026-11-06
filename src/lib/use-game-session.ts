"use client";

import { useEffect, useRef } from "react";
import { withBase } from "./base-path";

// Reports a game session to the backend so admins can monitor active games,
// see winner history, and force-end games. Also polls for force-end and calls
// onForceEnd() so the player's game stops when an admin ends it.
export function useGameSession({
  roomId,
  roomName,
  game,
  players,
  active,
  winner,
  state,
  onForceEnd,
}: {
  roomId: string | undefined;
  roomName: string;
  game: string;
  players: string[];
  active: boolean; // a game is in progress (no winner yet)
  winner: string | null;
  state?: string; // serialized live game state (for spectators)
  onForceEnd: () => void;
}) {
  const idRef = useRef<string | null>(null);
  const endedRef = useRef(false);
  const forceRef = useRef(onForceEnd);
  forceRef.current = onForceEnd;
  const playersRef = useRef(players);
  playersRef.current = players;
  const stateRef = useRef(state);
  stateRef.current = state;

  const pushState = (s: string) => {
    if (!idRef.current) return;
    fetch(withBase("/api/games/session"), {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: idRef.current, state: s }),
    }).catch(() => {});
  };

  // Start a session when a game becomes active.
  useEffect(() => {
    if (!roomId || !active || idRef.current) return;
    let cancelled = false;
    fetch(withBase("/api/games/session"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, roomName, game, players: playersRef.current }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        idRef.current = d?.id ?? null;
        // Push the current board immediately so spectators see it without
        // waiting for the next move (the session id wasn't ready until now).
        if (stateRef.current) pushState(stateRef.current);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [roomId, roomName, game, active]);

  // Push the live game state for spectators whenever it changes.
  useEffect(() => {
    if (!active || !state) return;
    pushState(state);
  }, [state, active]);

  // Mark completed when there's a winner.
  useEffect(() => {
    if (!winner || !idRef.current || endedRef.current) return;
    endedRef.current = true;
    fetch(withBase("/api/games/session"), {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: idRef.current, winner }),
    }).catch(() => {});
  }, [winner]);

  // Poll for an admin force-end while the game is live.
  useEffect(() => {
    if (!active || winner) return;
    const t = setInterval(async () => {
      if (!idRef.current) return;
      try {
        const res = await fetch(withBase(`/api/games/session?id=${idRef.current}`), { credentials: "include" });
        const d = await res.json();
        if (d?.session?.status === "ended") {
          clearInterval(t);
          forceRef.current();
        }
      } catch {
        /* ignore */
      }
    }, 6000);
    return () => clearInterval(t);
  }, [active, winner]);
}
