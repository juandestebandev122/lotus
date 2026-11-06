"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { LudoWatch, SnakeWatch, ChessWatch } from "@/components/spectator/Boards";
import { BOARD_THEMES } from "@/lib/cosmetics";
import { X, Radio, Users, ExternalLink, Loader2, RefreshCw } from "lucide-react";

/**
 * ADMIN LIVE GAME VIEWER.
 *
 * Shows a running match's real board straight inside the Admin Panel, so an admin
 * can watch any game without joining its room. It renders the SAME spectator board
 * players see, from the same live state.
 *
 * INVISIBLE BY DESIGN: it polls the session WITHOUT `?watch=1`, so the admin is
 * never registered as a spectator — the players' "N watching" count is unchanged
 * and nobody is told an admin is looking. It is strictly read-only: there is no
 * way to roll, move or take a seat from here.
 */

interface SessionView {
  id: string;
  game: string;
  roomId: string;
  roomName: string;
  players: string[];
  status: "running" | "completed" | "ended";
  winner: string | null;
  state: string | null;
  spectators: number;
}

/** Poll one live session. `active` lets a closed modal stop its own polling. */
function useLiveSession(sessionId: string | null, active: boolean, everyMs = 2500) {
  const [session, setSession] = useState<SessionView | null>(null);
  const [loading, setLoading] = useState(true);
  const stop = useRef(false);

  useEffect(() => {
    if (!sessionId || !active) return;
    stop.current = false;
    setLoading(true);
    const tick = async () => {
      if (stop.current) return;
      // Deliberately NO `watch=1` — an admin watching must stay invisible and must
      // not inflate the players' spectator count.
      try {
        const r = await fetch(withBase(`/api/games/session?id=${encodeURIComponent(sessionId)}`), { credentials: "include", cache: "no-store" });
        const d = await r.json().catch(() => ({}));
        if (!stop.current) setSession((d?.session as SessionView) ?? null);
      } catch { /* keep the last frame on a blip */ }
      if (!stop.current) setLoading(false);
    };
    void tick();
    const t = setInterval(tick, everyMs);
    return () => { stop.current = true; clearInterval(t); };
  }, [sessionId, active, everyMs]);

  return { session, loading };
}

/** Parse the stored game state into whatever the matching board needs. */
function parseState(state: string | null) {
  try {
    return state ? (JSON.parse(state) as { kind?: string; game?: unknown; state?: unknown; names?: Record<string, string> }) : null;
  } catch { return null; }
}

/** The live board on its own — used by both the modal and the "watch all" grid. */
export function AdminLiveBoard({ sessionId, active = true, compact = false }: { sessionId: string; active?: boolean; compact?: boolean }) {
  const { session, loading } = useLiveSession(sessionId, active);
  const parsed = parseState(session?.state ?? null);
  const theme = BOARD_THEMES[0];

  if (loading && !session) {
    return <div className="grid h-40 place-items-center text-mist-500"><Loader2 className="size-5 animate-spin" /></div>;
  }
  if (!session) {
    return <p className="py-10 text-center text-sm text-mist-500">This game is no longer available.</p>;
  }
  if (!parsed) {
    return (
      <p className="py-10 text-center text-sm text-mist-400">
        {session.status === "running" ? "Waiting for the next move…" : "This game has finished."}
      </p>
    );
  }

  return (
    <div className={cn(compact && "origin-top scale-[0.92]")}>
      {parsed.kind === "ludo" && <LudoWatch game={parsed.game as never} names={parsed.names ?? {}} theme={theme} />}
      {parsed.kind === "snake" && <SnakeWatch game={parsed.game as never} names={parsed.names ?? {}} theme={theme} />}
      {/* Chess stores its board under `game`, same as the other games. */}
      {parsed.kind === "chess" && <ChessWatch state={(parsed.game ?? parsed.state) as never} names={parsed.names ?? {}} />}
    </div>
  );
}

/** Full-screen viewer for ONE game, opened from the running-games list. */
export function AdminGameWatchModal({ sessionId, game, roomName, onClose }: {
  sessionId: string; game: string; roomName: string; onClose: () => void;
}) {
  const { session } = useLiveSession(sessionId, true);
  // Escape closes, like every other admin modal.
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/75 p-3" onClick={onClose}>
      <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-ink-900" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-white/10 bg-ink-900/95 px-4 py-3 backdrop-blur">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-bold text-rose-300">
            <Radio className="size-3" /> LIVE
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display font-bold text-mist-100">{game}</p>
            <p className="truncate text-[11px] text-mist-500">{roomName}</p>
          </div>
          {session && (
            <span className="hidden items-center gap-1 text-[11px] text-mist-400 sm:inline-flex">
              <Users className="size-3.5" /> {session.players?.length ?? 0} playing · {session.spectators ?? 0} watching
            </span>
          )}
          <Link
            href={`/watch?session=${encodeURIComponent(sessionId)}`}
            target="_blank"
            title="Open the full spectator page"
            className="grid size-8 place-items-center rounded-lg text-mist-400 transition hover:bg-white/10 hover:text-mist-100"
          >
            <ExternalLink className="size-4" />
          </Link>
          <button onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-lg text-mist-400 transition hover:bg-white/10 hover:text-mist-100">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-4">
          <AdminLiveBoard sessionId={sessionId} />
        </div>

        <p className="border-t border-white/10 px-4 py-2.5 text-center text-[11px] text-mist-500">
          Read-only. You are <b className="text-mist-400">not</b> counted as a spectator and the players are not told an admin is watching.
        </p>
      </div>
    </div>
  );
}

/** Every running game's board at once — the "watch all" wall. */
export function AdminWatchAll({ sessions, onRefresh, busy }: {
  sessions: { id: string; game: string; roomName: string; players: string[] }[];
  onRefresh?: () => void;
  busy?: boolean;
}) {
  if (sessions.length === 0) {
    return <div className="rounded-2xl border border-line bg-ink-900/40 p-10 text-center text-sm text-mist-500">No games are running right now.</div>;
  }
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-mist-400">
          Every live game, updating every couple of seconds. You are not counted as a spectator on any of them.
        </p>
        {onRefresh && (
          <button onClick={onRefresh} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-ink-800 px-3 py-1.5 text-xs font-semibold text-mist-200 transition hover:bg-white/[0.06]">
            <RefreshCw className={cn("size-3.5", busy && "animate-spin")} /> Refresh list
          </button>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {sessions.map((s) => (
          <div key={s.id} className="overflow-hidden rounded-2xl border border-white/8 bg-ink-900/40">
            <div className="flex items-center gap-2 border-b border-white/8 px-3 py-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-300"><Radio className="size-2.5" /> LIVE</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-mist-100">{s.game}</p>
                <p className="truncate text-[10px] text-mist-500">{s.roomName} · {(s.players ?? []).join(", ") || "—"}</p>
              </div>
              <Link href={`/watch?session=${encodeURIComponent(s.id)}`} target="_blank" title="Open full view" className="grid size-7 shrink-0 place-items-center rounded-lg text-mist-500 transition hover:bg-white/10 hover:text-mist-100">
                <ExternalLink className="size-3.5" />
              </Link>
            </div>
            <div className="p-3">
              <AdminLiveBoard sessionId={s.id} compact />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
