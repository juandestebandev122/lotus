"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LiveDot } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { fetchGameSessions, forceEndGame, type GameSessionView } from "@/lib/admin";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { ReportFilters, matchesReportFilter, emptyReportFilter, type ReportFilter } from "@/components/admin/ReportFilters";
import { AdminGameWatchModal, AdminWatchAll } from "@/components/admin/AdminGameWatch";
import { Gamepad2, Users, Crown, Trophy, AlertTriangle, Octagon, RefreshCw, Eye, Home, Download } from "lucide-react";

interface GameResult {
  id: string;
  game: string;
  roomName: string;
  playerNames: string[];
  winnerName?: string;
  at: string;
}

// Render-safe text: turn anything (incl. a stray object like {v:1} from old
// corrupt data) into a string React can display, so it can never crash the page.
const txt = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : typeof v === "number" || typeof v === "boolean" ? String(v) : "");

// Normalise one session so every rendered field is a safe primitive/array.
const safeSession = (s: GameSessionView): GameSessionView => ({
  ...s,
  game: txt(s?.game),
  roomName: txt(s?.roomName) || "Room",
  startedByName: txt(s?.startedByName),
  winner: s?.winner == null ? undefined : txt(s.winner),
  players: Array.isArray(s?.players) ? s.players.map(txt) : [],
});

export default function AdminGameSessionsPage() {
  const { toast } = useToast();
  const [active, setActive] = useState<GameSessionView[]>([]);
  const [history, setHistory] = useState<GameSessionView[]>([]);
  const [multi, setMulti] = useState<{ name: string; count: number }[]>([]);
  const [results, setResults] = useState<GameResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmEnd, setConfirmEnd] = useState<GameSessionView | null>(null);
  // Live viewing straight from the admin panel — one game in a modal, or every
  // running game side by side. Neither counts the admin as a spectator.
  const [watching, setWatching] = useState<GameSessionView | null>(null);
  const [watchAll, setWatchAll] = useState(false);
  const [repFilter, setRepFilter] = useState<ReportFilter>(emptyReportFilter);
  const shownResults = results.filter((r) => matchesReportFilter(repFilter, r.at, `${(r.playerNames || []).join(" ")} ${r.winnerName ?? ""} ${r.roomName ?? ""}`));
  const shownHistory = history.filter((s) => matchesReportFilter(repFilter, s.endedAt || s.createdAt, `${(s.players || []).join(" ")} ${s.winner ?? ""} ${s.roomName ?? ""}`));

  // Download the (filtered) match history as CSV — a permanent dispute record.
  const exportHistory = () => {
    const rows = [
      ["Date & time", "Game", "Room", "Players", "Winner"],
      ...shownResults.map((r) => [
        new Date(r.at).toLocaleString("en-SA"),
        r.game,
        r.roomName ?? "",
        `"${(r.playerNames || []).join(", ").replace(/"/g, "'")}"`,
        r.winnerName ?? "",
      ]),
    ];
    const csv = rows.map((row) => row.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "lotus-game-history.csv"; a.click();
    URL.revokeObjectURL(url);
    toast("Game history exported", "success");
  };

  // Group the running games by their Group (room) so the admin sees them
  // organised per group rather than as one flat list.
  const activeGroups = (() => {
    const byRoom = new Map<string, { roomId: string; roomName: string; sessions: GameSessionView[] }>();
    const order: string[] = [];
    for (const s of active) {
      const key = s.roomId || s.roomName || s.id;
      let g = byRoom.get(key);
      if (!g) { g = { roomId: key, roomName: s.roomName, sessions: [] }; byRoom.set(key, g); order.push(key); }
      g.sessions.push(s);
    }
    return order.map((k) => byRoom.get(k)!).sort((a, b) => (a.roomName || "").localeCompare(b.roomName || ""));
  })();

  const load = () => {
    // Keep the previous lists if a poll fails (flaky connection) — don't blank
    // the screen, which looked like "active games not updating".
    // Coerce every field to a safe shape — a single null/non-array/object value
    // from the API must never crash the whole page render (React error #31).
    fetchGameSessions().then((d) => {
      if (d) {
        setActive((Array.isArray(d.active) ? d.active : []).map(safeSession));
        setHistory((Array.isArray(d.history) ? d.history : []).map(safeSession));
        setMulti(Array.isArray(d.multiGamePlayers) ? d.multiGamePlayers.map((m) => ({ name: txt(m?.name), count: Number(m?.count) || 0 })) : []);
      }
      setLoading(false);
    });
    fetch(withBase("/api/admin/game-results"), { credentials: "include", cache: "no-store" })
      .then((r) => r.json()).then((d) => {
        if (Array.isArray(d?.results)) {
          setResults(d.results.map((r: GameResult) => ({ ...r, game: txt(r?.game), roomName: txt(r?.roomName), winnerName: r?.winnerName == null ? undefined : txt(r.winnerName), playerNames: Array.isArray(r?.playerNames) ? r.playerNames.map(txt) : [] })));
        }
      }).catch(() => {});
  };
  useEffect(() => {
    load();
    const t = setInterval(load, 8000); // live refresh
    return () => clearInterval(t);
  }, []);

  const end = async (s: GameSessionView) => {
    setConfirmEnd(null);
    const ok = await forceEndGame(s.id);
    toast(ok ? `${s.game} in "${s.roomName}" was ended` : "Could not end game", ok ? "success" : "error");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-mist-100">Games &amp; Game History</h1>
          <p className="text-sm text-mist-400">Live games across all rooms (force-end any), plus the complete finished-match history — players, winner and exact time — for resolving disputes. Exportable as CSV.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={load}><RefreshCw className="size-4" /> Refresh</Button>
      </div>

      {/* Multi-game players alert */}
      {multi.length > 0 && (
        <Card className="flex flex-wrap items-center gap-2 border-amber-400/30 bg-amber-500/[0.06] p-4">
          <AlertTriangle className="size-5 text-amber-300" />
          <span className="text-sm text-amber-200">Players in more than one live game:</span>
          {multi.map((m) => (
            <span key={m.name} className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-200">{m.name} ({m.count})</span>
          ))}
        </Card>
      )}

      {/* Active games — grouped by Group (room) name */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-mist-100">
            <span className="flex items-center gap-1.5 text-rose-300"><LiveDot /></span> Running games {!loading && <span className="font-normal text-mist-500">({active.length} in {activeGroups.length} group{activeGroups.length === 1 ? "" : "s"})</span>}
          </h2>
          {/* WATCH ALL — every live board on one screen, without entering any room. */}
          {active.length > 0 && (
            <button
              onClick={() => setWatchAll((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                watchAll ? "bg-lotus-500 text-white hover:bg-lotus-400" : "bg-ink-800 text-mist-200 hover:bg-white/[0.06]",
              )}
            >
              <Eye className="size-3.5" /> {watchAll ? "Hide live boards" : `Watch all live games (${active.length})`}
            </button>
          )}
        </div>

        {/* All running boards, side by side */}
        {watchAll && (
          <div className="mb-5">
            <AdminWatchAll
              sessions={active.map((s) => ({ id: s.id, game: s.game, roomName: s.roomName, players: s.players || [] }))}
            />
          </div>
        )}

        {!loading && activeGroups.length === 0 ? (
          <Card className="p-10 text-center text-sm text-mist-500">No games are running right now.</Card>
        ) : (
          <div className="space-y-5">
            {activeGroups.map((g) => (
              <div key={g.roomId} className="rounded-2xl border border-white/8 bg-ink-900/30 p-4">
                {/* Group (room) heading */}
                <div className="mb-3 flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-lg bg-lotus-500/15 text-lotus-200"><Home className="size-4" /></span>
                  <h3 className="font-display font-bold text-mist-100">{g.roomName || "Unnamed group"}</h3>
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-mist-300">{g.sessions.length} live game{g.sessions.length === 1 ? "" : "s"}</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {g.sessions.map((s) => (
                    <Card key={s.id} className="p-5">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-lotus-500/15 px-2.5 py-1 text-xs font-semibold text-lotus-200"><Gamepad2 className="size-3.5" /> {s.game}</span>
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-300"><LiveDot /> RUNNING</span>
                      </div>
                      <p className="mt-3 flex items-center gap-1 text-xs text-mist-500"><Crown className="size-3 text-gold-400" /> Started by {s.startedByName}</p>
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-mist-400"><Users className="size-3.5" /> {(s.players || []).length ? (s.players || []).join(", ") : "—"}</p>
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-rose-300"><Eye className="size-3.5" /> {s.spectatorCount ?? 0} watching</p>
                      <p className="mt-1 text-[11px] text-mist-500">Since {new Date(s.createdAt).toLocaleTimeString("en-SA", { hour: "2-digit", minute: "2-digit" })}</p>
                      {/* Watch this exact game live, right here — no need to open
                          its room. The admin is not counted as a spectator. */}
                      <Button size="sm" variant="secondary" block className="mt-3" onClick={() => setWatching(s)}><Eye className="size-4" /> Watch live</Button>
                      <Button size="sm" variant="danger" block className="mt-2" onClick={() => setConfirmEnd(s)}><Octagon className="size-4" /> Force end</Button>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Match history — every finished match (incl. rematches): players + winner */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-mist-100">
            <Trophy className="size-4 text-gold-300" /> Match history
            {!loading && <span className="font-normal text-mist-500">({shownResults.length} of {results.length})</span>}
          </h2>
          {/* Downloadable dispute record — every finished match with players, winner
              and exact time, so a complaint can always be checked against the log. */}
          <button onClick={exportHistory} className="inline-flex items-center gap-1.5 rounded-lg bg-ink-800 px-3 py-1.5 text-xs font-semibold text-mist-200 transition hover:bg-white/[0.06] hover:text-mist-100">
            <Download className="size-3.5" /> Export match history (CSV)
          </button>
        </div>
        {/* Filter all the game reports below by user / date / month / year / range */}
        <ReportFilters value={repFilter} onChange={setRepFilter} className="mb-3" />
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-mist-500">
                  <th className="px-4 py-3 font-semibold">Game</th>
                  <th className="px-4 py-3 font-semibold">Room</th>
                  <th className="px-4 py-3 font-semibold">Players</th>
                  <th className="px-4 py-3 font-semibold">Winner</th>
                  <th className="px-4 py-3 font-semibold">When</th>
                </tr>
              </thead>
              <tbody>
                {shownResults.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3 text-mist-200">{r.game}</td>
                    <td className="px-4 py-3 text-mist-300">{r.roomName}</td>
                    <td className="px-4 py-3 text-xs text-mist-400">{(r.playerNames || []).length ? (r.playerNames || []).join(", ") : "—"}</td>
                    <td className="px-4 py-3 font-semibold text-gold-300"><span className="inline-flex items-center gap-1"><Crown className="size-3.5" /> {r.winnerName ?? "—"}</span></td>
                    <td className="px-4 py-3 text-xs text-mist-400">{new Date(r.at).toLocaleString("en-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                  </tr>
                ))}
                {!loading && shownResults.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-mist-500">No matches match this filter.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Winner history (per session) */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-mist-100"><Trophy className="size-4 text-gold-300" /> Session winner history</h2>
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-mist-500">
                  <th className="px-4 py-3 font-semibold">Game</th>
                  <th className="px-4 py-3 font-semibold">Room</th>
                  <th className="px-4 py-3 font-semibold">Winner</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Ended</th>
                </tr>
              </thead>
              <tbody>
                {shownHistory.map((s) => (
                  <tr key={s.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3 text-mist-200">{s.game}</td>
                    <td className="px-4 py-3 text-mist-300">{s.roomName}</td>
                    <td className="px-4 py-3 font-semibold text-gold-300">{s.winner ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", s.status === "completed" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300")}>
                        {s.status === "ended" ? "Force-ended" : s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-mist-400">{s.endedAt ? new Date(s.endedAt).toLocaleString("en-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  </tr>
                ))}
                {!loading && shownHistory.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-mist-500">No sessions match this filter.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {confirmEnd && (
        <ConfirmDialog danger title={`Force-end this ${confirmEnd.game} game?`} message={`This ends the game in "${confirmEnd.roomName}" for all players immediately.`} confirmLabel="Force end" cancelLabel="Cancel" onConfirm={() => end(confirmEnd)} onCancel={() => setConfirmEnd(null)} />
      )}

      {/* Live view of one game, inside the admin panel */}
      {watching && (
        <AdminGameWatchModal
          sessionId={watching.id}
          game={watching.game}
          roomName={watching.roomName}
          onClose={() => setWatching(null)}
        />
      )}
    </div>
  );
}
