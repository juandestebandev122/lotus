"use client";

// Admin control for the multi-round Lucky Number game (§4, §32, §50–§52).
// Every button here calls the engine — the browser never decides an outcome.

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { withBase } from "@/lib/base-path";
import { Ticket, Plus, Play, Pause, Dice5, Check, X, RotateCcw, Loader2, ScrollText, Users } from "lucide-react";

interface Row {
  id: string; name: string; gameStatus: string;
  hostName: string; coHostName: string;
  players: number; maxPlayers: number;
  totalRounds: number; currentRound: number;
  roundStatus: string; submitted: number;
  joiningOpen: boolean; groupRoomName?: string;
  minNumber: number; maxNumber: number;
  entryFee?: number; prize?: number; prizeMode?: "round" | "final";
}
interface PanelRow {
  userId: string; userName: string; publicId?: string;
  groupStatus: string; gameStatus: string;
  number: number | null; numberStatus: string;
  wins: number; points: number;
}
interface Detail {
  game: Record<string, unknown> & { audit?: { at: string; actor: string; role: string; action: string; detail?: string }[]; rounds?: { index: number; status: string; winningNumber?: number; winnerIds?: string[]; drawMethod?: string }[] };
  activeRound: { index: number; status: string; winningNumber?: number; winnerIds?: string[] } | null;
  panel: PanelRow[];
  availableCount: number;
  takenCount: number;
}

const api = async (body: Record<string, unknown>) => {
  const res = await fetch(withBase("/api/admin/lucky-games"), {
    method: "POST", headers: { "Content-Type": "application/json" },
    credentials: "include", body: JSON.stringify(body),
  });
  const d = await res.json().catch(() => ({}));
  return { ok: res.ok, error: (d as { error?: string }).error, data: d as Record<string, unknown> };
};

export function LuckyGameManager({ rooms }: { rooms: { id: string; name: string }[] }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manualNum, setManualNum] = useState("");

  const [form, setForm] = useState({
    name: "", totalRounds: 10, minNumber: 1, maxNumber: 100,
    maxPlayers: 50, minPlayers: 2, groupRoomId: "",
    selectionSeconds: 60, selectionMethod: "both" as "pick" | "type" | "both",
    winnerContinuation: "continue" as "continue" | "removed" | "noWin",
    finalRankBy: "wins" as "wins" | "points" | "firstToTarget" | "manual",
    joiningMode: "both" as "manual" | "auto" | "both",
    entryFee: 0, prize: 0,
    prizeMode: "round" as "round" | "final",
    splitPrize: false,
  });

  const loadList = useCallback(async () => {
    const res = await fetch(withBase("/api/admin/lucky-games"), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    setRows((d?.games ?? []) as Row[]);
    setSummary((d?.summary ?? {}) as Record<string, number>);
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(withBase(`/api/admin/lucky-games?id=${id}`), { credentials: "include", cache: "no-store" });
    if (!res.ok) return;
    setDetail(await res.json());
  }, []);

  useEffect(() => { void loadList(); }, [loadList]);
  useEffect(() => {
    if (!openId) return;
    void loadDetail(openId);
    const t = setInterval(() => { void loadDetail(openId); void loadList(); }, 3000);
    return () => clearInterval(t);
  }, [openId, loadDetail, loadList]);

  const act = async (body: Record<string, unknown>, okMsg: string) => {
    setBusy(true);
    const r = await api(body);
    setBusy(false);
    if (r.ok) { toast(okMsg, "success"); await loadList(); if (openId) await loadDetail(openId); }
    else toast(r.error ?? "That didn't work", "error");
    return r.ok;
  };

  const create = async () => {
    if (!form.name.trim()) { toast("Give the game a name", "error"); return; }
    const r = await api({ action: "create", game: { ...form, groupRoomName: rooms.find((x) => x.id === form.groupRoomId)?.name } });
    if (r.ok) { toast("Game created", "success"); setCreating(false); setForm({ ...form, name: "" }); await loadList(); }
    else toast(r.error ?? "Could not create", "error");
  };

  const g = rows.find((x) => x.id === openId);

  return (
    <div className="space-y-4">
      {/* §50 — dashboard summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {([["total", "Total games"], ["active", "Active"], ["waiting", "Waiting"], ["completed", "Completed"], ["players", "Players"]] as const).map(([k, label]) => (
          <Card key={k} className="p-3 text-center">
            <div className="font-display text-2xl font-extrabold text-mist-100">{summary[k] ?? 0}</div>
            <div className="text-[11px] text-mist-400">{label}</div>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Ticket className="size-5 text-lotus-300" /> Multi-round games</h2>
        <Button size="sm" onClick={() => setCreating((v) => !v)}><Plus className="size-4" /> {creating ? "Cancel" : "Create game"}</Button>
      </div>

      {/* §2 / §3 — create + configure */}
      {creating && (
        <Card className="space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <L label="Game name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={F} placeholder="Lucky Number Game #1" /></L>
            <L label="Game group (members only can play)">
              <select value={form.groupRoomId} onChange={(e) => setForm({ ...form, groupRoomId: e.target.value })} className={F}>
                <option value="">Open to everyone</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </L>
            <L label="Total rounds"><input type="number" min={1} max={100} value={form.totalRounds} onChange={(e) => setForm({ ...form, totalRounds: Number(e.target.value) })} className={F} /></L>
            <L label="Number range">
              <div className="flex gap-2">
                <input type="number" value={form.minNumber} onChange={(e) => setForm({ ...form, minNumber: Number(e.target.value) })} className={F} />
                <input type="number" value={form.maxNumber} onChange={(e) => setForm({ ...form, maxNumber: Number(e.target.value) })} className={F} />
              </div>
            </L>
            <L label="Max players"><input type="number" value={form.maxPlayers} onChange={(e) => setForm({ ...form, maxPlayers: Number(e.target.value) })} className={F} /></L>
            <L label="Min players to start"><input type="number" value={form.minPlayers} onChange={(e) => setForm({ ...form, minPlayers: Number(e.target.value) })} className={F} /></L>
            <L label="Selection time (seconds)"><input type="number" value={form.selectionSeconds} onChange={(e) => setForm({ ...form, selectionSeconds: Number(e.target.value) })} className={F} /></L>
            <L label="How players pick">
              <select value={form.selectionMethod} onChange={(e) => setForm({ ...form, selectionMethod: e.target.value as typeof form.selectionMethod })} className={F}>
                <option value="pick">Choose from the grid</option>
                <option value="type">Type a number</option>
                <option value="both">Both</option>
              </select>
            </L>
            <L label="After a player wins">
              <select value={form.winnerContinuation} onChange={(e) => setForm({ ...form, winnerContinuation: e.target.value as typeof form.winnerContinuation })} className={F}>
                <option value="continue">Can keep playing</option>
                <option value="removed">Removed from later rounds</option>
                <option value="noWin">Can play but cannot win again</option>
              </select>
            </L>
            <L label="Final ranking by">
              <select value={form.finalRankBy} onChange={(e) => setForm({ ...form, finalRankBy: e.target.value as typeof form.finalRankBy })} className={F}>
                <option value="wins">Total round wins</option>
                <option value="points">Total points</option>
                <option value="firstToTarget">First to reach the wins</option>
                <option value="manual">Manual admin ranking</option>
              </select>
            </L>
            <L label="Joining cost (coins — 0 = free)">
              <input type="number" min={0} value={form.entryFee} onChange={(e) => setForm({ ...form, entryFee: Math.max(0, Number(e.target.value)) })} className={F} />
            </L>
            <L label="Prize (coins — 0 = no prize)">
              <input type="number" min={0} value={form.prize} onChange={(e) => setForm({ ...form, prize: Math.max(0, Number(e.target.value)) })} className={F} />
            </L>
            <L label="Prize is paid">
              <select value={form.prizeMode} onChange={(e) => setForm({ ...form, prizeMode: e.target.value as typeof form.prizeMode })} className={F}>
                <option value="round">To the winner of EVERY round</option>
                <option value="final">Once, to the overall winner at the end</option>
              </select>
            </L>
            <L label="If several players win at once">
              <select value={form.splitPrize ? "split" : "each"} onChange={(e) => setForm({ ...form, splitPrize: e.target.value === "split" })} className={F}>
                <option value="each">Each winner gets the full prize</option>
                <option value="split">Split the prize between them</option>
              </select>
            </L>
          </div>
          {form.prize > 0 && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
              This game pays real coins.{" "}
              {form.prizeMode === "round"
                ? <>With <b>{form.totalRounds}</b> rounds paying <b>{form.prize}</b> each, it can cost up to <b>{(form.totalRounds * form.prize).toLocaleString("en-SA")}</b> coins{form.splitPrize ? "" : " per winner"}.</>
                : <>One payout of <b>{form.prize}</b> coins at the end{form.splitPrize ? ", split between joint winners" : ", to each joint winner"}.</>}
              {form.entryFee > 0 && <> Players are charged <b>{form.entryFee}</b> coins to join, refunded if the game is cancelled.</>}
            </p>
          )}
          <Button onClick={create}><Check className="size-4" /> Create game</Button>
        </Card>
      )}

      {/* Game list */}
      {rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-mist-400">No multi-round games yet — create one above.</Card>
      ) : rows.map((r) => (
        <Card key={r.id} className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-mist-100">{r.name}</p>
              <p className="text-[11px] text-mist-500">
                Host {r.hostName} · {r.groupRoomName ?? "open to everyone"} · numbers {r.minNumber}–{r.maxNumber}
                {r.entryFee ? ` · joining ${r.entryFee} coins` : " · free to join"}
                {r.prize ? ` · prize ${r.prize} coins ${r.prizeMode === "final" ? "(overall winner)" : "(every round)"}` : ""}
              </p>
              <p className="text-xs text-mist-400">
                Round {r.currentRound}/{r.totalRounds} ({r.roundStatus}) · Players {r.players}/{r.maxPlayers} · {r.submitted} numbers submitted
              </p>
            </div>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold capitalize",
              r.gameStatus === "started" ? "bg-emerald-500/15 text-emerald-300" : r.gameStatus === "completed" ? "bg-white/10 text-mist-400" : "bg-amber-500/15 text-amber-300")}>{r.gameStatus}</span>
            <Button size="sm" variant="secondary" onClick={() => setOpenId(openId === r.id ? null : r.id)}>{openId === r.id ? "Close" : "Manage"}</Button>
          </div>

          {openId === r.id && (
            <div className="mt-4 space-y-3 border-t border-line pt-3">
              {/* §4 + §32 — the control set */}
              <div className="flex flex-wrap gap-2">
                <B on={!r.joiningOpen} busy={busy} onClick={() => act({ action: r.joiningOpen ? "closeJoining" : "openJoining", gameId: r.id }, r.joiningOpen ? "Joining closed" : "Joining open")}>
                  {r.joiningOpen ? "Close joining" : "Open joining"}
                </B>
                <B busy={busy} onClick={() => act({ action: "start", gameId: r.id }, "Game started")}><Play className="size-3.5" /> Start game</B>
                <B busy={busy} onClick={() => act({ action: r.gameStatus === "paused" ? "resume" : "pause", gameId: r.id }, r.gameStatus === "paused" ? "Resumed" : "Paused")}>
                  <Pause className="size-3.5" /> {r.gameStatus === "paused" ? "Resume" : "Pause"}
                </B>
                <B busy={busy} onClick={() => act({ action: "startRound", gameId: r.id }, "Round started")}>Start round</B>
                <B busy={busy} onClick={() => act({ action: "closeSelection", gameId: r.id }, "Selection closed")}>Close selection</B>
                <B busy={busy} onClick={() => act({ action: "reopenSelection", gameId: r.id }, "Selection reopened")}>Reopen selection</B>
                <B busy={busy} onClick={() => act({ action: "draw", gameId: r.id, method: "auto" }, "Draw complete")}><Dice5 className="size-3.5" /> Auto draw</B>
                <span className="inline-flex items-center gap-1">
                  <input value={manualNum} onChange={(e) => setManualNum(e.target.value.replace(/\D/g, ""))} placeholder="No." className="h-8 w-16 rounded-lg border border-line bg-ink-900 px-2 text-center text-xs text-mist-100 outline-none" />
                  <B busy={busy || !manualNum} onClick={() => act({ action: "draw", gameId: r.id, method: "manual", number: Number(manualNum) }, "Draw complete")}>Manual draw</B>
                </span>
                <B busy={busy} onClick={() => act({ action: "completeRound", gameId: r.id }, "Round completed")}><Check className="size-3.5" /> Complete round &amp; next</B>
              </div>

              {/* Ending a game for good. Both give every player their joining
                  cost back, so neither can quietly pocket anyone's coins. */}
              <div className="flex flex-wrap gap-2">
                <B busy={busy} onClick={() => {
                  const reason = window.prompt(`Cancel “${r.name}”? Every player's joining cost is refunded. Optional reason:`, "");
                  if (reason === null) return;
                  void act({ action: "cancel", gameId: r.id, reason }, "Game cancelled — joining costs refunded");
                }}><X className="size-3.5" /> Cancel game</B>
                <B busy={busy} onClick={() => {
                  if (!window.confirm(`Delete “${r.name}” for good?\n\nEvery player's joining cost is refunded first. The game and its history are removed and this cannot be undone.`)) return;
                  setOpenId(null);
                  void act({ action: "delete", gameId: r.id }, "Game deleted — joining costs refunded");
                }}>Delete game</B>
              </div>

              {detail && (
                <>
                  {/* §4 — WHO RUNS THIS GAME. Without a Host (or a linked group,
                      whose own host counts automatically) nobody but an admin
                      can start the game, and everyone sits waiting. */}
                  <div className="rounded-lg border border-line bg-ink-900 p-3">
                    <p className="mb-2 text-xs font-semibold text-mist-300"><Users className="mr-1 inline size-3.5" /> Who runs this game</p>
                    <div className="flex flex-wrap items-end gap-3">
                      {(["host", "coHost"] as const).map((which) => {
                        const curId = String(detail.game[which === "host" ? "hostId" : "coHostId"] ?? "");
                        return (
                          <label key={which} className="block">
                            <span className="text-[11px] font-semibold text-mist-400">{which === "host" ? "Host" : "Co-Host"}</span>
                            <select
                              value={curId}
                              disabled={busy}
                              onChange={(e) => {
                                const id = e.target.value;
                                const name = detail.panel.find((p) => p.userId === id)?.userName ?? null;
                                void act(
                                  { action: which === "host" ? "assignHost" : "assignCoHost", gameId: r.id, userId: id || null, userName: name },
                                  id ? `${name} is now the ${which === "host" ? "Host" : "Co-Host"}` : `${which === "host" ? "Host" : "Co-Host"} cleared`,
                                );
                              }}
                              className="mt-1 h-9 rounded-lg border border-line bg-ink-950 px-2 text-sm text-mist-100 outline-none focus:border-lotus-400"
                            >
                              <option value="">— nobody —</option>
                              {detail.panel.map((p) => <option key={p.userId} value={p.userId}>{p.userName}{p.publicId ? ` (${p.publicId})` : ""}</option>)}
                            </select>
                          </label>
                        );
                      })}
                      <p className="min-w-[220px] flex-1 text-[11px] text-mist-500">
                        The Host and Co-Host get the game controls on their own game screen — what they may do is set
                        under <b className="text-mist-300">Host &amp; Co-Host permissions</b> above. If this game is tied to a group,
                        that group&rsquo;s own host and co-hosts already count automatically.
                      </p>
                    </div>
                    {!detail.game.hostId && !detail.game.coHostId && !detail.game.groupRoomId && (
                      <p className="mt-2 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200">
                        No Host, no Co-Host and no group — <b>only an administrator can run this game</b>. Pick a Host above (or link a group when creating the game).
                      </p>
                    )}
                  </div>

                  <p className="text-xs text-mist-400">
                    Numbers taken: <b className="text-mist-200">{detail.takenCount}</b> · available: <b className="text-mist-200">{detail.availableCount}</b>
                    {detail.activeRound?.winningNumber != null && <> · winning number this round: <b className="text-gold-300">{detail.activeRound.winningNumber}</b></>}
                  </p>

                  {/* §51 — player / number panel with BOTH statuses */}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead><tr className="border-b border-line text-left text-xs text-mist-400">
                        <th className="py-2">Player</th><th>Group</th><th>Game</th><th>Number</th><th>Status</th><th>Wins</th><th></th>
                      </tr></thead>
                      <tbody>
                        {detail.panel.length === 0 ? (
                          <tr><td colSpan={7} className="py-4 text-center text-xs text-mist-500">No players yet.</td></tr>
                        ) : detail.panel.map((p) => (
                          <tr key={p.userId} className="border-b border-line/60">
                            <td className="py-1.5 text-mist-200">{p.userName}</td>
                            <td className={p.groupStatus === "Member" ? "text-emerald-300" : "text-rose-300"}>{p.groupStatus}</td>
                            <td className="text-mist-400">{p.gameStatus}</td>
                            <td className="font-bold tabular-nums text-lotus-200">{p.number ?? "—"}</td>
                            <td className="text-xs text-mist-400">{p.numberStatus}</td>
                            <td className="tabular-nums text-mist-300">{p.wins}</td>
                            <td className="text-right">
                              {p.number != null && (
                                <button onClick={() => act({ action: "resetNumber", gameId: r.id, userId: p.userId }, "Number reset")} title="Reset this player's number" className="text-xs text-amber-300 hover:underline"><RotateCcw className="inline size-3" /> reset</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* §56 — audit log */}
                  {detail.game.audit && detail.game.audit.length > 0 && (
                    <details className="rounded-lg border border-line bg-ink-900 p-3">
                      <summary className="cursor-pointer text-xs font-semibold text-mist-300"><ScrollText className="mr-1 inline size-3.5" /> Audit log ({detail.game.audit.length})</summary>
                      <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                        {[...detail.game.audit].reverse().slice(0, 200).map((a, i) => (
                          <div key={i} className="flex gap-2 text-[11px]">
                            <span className="shrink-0 tabular-nums text-mist-600">{new Date(a.at).toLocaleTimeString("en-SA", { hour: "2-digit", minute: "2-digit" })}</span>
                            <span className="shrink-0 font-semibold text-mist-400">{a.actor}</span>
                            <span className="shrink-0 text-mist-600">{a.role}</span>
                            <span className="text-mist-300">{a.action}{a.detail ? ` — ${a.detail}` : ""}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

const F = "w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400";
function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-[11px] font-semibold text-mist-400">{label}</span><div className="mt-1">{children}</div></label>;
}
function B({ children, onClick, busy, on }: { children: React.ReactNode; onClick: () => void; busy?: boolean; on?: boolean }) {
  return (
    <button onClick={onClick} disabled={busy} className={cn(
      "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50",
      on ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200" : "border-line bg-ink-800 text-mist-200 hover:bg-white/[0.06]",
    )}>{children}</button>
  );
}
