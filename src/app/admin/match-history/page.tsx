"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { fetchMatchHistory, fetchMatchDetail, type MatchHistoryRow, type MatchDetail } from "@/lib/admin";
import { History, Search, Loader2, X, Trophy, Dices, Scissors, Home as HomeIcon, Users, Clock, Download, Eye } from "lucide-react";

const RANGES: { key: string; label: string }[] = [
  { key: "today", label: "Today" }, { key: "week", label: "7 days" }, { key: "month", label: "30 days" }, { key: "all", label: "All time" }, { key: "custom", label: "Custom" },
];

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const fmtTime = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—");
const dur = (s?: number) => (s == null ? "—" : s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`);

const STATUS: Record<string, string> = {
  completed: "bg-emerald-500/15 text-emerald-300",
  abandoned: "bg-amber-500/15 text-amber-300",
  live: "bg-rose-500/15 text-rose-300",
};

export default function AdminMatchHistoryPage() {
  const [range, setRange] = useState("all");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<MatchHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchMatchHistory({ range, from: range === "custom" ? from : undefined, to: range === "custom" ? to : undefined, q: q.trim() || undefined })
      .then(setMatches).finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [range]);

  const exportCsv = () => {
    const head = ["Date", "Match ID", "Room", "Status", "Players", "Winner", "Total rolls", "Duration(s)"];
    const rows = matches.map((m) => [fmtDate(m.at), m.id, m.roomName, m.status, m.players.join(" | "), m.winnerName ?? "", String(m.totalRolls), String(m.durationSec ?? "")]);
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `match-history-${range}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><History className="size-6 text-lotus-300" /> Last Played Match History</h1>
          <p className="mt-1 text-sm text-mist-400">Every Ludo match played, latest first. Open any match to see the full breakdown — players, per-player dice, roll history and the move-by-move timeline.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!matches.length}><Download className="size-4" /> Export CSV</Button>
      </div>

      {/* Filters */}
      <Card className="flex flex-wrap items-center gap-2 p-3">
        <div className="flex flex-wrap gap-1">
          {RANGES.map((r) => (
            <button key={r.key} onClick={() => setRange(r.key)} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition", range === r.key ? "bg-lotus-600/90 text-white" : "bg-ink-800 text-mist-400 hover:text-mist-100")}>{r.label}</button>
          ))}
        </div>
        {range === "custom" && (
          <div className="flex items-center gap-1.5 text-xs text-mist-400">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-line bg-ink-800 px-2 py-1.5 text-mist-100" />
            <span>to</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-line bg-ink-800 px-2 py-1.5 text-mist-100" />
            <Button size="sm" variant="secondary" onClick={load}>Apply</Button>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2 rounded-lg border border-line bg-ink-800 px-2.5">
          <Search className="size-4 text-mist-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Match ID · player · room · winner…" className="h-9 w-56 bg-transparent text-sm text-mist-100 outline-none placeholder:text-mist-500" />
          <button onClick={load} className="text-xs font-semibold text-lotus-300 hover:text-lotus-200">Go</button>
        </div>
      </Card>

      {loading ? (
        <div className="grid h-40 place-items-center text-mist-500"><Loader2 className="size-5 animate-spin" /></div>
      ) : matches.length === 0 ? (
        <Card className="p-10 text-center text-sm text-mist-400">No matches found for this filter.</Card>
      ) : (
        <div className="space-y-2">
          {matches.map((m) => (
            <button key={m.id} onClick={() => setOpenId(m.id)} className="flex w-full items-center gap-3 rounded-xl border border-line bg-ink-850/70 p-3.5 text-left transition hover:border-lotus-400/40 hover:bg-white/[0.03]">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-lotus-500/12 text-lotus-300"><Dices className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold text-mist-100">{m.roomName}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold capitalize", STATUS[m.status])}>{m.status}</span>
                  <span className="font-mono text-[10px] text-mist-600">{m.id}</span>
                </div>
                <div className="mt-0.5 truncate text-xs text-mist-500">
                  {/* Show the actual player names (e.g. "Issac Praveen vs Kutty"), not just the count. */}
                  {fmtDate(m.at)} · <span className="text-mist-300">{m.players.length ? m.players.join(" vs ") : `${m.playerCount} players`}</span>{m.winnerName ? <> · 🏆 <span className="text-emerald-300">{m.winnerName}</span></> : ""} · {m.totalRolls} rolls{m.durationSec != null ? ` · ${dur(m.durationSec)}` : ""}
                </div>
              </div>
              <Eye className="size-4 shrink-0 text-mist-500" />
            </button>
          ))}
        </div>
      )}

      {openId && <MatchModal id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Dices; label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-ink-900/50 p-2.5 text-center">
      <Icon className="mx-auto size-4 text-lotus-300" />
      <div className="mt-1 font-display text-lg font-extrabold text-mist-100 tabular-nums">{value}</div>
      <div className="text-[10px] text-mist-500">{label}</div>
    </div>
  );
}

function MatchModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [d, setD] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"players" | "rolls" | "timeline">("players");
  useEffect(() => { fetchMatchDetail(id).then(setD).finally(() => setLoading(false)); }, [id]);

  const exportDetail = () => {
    if (!d) return;
    const esc = (c: unknown) => `"${String(c ?? "").replace(/"/g, '""')}"`;
    const row = (cells: unknown[]) => cells.map(esc).join(",");
    const lines: string[] = [];
    lines.push(row(["Match", d.id])); lines.push(row(["Room", d.roomName])); lines.push(row(["Status", d.status])); lines.push(row(["Winner", d.winnerName ?? ""]));
    lines.push(row(["Total rolls", d.totalRolls])); lines.push(row(["Total sixes", d.totalSixes])); lines.push(row(["Total cuts", d.totalCuts]));
    lines.push(""); lines.push(row(["Player", "Rolls", "Sixes", "Six%", "Avg", "1", "2", "3", "4", "5", "6"]));
    for (const p of d.players) lines.push(row([p.name, p.total, p.sixes, p.sixPct, p.avg, ...[1, 2, 3, 4, 5, 6].map((v) => p.counts[v] ?? 0)]));
    lines.push(""); lines.push(row(["Roll#", "Dice", "By", "Time"]));
    for (const r of d.rolls) lines.push(row([r.n, r.value, r.by, fmtTime(r.at)]));
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `match-${d.id}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[85] grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-ink-850" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between gap-2 border-b border-white/8 bg-ink-850 p-4">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Dices className="size-5 text-lotus-300" /> Match details</h2>
          <div className="flex items-center gap-2">
            {d && <Button size="sm" variant="secondary" onClick={exportDetail}><Download className="size-3.5" /> Export</Button>}
            <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
          </div>
        </div>

        {loading || !d ? (
          <div className="grid h-52 place-items-center text-mist-500"><Loader2 className="size-5 animate-spin" /></div>
        ) : (
          <div className="space-y-4 p-4">
            {/* Header */}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-bold text-mist-100">{d.roomName}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold capitalize", STATUS[d.status])}>{d.status}</span>
                <span className="font-mono text-[10px] text-mist-600">{d.id}</span>
              </div>
              <div className="mt-1 grid gap-x-4 gap-y-0.5 text-xs text-mist-400 sm:grid-cols-2">
                <div>Room ID: <span className="font-mono text-mist-300">{d.roomId || "—"}</span></div>
                <div>Created by: <span className="text-mist-300">{d.createdBy ?? "—"}</span></div>
                <div>Start: <span className="text-mist-300">{fmtDate(d.createdAt) }</span></div>
                <div>End: <span className="text-mist-300">{fmtDate(d.endedAt)}</span></div>
                <div>Duration: <span className="text-mist-300">{dur(d.durationSec)}</span></div>
                <div>Spectators: <span className="text-mist-300">{d.spectatorCount ?? 0}</span></div>
              </div>
            </div>

            {/* Summary tiles */}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              <Stat icon={Users} label="Players" value={d.totalPlayers} />
              <Stat icon={Dices} label="Total rolls" value={d.totalRolls} />
              <Stat icon={Dices} label="Sixes" value={d.totalSixes} />
              <Stat icon={Scissors} label="Cuts" value={d.totalCuts} />
              <Stat icon={HomeIcon} label="Tokens home" value={d.tokensHome} />
              <Stat icon={Clock} label="Duration" value={dur(d.durationSec)} />
            </div>

            {/* Winner + finish order */}
            <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/[0.05] p-3">
              <div className="flex items-center gap-2 text-sm"><Trophy className="size-4 text-gold-300" /> Winner: <b className="text-emerald-300">{d.winnerName ?? "—"}</b></div>
              {d.finishOrder.length > 0 && <div className="mt-1 text-xs text-mist-400">Finish order: {d.finishOrder.map((n, i) => `${i + 1}. ${n}`).join("  ·  ")}</div>}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 rounded-lg border border-line bg-ink-900/50 p-1">
              {([["players", "Players & dice"], ["rolls", `Roll history (${d.rolls.length})`], ["timeline", `Timeline (${d.timeline.length})`]] as const).map(([k, lbl]) => (
                <button key={k} onClick={() => setTab(k)} className={cn("flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition", tab === k ? "bg-lotus-600/90 text-white" : "text-mist-400 hover:text-mist-100")}>{lbl}</button>
              ))}
            </div>

            {tab === "players" && (
              <div className="space-y-2">
                {d.players.map((p) => (
                  <div key={p.name} className="rounded-lg border border-line bg-ink-900/40 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-mist-100">{p.name}</span>
                      {p.isWinner && <span className="rounded-full bg-gold-500/15 px-2 py-0.5 text-[10px] font-bold text-gold-300">🏆 Winner</span>}
                      {p.id && <span className="font-mono text-[10px] text-mist-600">{p.id}</span>}
                      {p.agency && <span className="rounded bg-lotus-500/12 px-1.5 py-0.5 text-[10px] text-lotus-300">🏛️ {p.agency}</span>}
                      <span className="ml-auto text-[11px] text-mist-500">{p.total} rolls · {p.sixes} sixes · <span className="text-lotus-300">{p.sixPct}%</span> · avg {p.avg} · max {p.maxConsecutiveSixes}× consecutive 6</span>
                    </div>
                    <div className="mt-2 grid grid-cols-6 gap-1.5">
                      {[1, 2, 3, 4, 5, 6].map((v) => (
                        <div key={v} className="rounded border border-line bg-ink-900/60 p-1.5 text-center">
                          <div className="text-sm font-extrabold text-mist-100 tabular-nums">{p.counts[v] ?? 0}</div>
                          <div className="text-[9px] text-mist-500">rolled {v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {d.players.length === 0 && <p className="py-4 text-center text-xs text-mist-500">No player roll data recorded for this match.</p>}
              </div>
            )}

            {tab === "rolls" && (
              <div className="max-h-80 overflow-y-auto rounded-lg border border-line">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-ink-900 text-mist-500"><tr><th className="px-3 py-2 text-left font-semibold">#</th><th className="px-3 py-2 text-left font-semibold">Dice</th><th className="px-3 py-2 text-left font-semibold">Player</th><th className="px-3 py-2 text-left font-semibold">Time</th></tr></thead>
                  <tbody>
                    {d.rolls.map((r) => (
                      <tr key={r.n} className="border-t border-white/5">
                        <td className="px-3 py-1.5 text-mist-500 tabular-nums">{r.n}</td>
                        <td className="px-3 py-1.5"><span className={cn("font-bold tabular-nums", r.value === 6 ? "text-lotus-300" : "text-mist-200")}>{r.value}</span></td>
                        <td className="px-3 py-1.5 text-mist-300">{r.by}</td>
                        <td className="px-3 py-1.5 text-mist-500 tabular-nums">{fmtTime(r.at)}</td>
                      </tr>
                    ))}
                    {d.rolls.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-center text-mist-500">No rolls recorded.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "timeline" && (
              <div className="max-h-80 space-y-1 overflow-y-auto">
                {d.timeline.map((m) => (
                  <div key={m.n} className="flex items-center gap-2 rounded border border-line bg-ink-900/40 px-2.5 py-1.5 text-xs">
                    <span className="w-8 shrink-0 text-right font-mono text-[10px] text-mist-600">{m.n}</span>
                    <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase", m.type === "capture" ? "bg-rose-500/15 text-rose-300" : m.type === "home" || m.type === "win" ? "bg-emerald-500/15 text-emerald-300" : m.type === "roll" ? "bg-lotus-500/15 text-lotus-300" : "bg-white/8 text-mist-400")}>{m.type}</span>
                    <span className="min-w-0 flex-1 truncate text-mist-300">{m.text}</span>
                    <span className="shrink-0 font-mono text-[10px] text-mist-600">{fmtTime(m.at)}</span>
                  </div>
                ))}
                {d.timeline.length === 0 && <p className="py-4 text-center text-xs text-mist-500">No move history recorded for this match.</p>}
              </div>
            )}

            <p className="text-[11px] leading-relaxed text-mist-600">
              Built from this match&apos;s recorded move log. Deeper per-match figures — coins/XP awarded, shield activations, safe-zone entries, disconnect/reconnect counts — aren&apos;t written to the game log yet; adding them needs game-engine event tracking (a separate change we can schedule so nothing in live gameplay is disturbed).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
