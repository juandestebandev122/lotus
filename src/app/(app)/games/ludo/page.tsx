"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowDownToLine, ArrowLeftRight, Check, Dices, RotateCcw, RefreshCw, Trophy, Star, Palette, Mic, MicOff, Settings, Crown, Heart, Coins, Timer, Pause, Volume2, VolumeX, Sparkles, Ban, Home, Eye } from "lucide-react";
import { useVoice } from "@/lib/VoiceProvider";
import {
  resolveHomeArea, homeAreaBoxStyle, usesDefaultWhiteBox, slotWrapperStyle, slotTokenStyle, slotPlateStyle, layerZ,
  type HomeColor,
} from "@/lib/home-areas";
import { resolveSafeStar, safeStarStyle, elementVis } from "@/lib/board-elements";
import { useUserProfiles } from "@/lib/useUserProfiles";
import { GameChatBar } from "@/components/GameChatBar";
import { GameActivityPanel } from "@/components/GameActivityPanel";
import { Die } from "@/components/Die";
import { LotusMark } from "@/components/Logo";
import { LudoToken } from "@/components/LudoToken";
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
import { Gift as GiftIcon } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/cn";
import { ME, fetchRoom } from "@/lib/rooms";
import { withBase } from "@/lib/base-path";
import { fetchTakenColors, claimColor } from "@/lib/game-colors";
import { useRouter } from "next/navigation";
import { useRoomMembers, type RoomMember } from "@/lib/useRoomMembers";
import { useAuth } from "@/lib/auth";
import { GameOverModal } from "@/components/GameOverModal";
import { useBackGuard } from "@/lib/use-back-guard";
import { useToast } from "@/components/ui/Toast";
import { useNetGame, type Seats } from "@/lib/use-net-game";
import { useGameActiveFlag } from "@/lib/use-game-active";
import { lifelog, APP_VERSION } from "@/lib/lifelog";
import { useCosmetics, diceSkinById, boardThemeById, useMyBoardImage, useMyDiceModel } from "@/lib/cosmetics";
import { fetchOwnedCosmetics, NO_COSMETICS, type OwnedCosmetics } from "@/lib/cosmetic-shop";
import { diceLook } from "@/lib/diceDesigns";
import { activeDiceModel } from "@/lib/dice-model";
import { useConfig } from "@/lib/config";
import { resolveGameTheme } from "@/lib/gameThemes";
import { turnAnimClass, turnAnimActive } from "@/lib/turn-anim";
import { diceAnimClass } from "@/lib/dice-anim";
import { frameImageOf } from "@/lib/frames";
import { framesOnIn } from "@/lib/module-frames";
import { customTokenImage } from "@/lib/tokenDesigns";
import { GameCustomizePanel } from "@/components/GameCustomizePanel";
import { playDiceRoll, playPop, playStep, playCapture, playHome, playWin, playLose, playTick, playNotify, configureSounds, vibrate, isSoundMuted, setSoundMuted } from "@/lib/sound";
import { useGameFx } from "@/lib/game-fx";
import { useBoardView, boardTransform, contentTransform, cornerColors, viewForCorner, type Corner } from "@/lib/board-view";
import {
  applyMove,
  applyRoll,
  cellOf,
  chancesLeft,
  COLORS,
  createGame,
  currentColor,
  MAX_MISSES,
  missTurn,
  forfeit,
  leaveGame,
  applyLeftSeats,
  TURN_SECONDS,
  HOME,
  LABEL,
  legalMoves,
  HOME_END,
  RING,
  rollDie,
  fairDieValue,
  controlledDie,
  isSafeCell,
  configureSafeCells,
  START,
  type Color,
  type GameState,
  type Token,
} from "@/lib/ludo";

// Run BEFORE the browser paints (client only) so we can set the token's walk start
// in the same frame the move commits — this prevents the coin from flashing at its
// FINAL cell for one frame and then jumping back to walk (the "jump then step").
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Resolve an admin-uploaded media path (relative paths get the base prefix).
const withBaseSrc = (s: string) => (s.startsWith("http") || s.startsWith("/") ? s : withBase(s));

/**
 * Where to place coin `i` of `n` that are SHARING one square, for the admin's
 * chosen arrangement style. Returns an [x%, y%] offset from the cell centre.
 * `K` is the admin-scaled spread distance. "corners" is the original default and
 * is intentionally byte-for-byte the same as before; the rest are extra looks.
 */
function shareSlot(style: string, n: number, i: number, K: number): [number, number] {
  const tables: Record<string, Record<number, [number, number][]>> = {
    // Original default — 2 opposite corners, 3 triangle, 4 four corners.
    corners: {
      2: [[-K, -K], [K, K]],
      3: [[0, -K], [-K, K], [K, K]],
      4: [[-K, -K], [K, -K], [-K, K], [K, K]],
    },
    // A neat line along the ↘ diagonal.
    diagonal: {
      2: [[-K, -K], [K, K]],
      3: [[-K, -K], [0, 0], [K, K]],
      4: [[-K, -K], [-K / 3, -K / 3], [K / 3, K / 3], [K, K]],
    },
    // Side by side in a horizontal row.
    row: {
      2: [[-K, 0], [K, 0]],
      3: [[-K, 0], [0, 0], [K, 0]],
      4: [[-K, 0], [-K / 3, 0], [K / 3, 0], [K, 0]],
    },
    // Overlapping cascade (like a small stack of chips).
    stack: {
      2: [[-K / 2, -K / 2], [K / 2, K / 2]],
      3: [[-K / 2, -K / 2], [0, 0], [K / 2, K / 2]],
      4: [[-K / 2, -K / 2], [-K / 6, -K / 6], [K / 6, K / 6], [K / 2, K / 2]],
    },
  };
  const table = tables[style] ?? tables.corners;
  return table[n]?.[i] ?? [0, 0];
}

// ---- per-color styling ----
// Classic vibrant Ludo palette (Lotus Ludo): solid red / green / yellow / blue.
const TOKEN: Record<Color, string> = {
  red: "from-red-400 to-red-600 ring-red-200/80",
  green: "from-green-400 to-green-600 ring-green-200/80",
  yellow: "from-yellow-300 to-yellow-500 ring-yellow-100/80",
  blue: "from-blue-400 to-blue-600 ring-blue-200/80",
};
// Corner yards are SOLID bright colour with a white inner box.
const YARD_BG: Record<Color, string> = {
  red: "bg-red-500 border-red-700",
  green: "bg-green-600 border-green-800",
  yellow: "bg-yellow-400 border-yellow-600",
  blue: "bg-blue-600 border-blue-800",
};
// Home-run column cells (the coloured arm leading to the centre).
const HOME_TINT: Record<Color, string> = {
  red: "bg-red-500",
  green: "bg-green-600",
  yellow: "bg-yellow-400",
  blue: "bg-blue-600",
};
// Stack-count badge: a white pill with the number in the PLAYER'S colour (per the
// client request) so a cell holding 2/3/4 coins shows how many at a glance.
const STACK_BADGE: Record<Color, string> = {
  red: "text-red-600 ring-red-500",
  green: "text-green-700 ring-green-600",
  yellow: "text-yellow-600 ring-yellow-500",
  blue: "text-blue-600 ring-blue-600",
};
const CORNER: Record<Color, { row: string; col: string }> = {
  red: { row: "1 / 7", col: "1 / 7" },
  green: { row: "1 / 7", col: "10 / 16" },
  yellow: { row: "10 / 16", col: "10 / 16" },
  blue: { row: "10 / 16", col: "1 / 7" },
};

// Reverse lookup: which ring index does a [r,c] correspond to (for styling)
const RING_AT = new Map<string, number>();
RING.forEach(([r, c], i) => RING_AT.set(`${r},${c}`, i));
const START_COLOR = new Map<string, Color>();
(Object.keys(START) as Color[]).forEach((c) => {
  const [r, cc] = RING[START[c]];
  START_COLOR.set(`${r},${cc}`, c);
});
// Rotation (deg) for the "coins start here" arrow on each colour's entry cell,
// pointing the way tokens travel when they leave the yard: red → right (0°),
// green → down (90°), yellow → left (180°), blue → up (270°). Computed from the
// step between a colour's start ring-cell and the next, so it always matches the
// board geometry above.
const START_DIR: Record<Color, number> = (() => {
  const dirs = {} as Record<Color, number>;
  (Object.keys(START) as Color[]).forEach((c) => {
    const [r0, c0] = RING[START[c]];
    const [r1, c1] = RING[(START[c] + 1) % RING.length];
    dirs[c] = r1 > r0 ? 90 : r1 < r0 ? 270 : c1 < c0 ? 180 : 0;
  });
  return dirs;
})();
const HOME_CELL = new Map<string, Color>();
(Object.keys(HOME) as Color[]).forEach((c) =>
  HOME[c].forEach(([r, cc]) => HOME_CELL.set(`${r},${cc}`, c)),
);
// Steps-to-home for each VISIBLE home-path box (the coloured stretch leading to
// the centre). HOME[c][i] is board pos 51+i, so the exact dice needed to reach
// home (pos 56 = HOME_END) is 56-(51+i). We label the 5 coloured boxes 5→1 so a
// player can see AT A GLANCE how many boxes a coin still needs — Ludo needs the
// EXACT number to finish, so a coin sitting on the "3" box needs three more pips
// (this is what looked like a bug: a coin 3 boxes deep isn't "one step away").
const HOME_STEP = new Map<string, number>();
(Object.keys(HOME) as Color[]).forEach((c) =>
  HOME[c].forEach(([r, cc], i) => {
    const steps = HOME_END - (51 + i);
    if (steps >= 1 && steps <= 5) HOME_STEP.set(`${r},${cc}`, steps);
  }),
);

// Diagonal (opposite-corner) colour pairs, so a 2-player game always seats the
// two players across from each other no matter which of the 4 colours is picked.
const DIAGONAL: Record<Color, Color> = { red: "yellow", yellow: "red", green: "blue", blue: "green" };

// Given the host's chosen colour + player count, the colours actually in play:
// the chosen colour is ALWAYS included; the rest fill from the other colours
// (2-player = the diagonal/opposite colour).
function colorsForGame(myColor: Color, count: number): Color[] {
  if (count === 2) return [myColor, DIAGONAL[myColor]];
  return [myColor, ...COLORS.filter((c) => c !== myColor)].slice(0, count);
}

// "You" take the chosen colour; the invited voice-room members fill the other
// seats. `myName` is the signed-in user's real name. Players can ONLY be people
// currently seated in the voice room (`members`).
function buildNames(
  myColor: Color,
  activeColors: Color[],
  selected: number[],
  myName: string,
  members: RoomMember[],
): Record<Color, string> {
  const names = {} as Record<Color, string>;
  let si = 0;
  for (const c of COLORS) {
    if (c === myColor) {
      names[c] = myName;
    } else if (activeColors.includes(c)) {
      const m = members[selected[si++]];
      names[c] = m ? m.name.split(" ")[0] : "Open seat";
    } else {
      names[c] = "—";
    }
  }
  return names;
}

// Dice / game SOUND on-off control (in the top bar). Persists the choice; when
// off, the dice-roll and pop effects are silenced everywhere.
function SoundToggle() {
  const [muted, setMuted] = useState(isSoundMuted());
  return (
    <button
      onClick={() => { const n = !muted; setSoundMuted(n); setMuted(n); }}
      title={muted ? "Dice sound is OFF — tap to turn on" : "Dice sound is ON — tap to turn off"}
      className="grid size-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
    >
      {muted ? <VolumeX className="size-4 text-rose-300" /> : <Volume2 className="size-4" />}
    </button>
  );
}

// Premium EFFECTS on-off control (in the top bar). Turns all the extra visuals
// (safe-zone glow, kill flash, home celebration, winner fireworks/confetti) +
// haptics on/off. ON by default. Separate from the sound toggle.
function FxToggle() {
  const [on, setOn] = useGameFx();
  return (
    <button
      onClick={() => setOn(!on)}
      title={on ? "Premium effects ON — tap to turn off" : "Premium effects OFF — tap to turn on"}
      className="grid size-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
    >
      <Sparkles className={cn("size-4", on ? "text-gold-300" : "text-white/40")} />
    </button>
  );
}

export default function LudoPage() {
  const group = useGroupParam();
  const { user } = useAuth();
  const { toast } = useToast();
  const myName = user?.fullName?.split(" ")[0] || ME.fullName.split(" ")[0];
  // Real voice-room members = the ONLY people who can be invited to the game.
  const members = useRoomMembers(group?.room);
  const myId = user?.id ?? "";
  // The starter sets `starting` (initial board + seats); joiners find a running
  // session via `hasRunning`. Either way we render the shared NetBoard.
  const [starting, setStarting] = useState<{ game: GameState; seats: Seats; names: Record<string, string> } | null>(null);
  const [hasRunning, setHasRunning] = useState(false);
  // A Ludo game is running in this room that I'm NOT part of → show a "game in
  // progress" screen (Watch/Rejoin from the room) instead of the host Setup, so I
  // can't accidentally start a second game that clobbers the live one.
  const [otherRunning, setOtherRunning] = useState(false);
  // True when THIS room is a tournament match room → Dice Control forces certified
  // fair random (the client's paid-match fair-play rule).
  const [paidMatch, setPaidMatch] = useState(false);
  // Arriving from an accepted invite (?join=1) → wait on the board for the host
  // to start, instead of showing the (host) setup screen.
  const [joinMode, setJoinMode] = useState(false);
  useEffect(() => { setJoinMode(new URLSearchParams(window.location.search).get("join") === "1"); }, []);
  // Once we've entered the board, STAY on it until the player explicitly leaves.
  // The "running game" detector flips `hasRunning` to false the moment a game is
  // won (a finished game is no longer "running"), which would rip the board — and
  // the winner/results popup — away after ~1s. This latch keeps the board mounted
  // through the result; only onQuit (Leave / admin-end) or navigating away clears it.
  const [inGame, setInGame] = useState(false);
  const [count, setCount] = useState(4);
  const [myColor, setMyColor] = useState<Color>("red");
  // The people who ACCEPTED the invite (id + first name + their chosen colour) —
  // drives "Start". Null until everyone has accepted. Captured from the invites
  // themselves, so it's robust to the live member list re-ordering before start.
  const [ready, setReady] = useState<{ id: string; name: string; color?: string }[] | null>(null);
  // The people invited to fill the other colours, tracked by STABLE member id (NOT
  // array index) so a live presence poll re-ordering `members` can never silently
  // change WHO is invited — the root cause of "2/3-player invite is unreliable".
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Set once the host hand-picks invitees (vs. accepting the auto-filled default),
  // so a presence poll never overwrites their explicit choice.
  const manualEditRef = useRef(false);
  // Indices into the LIVE `members` array, derived from the stable ids — so every
  // consumer (Setup highlight, buildNames, invite list) keeps working unchanged
  // while the underlying selection stays stable across re-orders.
  const selected = useMemo(
    () => selectedIds.map((id) => members.findIndex((m) => m.id === id)).filter((i) => i >= 0),
    [selectedIds, members],
  );
  // Co-Hosts of this room join directly (no accept/reject prompt).
  const [coHostIds, setCoHostIds] = useState<string[]>([]);
  // Am I the Host / a Co-Host of this room (or an admin)? — controls who may open
  // a game in the new lobby flow.
  const [canControlRoom, setCanControlRoom] = useState(false);
  // ONLY members on a voice seat may play. Listeners are blocked (default true so a
  // legitimately-seated player never sees a flash of the block screen while loading).
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
  const { lobby, reload: reloadLobby } = useLobby(group?.room, "ludo", lobbyEnabled);
  const [lobbyBusy, setLobbyBusy] = useState(false);
  // Cache the lobby at "starting" so the "Game Starting…" splash survives the brief
  // window between the lobby retiring and the game session being detected.
  const [startingLobby, setStartingLobby] = useState<LobbyView | null>(null);
  const lobbyBuiltRef = useRef(false);
  useEffect(() => { if (lobby?.status === "starting") setStartingLobby(lobby); }, [lobby]);
  const doLobby = useCallback(async (action: string, extra?: { color?: string; targetId?: string; mode?: string }) => {
    if (!group?.room) return;
    setLobbyBusy(true);
    const res = await lobbyDo(group.room, "ludo", action, extra ?? {});
    setLobbyBusy(false);
    if (!res.ok && res.error) toast(res.error, "error");
    reloadLobby();
  }, [group?.room, reloadLobby, toast]);
  // Build the real Ludo game from the lobby seats. EACH player plays the EXACT
  // colour they picked in the lobby — no reassignment, including 2-player games.
  // (In the lobby the colour is the player's explicit choice, so we never override
  // it; the "diagonal opposite" rule only applies to the classic auto-assigned flow.)
  const startFromLobby = useCallback((seats: LobbySeatView[]) => {
    const filled = seats.filter((s) => s.id);
    if (filled.length < 2) return;
    const seatMap: Seats = {};
    const used: Color[] = [];
    for (const s of filled) { seatMap[s.color as Color] = { id: s.id!, name: s.name ?? "Player" }; used.push(s.color as Color); }
    const nm = {} as Record<Color, string>;
    used.forEach((c) => { nm[c] = seatMap[c]?.name ?? "—"; });
    setStarting({ game: createGame(used), seats: seatMap, names: nm });
  }, []);
  // The designated builder's device creates the shared game when the countdown ends.
  useEffect(() => {
    if (!lobby || lobby.status !== "starting") { lobbyBuiltRef.current = false; return; }
    if (lobby.builderId !== myId || (lobby.startingIn ?? 0) > 0 || lobbyBuiltRef.current) return;
    lobbyBuiltRef.current = true;
    startFromLobby(lobby.seats);
    if (group?.room) lobbyDo(group.room, "ludo", "started");
  }, [lobby, myId, startFromLobby, group?.room]);

  // Changing player count / colour cancels any pending invite. A new count also
  // clears the "hand-picked" flag so the default fill re-applies for the new size.
  const changeCount = (n: number) => {
    setCount(n);
    setReady(null);
    manualEditRef.current = false;
  };
  // Live colour reservations for this room, so the host can't pick a colour an
  // invited player already took (and invitees see the host's colour as taken).
  const [takenColors, setTakenColors] = useState<Color[]>([]);
  const myColorRef = useRef(myColor);
  myColorRef.current = myColor;
  useEffect(() => {
    const room = group?.room;
    if (!room || starting || hasRunning || joinMode) return;
    let active = true;
    const load = async () => {
      const t = (await fetchTakenColors(room)) as Color[];
      if (!active) return;
      let want = myColorRef.current;
      if (t.includes(want)) { want = COLORS.find((c) => !t.includes(c)) ?? want; setMyColor(want); }
      const r = await claimColor(room, want);
      if (!active) return;
      setTakenColors(r.taken as Color[]);
    };
    load();
    const iv = setInterval(load, 4000);
    return () => { active = false; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.room, starting, hasRunning, joinMode]);

  const pickHostColor = (c: Color) => {
    setMyColor(c);
    setReady(null);
    const room = group?.room;
    if (!room) return;
    claimColor(room, c).then((r) => {
      setTakenColors(r.taken as Color[]);
      if (r.conflict) {
        const free = COLORS.find((x) => !r.taken.includes(x));
        if (free) { setMyColor(free); claimColor(room, free).then((r2) => setTakenColors(r2.taken as Color[])); }
      }
    });
  };
  const toggleMember = (i: number, needed: number) => {
    setReady(null);
    manualEditRef.current = true; // the host is hand-picking — stop auto-fill from overriding
    const m = members[i];
    if (!m) return;
    const id = m.id;
    // Small confirmation when a player is picked ("Ahmed selected"). Only on ADD.
    if (!selectedIds.includes(id)) toast(`${m.name.split(" ")[0]} selected`, "success");
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= needed) return [...prev.slice(1), id]; // keep newest within the limit
      return [...prev, id];
    });
  };

  // Detect a running Ludo game in this room so invited players who navigate here
  // (after accepting) automatically drop onto the live shared board.
  useEffect(() => {
    if (!group?.room) return;
    let on = true;
    const check = async () => {
      try {
        const res = await fetch(withBase(`/api/games/active?room=${encodeURIComponent(group.room)}`), { credentials: "include" });
        const d = await res.json();
        const sess = (d.sessions ?? []).find((s: { game?: string }) => (s.game || "").toLowerCase().includes("ludo")) as { playerIds?: string[] } | undefined;
        // Only auto-drop THIS user onto the shared board if they are actually a
        // seated participant of that game. Otherwise an UNINVITED room member (very
        // common when a 2/3-player game is started in a room with more people) would
        // be pulled into someone else's match and stuck on a board with no seat.
        // Sessions without playerIds (legacy) fall back to the old behaviour so a
        // genuine player can always rejoin after a refresh.
        const ids = sess?.playerIds;
        const mine = !!sess && (!ids || ids.length === 0 || (!!myId && ids.includes(myId)));
        if (on) { setHasRunning(mine); setOtherRunning(!!sess && !mine); setPaidMatch(!!d.tournament); }
      } catch { /* ignore */ }
    };
    check();
    const t = setInterval(check, 3000);
    return () => { on = false; clearInterval(t); };
  }, [group?.room, myId]);

  // Latch "I'm in the game board" the moment any entry condition is true, and hold
  // it until the player leaves — so the board (and the end-of-game results popup)
  // is never torn down just because the session finished.
  useEffect(() => {
    if (starting || hasRunning || joinMode) setInGame(true);
  }, [starting, hasRunning, joinMode]);

  // TEMP diagnostic: record the exact render-controlling state so we can see, from
  // the server log, whether the board is being torn down on a real user's device.
  useEffect(() => {
    lifelog("page:state", { starting: !!starting, hasRunning, joinMode, inGame });
  }, [starting, hasRunning, joinMode, inGame]);

  // The host can pick ANY of the 4 colours; their pick is always in play, and the
  // other seats fill around it (2-player = the opposite/diagonal corner).
  const effectiveMyColor = myColor;
  const activeColors: Color[] = colorsForGame(myColor, count);
  const needed = count - 1; // group members to invite (other than You)
  const names = buildNames(effectiveMyColor, activeColors, selected, myName, members);

  // Players are capped by who's actually in the voice room (host + seated).
  const maxPlayers = Math.min(4, members.length + 1);
  // Clamp the chosen count to what's possible, and auto-fill the seats with the
  // real voice-room members — never cached/placeholder players.
  useEffect(() => {
    setCount((c) => Math.min(Math.max(2, c), Math.max(2, maxPlayers)));
  }, [maxPlayers]);
  // Keep the invited set valid as the room's presence changes — WITHOUT clobbering
  // the host's explicit choice. If the host hasn't hand-picked, use the convenient
  // default (the first `needed` members). If they HAVE, preserve their picks and
  // only drop anyone who left the room (never silently exceed `needed`). Runs on a
  // presence poll, so it must be a no-op when nothing meaningful changed.
  useEffect(() => {
    setSelectedIds((prev) => {
      const ids = members.map((m) => m.id);
      const next = manualEditRef.current
        ? prev.filter((id) => ids.includes(id)).slice(0, needed)
        : ids.slice(0, needed);
      return next.length === prev.length && next.every((id, k) => id === prev[k]) ? prev : next;
    });
  }, [members, needed]);

  // Host presses Start → build the seat map (colour → player) and the opening
  // board, then everyone plays the SAME game on their own device.
  const startGame = () => {
    // Build the seat map from the colour EACH player actually CHOSE, using the
    // full 4-colour pool — so a player always plays the colour they picked (this
    // fixes "picked blue but got yellow"). The host's pick wins any clash; the
    // colours the game uses are EXACTLY these picks (no silent reassignment).
    const acc = ready ?? [];
    const seats: Seats = {};
    const used: Color[] = [];
    const seat = (c: Color, id: string, name: string) => { seats[c] = { id, name }; used.push(c); };
    seat(effectiveMyColor, myId || "me", myName);
    if (count === 2) {
      // 2-PLAYER: ALWAYS place the two players on DIAGONALLY OPPOSITE corners (never
      // adjacent/side positions), regardless of the colour the opponent picked, so
      // the two always face each other across the board.
      const opp = acc[0];
      if (opp) seat(DIAGONAL[effectiveMyColor], opp.id, opp.name);
    } else {
      // Honour EACH player's exact chosen colour (unique via the live colour-claim
      // system). Never silently reassign — the colour you picked is the colour you
      // play. The host's pick wins any clash.
      const pending: { id: string; name: string }[] = [];
      for (const m of acc) {
        const pref = m.color as Color | undefined;
        if (pref && COLORS.includes(pref) && !used.includes(pref)) {
          seat(pref, m.id, m.name); // exact colour choice
        } else {
          pending.push({ id: m.id, name: m.name }); // no pick / clash → fill from the free pool
        }
      }
      const free = COLORS.filter((c) => !used.includes(c));
      pending.forEach((m, i) => { const c = free[i]; if (c && m) seat(c, m.id, m.name); });
    }

    const gameColors = used; // exactly the chosen/assigned colours (length = player count)
    const namesMap = {} as Record<Color, string>;
    gameColors.forEach((c) => { namesMap[c] = seats[c]?.name ?? "—"; });
    setStarting({ game: createGame(gameColors), seats, names: namesMap });
  };

  // Games are group-only: require a Voice Room context.
  if (group === undefined) return null;
  if (group === null) return <GroupRequired />;

  // A game is live (I started it, or one is already running in this room) — or
  // I arrived from an accepted invite — → join the shared board.
  if (starting || hasRunning || joinMode || inGame) {
    return (
      <>
        <GroupBanner name={group.name} roomId={group.room} />
        <NetBoard
          roomId={group.room}
          roomName={group.name}
          myId={myId}
          myName={myName}
          initial={starting ?? undefined}
          canEndGame={canControlRoom}
          paidMatch={paidMatch}
          onQuit={() => { lifelog("page:onQuit"); setStarting(null); setHasRunning(false); setJoinMode(false); setInGame(false); setStartingLobby(null); lobbyBuiltRef.current = false; }}
        />
      </>
    );
  }

  // A game I'm not part of is already running here — don't hijack it and don't let
  // me start a conflicting one. Send me to the room to Watch or Rejoin.
  if (otherRunning) {
    return (
      <>
        <GroupBanner name={group.name} roomId={group.room} />
        <div className="mx-auto max-w-md">
          <div className="rounded-2xl border border-white/8 bg-ink-850 p-8 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-lg bg-petal-500/12 text-petal-400"><Dices className="size-7" /></span>
            <h1 className="mt-4 font-display text-xl font-extrabold text-mist-100">A Ludo game is already in progress</h1>
            <p className="mt-2 text-sm text-mist-300">Another game is being played in this room right now. Head back to the room to <span className="font-semibold text-mist-100">Watch</span> or <span className="font-semibold text-mist-100">Rejoin</span> it — or wait for it to finish to start a new one.</p>
            <Link href={withBase(`/rooms/${group.room}`)} className="mt-5 inline-block"><Button variant="secondary"><ArrowLeft className="size-4" /> Back to room</Button></Link>
          </div>
        </div>
      </>
    );
  }

  // LISTENERS cannot play. Only members on a voice seat may start/join a game.
  // (Checked AFTER the in-game branches so an active player is never thrown out of
  // a running match.)
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
    // Keep showing the "Game Starting…" splash through the brief window between the
    // lobby retiring and the game session being detected.
    const active: LobbyView | null = lobby ?? (startingLobby && startingLobby.status === "starting" ? startingLobby : null);
    if (active) {
      if (active.status === "starting" || (!lobby && startingLobby)) {
        return (<><GroupBanner name={group.name} roomId={group.room} /><LobbyStarting lobby={active} /></>);
      }
      if (active.mode === "auto" && active.status === "open") {
        return (<><GroupBanner name={group.name} roomId={group.room} /><LobbyAuto lobby={active} myId={myId} busy={lobbyBusy} onAction={(a, e) => doLobby(a, e)} /></>);
      }
      if (active.mode === null && active.status === "choosing") {
        return (<><GroupBanner name={group.name} roomId={group.room} /><LobbyModeChoice lobby={active} autoOn={appCfg.lobby?.autoJoin !== false} manualOn={appCfg.lobby?.manualInvite !== false} onPick={(m) => doLobby("mode", { mode: m })} onCancel={() => doLobby("cancel")} busy={lobbyBusy} /></>);
      }
      // mode === "manual" → fall through to the classic invite Setup below.
    } else {
      // No lobby yet → Host/Co-Host can Start; everyone else waits.
      return (<><GroupBanner name={group.name} roomId={group.room} /><LobbyStart canControl={canControlRoom} hostOnly={appCfg.lobby?.hostOnlyStart !== false} onOpen={() => doLobby("open")} busy={lobbyBusy} /></>);
    }
  }

  return (
    <>
      <GroupBanner name={group.name} roomId={group.room} />
      <Setup
        count={count}
        setCount={changeCount}
        myColor={effectiveMyColor}
        setMyColor={pickHostColor}
        taken={takenColors}
        names={names}
        members={members}
        selected={selected}
        needed={needed}
        onToggleMember={(i) => toggleMember(i, needed)}
        invited={!!ready}
        onReady={setReady}
        onStart={startGame}
        coHostIds={coHostIds}
        roomName={group.name}
        roomId={group.room}
      />
    </>
  );
}

// ============================================================
// NetBoard — the shared, turn-gated multiplayer board. Every player runs this;
// the current player's seat is the only interactive one.
// ============================================================
function NetBoard({
  roomId, roomName, myId, myName, initial, onQuit, canEndGame, paidMatch,
}: {
  roomId: string;
  roomName: string;
  myId: string;
  myName: string;
  initial?: { game: GameState; seats: Seats; names: Record<string, string> };
  onQuit: () => void;
  canEndGame?: boolean; // Host / Co-Host / admin → may force-end the match for everyone
  paidMatch?: boolean;  // tournament / cash match → Dice Control forced fair
}) {
  useGameActiveFlag(); // defer app auto-update reloads while this board is mounted
  useEffect(() => { lifelog("netboard:mount"); return () => lifelog("netboard:UNMOUNT"); }, []);
  const { toast } = useToast();
  const router = useRouter();
  const net = useNetGame<GameState>({
    roomId,
    roomName,
    kind: "ludo",
    myId,
    initial,
    currentSeatKey: (g) => currentColor(g),
    mergeIncoming: applyLeftSeats,
    // Snappier dice/turn propagation (client: "no delay or mismatch") — a roll
    // reaches every opponent within ~1s. Sync still pauses while backgrounded.
    pollMs: 1000,
  });
  const myColor = (net.mySeatKey as Color | null) ?? null;
  const names = net.names as Record<Color, string>;

  // Mark the session completed once a winner is decided; reset when a new round
  // begins (Play Again) so the NEXT win is recorded too.
  const endedRef = useRef(false);
  useEffect(() => { lifelog("net:winner", { w: net.game?.winner ?? null, status: net.status }); }, [net.game?.winner, net.status]);
  useEffect(() => {
    const w = net.game?.winner;
    if (w && !endedRef.current) {
      endedRef.current = true;
      net.end(`${names[w] ?? LABEL[w]} (${LABEL[w]})`);
    } else if (!w && endedRef.current) {
      endedRef.current = false;
    }
  }, [net, names]);

  // #11 — Auto-forfeit on seat-loss: if one of the current players is KICKED,
  // LEAVES the room, or is demoted to listener DURING the match, remove them from
  // the game via the SAME server-authoritative path as the manual Leave button
  // (net.leave → markSeatLeft), so a 2-player match crowns the remaining player.
  // Keyed on persisted room-SEAT membership, NOT live voice presence — a page
  // refresh (drops voice, keeps the seat) never forfeits anyone. A 2-strike
  // debounce + "ignore a failed room fetch" guard rule out transient blips.
  const ffGameRef = useRef(net.game); ffGameRef.current = net.game;
  const ffSeatsRef = useRef(net.seats); ffSeatsRef.current = net.seats;
  const ffLeaveRef = useRef(net.leave); ffLeaveRef.current = net.leave;
  const ffStrikeRef = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!roomId) return; // networked room games only
    let on = true;
    const t = setInterval(async () => {
      const g = ffGameRef.current;
      if (!g || g.winner) return; // only during an active, unwon match
      const live = g.players.filter((c) => !(g.removed ?? []).includes(c));
      if (live.length <= 1) return;
      const r = await fetchRoom(roomId);
      if (!on || !r) return; // failed/stale fetch → never forfeit
      const seated = (uid: string) => {
        if ((r.removedMemberIds ?? []).includes(uid) || (r.blockedMemberIds ?? []).includes(uid)) return false; // kicked/blocked
        return r.host?.id === uid || r.ownerId === uid || (r.coAdminIds ?? []).includes(uid) ||
          ((r.stageApprovedIds ?? []).includes(uid) && !(r.audienceIds ?? []).includes(uid));
      };
      for (const c of live) {
        const uid = ffSeatsRef.current[c]?.id;
        if (!uid) { ffStrikeRef.current[c] = 0; continue; } // seat not resolved yet (join seed window)
        if (seated(uid)) { ffStrikeRef.current[c] = 0; continue; }
        ffStrikeRef.current[c] = (ffStrikeRef.current[c] ?? 0) + 1;
        if (ffStrikeRef.current[c] >= 2) ffLeaveRef.current(c); // === the manual-Leave removal
      }
    }, 4000);
    return () => { on = false; clearInterval(t); };
  }, [roomId]);

  // "Play Again" → broadcast a fresh board on the SAME session (everyone rejoins
  // the new round). "Back to Room" → return to the voice room (voice stays live).
  const playAgain = useCallback(() => {
    const g = net.game;
    if (g) { endedRef.current = false; net.restart(createGame(g.players)); }
  }, [net]);
  const backToRoom = useCallback(() => {
    lifelog("nav:backToRoom"); // confirm this is what navigates away from a result
    router.push(withBase(`/rooms/${roomId}`));
  }, [router, roomId]);

  // The game was force-ended (Host/Co-Host "End Game" or an admin) → EVERY client
  // leaves the board. Fires on status 'ended' regardless of a winner, so it also
  // closes a finished/looping match (Play Again loop) that the host chose to stop.
  // A normal win sets status 'completed' (not 'ended'), so ordinary results are
  // untouched — players still choose Play Again / Back to Room themselves.
  useEffect(() => {
    if (net.status === "ended") {
      toast("This match has ended.", "info");
      onQuit();
    }
  }, [net.status, onQuit, toast]);

  // Bridge the engine's setGame signature to the network: any local change made
  // on MY turn is broadcast to everyone (only the current player ever writes).
  const setGame = useCallback<React.Dispatch<React.SetStateAction<GameState | null>>>((updater) => {
    const cur = net.game;
    if (cur == null) return;
    const next = typeof updater === "function" ? (updater as (g: GameState | null) => GameState | null)(cur) : updater;
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
          <p className="mt-2 text-sm text-mist-400">Waiting for the host to start the Ludo board. You&apos;ll drop in automatically.</p>
          <Button variant="secondary" className="mt-5" onClick={onQuit}><ArrowLeft className="size-4" /> Back</Button>
        </div>
      </div>
    );
  }

  return (
    <Board
      game={net.game}
      setGame={setGame}
      humans={myColor ? [myColor] : []}
      names={names}
      onQuit={onQuit}
      onPlayAgain={playAgain}
      onBackToRoom={backToRoom}
      onLeaveSeat={net.leave}
      seats={net.seats}
      myId={myId}
      roomId={roomId}
      roomName={roomName}
      paidMatch={paidMatch}
      canEndGame={canEndGame}
      onEndGame={() => net.endForEveryone()}
      spectators={net.spectators}
      spectatorNames={net.spectatorNames}
      syncAgeMs={net.syncAgeMs}
      lastServerMoveAt={net.lastServerMoveAt}
      onResync={net.resync}
    />
  );
}

// ============================================================
// Setup screen
// ============================================================
const SEAT_COLORS = COLORS; // red, green, yellow, blue
const SEAT_DOT: Record<Color, string> = {
  red: "bg-red-500",
  green: "bg-green-600",
  yellow: "bg-yellow-400",
  blue: "bg-blue-600",
};

function Setup({
  count,
  setCount,
  myColor,
  setMyColor,
  taken,
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
  myColor: Color;
  setMyColor: (c: Color) => void;
  taken: Color[];
  names: Record<Color, string>;
  members: RoomMember[];
  selected: number[];
  needed: number;
  onToggleMember: (i: number) => void;
  invited: boolean;
  onReady: (accepted: { id: string; name: string; color?: string }[] | null) => void;
  onStart: () => void;
  coHostIds: string[];
  roomName: string;
  roomId: string;
}) {
  const activeColors: Color[] = colorsForGame(myColor, count);
  // The most players possible = host + people currently in the voice room.
  const maxPlayers = Math.min(4, members.length + 1);

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-xl border border-white/8 bg-ink-850 p-6 sm:p-9">
        <span className="mx-auto grid size-14 place-items-center rounded-lg bg-petal-500/12 text-petal-400">
          <Dices className="size-7" />
        </span>
        <h1 className="mt-5 text-center font-display text-2xl font-extrabold text-mist-100 sm:text-3xl">
          Ludo
        </h1>
        <p className="mt-2 text-center text-sm text-mist-300">
          Play with your group members. Each member gets a colour and takes their turn — first to
          bring all four tokens home wins.
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

        {/* Color selection — ALL 4 colours are selectable. Your pick is always in
            play; the other seats fill around it (2-player = the opposite corner). */}
        <div className="mt-5">
          <p className="mb-2 text-sm font-semibold text-mist-200">Select your color</p>
          <div className="flex justify-center gap-3 sm:gap-4">
            {SEAT_COLORS.map((c) => {
              const selected = myColor === c;
              const isTaken = !selected && taken.includes(c);
              return (
                <button
                  key={c}
                  disabled={isTaken}
                  onClick={() => setMyColor(c)}
                  aria-label={isTaken ? `${LABEL[c]} (taken)` : LABEL[c]}
                  className={cn(
                    "relative grid size-14 cursor-pointer place-items-center rounded-full border-2 transition hover:scale-105",
                    SEAT_DOT[c],
                    selected
                      ? "scale-110 border-white shadow-[0_0_0_3px_rgba(255,255,255,0.25)]"
                      : "border-white/30",
                    isTaken && "cursor-not-allowed opacity-30 hover:scale-100",
                  )}
                >
                  {selected && (
                    <span className="grid size-6 place-items-center rounded-full bg-white">
                      <Check className="size-4 text-ink-900" />
                    </span>
                  )}
                  {isTaken && <span className="text-lg font-bold text-white/80">×</span>}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-center text-xs text-mist-400">
            You play <span className="font-semibold capitalize text-mist-200">{LABEL[myColor]}</span> · faded colours are taken by invited players
          </p>
        </div>

        {/* Pre-game customization: board / token / dice with a live preview. */}
        <GameCustomizePanel />

        <div className="mt-5">
          <p className="mb-2 text-sm font-semibold text-mist-200">Players in this game</p>
          <div className="space-y-2">
            {activeColors.map((c) => (
              <div
                key={c}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                  c === myColor ? "border-lotus-400/40 bg-lotus-500/10" : "border-line bg-ink-800",
                )}
              >
                <span className={cn("size-3.5 rounded-full", SEAT_DOT[c])} />
                {/* Don't reveal a picked member's name here on selection — only once
                    they've actually JOINED (accepted). Until then show a neutral
                    placeholder so the roster reflects real players, not pending picks. */}
                <span className={cn("text-sm font-semibold", c === myColor || invited ? "text-mist-100" : "italic text-mist-500")}>
                  {c === myColor || invited ? names[c] : "Waiting for player…"}
                </span>
                {c === myColor ? (
                  <span className="text-xs text-lotus-300">(You)</span>
                ) : (
                  invited && (
                    <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                      Joined
                    </span>
                  )
                )}
                <span className="ml-auto text-xs capitalize text-mist-400">{LABEL[c]}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-mist-400">
            Members aren&apos;t added automatically — they join when invited.
          </p>
        </div>

        {/* Invite members — ONLY people currently seated in the voice room. */}
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
            // Remount (reset the invite round) whenever the host changes the player
            // count — otherwise a count changed AFTER sending invites keeps tracking
            // the OLD, larger invitee set and Start never enables. Count is a
            // deliberate action (never changes on a presence poll), so the working
            // same-count flow is untouched.
            key={`ludo-invites-${count}`}
            invitees={selected.map((i) => ({
              id: members[i]?.id ?? `idx-${i}`,
              name: members[i]?.name.split(" ")[0] ?? "Player",
            }))}
            coHostIds={coHostIds}
            gameName="Ludo"
            hostName={names[myColor]}
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
        <Link
          href="/customize"
          className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold text-lotus-300 hover:text-lotus-200"
        >
          <Palette className="size-4" /> Customize dice &amp; tokens
        </Link>
      </div>
    </div>
  );
}

// ============================================================
// Board + play loop
// ============================================================
function Board({
  game,
  setGame,
  humans,
  names,
  onQuit,
  onPlayAgain,
  onBackToRoom,
  onLeaveSeat,
  seats = {},
  myId = "",
  roomId = "",
  roomName = "",
  paidMatch = false,
  canEndGame = false,
  onEndGame,
  spectators = 0,
  spectatorNames = [],
  syncAgeMs,
  lastServerMoveAt,
  onResync,
}: {
  game: GameState;
  setGame: React.Dispatch<React.SetStateAction<GameState | null>>;
  humans: Color[];
  names: Record<Color, string>;
  onQuit: () => void;
  onPlayAgain?: () => void;
  onBackToRoom?: () => void;
  onLeaveSeat?: (seatKey: string) => void;
  seats?: Seats;
  myId?: string;
  roomId?: string;
  roomName?: string;
  paidMatch?: boolean; // tournament / cash match → Dice Control forces certified fair random
  canEndGame?: boolean;      // Host / Co-Host / admin may end the match for everyone
  onEndGame?: () => void;    // force-close the session for all players
  spectators?: number;
  spectatorNames?: string[];
  syncAgeMs?: () => number;          // ms since this device last heard from the server
  lastServerMoveAt?: () => number;   // when the SERVER last saw anyone move (epoch ms)
  onResync?: () => Promise<void>;    // Refresh button — re-sync without leaving the game
}) {
  // Session sync (spectators + multiplayer) is handled by the parent NetBoard,
  // so the live state stays authoritative and turn-gated.
  const { toast } = useToast();
  const [fxOn] = useGameFx(); // premium effects (glow/flash/celebration/haptics) on-off
  const [view, setView] = useBoardView(); // personal board orientation (top↕bottom, left⇄right)
  const { config: appConfig } = useConfig(); // admin config (turn timer, dice speed…)
  // Applied cosmetics: a dice / board / token bought in the Store and worn wins
  // over the locally-picked one, so a player sees what they paid for.
  const { user: cosmeticUser } = useAuth();
  const { dice: diceSkinId, token: tokenSkin, board: boardThemeId } = useCosmetics();
  const boardTheme = boardThemeById(boardThemeId);
  // A saved-library board this player bought and chose. Only honoured while they
  // still own it (or it is free), so a board can never be used without paying.
  const [myBoardPick] = useMyBoardImage();
  const [myDicePick] = useMyDiceModel();
  const [ownedGame, setOwnedGame] = useState<OwnedCosmetics>(NO_COSMETICS);
  useEffect(() => { void fetchOwnedCosmetics().then(setOwnedGame); }, []);
  const myBoardId = (() => {
    if (!myBoardPick) return "";
    const b = (appConfig.gameBoard?.boards ?? []).find((x) => x.id === myBoardPick);
    if (!b) return "";
    const price = Math.max(0, Math.floor(b.priceCoins ?? 0));
    if (price > 0 && !ownedGame.board.includes(b.id) && cosmeticUser?.role !== "admin") return "";
    return b.id;
  })();
  // The die look now comes from the ADMIN DICE LIBRARY: the player's chosen id is
  // looked up there, so an admin can rename, restyle, disable or replace any dice
  // with uploaded art. Falls back to the built-in skin when the library has no
  // entry, so nothing breaks if the config is empty.
  const diceLibrary = diceLook(diceSkinId, appConfig.diceDesigns);
  // WHERE the 15x15 grid sits inside the board picture. Clamped the same way the
  // server clamps it, so a hand-edited config can never collapse the board.
  const lgRaw = appConfig.gameBoard?.ludoGrid ?? {};
  const ludoGrid = {
    topPct: Math.max(0, Math.min(45, lgRaw.topPct ?? 0)),
    leftPct: Math.max(0, Math.min(45, lgRaw.leftPct ?? 0)),
    widthPct: Math.max(20, Math.min(100, lgRaw.widthPct ?? 100)),
    heightPct: Math.max(20, Math.min(100, lgRaw.heightPct ?? 100)),
  };
  const builtinDie = diceSkinById(diceSkinId);
  const dieSkin = {
    surface: diceLibrary.surface ?? builtinDie.surface,
    pip: diceLibrary.pip ?? builtinDie.pip,
    image: diceLibrary.image,
  };
  // DICE MODEL (Admin → Dice Models) — body, pips, each number's own design and
  // the roll animation. A dice this player has BOUGHT and chosen wins; everyone
  // else keeps the one the admin activated. The chosen dice is only honoured
  // while it is still owned (or free), so a paid dice can never be used unpaid.
  const myDiceId = (() => {
    if (!myDicePick) return "";
    const m = (appConfig.diceModels ?? []).find((x) => x.id === myDicePick);
    if (!m || m.enabled === false) return "";
    const price = Math.max(0, Math.floor(m.priceCoins ?? 0));
    if (price > 0 && !ownedGame.dice.includes(m.id) && cosmeticUser?.role !== "admin") return "";
    return m.id;
  })();
  const diceModel = activeDiceModel(appConfig.diceModels, myDiceId || appConfig.activeDiceModelId);
  // "Fixed chances" admin rule → missed-turn chances are CUMULATIVE (never restored
  // by playing). When false ("Return chances", the lenient default) a move clears the
  // player's missed-turn count so only 3-in-a-row remove them.
  const fixedChances = (appConfig.perGameSettings?.ludo?.returnChancesOnRejoin ?? appConfig.gameRules?.returnChancesOnRejoin) === false;
  // Live mirror so the move handlers ALWAYS read the CURRENT admin rule (not a value
  // captured when a memoised callback was created) — the game follows an Admin-Panel
  // change immediately, so "Fixed chances" can never keep retaining chances.
  const fixedChancesRef = useRef(fixedChances);
  fixedChancesRef.current = fixedChances;
  // Per-colour token designs (each player's own pick, shared) are resolved by
  // `skinFor` / `imageFor` further down (once the seat profiles are available).
  const color = currentColor(game);
  const isHumanTurn = humans.includes(color);
  const myColor = humans[0] ?? null; // my seat colour in a networked game
  const isNet = !!roomId; // networked multiplayer (vs. a purely local board)
  // BOARD ORIENTATION (personal view). Two independent flips — top↕bottom and
  // left⇄right — which between them can put ANY colour's home in ANY corner of the
  // screen. Purely local: saved on this device, never sent anywhere, and the game
  // state, turn order and rules are completely untouched. The readable parts are
  // counter-transformed so names and numbers always stay upright, and the four
  // player panels move with their homes.
  const boardTransformCss = boardTransform(view);
  const contentCss = contentTransform(view);
  // Corner → colour, derived from the flips (so a panel always sits with its home).
  const corners = useMemo(() => cornerColors(view), [view]);
  const tlC = corners.topLeft as Color;
  const trC = corners.topRight as Color;
  const blC = corners.bottomLeft as Color;
  const brC = corners.bottomRight as Color;

  // Admin-managed board look (§3 centre image + §5 coin spacing) — read live from
  // config so any Admin → Game Board change reflects in the game without an update.
  const gb = appConfig.gameBoard ?? {};
  const gbC = gb.center ?? {};
  const centerShow = gbC.show !== false;
  const centerSrc = (gbC.image && gbC.image.trim()) ? gbC.image : withBase("/tokens/lotus-red.png");
  const centerSizePct = typeof gbC.sizePct === "number" ? gbC.sizePct : 84;
  const centerInsetPct = Math.max(0, (100 - centerSizePct) / 2); // centre it within the home
  const centerOpacity = (typeof gbC.opacityPct === "number" ? gbC.opacityPct : 40) / 100;
  const centerRotate = typeof gbC.rotateDeg === "number" ? gbC.rotateDeg : 0;
  const centerOffX = typeof gbC.offsetXPct === "number" ? gbC.offsetXPct : 0;
  const centerOffY = typeof gbC.offsetYPct === "number" ? gbC.offsetYPct : 0;
  const tokenScale = (typeof gb.tokenScalePct === "number" ? gb.tokenScalePct : 100) / 100;
  const fanUnit = 26 * ((typeof gb.tokenFanPct === "number" ? gb.tokenFanPct : 100) / 100); // spread between colours sharing a cell
  const shareStyle = gb.shareStyle ?? "corners"; // how coins arrange when sharing a square (admin)
  // Admin board decorations (home-yard symbol, safe-cell icon, frame colour).
  const gbDecor = gb.decor ?? {};
  const homeSymbol = (gbDecor.homeSymbolShow !== false && gbDecor.homeSymbol && gbDecor.homeSymbol.trim()) ? gbDecor.homeSymbol : "";
  // Safe-zone look (colour, tint, star) is resolved by resolveSafeStar() below.
  const frameColor = (gbDecor.frameColor && gbDecor.frameColor.trim()) ? gbDecor.frameColor : "";
  // Board Settings toggles (admin): cell border, its colour, coloured highlights, arrows.
  const boxBorder = gbDecor.boxBorder !== false;
  const borderColor = (gbDecor.borderColor && gbDecor.borderColor.trim()) ? gbDecor.borderColor : "";
  const boxHighlight = gbDecor.boxHighlight !== false;
  const showArrow = gbDecor.showArrow !== false;
  // SAFE-ZONE STAR editor (admin) — icon source, colour, size, opacity, border,
  // glow, shadow, rotation, X/Y nudge and visibility, all resolved in one place.
  // APPEARANCE ONLY: hiding the star never removes the protection on that square.
  const safeStar = useMemo(() => resolveSafeStar(appConfig), [appConfig]);
  // WHICH squares are safe is a separate, gameplay-affecting setting. It comes from
  // the server config so every player agrees, and is installed into the engine here
  // — the renderer then reads the same set back via isSafeCell().
  const adminSafeCells = gb.safeCells;
  useEffect(() => { configureSafeCells(adminSafeCells); }, [adminSafeCells]);
  // Element Show / Hide / Transparent table (admin).
  const visGrid = elementVis(appConfig, "grid");
  const visBoard = elementVis(appConfig, "board");
  const visCellBorder = elementVis(appConfig, "cellBorder");
  const visArrow = elementVis(appConfig, "startArrow");
  const visNumbers = elementVis(appConfig, "pathNumbers");
  const visHomeArea = elementVis(appConfig, "homeArea");
  const visSlot = elementVis(appConfig, "tokenSlot");
  // Token HOME area (admin): the legacy "hide the white box / single home colour"
  // controls are now folded into resolveHomeArea() below, which keeps honouring
  // them until the per-home Token Placement Area panel is switched on.
  // TOKEN PLACEMENT AREAS (admin): each home yard — Red / Green / Yellow / Blue —
  // is configured independently (background show/hide/transparent/colour/image,
  // "Hide White Token Area", layer) together with all four of its token slots
  // (position, size, rotation, visibility, background, border, opacity, layer).
  // Purely visual: every token stays in play and stays clickable whatever is
  // hidden, so the uploaded board controls the LOOK while the engine controls the
  // GAME. Falls back to the older global controls until the panel is switched on.
  const homeArea = useCallback((c: Color) => resolveHomeArea(appConfig, c as HomeColor), [appConfig]);
  // Per-slot token layout (admin): nudge/resize/rotate each of the 4 parked tokens in
  // every home. OFF = default 2×2 grid. Transforms are applied on TOP of the grid cell.
  const slotLayoutOn = gb.tokenSlots?.enabled === true;
  const tokenSlotArr = gb.tokenSlots?.slots ?? [];
  const slotTransform = (i: number) => {
    const s = tokenSlotArr[i] ?? {};
    return `translate(${s.dxPct ?? 0}%, ${s.dyPct ?? 0}%) scale(${(s.sizePct ?? 100) / 100}) rotate(${s.rotateDeg ?? 0}deg)`;
  };
  // Full custom board image (shown as the playing surface; path cells go clear).
  // Source of truth: the ACTIVE library board (config.gameBoard.boards) wins;
  // otherwise the legacy single decor.fullImage still applies (backward-compat).
  const gbBoards = Array.isArray(gb.boards) ? gb.boards : [];
  // A board the PLAYER bought and chose wins over the admin's default surface —
  // that is the whole point of selling boards. It must still be enabled, still
  // have a picture, and still be owned (the ownership check is in myBoardId).
  const myBoard = myBoardId
    ? gbBoards.find((x) => x && x.id === myBoardId && x.enabled !== false && x.image && x.image.trim())
    : undefined;
  const activeBoard = myBoard ?? (gb.activeBoardId
    ? gbBoards.find((x) => x && x.id === gb.activeBoardId && x.enabled !== false && x.image && x.image.trim())
    : undefined);
  const legacyFull = (gbDecor.fullImageShow !== false && gbDecor.fullImage && gbDecor.fullImage.trim()) ? gbDecor.fullImage : "";
  const fullBoard = activeBoard ? activeBoard.image : legacyFull;
  const fullBoardOpacity = ((activeBoard ? activeBoard.opacityPct : gbDecor.fullImageOpacityPct) ?? 100) / 100;
  // Fit mode fixes the old stretch: "contain" keeps the picture's shape (no
  // distortion, centred) — the client's requested default. Fine align nudges let
  // a not-perfectly-square board be lined up with the grid.
  const fullBoardFit = (activeBoard ? activeBoard.fit : gbDecor.fullImageFit) ?? "contain";
  const fullBoardOffX = (activeBoard ? activeBoard.offsetXPct : gbDecor.fullImageOffsetXPct) ?? 0;
  const fullBoardOffY = (activeBoard ? activeBoard.offsetYPct : gbDecor.fullImageOffsetYPct) ?? 0;
  const fullBoardScale = ((activeBoard ? activeBoard.scalePct : gbDecor.fullImageScalePct) ?? 100) / 100;
  // Coin movement style (admin) — applied to the coin while it steps.
  const moveClass = { jump: "coin-move-jump", bounce: "coin-move-bounce", fly: "coin-move-fly", spin: "coin-move-spin", slide: "", instant: "" }[appConfig.gameAnim?.moveStyle ?? "slide"] ?? "";

  // Admin Animation Management (§4 + §6) — master on/off + tuning, read live from
  // config. These sit ON TOP of the player's own effects toggle (`fxOn`): an anim
  // shows only when BOTH the admin has it on AND the player hasn't turned effects off.
  const ga = appConfig.gameAnim ?? {};
  const animDice = ga.diceRoll !== false;
  // Admin-selected dice-roll STYLE (config.gameAnim.diceStyle) — the class the die
  // plays while rolling. Defaults to the classic 3-D tumble.
  const diceRollCls = diceAnimClass({ diceStyle: ga.diceStyle });
  const animMove = ga.tokenMove !== false;
  const animWin = ga.winCelebration !== false;
  const animCapture = ga.captureFlash !== false;
  const animGlow = ga.coinGlow !== false;
  const animSound = ga.soundEffects !== false;
  const ga4 = ga.centerReach ?? {};
  const animCenter = ga4.enabled !== false;
  const centerStyle = ga4.style ?? "bloom";
  const centerSpeed = ga4.speed ?? "normal";
  const centerHoldMs = centerSpeed === "slow" ? 1800 : centerSpeed === "fast" ? 850 : 1300;
  const centerAnimSec = centerSpeed === "slow" ? 1.6 : centerSpeed === "fast" ? 0.7 : 1.1;

  // Admin SHIELD controls (config.shield) — appearance of the same-colour-block safe
  // zone icon/halo. Look-only; the safe-zone RULE (in lib/ludo.ts) is unaffected.
  const sh = appConfig.shield ?? {};
  const shieldIconOn = sh.iconEnabled !== false;
  const shieldGlowOn = sh.glow !== false;
  const shieldBlink = sh.blink === true;
  const shieldParticles = sh.particles === true;
  const shieldImage = (sh.image && sh.image.trim()) ? sh.image : "";
  const shieldColor = (sh.color && sh.color.trim()) ? sh.color : "#10b981";
  const shieldAnimCls = { none: "", pulse: "animate-pulse", spin: "animate-spin", bounce: "animate-bounce" }[sh.animationStyle ?? "pulse"] ?? "animate-pulse";
  const shieldSpeedSec = sh.speed === "slow" ? "1.6s" : sh.speed === "fast" ? "0.6s" : "1s";

  // Sound Management — apply the admin's pack + per-effect switches + custom
  // sounds to the sound engine (live; every play* call then respects them).
  useEffect(() => { configureSounds(appConfig.gameSound); }, [appConfig.gameSound]);

  // §7 Game theme — background + accent (tints the pattern & title) + optional
  // background image + background music. Player colours/board are unaffected.
  // The per-screen Background Music (Admin → Sound & Music) OVERRIDES the theme
  // track for the Ludo screen when it is enabled there.
  const theme = resolveGameTheme(appConfig.gameTheme);
  const themeMusic = appConfig.gameTheme?.music;
  const bgm = appConfig.bgMusic;
  const ludoBgm = bgm?.enabled && bgm.screens?.ludo?.enabled && bgm.screens.ludo.url ? bgm.screens.ludo : null;
  // Result-screen music: when the game is over and the admin set a Result track,
  // it takes over from the in-game track until a new round starts.
  const resultBgm = bgm?.enabled && bgm.screens?.result?.enabled && bgm.screens.result.url ? bgm.screens.result : null;
  const screenBgm = game.winner && resultBgm ? resultBgm : ludoBgm;
  const musicOn = (screenBgm ? true : !!themeMusic?.enabled && !!themeMusic?.track) && animSound;
  const musicTrack = screenBgm?.url ?? themeMusic?.track ?? "";
  const musicVol = Math.max(0, Math.min(1, ((screenBgm ? bgm?.volumePct : themeMusic?.volumePct) ?? 40) / 100));

  // Latched winner (see the effect further down): set when the game ends, held
  // until a fresh round begins — the results popup is driven off THIS, not the
  // live game state, so nothing transient can hide it.
  const [shownWinner, setShownWinner] = useState<Color | null>(null);

  // Winner is LATCHED the moment the game ends and held until the player acts, so
  // a late/racing network update can NEVER hide the results popup. It clears only
  // when a genuinely fresh round begins (Play Again → a board with no winner and
  // every token back home). See `shownWinner` below (declared with the other state).
  // `?? game.winner` makes the results popup appear on the SAME render the win
  // happens: `shownWinner` is set by a post-render effect, so relying on it alone
  // left a one-frame gap where the winner BAR (and its instant "Room" button) was
  // exposed BEFORE the popup covered the screen — a stray/ghost tap in that gap
  // navigated away and the result "vanished immediately". This closes that gap.
  const overWinner = shownWinner ?? game.winner;
  // Step-by-step coin animation: when a token is picked, it visibly HOPS through
  // each cell (start+1 → start+2 → … → target) before the move commits, instead of
  // teleporting straight to the final square. `hop` holds the animating token key,
  // the path of positions and the current step; the move is applied only at the end.
  const [hop, setHop] = useState<{ key: string; path: number[]; step: number; index: number } | null>(null);
  const hopRef = useRef<typeof hop>(null);
  hopRef.current = hop;
  // Remember the die value that is (or was just) showing. A move ALWAYS advances a
  // coin by exactly this many cells (the engine does `pos += die`), so the WALK
  // animation is driven by this — never by a possibly-stale position diff. This
  // guarantees the number of visible steps can never contradict the dice (#7/#8).
  const lastDieRef = useRef<number | null>(game.die);
  useEffect(() => { if (game.die != null) lastDieRef.current = game.die; }, [game.die]);
  // OPTIONAL "Fair Dice" pity system (admin-controlled, config.fairDice). We read
  // the roller's current 6-less streak from a ref so the roll() callback always
  // sees the latest synced value without adding `game` to its deps. When the admin
  // feature is OFF, fairDieValue() returns the raw roll unchanged (100% pure random).
  const sinceSixRef = useRef(game.sinceSix);
  sinceSixRef.current = game.sinceSix;
  const fxOnRef = useRef(fxOn);
  fxOnRef.current = fxOn;
  // Admin sound master (read via a ref so timer/effect callbacks always see the
  // latest value without needing it in their dep arrays).
  const soundOkRef = useRef(animSound);
  soundOkRef.current = animSound;
  const animMoveRef = useRef(animMove);
  animMoveRef.current = animMove;
  // §7 background-music element (created lazily; started on first user gesture
  // because browsers block autoplay-with-sound until the player interacts).
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const movable = useMemo(
    () => (game.die !== null && isHumanTurn && !hop ? new Set(legalMoves(game, color, game.die)) : new Set<number>()),
    [game, color, isHumanTurn, hop],
  );

  // Click-the-dice rolling: animated tumble + sound, then resolve. The dice is
  // the only roll control. It is clickable ONLY on the current player's turn,
  // and disables itself the instant it's clicked to prevent a double roll.
  const [rolling, setRolling] = useState(false);
  const [rollFace, setRollFace] = useState(1);
  // While true, the die keeps showing the ROLLED number as a PURELY VISUAL hold.
  // The roll itself is committed to the shared state the instant it lands (see
  // land() below) — this hold no longer delays the game for anyone.
  const [showResult, setShowResult] = useState(false);
  // Brief "rolled value" shown ON THE ROLLER'S player card so EVERY player can
  // verify each roll — including a "no move" roll, where the turn passes at once
  // and the die never lingers on the roller's card for opponents. Not a floating
  // pop-up: it sits where that player's dice normally is. Driven by game.lastRoll,
  // so every device shows it for the same roll.
  const [rollFlash, setRollFlash] = useState<{ by: Color; value: number; n: number } | null>(null);
  const rollFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canRoll = isHumanTurn && game.die === null && !game.winner && !rolling && !hop;

  // Admin-set timing (config.gameAnim, seconds → ms). BOTH are now PURELY VISUAL
  // — how long the rolled number stays highlighted. They no longer hold back the
  // game state, the turn logic, or what opponents see (the old delayed-commit
  // design was the root cause of "dice not visible to opponents", "turn counted
  // twice" and "game very slow").
  const diceDisplayMs = Math.max(500, (ga.diceDisplaySeconds ?? 1.2) * 1000);
  const turnDelayMs = Math.max(0, (ga.turnDelaySeconds ?? 1) * 1000);
  const resultHoldMs = diceDisplayMs + turnDelayMs; // total visual hold of the number

  // One dice animation at a time: its interval + timers live in refs so a new
  // roll or a turn change always CANCELS the previous one instead of stacking —
  // the dice can never appear to "roll twice" or replay a stale result.
  const tumbleIvRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ANIMATION WATCHDOG — the cure for "the turn sticks on one player".
  //
  // The dice tumble, the result hold and the token walk are all driven by
  // setInterval / setTimeout. A phone that leaves the game — switching apps,
  // playing a song, opening Customize to pick a token, or just locking the
  // screen — SUSPENDS those timers. The animation then never finishes, so
  // `rolling` / `showResult` / `hop` stay switched on for ever. Both the Roll
  // button and the turn timer refuse to act while any of them is on, so the turn
  // froze on that player and only a page reload cleared it.
  //
  // `animStartedAtRef` is a real clock reading, not a timer, so it stays true
  // across a suspend. `pendingLandRef` holds the unfinished step so it can be
  // completed properly (the roll is still committed) instead of thrown away.
  const animStartedAtRef = useRef(0);
  const pendingLandRef = useRef<null | (() => void)>(null);
  const rollBusyRef = useRef(false);
  const clearRollTimers = useCallback(() => {
    if (tumbleIvRef.current) { clearInterval(tumbleIvRef.current); tumbleIvRef.current = null; }
    if (resultTimerRef.current) { clearTimeout(resultTimerRef.current); resultTimerRef.current = null; }
  }, []);
  useEffect(() => () => { // unmount → stop every pending dice timer
    if (tumbleIvRef.current) clearInterval(tumbleIvRef.current);
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    if (rollFlashTimerRef.current) clearTimeout(rollFlashTimerRef.current);
  }, []);

  /** A link out of the game that carries the way back with it. */
  const withGameReturn = useCallback((to: string) => {
    if (typeof window === "undefined") return to;
    const here = window.location.pathname + window.location.search;
    return `${to}${to.includes("?") ? "&" : "?"}backToGame=${encodeURIComponent(here)}`;
  }, []);

  /** Finish anything the browser left half-done, so the game can never be stuck
   *  behind an animation that stopped running. Safe to call at any time. */
  const finishStalledAnimation = useCallback(() => {
    if (tumbleIvRef.current) { clearInterval(tumbleIvRef.current); tumbleIvRef.current = null; }
    if (resultTimerRef.current) { clearTimeout(resultTimerRef.current); resultTimerRef.current = null; }
    const finish = pendingLandRef.current;
    pendingLandRef.current = null;
    animStartedAtRef.current = 0;
    // Completes the roll properly — the value is still applied and broadcast, so
    // nothing about the match is lost; only the spinning picture is cut short.
    if (finish) { try { finish(); } catch { /* fall through to the hard clear */ } }
    setRolling(false);
    setShowResult(false);
    rollBusyRef.current = false;
    // A token part-way through its walk is dropped back to a settled state; the
    // move itself is committed by the walk's own completion path or re-sent by
    // the next sync, so the board still agrees with everyone else.
    setHop(null);
  }, []);

  // Keep the watchdog's clock in step with the animation flags: it starts the
  // moment anything becomes busy and clears the moment everything settles. Doing
  // it here (rather than at each call site) means no path can forget to stamp it,
  // and a normally-finished animation never leaves the watchdog armed.
  useEffect(() => {
    const busy = rolling || showResult || !!hop;
    if (busy) { if (!animStartedAtRef.current) animStartedAtRef.current = Date.now(); }
    else animStartedAtRef.current = 0;
  }, [rolling, showResult, hop]);

  // How long "busy" can legitimately last: the tumble, plus the admin's own dice
  // display time, plus a full token walk, plus room to spare. Anything past this
  // is a stalled animation, not a slow one.
  const animStallMs = Math.max(9000, resultHoldMs + 9000);

  // Coming back to the game — from another app, a song, the Customize screen, or
  // the phone being unlocked. If an animation was left mid-flight, finish it now
  // rather than waiting on a timer that the browser may have thrown away.
  useEffect(() => {
    const onVisible = () => {
      if (document.hidden) return;
      if (animStartedAtRef.current && Date.now() - animStartedAtRef.current > 1500) finishStalledAnimation();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("pageshow", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, [finishStalledAnimation]);

  const roll = useCallback(() => {
    // HARD single-roll guard (ref-based): two taps in the same frame — or the
    // corner die + the floating Roll pill together — can never start two rolls.
    if (rollBusyRef.current || rolling) return;
    rollBusyRef.current = true;
    clearRollTimers();
    // My colour at roll time: if the turn somehow moves on mid-tumble (e.g. a
    // synced miss from another device), the landed value is DISCARDED instead of
    // being applied to the next player's turn.
    const rollColor = color;
    const land = (rolled: number) => {
      setRollFace(rolled);   // LAND on the real number
      setShowResult(true);   // visual hold only — the state is committed below
      if (animSound) playPop();
      if (fxOn) vibrate(rolled === 6 ? [25, 35, 55] : 18);
      setRolling(false);
      // COMMIT IMMEDIATELY. One dice roll = one applyRoll, exactly once, applied
      // and broadcast the moment the animation lands — opponents receive it on
      // their next sync poll. There is no pending window any more, so a turn-
      // timer miss can never race a queued roll onto the next player's turn.
      setGame((g) => (g && g.die === null && !g.winner && currentColor(g) === rollColor ? applyRoll(g, rolled) : g));
      rollBusyRef.current = false;
      resultTimerRef.current = setTimeout(() => setShowResult(false), resultHoldMs);
    };
    // The value this roll LANDS on. With the admin Fair Dice feature OFF (default)
    // this is exactly rollDie() — a pure, uniform 1–6. With it ON, a player who has
    // gone many turns without a 6 may have this roll boosted to a 6 (see fairDieValue).
    const genDie = () => {
      const streak = sinceSixRef.current?.[rollColor] ?? 0;
      const can6 = legalMoves(game, rollColor, 6).length > 0;
      const dc = appConfig.diceControl;
      // FAIR-PLAY GUARDRAIL (top-level): a paid tournament / cash match is ALWAYS pure
      // certified random — it ignores EVERY dice aid, including both Dice Control and the
      // older Fair Dice pity. Only an admin explicitly turning fair-play protection off
      // lifts it. This is the client's transparency rule for paid play.
      if (paidMatch && (dc?.fairPlayProtection !== false)) return rollDie();
      // DICE CONTROL MANAGEMENT (Admin → Dice Control). Any custom mode applies to
      // CASUAL Ludo only — a paid/tournament match is forced to certified fair random
      // by the guardrail inside controlledDie (fairPlayProtection). Mode "random"
      // (default) skips this entirely and keeps the original pure-random + Fair-Dice
      // behaviour below, so untouched dice are byte-for-byte unchanged.
      if (dc && (dc.mode ?? "random") !== "random") {
        // Is the local roller currently behind? (winner-balancing / auto-fairness signal)
        const prog = (c: Color) => game.tokens.filter((t) => t.color === c).reduce((s, t) => s + Math.max(0, t.pos), 0);
        const mine = prog(rollColor);
        const rivals = game.players.filter((c) => c !== rollColor).map(prog);
        const behind = rivals.length > 0 && mine < rivals.reduce((a, b) => a + b, 0) / rivals.length;
        return controlledDie(dc, {
          sinceSix: streak, consecutiveSixes: game.consecutiveSixes ?? 0, totalRolls: game.lastRoll?.n ?? 0,
          userId: myId, paid: paidMatch, isTournament: paidMatch, can6, behind, isNew: false,
        });
      }
      const raw = rollDie();
      const fc = appConfig.fairDice;
      if (!fc?.enabled) return raw;
      const boosted = fairDieValue(raw, streak, fc);
      // Safety: the pity-boost must never HURT the player it's meant to help. Only
      // accept a boosted 6 when a 6 actually has a legal move (e.g. a token to bring
      // out of the yard) — otherwise a legal raw roll would be turned into a wasted
      // turn. If the 6 is unusable, keep the raw value.
      if (boosted === 6 && raw !== 6 && !can6) return raw;
      return boosted;
    };
    setRolling(true);
    setRollFace(1 + Math.floor(Math.random() * 6)); // scramble at once — never open on the previous number
    // THE ROLL MUST ALWAYS LAND, even if this device stops running timers.
    // The tumble below is driven by setInterval, and a phone that switches app,
    // plays a song, opens Customize or locks the screen SUSPENDS those timers.
    // When that happened the interval never reached its last tick, `land()` never
    // ran, and `rolling` stayed true for ever — which blocks both the Roll button
    // and the turn timer, so the turn stuck on that player and only a reload
    // cleared it. The watchdog holds the finisher so it can be run on the way
    // back in, from real elapsed time rather than from a timer that may be dead.
    const landedValue = genDie();
    pendingLandRef.current = () => land(landedValue);
    // Dice tumble animation is admin-controllable (config.gameAnim.diceRoll). When
    // OFF, the result appears instantly (no spin) — the turn logic is unchanged.
    if (!animDice) { pendingLandRef.current = null; land(landedValue); return; }
    if (animSound) playDiceRoll();
    // Admin-set dice animation speed (config.gameDiceSpeed): slow / normal / fast.
    const speed = gameDiceSpeed(appConfig, "ludo");
    const totalTicks = speed === "slow" ? 12 : speed === "fast" ? 6 : 8;
    const tickMs = speed === "slow" ? 105 : speed === "fast" ? 45 : 70;
    let ticks = 0;
    tumbleIvRef.current = setInterval(() => {
      setRollFace(1 + Math.floor(Math.random() * 6));
      if (++ticks >= totalTicks) {
        if (tumbleIvRef.current) { clearInterval(tumbleIvRef.current); tumbleIvRef.current = null; }
        pendingLandRef.current = null;
        land(landedValue);
      }
    }, tickMs);
  }, [rolling, color, game, clearRollTimers, setGame, fxOn, animDice, animSound, appConfig.gameDiceSpeed, appConfig.perGameSettings, appConfig.fairDice, appConfig.diceControl, myId, paidMatch, resultHoldMs]);

  // Play the SAME dice animation for a roll that arrived from ANOTHER player, so
  // EVERY player in the room sees the tumble + the exact number land (not a silent
  // value). `tumbleOnDie` is false when the adopted state shows the turn ALREADY
  // moved on (a no-move roll / a fast mover) — the roller's die is no longer on
  // screen, so we skip the die tumble; the roll banner + sound still announce the
  // exact value to everyone. Always CANCELS any previous animation first, so two
  // rolls in quick succession (e.g. back-to-back sixes) each show correctly
  // instead of the second being silently skipped.
  const observeRoll = useCallback((die: number, tumbleOnDie: boolean) => {
    clearRollTimers();
    const finish = () => {
      pendingLandRef.current = null;
      setRolling(false);
      if (animSound) playPop();
      if (tumbleOnDie) {
        setRollFace(die);
        setShowResult(true);
        resultTimerRef.current = setTimeout(() => setShowResult(false), resultHoldMs);
      }
    };
    if (!animDice || !tumbleOnDie) { finish(); return; }
    if (animSound) playDiceRoll();
    const speed = gameDiceSpeed(appConfig, "ludo");
    const totalTicks = speed === "slow" ? 12 : speed === "fast" ? 6 : 8;
    const tickMs = speed === "slow" ? 105 : speed === "fast" ? 45 : 70;
    // Same watchdog as our own roll: if this device stops running timers while
    // watching somebody else's dice, the animation is finished on the way back.
    pendingLandRef.current = finish;
    setRolling(true);
    setRollFace(1 + Math.floor(Math.random() * 6)); // scramble at once — never open on the previous number
    let ticks = 0;
    tumbleIvRef.current = setInterval(() => {
      setRollFace(1 + Math.floor(Math.random() * 6));
      if (++ticks >= totalTicks) {
        if (tumbleIvRef.current) { clearInterval(tumbleIvRef.current); tumbleIvRef.current = null; }
        finish();
      }
    }, tickMs);
  }, [clearRollTimers, animDice, animSound, appConfig.gameDiceSpeed, appConfig.perGameSettings, resultHoldMs]);

  // ONE handler per roll, on EVERY device. `game.lastRoll.n` increments on each
  // applyRoll (normal, no-move AND three-sixes — see lib/ludo.ts), so this fires
  // exactly once per roll no matter how many sync polls deliver the same state —
  // and it never misses a roll whose `die` was already cleared again (the old
  // null→value detector missed exactly those: "dice not visible to opponents").
  const lastRollSeenRef = useRef<number | null>(null);
  // Coordination with the mixed-version fallback below: true when THIS state
  // adoption's roll was announced here (so the fallback must stay silent).
  const announceHandledRef = useRef(false);
  useEffect(() => {
    announceHandledRef.current = false;
    const lr = game.lastRoll;
    if (lastRollSeenRef.current === null) { lastRollSeenRef.current = lr?.n ?? 0; return; } // seed on join/rejoin — never replay old rolls
    if (!lr || lr.n === lastRollSeenRef.current) return;
    lastRollSeenRef.current = lr.n;
    announceHandledRef.current = true;
    // The die for the NEXT token walk — taken from the ROLL RECORD, so the walk
    // length is right even when this device missed the intermediate die state.
    lastDieRef.current = lr.value;
    // Flash the rolled value on the roller's card (BEFORE the early returns, so it
    // shows on every device incl. the roller). This is what makes a "no move" roll
    // verifiable by opponents — the die itself passes too fast on those.
    setRollFlash({ by: lr.by, value: lr.value, n: lr.n });
    if (rollFlashTimerRef.current) clearTimeout(rollFlashTimerRef.current);
    rollFlashTimerRef.current = setTimeout(() => setRollFlash((f) => (f && f.n === lr.n ? null : f)), Math.max(2000, resultHoldMs));
    if (myColor && lr.by === myColor) return; // my own roll already animated locally
    if (game.winner) return;
    observeRoll(lr.value, lr.by === currentColor(game));
  }, [game, myColor, observeRoll, resultHoldMs]);

  // Fallback for MIXED VERSIONS only (an older app that doesn't stamp lastRoll):
  // the old die null→value detector. It must test FRESHNESS, not existence — an
  // old client's roll can carry a STALE lastRoll along (its state spread keeps
  // the field), so "skip when lastRoll exists" would silence old-client rolls
  // entirely. Instead: skip only when the announcement effect above actually
  // handled THIS adoption's roll (it runs first and flags announceHandledRef).
  const prevDieRef = useRef<number | null>(game.die);
  useEffect(() => {
    const prev = prevDieRef.current;
    prevDieRef.current = game.die;
    if (announceHandledRef.current) return; // this roll was announced via lastRoll above
    if (game.die != null && prev == null && !isHumanTurn && !game.winner && !hopRef.current && !rolling && !showResult) {
      observeRoll(game.die, true);
    }
  }, [game.die, game.lastRoll, isHumanTurn, game.winner, observeRoll, rolling, showResult]);

  // The die on screen belongs to the CURRENT player. The moment the turn moves
  // on, cancel any leftover tumble / held number so the NEXT player's die can
  // never show a stale face — and release the roll lock in case a mid-tumble
  // turn change voided a roll.
  useEffect(() => {
    clearRollTimers();
    setShowResult(false);
    setRolling(false);
    rollBusyRef.current = false;
  }, [color, clearRollTimers]);

  const pickToken = useCallback(
    (t: Token) => {
      if (!movable.has(t.index) || t.color !== color || hopRef.current) return;
      // Commit the move immediately. The step-by-step WALK is played by the shared
      // "moved token" detector below — which runs on EVERY device — so opponents and
      // spectators see the same cell-by-cell animation, not just the mover.
      setGame((g) => (g ? applyMove(g, t.index, !fixedChancesRef.current) : g));
    },
    [movable, color, setGame],
  );

  // SHARED step-by-step animation: whenever a token's position jumps FORWARD (on
  // this OR any other device, after adopting the synced state), replay the move as
  // a cell-by-cell walk. `prevPosRef` remembers each token's last position; a
  // forward jump of ≥2 cells is animated (captures reset to the yard and single
  // steps commit instantly). This makes the movement visible to ALL players.
  const prevPosRef = useRef<Record<string, number> | null>(null);
  useIsoLayoutEffect(() => {
    const cur: Record<string, number> = {};
    for (const t of game.tokens) cur[`${t.color}-${t.index}`] = t.pos;
    const prev = prevPosRef.current;
    prevPosRef.current = cur;
    if (!prev || hopRef.current) return; // first render (seed only) / already walking
    for (const t of game.tokens) {
      const k = `${t.color}-${t.index}`;
      const from = prev[k];
      if (from == null) continue;
      const to = t.pos;
      if (from >= 0 && to > from && to <= HOME_END) {
        // The walk length is the DIE, not `to - from`. On a healthy device these
        // are identical, but if this device missed an intermediate sync `from` is
        // stale and the diff would render the WRONG number of steps (the "dice
        // shows 4 but the coin walks 6" report). Trusting the die — and always
        // ENDING on the authoritative `to` — makes the visible steps exactly match
        // the dice on every device (#7/#8). The synced roll RECORD (lastRoll) is
        // the most reliable source — it survives in the post-move state even when
        // this device never saw the die itself. Only trusted when the roll was
        // made BY THE MOVING COLOUR (a mixed-version old client can carry another
        // player's stale record along); otherwise the local ref is the fallback.
        const die = (game.lastRoll && game.lastRoll.by === t.color ? game.lastRoll.value : null) ?? lastDieRef.current;
        const diff = to - from;
        const steps = die != null && die >= 1 && die <= 6 ? die : diff;
        if (steps < 2) continue; // a single step commits instantly (no walk)
        // Token-move animation is admin-controllable (config.gameAnim.tokenMove).
        // When OFF, skip the walk — the coin is already committed at `to`, so it
        // simply appears there instantly (no game-flow change).
        if (!animMoveRef.current) break;
        const start = Math.max(0, to - steps); // begin the walk `steps` cells back
        const path: number[] = [];
        for (let p = start + 1; p <= to; p++) path.push(p);
        setHop({ key: k, path, step: 0, index: t.index });
        if (fxOnRef.current && soundOkRef.current) playPop();
        break; // only one token moves per turn
      }
    }
  }, [game.tokens]);

  // Drive the walk: advance one cell every `hopMs`; the move is ALREADY committed,
  // so the end of the walk just clears the animation. Uses refs so unrelated
  // re-renders can't reset the timeout and stall it. The per-cell pace is
  // admin-tunable (config.gameTokenSpeed) so the walk reads as a smooth glide
  // rather than a fast/glitchy snap — Slow / Normal / Fast.
  const tokenSpeed = gameTokenSpeed(appConfig, "ludo");
  const hopMs = tokenSpeed === "slow" ? 230 : tokenSpeed === "fast" ? 95 : 155;
  useEffect(() => {
    if (!hop) return;
    const atEnd = hop.step >= hop.path.length - 1;
    const t = setTimeout(() => {
      if (atEnd) {
        setHop(null);
      } else {
        if (fxOnRef.current) { if (soundOkRef.current) playStep(); vibrate(8); } else if (soundOkRef.current) { playPop(); }
        setHop((h) => (h ? { ...h, step: h.step + 1 } : h));
      }
    }, hopMs);
    return () => clearTimeout(t);
  }, [hop, hopMs]);

  // §7 background music — loop the admin-selected track at the set volume while the
  // game is open. Starts on the player's first tap (autoplay-with-sound is blocked
  // until a user gesture); respects the sound master + the player's own mute. Never
  // throws — a failed play() is ignored and retried on the next gesture.
  useEffect(() => {
    if (!musicOn || isSoundMuted()) {
      musicRef.current?.pause();
      return;
    }
    let el = musicRef.current;
    if (!el) { el = new Audio(); el.loop = true; musicRef.current = el; }
    const src = withBaseSrc(musicTrack);
    if (!el.src.endsWith(src)) el.src = src;
    el.volume = musicVol;
    const tryPlay = () => { el!.play().catch(() => {}); };
    tryPlay();
    const onGesture = () => tryPlay();
    window.addEventListener("pointerdown", onGesture);
    return () => window.removeEventListener("pointerdown", onGesture);
  }, [musicOn, musicTrack, musicVol]);
  // Stop + release the music element when leaving the game screen.
  useEffect(() => () => { musicRef.current?.pause(); musicRef.current = null; }, []);

  // Confirm before abandoning a match that is still in progress. "end" = the
  // Host/Co-Host force-ending the whole match for everyone.
  const [confirm, setConfirm] = useState<null | "leave" | "new" | "end">(null);
  const requestQuit = (kind: "leave" | "new") => {
    if (game.winner) onQuit();
    else setConfirm(kind);
  };

  // Winner-celebration sparkles: RANDOMLY scattered and plentiful. Drawn as SOLID
  // SVG stars/sparkles (NOT emoji) so they have NO black border/box on any device,
  // and there's no 💥. Positions are generated ONCE when the winner is decided
  // (memoised) so they don't jump on re-render. Client-only (winner state).
  const celebration = useMemo(() => {
    if (!game.winner || !animWin) return { bursts: [], confetti: [] };
    // Admin intensity (config.gameAnim.winIntensity): how many sparkles + confetti.
    const nBursts = ga.winIntensity === "low" ? 10 : ga.winIntensity === "high" ? 40 : 24;
    const nConfetti = ga.winIntensity === "low" ? 30 : ga.winIntensity === "high" ? 110 : 70;
    const COLORS = ["text-gold-300", "text-amber-200", "text-white", "text-sky-300", "text-rose-300", "text-emerald-300"];
    const bursts = Array.from({ length: nBursts }, (_, i) => ({
      left: 3 + Math.random() * 94,
      top: 4 + Math.random() * 86,
      px: Math.round((1.5 + Math.random() * 2.0) * 16), // icon size in px
      color: i % 3 === 0 ? "text-amber-200" : "text-gold-300",
      kind: Math.random() < 0.5 ? "star" : "sparkle",
      delay: Math.random() * 1.3,
      dur: 0.9 + Math.random() * 0.9,
      key: `b${i}`,
    }));
    const confetti = Array.from({ length: nConfetti }, (_, i) => ({
      left: Math.random() * 100,
      px: Math.round((0.7 + Math.random() * 0.9) * 16),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      dur: 1.5 + Math.random() * 1.8,
      delay: Math.random() * 1.5,
      key: `c${i}`,
    }));
    return { bursts, confetti };
  }, [game.winner, animWin, ga.winIntensity]);

  // Results screen: the winner popup can be dismissed with "Stay on Results
  // Screen" WITHOUT leaving — the final board + winner bar stay up, and each
  // player chooses Back to Room / Play Again on their own (never forced together).
  const [resultDismissed, setResultDismissed] = useState(false);
  // ⛔ While the winner popup is up, ABSORB the phone's Back button/gesture so a
  // reflexive back-tap can't instantly throw the player back to the room and wipe
  // the winner screen (the real cause — the "Back to Room" button was never it).
  useBackGuard(!!overWinner && !resultDismissed);
  // The end-of-game "🏠 Room" / "Play Again" bar buttons navigate INSTANTLY. A
  // game usually ends right where the player is tapping (dice / a token), so a
  // stray tap — or a mobile ~300ms "ghost click" — the moment the win appears
  // used to fire "🏠 Room" and whisk the player away before they could read the
  // result. Keep those bar buttons INERT for a beat after the win, the same way
  // the results popup is armed. (Reset whenever there's no winner.)
  const [winArmed, setWinArmed] = useState(false);
  useEffect(() => {
    if (!game.winner) { setWinArmed(false); return; }
    const t = setTimeout(() => setWinArmed(true), 3500);
    return () => clearTimeout(t);
  }, [game.winner]);
  // Latch the winner when the game ends; clear ONLY when a genuinely NEW round
  // starts. A fresh round means: no winner AND nobody removed AND every token
  // back home. The `removed.length === 0` check is essential — when a game ends
  // because the OTHER player left before anyone moved, all tokens are still home,
  // so "all home" alone would wrongly clear the latch and the results popup would
  // vanish. A leave-win always leaves someone in `removed`, so the popup stays.
  useEffect(() => {
    if (game.winner) {
      setShownWinner(game.winner);
    } else if (game.removed.length === 0 && game.tokens.every((t) => t.pos === -1)) {
      setShownWinner(null);
      setResultDismissed(false);
    }
  }, [game.winner, game.removed, game.tokens]);

  // TEMP diagnostic: the modal shows iff (shownWinner && !resultDismissed). Log
  // both + the live winner so the server log reveals which one is off if a real
  // user's popup still hides.
  useEffect(() => {
    lifelog("board:result", { shown: shownWinner ?? null, dismissed: resultDismissed, gameWinner: game.winner ?? null });
  }, [shownWinner, resultDismissed, game.winner]);

  // ---- Turn timer + ANTI-FREEZE -----------------------------------------
  // 10-second turn. Reset whenever the actionable state changes. Two roles:
  //  • CURRENT player's device: auto-plays at TURN_SECONDS (auto-roll / auto-
  //    move, or miss) so an idle player never stalls the game.
  //  • BYSTANDER (any other seated player): if the current player's device is
  //    gone/backgrounded and the turn DOESN'T advance, after a short staggered
  //    grace it skips them (missTurn) so the game can NEVER freeze. Staggering
  //    by seat distance means the next player acts first; whoever advances bumps
  //    the version and everyone else's timer resets — no double-skip.
  // Chance-missing timer — admin-configurable (config.gameTurnSeconds), falling
  // back to the built-in default. This is the seconds a player has per turn
  // before it counts as a missed turn (heart lost). (appConfig declared at top.)
  const turnSecs = gameTurnSeconds(appConfig, "ludo", TURN_SECONDS);
  const [timeLeft, setTimeLeft] = useState(turnSecs);
  const turnKey = `${game.turn}|${game.die === null ? "roll" : "move"}|${game.winner ?? ""}`;
  const turnStartRef = useRef(Date.now());
  const firedRef = useRef(false);
  // When this device last ATTEMPTED to move a stalled turn on. `firedRef` exists
  // so one device doesn't fire every second, and normally the turn advances at
  // once and the turnKey effect clears it. But if an attempt did NOT move the
  // game on — a guard inside the updater declined it, or the write was lost on a
  // bad connection — the flag stayed set and this device never tried again. With
  // every device disarmed that way the board is stuck for good. This stamp lets
  // each device re-arm and try again, at most once every 10s so they still can't
  // collide and fork the board.
  const lastSkipTryRef = useRef(0);
  useEffect(() => {
    turnStartRef.current = Date.now();
    firedRef.current = false;
    setTimeLeft(turnSecs);
  }, [turnKey, turnSecs]);

  // Countdown ticks — a soft tick for the LAST 3 seconds of MY turn window
  // (admin-controlled "Countdown sound"; players' own mute still applies).
  const prevLeftRef = useRef(turnSecs);
  useEffect(() => {
    if (isHumanTurn && !game.winner && animSound && timeLeft > 0 && timeLeft <= 3 && timeLeft !== prevLeftRef.current) playTick();
    prevLeftRef.current = timeLeft;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  // NOBODY LOSES A TURN TO LAG.
  //
  // The client reported: "sometimes the player's chance is automatically lost
  // because the game becomes slow or lags". Three separate ways that happened,
  // all fixed here:
  //
  //  1. THE DEVICE FROZE. This tick is meant to run once a second. If a much
  //     bigger gap appears — the phone slept, the browser throttled the tab, the
  //     page was blocked — then `elapsed` jumps by the whole gap and the timer
  //     fires instantly. A jump is not a player being idle, so the turn window
  //     is restarted instead. (`visibilitychange` only covers the cases the
  //     browser bothers to announce; on mobile it often does not.)
  //  2. WE LOST TOUCH WITH THE SERVER. If our last poll never came back we have
  //     no idea whether the player moved — their move may be sitting on a board
  //     we have not received. Silence is not evidence, so no miss is counted.
  //  3. THE SERVER SAW THEM PLAY. Even with a healthy connection, our copy of
  //     the board can be behind. Before any device takes another player's turn
  //     away, the SERVER must also have seen no move from anyone for the whole
  //     window — that is the only witness that is not one player's own device.
  const lastTickRef = useRef(Date.now());
  // What the server's "last move" stamp was AT THE MOMENT this turn began. The
  // skip is blocked only when that stamp has moved on since — i.e. somebody has
  // actually played. Without this baseline the move that started the turn counted
  // as activity and blocked the skip for ever.
  const serverSeenAtTurnStartRef = useRef(0);
  useEffect(() => {
    serverSeenAtTurnStartRef.current = lastServerMoveAt ? lastServerMoveAt() : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnKey]);
  // Shown to the player while the clock is held, so a frozen countdown reads as
  // "you are protected", not as the game being broken.
  const [refreshing, setRefreshing] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [turnHeld, setTurnHeld] = useState(false);
  const turnHeldRef = useRef(false); turnHeldRef.current = turnHeld;
  // When contact with the server was first lost. The countdown is paused at
  // once, but the on-screen marker waits until this has lasted a moment, so a
  // routine gap between polls never flashes anything at the player.
  const heldSinceRef = useRef(0);
  useEffect(() => {
    if (game.winner) return;
    const players = game.players;
    const myIdx = myColor ? players.indexOf(myColor) : -1;
    const absent = players[game.turn]; // the player this turn belongs to
    // Coming back from the background: our view of the game is stale (the poll
    // was paused), so give a FRESH window instead of instantly firing a miss on
    // accumulated background time — this is what wrongly skipped an active
    // opponent and declared the absent player the winner.
    const onVisible = () => { if (!document.hidden) { turnStartRef.current = Date.now(); lastTickRef.current = Date.now(); firedRef.current = false; } };
    document.addEventListener("visibilitychange", onVisible);
    lastTickRef.current = Date.now();
    const iv = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) { lastTickRef.current = Date.now(); return; } // don't act on a stale, backgrounded view
      const now = Date.now();
      // (1) A tick that arrives far later than the 1s it was scheduled for means
      // this device stalled. Give the player their full window back.
      const gap = now - lastTickRef.current;
      lastTickRef.current = now;
      if (gap > 3000) {
        turnStartRef.current = now;
        firedRef.current = false;
        setTimeLeft(turnSecs);
        // No badge here. This branch fires whenever the DEVICE itself stalled —
        // coming back from another app, the screen unlocking, the browser
        // throttling a background tab — and the player can already see their
        // countdown start again from the top. Flashing a pause marker for 2.5s
        // on top of that only raised the question "why did that appear?"
        // (the client reported exactly that). The clock reset speaks for itself.
        return;
      }
      const elapsed = (now - turnStartRef.current) / 1000;
      setTimeLeft(Math.max(0, Math.ceil(turnSecs - elapsed)));
      // SECOND NET for a stalled animation. Some phones never fire a visibility
      // event on the way back, so if the dice or a token walk has been "busy" for
      // far longer than any animation can take, finish it here. Without this the
      // guard below would block every check for the rest of the match and the
      // turn would stay on one player.
      if ((rolling || showResult || hopRef.current) && animStartedAtRef.current && now - animStartedAtRef.current > animStallMs) {
        finishStalledAnimation();
        return;
      }
      // SELF-HEALING: an attempt that didn't actually move the board must not
      // disarm this device for the rest of the match. If the turn is still
      // sitting where it was 10s after we tried, try again.
      if (firedRef.current && lastSkipTryRef.current && now - lastSkipTryRef.current > 10000) firedRef.current = false;
      // Don't miss a player mid-ROLL, mid-RESULT-hold, or mid token WALK. Missing
      // `showResult`/`hop` meant a queued applyRoll landed AFTER a miss had already
      // advanced the turn — applying a roll to the next player from the wrong
      // device, i.e. a second writer and another forked board.
      if (firedRef.current || rolling || showResult || hopRef.current) return;
      // (2) Out of touch with the server → we cannot judge anyone, including
      // ourselves. Hold the window open until we can hear again.
      // The clock is PAUSED (not reset) by pushing the start forward, so the
      // player keeps whatever time they had left when the connection dropped.
      // The clock is ALWAYS paused the moment we lose contact — that protection
      // is immediate and never waits. But we only TELL the player once the
      // silence has lasted a couple of seconds. Between polls the sync age
      // routinely touches 2-4s on mobile, so showing it instantly made the
      // marker blink up during ordinary play for no reason anybody could see.
      if (isNet && syncAgeMs && syncAgeMs() > 4000) {
        turnStartRef.current += gap;                       // pause the countdown
        if (!heldSinceRef.current) heldSinceRef.current = now;
        if (now - heldSinceRef.current >= 2500) setTurnHeld(true);
        return;
      }
      heldSinceRef.current = 0;
      if (turnHeldRef.current) setTurnHeld(false);
      if (isHumanTurn) {
        // My turn — if I don't act in time it counts as a MISSED TURN.
        if (elapsed >= turnSecs) {
          firedRef.current = true;
          lastSkipTryRef.current = now;
          setGame((g) => {
            if (!g || g.winner) return g;
            // Didn't even roll → lose a chance (3 missed turns in a row = out).
            if (g.die === null) return missTurn(g);
            // Rolled but didn't PICK a token in time → the token must NEVER move by
            // itself, even when only one move is legal. Not selecting = a missed turn
            // (exactly like not rolling), so the player keeps full manual control.
            return missTurn(g);
          });
        }
      } else if (myIdx >= 0 && isNet) {
        // Anti-freeze: skip the current player only if THEIR device hasn't
        // advanced the turn well past their own window (so they're absent).
        const dist = (myIdx - game.turn + players.length) % players.length;
        // SINGLE WRITER, WIDELY STAGGERED. Previously EVERY other device fired just
        // 1s apart — shorter than the ~1.3s sync poll — so two or three devices
        // pushed the SAME state version, the board FORKED permanently (frozen game)
        // and each forked device then eliminated everyone but itself ("You Won" for
        // all). Now the NEXT player (dist 1) skips first, and later seats only act
        // as a FALLBACK 10s apart — far beyond the poll, so they can never collide,
        // yet the game still can't stall if the next player is ALSO absent.
        // Grace is generous so a brief disconnect is a RECONNECT, not an elimination.
        // HOW LONG BEFORE AN ABSENT PLAYER IS PASSED.
        //
        // These numbers used to be the ONLY protection against skipping someone
        // who was merely slow, so they were made long and widely staggered: 12s
        // grace and 10s between devices. In a FOUR-player game the furthest seat
        // therefore waited turnSecs + 32 — with a 15s turn that is 47 seconds of
        // staring at "0s" before the turn moved. Two players never felt it
        // (there is only ever one other device, at +12); four players felt it on
        // every absent turn. That is the "dice does not move to the next player"
        // report.
        //
        // Waiting is no longer how correctness is achieved: the SERVER's own
        // record of the last move (checked below) is what proves whether the
        // player is really playing, and it is exact. So the timers can come back
        // down to something players will tolerate, and the witness — not the
        // clock — is what protects an active player from being skipped.
        const deadline = turnSecs + 6 + (dist - 1) * 4;
        if (elapsed >= deadline) {
          // (3) The server is the witness — but it has to be the RIGHT witness,
          // asked the RIGHT question.
          //
          // THE WITNESS. `lastServerMoveAt` used to report the session's
          // `lastActiveAt`, which the server's abandoned-game reaper refreshes
          // on a timer for any room that still has people sitting in it. Every
          // poll therefore answered "somebody moved a moment ago" whether or not
          // anyone had touched the board, the test below was permanently true,
          // and no absent player could EVER be passed: the match sat on one
          // turn showing 0s until a player reloaded. That was the freeze the
          // client kept reporting, and it is why the earlier timing fixes never
          // cured it — they were all downstream of a witness that always lied.
          // It now reports `lastMoveAt`, written only when a player actually
          // pushes a board.
          //
          // THE QUESTION. Comparing the last-move time against the START of this turn
          // was wrong: the move that BEGAN this turn is itself activity at that
          // moment, so the test was true from the very first second and stayed
          // true for ever. Nobody could ever be skipped, and the board sat on one
          // player's turn showing "0s" until somebody reloaded the page — exactly
          // the freeze that was reported. What actually matters is whether the
          // server has seen a NEW move SINCE this turn began.
          const seenNow = lastServerMoveAt ? lastServerMoveAt() : 0;
          // NO BASELINE YET? Adopt the first real value instead of reading it as
          // "somebody just moved". The server's time is unknown (0) until the
          // first poll answers, so a turn that began before that — the opening
          // turn of a match, or any turn we land on straight after a reload —
          // recorded a baseline of 0. The first real timestamp then looked like
          // fresh activity and blocked the skip for the whole turn. And because a
          // frozen game never changes turn, the baseline stayed 0 and the block
          // never lifted: the same hang, surviving even a page reload.
          if (seenNow > 0 && serverSeenAtTurnStartRef.current === 0) serverSeenAtTurnStartRef.current = seenNow;
          const seenThen = serverSeenAtTurnStartRef.current;
          if (seenNow > 0 && seenNow > seenThen) return;
          firedRef.current = true;
          lastSkipTryRef.current = now;
          setGame((g) => {
            if (!g || g.winner) return g;
            if (currentColor(g) !== absent) return g; // turn already moved on — don't skip
            if (currentColor(g) === myColor) return g; // never skip myself
            return missTurn(g);
          });
        }
      }
    }, 1000);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVisible); };
  }, [turnKey, turnSecs, game.winner, game.players, game.turn, isHumanTurn, myColor, isNet, rolling, showResult, setGame, syncAgeMs, lastServerMoveAt, animStallMs, finishStalledAnimation]);

  // Capture/kill flash — the engine flags a capture in the move message.
  const [captureFlash, setCaptureFlash] = useState(false);
  useEffect(() => {
    if (game.message?.includes("captured") && animCapture) {
      setCaptureFlash(true);
      if (fxOn) { if (animSound) playCapture(); vibrate([40, 30, 70]); } // kill sound + strong buzz
      const t = setTimeout(() => setCaptureFlash(false), 900);
      return () => clearTimeout(t);
    }
  }, [game.message, fxOn, animCapture, animSound]);

  // Home-entry celebration burst (visual overlay) — set whenever a coin finishes.
  // `homeFxAt` is a timestamp; the bloom shows for a moment then auto-clears so the
  // big lotus NEVER stays stuck over the board (the reported "lotus stays in centre").
  const [homeFx, setHomeFx] = useState(0);
  const [homeFxAt, setHomeFxAt] = useState(0);
  useEffect(() => {
    if (!homeFxAt) return;
    const t = setTimeout(() => setHomeFx(0), centerHoldMs); // appear briefly, then disappear (admin speed)
    return () => clearTimeout(t);
  }, [homeFxAt, centerHoldMs]);
  // Winner celebration — fire the victory sound + haptics ONCE when the game ends.
  // The WINNER hears the fanfare; everyone else hears the (admin-controlled)
  // gentler "loser" sound instead.
  const winFxRef = useRef(false);
  useEffect(() => {
    if (game.winner && !winFxRef.current) {
      winFxRef.current = true;
      if (fxOn && animWin) {
        if (animSound) { if (game.winner === color) playWin(); else playLose(); }
        vibrate([60, 40, 60, 40, 140]);
      }
    } else if (!game.winner) {
      winFxRef.current = false;
    }
  }, [game.winner, color, fxOn, animWin, animSound]);

  // "It's your turn" ping — a soft notification the moment the turn becomes MINE
  // (admin-controlled "Notification sound"; skipped while the game is over).
  const prevMyTurnRef = useRef(false);
  useEffect(() => {
    const mine = isHumanTurn && !game.winner;
    if (mine && !prevMyTurnRef.current && animSound) playNotify();
    prevMyTurnRef.current = mine;
  }, [isHumanTurn, game.winner, animSound]);

  // Per-coin "reached home" alert. Fires ONCE for each coin the moment it finishes
  // (pos === HOME_END) — even when coins finish one-by-one — naming whose coin it
  // is and the running X/4 count. Seeds silently on first render (and on a fresh
  // round) so rejoining a game with coins already home never spams old alerts.
  const homeDoneRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    const homeNow = new Set(
      game.tokens.filter((t) => t.pos === HOME_END).map((t) => `${t.color}-${t.index}`),
    );
    if (homeDoneRef.current === null || homeNow.size < homeDoneRef.current.size) {
      homeDoneRef.current = homeNow; // first render, or a new round reset — no alert
      return;
    }
    for (const t of game.tokens) {
      if (t.pos !== HOME_END) continue;
      const k = `${t.color}-${t.index}`;
      if (homeDoneRef.current.has(k)) continue;
      const doneForColor = game.tokens.filter((x) => x.color === t.color && x.pos === HOME_END).length;
      const who = t.color === myColor ? "Your" : `${names[t.color] ?? LABEL[t.color]}'s`;
      toast(`🏠 ${who} coin reached home! (${doneForColor}/4)`, "success");
      // §4 centre-reach animation is admin-controllable (config.gameAnim.centerReach).
      if (fxOn) { if (animSound) playHome(); vibrate([30, 30, 30]); if (animCenter) { setHomeFx((n) => n + 1); setHomeFxAt(Date.now()); } }
    }
    homeDoneRef.current = homeNow;
  }, [game.tokens, names, myColor, toast, fxOn, animCenter, animSound]);

  // Group tokens by board cell so stacks fan out. While a token is HOPPING, draw
  // it at its animated cell (hop.path[hop.step]) instead of its committed pos.
  const byCell = new Map<string, Token[]>();
  for (const t of game.tokens) {
    const isHopping = hop != null && `${t.color}-${t.index}` === hop.key;
    const drawPos = isHopping ? hop.path[hop.step] : t.pos;
    const [r, c] = cellOf({ ...t, pos: drawPos });
    const key = `${r},${c}`;
    (byCell.get(key) ?? byCell.set(key, []).get(key)!).push(t);
  }


  // Tap a player to send them a gift directly.
  const { openGift, lastGiftFor } = useGift();

  // Voice + real avatars for the corner player cards.
  const voice = useVoice();
  const seatIds = useMemo(() => game.players.map((c) => seats[c]?.id).filter(Boolean) as string[], [game.players, seats]);
  const profiles = useUserProfiles(seatIds);
  const voiceById = useMemo(() => new Map(voice.participants.map((p) => [p.id, p])), [voice.participants]);

  // Each COLOUR's tokens are drawn in THAT player's chosen design — visible to
  // everyone (token picks are shared via the account). My own colour uses my local
  // pick so it shows instantly; others use their synced pick (from their profile),
  // falling back to the default lotus until it loads.
  const skinFor = useCallback((c: Color): string => {
    if (c === myColor && tokenSkin) return tokenSkin;
    const pid = seats[c]?.id;
    return (pid && profiles[pid]?.tokenSkin) || (c === myColor ? tokenSkin : "royal-lotus");
  }, [myColor, tokenSkin, seats, profiles]);
  const imageFor = useCallback((c: Color): string | undefined => customTokenImage(skinFor(c), appConfig.tokenDesigns, c), [skinFor, appConfig.tokenDesigns]);

  // Gift recipients = everyone ELSE in the voice/gaming room (so you can gift any
  // member, not just one person). Falls back to the other players by name.
  const giftRecipients = useMemo(() => {
    const set = new Set<string>();
    voice.participants.forEach((p) => { if (!p.isLocal && p.name) set.add(p.name); });
    if (set.size === 0) {
      game.players.forEach((p) => { if (p !== myColor && names[p] && names[p] !== "—") set.add(names[p]); });
    }
    return [...set];
  }, [voice.participants, game.players, names, myColor]);

  // ── DICE look & "last rolled" (admin-controlled) ──────────────────────────
  // The die is IDLE before a roll — it must never sit showing a "1" or any other
  // number. Idle ALWAYS shows the LOTUS image (client requirement): the admin's
  // uploaded face picture when one is set, else the built-in lotus.
  const diceCfg = appConfig.gameDice ?? {};
  const diceFaceImg = diceCfg.customFace && diceCfg.faceImage ? withBaseSrc(diceCfg.faceImage) : withBase("/tokens/lotus-red.png");
  const showLastRolled = diceCfg.showLastRolled !== false;
  // `shownDie` = the number to KEEP on the die face for the current turn. Once a
  // player rolls, the die keeps showing that number (pips) even after they move,
  // for EVERY player and spectator — not just a separate label. It resets when the
  // turn passes to the next player, so a new player's die starts clean (never a
  // "1"). DERIVED straight from the SHARED state (identical on every device):
  // lastRoll updates on every single roll, so back-to-back sixes refresh it
  // reliably (the old turn-diff state machine could miss the second six — the
  // reported "double six not displayed correctly"). The `turnFloor` remembers the
  // roll counter when the CURRENT player's turn segment began, so a roll from
  // their PREVIOUS turn can never re-appear when the turn cycles back to them.
  const turnFloorRef = useRef<{ color: Color; n: number }>({ color, n: game.lastRoll?.n ?? 0 });
  if (turnFloorRef.current.color !== color) turnFloorRef.current = { color, n: game.lastRoll?.n ?? 0 };
  const shownDie = game.die ?? (game.lastRoll && !game.lastRoll.spent && game.lastRoll.by === color && game.lastRoll.n > turnFloorRef.current.n ? game.lastRoll.value : null);
  // What the die face should show RIGHT NOW (one shared rule, every device):
  //   mid-tumble → the shuffling face; otherwise ONLY the shared game state —
  //   the current player's rolled number (die while picking a token; shownDie
  //   holds it through an extra turn). NULL = IDLE → the die shows the LOTUS
  //   image. Landed results always equal the state's own number, so no local
  //   animation leftover (e.g. a hold from the PREVIOUS roller) can ever paint
  //   a wrong or stale number — the die always resets to the lotus on turn pass.
  const dieFaceNow = rolling ? rollFace : (game.die ?? shownDie);
  const diceIdle = dieFaceNow == null;
  const lastRolled = shownDie; // the number shown in the separate "ROLLED" indicator

  // TURN ANIMATION — the active player's profile picture. Computed once per render
  // and handed only to the avatar whose turn it is, so exactly ONE avatar on screen
  // ever carries an animation class (see lib/turn-anim.ts for the rules).
  // `rolling || showResult` + `shownDie`: from the instant the dice starts rolling
  // until the turn actually passes, the avatar is COMPLETELY STILL — only the dice
  // animates, the profile picture/frame never shakes (client requirement).
  const turnAnimOn = turnAnimActive({ isTurn: true, rolling: rolling || showResult, die: game.die ?? shownDie, finished: !!game.winner });
  const turnAnimCls = (isTurn: boolean) => turnAnimClass(ga, isTurn && turnAnimOn);
  // Whether the rolling player's picture moves WHILE the dice rolls. This was
  // hard-coded on ("turn-anim-shake"), which is the shaking that was reported.
  // Now an admin switch (/admin/animations), OFF by default, with its own style.
  const rollShakeCls = ga.rollShake === true && !game.winner
    ? `turn-anim-${ga.rollShakeStyle ?? "shake"}`
    : "";

  // A corner player card: avatar, online dot, mic, turn highlight.
  // Compact corner player card (matches a real Ludo app): avatar with a coloured
  // ring, a mic button on the outer side, an online-strength dot row, and a glow
  // when it's their turn.
  const renderPlayer = (p: Color, pos: "tl" | "tr" | "bl" | "br") => {
    const out = game.removed.includes(p);
    const isTurn = p === color && !game.winner;
    const seat = seats[p];
    const prof = seat ? profiles[seat.id] : undefined;
    const mine = !!seat?.id && seat.id === myId;
    const vp = seat ? voiceById.get(seat.id) : undefined;
    const online = !!vp;
    const speaking = !!vp?.isSpeaking;
    const micMuted = mine ? voice.muted : vp ? vp.muted : true;
    const isLeft = pos === "tl" || pos === "bl";
    const isTop = pos === "tl" || pos === "tr";
    const dots = (
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className={cn("size-1.5 rounded-full", online ? "bg-emerald-400" : "bg-white/25")} />
        ))}
      </div>
    );
    const mic = (
      <button
        onClick={() => { if (mine && !voice.forceMuted) { voice.setMuted(!voice.muted); voice.startAudio(); } }}
        disabled={!mine}
        title={mine ? (micMuted ? "Unmute" : "Mute") : micMuted ? "Muted" : "Speaking"}
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-lg text-white shadow transition",
          micMuted ? "bg-sky-500" : "bg-emerald-500",
          mine ? "cursor-pointer hover:brightness-110" : "cursor-default opacity-90",
        )}
      >
        {micMuted ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
      </button>
    );
    // 🔊 SPEAKER OFF — a SEPARATE control from the 🎤 mic above. It only stops
    // THIS player's audio on MY device: their microphone keeps running and every
    // other player still hears them normally. Shown for other players only.
    const spkOff = !!seat?.id && !mine && voice.isSpeakerOff(seat.id);
    const spk = seat?.id && !mine ? (
      <button
        onClick={() => { if (seat.id) voice.setSpeakerOff(seat.id, !spkOff); }}
        title={spkOff ? `🔊 Speaker On — hear ${names[p]} again (your device only)` : `🔊 Speaker Off — stop hearing ${names[p]} on your device only (their mic stays on)`}
        aria-label={spkOff ? "Speaker On" : "Speaker Off"}
        className={cn(
          "grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg text-white shadow transition hover:brightness-110",
          spkOff ? "bg-rose-500" : "bg-slate-600",
        )}
      >
        {spkOff ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
      </button>
    ) : null;
    // The DICE sits right BESIDE the avatar, on the inner side (toward the board
    // centre), for WHOEVER's turn it is — so the roll control is always next to the
    // active player's profile picture. On my own turn it's a big tappable Roll
    // button; for another player it shows their live roll + the turn timer. When it
    // is NOT this player's turn we render a same-size spacer so the row never
    // reflows (the board stays perfectly still when the turn changes).
    // The DICE itself carries ONLY the rolling animation + the dice face. The
    // rolled VALUE is shown in its own separate indicator beside it (below), so a
    // number is never overlaid on the die — that read as part of the dice and was
    // easy to confuse with the face. Game rules and dice logic are untouched.
    const turnDice = isTurn && !game.winner ? (
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={canRoll ? roll : undefined}
          disabled={!canRoll}
          aria-label={canRoll ? "Tap to roll the dice" : "Dice"}
          className={cn(
            "relative block shrink-0 rounded-xl outline-none transition",
            canRoll ? "animate-turn-glow cursor-pointer hover:scale-110 active:scale-95" : "cursor-default",
          )}
        >
          <Die
            face={(dieFaceNow ?? 1) as 1 | 2 | 3 | 4 | 5 | 6}
            // IDLE (before the roll / after the turn passed) → the LOTUS image,
            // never a number. AFTER a roll it keeps showing the rolled number
            // (via shownDie above) until the turn moves to the next player.
            blank={diceIdle && !diceFaceImg}
            // Idle shows the admin's lotus face; once rolled, a dice DESIGN that
            // carries uploaded art shows that art instead of drawn pips.
            faceImage={diceIdle ? diceFaceImg : dieSkin.image}
            surface={dieSkin.surface}
            pipClass={dieSkin.pip}
            model={diceModel}
            className={cn(
              // Grow while rolling, shrink back once it lands (smooth transition).
              "transition-[width,height] duration-200",
              rolling ? "size-16 sm:size-[5.5rem]" : "size-12 sm:size-16",
              rolling && diceRollCls, diceIdle && !rolling && "opacity-80", canRoll && "ring-4 ring-sky-300/80",
              fxOn && !rolling && dieFaceNow === 6 && "ring-4 ring-gold-300 drop-shadow-[0_0_16px_rgba(250,204,21,0.98)]",
            )}
          />
          {/* LUCKY 6 — a gold ⚡ badge + glow (roll again!), a premium touch. */}
          {fxOn && !rolling && game.die === 6 && (
            <span className="pointer-events-none absolute -right-2 -top-2 z-10 grid size-6 place-items-center rounded-full bg-gold-400 text-sm font-black text-ink-900 shadow ring-2 ring-white animate-win-burst">⚡</span>
          )}
          {/* Turn COUNTDOWN — a clock icon + seconds so it never reads as a dice
              value (a bare "8" on the die looked like an impossible roll of 8). */}
          {/* The countdown, and what happens to it when the connection drops.
              It used to swap the number for the word "held" — which a player has
              no way to interpret (the client asked why "Hold" had appeared on
              the dice). It now keeps the SECONDS, simply frozen, and swaps the
              clock icon for a pause icon: the number stopping is the message,
              and a pause symbol needs no translation. */}
          <span
            title={turnHeld ? "Connection is slow — your countdown is paused and your turn is safe" : undefined}
            className={cn("pointer-events-none absolute -bottom-2 left-1/2 inline-flex -translate-x-1/2 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold leading-tight tabular-nums shadow", turnHeld ? "bg-amber-500 text-white" : timeLeft <= 5 ? "animate-pulse bg-rose-500 text-white" : "bg-black/75 text-white")}
          >
            {turnHeld ? <Pause className="size-2.5" /> : <Timer className="size-2.5" />}{`${timeLeft}s`}
          </span>
        </button>

        {/* ROLLED NUMBER — a SEPARATE indicator, never drawn on the die. It holds
            the last rolled value until the next roll replaces it, so every player
            can always read what was rolled. ALWAYS MOUNTED at a fixed width and
            merely hidden mid-spin/before a roll — mounting/unmounting it resized
            the row and made the avatar beside it jump ("profile shakes while the
            dice is rolling"). */}
        {showLastRolled && (
          <span
            className={cn("pointer-events-none flex w-7 shrink-0 flex-col items-center leading-none", (lastRolled == null || rolling) && "invisible")}
            title={lastRolled != null ? `Last rolled: ${lastRolled}` : undefined}
          >
            <span className="text-[8px] font-bold uppercase tracking-wider text-white/55">Rolled</span>
            <span className="mt-0.5 grid min-w-[22px] place-items-center rounded-md bg-black/75 px-1 py-0.5 font-display text-sm font-black tabular-nums text-white ring-1 ring-white/25">
              {lastRolled ?? "•"}
            </span>
          </span>
        )}
      </div>
    ) : rollFlash && rollFlash.by === p && !game.winner ? (
      // NOT this player's turn, but they JUST rolled — show their rolled dice on
      // their own card for a moment. This is what lets opponents verify a "no move"
      // roll (the die passes too fast on those). Same size as the spacer → no
      // reflow; the pips ARE the value, so it needs no extra label.
      <div className="flex size-12 shrink-0 items-center justify-center sm:size-16" title={`${mine ? "You" : names[p] ?? LABEL[p]} rolled ${rollFlash.value}`}>
        <Die face={rollFlash.value as 1 | 2 | 3 | 4 | 5 | 6} surface={dieSkin.surface} pipClass={dieSkin.pip} model={diceModel} className="size-9 animate-roll-pop opacity-95 ring-2 ring-sky-300/70 sm:size-11" />
      </div>
    ) : (
      <div className="size-12 shrink-0 sm:size-16" aria-hidden />
    );
    // "Chances" left before a player is removed — drops by one each missed turn.
    const chances = chancesLeft(game, p);
    const chancesRow = (
      <div className="flex items-center gap-0.5" title={`${chances} chance${chances === 1 ? "" : "s"} left`}>
        {Array.from({ length: MAX_MISSES }).map((_, i) => (
          <Heart key={i} className={cn("size-3", i < chances ? "fill-rose-500 text-rose-500" : "fill-none text-white/30")} />
        ))}
      </div>
    );
    return (
      <div className={cn("flex flex-col items-center gap-1", out && "opacity-50")}>
        {isTop && dots}
        <div className={cn("flex items-center gap-1.5", !isLeft && "flex-row-reverse")}>
          {mic}
          {spk}
          <button onClick={() => openGift([names[p]], names[p], roomId)} title={`Gift ${names[p]}`} className="relative shrink-0">
            {isTurn && <span className={cn("absolute -inset-1 rounded-full bg-gradient-to-br opacity-90 blur-[3px]", TOKEN[p], "animate-turn-glow")} />}
            {/* TURN ANIMATION — ONLY the player whose turn it is animates; every other
                avatar stays perfectly still. It begins the moment the turn starts and
                stops the instant the roll lands (turnAnimActive). Style + on/off come
                from the admin (/admin/animations). Driven by the SHARED game state, so
                all players see the same avatar moving at the same time. The glowing
                ring above stays for the whole turn, even when the style is "None". */}
            <span className={cn("relative block rounded-full bg-gradient-to-br p-[3px]", TOKEN[p], isTurn && "ring-2 ring-sky-300", turnAnimCls(isTurn), isTurn && rolling && rollShakeCls)}>
              {/* Purchased profile FRAME — same as everywhere else in the app, and
                  kept live during gameplay by the profiles poll (equip/expiry).
                  Admin can hide frames for the Ludo module (Frames & Badges
                  Visibility) — gated here. */}
              <Avatar name={names[p]} src={prof?.avatar} size="lg" frameImage={framesOnIn(appConfig, "ludo") && prof?.equippedFrame ? frameImageOf(appConfig, prof.equippedFrame) : undefined} />
            </span>
            <span className={cn("absolute bottom-0 right-0 size-3.5 rounded-full ring-2 ring-ink-950", online ? "bg-emerald-400" : "bg-mist-500")} />
            {/* Player LEVEL badge (+ a VIP crown for high levels) — real level from
                the account, so the corner cards show a proper player profile. */}
            {prof?.level != null && (
              <span className="pointer-events-none absolute -right-1.5 -top-1.5 z-10 inline-flex items-center gap-0.5 rounded-full bg-gradient-to-br from-amber-300 to-yellow-600 px-1 py-0.5 text-[8px] font-black leading-none text-ink-900 shadow ring-1 ring-white/70" title={`Level ${prof.level}`}>
                {prof.level >= 20 && <Crown className="size-2" />}Lv{prof.level}
              </span>
            )}
            {speaking && <span className="pointer-events-none absolute -inset-1 animate-pulse-ring rounded-full ring-2 ring-emerald-400" />}
            {lastGiftFor(names[p]) && <span className="absolute -left-1 -top-1 text-base leading-none">{lastGiftFor(names[p])}</span>}
            <GiftBurst name={names[p]} />
          </button>
          {/* Dice beside the profile picture, on the inner side (toward centre). */}
          {turnDice}
        </div>
        <p className="max-w-28 truncate rounded-full bg-black/45 px-2 py-0.5 text-[13px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">{mine ? "You" : names[p]}</p>
        {chancesRow}
        {!isTop && dots}
      </div>
    );
  };

  const has = (c: Color) => game.players.includes(c);

  // Does any of MY movable coins land exactly on home with the number I rolled?
  // Drives a clear "finish" nudge so a home-stretch coin is never overlooked.
  const canFinishNow =
    isHumanTurn &&
    game.die !== null &&
    [...movable].some((idx) => {
      const t = game.tokens.find((x) => x.color === color && x.index === idx);
      return !!t && t.pos + game.die! === HOME_END;
    });
  const statusText = game.winner
    ? `${names[game.winner]} wins! 🎉`
    : rolling
      ? "Rolling the dice…"
      : canRoll
        ? "Tap the dice to roll"
        : isHumanTurn && game.die !== null
          ? canFinishNow
            ? "🏁 Tap the flagged coin to bring it home!"
            : "Tap a glowing token"
          : `Waiting for ${names[color]}…`;

  // PERFORMANCE: the 102 path cells are completely static for a given theme +
  // admin board settings. Memoising them means dice-tumble ticks, the 1s turn
  // timer and the token walk no longer re-render the whole grid every frame —
  // a large chunk of the "game is very slow on my phone" report.
  const pathCellsEl = useMemo(() => PATH_CELLS.map(([r, c]) => {
    const key = `${r},${c}`;
    const ringIdx = RING_AT.get(key);
    const startColor = START_COLOR.get(key);
    const homeColor = HOME_CELL.get(key);
    const homeStep = HOME_STEP.get(key); // boxes-to-home label (5→1)
    const isSafe = ringIdx !== undefined && isSafeCell(ringIdx);
    // Element table: "hide"/"transparent" on the grid, board surface or cell border
    // change only what is PAINTED — every square keeps its place, so the coins,
    // the safe rule and the whole engine are untouched.
    const showBorderHere = boxBorder && visCellBorder !== "hide" && visGrid !== "hide";
    const borderFaded = visCellBorder === "transparent" || visGrid === "transparent";
    const surfaceOff = fullBoard || visBoard === "hide" || visBoard === "transparent";
    return (
      <div
        key={`cell-${key}`}
        style={{
          gridRow: r + 1, gridColumn: c + 1,
          ...(showBorderHere && borderColor && !borderFaded ? { borderColor } : {}),
          ...(borderFaded ? { borderColor: "rgba(255,255,255,0.08)" } : {}),
        }}
        className={cn(
          "relative z-[1] grid place-items-center rounded-[2px]",
          // With a full custom board image (or the board surface switched off),
          // path cells go transparent so the uploaded art is the surface.
          surfaceOff ? "" : cn(
            // Box Border (admin) — outline on/off + optional custom colour.
            // Default lines strengthened for a clearer, crisper grid.
            showBorderHere && (borderColor || borderFaded ? "border" : cn("border", boardTheme.dark ? "border-white/25" : "border-black/30")),
            // Box Highlight (admin) — coloured home-column / start-cell tint on/off.
            boxHighlight
              ? (homeColor ? HOME_TINT[homeColor] : startColor ? `bg-gradient-to-br ${TOKEN[startColor]}` : boardTheme.cell)
              : boardTheme.cell),
          // Border kept even on a custom board when the admin asked for a grid.
          surfaceOff && showBorderHere && "border",
        )}
      >
        {isSafe && !startColor && (safeStar.show || safeStar.showTint) && (
          <span className="relative grid size-full place-items-center">
            {/* Safe-zone HIGHLIGHT — a distinct tint + ring so the protected squares
                are instantly readable even with effects off. "Gameplay only"
                visibility keeps THIS while dropping the star. */}
            {safeStar.showTint && (
              <>
                <span className="pointer-events-none absolute inset-[6%] rounded-[3px]" style={{ backgroundColor: safeStar.color, opacity: 0.16, boxShadow: `inset 0 0 0 1.5px ${safeStar.color}` }} />
                {fxOn && <span className="pointer-events-none absolute inset-[16%] rounded-full animate-pulse" style={{ backgroundColor: safeStar.color, opacity: 0.28 }} />}
              </>
            )}
            {safeStar.show && (safeStar.iconMode === "custom" && safeStar.icon ? (
              // Admin-chosen safe-cell icon (e.g. a lotus), replacing the star.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={withBaseSrc(safeStar.icon)} alt="" draggable={false} className="relative size-3/4 select-none object-contain" style={safeStarStyle(safeStar, true)} />
            ) : (
              <Star className="relative size-2/3" style={safeStarStyle(safeStar, false)} fill="currentColor" />
            ))}
          </span>
        )}
        {/* Boxes-to-home hint on the coloured home path — shown as a
            small coloured "steps-to-home" coin (5 → 1) so the home
            stretch looks designed AND the meaning is clear: it's the
            EXACT number of squares a coin still needs to finish. */}
        {homeStep !== undefined && visNumbers !== "hide" && (
          <span
            title={`${homeStep} square${homeStep === 1 ? "" : "s"} to home`}
            style={{ ...(visNumbers === "transparent" ? { opacity: 0.15 } : {}), ...(contentCss ? { transform: contentCss } : {}) }}
            className={cn(
              "pointer-events-none grid size-3/4 select-none place-items-center rounded-full text-[8px] font-black leading-none text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.45)] sm:text-[11px]",
              homeColor ? `bg-gradient-to-br ${TOKEN[homeColor]}` : "bg-black/40",
            )}
          >
            {homeStep}
          </span>
        )}
        {/* Clear START marker: an arrow on each colour's entry cell
            showing where its coins begin and which way they travel. */}
        {startColor && showArrow && visArrow !== "hide" && (
          <span
            title={`${LABEL[startColor]} coins start here`}
            style={visArrow === "transparent" ? { opacity: 0.15 } : undefined}
            className="grid size-4/5 place-items-center rounded-full bg-black/35 ring-1 ring-white/80 shadow-[0_1px_3px_rgba(0,0,0,0.45)]"
          >
            <ArrowRight
              className="size-2/3 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
              strokeWidth={3}
              style={{ transform: `rotate(${START_DIR[startColor]}deg)` }}
            />
          </span>
        )}
      </div>
    );
  }), [boxBorder, borderColor, fullBoard, boardTheme, boxHighlight, fxOn, contentCss, showArrow, safeStar, adminSafeCells, visGrid, visBoard, visCellBorder, visArrow, visNumbers]);

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto overscroll-contain"
      style={{ background: theme.bg }}
    >
      {/* In-game ACTIVITY feed + listener JOIN-APPROVAL (host/co-host). Real-time
          room activity as alerts, and Approve/Reject for listeners who ask to join
          while the host is playing. Only in networked (real room) games. */}
      {isNet && roomId && myId && <GameActivityPanel roomId={roomId} myId={myId} playerIds={seatIds} />}
      {/* §7 optional background image, layered faintly BEHIND everything so the
          board + coins stay clearly readable. */}
      {theme.bgImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={withBaseSrc(theme.bgImage)} alt="" draggable={false} className="pointer-events-none fixed inset-0 size-full select-none object-cover opacity-20" />
      )}
      {/* Diamond gaming pattern (full screen) — tinted by the theme accent. */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.14]"
        style={{ backgroundImage: `repeating-linear-gradient(45deg, ${theme.accent} 0 2px, transparent 2px 18px), repeating-linear-gradient(-45deg, ${theme.accent} 0 2px, transparent 2px 18px)` }}
      />

      <div className="relative z-10 mx-auto flex min-h-full max-w-4xl flex-col gap-2 px-0.5 py-2 sm:px-2 sm:py-3">
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
        {/* Responsive top bar: wraps to a second line on narrow phones so NO control
            is ever cut off (client: some menu options were hidden on mobile). */}
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={() => requestQuit("leave")} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-white/20 sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-sm">
              <ArrowLeft className="size-3.5 sm:size-4" /> Leave
            </button>
            {/* REFRESH — reconnects to the SAME game without leaving it. It asks
                the server for the current board and puts it straight back on
                screen, so a player never has to reload the page and find the
                room again. The turn, the dice and everyone's positions are held
                on the server, so nothing is lost. */}
            {isNet && (
              <button
                onClick={async () => {
                  if (refreshing) return;
                  setRefreshing(true);
                  // Clear any local animation that could be holding the board,
                  // then pull the authoritative state. This used to poke
                  // `hopRef.current` directly, which did nothing at all — that
                  // ref is reassigned from `hop` on every render, so a stuck
                  // token walk survived the very button meant to clear it.
                  // finishStalledAnimation() cancels the timers, completes any
                  // half-finished roll and clears all three flags for real.
                  finishStalledAnimation();
                  try { await onResync?.(); toast("Game refreshed — you're back in sync.", "success"); }
                  catch { toast("Could not reach the server — trying again automatically.", "error"); }
                  setRefreshing(false);
                }}
                disabled={refreshing}
                title="Reconnect to this game without leaving it"
                className="inline-flex items-center gap-1 rounded-full bg-sky-500/20 px-2.5 py-1 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/30 disabled:opacity-60 sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-sm"
              >
                <RotateCcw className={cn("size-3.5 sm:size-4", refreshing && "animate-spin")} /> {refreshing ? "Refreshing…" : "Refresh"}
              </button>
            )}
            {/* PAGE REFRESH — the stronger option, beside the quick one.
                "Refresh" re-asks the server for the board; this reloads the whole
                screen, which also clears anything stuck in the browser itself.
                The room is part of the address and the game lives on the server,
                so the page comes straight back to THIS game with the same turn,
                dice and positions — the player never has to find the room again.
                Any move already made is on the server before this runs. */}
            {isNet && (
              <button
                onClick={() => {
                  if (reloading) return;
                  setReloading(true);
                  // Keep the address exactly as it is (it carries the room), and
                  // drop any one-time "?join=1" so we return as a player, not as
                  // somebody accepting an invitation again.
                  try {
                    const u = new URL(window.location.href);
                    u.searchParams.delete("join");
                    window.location.replace(u.toString());
                  } catch {
                    window.location.reload();
                  }
                }}
                disabled={reloading}
                title="Reload the whole screen and come straight back to this game"
                className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/30 disabled:opacity-60 sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-sm"
              >
                <RefreshCw className={cn("size-3.5 sm:size-4", reloading && "animate-spin")} /> {reloading ? "Reloading…" : "Page Refresh"}
              </button>
            )}
            {/* Back to Room — go to the voice room WITHOUT leaving the match, so you can
                return to the game. Only on room (net) games. */}
            {onBackToRoom && (
              <button onClick={() => onBackToRoom()} title="Go to the room — you stay in the match and can return" className="inline-flex items-center gap-1 rounded-full bg-emerald-500/80 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-emerald-500 sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-sm">
                <Home className="size-3.5 sm:size-4" /> Room
              </button>
            )}
            {/* HOST / CO-HOST only: end the match for EVERYONE (with confirm). The
                escape hatch for a match that won't finish on its own. — smaller now. */}
            {canEndGame && onEndGame && (
              <button onClick={() => setConfirm("end")} title="End this match for all players" className="inline-flex items-center gap-1 rounded-full bg-rose-500/85 px-2 py-1 text-xs font-semibold text-white transition hover:bg-rose-500">
                <Ban className="size-3.5" /> End
              </button>
            )}
          </div>
          <div className="flex flex-col items-center leading-tight">
            <div className="flex items-center gap-1.5 font-display text-sm font-extrabold text-white"><LotusMark className="size-5" /> Lotus Ludo <span className="text-[9px] font-semibold text-white/40">{APP_VERSION}</span></div>
            {roomName && <span className="max-w-32 truncate text-[10px] text-white/60">🏠 {roomName}</span>}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <FxToggle />
            <SoundToggle />
            {/* BOARD ORIENTATION — ROTATE the board a quarter-turn at a time.
                Four turns reach every corner, so YOUR home can sit anywhere.
                It is deliberately a rotation and never a mirror: mirroring made
                the coins LOOK like they ran anticlockwise and reversed the
                cutting / safe / finishing squares on screen. A rotation cannot,
                so the path and every rule stay exactly as they are.
                Personal view only — nothing is sent to the other players. */}
            <button
              onClick={() => setView({ rotation: (((view.rotation + 180) % 360) as 0 | 90 | 180 | 270) })}
              title={view.rotation === 180 ? "Board turned end-for-end — tap to turn back" : "Turn the board end-for-end"}
              aria-pressed={view.rotation === 180}
              className={cn("grid size-9 place-items-center rounded-full transition", view.rotation === 180 ? "bg-lotus-500 text-white" : "bg-white/10 text-white hover:bg-white/20")}
            >
              <ArrowDownToLine className="size-4" />
            </button>
            <button
              onClick={() => setView({ rotation: (((view.rotation + 90) % 360) as 0 | 90 | 180 | 270) })}
              title={`Rotate the board a quarter-turn (now ${view.rotation}°)`}
              aria-pressed={view.rotation !== 0}
              className={cn("grid size-9 place-items-center rounded-full transition", view.rotation !== 0 ? "bg-lotus-500 text-white" : "bg-white/10 text-white hover:bg-white/20")}
            >
              <ArrowLeftRight className="size-4" />
            </button>
            {/* One tap: put MY home in the bottom-left / bottom-right corner. Works
                for every colour, because it computes the flips needed for yours. */}
            {myColor && (
              <button
                onClick={() => {
                  const here: Corner = myColor === corners.bottomLeft ? "bottomLeft" : myColor === corners.bottomRight ? "bottomRight" : "bottomRight";
                  // Already bottom-left → send it bottom-right, and vice versa.
                  const target: Corner = here === "bottomLeft" && myColor === corners.bottomLeft ? "bottomRight" : "bottomLeft";
                  setView(viewForCorner(myColor, target));
                }}
                title="Put my home in the bottom corner (tap again to swap left ⇄ right)"
                className="grid h-9 place-items-center rounded-full bg-white/10 px-3 text-[11px] font-bold text-white transition hover:bg-white/20"
              >
                My home ↓
              </button>
            )}
            {/* These three lead away from the match. They now carry the game's
                own address, so wherever they land there is a "Return to game"
                button waiting — a player is never stranded and never has to find
                the room again. The match keeps running on the server meanwhile. */}
            <Link href={withGameReturn("/customize")} title="Settings" className="grid size-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"><Settings className="size-4" /></Link>
            <Link href={withGameReturn("/tournaments")} title="Tournaments" className="grid size-9 place-items-center rounded-full bg-white/10 text-gold-300 transition hover:bg-white/20"><Trophy className="size-4" /></Link>
            <Link href={withGameReturn("/lucky-spin")} title="Rewards" className="grid size-9 place-items-center rounded-full bg-white/10 text-lotus-300 transition hover:bg-white/20"><Crown className="size-4" /></Link>
          </div>
        </div>

        {/* When the game is over: an ALWAYS-VISIBLE bar so the player can return
            to the room or start a new round (works even if the popup is missed). */}
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
              onClick={() => winArmed && (onPlayAgain ? onPlayAgain() : setGame(createGame(game.players)))}
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

        {/* Top corners: red (top-left) · turn indicator · green (top-right).
            The dice now appears right BESIDE whichever player's turn it is
            (see renderPlayer), so the centre just shows whose turn it is. */}
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-16">{has(tlC) && renderPlayer(tlC, "tl")}</div>
          <div className="flex flex-col items-center justify-center gap-1 px-1 pt-1 text-center">
            {game.winner ? (
              <span className="rounded-full bg-emerald-500/80 px-2.5 py-1 text-xs font-semibold text-white">{names[game.winner]} wins! 🎉</span>
            ) : (
              <span className={cn("rounded-full px-3 py-1 text-xs font-bold text-white shadow", canRoll ? "animate-pulse bg-sky-500" : "bg-black/45")}>
                {canRoll ? "🎲 Your turn!" : isHumanTurn ? "Pick a token" : `${names[color]}'s turn`}
              </span>
            )}
          </div>
          <div className="flex min-w-16 justify-end">{has(trC) && renderPlayer(trC, "tr")}</div>
        </div>

        {/* Floating, ALWAYS-VISIBLE player CONTROL. Personal bottom-LEFT / bottom-
            RIGHT choice (saved per device, NOT shared) so the game plays comfortably
            one-handed on mobile without reaching the top. When it's your turn to roll,
            the pill BECOMES the roll button (tap it to roll from the corner); otherwise
            it shows whose turn it is + the timer. The ⇄ flips which corner it sits in. */}
        {/* Floating turn / roll control — CENTRED at the bottom so it sits in the
            gap between the two bottom player cards and never covers a player's DICE
            (which sits beside each avatar). Previously it hugged the bottom-left or
            bottom-right, overlapping that corner player's dice. */}
        {!game.winner && (
          <div
            className={cn(
              "fixed bottom-20 left-1/2 z-[63] flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/15 py-1.5 pl-3 pr-3 shadow-[0_6px_20px_rgba(0,0,0,0.55)] backdrop-blur-md transition-[background-color]",
              canRoll ? "bg-sky-500/95" : "bg-black/75",
            )}
          >
            <span className={cn("size-3.5 shrink-0 rounded-full bg-gradient-to-br shadow ring-1 ring-white/40", TOKEN[color])} />
            {canRoll ? (
              <button
                onClick={roll}
                disabled={rolling || !!hop}
                title="Tap to roll the dice"
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-xs font-extrabold text-white transition hover:bg-white/35 active:scale-95 disabled:opacity-60"
              >
                <span className="grid size-5 animate-bounce place-items-center rounded-md bg-white text-[13px] leading-none">🎲</span>
                Roll
              </button>
            ) : (
              <span className="whitespace-nowrap text-xs font-bold text-white">
                {isHumanTurn ? "🎯 Your move — tap a token" : `⏳ ${names[color]}'s turn`}
              </span>
            )}
            {turnHeld ? (
              <span className="shrink-0 text-[11px] font-semibold text-amber-300">Connection slow — timer paused, your turn is safe</span>
            ) : (
              <span className={cn("shrink-0 text-[11px] font-semibold tabular-nums", timeLeft <= 5 ? "text-rose-300" : "text-white/65")}>{timeLeft}s</span>
            )}
          </div>
        )}

        {/* Board — full width */}
        <div className="mx-auto w-full">
          <div
            className="relative aspect-square w-full rounded-2xl p-1 shadow-[0_28px_70px_-16px_rgba(0,0,0,0.9),inset_0_2px_10px_rgba(255,255,255,0.2),inset_0_-6px_16px_rgba(0,0,0,0.35)] ring-1 ring-white/10 sm:p-2"
            style={{ background: frameColor || boardTheme.frame }}
          >
            {/* The board ART stays fixed at full size, and the 15x15 GRID is
                positioned on top of it by the admin's alignment settings. That
                separation is the whole point: with a custom board the painted
                squares never line up with a grid stretched across the whole
                image, so the grid has to be movable. Because the coins are
                CHILDREN of this grid, moving it moves the cells and the coins
                together — there is no separate coin alignment to keep in sync.
                Defaults (0/0/100/100) reproduce the original layout exactly. */}
            {/* THE WHOLE BOARD ROTATES AS ONE PIECE.
                The rotation lives HERE, on the wrapper that holds both the
                uploaded board picture and the 15×15 grid — not on the grid alone.
                When only the grid turned, the artwork stayed put while the home
                yards moved over it, so a red frame ended up on the gold lotus and
                vice versa: "only a specific area changes instead of the whole
                player area". Rotating the wrapper keeps the picture and the grid
                locked together, exactly as they are when the board is upright. */}
            <div className="relative size-full" style={{ transform: boardTransformCss }}>
              {fullBoard && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={withBaseSrc(fullBoard)} alt="" draggable={false} className="pointer-events-none absolute inset-0 z-0 size-full select-none rounded-lg" style={{ opacity: fullBoardOpacity, objectFit: fullBoardFit, objectPosition: "center", transform: `translate(${fullBoardOffX}%, ${fullBoardOffY}%) scale(${fullBoardScale})` }} />
              )}
            <div
              className="absolute grid gap-px rounded-lg p-0.5 sm:p-1"
              style={{
                left: `${ludoGrid.leftPct}%`,
                top: `${ludoGrid.topPct}%`,
                width: `${ludoGrid.widthPct}%`,
                height: `${ludoGrid.heightPct}%`,
                background: fullBoard ? "transparent" : boardTheme.boardBg,
                gridTemplateColumns: "repeat(15,minmax(0,1fr))",
                gridTemplateRows: "repeat(15,minmax(0,1fr))",
              }}
            >
              {/* Corner yards with the player's name */}
              {game.players.map((p) => {
                const ha = homeArea(p);
                // Element table can also hide / fade the home area and its white
                // token box — appearance only, the parked coins always still render.
                const homeHidden = visHomeArea === "hide";
                const homeFaded = visHomeArea === "transparent";
                const bgHidden = elementVis(appConfig, "tokenAreaBg") === "hide";
                const bgFaded = elementVis(appConfig, "tokenAreaBg") === "transparent";
                const boxStyle = bgHidden ? null : homeAreaBoxStyle(ha);
                const whiteBox = !bgHidden && !bgFaded && usesDefaultWhiteBox(ha);
                return (
                <div
                  key={`yard-${p}`}
                  className={cn(
                    "relative flex flex-col gap-1 rounded-xl border-2 p-1.5",
                    ha.showBorder && !homeHidden ? YARD_BG[p] : "border-transparent", // hide the white/coloured home box so a custom board's art shows
                    p === color && "ring-2 ring-white/70",
                  )}
                  style={{
                    gridRow: CORNER[p].row, gridColumn: CORNER[p].col,
                    ...(layerZ(ha.layer) !== undefined ? { zIndex: layerZ(ha.layer) } : {}),
                    ...(homeFaded ? { opacity: 0.25 } : {}),
                    // keep the yard's name + coins upright when the board is flipped
                    ...(contentCss ? { transform: contentCss } : {}),
                  }}
                >
                  <button
                    onClick={() => openGift([names[p]], names[p], roomId)}
                    title={`Send a gift to ${names[p]}`}
                    className={cn(
                      "flex items-center justify-center gap-1 truncate rounded-md px-1.5 py-1 text-center text-xs font-extrabold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] transition hover:brightness-110 sm:text-sm",
                      `bg-gradient-to-r ${TOKEN[p]}`,
                    )}
                  >
                    <span className="truncate">{names[p]}</span>
                    {lastGiftFor(names[p]) ? (
                      <span className="shrink-0 text-sm leading-none" title="Latest gift">{lastGiftFor(names[p])}</span>
                    ) : (
                      <GiftIcon className="size-3 shrink-0 opacity-80" />
                    )}
                  </button>
                  <div
                    className={cn("relative grid flex-1 grid-cols-2 grid-rows-2 place-items-center gap-1.5 overflow-hidden rounded-lg p-2", whiteBox && "bg-white shadow-inner")}
                    style={boxStyle ?? undefined}
                  >
                    {/* Admin home-yard symbol (e.g. a lotus) shown behind the token
                        slots on the white home area — matches a decorated Ludo board. */}
                    {homeSymbol && ha.layer !== "hidden" && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={withBaseSrc(homeSymbol)} alt="" draggable={false} className="pointer-events-none absolute inset-[12%] size-[76%] select-none object-contain opacity-60" />
                    )}
                    {[0, 1, 2, 3].map((i) => {
                      const tok = game.tokens.find((t) => t.color === p && t.index === i);
                      const inYard = !!tok && tok.pos === -1;
                      const canMove = !!tok && movable.has(tok.index) && tok.color === color;
                      // Per-slot settings (admin). `plate` is the slot's own background;
                      // `slotOn` only controls DECORATION — a parked token is always
                      // drawn and always clickable, so nothing here can break the game.
                      const s = ha.slots[i];
                      const plate = slotPlateStyle(s);
                      const slotOn = s.visible && s.layer !== "hidden" && visSlot !== "hide";
                      // Token still parked here → render the REAL token; otherwise a
                      // designed empty "home base" slot (colour-tinted dashed ring).
                      const content = inYard ? (
                        <button
                          onClick={() => pickToken(tok)}
                          disabled={!canMove}
                          style={{ zIndex: canMove ? 30 : 20, ...(ha.on ? slotTokenStyle(s) : {}) }}
                          className={cn(
                            "relative grid size-4/5 place-items-center transition",
                            canMove ? "cursor-pointer scale-[1.18] drop-shadow-[0_0_10px_rgba(255,255,255,0.95)]" : "cursor-default",
                          )}
                          aria-label={`${LABEL[p]} token ${i + 1}`}
                        >
                          {canMove && animGlow && <span className="pointer-events-none absolute inset-0 z-0 rounded-full bg-white/55 animate-ping" />}
                          <LudoToken color={p} skin={skinFor(p)} image={imageFor(p)} />
                        </button>
                      ) : slotOn ? (
                        // EMPTY SLOT. It must NOT paint the slot's background
                        // plate: that plate is the disc that sits BEHIND a parked
                        // token (it is only drawn with the token, below). When a
                        // token left the yard the empty slot kept painting it, so
                        // a white plate showed as a solid white blob covering the
                        // uploaded board artwork — one blob per token that had
                        // left home. An empty slot now shows only the faint
                        // outline, so the board design stays visible.
                        <span
                          className={cn(
                            "grid size-3/4 place-items-center rounded-full border-2 border-dashed",
                            boardTheme.dark ? "border-white/25" : "border-black/20",
                          )}
                        >
                          <span className={cn("size-2/5 rounded-full bg-gradient-to-br opacity-40", TOKEN[p])} />
                        </span>
                      ) : null;
                      // Per-slot layout — position / width / height / opacity / layer
                      // from the Token Placement Area panel, falling back to the older
                      // global slot nudge when that panel is off.
                      return (
                        <div
                          key={i}
                          className="grid size-full place-items-center"
                          style={ha.on ? slotWrapperStyle(s) : slotLayoutOn ? { transform: slotTransform(i) } : undefined}
                        >
                          {/* The slot's own background plate sits BEHIND a parked token. */}
                          {ha.on && inYard && slotOn && plate && (
                            <span className="pointer-events-none absolute inset-[12%] rounded-full" style={plate} />
                          )}
                          {content}
                        </div>
                      );
                    })}
                  </div>
                </div>
                );
              })}

              {/* EMPTY corners (seats with no player, e.g. a 2-player game) — draw a
                  faint home so the board always looks like a complete 4-corner Ludo
                  board instead of a blank white square. */}
              {(["red", "green", "blue", "yellow"] as Color[]).filter((c) => !game.players.includes(c)).map((c) => (
                <div
                  key={`empty-yard-${c}`}
                  style={{ gridRow: CORNER[c].row, gridColumn: CORNER[c].col }}
                  className={cn("flex flex-col rounded-xl border-2 p-1.5 opacity-45", homeArea(c).showBorder ? YARD_BG[c] : "border-transparent")}
                >
                  <div className={cn("grid flex-1 grid-cols-2 grid-rows-2 place-items-center gap-1.5 rounded-lg p-2", usesDefaultWhiteBox(homeArea(c)) && "bg-white/85")} style={homeAreaBoxStyle(homeArea(c)) ?? undefined}>
                    {[0, 1, 2, 3].map((i) => (
                      <span key={i} className={cn("grid size-3/4 place-items-center rounded-full border-2 border-dashed", boardTheme.dark ? "border-black/20" : "border-black/15")}>
                        <span className={cn("size-2/5 rounded-full bg-gradient-to-br opacity-30", TOKEN[c])} />
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              {/* Path cells (ring + home columns) — memoised (pathCellsEl): the
                  102 cells are static per theme/settings, so dice ticks, timers
                  and walks no longer re-render them (performance). */}
              {pathCellsEl}

              {/* Center = the FINAL HOME. The four coloured arms meet here. A soft,
                  LOW-OPACITY lotus sits in the middle as the centre "image" (client:
                  faded so it never covers the coins), and each colour's FINISHED coins
                  land in its corner ON TOP, clearly visible. */}
              <div
                className="relative grid place-items-center overflow-hidden rounded-lg ring-1 ring-white/50 shadow-[inset_0_1px_6px_rgba(0,0,0,0.3)]"
                style={{
                  gridRow: "7 / 10",
                  gridColumn: "7 / 10",
                  ...(contentCss ? { transform: contentCss } : {}),
                  // Four solid triangles, each pointing to its OWN arm and coloured to
                  // match it: top = GREEN, right = YELLOW, bottom = BLUE, left = RED.
                  // (`from -45deg` puts the wedge boundaries on the square's diagonals
                  // so each colour forms a clean triangle toward one side.)
                  background:
                    "conic-gradient(from -45deg, #16a34a 0deg 90deg, #facc15 90deg 180deg, #2563eb 180deg 270deg, #ef4444 270deg 360deg)",
                }}
              >
                {/* Thin white diagonals so the four triangles read crisply. */}
                <span className="pointer-events-none absolute left-1/2 top-1/2 h-[3px] w-[150%] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-white/60" />
                <span className="pointer-events-none absolute left-1/2 top-1/2 h-[3px] w-[150%] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-white/60" />
                {/* Centre lotus — admin-managed (Admin → Game Board): image, size,
                    opacity, rotation, position, show/hide from config. Rendered dead-
                    CENTRE (inset + m-auto) so the lotus sits exactly in the middle. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {centerShow && (
                  <img
                    src={centerSrc}
                    alt=""
                    draggable={false}
                    className="pointer-events-none absolute inset-0 z-[1] m-auto select-none object-contain drop-shadow-[0_1px_4px_rgba(0,0,0,0.55)]"
                    style={{
                      width: `${centerSizePct}%`,
                      height: `${centerSizePct}%`,
                      opacity: centerOpacity,
                      transform: `translate(${centerOffX}%, ${centerOffY}%) rotate(${centerRotate}deg)`,
                    }}
                  />
                )}
                {(["red", "green", "blue", "yellow"] as Color[]).map((col) => {
                  const done = game.tokens.filter((t) => t.color === col && t.pos === HOME_END);
                  if (done.length === 0) return null;
                  const corner = col === "red" ? "left-0.5 top-0.5" : col === "green" ? "right-0.5 top-0.5" : col === "blue" ? "left-0.5 bottom-0.5" : "right-0.5 bottom-0.5";
                  return (
                    <div key={col} className={cn("absolute z-[2] flex items-center", corner)}>
                      {done.map((t) => (
                        <span key={t.index} className="-ml-1.5 block size-[15px] shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] first:ml-0"><LudoToken color={col} skin={skinFor(col)} image={imageFor(col)} /></span>
                      ))}
                    </div>
                  );
                })}
              </div>

              {/* Tokens on the board (yard tokens are drawn inside the yard box above).
                  Same-colour coins sharing a cell are drawn as ONE token with a
                  numeric count badge (1–4) so a stack is instantly readable and
                  never overflows the tiny cell. */}
              {[...byCell.entries()].flatMap(([key, toks]) => {
                const [r, c] = key.split(",").map(Number);
                const onBoard = toks.filter((t) => t.pos !== -1);
                if (onBoard.length === 0) return [];
                // Group the cell's coins by colour.
                const groups = new Map<Color, Token[]>();
                for (const t of onBoard) (groups.get(t.color) ?? groups.set(t.color, []).get(t.color)!).push(t);
                const entries = [...groups.entries()];
                return entries.map(([gc, gToks], i) => {
                  const fan = entries.length > 1; // >1 colour on a (safe) cell → separate them
                  // When several players share a cell, put each on a DISTINCT slot so
                  // no coin hides another: 2 → diagonally OPPOSITE corners, 3 → triangle,
                  // 4 → four corners. Each coin also shrinks so the slots never overlap.
                  // The admin §5 coin-spacing scales the gap. (Values are % of the coin.)
                  const K = fanUnit * 1.4; // corner distance from the cell centre
                  // The arrangement STYLE is admin-selectable (config.gameBoard.shareStyle).
                  // "corners" is the original default and is unchanged; the others just
                  // offer a different look for coins that share one square.
                  const [sx, sy] = fan ? (shareSlot(shareStyle, Math.min(entries.length, 4), i, K) ?? [0, 0]) : [0, 0];
                  const scale = !fan ? 1 : entries.length === 2 ? 0.62 : entries.length === 3 ? 0.56 : 0.5;
                  const flipRot = contentCss ? ` ${contentCss}` : ""; // keep the coin upright when the board is flipped
                  const movableTok = gToks.find((t) => movable.has(t.index));
                  const canMove = !!movableTok && gc === color;
                  // This coin can reach HOME with the exact number just rolled →
                  // give it a distinct gold "finish" glow + flag so bringing a
                  // coin home is obvious and satisfying (and never missed).
                  const willFinish =
                    canMove && game.die !== null && !!movableTok && movableTok.pos + game.die === HOME_END;
                  const count = gToks.length;
                  // SAME-COLOUR BLOCK (temporary safe zone): this box holds a pair/stack
                  // of same-colour coins — or the protected remnant of one — so it cannot
                  // be cut. Show a shield + green halo so players see the box is protected.
                  const isBlock = gToks.some((t) => t.stacked);
                  // The coin currently mid-hop: lift it + pop it so the step-by-step
                  // walk through each cell is clearly visible.
                  const isHopping = hop != null && gToks.some((t) => `${t.color}-${t.index}` === hop.key);
                  return (
                    // Key MUST be unique per (colour, CELL): the same colour can
                    // have coins on several cells, so keying by colour alone made
                    // React reuse a DOM node across cells → a moved coin left a
                    // duplicate "ghost" behind. Including the cell fixes that.
                    <button
                      key={`${gc}-${key}`}
                      onClick={() => canMove && pickToken(movableTok!)}
                      disabled={!canMove}
                      style={{
                        gridRow: r + 1,
                        gridColumn: c + 1,
                        transform: fan ? `translate(${sx}%, ${sy}%) scale(${scale})${flipRot}` : (contentCss || undefined),
                        zIndex: isHopping ? 45 : canMove ? 30 : 20,
                        // Safe-zone HALO — admin-colourable + on/off (config.shield.glow).
                        ...(isBlock && !isHopping && !canMove && shieldGlowOn ? { filter: `drop-shadow(0 0 10px ${shieldColor})` } : {}),
                      }}
                      className={cn(
                        // Bigger, clearer coins (smaller inset margin) for a premium feel.
                        "relative z-20 m-[5%] transition sm:m-[8%]",
                        isHopping && "scale-[1.16] drop-shadow-[0_0_12px_rgba(255,255,255,0.95)]",
                        isHopping && moveClass, // admin coin movement style (jump/bounce/fly/spin)
                        canMove
                          ? willFinish
                            ? "cursor-pointer scale-[1.22] drop-shadow-[0_0_13px_rgba(250,204,21,0.98)]"
                            : "cursor-pointer scale-[1.18] drop-shadow-[0_0_10px_rgba(255,255,255,0.95)]"
                          : "cursor-default",
                      )}
                      aria-label={`${LABEL[gc]}${count > 1 ? ` (${count} coins)` : ""} token${willFinish ? " — can finish!" : ""}`}
                    >
                      {canMove && animGlow && (
                        <span
                          className={cn(
                            "pointer-events-none absolute inset-0 z-0 rounded-full animate-ping",
                            willFinish ? "bg-amber-300/75" : "bg-white/55",
                          )}
                        />
                      )}
                      {/* §5 admin token scaling — wraps just the art so it never
                          fights the movable-token pop animation on the button. */}
                      <span className="block size-full" style={tokenScale === 1 ? undefined : { transform: `scale(${tokenScale})` }}>
                        <LudoToken color={gc} skin={skinFor(gc)} image={imageFor(gc)} />
                      </span>
                      {willFinish && (
                        <span className="pointer-events-none absolute -top-2.5 left-1/2 z-40 -translate-x-1/2 select-none text-xs leading-none drop-shadow" title="Tap to bring this coin home">
                          🏁
                        </span>
                      )}
                      {count > 1 && (
                        <span
                          className={cn(
                            "absolute -right-1 -top-1 z-40 grid size-[1.05rem] place-items-center rounded-full bg-white text-[10px] font-extrabold leading-none shadow-md ring-2",
                            STACK_BADGE[gc],
                          )}
                        >
                          {count}
                        </span>
                      )}
                      {isBlock && shieldIconOn && (
                        <span
                          className={cn(
                            "pointer-events-none absolute -left-1 -top-1 z-40 grid size-[1.05rem] place-items-center overflow-hidden rounded-full text-[9px] leading-none shadow-md ring-2 ring-white/70",
                            shieldAnimCls, shieldBlink && "animate-pulse",
                          )}
                          style={{ backgroundColor: shieldImage ? "transparent" : shieldColor, animationDuration: (shieldAnimCls || shieldBlink) ? shieldSpeedSec : undefined }}
                          title="Safe zone — two same-colour coins protect this box; it can't be cut"
                        >
                          {shieldImage
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={withBaseSrc(shieldImage)} alt="shield" className="size-full object-cover" />
                            : "🛡️"}
                          {shieldParticles && (
                            <span className="pointer-events-none absolute inset-0 animate-ping rounded-full" style={{ boxShadow: `0 0 6px 1px ${shieldColor}` }} />
                          )}
                        </span>
                      )}
                    </button>
                  );
                });
              })}

              {/* Golden MOVE TRAIL — glowing sparks left on the cells a token just
                  passed while it hops forward (matches the reference "moving" frames). */}
              {fxOn && hop && (() => {
                const trailColor = hop.key.split("-")[0] as Color;
                const dots: React.ReactNode[] = [];
                for (let s = Math.max(0, hop.step - 3); s < hop.step; s++) {
                  const p = hop.path[s];
                  if (p == null || p < 0) continue;
                  const [tr, tcc] = cellOf({ color: trailColor, index: hop.index, pos: p });
                  const life = (s - (hop.step - 4)) / 4; // newer sparks are brighter
                  dots.push(
                    <span
                      key={`trail-${s}`}
                      style={{ gridRow: tr + 1, gridColumn: tcc + 1, opacity: 0.15 + life * 0.55 }}
                      className="pointer-events-none z-10 m-[26%] rounded-full bg-gradient-to-br from-amber-200 to-yellow-400 blur-[2px] shadow-[0_0_10px_rgba(251,191,36,0.9)]"
                    />,
                  );
                }
                return dots;
              })()}
            </div>
            </div>
          </div>
        </div>

        {/* Bottom corners: blue (bottom-left) · status · yellow (bottom-right) */}
        <div className="flex items-end justify-between gap-1">
          <div className="min-w-16">{has(blC) && renderPlayer(blC, "bl")}</div>
          <div className="flex flex-1 items-center justify-center px-1 pb-1">
            <p className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-center text-xs font-semibold text-white",
              isHumanTurn && game.die !== null && !game.winner && !rolling ? "animate-pulse bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.6)]" : "bg-black/25",
            )}>
              <span className={cn("size-2.5 rounded-full bg-gradient-to-br", TOKEN[color])} />
              <span className="truncate">{statusText}</span>
            </p>
          </div>
          <div className="flex min-w-16 justify-end">{has(brC) && renderPlayer(brC, "br")}</div>
        </div>

        {/* Bottom chat bar — text + emoji + gift */}
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

      {/* Capture / kill flash — admin-controllable (gameAnim.captureFlash), plus the
          player's own effects toggle. A clean SVG star-burst (no 💥). */}
      {captureFlash && fxOn && animCapture && (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
          <Sparkles className="animate-win-burst fill-current text-amber-300 drop-shadow-[0_0_18px_rgba(251,191,36,0.85)]" strokeWidth={0} size={92} />
        </div>
      )}

      {/* §4 Coin-reaches-centre animation — admin-controllable (gameAnim.centerReach:
          enabled / style / speed). "bloom" = the lotus blooms with petals; "sparkle"
          = a gold star burst. Speed drives the animation duration. */}
      {fxOn && animCenter && homeFx > 0 && (
        <div key={homeFx} className="pointer-events-none absolute inset-0 z-40 grid place-items-center">
          {centerStyle === "sparkle" ? (
            <div className="relative grid size-56 place-items-center">
              <span
                className="animate-lotus-bloom absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(255,220,140,0.55),rgba(255,190,90,0.24)_45%,transparent_70%)] blur-md"
                style={{ animationDuration: `${centerAnimSec}s` }}
              />
              {Array.from({ length: 12 }).map((_, i) => {
                const ang = (i / 12) * Math.PI * 2;
                const px = `${Math.round(Math.cos(ang) * 78)}px`;
                const py = `${Math.round(Math.sin(ang) * 78)}px`;
                return (
                  <span key={i} className="animate-petal-out absolute" style={{ ["--px" as string]: px, ["--py" as string]: py, animationDelay: `${i * 0.025}s`, animationDuration: `${centerAnimSec}s` }}>
                    <Star className="fill-current text-gold-300 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" strokeWidth={0} size={22} />
                  </span>
                );
              })}
              <Sparkles className="animate-win-burst relative fill-current text-amber-300 drop-shadow-[0_0_22px_rgba(251,191,36,0.9)]" strokeWidth={0} size={96} style={{ animationDuration: `${centerAnimSec}s` }} />
            </div>
          ) : centerStyle === "confetti" ? (
            <div className="relative grid size-56 place-items-center">
              {/* confetti burst — coloured pieces flying out from the centre */}
              {Array.from({ length: 26 }).map((_, i) => {
                const ang = (i / 26) * Math.PI * 2;
                const dist = 55 + (i % 5) * 14;
                const px = `${Math.round(Math.cos(ang) * dist)}px`;
                const py = `${Math.round(Math.sin(ang) * dist)}px`;
                const colors = ["#f472b6", "#facc15", "#4ade80", "#38bdf8", "#c084fc"];
                return (
                  <span
                    key={i}
                    className="animate-petal-out absolute rounded-[2px]"
                    style={{ ["--px" as string]: px, ["--py" as string]: py, width: 7, height: 11, backgroundColor: colors[i % colors.length], animationDelay: `${(i % 6) * 0.03}s`, animationDuration: `${centerAnimSec}s`, rotate: `${(i * 47) % 360}deg` }}
                  />
                );
              })}
              <span className="animate-lotus-bloom select-none text-6xl" style={{ animationDuration: `${centerAnimSec}s` }}>🎊</span>
            </div>
          ) : centerStyle === "fireworks" ? (
            <div className="relative grid size-56 place-items-center">
              {/* firework — two rings of glowing sparks + a flash halo */}
              {Array.from({ length: 16 }).map((_, i) => {
                const ang = (i / 16) * Math.PI * 2;
                const inner = i % 2 === 0;
                const dist = inner ? 60 : 95;
                const px = `${Math.round(Math.cos(ang) * dist)}px`;
                const py = `${Math.round(Math.sin(ang) * dist)}px`;
                return (
                  <span
                    key={i}
                    className="animate-petal-out absolute rounded-full"
                    style={{ ["--px" as string]: px, ["--py" as string]: py, width: inner ? 6 : 4, height: inner ? 6 : 4, backgroundColor: inner ? "#fbbf24" : "#f87171", boxShadow: `0 0 10px 2px ${inner ? "rgba(251,191,36,0.9)" : "rgba(248,113,113,0.8)"}`, animationDelay: `${inner ? 0 : 0.12}s`, animationDuration: `${centerAnimSec}s` }}
                  />
                );
              })}
              <span className="animate-lotus-bloom absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(255,220,150,0.5),transparent_60%)] blur-sm" style={{ animationDuration: `${centerAnimSec}s` }} />
              <span className="animate-lotus-bloom select-none text-6xl" style={{ animationDuration: `${centerAnimSec}s` }}>🎆</span>
            </div>
          ) : (
            <div className="relative grid size-56 place-items-center">
              {/* radiant glow halo */}
              <span className="animate-lotus-bloom absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(255,180,210,0.6),rgba(255,200,120,0.28)_45%,transparent_70%)] blur-md" style={{ animationDuration: `${centerAnimSec}s` }} />
              {/* the blooming lotus (large, brief) */}
              <span className="animate-lotus-bloom select-none text-8xl drop-shadow-[0_0_26px_rgba(255,150,200,0.98)]" style={{ animationDuration: `${centerAnimSec}s` }}>🪷</span>
              {/* pink petals bursting outward */}
              {Array.from({ length: 10 }).map((_, i) => {
                const ang = (i / 10) * Math.PI * 2;
                const px = `${Math.round(Math.cos(ang) * 70)}px`;
                const py = `${Math.round(Math.sin(ang) * 70)}px`;
                return (
                  <span
                    key={i}
                    className="animate-petal-out absolute text-xl"
                    style={{ ["--px" as string]: px, ["--py" as string]: py, animationDelay: `${i * 0.03}s`, animationDuration: `${centerAnimSec}s` }}
                  >
                    🌸
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Winner celebration — SOLID SVG star/sparkle bursts (no emoji, so NO black
          border and no 💥) scattered at RANDOM, plus a colourful star confetti rain.
          Positions come from the `celebration` memo so they don't jump on re-render. */}
      {game.winner && fxOn && animWin && (
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
          {/* Random sparkle bursts (solid gold, no outline) */}
          {celebration.bursts.map((b) => (
            <span
              key={b.key}
              className="absolute"
              style={{ left: `${b.left}%`, top: `${b.top}%`, animation: `win-burst ${b.dur}s ease-out ${b.delay}s infinite` }}
            >
              {b.kind === "star" ? (
                <Star className={cn("fill-current drop-shadow-[0_0_8px_rgba(250,204,21,0.75)]", b.color)} strokeWidth={0} size={b.px} />
              ) : (
                <Sparkles className={cn("fill-current drop-shadow-[0_0_8px_rgba(251,191,36,0.75)]", b.color)} strokeWidth={0} size={b.px} />
              )}
            </span>
          ))}
          {/* Confetti rain (small solid stars, no outline) */}
          {celebration.confetti.map((c) => (
            <span
              key={c.key}
              className="absolute -top-4"
              style={{ left: `${c.left}%`, animation: `confetti-fall ${c.dur}s ease-in ${c.delay}s forwards` }}
            >
              <Star className={cn("fill-current", c.color)} strokeWidth={0} size={c.px} />
            </span>
          ))}
        </div>
      )}

      {confirm === "end" && (
        <ConfirmDialog
          danger
          title="End the match for everyone?"
          message="This closes the current game for ALL players right away — the board is cleared and everyone returns to the room. Use this when a match is stuck or needs to be stopped. This cannot be undone."
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
            // the player back onto the board, so they could never leave).
            const exit = () => (wasLeave && onBackToRoom ? onBackToRoom() : onQuit());
            if (wasLeave && isNet && !game.winner && myColor && game.players.length > 1) {
              // Admin rule (config.gameRules.returnChancesOnRejoin):
              //  • ON  → gentler: the leaver loses ONE chance (leaveGame).
              //  • OFF → fixed: the leaver forfeits ALL chances (forfeit).
              // EITHER WAY we ALSO mark the seat "left" server-side (onLeaveSeat), so
              // removal is server-authoritative and the game ALWAYS resolves promptly
              // — a single present opponent wins immediately and the session can never
              // hang. (An earlier version skipped the mark in ON mode, which could
              // leave a 2-player game unresolved; that is fixed here.)
              const returnOnRejoin = (appConfig.perGameSettings?.ludo?.returnChancesOnRejoin ?? appConfig.gameRules?.returnChancesOnRejoin) !== false;
              setGame(returnOnRejoin ? leaveGame(game, myColor) : forfeit(game, myColor));
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
          winner={`${names[overWinner]} (${LABEL[overWinner]})`}
          rank="1st place 🥇"
          isYou={overWinner === myColor}
          onPlayAgain={onPlayAgain}
          onStay={() => setResultDismissed(true)}
          onBackToRoom={onBackToRoom}
        />
      )}
    </div>
  );
}

// All path cells = ring + every home column cell.
const PATH_CELLS: [number, number][] = [
  ...RING,
  ...(Object.values(HOME).flat() as [number, number][]),
];

