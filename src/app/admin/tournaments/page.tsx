"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { useConfig } from "@/lib/config";
import { lbl } from "@/lib/labels";
import {
  fetchTournaments,
  createTournament,
  updateTournament,
  deleteTournament,
  decideRequest,
  openRegistration,
  generateBracket,
  setMatchWinner,
  clearMatchWinner,
  distributePrizes,
  cancelTournament,
  generateRooms,
  qualifyPlayer,
  unqualifyPlayer,
  generateNextRound,
  addRoomPlayer,
  replaceRoomPlayer,
  saveBatchSettings,
  setRoomStatus,
  closeRoom,
  type TournamentView,
  type TGame,
  type TStatus,
  type TPrize,
} from "@/lib/tournaments-api";
import { usePhotoEdit } from "@/components/usePhotoEdit";
import { Trophy, Plus, Coins, Users, Dices, Crown, Trash2, X, Check, Ban, Megaphone, CalendarClock, Image as ImageIcon, Pencil, Medal, Search, UserMinus, UserCheck, Swords, Gift, Ban as CancelIcon, Loader2, Award, RotateCcw, AlertTriangle } from "lucide-react";

// Ordinal only — the payout WORD ("Support Staff" / admin-set) is appended at
// render time from the centralized labels config (config.labels["term.prize"]).
const PLACES: { place: 1 | 2 | 3 | 4; ord: string }[] = [
  { place: 1, ord: "1st" },
  { place: 2, ord: "2nd" },
  { place: 3, ord: "3rd" },
  { place: 4, ord: "4th" },
];

const STATUSES: TStatus[] = ["upcoming", "live", "completed"];
const STATUS_STYLE: Record<TStatus, string> = {
  upcoming: "bg-lotus-500/15 text-lotus-200",
  live: "bg-rose-500/15 text-rose-300",
  completed: "bg-emerald-500/15 text-emerald-300",
  cancelled: "bg-white/10 text-mist-400",
};

export default function AdminTournamentsPage() {
  const { toast } = useToast();
  const { config } = useConfig();
  const term = lbl(config.labels, "term.prize"); // "Support Staff" (admin-configurable)
  const [list, setList] = useState<TournamentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TournamentView | null>(null);
  const [confirmDel, setConfirmDel] = useState<TournamentView | null>(null);
  // Participant manager — which tournament + which list (tab) is open.
  const [manageId, setManageId] = useState<string | null>(null);
  const [manageTab, setManageTab] = useState<ManageTab>("all");

  const load = () => fetchTournaments().then((t) => { setList(t); setLoading(false); });
  useEffect(() => { load(); }, []);
  const openManage = (t: TournamentView, tab: ManageTab) => { setManageId(t.id); setManageTab(tab); };
  const manageTournament = list.find((t) => t.id === manageId) ?? null; // always fresh after load()

  const changeStatus = async (t: TournamentView, status: TStatus) => {
    await updateTournament(t.id, { status });
    load();
    toast(`"${t.title}" is now ${status}`, "success");
  };
  const setCapacity = async (t: TournamentView, capacity: number) => {
    await updateTournament(t.id, { capacity });
    load();
  };
  const toggleReg = async (t: TournamentView) => {
    if (!t.regOpenRaw) { await openRegistration(t.id); toast("Registration opened — members notified", "success"); }
    else { await updateTournament(t.id, { regOpen: false }); toast("Registration closed", "info"); }
    load();
  };
  const setRegWindow = async (t: TournamentView, regStart: string, regEnd: string) => {
    await updateTournament(t.id, { regStart, regEnd });
    load();
  };
  const decide = async (t: TournamentView, userId: string, decision: "approved" | "rejected", name: string) => {
    await decideRequest(t.id, userId, decision);
    load();
    toast(`${name}'s request ${decision === "approved" ? "approved" : "rejected"}`, decision === "approved" ? "success" : "info");
  };
  const remove = async (t: TournamentView) => {
    await deleteTournament(t.id);
    setConfirmDel(null);
    load();
    toast(`Deleted "${t.title}"`, "info");
  };

  const liveCount = list.filter((t) => t.status === "live").length;
  const field = "rounded-lg border border-line bg-ink-900 px-2.5 py-1.5 text-sm text-mist-100 outline-none focus:border-lotus-400";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-mist-100">Tournament management</h1>
          <p className="text-sm text-mist-400">
            {loading ? "Loading…" : `${list.length} tournaments · ${liveCount} live`} — capacity, registration &amp; join requests.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="size-4" /> Create tournament</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {list.map((t) => {
          const GameIcon = t.game === "Ludo" ? Dices : Crown;
          const pending = t.requests.filter((r) => r.status === "pending");
          return (
            <Card key={t.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {t.poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.poster} alt={`${t.title} poster`} className="size-11 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="grid size-11 place-items-center rounded-lg bg-gold-400/12 text-gold-300"><GameIcon className="size-5" /></span>
                  )}
                  <div>
                    <h2 className="font-display text-lg font-bold text-mist-100">{t.title}</h2>
                    <p className="text-xs text-mist-400 flex items-center gap-1"><Coins className="size-3 text-gold-300" /> {t.prize.toLocaleString("en-SA")} · Entry {t.entry}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setEditing(t)} title="Edit prizes & poster" className="grid size-8 place-items-center rounded-lg text-mist-400 hover:bg-lotus-500/15 hover:text-lotus-300"><Pencil className="size-4" /></button>
                  <button onClick={() => setConfirmDel(t)} title="Delete" className="grid size-8 place-items-center rounded-lg text-mist-400 hover:bg-rose-500/15 hover:text-rose-300"><Trash2 className="size-4" /></button>
                </div>
              </div>

              {/* Prize breakdown (1st–4th) */}
              {t.prizes.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.prizes.map((p) => (
                    <span key={p.place} className="inline-flex items-center gap-1 rounded-full bg-gold-400/10 px-2.5 py-1 text-xs text-gold-200">
                      <Medal className="size-3" /> {PLACES.find((x) => x.place === p.place)?.ord} {term}: {p.amount.toLocaleString("en-SA")}{p.detail ? ` · ${p.detail}` : ""}
                    </span>
                  ))}
                </div>
              )}

              {/* Dashboard statistics — every count is CLICKABLE and opens the
                  matching participant list (approve / reject / remove + search). */}
              <div className="mt-4 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
                <Stat label="Slots" value={t.stats.totalSlots} onClick={() => openManage(t, "all")} />
                <Stat label="Joined" value={t.stats.joined} tone="text-emerald-300" onClick={() => openManage(t, "approved")} />
                <Stat label="Pending" value={t.stats.pending} tone="text-amber-300" onClick={() => openManage(t, "pending")} />
                <Stat label="Approved" value={t.stats.approved} tone="text-emerald-300" onClick={() => openManage(t, "approved")} />
                <Stat label="Rejected" value={t.stats.rejected} tone="text-rose-300" onClick={() => openManage(t, "rejected")} />
                <Stat label="Remaining" value={t.stats.remaining} tone="text-lotus-300" onClick={() => openManage(t, "all")} />
              </div>

              {/* Status + capacity + registration */}
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-mist-500">Status:</span>
                {STATUSES.map((s) => (
                  <button key={s} onClick={() => changeStatus(t, s)} className={cn("rounded-full px-2.5 py-1 text-xs font-semibold capitalize transition", t.status === s ? STATUS_STYLE[s] : "bg-white/[0.06] text-mist-400 hover:text-mist-100")}>{s}</button>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-mist-400">
                  <Users className="size-3.5" /> Capacity
                  <input type="number" min={2} defaultValue={t.capacity} onBlur={(e) => { const v = Math.max(2, Number(e.target.value) || 2); if (v !== t.capacity) setCapacity(t, v); }} className={cn(field, "w-16")} />
                </label>
                <button onClick={() => toggleReg(t)} className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold", t.regOpen ? "bg-emerald-500/15 text-emerald-300" : t.isFull ? "bg-rose-500/15 text-rose-300" : "bg-white/[0.06] text-mist-300")}>
                  {t.isFull ? <>Tournament Full</> : t.regOpenRaw ? <>Registration Open</> : <><Megaphone className="size-3.5" /> Open registration</>}
                </button>
              </div>

              {/* Registration window */}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-mist-400">
                <CalendarClock className="size-3.5" />
                <label className="flex items-center gap-1">From <input type="datetime-local" defaultValue={t.regStart ? t.regStart.slice(0, 16) : ""} onBlur={(e) => setRegWindow(t, e.target.value ? new Date(e.target.value).toISOString() : "", t.regEnd)} className={cn(field, "py-1")} /></label>
                <label className="flex items-center gap-1">To <input type="datetime-local" defaultValue={t.regEnd ? t.regEnd.slice(0, 16) : ""} onBlur={(e) => setRegWindow(t, t.regStart, e.target.value ? new Date(e.target.value).toISOString() : "")} className={cn(field, "py-1")} /></label>
              </div>

              {/* Fixed start date/time — auto-goes LIVE at this moment */}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-amber-300">
                ?
                <label className="flex items-center gap-1 text-mist-400">
                  Starts (auto-live)
                  <input
                    type="datetime-local"
                    defaultValue={t.startAt ? t.startAt.slice(0, 16) : ""}
                    onBlur={(e) => updateTournament(t.id, { startAt: e.target.value ? new Date(e.target.value).toISOString() : "" }).then(load)}
                    className={cn(field, "py-1")}
                  />
                </label>
                {t.startAt && <span>? {new Date(t.startAt).toLocaleString("en-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
              </div>

              {/* Pending join requests */}
              {pending.length > 0 && (
                <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/[0.05] p-3">
                  <p className="mb-2 text-xs font-semibold text-amber-300">Pending join requests ({pending.length})</p>
                  <div className="space-y-1.5">
                    {pending.map((r) => (
                      <div key={r.userId} className="flex items-center gap-2 rounded-lg bg-ink-800 px-2.5 py-1.5">
                        <Avatar name={r.userName} size="xs" />
                        <span className="flex-1 truncate text-sm text-mist-100">{r.userName}</span>
                        <span className="text-[10px] text-mist-500">{new Date(r.at).toLocaleDateString("en-SA", { day: "numeric", month: "short" })}</span>
                        <button onClick={() => decide(t, r.userId, "approved", r.userName)} className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30"><Check className="size-3.5" /> Approve</button>
                        <button onClick={() => decide(t, r.userId, "rejected", r.userName)} className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-1 text-xs font-semibold text-mist-300 hover:bg-rose-500/15 hover:text-rose-300"><Ban className="size-3.5" /> Reject</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Play system — match rooms (when a Match Type is set) or the simple bracket */}
              {t.matchType ? <RoomManager t={t} onChanged={load} /> : <BracketManager t={t} onChanged={load} />}
            </Card>
          );
        })}
      </div>

      {manageTournament && (
        <ManageParticipantsModal
          t={manageTournament}
          initialTab={manageTab}
          onClose={() => setManageId(null)}
          onChanged={load}
        />
      )}

      {open && <CreateModal onClose={() => setOpen(false)} onCreated={() => { load(); setOpen(false); toast("Tournament created", "success"); }} />}

      {editing && <EditDetailsModal t={editing} onClose={() => setEditing(null)} onSaved={() => { load(); setEditing(null); toast("Tournament details updated", "success"); }} />}

      {confirmDel && (
        <ConfirmDialog danger title="Are you sure you want to delete this tournament?" message="Its auto-created match rooms are removed, and the tournament is moved to Deleted Tournaments where a Super Admin can restore or permanently remove it." confirmLabel="Delete" cancelLabel="Cancel" onConfirm={() => remove(confirmDel)} onCancel={() => setConfirmDel(null)} />
      )}
    </div>
  );
}

function Stat({ label, value, tone = "text-mist-100", onClick }: { label: string; value: number; tone?: string; onClick?: () => void }) {
  const body = (
    <>
      <div className={cn("font-display text-lg font-bold", tone)}>{value}</div>
      <div className="text-[10px] text-mist-500">{label}</div>
    </>
  );
  if (onClick) {
    return (
      <button onClick={onClick} title={`View ${label.toLowerCase()}`} className="rounded-lg bg-white/[0.04] px-2 py-2 transition hover:bg-white/[0.1] hover:ring-1 hover:ring-lotus-400/40">
        {body}
      </button>
    );
  }
  return <div className="rounded-lg bg-white/[0.04] px-2 py-2">{body}</div>;
}

// ===== Match Room manager — the room + qualification system. Generates rooms,
// admin qualifies players (room stays open until N qualify), auto next round,
// champion + prize distribution, per-room status + room id/password.
function RoomManager({ t, onChanged }: { t: TournamentView; onChanged: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [roomCountOverride, setRoomCountOverride] = useState<string>(""); // admin manual room count (blank = auto)
  const rooms = t.rooms ?? [];
  const rs = t.roomStats;
  const pool = t.waitingPool ?? [];

  const act = async (fn: () => Promise<{ ok: boolean; error?: string }>, key: string, okMsg?: string) => {
    setBusy(key);
    const r = await fn();
    setBusy("");
    if (r.ok) { onChanged(); if (okMsg) toast(okMsg, "success"); }
    else toast(r.error ?? "Action failed", "error");
  };
  const doCancel = async () => {
    const reason = window.prompt("Cancel this tournament? Optional reason (shown to players):", "");
    if (reason === null) return;
    act(() => cancelTournament(t.id, reason), "cancel", "Tournament cancelled");
  };
  const doGenerate = async (mode: "online" | "all" | "manual") => {
    setBusy("gen");
    const rc = roomCountOverride.trim() ? Math.max(1, Math.floor(Number(roomCountOverride))) : undefined;
    const r = await generateRooms(t.id, mode, mode === "manual" ? [...picked] : undefined, rc);
    setBusy("");
    if (r.ok) {
      setManualOpen(false); setPicked(new Set());
      onChanged();
      toast(`${r.roomCount} room${r.roomCount === 1 ? "" : "s"} created — ${r.seated} seated, ${r.waiting} in the waiting pool. Players notified 🎮`, "success");
    } else toast(r.error ?? "Could not create rooms", "error");
  };
  const saveSetting = (patch: { readyCheck?: boolean; joinTimerMinutes?: number; autoReplace?: boolean; autoStartWhenReady?: boolean; autoNextRound?: boolean; allowSpectators?: boolean; autoCloseRoom?: boolean }) =>
    act(() => saveBatchSettings(t.id, patch), "settings", "Match settings saved");

  // Manual-selection candidates: everyone approved (waiting pool + already-seated).
  const candidates = (() => {
    const seen = new Set<string>();
    const list: { id: string; name: string; online: boolean }[] = [];
    for (const p of pool) { if (!seen.has(p.id)) { seen.add(p.id); list.push({ id: p.id, name: p.name, online: p.online }); } }
    for (const r of rooms) for (const p of r.players) { if (!seen.has(p.id)) { seen.add(p.id); list.push({ id: p.id, name: p.name, online: p.online ?? false }); } }
    return list.sort((a, b) => Number(b.online) - Number(a.online));
  })();

  // Group rooms by round.
  const byRound = new Map<number, typeof rooms>();
  for (const r of rooms) { const arr = byRound.get(r.roundNumber) ?? []; arr.push(r); byRound.set(r.roundNumber, arr); }
  const roundNums = [...byRound.keys()].sort((a, b) => a - b);
  const currentRoundRooms = rooms.filter((r) => r.roundNumber === (t.currentRound ?? 1));
  const roundComplete = currentRoundRooms.length > 0 && currentRoundRooms.every((r) => r.status === "completed" || r.status === "cancelled");
  const totalQualifiedThisRound = currentRoundRooms.flatMap((r) => r.players.filter((p) => p.qualified)).length;
  const openRooms = currentRoundRooms.filter((r) => r.status === "waiting" || r.status === "live" || r.status === "qualifying");

  const STATUS_TONE: Record<string, string> = {
    waiting: "bg-white/[0.06] text-mist-400", live: "bg-sky-500/15 text-sky-300",
    qualifying: "bg-amber-500/15 text-amber-300", completed: "bg-emerald-500/15 text-emerald-300", cancelled: "bg-rose-500/15 text-rose-300",
    paused: "bg-orange-500/15 text-orange-300",
  };
  const ppr = t.matchType === "4player" ? 4 : 2;
  const autoRooms = Math.max(1, Math.floor(t.stats.approved / ppr)); // what the auto-calc would create
  const dot = (online?: boolean) => <span className={cn("inline-block size-1.5 shrink-0 rounded-full", online ? "bg-emerald-400" : "bg-mist-600")} title={online ? "Online" : "Offline"} />;

  return (
    <div className="mt-4 rounded-xl border border-lotus-400/20 bg-lotus-500/[0.04] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-lotus-200">
          <Swords className="size-3.5" /> Match rooms — {t.matchType === "4player" ? "4-player" : "1 vs 1"} · Top {t.winnersPerRoom ?? 1}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => doGenerate("online")} disabled={busy === "gen" || t.stats.approved < 2} title="Seat only the approved players who are ONLINE right now — the rest wait" className="inline-flex items-center gap-1 rounded-md bg-lotus-500/20 px-2.5 py-1 text-[11px] font-semibold text-lotus-100 hover:bg-lotus-500/30 disabled:opacity-40">
            {busy === "gen" ? <Loader2 className="size-3 animate-spin" /> : <Swords className="size-3" />} {rooms.length ? "Recreate" : "Create"} rooms (online only)
          </button>
          <button onClick={() => doGenerate("all")} disabled={busy === "gen" || t.stats.approved < 2} title="Seat EVERY approved player, online or not" className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-mist-300 hover:bg-white/10 disabled:opacity-40">
            All approved
          </button>
          <button onClick={() => setManualOpen((v) => !v)} disabled={t.stats.approved < 2} className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-mist-300 hover:bg-white/10 disabled:opacity-40" title="Pick exactly who plays this batch">
            Manual selection{manualOpen ? " ▴" : "…"}
          </button>
          {rooms.length > 0 && roundComplete && totalQualifiedThisRound > 1 && !t.autoNextRound && (
            <button onClick={() => act(() => generateNextRound(t.id), "next", "Next round generated")} disabled={busy === "next"} className="inline-flex items-center gap-1 rounded-md bg-sky-500/20 px-2.5 py-1 text-[11px] font-semibold text-sky-200 hover:bg-sky-500/30 disabled:opacity-40">
              {busy === "next" ? <Loader2 className="size-3 animate-spin" /> : <UserCheck className="size-3" />} Generate next round
            </button>
          )}
          {t.championId && !t.prizesPaid && (
            <button onClick={() => act(() => distributePrizes(t.id), "prizes", "Prizes distributed 🏆")} disabled={busy === "prizes"} className="inline-flex items-center gap-1 rounded-md bg-gold-500/20 px-2.5 py-1 text-[11px] font-semibold text-gold-200 hover:bg-gold-500/30 disabled:opacity-40">
              {busy === "prizes" ? <Loader2 className="size-3 animate-spin" /> : <Gift className="size-3" />} Distribute prizes
            </button>
          )}
          {t.status !== "cancelled" && <button onClick={doCancel} className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-mist-300 hover:bg-rose-500/15 hover:text-rose-300"><CancelIcon className="size-3" /> Cancel</button>}
        </div>
      </div>

      {/* ROOM COUNT — auto (from approved players) OR admin manual override. */}
      <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-white/8 bg-ink-900/50 px-2.5 py-1.5 text-[10px] text-mist-400">
        <span className="font-semibold uppercase tracking-wide text-mist-500">Rooms:</span>
        <span>Auto = <b className="text-mist-200">{autoRooms}</b> (from {t.stats.approved} approved ÷ {ppr}/room)</span>
        <label className="flex items-center gap-1" title="Leave blank to auto-calculate, or type a number to force EXACTLY that many rooms (players split evenly). Applies to the NEXT 'Create/Recreate rooms'.">
          · Manual override:
          <input type="number" min={1} max={256} value={roomCountOverride} onChange={(e) => setRoomCountOverride(e.target.value)} placeholder="auto" className="h-6 w-16 rounded border border-line bg-ink-800 px-1.5 text-[10px] text-mist-100 outline-none focus:border-lotus-400" />
          {roomCountOverride.trim() && <button onClick={() => setRoomCountOverride("")} className="text-mist-500 hover:text-mist-200" title="Clear override">✕</button>}
        </label>
        {roomCountOverride.trim() && (() => {
          const want = Math.max(1, Math.floor(Number(roomCountOverride) || 1));
          const eff = Math.min(want, Math.max(1, t.stats.approved)); // can't have more rooms than players
          return <span className="rounded-full bg-lotus-500/15 px-2 py-0.5 font-bold text-lotus-200">Will make {eff} room{eff === 1 ? "" : "s"}{want > eff ? ` (capped — only ${t.stats.approved} players)` : ""}</span>;
        })()}
      </div>

      {/* MANUAL player selection — tick exactly who plays this batch. */}
      {manualOpen && (
        <div className="mb-2 rounded-lg border border-white/10 bg-ink-900/60 p-2.5">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-mist-500">Pick the players for this batch ({picked.size} selected · need multiples of {t.matchType === "4player" ? 4 : 2})</p>
          <div className="grid max-h-44 gap-1 overflow-y-auto sm:grid-cols-2">
            {candidates.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[11px] text-mist-200 hover:bg-white/[0.04]">
                <input type="checkbox" checked={picked.has(c.id)} onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })} className="size-3.5 accent-lotus-500" />
                {dot(c.online)} <span className="truncate">{c.name}</span>
              </label>
            ))}
          </div>
          <div className="mt-2 flex gap-1.5">
            <button onClick={() => setPicked(new Set(candidates.filter((c) => c.online).map((c) => c.id)))} className="rounded-md bg-white/[0.06] px-2 py-1 text-[10px] font-semibold text-mist-300 hover:bg-white/10">Select all online</button>
            <button onClick={() => doGenerate("manual")} disabled={busy === "gen" || picked.size < 2} className="rounded-md bg-lotus-500/25 px-2.5 py-1 text-[10px] font-bold text-lotus-100 hover:bg-lotus-500/35 disabled:opacity-40">
              Create rooms with {picked.size} selected
            </button>
          </div>
        </div>
      )}

      {/* Per-tournament match settings (READY check / timer / auto-replace / auto-start). */}
      <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-white/8 bg-ink-900/50 px-2.5 py-1.5 text-[10px]">
        <span className="font-semibold uppercase tracking-wide text-mist-500">Match settings:</span>
        <button onClick={() => saveSetting({ readyCheck: !(t.readyCheck !== false) })} className={cn("rounded-full px-2 py-0.5 font-bold", t.readyCheck !== false ? "bg-emerald-500/15 text-emerald-300" : "bg-white/8 text-mist-400")} title="Players must press READY before the match">
          Ready check {t.readyCheck !== false ? "ON" : "OFF"}
        </button>
        <label className="flex items-center gap-1 text-mist-400" title="Minutes players get to press READY">
          Timer
          <input type="number" min={1} max={120} defaultValue={t.joinTimerMinutes ?? 10} onBlur={(e) => { const v = Math.max(1, Math.min(120, Math.floor(Number(e.target.value) || 10))); if (v !== (t.joinTimerMinutes ?? 10)) void saveSetting({ joinTimerMinutes: v }); }} className="h-6 w-14 rounded border border-line bg-ink-800 px-1.5 text-[10px] text-mist-100 outline-none focus:border-lotus-400" /> min
        </label>
        <button onClick={() => saveSetting({ autoStartWhenReady: !(t.autoStartWhenReady !== false) })} className={cn("rounded-full px-2 py-0.5 font-bold", t.autoStartWhenReady !== false ? "bg-emerald-500/15 text-emerald-300" : "bg-white/8 text-mist-400")} title="All players READY → the match starts by itself">
          Auto-start {t.autoStartWhenReady !== false ? "ON" : "OFF"}
        </button>
        <button onClick={() => saveSetting({ autoReplace: !(t.autoReplace === true) })} className={cn("rounded-full px-2 py-0.5 font-bold", t.autoReplace === true ? "bg-emerald-500/15 text-emerald-300" : "bg-white/8 text-mist-400")} title="Timer expired → automatically swap absent players for online waiting players">
          Auto-replace {t.autoReplace === true ? "ON" : "OFF"}
        </button>
        <button onClick={() => saveSetting({ autoNextRound: !(t.autoNextRound === true) })} className={cn("rounded-full px-2 py-0.5 font-bold", t.autoNextRound === true ? "bg-emerald-500/15 text-emerald-300" : "bg-white/8 text-mist-400")} title="A round completes → the next round's rooms are generated automatically. OFF = you press 'Generate next round'.">
          Auto next round {t.autoNextRound === true ? "ON" : "OFF"}
        </button>
        <button onClick={() => saveSetting({ autoCloseRoom: !(t.autoCloseRoom !== false) })} className={cn("rounded-full px-2 py-0.5 font-bold", t.autoCloseRoom !== false ? "bg-emerald-500/15 text-emerald-300" : "bg-white/8 text-mist-400")} title="A room auto-completes once its winners qualify. OFF = you close each room manually.">
          Auto close room {t.autoCloseRoom !== false ? "ON" : "OFF"}
        </button>
        <button onClick={() => saveSetting({ allowSpectators: !(t.allowSpectators !== false) })} className={cn("rounded-full px-2 py-0.5 font-bold", t.allowSpectators !== false ? "bg-emerald-500/15 text-emerald-300" : "bg-white/8 text-mist-400")} title="Allow non-players to watch this tournament's match rooms">
          Spectators {t.allowSpectators !== false ? "ON" : "OFF"}
        </button>
      </div>

      {/* Room dashboard stats */}
      {rs && rooms.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5 text-[10px]">
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-mist-300">Round <b className="text-mist-100">{rs.currentRound}</b></span>
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-mist-300">Rooms <b className="text-mist-100">{rs.totalRooms}</b></span>
          <span className="rounded-full bg-sky-500/12 px-2 py-0.5 text-sky-300">Active <b>{rs.activeRooms}</b></span>
          <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-emerald-300">Completed <b>{rs.completedRooms}</b></span>
          <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-emerald-300">Qualified <b>{rs.qualifiedPlayers}</b></span>
          <span className="rounded-full bg-rose-500/12 px-2 py-0.5 text-rose-300">Eliminated <b>{rs.eliminatedPlayers}</b></span>
          <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-emerald-300">Online <b>{rs.onlineApproved ?? 0}</b></span>
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-mist-400">Offline <b>{rs.offlineApproved ?? 0}</b></span>
          <span className="rounded-full bg-amber-500/12 px-2 py-0.5 text-amber-300">Waiting pool <b>{pool.length}</b></span>
        </div>
      )}

      {t.status === "cancelled" && <p className="rounded-lg bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300">Cancelled{t.cancelledReason ? ` — ${t.cancelledReason}` : ""}.</p>}

      {/* Champion / standings */}
      {t.championId && (
        <div className="mb-2 flex flex-wrap gap-1.5 text-[11px]">
          <span className="inline-flex items-center gap-1 rounded-full bg-gold-500/15 px-2.5 py-1 font-bold text-gold-200"><Award className="size-3" /> Champion: {t.championName}</span>
          {t.runnerUpName && <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-mist-200">🥈 {t.runnerUpName}</span>}
          {(t.thirdNames ?? []).map((n, i) => <span key={i} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-mist-300">{i === 0 ? "🥉" : "4th"} {n}</span>)}
          {t.prizesPaid && <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 font-semibold text-emerald-300">Prizes paid ✓</span>}
        </div>
      )}

      {/* Rooms grouped by round */}
      {rooms.length === 0 ? (
        <p className="text-xs text-mist-500">{t.stats.approved < 2 ? "Approve at least 2 players, then create the match rooms." : "Create the match rooms to start."}</p>
      ) : (
        <div className="space-y-3">
          {roundNums.map((rn) => (
            <div key={rn}>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-mist-500">{(() => { const n = byRound.get(rn)?.length ?? 0; return n <= 1 ? "Final" : n === 2 ? "Semifinal" : n <= 4 ? "Quarterfinal" : `Round ${rn}`; })()}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {(byRound.get(rn) ?? []).map((room) => (
                  <div key={room.id} className="rounded-lg border border-white/8 bg-ink-850 p-2.5">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-mist-100">Room {room.roomNumber} <span className="font-mono text-[9px] text-mist-500">#{room.id.replace("trm_", "")}</span></span>
                      <div className="flex items-center gap-1">
                        {/* PAUSE / RESUME — freeze or resume a LIVE match room. */}
                        {room.status === "live" && (
                          <button onClick={() => act(() => setRoomStatus(t.id, room.id, "paused"), "pause" + room.id, "Room paused")} disabled={!!busy} className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-bold text-orange-300 hover:bg-orange-500/15" title="Pause this live match room">Pause</button>
                        )}
                        {room.status === "paused" && (
                          <button onClick={() => act(() => setRoomStatus(t.id, room.id, "live"), "resume" + room.id, "Room resumed")} disabled={!!busy} className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300 hover:bg-emerald-500/25" title="Resume this match room">Resume</button>
                        )}
                        {/* CLOSE — when Auto-close is OFF, finish a room manually once enough qualify. */}
                        {t.autoCloseRoom === false && (room.status === "qualifying" || room.status === "live" || room.status === "paused") && room.qualifiedCount > 0 && (
                          <button onClick={() => act(() => closeRoom(t.id, room.id), "close" + room.id, "Room closed")} disabled={!!busy} className="rounded bg-lotus-500/20 px-1.5 py-0.5 text-[9px] font-bold text-lotus-200 hover:bg-lotus-500/30" title="Close this room and advance the qualified players">Close</button>
                        )}
                        <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold capitalize", STATUS_TONE[room.status])}>{room.status === "qualifying" ? "Qualification in progress" : room.status}</span>
                      </div>
                    </div>
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] text-mist-500">
                      <span>🔑 {room.password}</span>
                      <span>Winners: {room.qualifiedCount}/{room.winnersRequired}</span>
                      {room.status === "waiting" && room.joinDeadline && (
                        <span className={cn("font-semibold", new Date(room.joinDeadline).getTime() < Date.now() ? "text-rose-300" : "text-amber-300")}>
                          ⏰ READY by {new Date(room.joinDeadline).toLocaleTimeString("en-SA", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {room.players.map((p) => (
                        <div key={p.id} className="flex items-center gap-1.5">
                          {dot(p.online)}
                          <span className={cn("min-w-0 flex-1 truncate text-[11px]", p.qualified ? "font-semibold text-emerald-300" : p.eliminated ? "text-mist-500 line-through" : "text-mist-200")}>{p.name}</span>
                          {room.status === "waiting" && (t.readyCheck !== false) && !p.eliminated && (
                            p.ready ? <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">Ready ✓</span>
                            : p.absent ? <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-bold text-rose-300">ABSENT</span>
                            : <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] text-mist-500">not ready</span>
                          )}
                          {(room.status === "waiting" || room.status === "live" || room.status === "qualifying") && !p.qualified && pool.length > 0 && (
                            <select
                              value=""
                              onChange={(e) => { if (e.target.value) void act(() => replaceRoomPlayer(t.id, room.id, p.id, e.target.value), "swap" + p.id, "Player replaced — both were notified"); }}
                              className="h-5 w-16 rounded border border-line bg-ink-900 text-[9px] text-mist-400 outline-none"
                              title="Replace this player with a waiting player"
                            >
                              <option value="">Swap…</option>
                              {pool.map((w) => <option key={w.id} value={w.id}>{w.online ? "🟢 " : "⚪ "}{w.name}</option>)}
                            </select>
                          )}
                          {p.qualified ? (
                            <button onClick={() => act(() => unqualifyPlayer(t.id, room.id, p.id), room.id + p.id)} disabled={!!busy} className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300 hover:bg-rose-500/15 hover:text-rose-300" title="Remove qualification">Qualified ✓</button>
                          ) : p.eliminated ? (
                            <span className="text-[9px] text-mist-600">Eliminated</span>
                          ) : room.status !== "completed" && room.status !== "cancelled" ? (
                            <button onClick={() => act(() => qualifyPlayer(t.id, room.id, p.id), room.id + p.id)} disabled={!!busy} className="rounded bg-lotus-500/20 px-1.5 py-0.5 text-[9px] font-bold text-lotus-200 hover:bg-lotus-500/30 disabled:opacity-40" title="Mark as qualified">Qualify</button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* WAITING POOL — approved players not seated this round. */}
      {rooms.length > 0 && pool.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-500/[0.04] p-2.5">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">Waiting pool ({pool.length})</p>
          <div className="grid gap-1 sm:grid-cols-2">
            {pool.map((w) => (
              <div key={w.id} className="flex items-center gap-1.5 rounded-md bg-ink-900/50 px-2 py-1 text-[11px]">
                {dot(w.online)}
                <span className="min-w-0 flex-1 truncate text-mist-200">{w.name}{w.publicId && <span className="ml-1 font-mono text-[9px] text-mist-500">#{w.publicId}</span>}</span>
                <span className="text-[9px] text-mist-500">{w.online ? "online" : w.lastSeen ? `seen ${new Date(w.lastSeen).toLocaleTimeString("en-SA", { hour: "2-digit", minute: "2-digit" })}` : "offline"}</span>
                {openRooms.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => { if (e.target.value) void act(() => addRoomPlayer(t.id, e.target.value, w.id), "add" + w.id, "Player placed into the room — notified"); }}
                    className="h-5 w-20 rounded border border-line bg-ink-900 text-[9px] text-mist-400 outline-none"
                    title="Place this player into a room with a free seat"
                  >
                    <option value="">Add to…</option>
                    {openRooms.map((r) => <option key={r.id} value={r.id}>Room {r.roomNumber}</option>)}
                  </select>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {rooms.length > 0 && <p className="mt-1.5 text-[10px] text-mist-600">Click “Qualify” for each winner — the room stays open until {t.winnersPerRoom ?? 1} qualify, then the rest are eliminated and the next round is generated{t.autoNextRound ? " automatically" : ""}. After the Final, “Distribute prizes”.</p>}
    </div>
  );
}

// ===== Bracket / play system — admin generates matches, records winners
// (auto-advance), sees rounds + champion/runner-up, distributes prizes, cancels.
function BracketManager({ t, onChanged }: { t: TournamentView; onChanged: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState("");
  const rounds = t.bracketRounds ?? null;

  const gen = async () => {
    setBusy("gen");
    const r = await generateBracket(t.id);
    setBusy("");
    if (r.ok) { onChanged(); toast("Matches created — players notified 🎮", "success"); }
    else toast(r.error ?? "Could not create matches", "error");
  };
  const pickWinner = async (roundIdx: number, matchIdx: number, winnerId: string, name: string) => {
    setBusy(`${roundIdx}-${matchIdx}`);
    const r = await setMatchWinner(t.id, roundIdx, matchIdx, winnerId, name);
    setBusy("");
    if (r.ok) { onChanged(); toast(`${name} advances`, "success"); }
    else toast(r.error ?? "Could not record winner", "error");
  };
  // Undo a recorded result. Everything that followed it is cleared, so the admin
  // can correct a mistake without regenerating the whole bracket.
  const undoWinner = async (roundIdx: number, matchIdx: number) => {
    setBusy(`${roundIdx}-${matchIdx}`);
    const r = await clearMatchWinner(t.id, roundIdx, matchIdx);
    setBusy("");
    if (r.ok) { onChanged(); toast("Result undone — later rounds cleared", "info"); }
    else toast(r.error ?? "Could not undo the result", "error");
  };
  const payPrizes = async () => {
    setBusy("prizes");
    const r = await distributePrizes(t.id);
    setBusy("");
    if (r.ok) { onChanged(); toast(`Prizes distributed to ${(r.paid ?? []).length} winner(s) 🏆`, "success"); }
    else toast(r.error ?? "Could not distribute prizes", "error");
  };
  const doCancel = async () => {
    const reason = window.prompt("Cancel this tournament? Optional reason (shown to players):", "");
    if (reason === null) return;
    setBusy("cancel");
    const r = await cancelTournament(t.id, reason);
    setBusy("");
    if (r.ok) { onChanged(); toast("Tournament cancelled", "info"); }
    else toast(r.error ?? "Could not cancel", "error");
  };

  const approvedCount = t.stats.approved;

  return (
    <div className="mt-4 rounded-xl border border-lotus-400/20 bg-lotus-500/[0.04] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-lotus-200"><Swords className="size-3.5" /> Bracket &amp; play</h3>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={gen} disabled={busy === "gen" || approvedCount < 2} title={approvedCount < 2 ? "Need at least 2 approved players" : ""} className="inline-flex items-center gap-1 rounded-md bg-lotus-500/20 px-2.5 py-1 text-[11px] font-semibold text-lotus-100 hover:bg-lotus-500/30 disabled:opacity-40">
            {busy === "gen" ? <Loader2 className="size-3 animate-spin" /> : <Swords className="size-3" />} {rounds ? "Regenerate matches" : "Create matches / Start"}
          </button>
          {t.championId && !t.prizesPaid && (
            <button onClick={payPrizes} disabled={busy === "prizes"} className="inline-flex items-center gap-1 rounded-md bg-gold-500/20 px-2.5 py-1 text-[11px] font-semibold text-gold-200 hover:bg-gold-500/30 disabled:opacity-40">
              {busy === "prizes" ? <Loader2 className="size-3 animate-spin" /> : <Gift className="size-3" />} Distribute prizes
            </button>
          )}
          {t.status !== "cancelled" && (
            <button onClick={doCancel} disabled={busy === "cancel"} className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-mist-300 hover:bg-rose-500/15 hover:text-rose-300 disabled:opacity-40">
              <CancelIcon className="size-3" /> Cancel
            </button>
          )}
        </div>
      </div>

      {t.status === "cancelled" && <p className="rounded-lg bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300">Cancelled{t.cancelledReason ? ` — ${t.cancelledReason}` : ""}.</p>}

      {/* Final standings */}
      {t.championId && (
        <div className="mb-2 flex flex-wrap gap-1.5 text-[11px]">
          <span className="inline-flex items-center gap-1 rounded-full bg-gold-500/15 px-2.5 py-1 font-bold text-gold-200"><Award className="size-3" /> Champion: {t.championName}</span>
          {t.runnerUpName && <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-mist-200">🥈 {t.runnerUpName}</span>}
          {(t.thirdNames ?? []).map((n, i) => <span key={i} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-mist-300">{i === 0 ? "🥉" : "4th"} {n}</span>)}
          {t.prizesPaid && <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 font-semibold text-emerald-300">Prizes paid ✓</span>}
        </div>
      )}

      {/* BLOCKING-MATCH banner — the first round with an undecided real match is what
          stops the tournament advancing. Tells the admin EXACTLY what to click. */}
      {rounds && (() => {
        let blockName: string | null = null, need = 0;
        for (const rd of rounds) {
          const n = rd.matches.filter((m) => m.aId && m.bId && !m.winnerId && !m.bye).length;
          if (n > 0) { blockName = rd.name; need = n; break; }
        }
        return need > 0 ? (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-500/[0.08] px-3 py-2 text-xs text-amber-200">
            <AlertTriangle className="size-4 shrink-0" />
            <span><b>{need}</b> match{need === 1 ? "" : "es"} in <b>{blockName}</b> still need a winner — tap the winner in each (highlighted below) to advance the tournament.</span>
          </div>
        ) : null;
      })()}

      {/* Rounds + matches (click a name to set the winner) */}
      {!rounds ? (
        <p className="text-xs text-mist-500">{approvedCount < 2 ? "Approve at least 2 players, then create the matches." : "Create the matches to start the knockout bracket."}</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {rounds.map((round, ri) => {
            const rTotal = round.matches.filter((m) => m.aId && m.bId && !m.bye).length;
            const rDecided = round.matches.filter((m) => m.aId && m.bId && m.winnerId && !m.bye).length;
            const rNeed = rTotal - rDecided;
            return (
            <div key={ri} className="min-w-40 shrink-0">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-mist-500">
                {round.name}
                {rTotal > 0 && <span className={cn("ml-1", rNeed > 0 ? "text-amber-400" : "text-emerald-400")}>· {rDecided}/{rTotal}{rNeed > 0 ? ` · ${rNeed} left` : " ✓"}</span>}
              </p>
              <div className="space-y-2">
                {round.matches.map((m, mi) => {
                  const decided = !!m.winnerId;
                  // Both players present → the admin can pick (or RE-pick) the
                  // winner at any time. A decided match is no longer frozen:
                  // full admin control was the whole point of this change.
                  const bothHere = !!m.aId && !!m.bId;
                  const working = busy === `${ri}-${mi}`;
                  const Side = ({ id, name }: { id: string | null; name: string | null }) => (
                    <button
                      disabled={!bothHere || !id || working || m.winnerId === id}
                      onClick={() => id && name && pickWinner(ri, mi, id, name)}
                      title={bothHere ? (m.winnerId === id ? "Current winner" : `Set ${name} as the winner`) : "Waiting for both players"}
                      className={cn("flex w-full items-center justify-between gap-1 rounded-md px-2 py-1 text-left text-[11px] transition",
                        m.winnerId === id ? "bg-emerald-500/20 font-bold text-emerald-200"
                        : bothHere ? "bg-ink-900 text-mist-200 hover:bg-lotus-500/15"
                        : "bg-ink-900/60 text-mist-400")}
                    >
                      <span className="truncate">{name ?? "—"}</span>
                      {m.winnerId === id && <Trophy className="size-3 shrink-0 text-gold-300" />}
                    </button>
                  );
                  return (
                    <div key={mi} className={cn("rounded-lg border bg-ink-850 p-1.5", m.bye ? "border-amber-400/30" : bothHere && !decided ? "border-amber-400/60 ring-1 ring-amber-400/40" : "border-white/8")}>
                      <Side id={m.aId} name={m.aName} />
                      <div className="my-0.5 text-center text-[9px] text-mist-600">vs</div>
                      <Side id={m.bId} name={m.bName} />
                      {/* A BYE is spelled out. Previously it looked exactly like a
                          real win, which is what made the bracket confusing. */}
                      {m.bye && (
                        <p className="mt-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-center text-[9px] font-semibold text-amber-300">
                          Bye — no opponent, advanced without playing
                        </p>
                      )}
                      {/* Undo — an admin can always correct a result. */}
                      {decided && !m.bye && (
                        <button
                          onClick={() => undoWinner(ri, mi)}
                          disabled={working}
                          className="mt-1 flex w-full items-center justify-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold text-mist-500 transition hover:bg-rose-500/10 hover:text-rose-300"
                        >
                          <RotateCcw className="size-2.5" /> Undo result
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })}
        </div>
      )}
      {rounds && (
        <div className="mt-1.5 space-y-1 text-[10px] text-mist-600">
          <p>Click the winner of each match — they advance and the loser is eliminated. You can <b className="text-mist-400">change or undo any result</b> at any time; later rounds that depended on it are cleared automatically. After the Final, use “Distribute prizes”.</p>
          <p><span className="font-semibold text-amber-400">Bye</span> = that player had no opponent in the first round, so they advanced without playing. Byes only ever happen in the first round.</p>
          <p>Once prizes are paid the bracket is locked, so results can no longer be changed.</p>
        </div>
      )}
    </div>
  );
}

// ===== Participant manager — opens from any summary count. Lists Joined /
// Pending / Approved / Rejected with search + approve / reject / remove. Counts
// update automatically after each action (the parent reloads the tournament).
type ManageTab = "all" | "pending" | "approved" | "rejected";

function ManageParticipantsModal({ t, initialTab, onClose, onChanged }: {
  t: TournamentView;
  initialTab: ManageTab;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<ManageTab>(initialTab);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");

  const act = async (userId: string, decision: "approved" | "rejected" | "removed", name: string) => {
    setBusy(userId + decision);
    const ok = await decideRequest(t.id, userId, decision);
    setBusy("");
    if (ok) { onChanged(); toast(`${name} ${decision === "approved" ? "approved" : decision === "removed" ? "removed" : "rejected"}`, decision === "approved" ? "success" : "info"); }
    else toast("Action failed", "error");
  };

  // Confirmed participants (Joined = Approved here) come from the approved
  // requests, which carry the userId needed for the Remove action.
  const approved = t.requests.filter((r) => r.status === "approved");
  const pending = t.requests.filter((r) => r.status === "pending");
  const rejected = t.requests.filter((r) => r.status === "rejected");
  const source = tab === "pending" ? pending : tab === "approved" ? approved : tab === "rejected" ? rejected : t.requests;
  const rows = source.filter((r) => !q.trim() || `${r.userName} ${r.userId}`.toLowerCase().includes(q.trim().toLowerCase()));

  const TABS: { key: ManageTab; label: string; count: number; tone: string }[] = [
    { key: "all", label: "All", count: t.requests.length, tone: "text-mist-200" },
    { key: "approved", label: "Joined / Approved", count: approved.length, tone: "text-emerald-300" },
    { key: "pending", label: "Pending", count: pending.length, tone: "text-amber-300" },
    { key: "rejected", label: "Rejected / Removed", count: rejected.length, tone: "text-rose-300" },
  ];

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-lg rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Users className="size-5 text-lotus-300" /> Participants — {t.title}</h2>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>
        {/* Capacity summary (Slots / Joined / Remaining) */}
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-mist-300">Slots: <b className="text-mist-100">{t.stats.totalSlots}</b></span>
          <span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-emerald-300">Joined: <b>{t.stats.joined}</b></span>
          <span className="rounded-full bg-lotus-500/12 px-2.5 py-1 text-lotus-200">Remaining: <b>{t.stats.remaining}</b></span>
          {t.isFull && <span className="rounded-full bg-rose-500/12 px-2.5 py-1 text-rose-300">Full</span>}
        </div>

        {/* Tabs */}
        <div className="mb-2 flex flex-wrap gap-1.5">
          {TABS.map((x) => (
            <button key={x.key} onClick={() => setTab(x.key)} className={cn("rounded-full px-3 py-1.5 text-xs font-semibold transition", tab === x.key ? "bg-lotus-500/25 text-lotus-100" : "bg-white/[0.05] text-mist-400 hover:bg-white/[0.1]")}>
              {x.label} <span className={cn("ml-0.5", x.tone)}>{x.count}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <label className="relative mb-3 block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-mist-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or user ID…" className="h-10 w-full rounded-lg border border-line bg-ink-900 pl-8 pr-3 text-sm text-mist-100 outline-none focus:border-lotus-400" />
        </label>

        {/* List */}
        <div className="max-h-[46vh] space-y-1.5 overflow-y-auto">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-mist-500">{t.requests.length === 0 ? "No participants yet." : "No one matches this list / search."}</p>
          ) : rows.map((r) => (
            <div key={r.userId + r.status} className="flex items-center gap-2 rounded-lg bg-ink-800/60 px-2.5 py-2">
              <Avatar name={r.userName} size="xs" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-mist-100">{r.userName}</span>
                <span className="block font-mono text-[10px] text-mist-500">{r.userId}</span>
              </span>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold capitalize", r.status === "approved" ? "bg-emerald-500/15 text-emerald-300" : r.status === "pending" ? "bg-amber-500/15 text-amber-300" : "bg-rose-500/15 text-rose-300")}>{r.status}</span>
              <span className="shrink-0 text-[10px] text-mist-600">{new Date(r.at).toLocaleDateString("en-SA", { day: "numeric", month: "short" })}</span>
              {/* Actions per state */}
              <div className="flex shrink-0 gap-1">
                {r.status === "pending" && (
                  <>
                    <button onClick={() => act(r.userId, "approved", r.userName)} disabled={!!busy} title="Approve" className="grid size-7 place-items-center rounded-md bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"><Check className="size-3.5" /></button>
                    <button onClick={() => act(r.userId, "rejected", r.userName)} disabled={!!busy} title="Reject" className="grid size-7 place-items-center rounded-md bg-white/[0.06] text-mist-300 hover:bg-rose-500/15 hover:text-rose-300 disabled:opacity-50"><Ban className="size-3.5" /></button>
                  </>
                )}
                {r.status === "approved" && (
                  <button onClick={() => act(r.userId, "removed", r.userName)} disabled={!!busy} title="Remove from tournament" className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-2 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/25 disabled:opacity-50"><UserMinus className="size-3.5" /> Remove</button>
                )}
                {r.status === "rejected" && (
                  <button onClick={() => act(r.userId, "approved", r.userName)} disabled={!!busy} title="Approve / re-add" className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"><UserCheck className="size-3.5" /> Approve</button>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-mist-500">Approve or reject pending requests, or remove an approved participant at any time. Counts update automatically after each action.</p>
      </div>
    </div>
  );
}

// Shared editor for the poster image + description + 1st–4th prize tiers.
function PrizePosterFields({
  poster, setPoster, description, setDescription, prizes, setPrizes,
}: {
  poster: string; setPoster: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  prizes: TPrize[]; setPrizes: (v: TPrize[]) => void;
}) {
  const { toast } = useToast();
  const { config } = useConfig();
  const term = lbl(config.labels, "term.prize"); // "Support Staff" (admin-configurable)
  const field = "mt-1.5 h-11 w-full rounded-xl border border-line bg-ink-800 px-3.5 text-sm text-mist-100 outline-none focus:border-lotus-400";
  const { pick: posterEdit, editor: posterEditor } = usePhotoEdit({ aspect: "cover" });

  const prizeFor = (place: 1 | 2 | 3 | 4) => prizes.find((p) => p.place === place);
  const setPrizeField = (place: 1 | 2 | 3 | 4, patch: Partial<TPrize>) => {
    const next = prizes.filter((p) => p.place !== place);
    const cur = prizeFor(place) ?? { place, amount: 0 };
    next.push({ ...cur, ...patch, place });
    next.sort((a, b) => a.place - b.place);
    setPrizes(next);
  };

  // Poster / banner now goes through the shared advanced editor (crop/zoom/rotate).
  const onPoster = (file?: File) => posterEdit(file, (url) => setPoster(url), "cover");

  return (
    <>
      {posterEditor}
      {/* Poster */}
      <label className="mt-4 block text-sm font-semibold text-mist-200">Tournament poster</label>
      <div className="mt-1.5 flex items-center gap-3">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="Poster preview" className="h-20 w-20 rounded-xl object-cover" />
        ) : (
          <div className="grid h-20 w-20 place-items-center rounded-xl border border-dashed border-line bg-ink-800 text-mist-500"><ImageIcon className="size-6" /></div>
        )}
        <div className="flex flex-col gap-1.5">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-3 py-2 text-xs font-semibold text-mist-200 hover:border-lotus-400/50">
            <ImageIcon className="size-3.5" /> {poster ? "Change poster" : "Upload poster"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onPoster(e.target.files?.[0])} />
          </label>
          {poster && <button onClick={() => setPoster("")} className="text-left text-xs text-rose-300 hover:text-rose-200">Remove poster</button>}
        </div>
      </div>

      {/* Description / details shown with the poster */}
      <label className="mt-4 block text-sm font-semibold text-mist-200">Details (shown with the poster)</label>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Rules, format, schedule, anything members should know before joining…" className="mt-1.5 w-full rounded-xl border border-line bg-ink-800 px-3.5 py-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400" />

      {/* Payout tiers 1st–4th (the WORD is the admin-set term). */}
      <label className="mt-4 block text-sm font-semibold text-mist-200">{term}</label>
      <div className="mt-1.5 space-y-2.5">
        {PLACES.map(({ place, ord }) => (
          <div key={place} className="rounded-xl border border-line bg-ink-800/40 p-2.5">
            <span className="text-xs font-semibold text-gold-200">{ord} {term}</span>
            <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-[9rem_1fr]">
              <div>
                <label className="mb-1 block text-[11px] text-mist-500">Amount (coins)</label>
                <input type="number" min={0} value={prizeFor(place)?.amount || ""} onChange={(e) => setPrizeField(place, { amount: Math.max(0, Number(e.target.value) || 0) })} placeholder="e.g. 5000" className={cn(field, "mt-0 w-full")} />
              </div>
              <div className="min-w-0">
                <label className="mb-1 block text-[11px] text-mist-500">Reward note (optional)</label>
                <input value={prizeFor(place)?.detail ?? ""} onChange={(e) => setPrizeField(place, { detail: e.target.value })} placeholder="e.g. + Champion trophy" className={cn(field, "mt-0 w-full min-w-0")} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-mist-500">Leave a tier blank to skip it. Amount is in coins; the note is optional.</p>
    </>
  );
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [game, setGame] = useState<TGame>("Ludo");
  const [prize, setPrize] = useState(5000);
  const [entry, setEntry] = useState(100);
  const [capacity, setCapacity] = useState(16);
  const [regStart, setRegStart] = useState("");
  const [regEnd, setRegEnd] = useState("");
  const [startAt, setStartAt] = useState("");
  const [poster, setPoster] = useState("");
  const [description, setDescription] = useState("");
  const [prizes, setPrizes] = useState<TPrize[]>([]);
  const [busy, setBusy] = useState(false);
  // Match configuration (room format).
  const [tournamentType, setTournamentType] = useState<"public" | "private">("public");
  const [matchType, setMatchType] = useState<"1v1" | "4player">("1v1");
  const [winnersPerRoom, setWinnersPerRoom] = useState<1 | 2 | 3>(1);
  const [autoNextRound, setAutoNextRound] = useState(true);
  const [autoPrizeDist, setAutoPrizeDist] = useState(false);
  const ppr = matchType === "4player" ? 4 : 2;
  const wpr = matchType === "1v1" ? 1 : winnersPerRoom;
  const roomsCount = Math.ceil(capacity / ppr);
  const field = "mt-1.5 h-11 w-full rounded-xl border border-line bg-ink-800 px-3.5 text-sm text-mist-100 outline-none focus:border-lotus-400";

  const submit = async () => {
    if (!title.trim()) { toast("Please enter a title", "error"); return; }
    setBusy(true);
    const ok = await createTournament({
      title, game, prize, entry, capacity, regOpen: true,
      prizes: prizes.filter((p) => p.amount > 0 || p.detail),
      poster: poster || undefined,
      description: description || undefined,
      regStart: regStart ? new Date(regStart).toISOString() : undefined,
      regEnd: regEnd ? new Date(regEnd).toISOString() : undefined,
      startAt: startAt ? new Date(startAt).toISOString() : undefined,
      tournamentType, matchType, winnersPerRoom: wpr, autoNextRound, autoPrizeDist,
    });
    setBusy(false);
    if (ok) onCreated();
    else toast("Could not create tournament", "error");
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-md rounded-2xl border border-white/10 bg-ink-850 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-mist-100">Create Tournament</h2>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>
        <label className="mt-5 block text-sm font-semibold text-mist-200">Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Friday Night Cup" autoFocus className={field} />
        <label className="mt-4 block text-sm font-semibold text-mist-200">Game</label>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {(["Ludo", "Chess"] as TGame[]).map((g) => (
            <button key={g} onClick={() => setGame(g)} className={cn("flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition", game === g ? "border-lotus-400 bg-lotus-500/20 text-white" : "border-line bg-ink-800 text-mist-300 hover:border-lotus-400/40")}>
              {g === "Ludo" ? <Dices className="size-4" /> : <Crown className="size-4" />} {g}
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div><label className="block text-sm font-semibold text-mist-200">Total pool</label><input type="number" value={prize} min={0} onChange={(e) => setPrize(Math.max(0, Number(e.target.value)))} className={field} /></div>
          <div><label className="block text-sm font-semibold text-mist-200">Entry</label><input type="number" value={entry} min={0} onChange={(e) => setEntry(Math.max(0, Number(e.target.value)))} className={field} /></div>
          <div><label className="block text-sm font-semibold text-mist-200">Max players</label><input type="number" value={capacity} min={2} onChange={(e) => setCapacity(Math.max(2, Number(e.target.value)))} className={field} /></div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div><label className="block text-sm font-semibold text-mist-200">Registration opens</label><input type="datetime-local" value={regStart} onChange={(e) => setRegStart(e.target.value)} className={field} /></div>
          <div><label className="block text-sm font-semibold text-mist-200">Registration closes</label><input type="datetime-local" value={regEnd} onChange={(e) => setRegEnd(e.target.value)} className={field} /></div>
        </div>
        <label className="mt-4 block text-sm font-semibold text-mist-200">Tournament start date &amp; time</label>
        <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className={field} />
        <p className="mt-1 text-xs text-mist-400">The tournament automatically goes LIVE at this time, regardless of when registration closes.</p>

        {/* ===== Match Configuration (room format) ===== */}
        <div className="mt-5 rounded-2xl border border-lotus-400/25 bg-lotus-500/[0.05] p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-mist-100"><Swords className="size-4 text-lotus-300" /> Match Configuration</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-mist-300">Tournament type</label>
              <select value={tournamentType} onChange={(e) => setTournamentType(e.target.value as "public" | "private")} className={field}>
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-mist-300">Match type</label>
              <select value={matchType} onChange={(e) => { const v = e.target.value as "1v1" | "4player"; setMatchType(v); if (v === "1v1") setWinnersPerRoom(1); }} className={field}>
                <option value="1v1">1 vs 1 Knockout (2 players)</option>
                <option value="4player">4 Player Room</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-mist-300">Winners per room</label>
              <select value={winnersPerRoom} onChange={(e) => setWinnersPerRoom(Number(e.target.value) as 1 | 2 | 3)} disabled={matchType === "1v1"} className={cn(field, matchType === "1v1" && "opacity-50")}>
                <option value={1}>Top 1 Winner</option>
                {matchType === "4player" && <option value={2}>Top 2 Winners</option>}
                {matchType === "4player" && <option value={3}>Top 3 Winners</option>}
              </select>
              {matchType === "1v1" && <p className="mt-1 text-[10px] text-mist-500">1 vs 1 is always Top 1.</p>}
            </div>
            <div className="flex flex-col justify-center gap-1.5">
              <label className="flex items-center gap-2 text-xs text-mist-300"><input type="checkbox" checked={autoNextRound} onChange={(e) => setAutoNextRound(e.target.checked)} className="size-4 accent-lotus-500" /> Auto generate next round</label>
              <label className="flex items-center gap-2 text-xs text-mist-300"><input type="checkbox" checked={autoPrizeDist} onChange={(e) => setAutoPrizeDist(e.target.checked)} className="size-4 accent-lotus-500" /> Auto prize distribution</label>
            </div>
          </div>
          {/* Live "Admin Selected" summary */}
          <div className="mt-3 rounded-xl bg-ink-900/60 p-3 text-[11px] text-mist-300">
            <b className="text-mist-100">Admin selected:</b> Match type <b>{matchType === "4player" ? "4 Player Room" : "1 vs 1"}</b> · Winners <b>Top {wpr}</b> · Total slots <b>{capacity}</b> · Rooms created <b>~{roomsCount}</b> · Players per room <b>{ppr}</b> · Qualified per room <b>{wpr}</b>.
          </div>
        </div>

        <PrizePosterFields poster={poster} setPoster={setPoster} description={description} setDescription={setDescription} prizes={prizes} setPrizes={setPrizes} />

        <Button block size="lg" className="mt-6" onClick={submit} disabled={busy}>
          <Trophy className="size-5" /> {busy ? "Creating…" : "Create tournament"}
        </Button>
      </div>
    </div>
  );
}

function EditDetailsModal({ t, onClose, onSaved }: { t: TournamentView; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [poster, setPoster] = useState(t.poster || "");
  const [description, setDescription] = useState(t.description || "");
  const [prize, setPrize] = useState(t.prize);
  const [prizes, setPrizes] = useState<TPrize[]>(t.prizes ?? []);
  const [busy, setBusy] = useState(false);
  const field = "mt-1.5 h-11 w-full rounded-xl border border-line bg-ink-800 px-3.5 text-sm text-mist-100 outline-none focus:border-lotus-400";

  const save = async () => {
    setBusy(true);
    const ok = await updateTournament(t.id, {
      prize,
      prizes: prizes.filter((p) => p.amount > 0 || p.detail),
      poster,
      description,
    });
    setBusy(false);
    if (ok) onSaved();
    else toast("Could not save changes", "error");
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-md rounded-2xl border border-white/10 bg-ink-850 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-mist-100">Prizes &amp; poster — {t.title}</h2>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>
        <label className="mt-5 block text-sm font-semibold text-mist-200">Headline reward pool</label>
        <input type="number" min={0} value={prize} onChange={(e) => setPrize(Math.max(0, Number(e.target.value) || 0))} className={field} />

        <PrizePosterFields poster={poster} setPoster={setPoster} description={description} setDescription={setDescription} prizes={prizes} setPrizes={setPrizes} />

        <Button block size="lg" className="mt-6" onClick={save} disabled={busy}>
          <Check className="size-5" /> {busy ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
