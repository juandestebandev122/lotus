"use client";

// The player's game screen (§44). Deliberately simple: what round we're on,
// the numbers still free, your locked number, then the result.
//
// It polls every 2s (§45 — "no page refresh should be required"). Real-time
// push is a later phase; polling keeps the state honest in the meantime.

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Ticket, Trophy, Users, Clock, Loader2, Check, Crown, Play, Shuffle, Lock, Unlock, SkipForward, Coins, Gift } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { fetchLuckyGame, joinLuckyGame, pickLuckyNumber, luckyHost, type LuckyGameView } from "@/lib/lucky-games";

function countdown(target: string | undefined, now: number): string | null {
  if (!target) return null;
  const ms = Date.parse(target) - now;
  if (ms <= 0) return "00:00";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function LuckyGameRoom({ gameId, onBack }: { gameId: string; onBack: () => void }) {
  const { toast } = useToast();
  const [g, setG] = useState<LuckyGameView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const [manual, setManual] = useState("");
  const [now, setNow] = useState(() => Date.now());
  // The spin/shuffle reveal. Every player watches the numbers tumble for a
  // moment before the lucky number settles, so a draw reads as an EVENT and
  // not as a value that quietly appeared on the next poll.
  const [spinFace, setSpinFace] = useState<number | null>(null);
  const shownRef = useRef("");

  const load = useCallback(async () => {
    const v = await fetchLuckyGame(gameId);
    setG(v);
    setLoading(false);
  }, [gameId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const t = setInterval(() => { void load(); }, 2000); return () => clearInterval(t); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);

  const roundIndex = g?.round?.index ?? 0;
  const drawnNumber = g?.round?.winningNumber ?? null;
  const lo = g?.minNumber ?? 1;
  const hi = g?.maxNumber ?? 99;
  useEffect(() => {
    if (drawnNumber == null) return;
    const key = `${roundIndex}:${drawnNumber}`;
    if (shownRef.current === key) return;   // already revealed — don't re-spin on every poll
    shownRef.current = key;
    const span = Math.max(1, hi - lo + 1);
    let ticks = 0;
    const t = setInterval(() => {
      ticks += 1;
      setSpinFace(lo + Math.floor(Math.random() * span));
      if (ticks >= 20) { clearInterval(t); setSpinFace(null); }
    }, 70);
    return () => { clearInterval(t); setSpinFace(null); };
  }, [roundIndex, drawnNumber, lo, hi]);

  const join = async () => {
    setBusy(true);
    const r = await joinLuckyGame(gameId);
    setBusy(false);
    if (r.ok) { toast("You're in — good luck!", "success"); void load(); }
    else toast(r.error ?? "Could not join", "error");
  };

  const pick = async (n: number) => {
    setBusy(true);
    const r = await pickLuckyNumber(gameId, n);
    setBusy(false);
    if (r.ok) { toast(`Number ${n} successfully selected`, "success"); setTyped(""); void load(); }
    else toast(r.error ?? "Could not select that number", "error");
  };

  /** Run one of the Host / Co-Host actions and refresh. */
  const act = async (label: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (r.ok) { toast(label, "success"); void load(); }
    else toast(r.error ?? "That didn't work", "error");
  };

  if (loading) return <div className="grid h-40 place-items-center text-mist-500"><Loader2 className="size-6 animate-spin" /></div>;
  if (!g) return <div className="p-8 text-center text-sm text-mist-400">This game is no longer available. <button onClick={onBack} className="text-lotus-300 hover:underline">Back</button></div>;

  const r = g.round;
  const selecting = r?.status === "selection";
  // A round counts as LIVE from the moment selection opens until it is closed
  // out — independent of whether joining happens to be open at the same time.
  const roundLive = !!r && (r.status === "selection" || r.status === "closed" || r.status === "drawn");
  const left = countdown(r?.selectionCloseAt, now);
  const joined = g.myStatus === "joined" || g.myStatus === "eligible";
  const numbers: number[] = [];
  for (let i = g.minNumber; i <= g.maxNumber && numbers.length < 400; i++) numbers.push(i);
  const taken = new Set(r?.takenNumbers ?? []);

  // Who is running this game, and what the admin lets them run (§4).
  const role = g.myRole ?? null;
  const can = g.can ?? { start: false, round: false, draw: false, manualPick: false, complete: false, joining: false };
  const finished = g.gameStatus === "completed" || g.gameStatus === "cancelled";
  const started = g.gameStatus === "started" || g.gameStatus === "paused";
  const drawable = !!r && (r.status === "selection" || r.status === "closed");
  const lastRound = !!r && r.index >= g.totalRounds;
  const statusLabel =
    finished ? "Game finished"
      : !started ? (g.joiningOpen ? "Joining open — not started" : "Not started")
        : r?.status === "pending" ? "Round not started"
          : r?.status === "selection" ? "Players are choosing numbers"
            : r?.status === "closed" ? "Selection closed — ready to draw"
              : r?.status === "drawn" ? "Number drawn — awaiting next round"
                : "In progress";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 rounded-full bg-ink-800 px-3 py-1.5 text-sm font-semibold text-mist-300 hover:text-mist-100">
          <ArrowLeft className="size-4" /> Games
        </button>
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-extrabold text-mist-100">{g.name}</h1>
          <p className="text-[11px] text-mist-500">
            Host {g.hostName}{g.coHostName !== "—" ? ` · Co-host ${g.coHostName}` : ""}{g.groupRoomName ? ` · Group: ${g.groupRoomName}` : ""}
          </p>
        </div>
      </div>

      {/* Header strip — round, players, countdown (§44) */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-line bg-ink-900 p-3 text-center">
          <div className="font-display text-2xl font-extrabold text-lotus-200">{g.currentRound} / {g.totalRounds}</div>
          <div className="text-[11px] text-mist-400">Round</div>
        </div>
        <div className="rounded-xl border border-line bg-ink-900 p-3 text-center">
          <div className="font-display text-2xl font-extrabold text-mist-100">{g.players} / {g.maxPlayers}</div>
          <div className="text-[11px] text-mist-400"><Users className="mr-0.5 inline size-3" /> Players</div>
        </div>
        <div className="rounded-xl border border-line bg-ink-900 p-3 text-center">
          <div className={cn("font-display text-2xl font-extrabold tabular-nums", left && left < "00:11" ? "text-rose-300" : "text-mist-100")}>{selecting ? left ?? "—" : "—"}</div>
          <div className="text-[11px] text-mist-400"><Clock className="mr-0.5 inline size-3" /> Time left</div>
        </div>
      </div>

      {/* §6 — the group gate, stated plainly. */}
      {!g.isGroupMember && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-center text-sm text-amber-200">
          You must be a member of the game group to participate in Lucky Number.
        </div>
      )}

      {/* ── Host / Co-Host / Admin controls ──────────────────────────────
          The game no longer waits on an admin to press everything: whoever
          runs the room runs the game, inside the permissions the admin grants
          in /admin/lucky-number. The server re-checks both on every action. */}
      {role && !finished && (
        <div className="rounded-2xl border border-lotus-400/30 bg-lotus-500/[0.07] p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-lotus-500/25 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-lotus-100">{role} controls</span>
            <span className="text-[11px] text-mist-400">{statusLabel}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {can.joining && !started && (
              <Button size="sm" variant="secondary" disabled={busy}
                onClick={() => act(g.joiningOpen ? "Joining closed" : "Joining open — players can come in", () => luckyHost.setJoining(gameId, !g.joiningOpen))}>
                {g.joiningOpen ? <><Lock className="mr-1.5 size-4" /> Close joining</> : <><Unlock className="mr-1.5 size-4" /> Open joining</>}
              </Button>
            )}

            {can.start && !started && (
              <Button size="sm" disabled={busy} onClick={() => act("Game started", () => luckyHost.start(gameId))}>
                <Play className="mr-1.5 size-4" /> Start game
              </Button>
            )}

            {can.round && started && r?.status === "pending" && (
              <Button size="sm" disabled={busy} onClick={() => act(`Round ${r.index} started`, () => luckyHost.startRound(gameId))}>
                <Play className="mr-1.5 size-4" /> Start round {r.index}
              </Button>
            )}

            {can.round && r?.status === "selection" && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => act("Number selection closed", () => luckyHost.setSelection(gameId, false))}>
                <Lock className="mr-1.5 size-4" /> Close selection
              </Button>
            )}
            {can.round && r?.status === "closed" && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => act("Number selection reopened", () => luckyHost.setSelection(gameId, true))}>
                <Unlock className="mr-1.5 size-4" /> Reopen selection
              </Button>
            )}

            {can.draw && drawable && (
              <Button size="sm" disabled={busy} onClick={() => act("Drawing…", () => luckyHost.draw(gameId))}>
                <Shuffle className="mr-1.5 size-4" /> Spin / shuffle
              </Button>
            )}

            {can.complete && r?.status === "drawn" && (
              <Button size="sm" disabled={busy} onClick={() => act(lastRound ? "Game completed" : "Next round", () => luckyHost.complete(gameId))}>
                <SkipForward className="mr-1.5 size-4" /> {lastRound ? "Finish game" : "Next round"}
              </Button>
            )}
          </div>

          {/* Manual pick is a SEPARATE permission — off by default, so a spin
              can't be quietly overruled by whoever is holding the room. */}
          {can.manualPick && drawable && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <span className="text-[11px] text-mist-400">Or set the number manually:</span>
              <input
                value={manual}
                onChange={(e) => setManual(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder={`${g.minNumber}–${g.maxNumber}`}
                className="h-8 w-24 rounded-lg border border-line bg-ink-950 px-2 text-center text-sm text-mist-100 outline-none focus:border-lotus-400"
              />
              <Button size="sm" variant="secondary" disabled={busy || !manual}
                onClick={() => act(`Lucky number set to ${manual}`, () => luckyHost.draw(gameId, Number(manual))).then(() => setManual(""))}>
                Set number
              </Button>
            </div>
          )}

          {(g.entryFee || g.prize || g.prizeDetail) && (
            <p className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3 text-[11px] text-mist-400">
              {!!g.entryFee && <span><Coins className="mr-1 inline size-3" /> Join · {g.entryFee} coins</span>}
              {!!g.prize && <span><Gift className="mr-1 inline size-3" /> Prize {g.prize} coins</span>}
              {!!g.prizeDetail && <span>{g.prizeDetail}</span>}
            </p>
          )}
        </div>
      )}

      {g.isGroupMember && !joined && g.gameStatus !== "completed" && (
        <div className="rounded-xl border border-line bg-ink-900 p-5 text-center">
          <p className="text-sm text-mist-300">You have not joined this game yet.</p>
          {/* Say what it costs and what's at stake BEFORE they commit coins. */}
          <p className="mt-1 text-xs text-mist-400">
            {g.entryFee ? <>Joining costs <b className="text-mist-200">{g.entryFee} coins</b></> : <>Free to join</>}
            {g.prize ? <> · prize <b className="text-gold-300">{g.prize} coins</b></> : null}
            {g.prizeDetail ? <> · {g.prizeDetail}</> : null}
          </p>
          <Button className="mt-3" onClick={join} disabled={busy}>
            {busy ? "Joining…" : g.entryFee ? `Join game — ${g.entryFee} coins` : "Join game"}
          </Button>
        </div>
      )}

      {/* Waiting room (§10) — only while NO round is actually running. The
          check used to be on gameStatus alone, so a live round could be hidden
          behind "waiting for the game to start". */}
      {(joined || role) && !roundLive && g.gameStatus !== "completed" && (
        <div className="rounded-xl border border-line bg-ink-900 p-6 text-center">
          <Ticket className="mx-auto mb-2 size-7 text-lotus-300" />
          <p className="font-semibold text-mist-100">
            {role && can.start && !started ? "Ready when you are — press Start game above"
              : role && can.round && started ? "Ready when you are — press Start round above"
                : "Waiting for the game to start"}
          </p>
          <p className="mt-1 text-xs text-mist-500">{g.players} of {g.maxPlayers} players joined · {g.totalRounds} rounds</p>
        </div>
      )}

      {/* The round itself — shown whenever a round is genuinely in play. A host
          who is not playing still watches it, so they can run the draw. */}
      {(joined || role) && roundLive && r && (
        <div className="rounded-2xl border border-line bg-ink-900 p-4">
          {r.myNumber != null ? (
            <div className="text-center">
              <p className="text-xs uppercase tracking-wide text-mist-500">Your number</p>
              <p className="font-display text-5xl font-extrabold text-lotus-200">{r.myNumber}</p>
              <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300"><Check className="size-3.5" /> Submitted &amp; locked</p>
              {r.status !== "drawn" && r.status !== "completed" && <p className="mt-2 text-sm text-mist-400">Waiting for the draw…</p>}
            </div>
          ) : selecting && joined ? (
            <>
              <p className="mb-2 text-center text-sm font-semibold text-mist-100">Select ONE number</p>
              {(g.selectionMethod === "type" || g.selectionMethod === "both") && (
                <div className="mb-3 flex justify-center gap-2">
                  <input
                    value={typed}
                    onChange={(e) => setTyped(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder={`${g.minNumber}–${g.maxNumber}`}
                    className="h-9 w-28 rounded-lg border border-line bg-ink-950 px-3 text-center text-sm text-mist-100 outline-none focus:border-lotus-400"
                  />
                  <Button size="sm" disabled={busy || !typed} onClick={() => pick(Number(typed))}>Submit</Button>
                </div>
              )}
              {(g.selectionMethod === "pick" || g.selectionMethod === "both") && (
                <div className="grid max-h-72 grid-cols-6 gap-1.5 overflow-y-auto sm:grid-cols-10">
                  {numbers.map((n) => {
                    const gone = taken.has(n);
                    return (
                      <button
                        key={n}
                        disabled={gone || busy}
                        onClick={() => pick(n)}
                        title={gone ? "Taken" : `Pick ${n}`}
                        className={cn(
                          "aspect-square rounded-lg text-xs font-bold tabular-nums transition",
                          gone
                            ? "cursor-not-allowed bg-ink-800 text-mist-600 line-through"
                            : "bg-lotus-500/15 text-lotus-100 hover:bg-lotus-500/35",
                        )}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="mt-2 text-center text-[11px] text-mist-500">Greyed-out numbers are already taken by another player.</p>
            </>
          ) : (
            <p className="py-6 text-center text-sm text-mist-400">
              {r.status === "pending"
                ? (role ? "Start this round when you're ready." : "Waiting for the host to start this round.")
                : selecting
                  ? `${r.takenNumbers.length} number${r.takenNumbers.length === 1 ? "" : "s"} submitted so far…`
                  : "Number selection is closed."}
            </p>
          )}

          {/* Result (§27) */}
          {(r.status === "drawn" || r.status === "completed") && r.winningNumber != null && (
            <div className="mt-4 rounded-xl border border-gold-400/30 bg-gold-500/10 p-4 text-center">
              <p className="text-xs uppercase tracking-wide text-gold-300/80">{spinFace != null ? "Drawing…" : "Lucky number"}</p>
              <p className={cn("font-display text-5xl font-extrabold tabular-nums text-gold-200", spinFace != null && "animate-pulse opacity-70")}>
                {spinFace ?? r.winningNumber}
              </p>
              {spinFace == null && (
                <>
                  {r.iWon ? (
                    <p className="mt-2 font-bold text-emerald-300">🎉 YOU WON THIS ROUND!</p>
                  ) : (
                    <p className="mt-2 text-sm text-mist-300">{r.winners.length ? "Better luck in the next round!" : "NO WINNER this round."}</p>
                  )}
                  {r.winners.length > 0 && (
                    <p className="mt-1 text-xs text-mist-400">Winners: <b className="text-mist-200">{r.winners.join(", ")}</b></p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Round history (§29) */}
      {g.history.length > 0 && (
        <div className="rounded-2xl border border-line bg-ink-900 p-4">
          <p className="mb-2 text-sm font-semibold text-mist-200">Round history</p>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-left text-xs text-mist-400"><th className="py-1.5">Round</th><th>Number</th><th>Winners</th><th>Method</th></tr></thead>
            <tbody>
              {g.history.map((h) => (
                <tr key={h.index} className="border-b border-line/60">
                  <td className="py-1.5 text-mist-300">{h.index}</td>
                  <td className="font-bold tabular-nums text-lotus-200">{h.winningNumber ?? "—"}</td>
                  <td className="text-mist-300">{h.winners.length ? h.winners.join(", ") : "No winner"}</td>
                  <td className="text-xs capitalize text-mist-500">{h.method ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Final results (§47–§49) */}
      {g.gameStatus === "completed" && g.finalRanks && (
        <div className="rounded-2xl border border-gold-400/30 bg-gradient-to-b from-gold-500/15 to-transparent p-5">
          <p className="mb-3 flex items-center justify-center gap-2 font-display text-lg font-extrabold text-gold-200"><Trophy className="size-5" /> FINAL WINNERS</p>
          <div className="space-y-1.5">
            {g.finalRanks.slice(0, 10).map((f) => (
              <div key={f.userId} className={cn("flex items-center gap-3 rounded-lg px-3 py-2", f.rank <= 4 ? "bg-white/[0.07]" : "bg-white/[0.03]")}>
                <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-xs font-black", f.rank === 1 ? "bg-gold-400 text-ink-950" : f.rank <= 4 ? "bg-white/15 text-mist-100" : "bg-white/8 text-mist-400")}>
                  {f.rank === 1 ? <Crown className="size-4" /> : f.rank}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold text-mist-100">{f.userName}</span>
                <span className="shrink-0 text-xs text-mist-400">{f.wins} wins · {f.points} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
