"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import {
  fetchRoomActivities, roomActivityControl, fetchRoomMembers,
  type RoomActivityDashboard, type RaActiveRoom, type RaMember,
} from "@/lib/admin";
import {
  Activity, Mic, Users, Radio, Swords, Gift, MessageSquare, FileBarChart,
  Download, RefreshCw, Lock, Unlock, MicOff, UserX, Crown, History, X, Search, Coins,
} from "lucide-react";

const TABS = [
  { key: "rooms", label: "Active Rooms", icon: Mic },
  { key: "members", label: "Member Activity", icon: Users },
  { key: "competitions", label: "Competitions", icon: Swords },
  { key: "chatgift", label: "Chat & Gifts", icon: Gift },
  { key: "report", label: "Reports", icon: FileBarChart },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const TYPE_TONE: Record<string, string> = {
  Normal: "bg-sky-500/15 text-sky-300",
  Competition: "bg-amber-500/15 text-amber-300",
  Agency: "bg-lotus-500/15 text-lotus-300",
};
const EVENT_TONE: Record<string, string> = {
  join: "bg-emerald-500/15 text-emerald-300",
  leave: "bg-mist-500/15 text-mist-400",
  remove: "bg-rose-500/15 text-rose-300",
  ban: "bg-rose-500/15 text-rose-300",
  mute: "bg-amber-500/15 text-amber-300",
  unmute: "bg-emerald-500/15 text-emerald-300",
  seat_approved: "bg-lotus-500/15 text-lotus-300",
  cohost: "bg-lotus-500/15 text-lotus-300",
};

function fmt(at?: string) {
  if (!at) return "—";
  return new Date(at).toLocaleString("en-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
function fmtDate(at?: string) {
  if (!at) return "—";
  return new Date(at).toLocaleString("en-SA", { day: "numeric", month: "short", year: "numeric" });
}

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function downloadCsv(name: string, header: string[], rows: (string | number)[][]) {
  const BOM = String.fromCharCode(0xfeff); // Excel reads UTF-8 correctly with a BOM
  const body = BOM + [header.join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function Tile({ icon: Icon, tone, value, label }: { icon: typeof Mic; tone: string; value: string | number; label: string }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", tone)}><Icon className="size-5" /></span>
      <div className="min-w-0"><div className="font-display text-xl font-bold text-mist-100">{value}</div><div className="text-xs text-mist-400">{label}</div></div>
    </Card>
  );
}

export default function RoomActivitiesPage() {
  const { toast } = useToast();
  const [data, setData] = useState<RoomActivityDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("rooms");
  const [from, setFrom] = useState<string>(() => new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [query, setQuery] = useState("");
  const [roomFilter, setRoomFilter] = useState<string>(""); // roomId for member-activity "view history"
  const [manage, setManage] = useState<RaActiveRoom | null>(null);

  const load = useCallback(async () => {
    const f = from ? `${from}T00:00:00` : undefined;
    const t = to ? `${to}T23:59:59.999` : undefined;
    const d = await fetchRoomActivities(f, t);
    setData(d);
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const id = setInterval(load, 30_000); return () => clearInterval(id); }, [load]);

  const setPreset = (days: number | "all") => {
    if (days === "all") { setFrom(""); setTo(""); return; }
    setFrom(new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10));
    setTo(new Date().toISOString().slice(0, 10));
  };

  const q = query.trim().toLowerCase();
  const rep = data?.report;

  const doExport = () => {
    if (!data) return;
    if (tab === "rooms") downloadCsv("active-rooms", ["Room", "Room ID", "Host", "Co-hosts", "Type", "Created", "Members", "Speaking", "Status"],
      data.rooms.map((r) => [r.name, r.id, r.hostName, r.coHosts.join(" / "), r.type, fmt(r.createdAt), r.memberCount, r.speakingCount, r.status]));
    else if (tab === "members") downloadCsv("member-activity", ["When", "Room", "Activity", "Member", "By"],
      data.events.map((e) => [fmt(e.at), e.roomName, e.label, e.target || e.actorName, e.actorName]));
    else if (tab === "competitions") downloadCsv("competition-activity", ["Competition", "Room", "Status", "Host", "Participants", "Votes", "Created", "Results"],
      data.competitions.map((c) => [c.title, c.roomName, c.status, c.hostName, c.participants, c.votes, fmt(c.createdAt), fmt(c.resultsAt)]));
    else if (tab === "chatgift") downloadCsv("gift-activity", ["When", "From", "To", "Gift", "Coins", "Where"],
      data.gifts.map((g) => [fmt(g.at), g.fromName, g.toName, g.giftName, g.cost, g.context]));
    else if (tab === "report") downloadCsv("daily-room-report", ["Date", "Users joined", "Gifts", "Gift coins", "Competitions", "Messages"],
      (rep?.byDay ?? []).map((d) => [d.date, d.joins, d.gifts, d.giftCoins, d.competitions, d.messages]));
    toast("Report exported (CSV — opens in Excel)", "success");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><Activity className="size-6 text-lotus-300" /> Room Activities</h1>
          <p className="text-sm text-mist-400">Monitor &amp; manage every room from one place — without entering it. {data && <span className="text-mist-500">Updated {fmt(data.generatedAt)}</span>}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => { setLoading(true); load(); }}><RefreshCw className="mr-1 size-4" /> Refresh</Button>
          <Button onClick={doExport}><Download className="mr-1 size-4" /> Export</Button>
        </div>
      </div>

      {/* Date range */}
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <span className="text-sm font-semibold text-mist-300">History:</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-line bg-ink-800 px-3 py-1.5 text-sm text-mist-100" />
        <span className="text-mist-500">→</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-line bg-ink-800 px-3 py-1.5 text-sm text-mist-100" />
        <div className="flex gap-1.5">
          {([["Today", 0], ["7 days", 7], ["30 days", 30], ["All", "all"]] as const).map(([label, v]) => (
            <button key={label} onClick={() => setPreset(v === 0 ? 0 : (v as number | "all"))} className="rounded-full border border-line bg-ink-800 px-3 py-1 text-xs font-semibold text-mist-300 hover:text-mist-100">{label}</button>
          ))}
        </div>
      </Card>

      {/* Summary tiles from the report */}
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Tile icon={Radio} tone="bg-emerald-500/15 text-emerald-300" value={rep?.totalActiveRooms ?? 0} label="Active rooms" />
        <Tile icon={Users} tone="bg-sky-500/15 text-sky-300" value={rep?.totalUsersJoined ?? 0} label="Users joined" />
        <Tile icon={Gift} tone="bg-lotus-500/15 text-lotus-300" value={rep?.totalGifts ?? 0} label="Gifts sent" />
        <Tile icon={Coins} tone="bg-amber-500/15 text-amber-300" value={rep?.totalGiftCoins ?? 0} label="Gift coins" />
        <Tile icon={Swords} tone="bg-rose-500/15 text-rose-300" value={rep?.totalCompetitions ?? 0} label="Competitions" />
        <Tile icon={MessageSquare} tone="bg-sky-500/15 text-sky-300" value={rep?.totalMessages ?? 0} label="Messages" />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); setQuery(""); }} className={cn("inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition", tab === t.key ? "bg-lotus-600 text-white" : "border border-line bg-ink-800 text-mist-400 hover:text-mist-100")}>
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      {(tab === "rooms" || tab === "members" || tab === "competitions" || tab === "chatgift") && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mist-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="w-full rounded-lg border border-line bg-ink-800 py-2 pl-9 pr-3 text-sm text-mist-100" />
        </div>
      )}

      {loading && !data ? (
        <Card className="p-8 text-center text-mist-400">Loading room activity…</Card>
      ) : (
        <>
          {tab === "rooms" && <RoomsTab rooms={(data?.rooms ?? []).filter((r) => !q || r.name.toLowerCase().includes(q) || r.hostName.toLowerCase().includes(q) || r.id.includes(q))} onManage={setManage} />}
          {tab === "members" && (
            <MembersTab
              events={(data?.events ?? []).filter((e) => (!roomFilter || e.roomId === roomFilter) && (!q || e.roomName.toLowerCase().includes(q) || (e.target || "").toLowerCase().includes(q) || e.actorName.toLowerCase().includes(q) || e.label.toLowerCase().includes(q)))}
              roomFilter={roomFilter}
              roomName={data?.rooms.find((r) => r.id === roomFilter)?.name}
              onClearFilter={() => setRoomFilter("")}
            />
          )}
          {tab === "competitions" && <CompetitionsTab comps={(data?.competitions ?? []).filter((c) => !q || c.title.toLowerCase().includes(q) || c.roomName.toLowerCase().includes(q) || c.hostName.toLowerCase().includes(q))} />}
          {tab === "chatgift" && <ChatGiftTab data={data} q={q} />}
          {tab === "report" && <ReportTab data={data} />}
        </>
      )}

      {manage && (
        <ManageModal
          room={manage}
          onClose={() => setManage(null)}
          onDone={() => { setManage(null); load(); }}
          onViewHistory={(rid) => { setManage(null); setRoomFilter(rid); setTab("members"); }}
          toast={toast}
        />
      )}
    </div>
  );
}

function RoomsTab({ rooms, onManage }: { rooms: RaActiveRoom[]; onManage: (r: RaActiveRoom) => void }) {
  if (!rooms.length) return <Card className="p-8 text-center text-mist-400">No rooms.</Card>;
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[880px] text-sm">
        <thead><tr className="border-b border-line text-left text-xs uppercase text-mist-500">
          <th className="p-3">Room</th><th className="p-3">Host / Co-host</th><th className="p-3">Type</th><th className="p-3">Created</th><th className="p-3">Members</th><th className="p-3">Speaking</th><th className="p-3">Status</th><th className="p-3 text-right">Monitor &amp; Manage</th>
        </tr></thead>
        <tbody>
          {rooms.map((r) => (
            <tr key={r.id} className="border-b border-line/50 hover:bg-ink-800/50">
              <td className="p-3"><div className="font-semibold text-mist-100">{r.name}</div><div className="font-mono text-[11px] text-mist-500">{r.id}</div></td>
              <td className="p-3"><div className="text-mist-200">{r.hostName}</div>{r.coHosts.length > 0 && <div className="text-[11px] text-mist-500">Co: {r.coHosts.join(", ")}</div>}</td>
              <td className="p-3"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", TYPE_TONE[r.type])}>{r.type}</span>{r.agencyName && <div className="text-[11px] text-mist-500">{r.agencyName}</div>}</td>
              <td className="p-3 text-mist-300">{fmt(r.createdAt)}</td>
              <td className="p-3"><span className="inline-flex items-center gap-1 text-mist-100"><Users className="size-3.5 text-mist-500" /> {r.memberCount}</span></td>
              <td className="p-3"><span className="inline-flex items-center gap-1 text-mist-100"><Mic className="size-3.5 text-emerald-400" /> {r.speakingCount}</span></td>
              <td className="p-3"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", r.status === "Locked" ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/15 text-emerald-300")}>{r.status}</span></td>
              <td className="p-3">
                <div className="flex items-center justify-end gap-2">
                  <Link href={`/rooms/${r.id}?monitor=1`} target="_blank" className="inline-flex items-center gap-1.5 rounded-lg bg-lotus-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-lotus-500" title="Open the LIVE room — watch seats & who's speaking, hear the room, and control it in real time">
                    <Radio className="size-3.5" /> Monitor Live
                  </Link>
                  <Button size="sm" variant="secondary" onClick={() => onManage(r)}>Manage</Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function MembersTab({ events, roomFilter, roomName, onClearFilter }: { events: RoomActivityDashboard["events"]; roomFilter: string; roomName?: string; onClearFilter: () => void }) {
  return (
    <div className="space-y-3">
      {roomFilter && (
        <div className="flex items-center gap-2 text-sm text-mist-300">
          <History className="size-4 text-lotus-300" /> Showing history for <span className="font-semibold text-mist-100">{roomName ?? roomFilter}</span>
          <button onClick={onClearFilter} className="ml-1 inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-xs text-mist-400 hover:text-mist-100"><X className="size-3" /> Clear</button>
        </div>
      )}
      {!events.length ? <Card className="p-8 text-center text-mist-400">No member activity in this range.</Card> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs uppercase text-mist-500"><th className="p-3">When</th><th className="p-3">Room</th><th className="p-3">Activity</th><th className="p-3">Member</th><th className="p-3">By</th></tr></thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-line/50 hover:bg-ink-800/50">
                  <td className="p-3 whitespace-nowrap text-mist-300">{fmt(e.at)}</td>
                  <td className="p-3 text-mist-200">{e.roomName}</td>
                  <td className="p-3"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", EVENT_TONE[e.type] ?? "bg-ink-700 text-mist-300")}>{e.label}</span></td>
                  <td className="p-3 text-mist-100">{e.target || "—"}</td>
                  <td className="p-3 text-mist-400">{e.actorName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function CompetitionsTab({ comps }: { comps: RoomActivityDashboard["competitions"] }) {
  if (!comps.length) return <Card className="p-8 text-center text-mist-400">No competitions in this range.</Card>;
  return (
    <div className="space-y-4">
      {comps.map((c) => (
        <Card key={c.id} className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2"><Swords className="size-4 text-amber-300" /><span className="font-semibold text-mist-100">{c.title}</span><span className="rounded-full bg-ink-700 px-2 py-0.5 text-[11px] font-semibold text-mist-300">{c.status}</span></div>
              <div className="mt-0.5 text-xs text-mist-500">{c.roomName} · Host {c.hostName} · {c.participants} contestants · {c.votes} votes</div>
            </div>
            <div className="text-right text-[11px] text-mist-500">
              <div>Created {fmt(c.createdAt)}</div>
              {c.startedAt && <div>Started {fmt(c.startedAt)}</div>}
              {c.endedAt && <div>Ended {fmt(c.endedAt)}</div>}
              {c.resultsAt && <div className="text-emerald-300">Results {fmt(c.resultsAt)}</div>}
            </div>
          </div>
          {c.winners.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {c.winners.map((w) => (<span key={w.rank} className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300"><Crown className="size-3" /> #{w.rank} {w.name} ({w.total})</span>))}
            </div>
          )}
          {c.rounds.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="text-xs font-semibold uppercase text-mist-500">Round-wise results</div>
              {c.rounds.map((rd) => (
                <div key={rd.id} className="rounded-lg border border-line bg-ink-800/60 p-2.5">
                  <div className="flex items-center justify-between text-xs"><span className="font-semibold text-mist-200">{rd.name} <span className="text-mist-500">({rd.status})</span></span><span className="text-mist-500">{rd.completedAt ? `ended ${fmt(rd.completedAt)}` : rd.startedAt ? `started ${fmt(rd.startedAt)}` : "not started"}</span></div>
                  {rd.results.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {rd.results.slice(0, 12).map((r, i) => (<span key={i} className={cn("rounded px-1.5 py-0.5 text-[11px]", r.qualified ? "bg-emerald-500/15 text-emerald-300" : "bg-ink-700 text-mist-300")}>#{r.rank} {r.name} · {r.total}{r.qualified ? " ✓" : ""}</span>))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {c.modLog.length > 0 && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-mist-400">Judge / moderation actions ({c.modLog.length})</summary>
              <div className="mt-1.5 space-y-1">
                {c.modLog.slice(0, 20).map((m) => (
                  <div key={m.id} className="text-mist-400"><span className="text-mist-500">{fmt(m.at)}</span> — <span className="font-semibold text-mist-300">{m.action}</span> {m.targetName} by {m.actorName}{m.action === "score" && m.prevScore != null ? ` (${m.prevScore}→${m.newScore})` : ""}{m.reason ? ` · ${m.reason}` : ""}</div>
                ))}
              </div>
            </details>
          )}
        </Card>
      ))}
    </div>
  );
}

function ChatGiftTab({ data, q }: { data: RoomActivityDashboard | null; q: string }) {
  const chatRooms = (data?.chatRooms ?? []).filter((c) => !q || c.roomName.toLowerCase().includes(q));
  const gifts = (data?.gifts ?? []).filter((g) => !q || g.fromName.toLowerCase().includes(q) || g.toName.toLowerCase().includes(q) || g.giftName.toLowerCase().includes(q));
  const deleted = data?.deletedMessages ?? [];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-0">
        <div className="border-b border-line p-3 text-sm font-semibold text-mist-200">Messages by room</div>
        {!chatRooms.length ? <div className="p-6 text-center text-sm text-mist-400">No messages in this range.</div> : (
          <div className="max-h-80 overflow-y-auto">
            {chatRooms.map((c) => (
              <div key={c.roomId} className="flex items-center justify-between border-b border-line/50 px-3 py-2 text-sm">
                <span className="text-mist-200">{c.roomName}</span>
                <span className="text-mist-400">{c.total} msgs{c.deleted > 0 && <span className="ml-2 text-rose-300">{c.deleted} deleted</span>}</span>
              </div>
            ))}
          </div>
        )}
        {deleted.length > 0 && (
          <details className="border-t border-line p-3 text-xs">
            <summary className="cursor-pointer text-mist-400">Deleted messages ({deleted.length})</summary>
            <div className="mt-1.5 space-y-1">
              {deleted.map((d, i) => (<div key={i} className="text-mist-500"><span className="text-mist-300">{d.userName}</span> in {d.roomName}: <span className="line-through">{d.text.slice(0, 80)}</span>{d.deletedBy ? ` · by ${d.deletedBy}` : ""}</div>))}
            </div>
          </details>
        )}
      </Card>
      <Card className="p-0">
        <div className="border-b border-line p-3 text-sm font-semibold text-mist-200">Gifts sent</div>
        {!gifts.length ? <div className="p-6 text-center text-sm text-mist-400">No gifts in this range.</div> : (
          <div className="max-h-96 overflow-y-auto">
            {gifts.map((g, i) => (
              <div key={i} className="flex items-center gap-2 border-b border-line/50 px-3 py-2 text-sm">
                <span className="text-lg">{g.emoji}</span>
                <div className="min-w-0 flex-1"><div className="truncate text-mist-200"><span className="font-semibold">{g.fromName}</span> → <span className="font-semibold">{g.toName}</span></div><div className="text-[11px] text-mist-500">{g.giftName} · {g.context || "—"} · {fmt(g.at)}</div></div>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300"><Coins className="size-3" /> {g.cost}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ReportTab({ data }: { data: RoomActivityDashboard | null }) {
  const rep = data?.report;
  if (!rep) return <Card className="p-8 text-center text-mist-400">No report.</Card>;
  const stats = [
    ["Total active rooms", rep.totalActiveRooms], ["Total users joined", rep.totalUsersJoined],
    ["Total members left", rep.totalLeaves], ["Removed / kicked", rep.totalKicks],
    ["Total time in rooms (approx)", `${rep.totalTimeMinutes} min`], ["Total gifts sent", rep.totalGifts],
    ["Total gift coins", rep.totalGiftCoins], ["Competitions conducted", rep.totalCompetitions],
    ["Room messages", rep.totalMessages],
  ] as const;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map(([label, value]) => (<Card key={label} className="p-4"><div className="font-display text-2xl font-bold text-mist-100">{value}</div><div className="text-xs text-mist-400">{label}</div></Card>))}
      </div>
      <Card className="overflow-x-auto p-0">
        <div className="border-b border-line p-3 text-sm font-semibold text-mist-200">Daily breakdown</div>
        {!rep.byDay.length ? <div className="p-6 text-center text-sm text-mist-400">No activity in this range.</div> : (
          <table className="w-full min-w-[600px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs uppercase text-mist-500"><th className="p-3">Date</th><th className="p-3">Users joined</th><th className="p-3">Gifts</th><th className="p-3">Coins</th><th className="p-3">Competitions</th><th className="p-3">Messages</th></tr></thead>
            <tbody>
              {rep.byDay.map((d) => (
                <tr key={d.date} className="border-b border-line/50"><td className="p-3 text-mist-200">{fmtDate(d.date)}</td><td className="p-3 text-mist-300">{d.joins}</td><td className="p-3 text-mist-300">{d.gifts}</td><td className="p-3 text-mist-300">{d.giftCoins}</td><td className="p-3 text-mist-300">{d.competitions}</td><td className="p-3 text-mist-300">{d.messages}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function ManageModal({ room, onClose, onDone, onViewHistory, toast }: {
  room: RaActiveRoom; onClose: () => void; onDone: () => void; onViewHistory: (rid: string) => void;
  toast: (msg: string, tone?: "success" | "error" | "info") => void;
}) {
  const [members, setMembers] = useState<RaMember[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<null | "remove" | "transfer">(null);

  useEffect(() => { fetchRoomMembers(room.id).then(setMembers); }, [room.id]);

  const run = async (action: string, targetId?: string, confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    const res = await roomActivityControl(action, room.id, targetId);
    setBusy(false);
    toast(res.ok ? (res.message || "Done") : (res.error || "Action failed"), res.ok ? "success" : "error");
    if (res.ok) { if (action === "endRoom") onDone(); else onDone(); }
  };

  // One-click voice repair: clears the mute-all lock + every force-mute and re-grants
  // publish to the host, co-hosts and seated members at the SFU (fixes "co-hosts /
  // some members can't speak").
  const fixVoice = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/rooms/${room.id}/fix-voice`, { method: "POST" });
      const d = await res.json();
      toast(res.ok && d.ok ? `Voice fixed — ${d.granted ?? 0} speaker${d.granted === 1 ? "" : "s"} re-enabled. Members may need to tap Unmute.` : (d.error || "Could not fix voice"), res.ok && d.ok ? "success" : "error");
      if (res.ok && d.ok) onDone();
    } catch { toast("Could not fix voice", "error"); }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-line bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div><h2 className="font-display text-lg font-bold text-mist-100">{room.name}</h2><div className="font-mono text-[11px] text-mist-500">{room.id}</div><div className="mt-0.5 text-xs text-mist-400">Host {room.hostName} · {room.type} · {room.status} · {room.memberCount} members</div></div>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>

        {!picker ? (
          <>
            <button onClick={fixVoice} disabled={busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3 py-2.5 text-sm font-bold text-emerald-200 transition hover:bg-emerald-500/25 disabled:opacity-50">
              <Mic className="size-4" /> Fix voice — unmute host &amp; co-hosts
            </button>
            <p className="mt-1.5 text-[11px] text-mist-500">Use this when co-hosts or members can&apos;t speak: it clears the mute-all lock + all force-mutes and re-enables the mic for the host, co-hosts and seated members. Then ask them to tap Unmute.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {room.status === "Locked"
                ? <Button variant="secondary" disabled={busy} onClick={() => run("unlock")}><Unlock className="mr-1 size-4" /> Unlock</Button>
                : <Button variant="secondary" disabled={busy} onClick={() => run("lock")}><Lock className="mr-1 size-4" /> Lock</Button>}
              <Button variant="secondary" disabled={busy} onClick={() => run("muteAll", undefined, `Mute all members in "${room.name}"?`)}><MicOff className="mr-1 size-4" /> Mute all</Button>
              <Button variant="secondary" disabled={busy || !members?.length} onClick={() => setPicker("remove")}><UserX className="mr-1 size-4" /> Remove user</Button>
              <Button variant="secondary" disabled={busy || !members?.length} onClick={() => setPicker("transfer")}><Crown className="mr-1 size-4" /> Transfer host</Button>
              <Button variant="secondary" disabled={busy} onClick={() => onViewHistory(room.id)}><History className="mr-1 size-4" /> View history</Button>
              <Button variant="danger" disabled={busy} onClick={() => run("endRoom", undefined, `End (close) the room "${room.name}"? This cannot be undone.`)}><X className="mr-1 size-4" /> End room</Button>
            </div>
            <p className="mt-3 text-[11px] text-mist-500">Lock stops the stage · Mute all silences members · Remove disconnects a member · End permanently closes the room.</p>
          </>
        ) : (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between"><span className="text-sm font-semibold text-mist-200">{picker === "remove" ? "Remove which member?" : "Make who the host?"}</span><button onClick={() => setPicker(null)} className="text-xs text-mist-400 hover:text-mist-100">← Back</button></div>
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {(members ?? []).length === 0 && <div className="py-4 text-center text-sm text-mist-500">No members present.</div>}
              {(members ?? []).map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg border border-line bg-ink-800 px-3 py-2">
                  <div><span className="text-sm text-mist-100">{m.name}</span> {m.isHost && <span className="ml-1 text-[10px] text-amber-300">HOST</span>}{m.isCoHost && <span className="ml-1 text-[10px] text-lotus-300">CO-HOST</span>}<div className="text-[11px] text-mist-500">@{m.username}</div></div>
                  {picker === "remove"
                    ? <Button size="sm" variant="danger" disabled={busy || m.isHost} onClick={() => run("removeUser", m.id, `Remove ${m.name} from the room?`)}>Remove</Button>
                    : <Button size="sm" disabled={busy || m.isHost} onClick={() => run("transferHost", m.id, `Make ${m.name} the new host?`)}>Make host</Button>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
