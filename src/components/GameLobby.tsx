"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useConfig } from "@/lib/config";
import { fetchLobby, lobbyDo, type LobbyView } from "@/lib/game-lobby";
import {
  Dices, Users, LogIn, LogOut, Play, X, Lock, Unlock, Pause, RotateCcw,
  UserX, Timer, Crown, ShieldCheck, Globe, Ban, Palette,
} from "lucide-react";

const DOT: Record<string, string> = { red: "bg-red-500", green: "bg-green-600", yellow: "bg-yellow-400", blue: "bg-blue-600", w: "bg-slate-100", b: "bg-zinc-900" };
const CNAME: Record<string, string> = { red: "Red", green: "Green", yellow: "Yellow", blue: "Blue", w: "White", b: "Black" };

// Poll the lobby state. Fast (1s) so the countdown ticks live; only while enabled.
export function useLobby(roomId: string | undefined, game: string, enabled: boolean) {
  const [lobby, setLobby] = useState<LobbyView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    if (!roomId || !enabled) { setLobby(null); setLoaded(true); return; }
    const l = await fetchLobby(roomId, game);
    setLobby(l);
    setLoaded(true);
  }, [roomId, game, enabled]);
  useEffect(() => {
    if (!roomId || !enabled) { setLobby(null); setLoaded(true); return; }
    let on = true;
    const tick = async () => { const l = await fetchLobby(roomId, game); if (on) { setLobby(l); setLoaded(true); } };
    tick();
    const t = setInterval(tick, 1000);
    return () => { on = false; clearInterval(t); };
  }, [roomId, game, enabled]);
  return { lobby, loaded, reload: load };
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-xl border border-white/8 bg-ink-850 p-6 sm:p-8">{children}</div>
    </div>
  );
}

// ── Host/Co-Host "Start Game" screen (no lobby yet) ───────────────────────────
export function LobbyStart({ canControl, hostOnly, onOpen, busy }: { canControl: boolean; hostOnly: boolean; onOpen: () => void; busy: boolean }) {
  return (
    <Shell>
      <span className="mx-auto grid size-14 place-items-center rounded-lg bg-petal-500/12 text-petal-400"><Dices className="size-7" /></span>
      <h1 className="mt-5 text-center font-display text-2xl font-extrabold text-mist-100">Game Lobby</h1>
      {canControl ? (
        <>
          <p className="mt-2 text-center text-sm text-mist-300">Start a game session for this voice room. You&apos;ll then choose <b>Manual Invitation</b> or <b>Automatic Join</b>.</p>
          <Button block size="lg" className="mt-6" disabled={busy} onClick={onOpen}><Play className="size-5" /> Start Game</Button>
          <p className="mt-3 text-center text-[11px] text-mist-500">Only the Host & Co-Hosts can start a game.</p>
        </>
      ) : (
        <>
          <p className="mt-3 text-center text-sm text-mist-300">Waiting for the <b>Host</b> or a <b>Co-Host</b> to start a game.{hostOnly ? "" : ""}</p>
          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-mist-500"><Timer className="size-4 animate-pulse" /> The game will open here automatically.</div>
        </>
      )}
    </Shell>
  );
}

// ── Mode choice (Host/Co-Host picks Manual or Automatic) ──────────────────────
export function LobbyModeChoice({ lobby, autoOn, manualOn, onPick, onCancel, busy }: {
  lobby: LobbyView; autoOn: boolean; manualOn: boolean; onPick: (m: "manual" | "auto") => void; onCancel: () => void; busy: boolean;
}) {
  const canControl = lobby.canControl;
  if (!canControl) {
    return <Shell><span className="mx-auto grid size-14 place-items-center rounded-lg bg-petal-500/12 text-petal-400"><Dices className="size-7" /></span><h1 className="mt-5 text-center font-display text-xl font-extrabold text-mist-100">Getting the game ready…</h1><p className="mt-2 text-center text-sm text-mist-300"><b>{lobby.hostName}</b> is choosing how players will join. Hang tight — you&apos;ll be able to join in a moment.</p></Shell>;
  }
  return (
    <Shell>
      <h1 className="text-center font-display text-2xl font-extrabold text-mist-100">Choose how players join</h1>
      <p className="mt-2 text-center text-sm text-mist-300">You started the game. Pick a mode to continue.</p>
      <div className="mt-6 space-y-3">
        <button disabled={busy || !manualOn} onClick={() => onPick("manual")} className={cn("w-full rounded-2xl border p-4 text-left transition", manualOn ? "border-line bg-ink-800 hover:border-lotus-400/50" : "cursor-not-allowed border-line bg-ink-800 opacity-40")}>
          <div className="flex items-center gap-2 font-display font-bold text-mist-100"><LogIn className="size-4 text-lotus-300" /> Manual Invitation {!manualOn && <span className="text-[10px] text-rose-300">(off)</span>}</div>
          <p className="mt-1 text-xs text-mist-400">Invite specific players (the current invite flow). Players join only through invitations.</p>
        </button>
        <button disabled={busy || !autoOn} onClick={() => onPick("auto")} className={cn("w-full rounded-2xl border p-4 text-left transition", autoOn ? "border-line bg-ink-800 hover:border-lotus-400/50" : "cursor-not-allowed border-line bg-ink-800 opacity-40")}>
          <div className="flex items-center gap-2 font-display font-bold text-mist-100"><Users className="size-4 text-emerald-300" /> Automatic Join {!autoOn && <span className="text-[10px] text-rose-300">(off)</span>}</div>
          <p className="mt-1 text-xs text-mist-400">Open a {lobby.maxPlayers}-seat lobby. Any member taps <b>Join</b> to take a seat — no invites. Auto-starts on a {lobby.minPlayers}+ player countdown.</p>
        </button>
      </div>
      <Button block variant="secondary" className="mt-4" disabled={busy} onClick={onCancel}><X className="size-4" /> Cancel</Button>
    </Shell>
  );
}

// ── "Game Starting…" splash ───────────────────────────────────────────────────
export function LobbyStarting({ lobby }: { lobby: LobbyView }) {
  const n = lobby.startingIn ?? 0;
  return (
    <Shell>
      <div className="py-4 text-center">
        <span className="mx-auto grid size-16 animate-pulse place-items-center rounded-full bg-emerald-500/15 text-emerald-300"><Play className="size-8" /></span>
        <h1 className="mt-5 font-display text-2xl font-extrabold text-mist-100">Game Starting…</h1>
        <p className="mt-2 text-sm text-mist-300">{lobby.filledCount} players — get ready!</p>
        {n > 0 && <div className="mx-auto mt-4 grid size-16 place-items-center rounded-full bg-black/40 font-display text-3xl font-black tabular-nums text-white">{n}</div>}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {lobby.seats.filter((s) => s.id).map((s) => (
            <span key={s.color} className="inline-flex items-center gap-1.5 rounded-full bg-ink-800 px-2.5 py-1 text-xs text-mist-100"><span className={cn("size-2.5 rounded-full", DOT[s.color])} />{s.name}</span>
          ))}
        </div>
      </div>
    </Shell>
  );
}

// ── The Automatic-Join lobby (seats + Join + countdown + host controls) ───────
export function LobbyAuto({ lobby, myId, busy, onAction }: {
  lobby: LobbyView; myId: string; busy: boolean;
  onAction: (action: string, extra?: { color?: string; targetId?: string }) => void;
}) {
  const seated = !!lobby.mySeat;
  const control = lobby.canControl;
  const remaining = lobby.remaining;
  // SEAT POSITIONS (Admin → Game Lobby). The admin decides which colour sits in
  // which position on the grid — e.g. swapping Yellow and Blue. This is display
  // ONLY: each seat keeps its colour, its player and everything the game engine
  // uses; only where it is drawn changes.
  const { config: lobbyCfg } = useConfig();
  const seats = useMemo(() => {
    const order = lobbyCfg.lobby?.seatOrder;
    if (!Array.isArray(order) || order.length === 0) return lobby.seats;
    const rank = new Map(order.map((c, i) => [c, i]));
    return [...lobby.seats].sort((a, b) => (rank.get(a.color) ?? 99) - (rank.get(b.color) ?? 99));
  }, [lobby.seats, lobbyCfg.lobby?.seatOrder]);

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-xl border border-white/8 bg-ink-850 p-5 sm:p-7">
        <div className="flex items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 font-display text-xl font-extrabold text-mist-100"><Dices className="size-5 text-petal-400" /> {lobby.gameName} Lobby</h1>
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", lobby.locked ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/15 text-emerald-300")}>{lobby.locked ? "Locked" : "Open"}</span>
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-300"><Users className="size-3.5" /> 🎮 Open for all members — tap an empty seat to Join.</p>

        {/* Countdown */}
        {remaining != null && (
          <div className={cn("mt-4 flex items-center justify-center gap-2 rounded-2xl border px-4 py-3", lobby.paused ? "border-amber-400/30 bg-amber-500/[0.08]" : "border-emerald-400/30 bg-emerald-500/[0.08]")}>
            <Timer className={cn("size-5", lobby.paused ? "text-amber-300" : "text-emerald-300")} />
            <span className="text-sm font-semibold text-mist-100">{lobby.paused ? "Paused" : "Starting in"}</span>
            <span className="font-display text-2xl font-black tabular-nums text-white">{remaining}s</span>
          </div>
        )}
        {remaining == null && lobby.filledCount < lobby.minPlayers && (
          <p className="mt-4 rounded-xl border border-line bg-ink-800 px-3 py-2.5 text-center text-xs text-mist-400">Waiting for at least {lobby.minPlayers} players to start the countdown…</p>
        )}

        {/* Seats */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {seats.map((s) => {
            const emptyColors = lobby.seats.filter((x) => !x.id).map((x) => x.color);
            const mine = s.id === myId;
            const empty = !s.id;
            const canJoin = empty && !seated && !lobby.locked && (lobby.publicJoin || control) && lobby.present && !lobby.amBanned;
            return (
              <div key={s.color} className={cn("rounded-2xl border p-3", mine ? "border-lotus-400/50 bg-lotus-500/10" : empty ? "border-dashed border-line bg-ink-800/40" : "border-line bg-ink-800")}>
                <div className="flex items-center gap-2">
                  <span className={cn("size-4 rounded-full ring-2 ring-white/30", DOT[s.color])} />
                  <span className="text-xs font-semibold capitalize text-mist-300">{CNAME[s.color]}</span>
                </div>
                {empty ? (
                  <button disabled={!canJoin || busy} onClick={() => onAction("join", { color: s.color })} className={cn("mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-bold transition", canJoin ? "bg-emerald-500 text-white hover:bg-emerald-400 active:scale-95" : "cursor-not-allowed bg-ink-700 text-mist-500")}>
                    <LogIn className="size-4" /> Join
                  </button>
                ) : (
                  <div className="mt-2">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-bold text-mist-100">{mine ? "You" : s.name}</span>
                      {s.id === lobby.hostId && <Crown className="size-3.5 shrink-0 text-gold-300" />}
                    </div>
                    {control && !mine && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <button disabled={busy} onClick={() => onAction("remove", { targetId: s.id })} title="Remove from lobby (frees the seat to replace them)" className="grid size-6 place-items-center rounded bg-white/10 text-mist-300 hover:bg-white/20"><UserX className="size-3.5" /></button>
                        <button disabled={busy} onClick={() => onAction("ban", { targetId: s.id })} title="Ban from this lobby" className="grid size-6 place-items-center rounded bg-rose-500/15 text-rose-300 hover:bg-rose-500/25"><Ban className="size-3.5" /></button>
                      </div>
                    )}
                    {/* Change colour / assign position — a player moves themselves;
                        the host can move ANY player to an empty colour. */}
                    {(mine || control) && emptyColors.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        <Palette className="size-3 text-mist-500" />
                        {emptyColors.map((ec) => (
                          <button key={ec} disabled={busy} onClick={() => onAction("color", { targetId: s.id, color: ec })} title={`Move to ${CNAME[ec]}`} className={cn("size-4 rounded-full ring-1 ring-white/40 transition hover:scale-110", DOT[ec])} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Live counts */}
        <div className="mt-3 flex items-center justify-center gap-4 text-xs text-mist-400">
          <span className="inline-flex items-center gap-1.5"><Users className="size-3.5 text-emerald-300" /> {lobby.filledCount} joined</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full border border-dashed border-mist-500" /> {lobby.emptyCount} empty</span>
        </div>
        {!lobby.present && !control && <p className="mt-2 text-center text-[11px] text-amber-300">Join this room&apos;s voice to take a seat.</p>}
        {lobby.amBanned && <p className="mt-2 text-center text-[11px] text-rose-300">You were removed from this lobby by the host.</p>}

        {/* My action */}
        <div className="mt-4">
          {seated ? (
            <Button block variant="secondary" disabled={busy} onClick={() => onAction("leave")}><LogOut className="size-4" /> Leave my seat</Button>
          ) : null}
        </div>

        {/* Host controls */}
        {control && (
          <div className="mt-4 rounded-2xl border border-white/8 bg-ink-900/50 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-lotus-300"><ShieldCheck className="size-4" /> Host controls</p>
            <div className="grid grid-cols-2 gap-2">
              <Ctl onClick={() => onAction("forceStart")} disabled={busy || lobby.filledCount < lobby.minPlayers} icon={Play} label="Force start" tone="emerald" />
              <Ctl onClick={() => onAction(lobby.paused ? "resume" : "pause")} disabled={busy || remaining == null} icon={lobby.paused ? Play : Pause} label={lobby.paused ? "Resume timer" : "Pause timer"} />
              <Ctl onClick={() => onAction(lobby.locked ? "unlock" : "lock")} disabled={busy} icon={lobby.locked ? Unlock : Lock} label={lobby.locked ? "Unlock lobby" : "Lock lobby"} />
              <Ctl onClick={() => onAction("public")} disabled={busy} icon={Globe} label={lobby.publicJoin ? "Public: ON" : "Public: OFF"} tone={lobby.publicJoin ? "emerald" : undefined} />
              <Ctl onClick={() => onAction("restart")} disabled={busy} icon={RotateCcw} label="Restart lobby" />
              <Ctl onClick={() => onAction("cancel")} disabled={busy} icon={X} label="Cancel game" tone="rose" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Ctl({ onClick, disabled, icon: Icon, label, tone }: { onClick: () => void; disabled: boolean; icon: typeof Play; label: string; tone?: "emerald" | "rose" }) {
  return (
    <button onClick={onClick} disabled={disabled} className={cn(
      "flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition disabled:opacity-40",
      tone === "emerald" ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25" : tone === "rose" ? "bg-rose-500/15 text-rose-300 hover:bg-rose-500/25" : "bg-white/10 text-mist-200 hover:bg-white/20",
    )}>
      <Icon className="size-3.5" /> {label}
    </button>
  );
}
