"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { broadcastNotification } from "@/lib/admin";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import {
  fetchTournaments, generateRooms, generateNextRound, setRoomStatus, closeRoom,
  qualifyPlayer, unqualifyPlayer, replaceRoomPlayer, seatWaiting, recoverTournament,
  type TournamentView, type TRoom,
} from "@/lib/tournaments-api";
import {
  Swords, Radio, Timer, Pause, Play, Ban, Trophy, DoorOpen, RefreshCw, Loader2,
  Users, Eye, CheckCircle2, Hourglass, Grid3x3, Megaphone, Search, UserCheck, UserPlus,
} from "lucide-react";

const STATUS: Record<string, { label: string; tone: string; dot: string }> = {
  live: { label: "LIVE", tone: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30", dot: "bg-emerald-400" },
  waiting: { label: "WAITING", tone: "bg-amber-500/15 text-amber-300 ring-amber-400/30", dot: "bg-amber-400" },
  qualifying: { label: "QUALIFYING", tone: "bg-sky-500/15 text-sky-300 ring-sky-400/30", dot: "bg-sky-400" },
  paused: { label: "PAUSED", tone: "bg-orange-500/15 text-orange-300 ring-orange-400/30", dot: "bg-orange-400" },
  completed: { label: "COMPLETED", tone: "bg-white/[0.06] text-mist-300 ring-white/10", dot: "bg-mist-500" },
  cancelled: { label: "CANCELLED", tone: "bg-rose-500/15 text-rose-300 ring-rose-400/30", dot: "bg-rose-400" },
};

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: number | string; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-ink-850 px-3.5 py-3">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", tone)}><Icon className="size-5" /></span>
      <div className="min-w-0">
        <div className="font-display text-xl font-extrabold leading-none text-mist-100">{value}</div>
        <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-mist-500">{label}</div>
      </div>
    </div>
  );
}

export default function TournamentRoomsControl() {
  const { toast } = useToast();
  const [tournaments, setTournaments] = useState<TournamentView[]>([]);
  const [selId, setSelId] = useState<string>("");
  const [busy, setBusy] = useState("");
  const [round, setRound] = useState<string>("all");
  const [statusF, setStatusF] = useState<string>("all");
  const [q, setQ] = useState("");
  const [auto, setAuto] = useState(true);
  const [broadcast, setBroadcast] = useState("");
  const [swapFor, setSwapFor] = useState<{ roomId: string; userId: string } | null>(null);
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    const all = await fetchTournaments();
    // Only tournaments that use the room/qualification system.
    const withRooms = all.filter((t) => t.matchType || (t.rooms ?? []).length > 0);
    setTournaments(withRooms);
    setSelId((cur) => cur || withRooms.find((t) => t.status === "live")?.id || withRooms[0]?.id || "");
    firstLoad.current = false;
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!auto) return;
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, [auto, load]);

  const t = tournaments.find((x) => x.id === selId);
  const rooms = t?.rooms ?? [];
  const pool = t?.waitingPool ?? [];

  const stats = useMemo(() => {
    const by = (s: string) => rooms.filter((r) => r.status === s).length;
    return {
      total: rooms.length, live: by("live"), waiting: by("waiting") + by("qualifying"),
      paused: by("paused"), completed: by("completed"), cancelled: by("cancelled"),
      players: rooms.reduce((n, r) => n + r.players.length, 0),
      spectators: rooms.reduce((n, r) => n + (r.liveCount ?? 0), 0),
    };
  }, [rooms]);

  const roundNums = useMemo(() => [...new Set(rooms.map((r) => r.roundNumber))].sort((a, b) => a - b), [rooms]);
  const shown = useMemo(() => rooms.filter((r) => {
    if (round !== "all" && r.roundNumber !== Number(round)) return false;
    if (statusF !== "all" && r.status !== statusF) return false;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      if (!(`room ${r.roomNumber} ${r.name}`.toLowerCase().includes(s) || r.players.some((p) => p.name.toLowerCase().includes(s)))) return false;
    }
    return true;
  }), [rooms, round, statusF, q]);

  const act = async (fn: () => Promise<{ ok: boolean; error?: string }>, key: string, okMsg?: string) => {
    setBusy(key);
    const r = await fn();
    setBusy("");
    if (r.ok) { await load(); if (okMsg) toast(okMsg, "success"); }
    else toast(r.error ?? "Action failed", "error");
  };
  const doGenerate = (mode: "online" | "all") => act(() => generateRooms(t!.id, mode).then((r) => ({ ok: r.ok, error: r.error })), "gen", "Rooms created — players notified 🎮");
  const sendBroadcast = async () => {
    if (!broadcast.trim()) return;
    const n = await broadcastNotification(broadcast.trim());
    toast(n > 0 ? `Broadcast sent to ${n} members` : "Could not send", n > 0 ? "success" : "error");
    if (n > 0) setBroadcast("");
  };

  const stageName = (rn: number) => {
    const n = rooms.filter((r) => r.roundNumber === rn).length;
    return n <= 1 ? "Final" : n === 2 ? "Semifinal" : n <= 4 ? "Quarterfinal" : `Round ${rn}`;
  };

  const roundComplete = t && rooms.length > 0 && rooms.filter((r) => r.roundNumber === (t.currentRound ?? 1)).every((r) => r.status === "completed" || r.status === "cancelled");
  const qualifiedThisRound = t ? rooms.filter((r) => r.roundNumber === (t.currentRound ?? 1)).flatMap((r) => r.players.filter((p) => p.qualified)).length : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
            <Grid3x3 className="size-6 text-lotus-300" /> Tournament Rooms — Control Center
            {t?.status === "live" && <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-300"><span className="size-1.5 animate-pulse rounded-full bg-rose-400" /> LIVE</span>}
          </h1>
          <p className="text-sm text-mist-400">Monitor and control every match room of a tournament from one place — pause, end, qualify, swap and open rooms live.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={selId} onChange={(e) => { setSelId(e.target.value); setRound("all"); setStatusF("all"); }} className="h-9 rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400">
            {tournaments.length === 0 && <option value="">No room-based tournaments</option>}
            {tournaments.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
          </select>
          <button onClick={() => setAuto((a) => !a)} className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ring-1", auto ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30" : "bg-ink-800 text-mist-400 ring-white/10")} title="Auto-refresh every 5s">
            <RefreshCw className={cn("size-3.5", auto && "animate-spin")} /> Auto {auto ? "ON" : "OFF"}
          </button>
          <button onClick={load} className="grid size-9 place-items-center rounded-lg border border-line text-mist-300 hover:text-mist-100" title="Refresh now"><RefreshCw className="size-4" /></button>
        </div>
      </div>

      {!t ? (
        <Card className="p-10 text-center text-sm text-mist-400">
          {firstLoad.current ? "Loading…" : "No room-based tournaments yet. Create a tournament with a Match Type (1v1 / 4-player) to use the control center."}
        </Card>
      ) : (
        <>
          {/* Top actions */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => doGenerate("all")} disabled={busy === "gen" || t.stats.approved < 2} className="inline-flex items-center gap-1.5 rounded-lg bg-lotus-500 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-lotus-400 disabled:opacity-40">
              {busy === "gen" ? <Loader2 className="size-4 animate-spin" /> : <Swords className="size-4" />} {rooms.length ? "Recreate rooms" : "Generate rooms"}
            </button>
            <button onClick={() => doGenerate("online")} disabled={busy === "gen" || t.stats.approved < 2} className="inline-flex items-center gap-1.5 rounded-lg bg-lotus-500/20 px-3.5 py-2 text-sm font-bold text-lotus-100 ring-1 ring-lotus-400/30 transition hover:bg-lotus-500/30 disabled:opacity-40" title="Seat only players who are online now">
              Online only
            </button>
            {roundComplete && qualifiedThisRound > 1 && !t.autoNextRound && (
              <button onClick={() => act(() => generateNextRound(t.id), "next", "Next round generated")} disabled={busy === "next"} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/20 px-3.5 py-2 text-sm font-bold text-sky-200 ring-1 ring-sky-400/30 transition hover:bg-sky-500/30 disabled:opacity-40">
                <UserCheck className="size-4" /> Generate next round
              </button>
            )}
            {/* RECOVERY: any approved players still without a match get their own rooms —
                so the tournament can never stall with players "waiting for a match". */}
            {pool.length > 0 && (
              <button
                onClick={() => act(() => seatWaiting(t.id).then((r) => ({ ok: r.ok, error: r.error })), "seat", "Waiting players seated — match rooms created 🎮")}
                disabled={busy === "seat"}
                title="Create match rooms for every approved player who doesn't have one yet"
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-3.5 py-2 text-sm font-bold text-amber-200 ring-1 ring-amber-400/30 transition hover:bg-amber-500/30 disabled:opacity-40"
              >
                {busy === "seat" ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />} Seat waiting players ({pool.length})
              </button>
            )}
            {/* RECOVER: force-start every stuck WAITING room (clears no-show/absent) so
                the round can proceed — the escape hatch for "match won't start". */}
            {stats.waiting > 0 && (
              <button
                onClick={() => act(() => recoverTournament(t.id).then((r) => ({ ok: r.ok, error: r.error })), "recover", "Stuck rooms force-started — now Qualify each winner ▶️")}
                disabled={busy === "recover"}
                title="Force-start every stuck waiting room (clears absent / no-show) so you can Qualify winners and the round advances"
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/20 px-3.5 py-2 text-sm font-bold text-rose-200 ring-1 ring-rose-400/30 transition hover:bg-rose-500/30 disabled:opacity-40"
              >
                {busy === "recover" ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} Recover / Force-continue ({stats.waiting})
              </button>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              <Link href={withBase("/admin/tournaments")} className="inline-flex items-center gap-1.5 rounded-lg bg-ink-800 px-3 py-2 text-xs font-semibold text-mist-300 ring-1 ring-white/10 hover:text-mist-100" title="Full tournament management (create, prizes, brackets, settings)">
                <Trophy className="size-3.5" /> Tournament settings
              </Link>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
            <Stat icon={Grid3x3} label="Total rooms" value={stats.total} tone="bg-lotus-500/15 text-lotus-300" />
            <Stat icon={Radio} label="Live" value={stats.live} tone="bg-emerald-500/15 text-emerald-300" />
            <Stat icon={Hourglass} label="Waiting" value={stats.waiting} tone="bg-amber-500/15 text-amber-300" />
            <Stat icon={Pause} label="Paused" value={stats.paused} tone="bg-orange-500/15 text-orange-300" />
            <Stat icon={CheckCircle2} label="Completed" value={stats.completed} tone="bg-emerald-500/12 text-emerald-300" />
            <Stat icon={Users} label="Players" value={stats.players} tone="bg-sky-500/15 text-sky-300" />
            <Stat icon={Eye} label="Spectators" value={stats.spectators} tone="bg-fuchsia-500/15 text-fuchsia-300" />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select value={round} onChange={(e) => setRound(e.target.value)} className="h-9 rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-200 outline-none focus:border-lotus-400">
              <option value="all">All rounds</option>
              {roundNums.map((rn) => <option key={rn} value={rn}>{stageName(rn)}</option>)}
            </select>
            <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="h-9 rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-200 outline-none focus:border-lotus-400">
              <option value="all">All status</option>
              {["live", "waiting", "qualifying", "paused", "completed", "cancelled"].map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
            </select>
            <div className="flex h-9 items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-3">
              <Search className="size-3.5 text-mist-500" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search room / player" className="w-40 bg-transparent text-sm text-mist-100 outline-none placeholder:text-mist-500" />
            </div>
            {(round !== "all" || statusF !== "all" || q) && <button onClick={() => { setRound("all"); setStatusF("all"); setQ(""); }} className="rounded-lg bg-ink-800 px-3 py-2 text-xs font-semibold text-mist-400 ring-1 ring-white/10 hover:text-mist-100">Reset</button>}
            <span className="ml-auto text-xs text-mist-500">{shown.length} of {rooms.length} rooms</span>
          </div>

          {/* Room grid */}
          {rooms.length === 0 ? (
            <Card className="p-10 text-center text-sm text-mist-400">{t.stats.approved < 2 ? "Approve at least 2 players, then Generate rooms." : "No rooms yet — press Generate rooms above."}</Card>
          ) : shown.length === 0 ? (
            <Card className="p-10 text-center text-sm text-mist-400">No rooms match the filters.</Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {shown.map((room) => <RoomCard key={room.id} t={t} room={room} pool={pool} busy={busy} act={act} swapFor={swapFor} setSwapFor={setSwapFor} stageName={stageName} />)}
            </div>
          )}

          {/* Legend + broadcast */}
          <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
            <Card className="p-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-mist-500">Status legend</h3>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-mist-300">
                {Object.entries(STATUS).map(([k, v]) => <span key={k} className="inline-flex items-center gap-1.5"><span className={cn("size-2 rounded-full", v.dot)} /> {v.label}</span>)}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-mist-500">
                <span>Total <b className="text-mist-200">{stats.total}</b></span>
                <span>Live <b className="text-emerald-300">{stats.live}</b></span>
                <span>Waiting <b className="text-amber-300">{stats.waiting}</b></span>
                <span>Paused <b className="text-orange-300">{stats.paused}</b></span>
                <span>Completed <b className="text-mist-200">{stats.completed}</b></span>
                <span>Cancelled <b className="text-rose-300">{stats.cancelled}</b></span>
                <span>Players <b className="text-mist-200">{stats.players}</b></span>
              </div>
            </Card>
            <Card className="p-4">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-mist-500"><Megaphone className="size-3.5 text-petal-400" /> Broadcast to all members</h3>
              <div className="flex gap-2">
                <input value={broadcast} onChange={(e) => setBroadcast(e.target.value.slice(0, 280))} placeholder="Type a message for all members…" className="h-9 flex-1 rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400" />
                <button onClick={sendBroadcast} disabled={!broadcast.trim()} className="rounded-lg bg-lotus-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-lotus-400 disabled:opacity-40">Send</button>
              </div>
              <p className="mt-1.5 text-[11px] text-mist-500">Sends an in-app notification to every member (e.g. a tournament announcement).</p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function RoomCard({ t, room, pool, busy, act, swapFor, setSwapFor, stageName }: {
  t: TournamentView; room: TRoom; pool: NonNullable<TournamentView["waitingPool"]>; busy: string;
  act: (fn: () => Promise<{ ok: boolean; error?: string }>, key: string, okMsg?: string) => void;
  swapFor: { roomId: string; userId: string } | null; setSwapFor: (v: { roomId: string; userId: string } | null) => void;
  stageName: (rn: number) => string;
}) {
  const st = STATUS[room.status] ?? STATUS.waiting;
  const winner = room.players.find((p) => p.qualified && room.status === "completed");
  const finished = room.status === "completed" || room.status === "cancelled";
  return (
    <div className="rounded-2xl border border-white/8 bg-ink-850 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <span className="text-sm font-extrabold text-mist-100">Room {room.roomNumber}</span>
          <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-mist-500">{stageName(room.roundNumber)}</span>
        </div>
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1", st.tone)}><span className={cn("size-1.5 rounded-full", st.dot)} /> {st.label}</span>
      </div>

      {/* Players VS */}
      <div className={cn("grid items-center gap-2", room.players.length <= 2 ? "grid-cols-[1fr_auto_1fr]" : "grid-cols-2")}>
        {room.players.map((p, i) => (
          <div key={p.id} className={cn("flex min-w-0 items-center gap-2", room.players.length <= 2 && i === 1 && "flex-row-reverse text-right")} style={room.players.length <= 2 && i === 1 ? { gridColumn: 3 } : undefined}>
            <Avatar name={p.name} src={p.avatar} size="sm" status={p.online ? "online" : "offline"} />
            <div className="min-w-0">
              <div className={cn("truncate text-xs font-semibold", p.qualified ? "text-emerald-300" : p.eliminated ? "text-mist-500 line-through" : "text-mist-100")}>{p.name}</div>
              <div className="text-[10px] text-mist-500">{p.level ? `Level ${p.level}` : ""}{p.ready ? " · Ready ✓" : p.absent ? " · absent" : ""}</div>
            </div>
          </div>
        ))}
        {room.players.length <= 2 && <span className="justify-self-center text-[10px] font-bold text-mist-500" style={{ gridColumn: 2 }}>VS</span>}
      </div>

      {/* Meta */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-mist-500">
        <span className="inline-flex items-center gap-1"><Eye className="size-3" /> {room.liveCount ?? 0} watching</span>
        <span className="inline-flex items-center gap-1"><Trophy className="size-3" /> {room.qualifiedCount}/{room.winnersRequired} qualified</span>
        {room.password && <span>🔑 {room.password}</span>}
        {room.status === "waiting" && room.joinDeadline && <span className={cn("inline-flex items-center gap-1 font-semibold", new Date(room.joinDeadline).getTime() < Date.now() ? "text-rose-300" : "text-amber-300")}><Timer className="size-3" /> READY by {new Date(room.joinDeadline).toLocaleTimeString("en-SA", { hour: "2-digit", minute: "2-digit" })}</span>}
      </div>
      {winner && <div className="mt-1.5 text-[11px] font-bold text-gold-200">🏆 Winner: {winner.name}</div>}

      {/* Primary buttons */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {room.voiceRoomId && !finished && (
          <Link href={withBase(`/rooms/${room.voiceRoomId}`)} className="inline-flex items-center gap-1 rounded-lg bg-lotus-500 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-lotus-400"><DoorOpen className="size-3.5" /> Open room</Link>
        )}
        {room.status === "live" && <button onClick={() => act(() => setRoomStatus(t.id, room.id, "paused"), "p" + room.id, "Room paused")} disabled={!!busy} className="inline-flex items-center gap-1 rounded-lg bg-orange-500/15 px-2.5 py-1.5 text-[11px] font-bold text-orange-300 ring-1 ring-orange-400/30 hover:bg-orange-500/25"><Pause className="size-3.5" /> Pause</button>}
        {room.status === "paused" && <button onClick={() => act(() => setRoomStatus(t.id, room.id, "live"), "r" + room.id, "Room resumed")} disabled={!!busy} className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-[11px] font-bold text-emerald-300 ring-1 ring-emerald-400/30 hover:bg-emerald-500/25"><Play className="size-3.5" /> Resume</button>}
        {t.autoCloseRoom === false && (room.status === "qualifying" || room.status === "live" || room.status === "paused") && room.qualifiedCount > 0 && (
          <button onClick={() => act(() => closeRoom(t.id, room.id), "c" + room.id, "Room closed")} disabled={!!busy} className="inline-flex items-center gap-1 rounded-lg bg-lotus-500/20 px-2.5 py-1.5 text-[11px] font-bold text-lotus-200 ring-1 ring-lotus-400/30 hover:bg-lotus-500/30"><CheckCircle2 className="size-3.5" /> Close</button>
        )}
        {!finished && <button onClick={() => act(() => setRoomStatus(t.id, room.id, "cancelled"), "x" + room.id, "Room cancelled")} disabled={!!busy} className="inline-flex items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-bold text-rose-200 ring-1 ring-white/10 hover:bg-rose-500/15"><Ban className="size-3.5" /> End</button>}
      </div>

      {/* Per-player qualify / swap (referee controls) */}
      {!finished && (
        <div className="mt-2 space-y-1 border-t border-white/5 pt-2">
          {room.players.map((p) => (
            <div key={p.id} className="flex items-center gap-1.5 text-[11px]">
              <span className={cn("min-w-0 flex-1 truncate", p.qualified ? "font-semibold text-emerald-300" : "text-mist-300")}>{p.name}</span>
              {swapFor?.roomId === room.id && swapFor.userId === p.id && pool.length > 0 ? (
                <select autoFocus value="" onChange={(e) => { if (e.target.value) { act(() => replaceRoomPlayer(t.id, room.id, p.id, e.target.value), "sw" + p.id, "Player replaced — both notified"); setSwapFor(null); } else setSwapFor(null); }} className="h-6 rounded border border-line bg-ink-900 text-[10px] text-mist-300 outline-none">
                  <option value="">Swap with…</option>
                  {pool.map((w) => <option key={w.id} value={w.id}>{w.online ? "🟢 " : "⚪ "}{w.name}</option>)}
                </select>
              ) : (
                <>
                  {!p.qualified && pool.length > 0 && <button onClick={() => setSwapFor({ roomId: room.id, userId: p.id })} className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-mist-400 hover:text-mist-100" title="Replace with a waiting player">Swap</button>}
                  {p.qualified
                    ? <button onClick={() => act(() => unqualifyPlayer(t.id, room.id, p.id), "u" + p.id)} disabled={!!busy} className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 hover:bg-rose-500/15 hover:text-rose-300" title="Remove qualification">Qualified ✓</button>
                    : <button onClick={() => act(() => qualifyPlayer(t.id, room.id, p.id), "q" + p.id, "Player qualified")} disabled={!!busy} className="rounded bg-lotus-500/20 px-1.5 py-0.5 text-[10px] font-bold text-lotus-200 hover:bg-lotus-500/30" title="Mark as qualified / winner">Qualify</button>}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
