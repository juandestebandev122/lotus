"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { withBase } from "./base-path";

// ============================================================
// Real multiplayer game sync. Turns a single-device game engine into a
// networked one: every player runs the SAME engine, but the live game state
// is shared through the game-session record (the same channel spectators use).
//
//  • Authoritative shared state lives on the server session as
//    { kind, game, names, seats, v }  (seats = seatKey → {id,name}; v = version).
//  • Only the CURRENT player writes (turn-based games have no write conflicts);
//    everyone else adopts any state with a higher version number.
//  • Controls are gated by `isMyTurn` so a player can only act on their turn,
//    and only for their own colour/seat — no more "one player plays for all".
// ============================================================

export interface Seat { id: string; name: string }
export type Seats = Record<string, Seat>; // seatKey (e.g. colour) → player

// `gen` = round/generation. It increments ONLY on a fresh round (Play Again),
// never on a normal in-round move. This lets us tell a real new round apart from
// a stale move that arrived after the game was won — so a finished result can
// never be wiped out by a laggy player's late move, yet Play Again still works.
// `owner` = which CLIENT wrote this state. Version numbers are client-local, so
// two devices can legitimately push the SAME `v`. Without an owner there was no
// tiebreak: `w.v > v` was false on both sides, so NEITHER adopted the other and
// the board forked permanently (the "game froze" + "everyone won" bug). With an
// owner we converge on the server's copy whenever a different client wrote it.
interface Wire<T> { kind: string; game: T; names: Record<string, string>; seats: Seats; v: number; gen: number; owner?: string }

/** The slice of the session record a playing client reads on every poll. */
interface PollSession {
  lastMoveAt?: string | null;
  stateHash?: string;
  status?: string;
  spectators?: number;
  spectatorNames?: string[];
  leftSeats?: string[];
  state?: string | null;
}

function winnerOf<T>(g: T | null | undefined): unknown {
  return g ? (g as { winner?: unknown }).winner : undefined;
}

function parse<T>(raw: string | null | undefined): Wire<T> | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<Wire<T>> & { game?: T };
    if (o && o.game !== undefined) {
      return { kind: o.kind ?? "", game: o.game as T, names: o.names ?? {}, seats: (o.seats as Seats) ?? {}, v: typeof o.v === "number" ? o.v : 0, gen: typeof o.gen === "number" ? o.gen : 0, owner: typeof o.owner === "string" ? o.owner : undefined };
    }
  } catch { /* ignore */ }
  return null;
}

export function useNetGame<T>({
  roomId,
  roomName,
  kind,
  myId,
  initial,
  currentSeatKey,
  mergeIncoming,
  pollMs = 1300,
}: {
  roomId: string | undefined;
  roomName: string;
  kind: string; // "ludo" | "snake" | "chess"
  myId: string;
  // Provided by the player who STARTS the game; undefined for joiners.
  initial?: { game: T; seats: Seats; names: Record<string, string> };
  // Which seat key (e.g. colour) is to move in this state.
  currentSeatKey: (game: T) => string;
  // Apply the server-authoritative "left seats" to a game state: remove any of
  // the given seat keys (colours) that left. Keeps every client consistent no
  // matter which state version they're on (fixes the Leave race).
  mergeIncoming?: (game: T, leftSeats: string[]) => T;
  pollMs?: number;
}): {
  game: T | null;
  seats: Seats;
  names: Record<string, string>;
  ready: boolean;
  mySeatKey: string | null;
  isMyTurn: boolean;
  status: "running" | "ended" | "none";
  startError: string | null;
  spectators: number;
  spectatorNames: string[];
  /** How out of touch we are, in ms: time since the last poll that actually got
   *  an answer from the server. Used so a player is never punished for a turn
   *  they may well have taken on a board we simply have not received. */
  syncAgeMs: () => number;
  /** When the SERVER last saw anyone push a move in this game (ms since epoch,
   *  0 if unknown). The truth about whether the current player is acting — our
   *  own device not having received it proves nothing. */
  lastServerMoveAt: () => number;
  /** Re-sync with the server immediately, without leaving the game. Behind the
   *  Refresh button on the game screen. */
  resync: () => Promise<void>;
  push: (game: T) => void;
  end: (winnerName?: string) => void;
  restart: (game: T) => void;
  leave: (seatKey: string) => void;
  endForEveryone: (reason?: string) => void;
} {
  const [game, setGame] = useState<T | null>(initial?.game ?? null);
  const [seats, setSeats] = useState<Seats>(initial?.seats ?? {});
  const [names, setNames] = useState<Record<string, string>>(initial?.names ?? {});
  const [ready, setReady] = useState(!!initial);
  const [status, setStatus] = useState<"running" | "ended" | "none">(initial ? "running" : "none");
  const [startError, setStartError] = useState<string | null>(null);
  // Live spectators (people watching this game) — surfaced so players can see who's watching.
  const [spectators, setSpectators] = useState(0);
  const [spectatorNames, setSpectatorNames] = useState<string[]>([]);

  const idRef = useRef<string | null>(null);
  const vRef = useRef<number>(0);
  const genRef = useRef<number>(0);
  const gameRef = useRef<T | null>(game);
  gameRef.current = game;
  const seatsRef = useRef<Seats>(seats);
  seatsRef.current = seats;
  const namesRef = useRef(names);
  namesRef.current = names;
  const initRef = useRef(initial);

  const mySeatKey = (() => {
    for (const k of Object.keys(seats)) if (seats[k]?.id === myId) return k;
    return null;
  })();
  const isMyTurn = !!game && !!mySeatKey && status === "running" && currentSeatKey(game) === mySeatKey;

  // A stable id for THIS client instance — stamped on every state we write so a
  // same-version collision from another device can be detected and resolved.
  const ownerRef = useRef<string>("");
  if (!ownerRef.current) ownerRef.current = `${myId || "anon"}-${Math.random().toString(36).slice(2, 8)}`;

  // Sync health. `lastSyncOkRef` is the last time a poll actually came back;
  // `serverMoveAtRef` is when the SERVER last saw anybody push a move. Both are
  // refs, read on demand, so nothing here re-renders the board.
  const lastSyncOkRef = useRef<number>(Date.now());
  const serverMoveAtRef = useRef<number>(0);
  const syncAgeMs = useCallback(() => Date.now() - lastSyncOkRef.current, []);
  const lastServerMoveAt = useCallback(() => serverMoveAtRef.current, []);
  // Filled in by the polling effect below; the Refresh button calls through it.
  const resyncRef = useRef<() => Promise<void>>(async () => {});
  const resync = useCallback(async () => { await resyncRef.current(); }, []);

  // State writes are SERIALISED per client: a roll commit and the follow-up move
  // can now be pushed a fraction of a second apart, and two in-flight PATCHes
  // could otherwise arrive out of order — last-write-wins on the server would
  // then resurrect the OLDER state for everyone. The promise chain guarantees
  // this client's writes reach the server in the order they were made.
  const sendChainRef = useRef<Promise<void>>(Promise.resolve());
  // THE GAME MUST NEVER WEDGE ON A HUNG REQUEST.
  //
  // Writes are serialised through one promise chain, so a single fetch that
  // never settles — routine on a flaky mobile connection — used to block EVERY
  // later move for the rest of the match. That is the freeze players reported,
  // and why only a page refresh brought the game back. Every request now has a
  // hard deadline; a timed-out one is abandoned and the next move goes through.
  const timedFetch = useCallback((body: string, ms = 10000) =>
    (async () => {
      // A MOVE THAT FAILS TO UPLOAD IS A LOST TURN — so try twice.
      //
      // The player's roll or move is applied on their own screen immediately and
      // then pushed. If that push fails — a moment of no signal, or the server
      // restarting — the server never receives it, and the next poll pulls the
      // older board back down: the move disappears and the player has spent
      // their turn on nothing. A single quick retry covers exactly the blips
      // that were causing it. Re-sending is safe: every state carries its own
      // version, so the server simply stores it again, and the write chain keeps
      // this client's pushes in order.
      const send = async (deadline: number) => {
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), deadline);
        try {
          const res = await fetch(withBase("/api/games/session"), {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body,
            signal: ac.signal,
          });
          return res.ok;
        } catch { return false; }
        finally { clearTimeout(t); }
      };
      if (await send(ms)) return;
      // Give the connection a breath, then one more attempt on a shorter clock
      // so a dead network can still never wedge the queue behind it.
      await new Promise((r) => setTimeout(r, 700));
      await send(Math.min(ms, 6000));
    })(), []);

  // Append one write to the serialised chain. The `.catch` is not decoration: a
  // rejected chain stays rejected, so every LATER `.then` would be skipped and
  // every move this player made for the rest of the match would vanish with no
  // error anywhere — a permanent one-sided freeze. The chain is kept resolved.
  const queueWrite = useCallback((body: string) => {
    sendChainRef.current = sendChainRef.current
      .then(() => timedFetch(body))
      .catch(() => { /* keep the chain alive for the next move */ });
  }, [timedFetch]);

  const sendState = useCallback((g: T, sts: Seats, nm: Record<string, string>, v: number, gen: number) => {
    if (!idRef.current) return;
    const body = JSON.stringify({ id: idRef.current, state: JSON.stringify({ kind, game: g, names: nm, seats: sts, v, gen, owner: ownerRef.current } satisfies Wire<T>) });
    queueWrite(body);
  }, [kind, queueWrite]);

  // Local move → bump version, render immediately, broadcast.
  const push = useCallback((next: T) => {
    vRef.current += 1;
    setGame(next);
    sendState(next, seatsRef.current, namesRef.current, vRef.current, genRef.current);
  }, [sendState]);

  // end/leave/restart ride the SAME serialised chain as state writes: ending a
  // session must never overtake this client's final (winning) state PATCH on the
  // wire — the server stops accepting state writes once a session completes, so
  // an overtaken write would strand laggy opponents on a pre-win board.
  const end = useCallback((winnerName?: string) => {
    if (!idRef.current) return;
    const body = JSON.stringify({ id: idRef.current, winner: winnerName ?? "" });
    queueWrite(body);
  }, [queueWrite]);

  // A player pressed Leave → mark their seat left on the server so EVERY client
  // removes them (independent of the state version — no race, no "3 chances").
  const leave = useCallback((seatKey: string) => {
    if (!idRef.current || !seatKey) return;
    const body = JSON.stringify({ id: idRef.current, leftSeat: seatKey });
    queueWrite(body);
  }, [queueWrite]);

  // "Play Again": re-open the SAME session and broadcast a fresh game so every
  // player (not just the clicker) drops into the new round, perfectly synced.
  const restart = useCallback((next: T) => {
    vRef.current += 1;
    genRef.current += 1; // new round — lets everyone leave the finished result
    setGame(next);
    setStatus("running");
    if (!idRef.current) return;
    const body = JSON.stringify({ id: idRef.current, reopen: true, state: JSON.stringify({ kind, game: next, names: namesRef.current, seats: seatsRef.current, v: vRef.current, gen: genRef.current } satisfies Wire<T>) });
    queueWrite(body);
  }, [kind, queueWrite]);

  // HOST / CO-HOST "End Game": force-close the session for EVERYONE. Rides the same
  // serialised chain; the server sets status 'ended', which every client's next poll
  // turns into an auto-leave. Optimistically flips THIS device's status too so the
  // host leaves immediately without waiting for the round-trip.
  const endForEveryone = useCallback((reason?: string) => {
    if (!idRef.current) return;
    const body = JSON.stringify({ id: idRef.current, forceEnd: true, reason });
    setStatus("ended");
    queueWrite(body);
  }, [queueWrite]);

  // Initialise: the starter creates the session; joiners find the running one.
  useEffect(() => {
    if (!roomId || !myId) return;
    let cancelled = false;
    (async () => {
      const init = initRef.current;
      if (init) {
        try {
          const res = await fetch(withBase("/api/games/session"), {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roomId,
              roomName,
              game: kind,
              players: Object.values(init.seats).map((s) => s.name),
              playerIds: Object.values(init.seats).map((s) => s.id),
            }),
          });
          const d = await res.json().catch(() => ({}));
          if (cancelled) return;
          if (!res.ok) {
            // e.g. not enough coins to start a paid game, or game disabled.
            setStartError(d?.error ?? "Could not start the game.");
            return;
          }
          idRef.current = d?.id ?? null;
          vRef.current = 1;
          genRef.current = 1;
          sendState(init.game, init.seats, init.names, 1, 1);
          setReady(true);
          setStatus("running");
        } catch { /* ignore */ }
      } else {
        // Joiner: poll the room's active sessions until our game appears.
        const find = async () => {
          try {
            const res = await fetch(withBase(`/api/games/active?room=${encodeURIComponent(roomId)}`), { credentials: "include" });
            const d = await res.json().catch(() => ({}));
            const sess = (d.sessions ?? []).find((x: { id: string; game?: string }) => (x.game || "").toLowerCase().includes(kind));
            if (sess) { idRef.current = sess.id; return true; }
          } catch { /* ignore */ }
          return false;
        };
        if (!(await find()) && !cancelled) {
          const t = setInterval(async () => { if (await find()) clearInterval(t); }, 2000);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [roomId, myId, kind, roomName, sendState]);

  // Whether this device is waiting on SOMEONE ELSE to move. When it is, the
  // board is stale until the next poll lands, so we poll quickly; on our own
  // turn there is nothing to receive and we back off. Held in a ref so changing
  // it never restarts the polling loop.
  const waitingRef = useRef(false);
  waitingRef.current = status !== "ended" && (!ready || (!!game && !!mySeatKey && !isMyTurn));

  // Poll the shared state; adopt any state strictly newer than ours.
  useEffect(() => {
    if (!roomId) return;
    let on = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;
    // The last state fingerprint the SERVER gave us. Sent back on each poll so
    // an unchanged board answers with a few bytes instead of the whole game.
    let lastHash = "";

    const tick = async () => {
      // Self-scheduling instead of setInterval: on a slow mobile connection a
      // fixed interval stacks requests on top of each other, and the pile-up is
      // itself a cause of the delay players feel. One request at a time.
      if (inFlight) return;
      if (!idRef.current) return;
      if (typeof document !== "undefined" && document.hidden) return; // pause sync while backgrounded
      inFlight = true;
      try {
        // A hard deadline on the poll too: without it one request that never
        // settles leaves `inFlight` true for ever, every later tick returns
        // immediately, and the board silently stops updating — the freeze that
        // only a page refresh cleared.
        // THE DEADLINE MUST COVER READING THE BODY TOO.
        //
        // `fetch` settles as soon as the response HEADERS arrive; `res.json()`
        // is what reads the body. Cancelling the abort timer in between — as
        // this did — left the body read unprotected, and on a stalled mobile
        // connection headers routinely arrive and the body never does. That
        // promise then never settled, so `inFlight` stayed true and the loop
        // below never re-armed: the board silently stopped updating for the
        // rest of the match and only a refresh restored it. One controller now
        // guards the whole request, headers and body together.
        const ac = new AbortController();
        const killer = setTimeout(() => ac.abort(), 8000);
        let d: { session?: PollSession | null } | null = null;
        try {
          const res = await fetch(
            withBase(`/api/games/session?id=${idRef.current}&lite=1${lastHash ? `&sh=${encodeURIComponent(lastHash)}` : ""}`),
            { credentials: "include", cache: "no-store", signal: ac.signal },
          );
          d = await res.json();
        } finally { clearTimeout(killer); }
        if (!on) return;
        // We heard back from the server — this is the anchor the turn timer uses
        // to tell "the player did nothing" apart from "we cannot hear anything".
        lastSyncOkRef.current = Date.now();
        // THE MOVE WITNESS — `lastMoveAt`, never `lastActiveAt`.
        //
        // This used to read `lastActiveAt`, which the server's abandoned-game
        // reaper refreshes on a timer for any room that still has people in it.
        // Every poll therefore reported "somebody just moved", the turn timer's
        // safety check concluded the absent player was still playing, and NO
        // player could ever be passed: the match froze on one turn showing 0s
        // and only a page refresh brought it back. `lastMoveAt` is written only
        // when a player actually pushes a board.
        const sess = d?.session ?? null;
        if (sess?.lastMoveAt) {
          const t = Date.parse(sess.lastMoveAt);
          if (!Number.isNaN(t)) serverMoveAtRef.current = t;
        }
        if (typeof sess?.stateHash === "string") lastHash = sess.stateHash;
        if (sess?.status === "ended") setStatus("ended");
        // Live spectator count + names (guarded so an unchanged list doesn't re-render).
        if (typeof sess?.spectators === "number") setSpectators(sess.spectators);
        const specNames = sess?.spectatorNames;
        if (Array.isArray(specNames)) setSpectatorNames((prev) => (JSON.stringify(prev) === JSON.stringify(specNames) ? prev : specNames));
        // Server-authoritative "left seats": players who pressed Leave. This is
        // NOT versioned — every client must remove them no matter which state
        // version it's on, so a Leave can never be un-done by a racing move.
        const leftSeats: string[] = Array.isArray(sess?.leftSeats) ? sess.leftSeats : [];
        const w = parse<T>(sess?.state);
        if (!w) {
          // No newer shared state, but a Leave may still need applying to what we hold.
          if (mergeIncoming && leftSeats.length && gameRef.current) {
            const m = mergeIncoming(gameRef.current, leftSeats);
            if (m !== gameRef.current) setGame(m);
          }
          return;
        }
        // Only adopt seats/names when they ACTUALLY changed. Each poll parses fresh
        // objects, so a plain setState pushed a new reference every ~1.3s and forced a
        // full board re-render (visible stutter, could land mid-token-glide). Returning
        // the previous reference when the content is identical makes React bail out.
        if (Object.keys(w.seats).length) setSeats((prev) => (JSON.stringify(prev) === JSON.stringify(w.seats) ? prev : w.seats));
        if (Object.keys(w.names).length) setNames((prev) => (JSON.stringify(prev) === JSON.stringify(w.names) ? prev : w.names));
        // Adopt newer states — OR an equal-version state written by a DIFFERENT
        // client. Version numbers are client-local, so two devices can push the
        // same `v`; with a strict `>` neither side ever adopted the other and the
        // board forked permanently (frozen game + every device crowning itself).
        // Converging on the server's copy costs at most one overwritten move and
        // guarantees every player sees the SAME board.
        let base: T | null = gameRef.current;
        let adopt = false;
        const sameVersionOtherClient = w.v === vRef.current && !!w.owner && w.owner !== ownerRef.current;
        if (w.v > vRef.current || sameVersionOtherClient) {
          // STICKY RESULT: once a winner is declared, a stale move that arrives
          // late (e.g. a laggy player who hadn't seen the win yet) must NOT wipe
          // it out. Only a genuine NEW ROUND (higher gen, set by Play Again) may
          // clear a finished game. Keep the version in sync either way.
          const haveWinner = winnerOf(gameRef.current) != null;
          const incomingWon = winnerOf(w.game) != null;
          if (haveWinner && !incomingWon && w.gen <= genRef.current) {
            vRef.current = w.v; // accept progress but keep the finished result on screen
          } else {
            vRef.current = w.v;
            genRef.current = w.gen;
            base = w.game;
            adopt = true;
          }
        } else if (!gameRef.current && w.game !== undefined) {
          genRef.current = w.gen;
          base = w.game;
          adopt = true;
        }
        // Apply the left seats on TOP of whatever we're about to show — no state
        // version can ever re-add a player who left.
        const finalGame = (mergeIncoming && base && leftSeats.length) ? mergeIncoming(base, leftSeats) : base;
        if (adopt) {
          if (finalGame != null) setGame(finalGame);
          setReady(true);
          if (sess?.status !== "ended") setStatus("running");
        } else if (finalGame != null && finalGame !== gameRef.current) {
          setGame(finalGame); // left-seats changed the current game even without a new version
        }
      } catch { /* ignore */ }
      finally { inFlight = false; }
    };

    // The Refresh button calls this: re-sync NOW, from the server, without
    // leaving the game. `lastHash = ""` forces the full board to be re-sent even
    // if the server thinks we already have it.
    resyncRef.current = async () => { lastHash = ""; inFlight = false; await tick(); };

    const loop = () => {
      if (!on) return;
      // Waiting for an opponent → check often, so their move lands almost at
      // once. On our own turn nothing can arrive, so poll lazily and leave the
      // connection free.
      const wait = waitingRef.current ? Math.min(600, pollMs) : Math.max(pollMs, 1600);
      // THE LOOP MUST RE-ARM NO MATTER WHAT `tick()` DID. It used to be
      // `await tick(); loop();` — so a tick that threw, or never settled, also
      // killed the scheduler and the board stopped syncing for good. The
      // re-arm now lives in a `finally`, and a stuck tick can no longer take
      // the loop down with it: the deadline above frees `inFlight` and the
      // next scheduled tick simply carries on.
      timer = setTimeout(async () => {
        try { await tick(); } catch { /* never let one poll kill the loop */ }
        finally { loop(); }
      }, wait);
    };
    loop();

    // Coming back from the background should refresh straight away rather than
    // showing an out-of-date board until the next tick.
    const onVisible = () => { if (!document.hidden) void tick(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      on = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [roomId, pollMs]);

  return { game, seats, names, ready, mySeatKey, isMyTurn, status, startError, spectators, spectatorNames, syncAgeMs, lastServerMoveAt, resync, push, end, restart, leave, endForEveryone };
}
