"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Ticket, Coins, Trophy, Users, Clock, Dice5, Loader2, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { useConfig } from "@/lib/config";
import { useAuth } from "@/lib/auth";
import { fetchLuckyGames, enterLucky, drawLucky, type LuckyGame } from "@/lib/lucky-number-api";
import { fetchLuckyRooms, type LuckyRoomRow } from "@/lib/lucky-games";
import { LuckyGameRoom } from "@/components/lucky/LuckyGameRoom";

const n = (v: number) => (v ?? 0).toLocaleString("en-SA");

const STATUS_STYLE: Record<string, string> = {
  scheduled: "bg-amber-500/15 text-amber-300",
  open: "bg-emerald-500/15 text-emerald-300",
  closed: "bg-sky-500/15 text-sky-300",
  drawn: "bg-lotus-500/20 text-lotus-200",
  cancelled: "bg-white/10 text-mist-400",
};

// Live "time left" until a target ISO, recomputed by a ticking clock passed in.
function timeLeft(target: string | undefined, now: number): string | null {
  if (!target) return null;
  let ms = new Date(target).getTime() - now;
  if (ms <= 0) return "0s";
  const d = Math.floor(ms / 864e5); ms -= d * 864e5;
  const h = Math.floor(ms / 36e5); ms -= h * 36e5;
  const m = Math.floor(ms / 6e4); ms -= m * 6e4;
  const s = Math.floor(ms / 1e3);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export default function LuckyNumberPage() {
  const { config } = useConfig();
  const { user } = useAuth();
  const { toast } = useToast();
  const [games, setGames] = useState<LuckyGame[]>([]);
  const [loading, setLoading] = useState(true);
  // Multi-round game rooms (the client's specification) live alongside the
  // original single-draw games, so neither replaces the other.
  const [rooms, setRooms] = useState<LuckyRoomRow[]>([]);
  const [openRoom, setOpenRoom] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, number[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const [g, rs] = await Promise.all([fetchLuckyGames(), fetchLuckyRooms()]);
    setRooms(rs);
    setGames(g);
    setPicks((prev) => { const nextP = { ...prev }; for (const game of g) if (nextP[game.id] === undefined) nextP[game.id] = game.myNumbers ?? []; return nextP; });
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  // ticking clock for countdowns + a periodic refresh so results appear after a draw
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setInterval(() => { void load(); }, 15000); return () => clearInterval(t); }, [load]);

  const featureOn = config.features?.luckyNumber !== false;

  const togglePick = (g: LuckyGame, num: number) => {
    if (!g.canEnter) return;
    setPicks((p) => {
      const cur = p[g.id] ?? [];
      if (cur.includes(num)) return { ...p, [g.id]: cur.filter((x) => x !== num) };
      if (cur.length >= g.maxPicksPerUser) {
        // single-pick games: replace; multi-pick: block once full
        if (g.maxPicksPerUser === 1) return { ...p, [g.id]: [num] };
        toast(`You can pick at most ${g.maxPicksPerUser} numbers`, "error");
        return p;
      }
      return { ...p, [g.id]: [...cur, num] };
    });
  };

  const submit = async (g: LuckyGame) => {
    const nums = picks[g.id] ?? [];
    if (nums.length === 0) { toast("Pick at least one number", "error"); return; }
    setBusy(g.id);
    const res = await enterLucky(g.id, nums);
    setBusy(null);
    if (res.ok) { toast(g.myNumbers.length ? "Your pick was updated" : "Your number is in — good luck!", "success"); await load(); }
    else toast(res.error ?? "Could not submit", "error");
  };

  const runDraw = async (g: LuckyGame) => {
    if (!window.confirm(`Run the draw for “${g.name}” now?`)) return;
    setBusy(g.id);
    const res = await drawLucky(g.id);
    setBusy(null);
    if (res.ok) { toast(`Winning number: ${res.winningNumber}!`, "success"); await load(); }
    else toast(res.error ?? "Could not run the draw", "error");
  };

  const visible = useMemo(() => games.filter((g) => g.enabled && g.status !== "cancelled"), [games]);

  if (!featureOn) return <div className="mx-auto max-w-2xl p-8 text-center text-mist-400"><Ticket className="mx-auto mb-2 size-8 text-mist-500" /> The Lucky Number game is currently unavailable.</div>;

  // A multi-round game room takes over the whole screen while it's open.
  if (openRoom) return <div className="mx-auto max-w-3xl pb-24"><LuckyGameRoom gameId={openRoom} onBack={() => setOpenRoom(null)} /></div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-24">
      <div className="flex items-center gap-2">
        <Ticket className="size-6 text-lotus-300" />
        <div>
          <h1 className="font-display text-2xl font-extrabold text-mist-100">Lucky Number</h1>
          <p className="text-sm text-mist-400">Pick your number, wait for the draw, and win if it&rsquo;s yours.</p>
        </div>
      </div>

      {/* §1 — GAME ROOM LIST. Multi-round games appear here with their host,
          player count, round progress and status, each with a Join button. */}
      {rooms.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-mist-200">Game rooms</p>
          {rooms.map((r) => (
            <button
              key={r.id}
              onClick={() => setOpenRoom(r.id)}
              className="flex w-full flex-wrap items-center gap-3 rounded-2xl border border-line bg-ink-900 p-4 text-left transition hover:border-lotus-400/40 hover:bg-ink-850"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-lotus-500/15 text-lotus-300"><Ticket className="size-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-mist-100">{r.name}</span>
                <span className="block truncate text-[11px] text-mist-500">
                  Host: {r.hostName}{r.coHostName !== "—" ? ` · Co-host: ${r.coHostName}` : ""}{r.groupRoomName ? ` · ${r.groupRoomName}` : ""}
                </span>
                <span className="mt-0.5 block text-xs text-mist-400">
                  Players: {r.players} / {r.maxPlayers} · Round {r.currentRound} / {r.totalRounds}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold capitalize",
                  r.gameStatus === "started" ? "bg-emerald-500/15 text-emerald-300"
                    : r.gameStatus === "completed" ? "bg-white/10 text-mist-400"
                    : "bg-amber-500/15 text-amber-300",
                )}>
                  {r.gameStatus === "joiningOpen" ? "Joining open" : r.gameStatus}
                </span>
                {r.myRole
                  ? <span className="text-[10px] font-semibold text-lotus-300">You&rsquo;re the {r.myRole} →</span>
                  : r.joined
                    ? <span className="text-[10px] font-semibold text-lotus-300">You&rsquo;re in →</span>
                    : r.players >= r.maxPlayers
                      ? <span className="text-[10px] font-semibold text-rose-300">ROOM FULL</span>
                      : <span className="text-[10px] font-semibold text-mist-400">{r.canJoin ? "Join →" : "Open →"}</span>}
              </span>
            </button>
          ))}
        </div>
      )}

      {loading ? <div className="grid h-32 place-items-center text-mist-500"><Loader2 className="size-6 animate-spin" /></div> :
        visible.length === 0 && rooms.length === 0 ? (
          <div className="rounded-2xl border border-line bg-ink-900/50 p-10 text-center">
            <Sparkles className="mx-auto mb-2 size-7 text-mist-500" />
            <p className="text-sm text-mist-400">No Lucky Number game is running right now.</p>
            {/* The game is fully built, but it only appears once an admin CREATES
                a draw. Without this the page looked like a missing feature. */}
            {user?.role === "admin" ? (
              <>
                <p className="mx-auto mt-2 max-w-md text-xs text-mist-500">
                  Lucky Number shows a draw only after you create one — set the number range, ticket price, prize and closing time, then it appears here for every member.
                </p>
                <Link href="/admin/lucky-number" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-lotus-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-lotus-500">
                  <Ticket className="size-4" /> Create the first draw
                </Link>
              </>
            ) : (
              <p className="mt-2 text-xs text-mist-500">Check back soon — a new draw opens regularly.</p>
            )}
          </div>
        ) :
        visible.map((g) => {
          const mine = picks[g.id] ?? [];
          const iWon = g.status === "drawn" && g.winningNumber != null && g.myNumbers.includes(g.winningNumber);
          const count = g.maxNumber - g.minNumber + 1;
          const grid = count <= 200;
          const countdownTarget = g.status === "scheduled" ? g.startAt : g.status === "open" ? (g.endAt ?? g.drawAt) : g.drawAt;
          const left = g.status === "open" || g.status === "scheduled" ? timeLeft(countdownTarget, now) : null;
          return (
            <div key={g.id} className={cn("rounded-2xl border p-4 sm:p-5", iWon ? "border-gold-400/50 bg-gold-500/[0.06]" : "border-line bg-ink-900/60")}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-lg font-bold text-mist-100">{g.name}</h2>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold uppercase", STATUS_STYLE[g.status])}>{g.status === "open" ? "Live" : g.status}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-mist-500">
                    <span>Numbers {g.minNumber}–{g.maxNumber}</span>
                    {g.entryFee > 0 ? <span className="inline-flex items-center gap-1"><Coins className="size-3 text-gold-300" /> {g.entryFee} to enter</span> : <span className="text-emerald-300">Free entry</span>}
                    {g.prize > 0 && <span className="inline-flex items-center gap-1"><Trophy className="size-3 text-gold-300" /> {n(g.prize)} prize{g.splitPrize ? " (split)" : ""}</span>}
                    <span className="inline-flex items-center gap-1"><Users className="size-3" /> {g.participantsCount} playing</span>
                    {g.maxPicksPerUser > 1 && <span>up to {g.maxPicksPerUser} picks</span>}
                  </div>
                  {g.prizeDetail && <p className="mt-1 text-[12px] text-mist-400">🎁 {g.prizeDetail}</p>}
                </div>
                {left && (
                  <div className="rounded-xl border border-line bg-ink-800 px-3 py-1.5 text-center">
                    <div className="flex items-center gap-1 text-[10px] uppercase text-mist-500"><Clock className="size-3" /> {g.status === "scheduled" ? "Opens in" : g.endAt ? "Closes in" : "Draw in"}</div>
                    <div className="font-display text-base font-bold tabular-nums text-lotus-200">{left}</div>
                  </div>
                )}
              </div>

              {/* Result */}
              {g.status === "drawn" && g.winningNumber != null && (
                <div className={cn("mt-3 rounded-xl border p-3 text-center", iWon ? "border-gold-400/50 bg-gold-500/10" : "border-lotus-400/30 bg-lotus-500/[0.07]")}>
                  <div className="text-[10px] uppercase text-mist-500">Winning number</div>
                  <div className="font-display text-4xl font-extrabold text-lotus-200">{g.winningNumber}</div>
                  {iWon ? <div className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-gold-200"><Trophy className="size-4" /> You won! 🎉</div>
                    : g.myNumbers.length > 0 ? <div className="mt-1 text-[12px] text-mist-400">Your pick: {g.myNumbers.join(", ")} — not this time.</div> : null}
                  <div className="mt-1 text-[11px] text-mist-500">{(g.winners?.length ?? 0)} winner{(g.winners?.length ?? 0) === 1 ? "" : "s"}{g.winners && g.winners.length > 0 ? ` · ${g.winners.slice(0, 6).map((w) => w.name).join(", ")}${g.winners.length > 6 ? "…" : ""}` : ""}</div>
                </div>
              )}

              {/* Number picker (open games) */}
              {g.canEnter && (
                <div className="mt-3">
                  {g.myNumbers.length > 0 && <p className="mb-1.5 text-[12px] text-emerald-300">✓ Your current pick: {g.myNumbers.join(", ")}{g.allowEditPick ? " — you can change it below." : ""}</p>}
                  {grid ? (
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: count }, (_, i) => g.minNumber + i).map((num) => {
                        const on = mine.includes(num);
                        return <button key={num} onClick={() => togglePick(g, num)} className={cn("min-w-9 rounded-lg border px-2 py-1.5 text-sm font-bold tabular-nums transition", on ? "border-lotus-400 bg-lotus-500/80 text-white" : "border-line bg-ink-800 text-mist-300 hover:border-lotus-400/50 hover:text-mist-100")}>{num}</button>;
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <input type="number" min={g.minNumber} max={g.maxNumber} placeholder={`${g.minNumber}–${g.maxNumber}`} className="h-10 w-32 rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none"
                        onKeyDown={(e) => { if (e.key === "Enter") { const v = Math.floor(Number((e.target as HTMLInputElement).value)); if (v >= g.minNumber && v <= g.maxNumber) { togglePick(g, v); (e.target as HTMLInputElement).value = ""; } } }} />
                      <span className="text-[11px] text-mist-500">type a number, press Enter</span>
                      <div className="flex flex-wrap gap-1.5">{mine.map((num) => <button key={num} onClick={() => togglePick(g, num)} className="rounded-lg border border-lotus-400 bg-lotus-500/80 px-2 py-1 text-sm font-bold text-white">{num} ✕</button>)}</div>
                    </div>
                  )}
                  <div className="mt-2.5 flex items-center gap-2">
                    <Button size="sm" onClick={() => submit(g)} disabled={busy === g.id || mine.length === 0}>{busy === g.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {g.myNumbers.length ? "Update my pick" : "Submit"}</Button>
                    {mine.length > 0 && <span className="text-[12px] text-mist-400">Selected: {mine.join(", ")}</span>}
                  </div>
                </div>
              )}

              {g.status === "closed" && g.myNumbers.length > 0 && <p className="mt-3 text-[12px] text-mist-400">Entries closed. Your pick: <b className="text-mist-200">{g.myNumbers.join(", ")}</b>. Waiting for the draw…</p>}
              {g.status === "closed" && g.myNumbers.length === 0 && <p className="mt-3 text-[12px] text-mist-500">Entries are closed. Waiting for the draw…</p>}

              {/* Host / co-host / admin draw control (method stays secret to them) */}
              {g.canDraw && g.status !== "drawn" && g.status !== "cancelled" && (
                <div className="mt-3 border-t border-line/60 pt-3">
                  <Button size="sm" variant="secondary" onClick={() => runDraw(g)} disabled={busy === g.id}>{busy === g.id ? <Loader2 className="size-4 animate-spin" /> : <Dice5 className="size-4" />} Run the draw</Button>
                  <span className="ml-2 text-[11px] text-mist-500">You can reveal the winning number for this game.</span>
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
