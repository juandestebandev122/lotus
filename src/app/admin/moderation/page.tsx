"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { fetchModeration, moderationAction, fetchRecordingContent, type ModerationData, type ReportView, type RecordingContent, type ModViolation, type ChatLog, type RecordingView } from "@/lib/admin";
import { GroupChatHistory } from "@/components/admin/GroupChatHistory";
import { cn } from "@/lib/cn";
import { ShieldAlert, Flag, Radio, Mic, Disc3, MessageSquare, ScrollText, Search, Download, Play, Trash2, Check, X, Eye, Circle, Square } from "lucide-react";
import { SortTh, applyFilterSort, type SortDir } from "@/components/admin/TableControls";

const TABS = [
  { key: "reports", label: "Reports", icon: Flag },
  { key: "rooms", label: "Live Rooms", icon: Radio },
  { key: "recordings", label: "Recordings", icon: Disc3 },
  { key: "chats", label: "Group Chats", icon: MessageSquare },
  { key: "audit", label: "Audit Logs", icon: ScrollText },
] as const;

const STATUS_TONE: Record<string, string> = {
  open: "bg-amber-500/15 text-amber-300",
  actioned: "bg-emerald-500/15 text-emerald-300",
  dismissed: "bg-mist-500/15 text-mist-400",
  recording: "bg-rose-500/15 text-rose-300",
  stored: "bg-sky-500/15 text-sky-300",
};

function fmt(at: string) {
  return new Date(at).toLocaleString("en-SA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function recEventText(e: { type: string; target: string; actorName: string }): string {
  const t = e.target || "Someone";
  switch (e.type) {
    case "join": return `${t} joined the room`;
    case "leave": return `${t} left the room`;
    case "mute": return `${t} muted by ${e.actorName}`;
    case "unmute": return `${t} unmuted`;
    case "remove": return `${t} removed from the room`;
    case "suspend": return `${t} suspended`;
    case "ban": return `${t} banned`;
    case "cohost": return `${t} made co-host`;
    case "uncohost": return `${t} removed as co-host`;
    case "rejoin_blocked": return `${t} (blocked) tried to rejoin`;
    default: return t;
  }
}

function buildTranscript(c: RecordingContent): string {
  const r = c.recording;
  const L: string[] = ["LotusPlay Connect — ROOM SESSION RECORDING", "=".repeat(42)];
  L.push("Room: " + r.roomName);
  L.push("Started: " + new Date(r.startedAt).toLocaleString("en-SA"));
  if (r.endedAt) L.push("Ended: " + new Date(r.endedAt).toLocaleString("en-SA"));
  if (r.durationSec != null) L.push(`Duration: ${Math.floor(r.durationSec / 60)}m ${r.durationSec % 60}s`);
  L.push("Recorded by: " + r.startedBy);
  if (r.participants?.length) L.push("Participants: " + r.participants.join(", "));
  L.push("", "— ROOM ACTIVITY —");
  if (c.events.length) c.events.forEach((e) => L.push(`[${new Date(e.at).toLocaleString("en-SA")}] ${recEventText(e)}`));
  else L.push("(no activity recorded in this session)");
  L.push("", "— CHAT MESSAGES —");
  if (c.chats.length) c.chats.forEach((m) => L.push(`[${new Date(m.at).toLocaleString("en-SA")}] ${m.userName}: ${m.text}`));
  else L.push("(no chat messages recorded in this session)");
  return L.join("\n");
}

export default function ModerationPage() {
  const { toast } = useToast();
  const [data, setData] = useState<ModerationData | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("reports");
  const [query, setQuery] = useState("");
  const [rSort, setRSort] = useState("room"); const [rDir, setRDir] = useState<SortDir>("asc");
  const [recSort, setRecSort] = useState("started"); const [recDir, setRecDir] = useState<SortDir>("desc");
  const [lSort, setLSort] = useState("at"); const [lDir, setLDir] = useState<SortDir>("desc");
  const sortRooms = (c: string) => { if (c === rSort) setRDir((d) => (d === "asc" ? "desc" : "asc")); else { setRSort(c); setRDir("asc"); } };
  const sortRecs = (c: string) => { if (c === recSort) setRecDir((d) => (d === "asc" ? "desc" : "asc")); else { setRecSort(c); setRecDir("desc"); } };
  const sortLogs = (c: string) => { if (c === lSort) setLDir((d) => (d === "asc" ? "desc" : "asc")); else { setLSort(c); setLDir("desc"); } };
  const [viewing, setViewing] = useState<RecordingContent | null>(null);
  const [recBusy, setRecBusy] = useState<string | null>(null);

  const load = () => fetchModeration().then(setData);
  useEffect(() => { load(); }, []);

  const downloadRec = async (id: string) => {
    setRecBusy(id);
    const c = await fetchRecordingContent(id);
    setRecBusy(null);
    if (!c) { toast("Could not load recording", "error"); return; }
    const blob = new Blob([buildTranscript(c)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recording-${c.recording.roomName.replace(/\W+/g, "_")}-${c.recording.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Recording downloaded", "success");
  };

  const viewRec = async (id: string) => {
    setRecBusy(id);
    const c = await fetchRecordingContent(id);
    setRecBusy(null);
    if (c) setViewing(c);
    else toast("Could not load recording", "error");
  };

  const act = async (body: Record<string, unknown>, msg: string) => {
    const ok = await moderationAction(body);
    toast(ok ? msg : "Action failed", ok ? "success" : "error");
    load();
  };

  const q = query.trim().toLowerCase();
  const openReports = (data?.reports ?? []).filter((r) => r.status === "open");

  // Search + click-to-sort for the three monitoring tables.
  const shownRooms = applyFilterSort(data?.rooms ?? [], {
    q: query, sort: rSort, dir: rDir,
    searchText: (r) => `${r.name} ${r.host} ${r.type} ${r.status}`,
    sortKeys: {
      room: (r) => r.name ?? "", host: (r) => r.host ?? "", type: (r) => r.type ?? "",
      status: (r) => r.status ?? "", rec: (r) => (r.recording ? 1 : 0),
    },
  });
  const shownRecordings = applyFilterSort(data?.recordings ?? [], {
    q: query, sort: recSort, dir: recDir,
    searchText: (r) => `${r.roomName} ${r.startedBy} ${r.status ?? ""} ${(r.participants ?? []).join(" ")}`,
    sortKeys: {
      started: (r) => new Date(r.startedAt ?? 0).getTime() || 0,
      room: (r) => r.roomName ?? "", by: (r) => r.startedBy ?? "",
      participants: (r) => (r.participants ?? []).length, duration: (r) => r.durationSec ?? 0,
      status: (r) => r.status ?? "",
    },
  });
  const shownLogs = applyFilterSort(data?.logs ?? [], {
    q: query, sort: lSort, dir: lDir,
    searchText: (l) => `${l.admin} ${l.adminId ?? ""} ${l.action}`,
    sortKeys: {
      at: (l) => new Date(l.at ?? 0).getTime() || 0,
      admin: (l) => l.admin ?? "", adminId: (l) => l.adminId ?? "", action: (l) => l.action ?? "",
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><ShieldAlert className="size-6 text-rose-300" /> Moderation Center</h1>
        <p className="text-sm text-mist-400">Super-Admin tools — reports, live room monitoring, recordings, chat history &amp; audit trail.</p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="flex items-center gap-3 p-4"><span className="grid size-10 place-items-center rounded-full bg-amber-500/15 text-amber-300"><Flag className="size-5" /></span><div><div className="font-display text-xl font-bold text-mist-100">{openReports.length}</div><div className="text-xs text-mist-400">Open reports</div></div></Card>
        <Card className="flex items-center gap-3 p-4"><span className="grid size-10 place-items-center rounded-full bg-rose-500/15 text-rose-300"><Disc3 className="size-5" /></span><div><div className="font-display text-xl font-bold text-mist-100">{(data?.recordings ?? []).filter((r) => r.status === "recording").length}</div><div className="text-xs text-mist-400">Recording now</div></div></Card>
        <Card className="flex items-center gap-3 p-4"><span className="grid size-10 place-items-center rounded-full bg-lotus-500/15 text-lotus-300"><Mic className="size-5" /></span><div><div className="font-display text-xl font-bold text-mist-100">{(data?.rooms ?? []).length}</div><div className="text-xs text-mist-400">Rooms monitored</div></div></Card>
        <Card className="flex items-center gap-3 p-4"><span className="grid size-10 place-items-center rounded-full bg-sky-500/15 text-sky-300"><MessageSquare className="size-5" /></span><div><div className="font-display text-xl font-bold text-mist-100">{(data?.chats ?? []).length}</div><div className="text-xs text-mist-400">Chat messages</div></div></Card>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); setQuery(""); }} className={cn("inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition", tab === t.key ? "bg-lotus-600 text-white" : "border border-line bg-ink-800 text-mist-400 hover:text-mist-100")}>
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Chat Logs has its own rich filter bar; other tabs share this search. */}
      {tab !== "rooms" && tab !== "chats" && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mist-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="h-10 w-full rounded-xl border border-line bg-ink-900 pl-9 pr-3 text-sm text-mist-100 outline-none focus:border-lotus-400" />
        </div>
      )}

      {/* ===== Reports ===== */}
      {tab === "reports" && (
        <ReportsTab
          reports={(data?.reports ?? []).filter((r) => !q || r.reportedName.toLowerCase().includes(q) || r.category.toLowerCase().includes(q) || r.byName.toLowerCase().includes(q))}
          allReports={data?.reports ?? []}
          violations={data?.violations ?? []}
          chats={data?.chats ?? []}
          recordings={data?.recordings ?? []}
          onAction={act}
        />
      )}

      {/* ===== Live Rooms ===== */}
      {tab === "rooms" && (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-mist-500">
                <SortTh col="room" sort={rSort} dir={rDir} onSort={sortRooms} className="px-4 py-3">Room</SortTh><SortTh col="host" sort={rSort} dir={rDir} onSort={sortRooms} className="px-4 py-3">Host</SortTh><SortTh col="type" sort={rSort} dir={rDir} onSort={sortRooms} className="px-4 py-3">Type</SortTh><SortTh col="status" sort={rSort} dir={rDir} onSort={sortRooms} className="px-4 py-3">Status</SortTh><SortTh col="rec" sort={rSort} dir={rDir} onSort={sortRooms} className="px-4 py-3">Recording</SortTh><th className="px-4 py-3 text-right font-semibold">Monitor</th>
              </tr></thead>
              <tbody>
                {shownRooms.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3 font-medium text-mist-100">{r.name}{r.muted > 0 && <span className="ml-2 text-[11px] text-amber-300">{r.muted} muted</span>}</td>
                    <td className="px-4 py-3 text-mist-300">{r.host}</td>
                    <td className="px-4 py-3 capitalize text-mist-400">{r.type}</td>
                    <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", r.status === "active" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300")}>{r.status}</span></td>
                    <td className="px-4 py-3">{r.recording ? <span className="inline-flex items-center gap-1 text-rose-300"><Circle className="size-2.5 animate-pulse fill-rose-400" /> Live</span> : <span className="text-mist-500">—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        {data?.isSuper && (r.recording
                          ? <Button size="sm" variant="secondary" onClick={() => act({ kind: "stopRecording", roomId: r.id }, "Recording stopped")}><Square className="size-3.5" /> Stop</Button>
                          : <Button size="sm" variant="danger" onClick={() => act({ kind: "startRecording", roomId: r.id }, "Recording started")}><Circle className="size-3.5" /> Record</Button>)}
                        <Link href={`/rooms/${r.id}?monitor=1`} className="inline-flex items-center gap-1 rounded-lg bg-lotus-600 px-3 py-1.5 text-xs font-semibold text-white"><Eye className="size-3.5" /> Monitor</Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {shownRooms.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-mist-500">No rooms.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="border-t border-white/5 px-4 py-2.5 text-[11px] text-mist-500">As Super Admin you monitor every room (public &amp; private) silently — you are not shown as a participant. Live audio listening &amp; capture activate when a voice media server is connected.</p>
        </Card>
      )}

      {/* ===== Recordings ===== */}
      {tab === "recordings" && (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-mist-500">
                <SortTh col="started" sort={recSort} dir={recDir} onSort={sortRecs} className="px-4 py-3">Started</SortTh><SortTh col="room" sort={recSort} dir={recDir} onSort={sortRecs} className="px-4 py-3">Room</SortTh><SortTh col="by" sort={recSort} dir={recDir} onSort={sortRecs} className="px-4 py-3">By</SortTh><SortTh col="participants" sort={recSort} dir={recDir} onSort={sortRecs} className="px-4 py-3">Participants</SortTh><SortTh col="duration" sort={recSort} dir={recDir} onSort={sortRecs} className="px-4 py-3">Duration</SortTh><SortTh col="status" sort={recSort} dir={recDir} onSort={sortRecs} className="px-4 py-3">Status</SortTh><th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr></thead>
              <tbody>
                {shownRecordings.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3 text-xs text-mist-400">{fmt(r.startedAt)}</td>
                    <td className="px-4 py-3 font-medium text-mist-100">{r.roomName}</td>
                    <td className="px-4 py-3 text-mist-300">{r.startedBy}</td>
                    <td className="px-4 py-3 max-w-[200px] truncate text-mist-400" title={(r.participants ?? []).join(", ")}>{(r.participants ?? []).join(", ") || "—"}</td>
                    <td className="px-4 py-3 text-mist-300">{r.durationSec != null ? `${Math.floor(r.durationSec / 60)}m ${r.durationSec % 60}s` : "—"}</td>
                    <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", STATUS_TONE[r.status])}>{r.status}</span></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button title="Review session (chat + activity)" disabled={recBusy === r.id} onClick={() => viewRec(r.id)} className="grid size-7 place-items-center rounded-lg bg-white/[0.06] text-mist-200 hover:bg-white/[0.12] disabled:opacity-40"><Play className="size-3.5" /></button>
                        <button title="Download session record" disabled={recBusy === r.id} onClick={() => downloadRec(r.id)} className="grid size-7 place-items-center rounded-lg bg-white/[0.06] text-mist-200 hover:bg-white/[0.12] disabled:opacity-40"><Download className="size-3.5" /></button>
                        {data?.isSuper && <button title="Delete" onClick={() => act({ kind: "deleteRecording", id: r.id }, "Recording deleted")} className="grid size-7 place-items-center rounded-lg bg-rose-500/15 text-rose-300 hover:bg-rose-500/25"><Trash2 className="size-3.5" /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {(data?.recordings ?? []).length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-mist-500">No recordings yet. Start one from the Live Rooms tab.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="border-t border-white/5 px-4 py-2.5 text-[11px] text-mist-500">▶ Review &amp; ⬇ Download give the full session record (chat + activity with timestamps). Securely stored, Super-Admin-only. Raw audio attaches automatically once a voice media server is connected.</p>
        </Card>
      )}

      {/* ===== Group Chat History ===== */}
      {tab === "chats" && (
        <GroupChatHistory chats={data?.chats ?? []} groups={data?.groups ?? []} onAction={act} />
      )}

      {/* ===== Audit Logs ===== */}
      {tab === "audit" && (
        <Card className="overflow-hidden p-0">
          {data?.isSuper && (data?.logs ?? []).length > 0 && (
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
              <span className="text-xs text-mist-500">{(data?.logs ?? []).length} entries</span>
              <Button size="sm" variant="danger" onClick={() => { if (window.confirm("Clear the ENTIRE audit log? This cannot be undone.")) act({ kind: "clearAuditLogs" }, "Audit log cleared"); }}><Trash2 className="size-3.5" /> Clear all</Button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-mist-500">
                <SortTh col="at" sort={lSort} dir={lDir} onSort={sortLogs} className="px-4 py-3">Date &amp; time</SortTh><SortTh col="admin" sort={lSort} dir={lDir} onSort={sortLogs} className="px-4 py-3">Admin</SortTh><SortTh col="adminId" sort={lSort} dir={lDir} onSort={sortLogs} className="px-4 py-3">Admin ID</SortTh><SortTh col="action" sort={lSort} dir={lDir} onSort={sortLogs} className="px-4 py-3">Action</SortTh>{data?.isSuper && <th className="px-4 py-3 text-right font-semibold">Delete</th>}
              </tr></thead>
              <tbody>
                {shownLogs.map((l) => (
                  <tr key={l.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3 text-xs text-mist-400">{fmt(l.at)}</td>
                    <td className="px-4 py-3 font-medium text-mist-100">{l.admin}</td>
                    <td className="px-4 py-3 text-xs font-mono text-mist-400">{l.adminId ?? "—"}</td>
                    <td className="px-4 py-3 text-mist-300">
                      {l.action}
                      {(l.reason || l.roomId || l.matchId) && (
                        <div className="mt-1 space-y-0.5 text-[11px] text-mist-500">
                          {l.reason && <div><span className="text-mist-400">Reason:</span> {l.reason}</div>}
                          {(l.roomId || l.matchId) && <div className="font-mono">{l.roomId ? `Room ${l.roomId}` : ""}{l.roomId && l.matchId ? " · " : ""}{l.matchId ? `Match ${l.matchId}` : ""}</div>}
                        </div>
                      )}
                    </td>
                    {data?.isSuper && <td className="px-4 py-3 text-right"><button title="Delete this entry" onClick={() => { if (window.confirm("Delete this audit entry?")) act({ kind: "deleteAuditLog", id: l.id }, "Entry deleted"); }} className="grid size-7 place-items-center rounded-lg bg-rose-500/15 text-rose-300 hover:bg-rose-500/25"><Trash2 className="size-3.5" /></button></td>}
                  </tr>
                ))}
                {(data?.logs ?? []).length === 0 && <tr><td colSpan={data?.isSuper ? 5 : 4} className="px-4 py-10 text-center text-sm text-mist-500">No admin actions logged yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {viewing && <RecordingModal content={viewing} onClose={() => setViewing(null)} onDownload={() => downloadRec(viewing.recording.id)} />}
    </div>
  );
}

function RecordingModal({ content, onClose, onDownload }: { content: RecordingContent; onClose: () => void; onDownload: () => void }) {
  const r = content.recording;
  // Merge chat + activity into one chronological timeline.
  const timeline = [
    ...content.events.map((e) => ({ at: e.at, kind: "event" as const, text: recEventText(e) })),
    ...content.chats.map((c) => ({ at: c.at, kind: "chat" as const, text: `${c.userName}: ${c.text}` })),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-ink-850" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-white/8 p-5">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Disc3 className="size-5 text-rose-300" /> {r.roomName}</h2>
            <p className="mt-0.5 text-xs text-mist-400">{new Date(r.startedAt).toLocaleString("en-SA")}{r.durationSec != null ? ` · ${Math.floor(r.durationSec / 60)}m ${r.durationSec % 60}s` : ""} · by {r.startedBy}</p>
            {r.participants?.length > 0 && <p className="mt-0.5 text-[11px] text-mist-500">Participants: {r.participants.join(", ")}</p>}
          </div>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>
        <div className="flex-1 space-y-1.5 overflow-y-auto p-5">
          {timeline.map((t, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="shrink-0 text-[11px] text-mist-500">{new Date(t.at).toLocaleTimeString("en-SA", { hour: "2-digit", minute: "2-digit" })}</span>
              <span className={cn("min-w-0 flex-1", t.kind === "event" ? "italic text-mist-400" : "text-mist-100")}>{t.text}</span>
            </div>
          ))}
          {timeline.length === 0 && <p className="py-10 text-center text-sm text-mist-500">No chat or activity was captured in this session.</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-white/8 p-4">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button onClick={onDownload}><Download className="size-4" /> Download record</Button>
        </div>
      </div>
    </div>
  );
}

/** A user's NAME + member ID NUMBER, linked to their account. Shown consistently
 *  wherever a user appears in the report system. */
function ReportUser({ name, publicId, username, id, strong }: { name: string; publicId?: string; username?: string; id?: string; strong?: boolean }) {
  const href = `/admin/users?q=${encodeURIComponent(publicId || username || id || name)}`;
  return (
    <Link href={href} className="hover:underline">
      <span className={strong ? "font-semibold text-mist-100" : "text-mist-200"}>{name}</span>
      {publicId && <span className="ml-1 font-mono text-[11px] font-bold text-lotus-300">ID {publicId}</span>}
    </Link>
  );
}

function ReportsTab({ reports, allReports, violations, chats, recordings, onAction }: { reports: ReportView[]; allReports: ReportView[]; violations: ModViolation[]; chats: ChatLog[]; recordings: RecordingView[]; onAction: (body: Record<string, unknown>, msg: string) => void }) {
  const [detail, setDetail] = useState<ReportView | null>(null);
  return (
    <div className="space-y-3">
      {detail && <ReportDetailModal report={detail} allReports={allReports} violations={violations} chats={chats} recordings={recordings} onAction={onAction} onClose={() => setDetail(null)} />}
      {reports.map((r) => {
        const priorReports = allReports.filter((x) => x.reportedId === r.reportedId).length;
        const userViolations = violations.filter((v) => v.userId === r.reportedId);
        return (
        <Card key={r.id} className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300">{r.category}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", STATUS_TONE[r.status])}>{r.status}</span>
                {r.roomName && <span className="text-[11px] text-mist-500">in {r.roomName}</span>}
                <span className="text-[11px] text-mist-500">{fmt(r.at)}</span>
              </div>
              {/* Both the reported user and the reporter are shown with their
                  member ID NUMBER (and a link to the account). */}
              <p className="mt-1.5 text-sm text-mist-100">
                <ReportUser name={r.reportedName} publicId={r.reportedPublicId} username={r.reportedUsername} id={r.reportedId} strong />
                <span className="text-mist-400"> reported by </span>
                <ReportUser name={r.byName} publicId={r.byPublicId} username={r.byUsername} id={r.byId} />
              </p>
              {r.detail && <p className="mt-1 text-sm text-mist-400">“{r.detail}”</p>}
              {/* Complete moderation history for the reported user */}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", priorReports > 1 ? "bg-amber-500/15 text-amber-300" : "bg-white/[0.06] text-mist-400")}>{priorReports} report{priorReports === 1 ? "" : "s"}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", userViolations.length > 0 ? "bg-rose-500/15 text-rose-300" : "bg-white/[0.06] text-mist-400")}>{userViolations.length} violation{userViolations.length === 1 ? "" : "s"}</span>
                {userViolations.slice(0, 4).map((v) => (
                  <span key={v.createdAt} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-mist-400" title={new Date(v.createdAt).toLocaleString("en-SA")}>{v.type}</span>
                ))}
              </div>
              {r.handledBy && <p className="mt-1 text-[11px] text-mist-500">Handled by {r.handledBy}</p>}
            </div>
            <div className="flex shrink-0 flex-wrap gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => setDetail(r)}><Eye className="size-3.5" /> Review details</Button>
              {r.status === "open" && (
                <>
                  <Button size="sm" variant="secondary" onClick={() => onAction({ kind: "handleReport", id: r.id, decision: "dismissed" }, "Report dismissed")}><X className="size-3.5" /> Dismiss</Button>
                  <Button size="sm" onClick={() => onAction({ kind: "handleReport", id: r.id, decision: "actioned", penalty: "none" }, "Report actioned + warning")}><Check className="size-3.5" /> Warn</Button>
                  <Button size="sm" variant="danger" onClick={() => onAction({ kind: "handleReport", id: r.id, decision: "actioned", penalty: "suspend" }, "User suspended")}>Suspend</Button>
                  <Button size="sm" variant="danger" onClick={() => onAction({ kind: "handleReport", id: r.id, decision: "actioned", penalty: "ban" }, "User banned")}>Ban</Button>
                </>
              )}
            </div>
          </div>
        </Card>
        );
      })}
      {reports.length === 0 && <Card className="p-10 text-center text-sm text-mist-500"><Flag className="mx-auto mb-2 size-6 text-mist-600" />No reports.</Card>}
    </div>
  );
}

// Full evidence review for one report — everything the admin needs to decide fairly,
// cross-referenced from the already-loaded moderation data (no extra fetch).
function ReportDetailModal({ report, allReports, violations, chats, recordings, onAction, onClose }: {
  report: ReportView; allReports: ReportView[]; violations: ModViolation[]; chats: ChatLog[]; recordings: RecordingView[];
  onAction: (body: Record<string, unknown>, msg: string) => void; onClose: () => void;
}) {
  const priorReports = allReports.filter((x) => x.reportedId === report.reportedId && x.id !== report.id);
  const userViolations = violations.filter((v) => v.userId === report.reportedId);
  const userChats = chats.filter((c) => c.userId === report.reportedId).sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 40);
  const roomRecordings = report.roomId ? recordings.filter((rec) => rec.roomId === report.roomId) : [];
  const act = (body: Record<string, unknown>, msg: string) => { onAction(body, msg); onClose(); };
  const profileHref = `/admin/users?q=${encodeURIComponent(report.reportedPublicId || report.reportedUsername || report.reportedId || report.reportedName)}`;
  const Head = ({ children, count }: { children: React.ReactNode; count?: number }) => (
    <h3 className="mb-1.5 mt-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-mist-400">{children}{count != null && <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-mist-300">{count}</span>}</h3>
  );

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-ink-850" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-white/8 bg-ink-850 p-4">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Flag className="size-5 text-rose-300" /> Report review</h2>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>

        <div className="space-y-4 p-4">
          {/* Incident */}
          <div>
            <Head>Incident</Head>
            <div className="rounded-xl border border-line bg-ink-900/50 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300">{report.category}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", STATUS_TONE[report.status])}>{report.status}</span>
                {report.roomName && <span className="text-[11px] text-mist-500">in {report.roomName}</span>}
                <span className="text-[11px] text-mist-500">{fmt(report.at)}</span>
              </div>
              <p className="mt-2 text-mist-100"><ReportUser name={report.reportedName} publicId={report.reportedPublicId} username={report.reportedUsername} id={report.reportedId} strong /><span className="text-mist-400"> reported by </span><ReportUser name={report.byName} publicId={report.byPublicId} username={report.byUsername} id={report.byId} /></p>
              <p className="mt-2 rounded-lg bg-ink-900/70 px-3 py-2 text-mist-300">{report.detail ? `“${report.detail}”` : <span className="text-mist-500">No description provided.</span>}</p>
              {report.handledBy && <p className="mt-1.5 text-[11px] text-mist-500">Handled by {report.handledBy}</p>}
            </div>
          </div>

          {/* Reported user summary */}
          <div>
            <Head>Reported user</Head>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-ink-900/50 p-3">
              <div className="flex-1 text-sm text-mist-200">{report.reportedName}{report.reportedUsername ? <span className="ml-1 text-xs text-mist-500">@{report.reportedUsername}</span> : null}{report.reportedPublicId ? <span className="ml-2 font-mono text-[11px] font-bold text-lotus-300">ID {report.reportedPublicId}</span> : null}</div>
              <Link href={profileHref} target="_blank" className="inline-flex items-center gap-1 rounded-lg border border-line bg-ink-800 px-2.5 py-1.5 text-xs font-semibold text-lotus-300 hover:border-lotus-400/40"><Eye className="size-3.5" /> Open full profile</Link>
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", priorReports.length > 0 ? "bg-amber-500/15 text-amber-300" : "bg-white/[0.06] text-mist-400")}>{priorReports.length} prior report{priorReports.length === 1 ? "" : "s"}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", userViolations.length > 0 ? "bg-rose-500/15 text-rose-300" : "bg-white/[0.06] text-mist-400")}>{userViolations.length} violation{userViolations.length === 1 ? "" : "s"}</span>
            </div>
          </div>

          {/* Previous violations */}
          <div>
            <Head count={userViolations.length}>Previous violations</Head>
            {userViolations.length === 0 ? <p className="text-xs text-mist-500">No prior violations on record.</p> : (
              <div className="space-y-1.5">
                {userViolations.map((v) => (
                  <div key={v.id} className="rounded-lg border border-line bg-ink-900/40 px-3 py-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-rose-300">{v.type}</span>{v.action && <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-mist-300">{v.action}</span>}<span className={cn("rounded px-1.5 py-0.5 text-[10px]", v.status === "active" ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300")}>{v.status}</span><span className="ml-auto text-[10px] text-mist-500">{fmt(v.createdAt)}{v.by ? ` · ${v.by}` : ""}</span></div>
                    {v.reason && <p className="mt-0.5 text-mist-400">{v.reason}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Prior reports */}
          <div>
            <Head count={priorReports.length}>Prior reports against this user</Head>
            {priorReports.length === 0 ? <p className="text-xs text-mist-500">No other reports.</p> : (
              <div className="space-y-1.5">
                {priorReports.slice(0, 20).map((x) => (
                  <div key={x.id} className="rounded-lg border border-line bg-ink-900/40 px-3 py-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-mist-200">{x.category}</span><span className={cn("rounded px-1.5 py-0.5 text-[10px] capitalize", STATUS_TONE[x.status])}>{x.status}</span>{x.roomName && <span className="text-[10px] text-mist-500">in {x.roomName}</span>}<span className="ml-auto text-[10px] text-mist-500">{fmt(x.at)}</span></div>
                    {x.detail && <p className="mt-0.5 text-mist-400">“{x.detail}”</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chat evidence */}
          <div>
            <Head count={userChats.length}>Recent chat messages from this user</Head>
            {userChats.length === 0 ? <p className="text-xs text-mist-500">No stored chat messages for this user (or chat storage is off).</p> : (
              <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-line bg-ink-900/40 p-2">
                {userChats.map((c) => (
                  <div key={c.id} className="flex items-start gap-2 px-1 py-1 text-xs">
                    <span className="shrink-0 text-[10px] text-mist-600">{fmt(c.at)}</span>
                    <span className="text-[10px] text-mist-500">{c.roomName}</span>
                    <span className={cn("min-w-0 flex-1", c.deleted ? "text-mist-600 line-through" : "text-mist-300")}>{c.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Voice recordings for the room */}
          <div>
            <Head count={roomRecordings.length}>Voice recordings for this room</Head>
            {roomRecordings.length === 0 ? <p className="text-xs text-mist-500">No recordings for this room. (Recording is admin-triggered per room — start one from the Live Rooms tab if needed.)</p> : (
              <div className="space-y-1.5">
                {roomRecordings.map((rec) => (
                  <div key={rec.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-ink-900/40 px-3 py-2 text-xs">
                    <Disc3 className="size-4 text-rose-300" />
                    <span className="text-mist-200">{rec.roomName}</span>
                    <span className="text-[10px] text-mist-500">{fmt(rec.startedAt)}{rec.durationSec != null ? ` · ${Math.floor(rec.durationSec / 60)}m ${rec.durationSec % 60}s` : ""}</span>
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px]", STATUS_TONE[rec.status])}>{rec.status}</span>
                    <span className="ml-auto text-[10px] text-mist-500">Open the Recordings tab to play</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sticky action bar */}
        <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-1.5 border-t border-white/8 bg-ink-850 p-3">
          {report.status === "open" ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => act({ kind: "handleReport", id: report.id, decision: "dismissed" }, "Report dismissed")}><X className="size-3.5" /> Dismiss</Button>
              <Button size="sm" onClick={() => act({ kind: "handleReport", id: report.id, decision: "actioned", penalty: "none" }, "Report actioned + warning")}><Check className="size-3.5" /> Warn</Button>
              <Button size="sm" variant="danger" onClick={() => act({ kind: "handleReport", id: report.id, decision: "actioned", penalty: "suspend" }, "User suspended")}>Suspend</Button>
              <Button size="sm" variant="danger" onClick={() => act({ kind: "handleReport", id: report.id, decision: "actioned", penalty: "ban" }, "User banned")}>Ban</Button>
            </>
          ) : (
            <span className="text-xs text-mist-500">This report is {report.status}{report.handledBy ? ` · handled by ${report.handledBy}` : ""}.</span>
          )}
        </div>
      </div>
    </div>
  );
}
