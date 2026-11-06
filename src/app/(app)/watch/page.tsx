"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, Radio, Palette, Play } from "lucide-react";
import { GameOverModal } from "@/components/GameOverModal";
import { AgencyBadge } from "@/components/AgencyBadge";
import { LudoWatch, SnakeWatch, ChessWatch } from "@/components/spectator/Boards";
import { RoomJoinLeaveFeed } from "@/components/RoomJoinLeaveFeed";
import { withBase } from "@/lib/base-path";
import { avatarLabel } from "@/lib/avatar-label";
import { BOARD_THEMES, boardThemeById, type BoardThemeId } from "@/lib/cosmetics";
import { cn } from "@/lib/cn";

interface SessionView {
  id: string;
  game: string;
  roomId: string;
  roomName: string;
  agencyName?: string;
  agencyId?: string;
  players: string[];
  playerIds: string[];
  status: "running" | "completed" | "ended";
  winner: string | null;
  state: string | null;
  spectators: number;
  spectatorNames?: string[];
}

export default function WatchPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null | undefined>(undefined);
  const [session, setSession] = useState<SessionView | null>(null);
  const [showOver, setShowOver] = useState(false);
  const overShown = useRef(false);
  // Spectator's own board style + the "who's watching" popover.
  const [themeId, setThemeId] = useState<BoardThemeId>("classic");
  const [viewersOpen, setViewersOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const theme = boardThemeById(themeId);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setSessionId(sp.get("session"));
    try { const saved = localStorage.getItem("lotus.watch.board"); if (saved && BOARD_THEMES.some((t) => t.id === saved)) setThemeId(saved as BoardThemeId); } catch { /* ignore */ }
  }, []);
  const chooseTheme = (id: BoardThemeId) => { setThemeId(id); try { localStorage.setItem("lotus.watch.board", id); } catch { /* ignore */ } };

  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    const poll = async () => {
      try {
        const res = await fetch(withBase(`/api/games/session?id=${sessionId}&watch=1`), { credentials: "include" });
        const data = await res.json();
        if (!active) return;
        setSession(data.session ?? null);
        // The game is over (finished OR auto-closed because the room emptied) —
        // stop polling a dead session.
        if (data.session && data.session.status !== "running") { active = false; if (timer) clearInterval(timer); }
      } catch {
        /* ignore */
      }
    };
    poll();
    // Tighter poll so Watch Mode stays closely in sync with live play.
    timer = setInterval(poll, 1500);
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [sessionId]);

  useEffect(() => {
    if (session && session.status !== "running" && !overShown.current) {
      overShown.current = true;
      setShowOver(true);
    }
  }, [session]);

  if (sessionId === undefined) return null;
  if (sessionId === null) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-mist-100">No game selected</h1>
        <Link href="/rooms" className="mt-4 inline-block text-sm text-lotus-300">← Back to rooms</Link>
      </div>
    );
  }

  let parsed: { kind: string; game?: unknown; state?: unknown; names?: Record<string, string> } | null = null;
  try {
    parsed = session?.state ? JSON.parse(session.state) : null;
  } catch {
    parsed = null;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 rounded-full bg-ink-800 px-3 py-1.5 text-sm font-semibold text-mist-300 hover:text-mist-100">
            <ArrowLeft className="size-4" /> Leave
          </button>
          {/* REJOIN — jump back into the game as a real player (leaves spectator mode). */}
          {session && session.status === "running" && (
            <Link
              href={withBase(`/games/${(session.game || "").toLowerCase().split(" ")[0]}?room=${encodeURIComponent(session.roomId)}&group=${encodeURIComponent(session.roomName)}&join=1`)}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-lotus-500 to-petal-500 px-3.5 py-1.5 text-sm font-bold text-white shadow-sm transition hover:brightness-110"
            >
              <Play className="size-4" /> Rejoin
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-bold text-rose-300"><Radio className="size-3" /> Watching</span>
          {/* Board style picker */}
          <div className="relative">
            <button onClick={() => { setPickerOpen((o) => !o); setViewersOpen(false); }} title="Board style" className="inline-flex items-center gap-1.5 rounded-full bg-ink-800 px-2.5 py-1 text-xs font-semibold text-mist-300 hover:bg-ink-700">
              <Palette className="size-3.5 text-lotus-300" /> Style
            </button>
            {pickerOpen && (
              <div className="absolute right-0 z-30 mt-2 w-44 rounded-xl border border-white/10 bg-ink-850 p-2 shadow-2xl">
                <p className="mb-1.5 px-1 text-[11px] font-semibold text-mist-400">Board style</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {BOARD_THEMES.map((t) => (
                    <button key={t.id} onClick={() => { chooseTheme(t.id); setPickerOpen(false); }} title={t.name} className={cn("flex flex-col items-center gap-1 rounded-lg p-1.5 transition", themeId === t.id ? "bg-white/10 ring-1 ring-lotus-400" : "hover:bg-white/[0.06]")}>
                      <span className="h-7 w-full rounded-md ring-1 ring-white/15" style={{ background: t.preview }} />
                      <span className="truncate text-[9px] text-mist-300">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* Viewer list */}
          <div className="relative">
            <button onClick={() => { setViewersOpen((o) => !o); setPickerOpen(false); }} title="Who's watching" className="inline-flex items-center gap-1.5 rounded-full bg-ink-800 px-2.5 py-1 text-xs font-semibold text-mist-300 hover:bg-ink-700">
              <Eye className="size-3.5" /> {session?.spectators ?? 1}
            </button>
            {viewersOpen && (
              <div className="absolute right-0 z-30 mt-2 w-52 rounded-xl border border-white/10 bg-ink-850 p-2 shadow-2xl">
                <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-semibold text-mist-400"><Eye className="size-3.5" /> Watching now ({session?.spectatorNames?.length ?? session?.spectators ?? 0})</p>
                <div className="max-h-56 space-y-0.5 overflow-y-auto">
                  {(session?.spectatorNames ?? []).length === 0 ? (
                    <p className="px-1 py-2 text-center text-xs text-mist-500">No viewers yet.</p>
                  ) : (
                    session!.spectatorNames!.map((n, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-mist-200 hover:bg-white/[0.04]">
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-lotus-500/20 text-[10px] font-bold text-lotus-200">{avatarLabel(n, { mode: "initials", maxChars: 2 })}</span>
                        <span className="truncate">{n}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-ink-850/60 p-4 sm:p-5">
        <div className="mb-3 text-center">
          <h1 className="font-display text-xl font-extrabold text-mist-100">{session?.game ?? "Game"}</h1>
          <p className="text-xs text-mist-400">{session?.roomName} · spectator view (read-only)</p>
          {/* Agency that manages this game's room — next to the room name, same as everywhere. */}
          {session?.agencyName && (
            <div className="mt-1.5 flex justify-center"><AgencyBadge name={session.agencyName} id={session.agencyId} /></div>
          )}
        </div>

        {!session && <p className="py-10 text-center text-sm text-mist-400">Connecting to the game…</p>}
        {session && !parsed && session.status === "running" && <p className="py-10 text-center text-sm text-mist-400">Waiting for the next move…</p>}

        {parsed?.kind === "ludo" && <LudoWatch game={parsed.game as never} names={parsed.names ?? {}} theme={theme} />}
        {parsed?.kind === "snake" && <SnakeWatch game={parsed.game as never} names={parsed.names ?? {}} theme={theme} />}
        {/* Chess writes its board under `game` like every other game — reading
            `state` here handed ChessWatch undefined, so chess watch showed nothing.
            `state` is kept as a fallback for any older saved session. */}
        {parsed?.kind === "chess" && <ChessWatch state={(parsed.game ?? parsed.state) as never} names={parsed.names ?? {}} />}

        {/* Who joined / who left the room, visible while watching. */}
        <RoomJoinLeaveFeed roomId={session?.roomId} className="mt-4" />

        <p className="mt-4 rounded-lg bg-white/[0.04] px-3 py-2 text-center text-[11px] text-mist-500">
          You&apos;re watching as a spectator — you can&apos;t roll, move pieces, or take a seat. Updates every couple of seconds.
        </p>
      </div>

      {showOver && session && (
        <GameOverModal
          winner={session.winner ?? (session.status === "ended" ? "Game ended" : "—")}
          rank={session.status === "ended" ? "Ended by an admin" : "Final result"}
          onClose={() => setShowOver(false)}
        />
      )}
    </div>
  );
}
