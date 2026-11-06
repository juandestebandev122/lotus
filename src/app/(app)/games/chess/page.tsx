"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Crown, RotateCcw, Trophy, Swords, Gift as GiftIcon, Loader2, Ban } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LotusMark } from "@/components/Logo";
import { GroupRequired, GroupBanner, useGroupParam } from "@/components/GroupGate";
import { GameInvites } from "@/components/GameInvites";
import { useLobby, LobbyStart, LobbyModeChoice, LobbyAuto, LobbyStarting } from "@/components/GameLobby";
import { lobbyDo, type LobbySeatView, type LobbyView } from "@/lib/game-lobby";
import { useGift } from "@/components/GiftProvider";
import { useConfig } from "@/lib/config";
import { GameOverModal } from "@/components/GameOverModal";
import { useBackGuard } from "@/lib/use-back-guard";
import { useToast } from "@/components/ui/Toast";
import { RoomJoinLeaveFeed } from "@/components/RoomJoinLeaveFeed";
import { useNetGame, type Seats } from "@/lib/use-net-game";
import { useGameActiveFlag } from "@/lib/use-game-active";
import { lifelog } from "@/lib/lifelog";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { gameTurnSeconds } from "@/lib/game-config";
import { ME, fetchRoom } from "@/lib/rooms";
import { useRoomMembers, type RoomMember } from "@/lib/useRoomMembers";
import { useAuth } from "@/lib/auth";
import {
  initialState,
  legalMoves,
  play,
  type ChessState,
  type Color,
  type Move,
  type PieceType,
  type Sq,
} from "@/lib/chess";
import {
  resolveChess, glyphFor, pieceImage, pieceTextStyle, moveNotation, squareName,
} from "@/lib/chess-theme";

const GLYPH: Record<PieceType, string> = {
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
};
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const key = (r: number, c: number) => `${r},${c}`;

export default function ChessPage() {
  const group = useGroupParam();
  const { user } = useAuth();
  const { toast } = useToast();
  const myName = user?.fullName?.split(" ")[0] || ME.fullName.split(" ")[0];
  const myId = user?.id ?? "";
  // Real voice-room members = the ONLY people who can be invited to the game.
  const members = useRoomMembers(group?.room);

  // The starter sets `starting` (initial board + seats); joiners find a running
  // session via `hasRunning`; an accepted invite arrives with ?join=1.
  const router = useRouter();
  const [starting, setStarting] = useState<{ game: ChessState; seats: Seats; names: Record<string, string> } | null>(null);
  const [hasRunning, setHasRunning] = useState(false);
  // A Chess game is running here that I'm NOT part of → show a "game in progress"
  // screen instead of the host Setup (so I can't clobber the live session).
  const [otherRunning, setOtherRunning] = useState(false);
  const [joinMode, setJoinMode] = useState(false);
  useEffect(() => { setJoinMode(new URLSearchParams(window.location.search).get("join") === "1"); }, []);
  // Keep the board mounted through the end-of-game results popup (the "running
  // game" detector flips hasRunning off when a game finishes). Cleared on leave.
  const [inGame, setInGame] = useState(false);
  // The opponent who ACCEPTED (id + name) — drives Start. Null until they accept.
  const [ready, setReady] = useState<{ id: string; name: string }[] | null>(null);
  const [selected, setSelected] = useState<number[]>([]); // chosen opponent (index into members)
  const [coHostIds, setCoHostIds] = useState<string[]>([]);
  const [canControlRoom, setCanControlRoom] = useState(false);
  // ONLY members on a voice seat may play — listeners are blocked.
  const [iAmSeated, setIAmSeated] = useState(true);
  useEffect(() => {
    if (group?.room) fetchRoom(group.room).then((r) => {
      setCoHostIds(r?.coAdminIds ?? []);
      const ctl = !!r && (r.host?.id === myId || r.ownerId === myId || (r.coAdminIds ?? []).includes(myId));
      setCanControlRoom(ctl || user?.role === "admin");
      const seated = !!r && (r.host?.id === myId || r.ownerId === myId || (r.coAdminIds ?? []).includes(myId) ||
        ((r.stageApprovedIds ?? []).includes(myId) && !(r.audienceIds ?? []).includes(myId)));
      setIAmSeated(seated || user?.role === "admin");
    });
  }, [group?.room, myId, user?.role]);

  // ── New Host-controlled match-start flow (gated by config.lobby.enabled) ──
  const { config: appCfg } = useConfig();
  const lobbyEnabled = appCfg.lobby?.enabled === true;
  const { lobby, reload: reloadLobby } = useLobby(group?.room, "chess", lobbyEnabled);
  const [lobbyBusy, setLobbyBusy] = useState(false);
  const [startingLobby, setStartingLobby] = useState<LobbyView | null>(null);
  const lobbyBuiltRef = useRef(false);
  useEffect(() => { if (lobby?.status === "starting") setStartingLobby(lobby); }, [lobby]);
  const doLobby = useCallback(async (action: string, extra?: { color?: string; targetId?: string; mode?: string }) => {
    if (!group?.room) return;
    setLobbyBusy(true);
    const res = await lobbyDo(group.room, "chess", action, extra ?? {});
    setLobbyBusy(false);
    if (!res.ok && res.error) toast(res.error, "error");
    reloadLobby();
  }, [group?.room, reloadLobby, toast]);
  const startFromLobby = useCallback((seats: LobbySeatView[]) => {
    const filled = seats.filter((s) => s.id);
    if (filled.length < 2) return;
    const seatMap: Seats = {};
    for (const s of filled) seatMap[s.color as Color] = { id: s.id!, name: s.name ?? "Player" };
    setStarting({ game: initialState(), seats: seatMap, names: { w: seatMap.w?.name ?? "—", b: seatMap.b?.name ?? "—" } });
  }, []);
  useEffect(() => {
    if (!lobby || lobby.status !== "starting") { lobbyBuiltRef.current = false; return; }
    if (lobby.builderId !== myId || (lobby.startingIn ?? 0) > 0 || lobbyBuiltRef.current) return;
    lobbyBuiltRef.current = true;
    startFromLobby(lobby.seats);
    if (group?.room) lobbyDo(group.room, "chess", "started");
  }, [lobby, myId, startFromLobby, group?.room]);

  const needed = 1; // chess is 2-player → invite exactly one opponent
  useEffect(() => {
    setSelected((prev) => (prev.length && prev[0] < members.length ? prev : members.map((_, i) => i).slice(0, needed)));
  }, [members.length]);
  const toggleMember = (i: number) => {
    setReady(null);
    const m = members[i];
    if (m && selected[0] !== i) toast(`${m.name.split(" ")[0]} selected`, "success"); // "Ahmed selected"
    setSelected([i]);
  };

  // Detect a running Chess game so invited players (or a returning player) drop in.
  useEffect(() => {
    if (!group?.room) return;
    let on = true;
    const check = async () => {
      try {
        const res = await fetch(withBase(`/api/games/active?room=${encodeURIComponent(group.room)}`), { credentials: "include" });
        const d = await res.json();
        const sess = (d.sessions ?? []).find((s: { game?: string }) => (s.game || "").toLowerCase().includes("chess")) as { playerIds?: string[] } | undefined;
        // Only auto-drop THIS user onto the board if they're actually a seated
        // participant — otherwise an uninvited room member gets pulled into (or
        // could clobber) someone else's match. Legacy sessions keep old behaviour.
        const ids = sess?.playerIds;
        const mine = !!sess && (!ids || ids.length === 0 || (!!myId && ids.includes(myId)));
        if (on) { setHasRunning(mine); setOtherRunning(!!sess && !mine); }
      } catch { /* ignore */ }
    };
    check();
    const t = setInterval(check, 3000);
    return () => { on = false; clearInterval(t); };
  }, [group?.room, myId]);

  useEffect(() => {
    if (starting || hasRunning || joinMode) setInGame(true);
  }, [starting, hasRunning, joinMode]);

  const oppName = members[selected[0]]?.name.split(" ")[0] ?? "Opponent";
  const names: Record<Color, string> = { w: myName, b: oppName };

  const start = () => {
    const opp = (ready ?? [])[0];
    const seats: Seats = {
      w: { id: myId || "me", name: myName },
      b: opp ? { id: opp.id, name: opp.name } : { id: members[selected[0]]?.id ?? "b", name: oppName },
    };
    setStarting({ game: initialState(), seats, names: { w: myName, b: seats.b.name } });
  };

  // Games are group-only: require a Voice Room context.
  if (group === undefined) return null;
  if (group === null) return <GroupRequired />;

  // A game is live (I started it / one is already running) OR I arrived from an
  // accepted invite → join the shared, turn-gated board.
  if (starting || hasRunning || joinMode || inGame) {
    return (
      <>
        <GroupBanner name={group.name} roomId={group.room} />
        <ChessNetBoard roomId={group.room} roomName={group.name} myId={myId} initial={starting ?? undefined} canEndGame={canControlRoom} onQuit={() => { setStarting(null); setHasRunning(false); setJoinMode(false); setInGame(false); setStartingLobby(null); lobbyBuiltRef.current = false; }} />
      </>
    );
  }
  // A game I'm not part of is already running here — don't hijack it or start a
  // conflicting one; send me back to the room to Watch or Rejoin.
  if (otherRunning) {
    return (
      <>
        <GroupBanner name={group.name} roomId={group.room} />
        <div className="mx-auto max-w-md">
          <div className="rounded-2xl border border-white/8 bg-ink-850 p-8 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-lg bg-petal-500/12 text-petal-400"><Swords className="size-7" /></span>
            <h1 className="mt-4 font-display text-xl font-extrabold text-mist-100">A chess game is already in progress</h1>
            <p className="mt-2 text-sm text-mist-300">Another game is being played in this room right now. Head back to the room to <span className="font-semibold text-mist-100">Watch</span> or <span className="font-semibold text-mist-100">Rejoin</span> it — or wait for it to finish to start a new one.</p>
            <Button variant="secondary" className="mt-5" onClick={() => router.push(withBase(`/rooms/${group.room}`))}><ArrowLeft className="size-4" /> Back to room</Button>
          </div>
        </div>
      </>
    );
  }
  // LISTENERS cannot play — only members on a voice seat (checked after the
  // in-game branches so an active player is never thrown out mid-match).
  if (!iAmSeated) {
    return (
      <>
        <GroupBanner name={group.name} roomId={group.room} />
        <div className="mx-auto max-w-md">
          <div className="rounded-2xl border border-white/8 bg-ink-850 p-8 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-lg bg-amber-500/12 text-amber-300"><Swords className="size-7" /></span>
            <h1 className="mt-4 font-display text-xl font-extrabold text-mist-100">Take a seat to play</h1>
            <p className="mt-2 text-sm text-mist-300">You&apos;re currently a <span className="font-semibold text-mist-100">listener</span> in this room. Only members sitting on a <span className="font-semibold text-mist-100">voice seat</span> can start or join a game. Tap an empty seat in the room, then come back.</p>
            <Button variant="secondary" className="mt-5" onClick={() => router.push(withBase(`/rooms/${group.room}`))}><ArrowLeft className="size-4" /> Back to room</Button>
          </div>
        </div>
      </>
    );
  }

  // ── New Host-controlled lobby flow (only when the admin enabled it) ──
  if (lobbyEnabled) {
    const active: LobbyView | null = lobby ?? (startingLobby && startingLobby.status === "starting" ? startingLobby : null);
    if (active) {
      if (active.status === "starting" || (!lobby && startingLobby)) return (<><GroupBanner name={group.name} roomId={group.room} /><LobbyStarting lobby={active} /></>);
      if (active.mode === "auto" && active.status === "open") return (<><GroupBanner name={group.name} roomId={group.room} /><LobbyAuto lobby={active} myId={myId} busy={lobbyBusy} onAction={(a, e) => doLobby(a, e)} /></>);
      if (active.mode === null && active.status === "choosing") return (<><GroupBanner name={group.name} roomId={group.room} /><LobbyModeChoice lobby={active} autoOn={appCfg.lobby?.autoJoin !== false} manualOn={appCfg.lobby?.manualInvite !== false} onPick={(m) => doLobby("mode", { mode: m })} onCancel={() => doLobby("cancel")} busy={lobbyBusy} /></>);
      // manual → fall through to the classic Setup.
    } else {
      return (<><GroupBanner name={group.name} roomId={group.room} /><LobbyStart canControl={canControlRoom} hostOnly={appCfg.lobby?.hostOnlyStart !== false} onOpen={() => doLobby("open")} busy={lobbyBusy} /></>);
    }
  }

  return (
    <>
      <GroupBanner name={group.name} roomId={group.room} />
      <ChessSetup members={members} selected={selected} needed={needed} onToggleMember={toggleMember} names={names} invited={!!ready} onReady={setReady} onStart={start} coHostIds={coHostIds} roomName={group.name} roomId={group.room} />
    </>
  );
}

// ============================================================
// ChessNetBoard — shared, turn-gated multiplayer board. Every player runs this;
// only the player whose turn it is can move (their own colour).
// ============================================================
function ChessNetBoard({ roomId, roomName, myId, initial, onQuit, canEndGame }: {
  roomId: string;
  roomName: string;
  myId: string;
  initial?: { game: ChessState; seats: Seats; names: Record<string, string> };
  onQuit: () => void;
  /** Host / Co-Host / admin — may end the match for BOTH players. Ludo has had
   *  this since v373; chess was missing it, so a stalled match could only be
   *  abandoned one player at a time. */
  canEndGame?: boolean;
}) {
  useGameActiveFlag(); // defer app auto-update reloads while this board is mounted
  const { toast } = useToast();
  const router = useRouter();
  const net = useNetGame<ChessState>({ roomId, roomName, kind: "chess", myId, initial, currentSeatKey: (g) => g.turn });
  const myColor = (net.mySeatKey as Color | null) ?? null;
  const names = net.names as Record<Color, string>;

  // Record the result once a winner / forfeit is decided; reset on a new round.
  const endedRef = useRef(false);
  useEffect(() => {
    const g = net.game;
    const w = g ? (g.winner ?? (g.forfeitedBy ? (g.forfeitedBy === "w" ? "b" : "w") : null)) : null;
    if (w && !endedRef.current) { endedRef.current = true; net.end(`${names[w] ?? ""} (${w === "w" ? "White" : "Black"})`); }
    else if (!w && endedRef.current) { endedRef.current = false; }
  }, [net, names]);

  const playAgain = useCallback(() => { endedRef.current = false; net.restart(initialState()); }, [net]);
  const backToRoom = useCallback(() => { lifelog("nav:backToRoom"); router.push(withBase(`/rooms/${roomId}`)); }, [router, roomId]);

  // Admin force-ended the game → leave.
  useEffect(() => {
    if (net.status === "ended" && !net.game?.winner && !net.game?.forfeitedBy) { toast("An admin ended this game.", "info"); onQuit(); }
  }, [net.status, net.game?.winner, net.game?.forfeitedBy, onQuit, toast]);

  // Bridge the engine's setState to the network: a move made on MY turn is
  // broadcast to everyone (only the current player ever writes).
  const setState = useCallback<React.Dispatch<React.SetStateAction<ChessState | null>>>((updater) => {
    const cur = net.game;
    if (cur == null) return;
    const next = typeof updater === "function" ? (updater as (g: ChessState | null) => ChessState | null)(cur) : updater;
    if (next) net.push(next);
  }, [net]);

  if (net.startError) {
    return (
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-amber-400/20 bg-ink-850 p-8 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-lg bg-amber-500/12 text-amber-300"><Crown className="size-7" /></span>
          <h1 className="mt-4 font-display text-xl font-extrabold text-mist-100">Couldn&apos;t start the game</h1>
          <p className="mt-2 text-sm text-mist-300">{net.startError}</p>
          <Button variant="secondary" className="mt-5" onClick={onQuit}><ArrowLeft className="size-4" /> Back</Button>
        </div>
      </div>
    );
  }
  if (!net.ready || !net.game) {
    return (
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-white/8 bg-ink-850 p-8 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-lg bg-petal-500/12 text-petal-400"><Loader2 className="size-7 animate-spin" /></span>
          <h1 className="mt-4 font-display text-xl font-extrabold text-mist-100">Joining the game…</h1>
          <p className="mt-2 text-sm text-mist-400">Waiting for the host to start the chess board. You&apos;ll drop in automatically.</p>
          <Button variant="secondary" className="mt-5" onClick={onQuit}><ArrowLeft className="size-4" /> Back</Button>
        </div>
      </div>
    );
  }

  return <Board state={net.game} setState={setState} humans={myColor ? [myColor] : []} names={names} onQuit={onQuit} onPlayAgain={playAgain} onBackToRoom={backToRoom} roomId={roomId} canEndGame={canEndGame} onEndGame={() => net.endForEveryone()} />;
}

// ============================================================
// Setup — pick an opponent, send a real invite, then Start when they accept.
// ============================================================
function ChessSetup({ members, selected, needed, onToggleMember, names, invited, onReady, onStart, coHostIds, roomName, roomId }: {
  members: RoomMember[];
  selected: number[];
  needed: number;
  onToggleMember: (i: number) => void;
  names: Record<Color, string>;
  invited: boolean;
  onReady: (accepted: { id: string; name: string }[] | null) => void;
  onStart: () => void;
  coHostIds: string[];
  roomName: string;
  roomId: string;
}) {
  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-xl border border-white/8 bg-ink-850 p-6 sm:p-9">
        <span className="mx-auto grid size-14 place-items-center rounded-lg bg-lotus-500/12 text-lotus-300"><Crown className="size-7" /></span>
        <h1 className="mt-5 text-center font-display text-2xl font-extrabold text-mist-100 sm:text-3xl">Chess</h1>
        <p className="mt-2 text-center text-sm text-mist-300">Invite a group member and play a full game of chess together.</p>

        {/* Players */}
        <div className="mt-7 space-y-2">
          <p className="text-sm font-semibold text-mist-200">Players</p>
          <div className="flex items-center gap-3 rounded-xl border border-line bg-ink-800 px-3 py-2.5">
            <Avatar name={names.w} size="sm" />
            <span className="text-sm font-semibold text-mist-100">{names.w}</span>
            <span className="text-xs text-lotus-300">(You)</span>
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-mist-400"><span className="size-3 rounded-full bg-white ring-1 ring-black/20" /> White</span>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-line bg-ink-800 px-3 py-2.5">
            {/* Don't reveal the picked opponent's name/photo here on selection —
                only once they've actually JOINED (accepted the invite). */}
            <Avatar name={invited ? (members[selected[0]]?.name ?? "Opponent") : "?"} src={invited ? members[selected[0]]?.avatar : undefined} size="sm" />
            <span className={cn("text-sm font-semibold", invited ? "text-mist-100" : "italic text-mist-500")}>{invited ? names.b : "Waiting for opponent…"}</span>
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-mist-400"><span className="size-3 rounded-full bg-zinc-900 ring-1 ring-white/30" /> Black</span>
          </div>
        </div>

        {/* Invite opponent — ONLY people currently seated in the voice room. */}
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-mist-200">Invite a group member</p>
          {members.length === 0 ? (
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/[0.08] px-3 py-4 text-center text-xs text-amber-200">No one else is in the voice room yet. Your opponent must <strong className="text-amber-100">join this room&apos;s voice</strong> before you can invite them.</div>
          ) : (
            <div className="grid max-h-44 grid-cols-1 gap-1.5 overflow-y-auto">
              {members.map((m, i) => (
                <button key={m.id} onClick={() => onToggleMember(i)} className={cn("flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition", selected[0] === i ? "border-lotus-400 bg-lotus-500/15" : "border-line bg-ink-800 hover:border-lotus-400/40")}>
                  <Avatar name={m.name} src={m.avatar} size="xs" />
                  <span className="text-sm text-mist-100">{m.name}</span>
                  {selected[0] === i ? (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-lotus-500/20 px-2 py-0.5 text-[11px] font-bold text-lotus-200"><Check className="size-3.5" /> Selected</span>
                  ) : (
                    <span className="ml-auto text-[11px] text-mist-500">Tap to invite</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {members.length === 0 || selected.length < needed ? (
          <Button block size="lg" className="mt-5" disabled>{members.length === 0 ? "Waiting for an opponent to join the voice room" : "Select an opponent to invite"}</Button>
        ) : (
          <GameInvites
            invitees={selected.map((i) => ({ id: members[i]?.id ?? `idx-${i}`, name: members[i]?.name.split(" ")[0] ?? "Player" }))}
            coHostIds={coHostIds}
            gameName="Chess"
            hostName={names.w}
            roomName={roomName}
            roomId={roomId}
            onReady={onReady}
          />
        )}
        <Button block size="lg" className="mt-3" disabled={!invited} onClick={onStart}><Swords className="size-5" /> Start Game</Button>
      </div>
    </div>
  );
}

function Board({
  state,
  setState,
  humans,
  names,
  onQuit,
  onPlayAgain,
  onBackToRoom,
  roomId,
  canEndGame = false,
  onEndGame,
}: {
  state: ChessState;
  setState: React.Dispatch<React.SetStateAction<ChessState | null>>;
  humans: Color[];
  names: Record<Color, string>;
  onQuit: () => void;
  onPlayAgain?: () => void;
  onBackToRoom?: () => void;
  roomId: string;
  /** Host / Co-Host / admin may close the match for BOTH players. */
  canEndGame?: boolean;
  onEndGame?: () => void;
}) {
  const [selected, setSelected] = useState<Sq | null>(null);
  const [promo, setPromo] = useState<Move[] | null>(null);
  const [confirm, setConfirm] = useState<null | "leave" | "new" | "end">(null);
  const { openGift, lastGiftFor } = useGift(); // tap a player to gift them
  // Admin-controlled board + piece look, animations and which hints are shown.
  // Appearance only — nothing here can change a chess rule.
  const { config: chessConfig } = useConfig();
  const ui = useMemo(() => resolveChess(chessConfig), [chessConfig]);
  // BOARD ORIENTATION: each player looks at the board from their OWN side, so
  // Black sees their pieces at the bottom (standard for every chess app). The
  // underlying board array is untouched — only the drawing order flips.
  const myColor: Color | null = humans.length === 1 ? humans[0] : null;
  const flipped = ui.flipForBlack && myColor === "b";
  const rowOrder = useMemo(() => (flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7]), [flipped]);
  const colOrder = useMemo(() => (flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7]), [flipped]);

  // MOVE HISTORY — built from the shared state, so both players and every
  // spectator see the same list. Each entry is one ply in short notation.
  const [history, setHistory] = useState<{ n: number; w?: string; b?: string }[]>([]);
  const lastSeenRef = useRef<string>("");
  useEffect(() => {
    const lm = state.lastMove;
    if (!lm) { if (history.length) setHistory([]); lastSeenRef.current = ""; return; }
    const stamp = `${lm.from.r},${lm.from.c}-${lm.to.r},${lm.to.c}-${state.turn}`;
    if (stamp === lastSeenRef.current) return;
    lastSeenRef.current = stamp;
    // The side that just moved is the one whose turn it ISN'T any more.
    const moved: Color = state.turn === "w" ? "b" : "w";
    const note = moveNotation(lm.piece, lm.from, lm.to, !!lm.capture, lm.promotion);
    const suffix = state.status === "checkmate" ? "#" : state.status === "check" ? "+" : "";
    setHistory((h) => {
      const next = [...h];
      if (moved === "w") next.push({ n: next.length + 1, w: note + suffix });
      else if (next.length) next[next.length - 1] = { ...next[next.length - 1], b: note + suffix };
      else next.push({ n: 1, b: note + suffix });
      return next.slice(-60);
    });
  }, [state.lastMove, state.turn, state.board, state.status, history.length]);

  // CAPTURE FLASH — remember the square a capture just happened on so it can
  // pulse for a moment (purely decorative).
  const [flashSq, setFlashSq] = useState<string | null>(null);
  useEffect(() => {
    if (!ui.captureFlash || !state.lastMove?.capture) return;
    const k = key(state.lastMove.to.r, state.lastMove.to.c);
    setFlashSq(k);
    const t = setTimeout(() => setFlashSq(null), 420);
    return () => clearTimeout(t);
  }, [state.lastMove, ui.captureFlash]);

  // 15s turn timer + 3-leave-chances rule (2-player → opponent wins on removal).
  // Chances are CUMULATIVE for the session and are SAVED, so reloading / coming
  // back to the same game never refills them back to 3 (they pick up where they
  // were); playing a move no longer resets them either.
  // Admin-configurable chance-missing timer (config.gameTurnSeconds), fallback 15s.
  const { config: appConfig } = useConfig();
  const TURN_SECONDS = gameTurnSeconds(appConfig, "chess", 15);
  const MAX_MISSES = 3;
  const missesKey = `lotus.chess.misses.${roomId}`;
  const [timeLeft, setTimeLeft] = useState(TURN_SECONDS);
  const [misses, setMisses] = useState<{ w: number; b: number }>(() => {
    if (typeof window === "undefined") return { w: 0, b: 0 };
    try {
      const raw = localStorage.getItem(missesKey);
      if (raw) { const m = JSON.parse(raw); if (m && typeof m.w === "number" && typeof m.b === "number") return m; }
    } catch { /* ignore */ }
    return { w: 0, b: 0 };
  });
  // A player who LEFT / timed out (synced via the shared state so BOTH sides
  // see the result) — the other side wins.
  const forfeitWinner: Color | null = state.forfeitedBy ? (state.forfeitedBy === "w" ? "b" : "w") : null;

  const terminal =
    state.status === "checkmate" || state.status === "stalemate" || state.status === "draw" || !!forfeitWinner;
  const winnerColor = state.winner ?? forfeitWinner;
  const [showOver, setShowOver] = useState(false);
  // Absorb the phone Back button while the result popup is up (see ludo page).
  useBackGuard(terminal && showOver);
  useEffect(() => {
    if (terminal) setShowOver(true);
  }, [terminal]);

  // The end-of-game "🏠 Room" / "Play Again" bar buttons navigate INSTANTLY.
  // Keep them INERT for a beat after the game ends so a stray tap / ghost click
  // the moment it finishes can't whisk the player away before they read the
  // result. (Reset whenever the game is no longer terminal — e.g. a new round.)
  const [winArmed, setWinArmed] = useState(false);
  useEffect(() => {
    if (!terminal) { setWinArmed(false); return; }
    const t = setTimeout(() => setWinArmed(true), 3500);
    return () => clearTimeout(t);
  }, [terminal]);

  // Save leave-chances so they survive a reload / back-to-room on the SAME game;
  // clear them only when the game is actually over (a brand-new game starts at 3).
  useEffect(() => {
    try {
      if (terminal) localStorage.removeItem(missesKey);
      else localStorage.setItem(missesKey, JSON.stringify(misses));
    } catch { /* ignore */ }
  }, [misses, terminal, missesKey]);

  // Note: networked sync (moves, spectators, force-end, winner recording) is
  // handled by ChessNetBoard's useNetGame — this Board just renders + plays.
  const requestQuit = (kind: "leave" | "new") => (terminal ? onQuit() : setConfirm(kind));
  const isHumanTurn = humans.includes(state.turn) && !terminal;

  const moveCount = state.board.length; // stable; real key is turn + misses below
  // The clock only runs on the device whose turn it is (so you're never charged
  // for the opponent's thinking). After MAX missed turns, that side forfeits —
  // pushed into the SHARED state so both players see the result.
  useEffect(() => {
    if (terminal || !isHumanTurn) return;
    setTimeLeft(TURN_SECONDS);
    const iv = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(iv);
          setMisses((m) => {
            const side = state.turn;
            const used = (m[side] ?? 0) + 1;
            if (used >= MAX_MISSES) setState((s) => (s ? { ...s, forfeitedBy: side } : s));
            return { ...m, [side]: used };
          });
          return TURN_SECONDS;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
    // re-key on whose turn it is, miss counts, and terminal state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.turn, misses.w, misses.b, terminal, moveCount, isHumanTurn, TURN_SECONDS]);

  // Legal moves grouped by destination for the selected piece.
  const targets = useMemo(() => {
    if (!selected || !isHumanTurn) return new Map<string, Move[]>();
    const map = new Map<string, Move[]>();
    for (const m of legalMoves(state, state.turn)) {
      if (m.from.r === selected.r && m.from.c === selected.c) {
        const k = key(m.to.r, m.to.c);
        (map.get(k) ?? map.set(k, []).get(k)!).push(m);
      }
    }
    return map;
  }, [selected, isHumanTurn, state]);

  const clickSquare = useCallback(
    (r: number, c: number) => {
      if (!isHumanTurn) return;
      const k = key(r, c);
      if (selected && targets.has(k)) {
        const moves = targets.get(k)!;
        if (moves.length > 1) {
          setPromo(moves); // promotion — ask which piece
          return;
        }
        setState((s) => (s ? play(s, moves[0]) : s));
        // Chances are cumulative — playing a move no longer refills them.
        setSelected(null);
        return;
      }
      const p = state.board[r][c];
      if (p && p.color === state.turn) setSelected({ r, c });
      else setSelected(null);
    },
    [isHumanTurn, selected, targets, state, setState],
  );

  const choosePromo = (m: Move) => {
    setState((s) => (s ? play(s, m) : s));
    // Chances are cumulative — playing a move no longer refills them.
    setPromo(null);
    setSelected(null);
  };

  const captured = useMemo(() => countCaptured(state.board), [state.board]);
  const checkedKing = useMemo(() => {
    if (state.status !== "check" && state.status !== "checkmate") return null;
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const p = state.board[r][c];
        if (p && p.type === "k" && p.color === state.turn) return { r, c };
      }
    return null;
  }, [state]);

  const sideLabel = (s: Color) => `${names[s]} (${s === "w" ? "White" : "Black"})`;
  const statusText = forfeitWinner
    ? `${sideLabel(state.turn)} ran out of chances — ${names[forfeitWinner]} wins!`
    : terminal
      ? state.status === "checkmate"
        ? `Checkmate — ${state.winner ? names[state.winner] : ""} wins!`
        : state.status === "stalemate"
          ? "Stalemate — it's a draw"
          : "Draw"
      : `${sideLabel(state.turn)} to move${state.status === "check" ? " — check!" : ""}`;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Who joined / who left — flash message, same as the other games. */}
      <RoomJoinLeaveFeed roomId={roomId} variant="flash" />
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => requestQuit("leave")} className="inline-flex items-center gap-2 text-sm text-mist-300 hover:text-mist-100">
            <ArrowLeft className="size-4" /> Leave game
          </button>
          {/* HOST / CO-HOST / ADMIN — end the match for BOTH players. Ludo has
              had this; chess had only "Leave", so a stalled match could not be
              closed for everyone at once. */}
          {canEndGame && !terminal && (
            <button
              onClick={() => setConfirm("end")}
              title="End this match for both players"
              className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/85 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-rose-500"
            >
              <Ban className="size-3.5" /> End game
            </button>
          )}
        </div>
        {ui.showCapturedTray && <CapturedTray pieces={captured.b} color="b" />}
      </div>

      {/* Game over: an ALWAYS-VISIBLE bar so you can always return to the room or
          replay (independent of the popup, which can be closed). */}
      {terminal && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-gold-400/40 bg-gradient-to-r from-gold-500/25 to-emerald-500/15 px-3 py-2">
          <Trophy className="size-5 shrink-0 text-gold-300" />
          <span className="min-w-0 flex-1 truncate text-sm font-bold text-white">
            {winnerColor ? `${names[winnerColor]} (${winnerColor === "w" ? "White" : "Black"}) wins! 🎉` : statusText}
          </span>
          {onBackToRoom && (
            <button
              onClick={() => winArmed && onBackToRoom()}
              disabled={!winArmed}
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/25",
                !winArmed && "pointer-events-none opacity-50",
              )}
            >
              🏠 Room
            </button>
          )}
          <button
            onClick={() => { if (!winArmed) return; setMisses({ w: 0, b: 0 }); setShowOver(false); if (onPlayAgain) onPlayAgain(); else setState(initialState()); }}
            disabled={!winArmed}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full bg-lotus-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-lotus-400",
              !winArmed && "pointer-events-none opacity-50",
            )}
          >
            <RotateCcw className="size-3.5" /> Play Again
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="mx-auto w-full max-w-[520px]">
          <div className={cn(
            "relative overflow-hidden rounded-2xl shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]",
            ui.boardBorder && "border border-white/10",
          )}>
            {/* Admin board picture — sits under the squares, which go translucent
                so the artwork reads through (same idea as the Ludo custom board). */}
            {ui.boardImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={withBase(ui.boardImage)} alt="" draggable={false}
                className="pointer-events-none absolute inset-0 z-0 size-full select-none"
                style={{
                  opacity: ui.boardImageOpacity,
                  objectFit: ui.boardImageFit,
                  objectPosition: "center",
                  transform: `translate(${ui.boardImageOffsetX}%, ${ui.boardImageOffsetY}%) scale(${ui.boardImageScale})`,
                }}
              />
            )}
            {/* Lotus watermark in the centre of the board */}
            {ui.showWatermark && (
              <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
                <LotusMark className="size-1/4 opacity-25 drop-shadow" />
              </div>
            )}
            <div className="relative z-[1] grid grid-cols-8">
              {rowOrder.map((r) =>
                colOrder.map((c) => {
                  const piece = state.board[r][c];
                  const k = key(r, c);
                  const light = (r + c) % 2 === 0;
                  const isSel = selected?.r === r && selected?.c === c;
                  const isTarget = targets.has(k);
                  const isCapture = isTarget && !!state.board[r][c];
                  const isLast =
                    ui.showLastMove && state.lastMove &&
                    ((state.lastMove.from.r === r && state.lastMove.from.c === c) ||
                      (state.lastMove.to.r === r && state.lastMove.to.c === c));
                  const inCheck = ui.showCheckHighlight && checkedKing?.r === r && checkedKing?.c === c;
                  // Coordinates sit on the outer edge of the board as the PLAYER
                  // sees it, so they stay correct when the board is flipped.
                  const edgeFile = flipped ? c === 7 : c === 0;
                  const edgeRank = flipped ? r === 0 : r === 7;
                  const img = piece ? pieceImage(ui, piece.color, piece.type) : "";
                  const txt = piece ? pieceTextStyle(piece.color, ui.pieceStyle) : null;
                  return (
                    <button
                      key={k}
                      onClick={() => clickSquare(r, c)}
                      aria-label={`${squareName(r, c)}${piece ? ` — ${piece.color === "w" ? "white" : "black"} ${piece.type}` : ""}`}
                      style={{ backgroundColor: ui.boardImage ? undefined : (light ? ui.light : ui.dark) }}
                      className={cn(
                        "relative grid aspect-square place-items-center select-none",
                        // Over a board picture the squares stay clear; a faint tint
                        // keeps the checker pattern readable.
                        ui.boardImage && (light ? "bg-white/10" : "bg-black/20"),
                        isSel && "ring-4 ring-inset ring-amber-400",
                        isLast && !isSel && "ring-2 ring-inset ring-amber-300/60",
                        inCheck && "ring-4 ring-inset ring-rose-500",
                        flashSq === k && "animate-pulse",
                      )}
                    >
                      {ui.showCoords && edgeFile && (
                        <span className="absolute left-0.5 top-0.5 text-[9px] font-bold" style={{ color: light ? ui.coordLight : ui.coordDark }}>
                          {8 - r}
                        </span>
                      )}
                      {ui.showCoords && edgeRank && (
                        <span className="absolute bottom-0.5 right-0.5 text-[9px] font-bold" style={{ color: light ? ui.coordLight : ui.coordDark }}>
                          {FILES[c]}
                        </span>
                      )}
                      {piece && (img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={withBase(img)}
                          alt=""
                          draggable={false}
                          className="pointer-events-none select-none object-contain"
                          style={{
                            width: `${72 * ui.pieceScale}%`, height: `${72 * ui.pieceScale}%`,
                            transition: ui.animate ? `transform ${ui.animMs}ms ease-out` : undefined,
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            fontSize: `min(${8.5 * ui.pieceScale}vw, ${2.7 * ui.pieceScale}rem)`,
                            color: txt?.color,
                            textShadow: txt?.textShadow,
                            fontWeight: ui.pieceStyle === "letters" ? 800 : undefined,
                            transition: ui.animate ? `transform ${ui.animMs}ms ease-out, opacity ${ui.animMs}ms ease-out` : undefined,
                          }}
                          className="leading-none"
                        >
                          {glyphFor(ui.pieceStyle, piece.color, piece.type)}
                        </span>
                      ))}
                      {ui.showLegalDots && isTarget && !isCapture && (
                        <span className="absolute size-1/4 rounded-full bg-ink-900/30" />
                      )}
                      {ui.showLegalDots && isCapture && (
                        <span className="absolute inset-1 rounded-full ring-4 ring-inset ring-rose-500/50" />
                      )}
                    </button>
                  );
                }),
              )}
            </div>
          </div>
          {ui.showCapturedTray && (
            <div className="mt-3">
              <CapturedTray pieces={captured.w} color="w" />
            </div>
          )}
        </div>

        {/* Control panel */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-ink-850/60 p-5">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-full text-lg leading-none",
                  state.turn === "w" ? "bg-white text-ink-950" : "bg-ink-950 text-white ring-1 ring-white/20",
                )}
              >
                {glyphFor(ui.pieceStyle === "custom" ? "solid" : ui.pieceStyle, state.turn, "k")}
              </span>
              <p className="text-sm font-semibold text-mist-100">{statusText}</p>
              {!terminal && (
                <span
                  className={cn(
                    "ml-auto grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums",
                    timeLeft <= 5 ? "animate-pulse bg-rose-500/20 text-rose-300" : "bg-ink-700 text-mist-200",
                  )}
                  title="Seconds left this turn"
                >
                  {timeLeft}
                </span>
              )}
            </div>
            {!terminal && (
              <div className="mt-3 space-y-1">
                {(["w", "b"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => openGift([names[s]], names[s], roomId)}
                    title={`Send a gift to ${names[s]}`}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-mist-400 transition hover:bg-amber-400/10",
                      // PLAYER TURN INDICATION — the side to move is clearly lit up.
                      state.turn === s && "bg-emerald-500/10 ring-1 ring-emerald-400/40",
                    )}
                  >
                    <span className={cn("size-2.5 shrink-0 rounded-full", s === "w" ? "bg-white" : "bg-ink-950 ring-1 ring-white/30")} />
                    <span className="truncate font-semibold text-mist-200">{names[s]}</span>
                    <span className="shrink-0 text-mist-500">({s === "w" ? "White" : "Black"})</span>
                    {state.turn === s && (
                      <span className="shrink-0 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-300">
                        {state.status === "check" ? "check!" : "to move"}
                      </span>
                    )}
                    {myColor === s && <span className="shrink-0 text-[9px] font-bold uppercase text-lotus-300">you</span>}
                    {lastGiftFor(names[s]) && <span className="shrink-0 text-sm leading-none" title="Latest gift">{lastGiftFor(names[s])}</span>}
                    <span className="ml-auto flex shrink-0 gap-0.5">
                      {Array.from({ length: MAX_MISSES }).map((_, i) => (
                        <span
                          key={i}
                          className={cn(
                            "size-1.5 rounded-full",
                            i < MAX_MISSES - misses[s] ? "bg-emerald-400" : "bg-mist-600",
                          )}
                        />
                      ))}
                    </span>
                    <GiftIcon className="size-3.5 shrink-0 text-amber-300/70" />
                  </button>
                ))}
              </div>
            )}
            {terminal && (
              <div className="mt-4 rounded-xl bg-gold-500/15 p-3 text-center">
                <Trophy className="mx-auto size-6 text-gold-400" />
                <p className="mt-1 font-display text-base font-bold text-gold-300">{statusText}</p>
              </div>
            )}
          </div>

          {/* MOVE HISTORY — every move of this game in standard notation, newest
              at the bottom. "+" = check, "#" = checkmate. */}
          {ui.showMoveHistory && (
            <div className="rounded-2xl border border-white/10 bg-ink-850/60 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-mist-100">Move history</p>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-mist-400">
                  {history.length} move{history.length === 1 ? "" : "s"}
                </span>
              </div>
              {history.length === 0 ? (
                <p className="py-3 text-center text-xs text-mist-500">No moves yet.</p>
              ) : (
                <div className="max-h-56 overflow-y-auto pr-1">
                  <table className="w-full text-xs tabular-nums">
                    <tbody>
                      {history.map((h) => (
                        <tr key={h.n} className="border-b border-white/5 last:border-0">
                          <td className="w-7 py-1 text-mist-600">{h.n}.</td>
                          <td className="py-1 font-semibold text-mist-100">{h.w ?? "…"}</td>
                          <td className="py-1 font-semibold text-mist-300">{h.b ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <Button block variant="secondary" onClick={() => requestQuit("new")}>
            <RotateCcw className="size-4" /> New game
          </Button>

          <div className="rounded-2xl border border-white/10 bg-ink-850/40 p-4 text-xs leading-relaxed text-mist-400">
            <p className="mb-1 font-semibold text-mist-300">How to play</p>
            Tap one of your pieces, then tap a highlighted square to move. Dots are quiet moves,
            ringed squares are captures. Put the enemy king in checkmate to win.
            {flipped && <span className="mt-1 block text-mist-500">You&apos;re playing Black, so the board is turned to face you.</span>}
          </div>
        </div>
      </div>

      {/* Promotion picker */}
      {promo && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setPromo(null)}>
          <div
            className="rounded-2xl border border-white/10 bg-ink-850 p-5 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-sm font-semibold text-mist-200">Promote pawn to…</p>
            <div className="flex gap-2">
              {promo.map((m) => (
                <button
                  key={m.promotion}
                  onClick={() => choosePromo(m)}
                  className="grid size-16 place-items-center rounded-xl border border-line bg-ink-800 text-4xl text-white transition hover:border-lotus-400 hover:bg-lotus-500/15"
                >
                  {GLYPH[m.promotion!]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          danger
          title={confirm === "end" ? "End this match for everyone?" : confirm === "leave" ? "Leave the game?" : "Start a new game?"}
          message={
            confirm === "end"
              ? "The match will be closed for BOTH players straight away. Nobody wins and no result is recorded."
              : confirm === "leave"
                ? "The match is still in progress. If you leave now, this game will end."
                : "The match is still in progress. Starting a new game will end the current one."
          }
          confirmLabel={confirm === "end" ? "End for everyone" : confirm === "leave" ? "Leave game" : "New game"}
          cancelLabel="Keep playing"
          onConfirm={() => {
            // HOST / CO-HOST / ADMIN force-close: ends the session for both
            // players at once, rather than each having to leave separately.
            if (confirm === "end") {
              setConfirm(null);
              onEndGame?.();
              // Give the close a moment to broadcast so the OTHER player's board
              // shuts down too, then leave.
              setTimeout(() => (onBackToRoom ? onBackToRoom() : onQuit()), 300);
              return;
            }
            const wasLeave = confirm === "leave";
            setConfirm(null);
            // A LEAVE must actually EXIT — return to the voice ROOM, not the setup
            // screen (the "running game" detector would otherwise re-pull the board).
            const exit = () => (wasLeave && onBackToRoom ? onBackToRoom() : onQuit());
            // Leaving a live 2-player game forfeits → the OTHER player wins (the
            // result is broadcast so they see it). Otherwise just exit.
            if (wasLeave && !terminal && humans[0]) {
              setState((s) => (s ? { ...s, forfeitedBy: humans[0] } : s));
              setTimeout(exit, 250); // let the forfeit broadcast first
            } else {
              exit();
            }
          }}
          onCancel={() => setConfirm(null)}
        />
      )}

      {terminal && showOver && (
        <GameOverModal
          winner={winnerColor ? `${names[winnerColor]} (${winnerColor === "w" ? "White" : "Black"})` : "Draw — no winner"}
          rank={winnerColor ? (state.forfeitedBy ? "Wins by forfeit 🥇" : "Checkmate 🥇") : state.status === "stalemate" ? "Stalemate" : "Draw"}
          onPlayAgain={() => { setMisses({ w: 0, b: 0 }); setShowOver(false); if (onPlayAgain) onPlayAgain(); else setState(initialState()); }}
          onStay={() => setShowOver(false)}
          onBackToRoom={onBackToRoom}
        />
      )}
    </div>
  );
}

function CapturedTray({ pieces, color }: { pieces: PieceType[]; color: Color }) {
  if (pieces.length === 0) return <div className="h-6" />;
  return (
    <div className="flex h-6 items-center gap-0.5">
      {pieces.map((t, i) => (
        <span
          key={i}
          className={cn("text-lg leading-none", color === "w" ? "text-white/80" : "text-mist-400")}
        >
          {GLYPH[t]}
        </span>
      ))}
    </div>
  );
}

// Captured = starting set minus what remains, per color.
function countCaptured(board: (ChessState["board"][number][number])[][]): { w: PieceType[]; b: PieceType[] } {
  const start: Record<PieceType, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };
  const live: Record<Color, Record<PieceType, number>> = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
  };
  for (const row of board) for (const p of row) if (p) live[p.color][p.type]++;
  const build = (color: Color): PieceType[] => {
    const out: PieceType[] = [];
    (["q", "r", "b", "n", "p"] as PieceType[]).forEach((t) => {
      for (let i = 0; i < start[t] - live[color][t]; i++) out.push(t);
    });
    return out;
  };
  return { w: build("w"), b: build("b") };
}
