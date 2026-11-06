"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy, Dices, Users, Clock, Home, RefreshCw, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";

interface GameMove { n: number; at: string; type: string; by: string; value?: number; text: string }
interface MatchRow {
  id: string;
  game: string;
  roomId: string;
  roomName: string;
  playerNames: string[];
  winnerName?: string;
  at: string;
  iWon: boolean;
  opponents: string[];
  moves?: GameMove[];
}

const MOVE_ICON: Record<string, string> = { roll: "🎲", move: "▶️", home: "🏠", capture: "⚔️", win: "🏆", pass: "⏭️" };

const fmt = (s: string) =>
  new Date(s).toLocaleString("en-SA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function MatchHistoryPage() {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(withBase("/api/games/history"), { credentials: "include" });
      const d = await res.json().catch(() => ({}));
      setMatches((d.matches as MatchRow[]) ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const wins = matches.filter((m) => m.iWon).length;

  return (
    <div className="mx-auto max-w-2xl px-1 py-3">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link href={withBase("/home")} className="inline-flex items-center gap-1.5 text-sm font-semibold text-mist-300 hover:text-mist-100">
          <ArrowLeft className="size-4" /> Back
        </Link>
        <Button size="sm" variant="secondary" onClick={load} disabled={loading}>
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
        <Trophy className="size-6 text-gold-300" /> Match history
      </h1>
      <p className="mt-1 text-sm text-mist-400">Every game you&apos;ve finished. Tap a match to see the full details.</p>

      {/* Summary */}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-line bg-ink-850 p-4">
          <div className="text-xs text-mist-400">Matches played</div>
          <div className="font-display text-2xl font-extrabold text-mist-100">{matches.length}</div>
        </div>
        <div className="rounded-2xl border border-line bg-ink-850 p-4">
          <div className="text-xs text-mist-400">Wins</div>
          <div className="font-display text-2xl font-extrabold text-emerald-300">{wins}</div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {loading && matches.length === 0 && <p className="py-10 text-center text-sm text-mist-500">Loading your matches…</p>}
        {!loading && matches.length === 0 && (
          <div className="rounded-2xl border border-line bg-ink-850 p-8 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-lg bg-petal-500/12 text-petal-400"><Dices className="size-7" /></span>
            <p className="mt-3 text-sm text-mist-300">You haven&apos;t finished any games yet. Play a match in a voice room and it will appear here.</p>
          </div>
        )}

        {matches.map((m) => {
          const open = openId === m.id;
          return (
            <div key={m.id} className={cn("overflow-hidden rounded-2xl border bg-ink-850", m.iWon ? "border-emerald-400/30" : "border-line")}>
              <button onClick={() => setOpenId(open ? null : m.id)} className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-white/[0.03]">
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", m.iWon ? "bg-emerald-500/15 text-emerald-300" : "bg-ink-800 text-mist-400")}>
                  {m.iWon ? <Trophy className="size-5" /> : <Dices className="size-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display font-bold text-mist-100">{m.game}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", m.iWon ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-mist-400")}>
                      {m.iWon ? "WON" : "PLAYED"}
                    </span>
                  </div>
                  <div className="truncate text-xs text-mist-400">{m.roomName} · {fmt(m.at)}</div>
                </div>
              </button>

              {open && (
                <div className="border-t border-white/5 bg-ink-900/40 px-4 py-3 text-sm">
                  <dl className="space-y-2">
                    <div className="flex items-start gap-2">
                      <dt className="flex w-28 shrink-0 items-center gap-1.5 text-xs text-mist-500"><Dices className="size-3.5" /> Game</dt>
                      <dd className="text-mist-200">{m.game}</dd>
                    </div>
                    <div className="flex items-start gap-2">
                      <dt className="flex w-28 shrink-0 items-center gap-1.5 text-xs text-mist-500"><Home className="size-3.5" /> Room</dt>
                      <dd className="text-mist-200">{m.roomName}</dd>
                    </div>
                    <div className="flex items-start gap-2">
                      <dt className="flex w-28 shrink-0 items-center gap-1.5 text-xs text-mist-500"><Clock className="size-3.5" /> Finished</dt>
                      <dd className="text-mist-200">{fmt(m.at)}</dd>
                    </div>
                    <div className="flex items-start gap-2">
                      <dt className="flex w-28 shrink-0 items-center gap-1.5 text-xs text-mist-500"><Users className="size-3.5" /> Players</dt>
                      <dd className="flex flex-wrap gap-1.5">
                        {m.playerNames.map((n, i) => (
                          <span key={`${n}-${i}`} className={cn("rounded-full px-2 py-0.5 text-xs", m.winnerName?.includes(n) ? "bg-gold-400/15 text-gold-200" : "bg-ink-800 text-mist-300")}>{n}</span>
                        ))}
                      </dd>
                    </div>
                    <div className="flex items-start gap-2">
                      <dt className="flex w-28 shrink-0 items-center gap-1.5 text-xs text-mist-500"><Trophy className="size-3.5" /> Winner</dt>
                      <dd className={cn("font-semibold", m.iWon ? "text-emerald-300" : "text-gold-200")}>{m.winnerName ?? "—"}{m.iWon && " (You)"}</dd>
                    </div>
                  </dl>

                  {/* Complete MOVE-BY-MOVE history of the match. */}
                  {m.moves && m.moves.length > 0 && (
                    <div className="mt-3">
                      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-mist-300">
                        <ListOrdered className="size-3.5" /> Move-by-move history
                        <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[10px] text-mist-400">{m.moves.length} moves</span>
                      </div>
                      <ol className="max-h-64 space-y-0.5 overflow-y-auto rounded-xl border border-white/8 bg-ink-900/60 p-2">
                        {m.moves.map((mv) => (
                          <li key={mv.n} className="flex items-start gap-2 rounded-md px-2 py-1 text-xs text-mist-200 odd:bg-white/[0.02]">
                            <span className="w-6 shrink-0 text-right text-[10px] tabular-nums text-mist-500">{mv.n}</span>
                            <span className="shrink-0">{MOVE_ICON[mv.type] ?? "•"}</span>
                            <span className="min-w-0 flex-1 break-words">{mv.text}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  <Link href={withBase(`/rooms/${m.roomId}`)} className="mt-3 inline-block">
                    <Button size="sm" variant="secondary"><Home className="size-3.5" /> Open room</Button>
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
