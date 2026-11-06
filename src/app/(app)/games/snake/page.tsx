"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Dices, RotateCcw, Trophy, Check, Mic, MicOff, Volume2, VolumeX, Settings, Crown, Coins, Heart, Ban, Eye } from "lucide-react";
import { Die } from "@/components/Die";
import { activeDiceModel } from "@/lib/dice-model";
import { LotusMark } from "@/components/Logo";
import { BrandImg } from "@/components/BrandImg";
import { useVoice } from "@/lib/VoiceProvider";
import { useUserProfiles } from "@/lib/useUserProfiles";
import { LudoToken } from "@/components/LudoToken";
import { useCosmetics } from "@/lib/cosmetics";
import { customTokenImage } from "@/lib/tokenDesigns";
import { GameChatBar } from "@/components/GameChatBar";
import { GroupRequired, GroupBanner, useGroupParam } from "@/components/GroupGate";
import { GameInvites } from "@/components/GameInvites";
import { useLobby, LobbyStart, LobbyModeChoice, LobbyAuto, LobbyStarting } from "@/components/GameLobby";
import { lobbyDo, type LobbySeatView, type LobbyView } from "@/lib/game-lobby";
import { gameTurnSeconds, gameDiceSpeed, gameTokenSpeed } from "@/lib/game-config";
import { useGift, GiftBurst, RoomGiftListener } from "@/components/GiftProvider";
import { RoomZoneOverlay } from "@/components/RoomOverlays";
import { CustomUploads } from "@/components/CustomUploads";
import { RoomJoinLeaveFeed } from "@/components/RoomJoinLeaveFeed";
import { GameAd } from "@/components/GameAd";
import { useConfig } from "@/lib/config";
import { turnAnimClass, turnAnimActive } from "@/lib/turn-anim";
import { diceAnimClass } from "@/lib/dice-anim";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/cn";
import { ME, fetchRoom } from "@/lib/rooms";
import { withBase } from "@/lib/base-path";
import { useRouter } from "next/navigation";
import { useRoomMembers, type RoomMember } from "@/lib/useRoomMembers";
import { useAuth } from "@/lib/auth";
import { GameOverModal } from "@/components/GameOverModal";
import { useBackGuard } from "@/lib/use-back-guard";
import { useToast } from "@/components/ui/Toast";
import { useNetGame, type Seats } from "@/lib/use-net-game";
import { useGameActiveFlag } from "@/lib/use-game-active";
import { lifelog } from "@/lib/lifelog";
import { playDiceRoll, playPop, playWin, playLose, configureSounds } from "@/lib/sound";
import {
  applyRoll,
  applyMoveSL,
  canMoveSL,
  createSL,
  currentPlayer,
  forfeitSL,
  leaveSL,
  applyLeftSeatsSL,
  missSL,
  chancesLeftSL,
  MAX_MISSES_SL,
  TURN_SECONDS_SL,
  SL_COLORS,
  squareToRC,
  type Color,
  type SLState,
} from "@/lib/snakeladder";

// Where the playable 10x10 grid sits inside the board picture, as percentages
// of the image. The default covers the whole image (the original behaviour);
// a board with a painted frame needs the grid inset to match its squares.
export interface SnakeGrid { topPct: number; leftPct: number; widthPct: number; heightPct: number }
const FULL_GRID: SnakeGrid = { topPct: 0, leftPct: 0, widthPct: 100, heightPct: 100 };

// Board square (1..100) → center point in a 0..100 percentage space.
// Row 0 is the BOTTOM row, so the on-screen row is flipped.
//
// THE COIN-ALIGNMENT FIX: this used to hard-code the grid as the FULL image
// (col+0.5)*10, which is only correct for a borderless board. Every custom
// board has a decorative frame, so the coins sat off their squares — that is
// the "if the board changes, the coins don't work" report. The square is now
// mapped into the admin-set playable rectangle instead.
function slCenter(sq: number, grid: SnakeGrid = FULL_GRID): { x: number; y: number } {
  const { row, col } = squareToRC(sq);
  const topRow = 9 - row;
  const cellW = grid.widthPct / 10;
  const cellH = grid.heightPct / 10;
  return {
    x: grid.leftPct + (col + 0.5) * cellW,
    y: grid.topPct + (topRow + 0.5) * cellH,
  };
}

const DOT: Record<Color, string> = {
  red: "bg-rose-500",
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  blue: "bg-sky-500",
};
const LABEL: Record<Color, string> = { red: "Red", green: "Green", yellow: "Yellow", blue: "Blue" };
const DIE_COLOR: Record<Color, "red" | "green" | "yellow" | "blue"> = {
  red: "red",
  green: "green",
  yellow: "yellow",
  blue: "blue",
};

// 3D bead tokens — a bright top and a darker base for a glossy game piece.
const TOKEN_HEX: Record<Color, string> = { red: "#f43f5e", green: "#10b981", yellow: "#f59e0b", blue: "#0ea5e9" };
const TOKEN_DARK: Record<Color, string> = { red: "#9f1239", green: "#065f46", yellow: "#b45309", blue: "#075985" };

export default function SnakeLadderPage() {
  const group = useGroupParam();
  const { user } = useAuth();
  const { toast } = useToast();
  const myName = user?.fullName?.split(" ")[0] || ME.fullName.split(" ")[0];
  const members = useRoomMembers(group?.room);
  const myId = user?.id ?? "";
  const [starting, setStarting] = useState<{ game: SLState; seats: Seats; names: Record<string, string> } | null>(null);
  const [hasRunning, setHasRunning] = useState(false);
  // A Snake game is running here that I'm NOT part of → show a "game in progress"
  // screen instead of the host Setup (so I can't clobber the live session).
  const [otherRunning, setOtherRunning] = useState(false);
  const [joinMode, setJoinMode] = useState(false);
  useEffect(() => { setJoinMode(new URLSearchParams(window.location.search).get("join") === "1"); }, []);
  // Keep the board mounted through the end-of-game results popup (the "running
  // game" detector flips hasRunning off when a game finishes, which otherwise
  // rips the board + winner popup away). Cleared only on leave / admin-end.
  const [inGame, setInGame] = useState(false);
  const [count, setCount] = useState(2);
  // People who ACCEPTED (id + first name); null until everyone accepts. Robust
  // to the live member list re-ordering between invite and start.
  const [ready, setReady] = useState<{ id: string; name: string }[] | null>(null);
  // Invited members tracked by STABLE member id (not array index) so a presence
  // poll re-ordering `members` can't silently change WHO is invited.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const manualEditRef = useRef(false); // set once the host hand-picks invitees
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
  const { lobby, reload: reloadLobby } = useLobby(group?.room, "snake", lobbyEnabled);
  const [lobbyBusy, setLobbyBusy] = useState(false);
  const [startingLobby, setStartingLobby] = useState<LobbyView | null>(null);
  const lobbyBuiltRef = useRef(false);
  useEffect(() => { if (lobby?.status === "starting") setStartingLobby(lobby); }, [lobby]);
  const doLobby = useCallback(async (action: string, extra?: { color?: string; targetId?: string; mode?: string }) => {
    if (!group?.room) return;
    setLobbyBusy(true);
    const res = await lobbyDo(group.room, "snake", action, extra ?? {});
    setLobbyBusy(false);
    if (!res.ok && res.error) toast(res.error, "error");
    reloadLobby();
  }, [group?.room, reloadLobby, toast]);
  const startFromLobby = useCallback((seats: LobbySeatView[]) => {
    const filled = seats.filter((s) => s.id);
    if (filled.length < 2) return;
    const seatMap: Seats = {};
    const colors: Color[] = [];
    for (const s of filled) { seatMap[s.color as Color] = { id: s.id!, name: s.name ?? "Player" }; colors.push(s.color as Color); }
    const nm = {} as Record<string, string>;
    colors.forEach((c) => { nm[c] = seatMap[c]?.name ?? "—"; });
    setStarting({ game: createSL(colors), seats: seatMap, names: nm });
  }, []);
  useEffect(() => {
    if (!lobby || lobby.status !== "starting") { lobbyBuiltRef.current = false; return; }
    if (lobby.builderId !== myId || (lobby.startingIn ?? 0) > 0 || lobbyBuiltRef.current) return;
    lobbyBuiltRef.current = true;
    startFromLobby(lobby.seats);
    if (group?.room) lobbyDo(group.room, "snake", "started");
  }, [lobby, myId, startFromLobby, group?.room]);

  // Detect a running Snake game so invited players auto-join the live board.
  useEffect(() => {
    if (!group?.room) return;
    let on = true;
    const check = async () => {
      try {
        const res = await fetch(withBase(`/api/games/active?room=${encodeURIComponent(group.room)}`), { credentials: "include" });
        const d = await res.json();
        const sess = (d.sessions ?? []).find((s: { game?: string }) => (s.game || "").toLowerCase().includes("snake")) as { playerIds?: string[] } | undefined;
        // Only auto-drop THIS user onto the shared board if they're actually a seated
        // participant — otherwise an uninvited room member gets pulled into someone
        // else's 2/3-player match. Legacy sessions (no playerIds) keep old behaviour.
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

  const needed = count - 1;
  // Indices into the LIVE members array, derived from the stable ids — keeps the
  // Setup highlight / buildNames / invite list working unchanged.
  const selected = useMemo(
    () => selectedIds.map((id) => members.findIndex((m) => m.id === id)).filter((i) => i >= 0),
    [selectedIds, members],
  );
  const names = useMemo(() => buildNames(selected, myName, members), [selected, myName, members]);

  // Players are capped by who's actually in the voice room (host + seated).
  const maxPlayers = Math.min(4, members.length + 1);
  useEffect(() => {
    setCount((c) => Math.min(Math.max(2, c), Math.max(2, maxPlayers)));
  }, [maxPlayers]);
  // Keep the invited set valid as presence changes WITHOUT clobbering the host's
  // explicit choice: default = first `needed` members; once hand-picked, preserve
  // their picks and only drop anyone who left the room. No-op when nothing changed.
  useEffect(() => {
    setSelectedIds((prev) => {
      const ids = members.map((m) => m.id);
      const next = manualEditRef.current
        ? prev.filter((id) => ids.includes(id)).slice(0, needed)
        : ids.slice(0, needed);
      return next.length === prev.length && next.every((id, k) => id === prev[k]) ? prev : next;
    });
  }, [members, needed]);

  const changeCount = (n: number) => {
    setCount(n);
    setReady(null);
    manualEditRef.current = false; // a new count re-applies the default fill
  };
  const toggleMember = (i: number) => {
    setReady(null);
    manualEditRef.current = true; // the host is hand-picking — stop auto-fill overriding
    const m = members[i];
    if (!m) return;
    const id = m.id;
    if (!selectedIds.includes(id)) toast(`${m.name.split(" ")[0]} selected`, "success"); // "Ahmed selected"
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= needed) return [...prev.slice(1), id];
      return [...prev, id];
    });
  };

  const start = () => {
    const colors = SL_COLORS.slice(0, count);
    const seats: Seats = { [colors[0]]: { id: myId || "me", name: myName } };
    // Seat the people who actually ACCEPTED (id-based → never the wrong person).
    (ready ?? []).forEach((m, i) => {
      const c = colors[i + 1];
      if (c && m) seats[c] = { id: m.id, name: m.name };
    });
    const namesMap = {} as Record<string, string>;
    colors.forEach((c) => { namesMap[c] = seats[c]?.name ?? "—"; });
    setStarting({ game: createSL(colors), seats, names: namesMap });
  };

  if (group === undefined) return null;
  if (group === null) return <GroupRequired />;

  if (starting || hasRunning || joinMode || inGame) {
    return (
      <>
        <GroupBanner name={group.name} roomId={group.room} />
        <NetBoard roomId={group.room} roomName={group.name} myId={myId} initial={starting ?? undefined} canEndGame={canControlRoom} onQuit={() => { setStarting(null); setHasRunning(false); setJoinMode(false); setInGame(false); setStartingLobby(null); lobbyBuiltRef.current = false; }} />
      </>
    );
  }

  // A game I'm not part of is already running here — don't hijack it or start a
  // conflicting one; send me to the room to Watch or Rejoin.
  if (otherRunning) {
    return (
      <>
        <GroupBanner name={group.name} roomId={group.room} />
        <div className="mx-auto max-w-md">
          <div className="rounded-2xl border border-white/8 bg-ink-850 p-8 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-lg bg-petal-500/12 text-petal-400"><Dices className="size-7" /></span>
            <h1 className="mt-4 font-display text-xl font-extrabold text-mist-100">A game is already in progress</h1>
            <p className="mt-2 text-sm text-mist-300">Another Snake &amp; Ladder game is being played in this room right now. Head back to the room to <span className="font-semibold text-mist-100">Watch</span> or <span className="font-semibold text-mist-100">Rejoin</span> it — or wait for it to finish to start a new one.</p>
            <Link href={withBase(`/rooms/${group.room}`)} className="mt-5 inline-block"><Button variant="secondary"><ArrowLeft className="size-4" /> Back to room</Button></Link>
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
            <span className="mx-auto grid size-14 place-items-center rounded-lg bg-amber-500/12 text-amber-300"><Dices className="size-7" /></span>
            <h1 className="mt-4 font-display text-xl font-extrabold text-mist-100">Take a seat to play</h1>
            <p className="mt-2 text-sm text-mist-300">You&apos;re currently a <span className="font-semibold text-mist-100">listener</span> in this room. Only members sitting on a <span className="font-semibold text-mist-100">voice seat</span> can start or join a game. Tap an empty seat in the room, then come back.</p>
            <Link href={withBase(`/rooms/${group.room}`)} className="mt-5 inline-block"><Button variant="secondary"><ArrowLeft className="size-4" /> Back to room</Button></Link>
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
      <Setup count={count} setCount={changeCount} names={names} members={members} selected={selected} needed={needed} onToggleMember={toggleMember} invited={!!ready} onReady={setReady} onStart={start} coHostIds={coHostIds} roomName={group.name} roomId={group.room} />
    </>
  );
}

// Shared, turn-gated multiplayer board for Snake & Ladder.
function NetBoard({
  roomId, roomName, myId, initial, onQuit, canEndGame,
}: {
  roomId: string;
  roomName: string;
  myId: string;
  initial?: { game: SLState; seats: Seats; names: Record<string, string> };
  onQuit: () => void;
  canEndGame?: boolean; // Host / Co-Host / admin → may force-end the match for everyone
}) {
  useGameActiveFlag(); // defer app auto-update reloads while this board is mounted
  const { toast } = useToast();
  const router = useRouter();
  const net = useNetGame<SLState>({ roomId, roomName, kind: "snake", myId, initial, currentSeatKey: (g) => currentPlayer(g), mergeIncoming: applyLeftSeatsSL });
  const myColor = (net.mySeatKey as Color | null) ?? null;
  const names = net.names as Record<Color, string>;

  const endedRef = useRef(false);
  useEffect(() => {
    const w = net.game?.winner;
    if (w && !endedRef.current) { endedRef.current = true; net.end(names[w] ?? String(w)); }
    else if (!w && endedRef.current) { endedRef.current = false; }
  }, [net, names]);

  // #11 — Auto-forfeit on seat-loss (same as Ludo): a player KICKED, who LEAVES
  // the room, or is demoted to listener DURING the match is removed via the SAME
  // server-authoritative path as the manual Leave button (net.leave), crowning the
  // remaining player in a 2-player game. Keyed on persisted room-SEAT membership,
  // NOT live voice presence — a refresh never forfeits. 2-strike debounce + skip on
  // a failed room fetch guard against transient blips.
  const ffGameRef = useRef(net.game); ffGameRef.current = net.game;
  const ffSeatsRef = useRef(net.seats); ffSeatsRef.current = net.seats;
  const ffLeaveRef = useRef(net.leave); ffLeaveRef.current = net.leave;
  const ffStrikeRef = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!roomId) return; // networked room games only
    let on = true;
    const t = setInterval(async () => {
      const g = ffGameRef.current;
      if (!g || g.winner) return;
      const live = g.players.filter((c) => !(g.left ?? []).includes(c));
      if (live.length <= 1) return;
      const r = await fetchRoom(roomId);
      if (!on || !r) return;
      const seated = (uid: string) => {
        if ((r.removedMemberIds ?? []).includes(uid) || (r.blockedMemberIds ?? []).includes(uid)) return false;
        return r.host?.id === uid || r.ownerId === uid || (r.coAdminIds ?? []).includes(uid) ||
          ((r.stageApprovedIds ?? []).includes(uid) && !(r.audienceIds ?? []).includes(uid));
      };
      for (const c of live) {
        const uid = ffSeatsRef.current[c]?.id;
        if (!uid) { ffStrikeRef.current[c] = 0; continue; }
        if (seated(uid)) { ffStrikeRef.current[c] = 0; continue; }
        ffStrikeRef.current[c] = (ffStrikeRef.current[c] ?? 0) + 1;
        if (ffStrikeRef.current[c] >= 2) ffLeaveRef.current(c);
      }
    }, 4000);
    return () => { on = false; clearInterval(t); };
  }, [roomId]);
  // Force-ended (Host/Co-Host "End Game" or admin) → EVERY client leaves the board.
  // Fires on status 'ended' regardless of a winner (a normal win is 'completed'), so
  // it also stops a finished/looping match the host chose to end.
  useEffect(() => {
    if (net.status === "ended") { toast("This match has ended.", "info"); onQuit(); }
  }, [net.status, onQuit, toast]);

  const playAgain = useCallback(() => {
    const g = net.game;
    if (g) { endedRef.current = false; net.restart(createSL(g.players)); }
  }, [net]);
  const backToRoom = useCallback(() => { lifelog("nav:backToRoom"); router.push(withBase(`/rooms/${roomId}`)); }, [router, roomId]);

  const setGame = useCallback<React.Dispatch<React.SetStateAction<SLState | null>>>((updater) => {
    const cur = net.game;
    if (cur == null) return;
    const next = typeof updater === "function" ? (updater as (g: SLState | null) => SLState | null)(cur) : updater;
    if (next) net.push(next);
  }, [net]);

  if (net.startError) {
    return (
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-amber-400/20 bg-ink-850 p-8 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-lg bg-amber-500/12 text-amber-300"><Coins className="size-7" /></span>
          <h1 className="mt-4 font-display text-xl font-extrabold text-mist-100">Couldn&apos;t start the game</h1>
          <p className="mt-2 text-sm text-mist-300">{net.startError}</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="secondary" onClick={onQuit}><ArrowLeft className="size-4" /> Back</Button>
            <Link href="/wallet"><Button>Add coins</Button></Link>
          </div>
        </div>
      </div>
    );
  }
  if (!net.ready || !net.game) {
    return (
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-white/8 bg-ink-850 p-8 text-center">
          <span className="mx-auto grid size-14 animate-pulse place-items-center rounded-lg bg-petal-500/12 text-petal-400"><Dices className="size-7" /></span>
          <h1 className="mt-4 font-display text-xl font-extrabold text-mist-100">Joining the game…</h1>
          <p className="mt-2 text-sm text-mist-400">Waiting for the host to start the board. You&apos;ll drop in automatically.</p>
          <Button variant="secondary" className="mt-5" onClick={onQuit}><ArrowLeft className="size-4" /> Back</Button>
        </div>
      </div>
    );
  }

  return <Board game={net.game} setGame={setGame} names={names} onQuit={onQuit} onPlayAgain={playAgain} onBackToRoom={backToRoom} onLeaveSeat={net.leave} myColor={myColor} seats={net.seats} myId={myId} roomId={roomId} roomName={roomName} canEndGame={canEndGame} onEndGame={() => net.endForEveryone()} spectators={net.spectators} spectatorNames={net.spectatorNames} syncAgeMs={net.syncAgeMs} lastServerMoveAt={net.lastServerMoveAt} />;
}

function buildNames(selected: number[], myName: string, members: RoomMember[]): Record<Color, string> {
  const pick = (i: number) => members[selected[i]]?.name.split(" ")[0] ?? "Open seat";
  return {
    red: myName, // You always lead in red
    green: pick(0),
    yellow: pick(1),
    blue: pick(2),
  };
}

function Setup({
  count,
  setCount,
  names,
  members,
  selected,
  needed,
  onToggleMember,
  invited,
  onReady,
  onStart,
  coHostIds,
  roomName,
  roomId,
}: {
  count: number;
  setCount: (n: number) => void;
  names: Record<Color, string>;
  members: RoomMember[];
  selected: number[];
  needed: number;
  onToggleMember: (i: number) => void;
  invited: boolean;
  onReady: (accepted: { id: string; name: string }[] | null) => void;
  onStart: () => void;
  coHostIds: string[];
  roomName: string;
  roomId: string;
}) {
  const colors = SL_COLORS.slice(0, count);
  const maxPlayers = Math.min(4, members.length + 1);
  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-xl border border-white/8 bg-ink-850 p-6 sm:p-9">
        <span className="mx-auto grid size-14 place-items-center rounded-lg bg-emerald-500/12 text-emerald-300">
          🐍
        </span>
        <h1 className="mt-5 text-center font-display text-2xl font-extrabold text-mist-100 sm:text-3xl">
          Snake &amp; Ladder
        </h1>
        <p className="mt-2 text-center text-sm text-mist-300">
          Roll a <strong className="text-white">1</strong> to bring a coin onto the board, then
          <strong className="text-white"> tap your coin</strong> to move it. Climb the ladders, dodge
          the snakes — roll a 6 for an extra turn. First to land exactly on 100 wins!
        </p>

        <div className="mt-7">
          <p className="mb-2 text-sm font-semibold text-mist-200">How many players?</p>
          <div className="grid grid-cols-3 gap-2">
            {[2, 3, 4].map((n) => {
              const disabled = n > maxPlayers;
              return (
                <button
                  key={n}
                  onClick={() => !disabled && setCount(n)}
                  disabled={disabled}
                  title={disabled ? "Not enough people in the voice room" : undefined}
                  className={cn(
                    "h-11 rounded-xl border text-sm font-semibold transition",
                    count === n
                      ? "border-lotus-400 bg-lotus-500/20 text-white"
                      : "border-line bg-ink-800 text-mist-300 hover:border-lotus-400/40",
                    disabled && "cursor-not-allowed opacity-30 hover:border-line",
                  )}
                >
                  {n}
                </button>
              );
            })}
          </div>
          {maxPlayers < 4 && (
            <p className="mt-2 text-xs text-mist-500">
              More player slots unlock as more people join this room&apos;s voice.
            </p>
          )}
        </div>

        <div className="mt-5 space-y-1.5">
          {colors.map((c, i) => (
            <div key={c} className="flex items-center gap-2.5 rounded-lg border border-line bg-ink-800 px-3 py-2">
              <span className={cn("size-4 rounded-full", DOT[c])} />
              <span className="text-sm font-semibold text-mist-100">{names[c]}</span>
              {i === 0 ? (
                <span className="text-xs text-lotus-300">(You)</span>
              ) : (
                invited && (
                  <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                    Joined
                  </span>
                )
              )}
              <span className="ml-auto text-xs text-mist-400">{LABEL[c]}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-mist-400">
          Members aren&apos;t added automatically — they join when invited.
        </p>

        {/* Invite group members from the room */}
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-mist-200">
            Invite a group member{" "}
            <span className="font-normal text-mist-400">
              ({selected.length}/{needed})
            </span>
          </p>
          {members.length === 0 ? (
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/[0.08] px-3 py-4 text-center text-xs text-amber-200">
              No one else is in the voice room yet. People must <strong className="text-amber-100">join this room&apos;s voice</strong> before they can be invited to the game.
            </div>
          ) : (
            <div className="grid max-h-44 grid-cols-1 gap-1.5 overflow-y-auto">
              {members.map((m, i) => {
                const sel = selected.includes(i);
                return (
                  <button
                    key={m.id}
                    onClick={() => onToggleMember(i)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition",
                      sel ? "border-lotus-400 bg-lotus-500/15" : "border-line bg-ink-800 hover:border-lotus-400/40",
                    )}
                  >
                    <Avatar name={m.name} src={m.avatar} size="xs" />
                    <span className="text-sm text-mist-100">
                      {m.name}
                      {m.publicId && <span className="ml-1.5 font-mono text-[11px] text-mist-500">ID {m.publicId}</span>}
                    </span>
                    {sel ? (
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-lotus-500/20 px-2 py-0.5 text-[11px] font-bold text-lotus-200">
                        <Check className="size-3.5" /> Selected
                      </span>
                    ) : (
                      <span className="ml-auto text-[11px] text-mist-500">Tap to invite</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {members.length === 0 || selected.length < needed ? (
          <Button block size="lg" className="mt-5" disabled>
            {members.length === 0
              ? "Waiting for members to join the voice room"
              : selected.length === 0
                ? "Select a player to invite"
                : `Pick ${needed - selected.length} more member${needed - selected.length > 1 ? "s" : ""}`}
          </Button>
        ) : (
          <GameInvites
            // Reset the invite round when the host changes the player count, so a
            // count changed after sending never keeps tracking the old invitee set.
            key={`snake-invites-${count}`}
            invitees={selected.map((i) => ({
              id: members[i]?.id ?? `idx-${i}`,
              name: members[i]?.name.split(" ")[0] ?? "Player",
            }))}
            coHostIds={coHostIds}
            gameName="Snake & Ladder"
            hostName={names.red}
            roomName={roomName}
            roomId={roomId}
            onReady={onReady}
          />
        )}
        <Button block size="lg" className="mt-3" disabled={!invited} onClick={onStart}>
          <Dices className="size-5" /> Start Game
        </Button>
        {!invited && (
          <p className="mt-2 text-center text-[11px] text-mist-500">
            Everyone must accept before the game can start.
          </p>
        )}
      </div>
    </div>
  );
}

function Board({
  game,
  setGame,
  names,
  onQuit,
  onPlayAgain,
  onBackToRoom,
  onLeaveSeat,
  myColor,
  seats = {},
  myId = "",
  roomId = "",
  roomName = "",
  canEndGame = false,
  onEndGame,
  spectators = 0,
  spectatorNames = [],
  syncAgeMs,
  lastServerMoveAt,
}: {
  game: SLState;
  setGame: React.Dispatch<React.SetStateAction<SLState | null>>;
  names: Record<Color, string>;
  onQuit: () => void;
  onPlayAgain?: () => void;
  onBackToRoom?: () => void;
  onLeaveSeat?: (seatKey: string) => void;
  myColor: Color | null;
  seats?: Seats;
  myId?: string;
  roomId?: string;
  roomName?: string;
  canEndGame?: boolean;    // Host / Co-Host / admin may end the match for everyone
  onEndGame?: () => void;  // force-close the session for all players
  spectators?: number;
  spectatorNames?: string[];
  syncAgeMs?: () => number;          // ms since this device last heard from the server
  lastServerMoveAt?: () => number;   // when the SERVER last saw anyone move (epoch ms)
}) {
  const [rolling, setRolling] = useState(false);
  const [rollFace, setRollFace] = useState(1); // LOCAL dice tumble (not broadcast)
  // While true the dice HOLDS the rolled number on screen (like Ludo) so it's
  // always seen before anything happens — the coin never moves before the value
  // is confirmed. Cleared when the value is applied / the player moves.
  const [showResult, setShowResult] = useState(false);
  const [confirm, setConfirm] = useState<null | "leave" | "new" | "end">(null);
  // Results screen: "Stay on Results Screen" dismisses the winner popup without
  // leaving; each player chooses Back to Room / Play Again on their own.
  const [resultDismissed, setResultDismissed] = useState(false);
  // Latched winner — the results popup is driven off this, not the live state, so
  // a late network update (or a stray tap) can never hide it. See the effect below.
  const [shownWinner, setShownWinner] = useState<Color | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const { openGift, lastGiftFor } = useGift(); // tap a player to gift them
  const voice = useVoice();
  const seatIds = useMemo(() => game.players.map((c) => seats[c]?.id).filter(Boolean) as string[], [game.players, seats]);
  const profiles = useUserProfiles(seatIds);
  const voiceById = useMemo(() => new Map(voice.participants.map((p) => [p.id, p])), [voice.participants]);

  // Gift recipients = everyone ELSE in the room (gift any member, not just one).
  const giftRecipients = useMemo(() => {
    const set = new Set<string>();
    voice.participants.forEach((p) => { if (!p.isLocal && p.name) set.add(p.name); });
    if (set.size === 0) {
      game.players.forEach((p) => { if (p !== myColor && names[p] && names[p] !== "—") set.add(names[p]); });
    }
    return [...set];
  }, [voice.participants, game.players, names, myColor]);
  // Session sync handled by the parent NetBoard (turn-gated multiplayer).
  // Winner is LATCHED when the game ends and held until a genuinely NEW round
  // starts: no winner AND nobody left AND everyone back to square 0. The
  // `left.length === 0` check is essential — when a game ends because the OTHER
  // player left before anyone moved, everyone is still at square 0, so "all at 0"
  // alone would wrongly clear the latch and the results popup would vanish.
  // `?? game.winner` makes the results popup appear on the SAME render the win
  // happens (shownWinner is set by a post-render effect) — closing the one-frame
  // gap where the winner BAR's instant "Room" button was exposed before the
  // popup covered it, which let a stray/ghost tap navigate away instantly.
  const overWinner = shownWinner ?? game.winner;
  // Absorb the phone Back button while the winner popup is up (see ludo page).
  useBackGuard(!!overWinner && !resultDismissed);
  useEffect(() => {
    if (game.winner) {
      setShownWinner(game.winner);
    } else if ((game.left ?? []).length === 0 && Object.values(game.pos).every((v) => v === 0)) {
      setShownWinner(null);
      setResultDismissed(false);
    }
  }, [game.winner, game.left, game.pos]);

  // The end-of-game "🏠 Room" / "Play Again" bar buttons navigate INSTANTLY.
  // Keep them INERT for a beat after the win so a stray tap / ghost click the
  // moment the game ends can't whisk the player away before they read the result.
  const [winArmed, setWinArmed] = useState(false);
  useEffect(() => {
    if (!game.winner) { setWinArmed(false); return; }
    const t = setTimeout(() => setWinArmed(true), 3500);
    return () => clearTimeout(t);
  }, [game.winner]);

  const turn = currentPlayer(game);
  const requestQuit = (kind: "leave" | "new") => (game.winner ? onQuit() : setConfirm(kind));
  const { config: appConfig } = useConfig();

  // Only the current player's OWN device can roll (no playing for others). A roll
  // is blocked while a move is still pending (dice already showing) so you can't
  // double-roll before tapping your coin.
  const canRoll = !rolling && !showResult && !game.winner && turn === myColor && game.dice == null;
  // It's MY turn, I've rolled a legal number, and I now have to tap my coin to move.
  const canMoveNow = !rolling && !game.winner && turn === myColor && game.dice != null && canMoveSL(game, game.dice);

  // Admin-set dice timing (config.gameAnim, seconds → ms): how long the rolled
  // number stays clearly on screen + an extra pause before the next player's turn.
  const gaNow = appConfig.gameAnim ?? {};
  // Snake felt sluggish because the coin only became tappable ~3s after the dice
  // landed (a 2s "hold" + a 1s turn pause). We keep respecting an admin's explicit
  // gameAnim values, but the SNAKE defaults are now snappy (0.9s hold + 0.25s pause)
  // so token movement feels responsive out of the box. (Ludo, a separate page, is
  // untouched.)
  const diceDisplayMs = Math.max(350, (gaNow.diceDisplaySeconds ?? 0.9) * 1000);
  // Admin-set dice animation speed (per-game override → global). Controls how fast
  // the dice tumbles before landing — Slow / Normal / Fast. (Snake now honours this,
  // matching the "Applies to Ludo & Snake" label.)
  const snakeDiceSpeed = gameDiceSpeed(appConfig, "snake");
  const diceTickMs = snakeDiceSpeed === "slow" ? 115 : snakeDiceSpeed === "fast" ? 45 : 70;
  const turnDelayMs = Math.max(0, (gaNow.turnDelaySeconds ?? 0.25) * 1000);
  // Token glide speed now honours the admin's "Token move speed" for Snake (was a
  // fixed 500ms that ignored the setting). Fast/Normal/Slow → shorter/longer glide.
  const snakeTokenSpeed = gameTokenSpeed(appConfig, "snake");
  const tokMoveMs = snakeTokenSpeed === "slow" ? 650 : snakeTokenSpeed === "fast" ? 260 : 420;

  // Sound Management — apply the admin's pack/per-effect switches (live).
  useEffect(() => { configureSounds(appConfig.gameSound); }, [appConfig.gameSound]);
  // Winner/loser sound — fires once when the game ends (parity with Ludo).
  const animSoundSnake = gaNow.soundEffects !== false;
  const winSndRef = useRef(false);
  useEffect(() => {
    if (game.winner && !winSndRef.current) {
      winSndRef.current = true;
      if (animSoundSnake) { if (game.winner === myColor) playWin(); else playLose(); }
    } else if (!game.winner) winSndRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.winner]);

  // Admin-set centre watermark for the Snake board (Admin → Game Board).
  // Playable-grid rectangle for whichever board picture is in use, and the
  // token look — both taken from the SAME admin settings the Ludo board uses.
  const sgRaw = appConfig.gameBoard?.snakeGrid ?? {};
  const snakeGrid: SnakeGrid = {
    topPct: Math.max(0, Math.min(45, sgRaw.topPct ?? 0)),
    leftPct: Math.max(0, Math.min(45, sgRaw.leftPct ?? 0)),
    widthPct: Math.max(10, Math.min(100, sgRaw.widthPct ?? 100)),
    heightPct: Math.max(10, Math.min(100, sgRaw.heightPct ?? 100)),
  };
  const snakeTokenScale = Math.max(70, Math.min(140, appConfig.gameBoard?.tokenScalePct ?? 100)) / 100;
  // Token skin resolution copied 1:1 from Ludo: your own equipped skin for your
  // coin, each opponent's equipped skin for theirs, and an admin-uploaded
  // custom design wins over both.
  const { user: cosmeticUser } = useAuth();
  const { token: myTokenSkin } = useCosmetics();
  const snakeSkinFor = (c: Color): string => {
    if (c === myColor && myTokenSkin) return myTokenSkin;
    const pid = seats?.[c]?.id;
    return (pid && profiles[pid]?.tokenSkin) || (c === myColor ? myTokenSkin : "royal-lotus");
  };
  const snakeImageFor = (c: Color): string | undefined => customTokenImage(snakeSkinFor(c), appConfig.tokenDesigns, c);
  const csnkC = appConfig.gameBoard?.centerSnake ?? {};
  const csnkOn = csnkC.show === true && !!csnkC.image;
  const csnkSize = Math.max(20, Math.min(100, csnkC.sizePct ?? 50));
  const csnkOpacity = Math.max(0, Math.min(1, (csnkC.opacityPct ?? 25) / 100));

  // ANIMATION WATCHDOG — the same protection as the Ludo board.
  //
  // Every part of a Snake roll runs on browser timers, and a phone that leaves
  // the game (another app, a song, the Customize screen, the screen locking)
  // SUSPENDS them. The roll then never finished: "rolling" stayed switched on,
  // which blocks both the Roll button and the turn timer, and the commit that
  // passes the turn never ran. The turn stuck on that player until a reload.
  // These refs use the REAL CLOCK and hold the unfinished step, so it can be
  // completed properly the moment the player comes back.
  const animStartedAtRef = useRef(0);
  const pendingFinishRef = useRef<null | (() => void)>(null);
  const animTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const finishStalledAnim = useCallback(() => {
    for (const t of animTimersRef.current) { clearTimeout(t); clearInterval(t as unknown as ReturnType<typeof setInterval>); }
    animTimersRef.current = [];
    const finish = pendingFinishRef.current;
    pendingFinishRef.current = null;
    animStartedAtRef.current = 0;
    if (finish) { try { finish(); } catch { /* fall through to the hard clear */ } }
    setRolling(false);
    setShowResult(false);
  }, []);
  // Keep the watchdog's clock honest: it starts when anything is busy and clears
  // when everything settles, so a normal roll never leaves it armed.
  useEffect(() => {
    if (rolling || showResult) { if (!animStartedAtRef.current) animStartedAtRef.current = Date.now(); }
    else animStartedAtRef.current = 0;
  }, [rolling, showResult]);
  // Coming back to the game — phones differ in which signal they send, so listen
  // for all three.
  useEffect(() => {
    const onBack = () => {
      if (document.hidden) return;
      if (animStartedAtRef.current && Date.now() - animStartedAtRef.current > 1500) finishStalledAnim();
    };
    document.addEventListener("visibilitychange", onBack);
    window.addEventListener("focus", onBack);
    window.addEventListener("pageshow", onBack);
    return () => {
      document.removeEventListener("visibilitychange", onBack);
      window.removeEventListener("focus", onBack);
      window.removeEventListener("pageshow", onBack);
    };
  }, [finishStalledAnim]);
  useEffect(() => () => { for (const t of animTimersRef.current) { clearTimeout(t); clearInterval(t as unknown as ReturnType<typeof setInterval>); } }, []);

  const roll = () => {
    if (!canRoll) return;
    setRolling(true);
    setNote(null);
    playDiceRoll();
    const dice = 1 + Math.floor(Math.random() * 6);
    // COMMIT THE ROLL. Kept as one function so it can be run either by the timers
    // below or — if this phone leaves the game and the browser suspends those
    // timers — by the watchdog on the way back. Without that, `rolling` stayed
    // switched on AND this commit never ran, so the dice had landed but the turn
    // never passed: the freeze the client reported.
    const commit = () => {
      setRollFace(dice);       // LAND on the real number
      setRolling(false);
      setShowResult(false);
      setGame((g) => {
        if (!g || g.winner || g.dice != null) return g;
        const before = g.pos[currentPlayer(g)];
        const mover = currentPlayer(g);
        const ns = applyRoll(g, dice);
        // Explain a non-move so the player understands the turn passed.
        if (ns.dice == null && ns.pos[mover] === before) {
          if (before === 0 && dice !== 1) setNote(`${names[mover]} needs a 1 to enter the board — turn passes.`);
          else if (before + dice > 100) setNote(`${names[mover]} needs exactly ${100 - before} to finish.`);
        } else if (ns.dice != null) {
          setNote(before === 0 ? `${names[mover]} rolled a 1 — tap your coin to enter!` : `${names[mover]} rolled ${dice} — tap your coin to move.`);
        }
        return ns;
      });
    };
    animStartedAtRef.current = Date.now();
    pendingFinishRef.current = commit;
    // Brief dice tumble before resolving — LOCAL only (updates just this device's
    // dice face). Previously each tumble frame was pushed to the network, spamming
    // 6 state broadcasts per roll; now only the final move is broadcast.
    let ticks = 0;
    const id = setInterval(() => {
      setRollFace(1 + Math.floor(Math.random() * 6));
      if (++ticks >= 6) {
        clearInterval(id);
        animTimersRef.current = animTimersRef.current.filter((x) => x !== id);
        setRollFace(dice);       // LAND on the real number
        setShowResult(true);     // hold it on screen
        playPop();
        setRolling(false);
        // Show the number for a beat, THEN apply the ROLL. The roll only SETS the
        // dice (or passes the turn when there's no legal move) — the coin is moved
        // manually by tapping it, so the value is always seen first (#dice sync).
        const t1 = setTimeout(() => {
          const t2 = setTimeout(() => { pendingFinishRef.current = null; commit(); }, turnDelayMs);
          animTimersRef.current.push(t2);
        }, diceDisplayMs);
        animTimersRef.current.push(t1);
      }
    }, diceTickMs);
    animTimersRef.current.push(id);
  };

  // Play the SAME dice animation for a roll that arrived from ANOTHER player, so
  // EVERY player sees the tumble + the exact number land (not a silent value).
  const observeRoll = useCallback((dice: number) => {
    setRolling(true);
    playDiceRoll();
    const finish = () => { setRollFace(dice); setShowResult(false); setRolling(false); };
    animStartedAtRef.current = Date.now();
    pendingFinishRef.current = finish;
    let ticks = 0;
    const id = setInterval(() => {
      setRollFace(1 + Math.floor(Math.random() * 6));
      if (++ticks >= 6) {
        clearInterval(id);
        animTimersRef.current = animTimersRef.current.filter((x) => x !== id);
        setRollFace(dice); setShowResult(true); setRolling(false);
        playPop();
        // Same admin-set display time as the roller, so opponents never miss it.
        const t = setTimeout(() => { pendingFinishRef.current = null; setShowResult(false); }, diceDisplayMs);
        animTimersRef.current.push(t);
      }
    }, diceTickMs);
    animTimersRef.current.push(id);
  }, [diceDisplayMs, diceTickMs]);
  // Opponent's roll landed (dice appeared and it isn't MY turn) → animate it locally.
  const prevDiceRef = useRef<number | null>(game.dice);
  useEffect(() => {
    const prev = prevDiceRef.current;
    prevDiceRef.current = game.dice;
    if (game.dice != null && prev == null && turn !== myColor && !game.winner && !rolling && !showResult) {
      observeRoll(game.dice);
    }
  }, [game.dice, turn, myColor, game.winner, observeRoll, rolling, showResult]);

  // MANUAL move: the current player taps their own coin to move it (no automatic
  // movement). Applies snakes/ladders and the win, and announces the result.
  const moveToken = useCallback(() => {
    setGame((g) => {
      if (!g || g.winner || g.dice == null) return g;
      if (currentPlayer(g) !== myColorRef.current) return g; // only your own coin
      const mover = currentPlayer(g);
      const dice = g.dice;
      const before = g.pos[mover];
      const ns = applyMoveSL(g);
      if (ns.lastJump) {
        setNote(
          ns.lastJump.kind === "ladder"
            ? `🪜 ${names[mover]} climbed a ladder to ${ns.lastJump.to}!`
            : `🐍 ${names[mover]} was bitten — slid down to ${ns.lastJump.to}!`,
        );
      } else if (before === 0) {
        setNote(`${names[mover]} entered the board!`);
      } else {
        setNote(null);
      }
      playPop();
      return ns;
    });
  }, [setGame, names]);

  // ---- Turn timer + ANTI-FREEZE (mirrors Ludo) --------------------------
  // 10-second turn. If the current player doesn't roll in time it's a MISSED
  // turn (loses a chance); 3 missed turns in a row removes them (2-player → the
  // other wins). A bystander skips an absent player after a short grace so the
  // game can NEVER freeze on someone who left.
  const isNet = !!roomId;
  const isMyTurn = !game.winner && turn === myColor;
  // Admin-configurable chance-missing timer (config.gameTurnSeconds), fallback default.
  const turnSecs = gameTurnSeconds(appConfig, "snake", TURN_SECONDS_SL);
  // ── DICE look & "last rolled" (admin-controlled, same as Ludo) ──
  const diceCfg = appConfig.gameDice ?? {};
  const diceFaceImg = diceCfg.customFace && diceCfg.faceImage
    ? (diceCfg.faceImage.startsWith("http") || diceCfg.faceImage.startsWith("/") || diceCfg.faceImage.startsWith("data:") ? diceCfg.faceImage : withBase(diceCfg.faceImage))
    : undefined;
  const showLastRolled = diceCfg.showLastRolled !== false;
  // The admin's ACTIVE dice model (Admin → Dice Models) — identical lookup to Ludo.
  const diceModel = activeDiceModel(appConfig.diceModels, appConfig.activeDiceModelId);
  // `shownDie` = the number KEPT on the die face for the current turn. After a
  // player rolls, the die keeps showing that number (for everyone, including
  // spectators) even after they move, and clears only when the turn passes — so
  // the die and the number stay visible together. Same behaviour as Ludo.
  const [shownDie, setShownDie] = useState<number | null>(null);
  const turnDieRef = useRef(game.turn);
  useEffect(() => {
    if (game.turn !== turnDieRef.current) {
      turnDieRef.current = game.turn;
      setShownDie(game.dice ?? null);
    } else if (game.dice != null) {
      setShownDie(game.dice);
    }
  }, [game.turn, game.dice]);
  const diceIdle = !rolling && !showResult && game.dice == null && shownDie === null;
  const lastRolled = shownDie;
  // Turn animation for the ACTIVE player's profile picture (admin-controlled,
  // same rules as Ludo — only one avatar animates, and only until the roll lands).
  const gaSl = appConfig.gameAnim ?? {};
  const diceRollClsSl = diceAnimClass({ diceStyle: gaSl.diceStyle }); // admin-selected dice-roll style
  const turnAnimOn = turnAnimActive({ isTurn: true, rolling, die: game.dice, finished: !!game.winner });
  const turnAnimCls = (isTurn: boolean) => turnAnimClass(gaSl, isTurn && turnAnimOn);
  const [timeLeft, setTimeLeft] = useState(turnSecs);
  const turnKey = `${game.turn}|${game.rolls ?? 0}|${game.winner ?? ""}`;
  const turnStartRef = useRef(Date.now());
  const firedRef = useRef(false);
  // When this device last ATTEMPTED to move a stalled turn on. If the attempt
  // did not actually change the board — a guard inside the updater declined it,
  // or the write was lost — `firedRef` would stay set and this device would
  // never try again. With every device disarmed that way the board is stuck for
  // good. See the matching guard on the Ludo board.
  const lastSkipTryRef = useRef(0);
  // Live values read INSIDE the interval via refs, so the interval does NOT depend
  // on them and is created ONCE per turn (not re-created on every render). The old
  // version depended on `setGame` (a new function each render because the net hook
  // returns a fresh object), so frequent re-renders (voice/profile updates) tore
  // down and rebuilt the 1s interval before it could tick — which starved the
  // anti-freeze so an absent player's turn could HANG the game, and made the
  // countdown/skip fire erratically. A stable interval fixes both.
  const gameRef = useRef(game); gameRef.current = game;
  const rollingRef = useRef(rolling); rollingRef.current = rolling;
  const showResultRef = useRef(showResult); showResultRef.current = showResult;
  const myColorRef = useRef(myColor); myColorRef.current = myColor;
  const setGameRef = useRef(setGame); setGameRef.current = setGame;
  useEffect(() => {
    turnStartRef.current = Date.now();
    firedRef.current = false;
    setTimeLeft(turnSecs);
    serverSeenAtTurnStartRef.current = serverMoveRef.current?.() ?? 0;
  }, [turnKey, turnSecs]);
  // NOBODY LOSES A TURN TO LAG — the same three protections as Ludo:
  //   1. a tick arriving far late means THIS DEVICE stalled (phone asleep, tab
  //      throttled), not that the player sat idle → give the window back;
  //   2. if our last poll never came back we cannot tell "did not move" from
  //      "we did not hear the move" → pause the clock rather than punish;
  //   3. before taking someone else's turn, the SERVER must also have seen no
  //      move for the whole window — one device's stale board is not evidence.
  const lastTickRef = useRef(Date.now());
  // The server's "last move" stamp as it was WHEN THIS TURN BEGAN — see the Ludo
  // board for why comparing against the turn start itself blocked the skip for
  // ever and froze the game until a page reload.
  const serverSeenAtTurnStartRef = useRef(0);
  // Shown while the clock is held, so a frozen countdown reads as "you are
  // protected" rather than as the game being stuck.
  const [turnHeld, setTurnHeld] = useState(false);
  const turnHeldRef = useRef(false); turnHeldRef.current = turnHeld;
  // When contact with the server was first lost (see the timer below).
  const heldSinceRef = useRef(0);
  const syncAgeRef = useRef(syncAgeMs); syncAgeRef.current = syncAgeMs;
  const serverMoveRef = useRef(lastServerMoveAt); serverMoveRef.current = lastServerMoveAt;
  useEffect(() => {
    // Fresh window when returning from the background (stale view → don't fire).
    const onVisible = () => { if (!document.hidden) { turnStartRef.current = Date.now(); lastTickRef.current = Date.now(); firedRef.current = false; } };
    document.addEventListener("visibilitychange", onVisible);
    lastTickRef.current = Date.now();
    const iv = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) { lastTickRef.current = Date.now(); return; } // stale, backgrounded view
      const g = gameRef.current;
      if (!g || g.winner) return;
      const now = Date.now();
      // (1) This tick is scheduled every second; a much bigger gap means the
      // device stalled. Restart the window instead of firing instantly.
      const gap = now - lastTickRef.current;
      lastTickRef.current = now;
      if (gap > 3000) {
        turnStartRef.current = now;
        firedRef.current = false;
        setTimeLeft(turnSecs);
        // No badge here — the DEVICE stalled (app switch, screen unlock, tab
        // throttled) and the player can already see the countdown restart.
        // Flashing a pause marker as well only prompted "why did that appear?"
        return;
      }
      const elapsed = (now - turnStartRef.current) / 1000;
      setTimeLeft(Math.max(0, Math.ceil(turnSecs - elapsed)));
      // Also pause during the RESULT hold — firing then let a queued roll land after
      // the turn had already moved on (a second writer → forked board).
      // SECOND NET: some phones send no signal when the player returns, so if
      // the dice has been "busy" far longer than any animation can take, finish
      // it here. Without this the guard below would block every check for the
      // rest of the match and the turn would stay on one player.
      if ((rollingRef.current || showResultRef.current) && animStartedAtRef.current && now - animStartedAtRef.current > Math.max(9000, diceDisplayMs + 9000)) {
        finishStalledAnim();
        return;
      }
      // SELF-HEALING: an attempt that didn't actually move the board must not
      // disarm this device for the rest of the match. Re-arm at most every 10s
      // (well beyond the sync poll, so devices still can't collide).
      if (firedRef.current && lastSkipTryRef.current && now - lastSkipTryRef.current > 10000) firedRef.current = false;
      if (firedRef.current || rollingRef.current || showResultRef.current) return;
      // (2) Out of touch with the server → PAUSE the clock (the player keeps the
      // time they had left), never count a miss we cannot justify.
      // The clock pauses the INSTANT contact is lost; the player is only told
      // once the silence has lasted a moment, so an ordinary gap between polls
      // (2-4s is routine on mobile) never blinks a marker up for no reason.
      const age = syncAgeRef.current;
      if (isNet && age && age() > 4000) {
        turnStartRef.current += gap;
        if (!heldSinceRef.current) heldSinceRef.current = now;
        if (now - heldSinceRef.current >= 2500) setTurnHeld(true);
        return;
      }
      heldSinceRef.current = 0;
      if (turnHeldRef.current) setTurnHeld(false);
      const players = g.players;
      const curColor = players[g.turn];
      const mine = myColorRef.current;
      if (curColor === mine) {
        // MY turn — if I don't act in time it counts as a missed turn (heart lost).
        if (elapsed >= turnSecs) {
          firedRef.current = true;
          lastSkipTryRef.current = now;
          setGameRef.current((gg) => {
            if (!gg || gg.winner) return gg;
            // Already rolled a legal number but didn't tap my coin → auto-move so
            // the roll isn't wasted (rolling proved I'm present). Otherwise miss.
            if (gg.dice != null && canMoveSL(gg, gg.dice)) return applyMoveSL(gg);
            return missSL(gg);
          });
        }
      } else if (isNet && mine) {
        // Anti-freeze: only skip the current player if THEIR device hasn't advanced
        // well past their own window (so they're genuinely absent — never skip a
        // player who is present and simply thinking).
        const myIdx = players.indexOf(mine);
        if (myIdx < 0) return;
        const dist = (myIdx - g.turn + players.length) % players.length;
        // WIDE stagger (10s per seat, was 2s). A stagger shorter than the ~1.3s sync
        // poll let two devices push the SAME state version, which forked the board
        // permanently (frozen game + everyone crowned winner). The next player acts
        // first; later seats are only a far-apart fallback so they can never collide.
        // Grace raised from 5s to 12s — on mobile data a real move can take
        // several seconds to be written and polled back.
        // Same reasoning as the Ludo board: the SERVER's record of the last
        // move is what proves a player is active, so the wait no longer has to
        // be long. With four players the furthest seat waited turnSecs + 32,
        // which is what made the turn appear stuck.
        const deadline = turnSecs + 6 + Math.max(0, dist - 1) * 4;
        if (elapsed >= deadline) {
          // (3) The server is the witness — it must have seen a NEW move SINCE
          // this turn began. Comparing against the turn start itself was always
          // true (the move that started the turn IS activity at that moment), so
          // nobody could ever be skipped and the board froze until a reload.
          const seenAt = serverMoveRef.current?.() ?? 0;
          // No baseline yet (the first poll had not answered when this turn
          // began) → adopt the first real value rather than reading it as fresh
          // activity, which would block the skip for the whole turn. See the Ludo
          // board for the full explanation.
          if (seenAt > 0 && serverSeenAtTurnStartRef.current === 0) serverSeenAtTurnStartRef.current = seenAt;
          if (seenAt > 0 && seenAt > serverSeenAtTurnStartRef.current) return;
          firedRef.current = true;
          lastSkipTryRef.current = now;
          setGameRef.current((gg) => {
            if (!gg || gg.winner) return gg;
            if (gg.players[gg.turn] !== curColor) return gg; // turn already moved on
            if (gg.players[gg.turn] === myColorRef.current) return gg; // never skip myself
            return missSL(gg);
          });
        }
      }
    }, 1000);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVisible); };
    // Stable per-turn interval — recreated only when the turn (or timer length) changes.
  }, [turnKey, turnSecs, isNet, diceDisplayMs, finishStalledAnim]);


  // Compact corner player card (matches the Ludo arena look).
  const renderPlayer = (p: Color, align: "left" | "right") => {
    const isTurn = p === turn && !game.winner;
    const seat = seats[p];
    const prof = seat ? profiles[seat.id] : undefined;
    const mine = !!seat?.id && seat.id === myId;
    const vp = seat ? voiceById.get(seat.id) : undefined;
    const online = !!vp;
    const speaking = !!vp?.isSpeaking;
    const micMuted = mine ? voice.muted : vp ? vp.muted : true;
    const dots = (
      <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <span key={i} className={cn("size-1.5 rounded-full", online ? "bg-emerald-400" : "bg-white/25")} />)}</div>
    );
    const mic = (
      <button
        onClick={() => { if (mine && !voice.forceMuted) { voice.setMuted(!voice.muted); voice.startAudio(); } }}
        disabled={!mine}
        title={mine ? (micMuted ? "Unmute" : "Mute") : micMuted ? "Muted" : "Speaking"}
        className={cn("grid size-7 shrink-0 place-items-center rounded-lg text-white shadow transition", micMuted ? "bg-sky-500" : "bg-emerald-500", mine ? "cursor-pointer hover:brightness-110" : "cursor-default opacity-90")}
      >
        {micMuted ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
      </button>
    );
    // 🔊 SPEAKER OFF — separate from the 🎤 mic button. Stops THIS player's audio
    // on MY device only; their microphone keeps running for everyone else.
    const spkOff = !!seat?.id && !mine && voice.isSpeakerOff(seat.id);
    const spk = seat?.id && !mine ? (
      <button
        onClick={() => { if (seat.id) voice.setSpeakerOff(seat.id, !spkOff); }}
        title={spkOff ? `🔊 Speaker On — hear ${names[p]} again (your device only)` : `🔊 Speaker Off — stop hearing ${names[p]} on your device only (their mic stays on)`}
        aria-label={spkOff ? "Speaker On" : "Speaker Off"}
        className={cn("grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg text-white shadow transition hover:brightness-110", spkOff ? "bg-rose-500" : "bg-slate-600")}
      >
        {spkOff ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
      </button>
    ) : null;
    // The DICE now sits BESIDE the active player (it "follows" whoever's turn it
    // is, like Ludo), with the turn countdown as a badge under it. On my own turn
    // it's a tappable Roll button; otherwise it just shows the active player's die.
    // Non-active cards reserve the same width so the row never shifts.
    const turnDice = isTurn ? (
      <div className="flex shrink-0 items-center gap-1.5">
        {/* The die shows ONLY the animation + face — the rolled value lives in its
            own indicator beside it (never drawn on the die). */}
        <div className="relative size-10 shrink-0">
          <button
            type="button"
            onClick={mine && canRoll ? roll : undefined}
            disabled={!(mine && canRoll)}
            aria-label={mine && canRoll ? "Tap to roll" : "Dice"}
            className={cn("relative block size-10 rounded-lg outline-none", mine && canRoll ? "animate-turn-glow cursor-pointer transition hover:scale-110" : "cursor-default")}
          >
            <Die
              face={((rolling || showResult ? rollFace : game.dice ?? shownDie ?? 1)) as never}
              // Never sit showing a "1" before a roll — blank or the admin's
              // picture. After a roll, keep showing the rolled number (shownDie).
              blank={diceIdle && !diceFaceImg}
              faceImage={diceIdle ? diceFaceImg : undefined}
              color={DIE_COLOR[p]}
              // The admin's active dice model — the same die Ludo draws, so one
              // admin choice really does apply across every game.
              model={diceModel}
              className={cn("size-10", rolling && diceRollClsSl, mine && canRoll && "rounded-lg ring-2 ring-sky-300")}
            />
          </button>
          <span
            title={turnHeld ? "Connection is slow — your countdown is paused and your turn is safe" : undefined}
            className={cn("pointer-events-none absolute -bottom-1.5 left-1/2 min-w-5 -translate-x-1/2 rounded-full px-1 text-center text-[9px] font-bold leading-tight tabular-nums", turnHeld ? "bg-amber-500 text-white" : timeLeft <= 5 ? "animate-pulse bg-rose-500 text-white" : "bg-black/70 text-white")}
          >{/* Keeps the SECONDS and simply freezes them when the connection drops,
                rather than replacing the number with the word "held" — which read
                as an unexplained "Hold" appearing on the dice. */}
            {timeLeft}</span>
        </div>
        {/* ROLLED NUMBER — separate indicator, holds the value until the next roll. */}
        {showLastRolled && lastRolled != null && !rolling && (
          <span className="pointer-events-none flex shrink-0 flex-col items-center leading-none" title={`Last rolled: ${lastRolled}`}>
            <span className="text-[7px] font-bold uppercase tracking-wider text-white/55">Rolled</span>
            <span className="mt-0.5 grid min-w-[20px] place-items-center rounded-md bg-black/75 px-1 py-0.5 text-xs font-black tabular-nums text-white ring-1 ring-white/25">{lastRolled}</span>
          </span>
        )}
      </div>
    ) : (
      <div className="size-10 shrink-0" aria-hidden />
    );
    return (
      <div className={cn("flex flex-col items-center gap-1", (game.left ?? []).includes(p) && "opacity-50")}>
        <div className={cn("flex items-center gap-1.5", align === "right" && "flex-row-reverse")}>
          {mic}
          {spk}
          <button onClick={() => openGift([names[p]], names[p], roomId)} title={`Gift ${names[p]}`} className="relative shrink-0">
            {isTurn && <span className={cn("absolute -inset-1 animate-turn-glow rounded-full opacity-90 blur-[3px]", DOT[p])} />}
            {/* TURN ANIMATION — only the active player's picture animates, from the
                start of their turn until the roll lands. Style/on-off set by admin. */}
            <span className={cn("relative block rounded-full p-[3px]", DOT[p], isTurn && "ring-2 ring-sky-300", turnAnimCls(isTurn))}><Avatar name={names[p]} src={prof?.avatar} size="lg" /></span>
            <span className={cn("absolute bottom-0 right-0 size-3.5 rounded-full ring-2 ring-ink-950", online ? "bg-emerald-400" : "bg-mist-500")} />
            {speaking && <span className="pointer-events-none absolute -inset-1 animate-pulse-ring rounded-full ring-2 ring-emerald-400" />}
            {lastGiftFor(names[p]) && <span className="absolute -left-1 -top-1 text-base leading-none">{lastGiftFor(names[p])}</span>}
            <GiftBurst name={names[p]} />
          </button>
          {/* Dice beside the profile picture, on the inner side (toward centre). */}
          {turnDice}
        </div>
        <p className="max-w-24 truncate text-xs font-semibold text-white">{mine ? "You" : names[p]} <span className="tabular-nums text-white/50">· {game.pos[p]}</span></p>
        {/* Chances (hearts) — one is lost per missed turn; 3 missed = removed. */}
        <div className="flex items-center gap-0.5" title={`${chancesLeftSL(game, p)} chance${chancesLeftSL(game, p) === 1 ? "" : "s"} left`}>
          {Array.from({ length: MAX_MISSES_SL }).map((_, i) => (
            <Heart key={i} className={cn("size-3", i < chancesLeftSL(game, p) ? "fill-rose-500 text-rose-500" : "fill-none text-white/30")} />
          ))}
        </div>
        {dots}
      </div>
    );
  };
  // Seat halves. The list was split in raw seat order, so YOUR own seat landed
  // at the top whenever you were seated in the first half — the "position is at
  // the top, it should be at the bottom" report. The list is now rotated so your
  // seat always falls in the half the admin chose (default: bottom), exactly
  // like Ludo. Everyone else keeps their relative order.
  const half = Math.ceil(game.players.length / 2);
  const myPosition = appConfig.gameBoard?.snakeMyPosition ?? "bottom";
  const ordered = (() => {
    const list = [...game.players];
    if (!myColor) return list;
    const mine = list.indexOf(myColor);
    if (mine < 0) return list;
    // Target index: first slot of the bottom half, or of the top half.
    const target = myPosition === "bottom" ? half : 0;
    const shift = (mine - target + list.length) % list.length;
    return [...list.slice(shift), ...list.slice(0, shift)];
  })();
  const topColors = ordered.slice(0, half);
  const botColors = ordered.slice(half);
  const statusText = game.winner
    ? `${names[game.winner]} wins! 🎉`
    : rolling
      ? "Rolling…"
      : canMoveNow
        ? (game.pos[turn] === 0 ? "🎯 Tap your coin to enter the board" : "Tap your coin to move")
        : canRoll
          ? "Tap the dice to roll"
          : `Waiting for ${names[turn]}…`;

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto overscroll-contain"
      style={{ background: "radial-gradient(120% 70% at 50% 0%, #1e40af 0%, #14296b 40%, #0a1330 100%)" }}
    >
      <div className="pointer-events-none fixed inset-0 opacity-[0.14]" style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(125,211,252,0.5) 0 2px, transparent 2px 18px), repeating-linear-gradient(-45deg, rgba(125,211,252,0.5) 0 2px, transparent 2px 18px)" }} />

      <div className="relative z-10 mx-auto flex min-h-full max-w-md flex-col gap-2 p-2 sm:p-3">
        {/* Admin overlay band for the Game Playing Screen — top side (client request). */}
        <RoomZoneOverlay zone="gameTop" />
        {/* Admin banners / scrolling notice targeted at the PLAYING-GAME screen. */}
        <CustomUploads placement="game-marquee" variant="marquee" />
        <CustomUploads placement="game" />
        {/* Who joined / who left — a FLASH message on the game screen (client
            request): it shows only when somebody comes or goes and fades away,
            instead of a standing panel sitting over the board. */}
        <RoomJoinLeaveFeed roomId={roomId} variant="flash" />
        {/* Admin advertisement strip (banner + running text), non-intrusive. */}
        <GameAd />
        {/* Who's watching (client request) — live spectator count + names. */}
        {spectators > 0 && (
          <div className="mx-auto flex max-w-full items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-[11px] text-mist-300" title={spectatorNames.join(", ")}>
            <Eye className="size-3.5 shrink-0 text-lotus-300" /> <b className="text-mist-100">{spectators}</b> watching
            {spectatorNames.length > 0 && <span className="truncate text-mist-500">· {spectatorNames.slice(0, 3).join(", ")}{spectatorNames.length > 3 ? ` +${spectatorNames.length - 3}` : ""}</span>}
          </div>
        )}
        {/* Top bar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button onClick={() => requestQuit("leave")} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-white/20">
              <ArrowLeft className="size-3.5 shrink-0" /> Leave
            </button>
            {/* Compact: it never wraps to two lines, which is what made it a
                big blob on a phone. */}
            {canEndGame && onEndGame && (
              <button onClick={() => setConfirm("end")} title="End this match for all players" className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-rose-500/85 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-rose-500">
                <Ban className="size-3.5 shrink-0" /> End game
              </button>
            )}
          </div>
          <div className="flex flex-col items-center leading-tight">
            <div className="flex items-center gap-1.5 font-display text-sm font-extrabold text-white"><LotusMark className="size-5" /> Snake &amp; Ladder</div>
            {roomName && <span className="max-w-32 truncate text-[10px] text-white/60">🏠 {roomName}</span>}
          </div>
          <div className="flex items-center gap-1.5">
            <Link href="/customize" title="Settings" className="grid size-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"><Settings className="size-4" /></Link>
            <Link href="/tournaments" title="Tournaments" className="grid size-9 place-items-center rounded-full bg-white/10 text-gold-300 transition hover:bg-white/20"><Trophy className="size-4" /></Link>
            <Link href="/lucky-spin" title="Rewards" className="grid size-9 place-items-center rounded-full bg-white/10 text-lotus-300 transition hover:bg-white/20"><Crown className="size-4" /></Link>
          </div>
        </div>

        {/* Game over: an ALWAYS-VISIBLE bar to return to the room or replay. */}
        {game.winner && (
          <div className="flex items-center gap-2 rounded-2xl border border-gold-400/40 bg-gradient-to-r from-gold-500/25 to-emerald-500/15 px-3 py-2">
            <Trophy className="size-5 shrink-0 text-gold-300" />
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-white">{names[game.winner]} wins! 🎉</span>
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
              onClick={() => winArmed && (onPlayAgain ? onPlayAgain() : setGame(createSL(game.players)))}
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

        {/* Top players — the dice now sits beside whoever's turn it is (below). */}
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-16">{topColors[0] && renderPlayer(topColors[0], "left")}</div>
          <div className="flex flex-col items-center gap-1 pt-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-black/30 px-2.5 py-1 text-[11px] font-bold text-white">
              <Dices className="size-3.5" /> {game.winner ? "Game over" : isMyTurn ? "Your turn" : `${names[turn]}'s turn`}
            </span>
          </div>
          <div className="flex min-w-16 justify-end">{topColors[1] && renderPlayer(topColors[1], "right")}</div>
        </div>

        {/* Board — classic LotusPlay Connect board in a deep maroon frame */}
        <div className="mx-auto w-full">
          <div
            className="overflow-hidden rounded-xl p-1.5 shadow-[0_30px_80px_-28px_rgba(0,0,0,0.85)]"
            style={{ background: "linear-gradient(135deg,#8a2350,#5e1430)" }}
          >
            {/* Title banner */}
            <div className="mb-1.5 flex items-center justify-center gap-2 rounded-md bg-[#f7efdf] px-2 py-1">
              <span className="text-base leading-none">🪷</span>
              <div className="text-center leading-none">
                <div className="font-display text-[15px] font-extrabold tracking-wide text-[#7a1f3d]">LotusPlay Connect</div>
                <div className="mt-0.5 text-[7px] font-bold uppercase tracking-[0.18em] text-emerald-700">Connect · Grow · Bloom Together</div>
              </div>
              <span className="text-base leading-none">🪷</span>
            </div>

            <div className="relative overflow-hidden rounded-md ring-1 ring-[#5e1430]">
              {/* The full hand-painted board (cells, numbers, snakes & ladders) is
                  one detailed image so it always looks identical on every device.
                  Player tokens are overlaid on top by square. */}
              <BrandImg
                slot="snakeBoard"
                alt="Snakes & Ladders board"
                className="block w-full select-none"
                draggable={false}
              />

              {/* Admin-set centre watermark (Admin → Game Board → Snake centre
                  image). Faint by default so cells/numbers stay readable. */}
              {csnkOn && (
                <img
                  src={withBase(csnkC.image!)}
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none object-contain"
                  style={{ width: `${csnkSize}%`, opacity: csnkOpacity }}
                />
              )}

              {/* Player tokens (glossy 3D beads) — ONE element per player, placed by
                  its square and GLIDING smoothly (CSS transition) when it moves, so
                  there is no teleport. A coin still in the base (square 0) is shown in
                  the Base strip below the board, not here. On your turn, after a legal
                  roll, YOUR coin glows and is tappable to move it (manual movement). */}
              {game.players.map((p) => {
                if ((game.left ?? []).includes(p)) return null;
                const pos = game.pos[p];
                if (pos === 0) return null; // waiting in the base strip
                const { x, y } = slCenter(pos, snakeGrid);
                const mates = game.players.filter((q) => !(game.left ?? []).includes(q) && game.pos[q] === pos);
                // When several players share a square, put each on a DISTINCT spot so
                // no coin hides another: 2 → diagonally OPPOSITE corners, 3 → triangle,
                // 4 → four corners. Each coin also shrinks so the slots never overlap.
                const n = mates.length;
                const mi = mates.indexOf(p);
                const SLOTS: Record<number, [number, number][]> = {
                  2: [[-2.6, -2.6], [2.6, 2.6]],
                  3: [[0, -2.8], [-2.8, 2.2], [2.8, 2.2]],
                  4: [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]],
                };
                const [dx, dy] = n > 1 ? (SLOTS[Math.min(n, 4)]?.[mi] ?? [0, 0]) : [0, 0];
                // Coin size follows the cell size, so it stays inside the square
                // on an inset grid, and honours the admin's coin-size setting.
                const cellW = snakeGrid.widthPct / 10;
                const base = n <= 1 ? 0.85 : n === 2 ? 0.6 : n === 3 ? 0.52 : 0.46;
                const sz = cellW * base * snakeTokenScale;
                const tappable = p === myColor && canMoveNow;
                return (
                  <button
                    key={`tok-${p}`}
                    type="button"
                    disabled={!tappable}
                    onClick={tappable ? moveToken : undefined}
                    aria-label={tappable ? `Tap to move ${names[p]}` : `${names[p]} coin`}
                    className={cn(
                      "absolute z-30 block -translate-x-1/2 -translate-y-1/2 rounded-full outline-none transition-[left,top] ease-in-out",
                      tappable ? "cursor-pointer" : "cursor-default",
                    )}
                    style={{ left: `${x + dx}%`, top: `${y + dy}%`, width: `${sz}%`, height: `${sz}%`, transitionDuration: `${tokMoveMs}ms` }}
                  >
                    {/* The SAME token artwork as Ludo — admin token designs,
                        uploaded custom images and per-player skins all apply. */}
                    <LudoToken
                      color={p}
                      skin={snakeSkinFor(p)}
                      image={snakeImageFor(p)}
                      className={cn("rounded-full", tappable && "scale-110")}
                    />
                    {tappable && <span className="pointer-events-none absolute inset-0 rounded-full bg-white/50 animate-ping" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Base — coins waiting to enter. A coin leaves the base only when its
            owner rolls a 1; tap your glowing coin here to enter onto the board. */}
        {game.players.some((p) => !(game.left ?? []).includes(p) && game.pos[p] === 0) && (
          <div className="mx-auto flex w-full flex-wrap items-center justify-center gap-2 rounded-xl bg-black/25 px-3 py-1.5">
            <span className="text-[11px] font-semibold text-white/70">🏠 Base</span>
            {game.players.map((p) => {
              if ((game.left ?? []).includes(p) || game.pos[p] !== 0) return null;
              const canEnter = p === myColor && canMoveNow; // dice===1 already gated by canMoveNow
              return (
                <button
                  key={`base-${p}`}
                  type="button"
                  disabled={!canEnter}
                  onClick={canEnter ? moveToken : undefined}
                  title={canEnter ? "Tap to enter the board" : `${names[p]} — waiting for a 1 to enter`}
                  className={cn("relative grid size-7 place-items-center rounded-full outline-none transition", canEnter ? "scale-110 cursor-pointer" : "cursor-default")}
                  aria-label={canEnter ? `Enter ${names[p]} onto the board` : `${names[p]} waiting in base`}
                >
                  {/* Same artwork as the coin on the board, so a coin doesn't
                      change appearance the moment it enters play. */}
                  <span className="block size-6">
                    <LudoToken color={p} skin={snakeSkinFor(p)} image={snakeImageFor(p)} className="rounded-full" />
                  </span>
                  {canEnter && <span className="pointer-events-none absolute inset-0 rounded-full bg-white/50 animate-ping" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Bottom players + status */}
        <div className="flex items-end justify-between gap-1">
          <div className="min-w-16">{botColors[0] && renderPlayer(botColors[0], "left")}</div>
          <div className="flex flex-1 items-center justify-center px-1 pb-1">
            <p className="flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-1 text-center text-xs font-semibold text-white">
              <span className={cn("size-2.5 rounded-full", DOT[turn])} />
              <span className="truncate">{note || statusText}</span>
            </p>
          </div>
          <div className="flex min-w-16 justify-end">{botColors[1] && renderPlayer(botColors[1], "right")}</div>
        </div>

        {/* Bottom chat bar */}
        {roomId ? (
          <>
            <RoomGiftListener roomId={roomId} />
            <GameChatBar roomId={roomId} onGift={() => openGift(giftRecipients, undefined, roomId)} />
          </>
        ) : (
          <div className="flex items-center justify-end rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
            <button onClick={() => requestQuit("new")} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20">
              <RotateCcw className="size-3.5" /> New game
            </button>
          </div>
        )}
      </div>

      {/* Winner celebration confetti */}
      {game.winner && (
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} className="absolute -top-4 text-lg" style={{ left: `${(i * 41) % 100}%`, animation: `confetti-fall ${1.6 + (i % 5) * 0.3}s ease-in ${(i % 7) * 0.12}s forwards` }}>
              {["🎉", "✨", "🎊", "⭐", "🏆"][i % 5]}
            </span>
          ))}
        </div>
      )}

      {confirm === "end" && (
        <ConfirmDialog
          danger
          title="End the match for everyone?"
          message="This closes the current game for ALL players right away — everyone returns to the room. Use this when a match is stuck or needs to be stopped. This cannot be undone."
          confirmLabel="End match"
          cancelLabel="Keep playing"
          onConfirm={() => { setConfirm(null); onEndGame?.(); }}
          onCancel={() => setConfirm(null)}
        />
      )}

      {(confirm === "leave" || confirm === "new") && (
        <ConfirmDialog
          danger
          title={confirm === "leave" ? "Leave the game?" : "Start a new game?"}
          message={
            confirm === "leave"
              ? "If you leave now you'll be removed from this game right away, and the other players keep playing — the game does not restart. When only one player is left, they win."
              : "The match is still in progress. Starting a new game will end the current one."
          }
          confirmLabel={confirm === "leave" ? "Leave game" : "New game"}
          cancelLabel="Keep playing"
          onConfirm={() => {
            const wasLeave = confirm === "leave";
            setConfirm(null);
            // A LEAVE must actually EXIT the game — go back to the voice ROOM, not
            // the setup screen (the "running game" detector would instantly re-pull
            // the player onto the board, so they could never leave).
            const exit = () => (wasLeave && onBackToRoom ? onBackToRoom() : onQuit());
            // Leaving removes ONLY this player, immediately (forfeit broadcast) plus a
            // server-authoritative "left" mark so no late move can re-add me. The
            // others keep playing; a single player left = they win.
            if (wasLeave && roomId && !game.winner && myColor && game.players.length > 1) {
              // Admin rule: ON = leaver loses ONE chance (leaveSL); OFF = forfeit all
              // (forfeitSL). EITHER WAY mark the seat left server-side so the game
              // always resolves promptly and can never hang. Mirrors Ludo.
              const returnOnRejoin = (appConfig.perGameSettings?.snake?.returnChancesOnRejoin ?? appConfig.gameRules?.returnChancesOnRejoin) !== false;
              setGame(returnOnRejoin ? leaveSL(game, myColor) : forfeitSL(game, myColor));
              onLeaveSeat?.(myColor);
              setTimeout(exit, 250);
            } else {
              exit();
            }
          }}
          onCancel={() => setConfirm(null)}
        />
      )}

      {overWinner && !resultDismissed && (
        <GameOverModal
          winner={names[overWinner]}
          rank="1st to reach 100 🥇"
          isYou={overWinner === myColor}
          onPlayAgain={onPlayAgain}
          onStay={() => setResultDismissed(true)}
          onBackToRoom={onBackToRoom}
        />
      )}
    </div>
  );
}

