"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { ChatLog, ChatGroup, ChatMessageType } from "@/lib/admin";
import { Search, Download, FileText, BarChart3, Eye, Trash2, Ban, Users, CalendarDays, Image as ImageIcon, Music, Video, Gift, MessageSquare, MessageCircle, Sticker, Paperclip } from "lucide-react";

// ===== Group Chat History — view, search, filter, moderate & export =====

function fmt(at: string) {
  return new Date(at).toLocaleString("en-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const TYPE_META: Record<ChatMessageType, { label: string; tone: string; Icon: typeof MessageCircle }> = {
  text: { label: "Text", tone: "bg-white/[0.06] text-mist-300", Icon: MessageCircle },
  image: { label: "Image", tone: "bg-sky-500/15 text-sky-300", Icon: ImageIcon },
  audio: { label: "Audio", tone: "bg-lotus-500/15 text-lotus-300", Icon: Music },
  video: { label: "Video", tone: "bg-rose-500/15 text-rose-300", Icon: Video },
  gift: { label: "Gift", tone: "bg-gold-500/15 text-gold-300", Icon: Gift },
  sticker: { label: "Sticker", tone: "bg-fuchsia-500/15 text-fuchsia-300", Icon: Sticker },
  file: { label: "File", tone: "bg-emerald-500/15 text-emerald-300", Icon: Paperclip },
};
// Any unrecognised type falls back to "Text" so the admin log can never crash on an
// unexpected message kind added later.
const typeMeta = (t?: string) => TYPE_META[(t as ChatMessageType)] ?? TYPE_META.text;

const CHAT_VIEWS = [
  { key: "messages", label: "Chat Records", icon: MessageSquare },
  { key: "groups", label: "Groups", icon: Users },
  { key: "dashboard", label: "Reports Dashboard", icon: BarChart3 },
] as const;

function csvEscape(v: string) { return `"${String(v).replace(/"/g, '""')}"`; }
function esc(s: string) { return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] || c)); }

// The admin often gets a full-page reload from the app's version/service-worker
// update system (or the manual header Refresh) while viewing chat history. Without
// persistence that wipes the sub-tab, filters, dates and scroll position, so the
// admin "loses their place" (the reported auto-refresh jump). We persist these to
// sessionStorage (survives a same-tab reload) and restore them on mount.
const ssGet = (k: string, d: string) => { try { return (typeof window !== "undefined" && sessionStorage.getItem(`gch.${k}`)) || d; } catch { return d; } };
const ssSet = (k: string, v: string) => { try { sessionStorage.setItem(`gch.${k}`, v); } catch { /* private mode / quota */ } };

export function GroupChatHistory({ chats, groups, onAction }: { chats: ChatLog[]; groups: ChatGroup[]; onAction: (body: Record<string, unknown>, msg: string) => void }) {
  const [view, setView] = useState<(typeof CHAT_VIEWS)[number]["key"]>(() => ssGet("view", "messages") as (typeof CHAT_VIEWS)[number]["key"]);
  const [q, setQ] = useState(() => ssGet("q", ""));
  const [group, setGroup] = useState(() => ssGet("group", "all"));
  const [owner, setOwner] = useState(() => ssGet("owner", "all"));
  const [type, setType] = useState<"all" | ChatMessageType>(() => ssGet("type", "all") as "all" | ChatMessageType);
  const [from, setFrom] = useState(() => ssGet("from", ""));
  const [to, setTo] = useState(() => ssGet("to", ""));
  const [groupQuery, setGroupQuery] = useState(() => ssGet("gq", ""));
  const listRef = useRef<HTMLDivElement>(null);

  // Write filters back on any change, and restore the list scroll once on mount.
  useEffect(() => {
    ssSet("view", view); ssSet("q", q); ssSet("group", group); ssSet("owner", owner);
    ssSet("type", type); ssSet("from", from); ssSet("to", to); ssSet("gq", groupQuery);
  }, [view, q, group, owner, type, from, to, groupQuery]);
  useEffect(() => {
    const el = listRef.current;
    if (el) { const y = Number(ssGet("scroll", "0")); if (y) el.scrollTop = y; }
  }, []);

  // roomId → group meta, so each message knows its owner / group id.
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const owners = useMemo(() => Array.from(new Set(groups.map((g) => g.owner).filter((o) => o && o !== "—"))).sort(), [groups]);

  const fromTs = from ? new Date(from + "T00:00:00").getTime() : -Infinity;
  const toTs = to ? new Date(to + "T23:59:59").getTime() : Infinity;
  const needle = q.trim().toLowerCase();

  const filtered = chats.filter((c) => {
    const g = groupById.get(c.roomId);
    if (group !== "all" && c.roomId !== group) return false;
    if (owner !== "all" && (g?.owner ?? "") !== owner) return false;
    if (type !== "all" && (c.type || "text") !== type) return false;
    const t = new Date(c.at).getTime();
    if (t < fromTs || t > toTs) return false;
    // Free-text search spans message content, sender, group NAME, group ID & owner.
    if (needle && !(
      c.text.toLowerCase().includes(needle) ||
      c.userName.toLowerCase().includes(needle) ||
      c.roomName.toLowerCase().includes(needle) ||
      c.roomId.toLowerCase().includes(needle) ||
      (g?.owner ?? "").toLowerCase().includes(needle)
    )) return false;
    return true;
  });

  const exportCsv = () => {
    const rows = [
      ["Time", "Group", "Group ID", "Group owner", "Sender", "Type", "Deleted", "Message"],
      ...filtered.map((c) => [new Date(c.at).toLocaleString("en-SA"), c.roomName, c.roomId, groupById.get(c.roomId)?.owner ?? "", c.userName, typeMeta(c.type).label, c.deleted ? "Yes" : "No", c.text]),
    ];
    const blob = new Blob(["﻿" + rows.map((r) => r.map((v) => csvEscape(v)).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "group-chat-history.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const rowsHtml = filtered.map((c) => `<tr><td>${new Date(c.at).toLocaleString("en-SA")}</td><td>${esc(c.roomName)}</td><td>${esc(groupById.get(c.roomId)?.owner ?? "")}</td><td>${esc(c.userName)}</td><td>${typeMeta(c.type).label}</td><td>${c.deleted ? "Deleted" : ""}</td><td>${esc(c.text)}</td></tr>`).join("");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Group Chat History</title><style>body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#111}h1{font-size:18px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ccc;padding:6px;text-align:left;vertical-align:top}th{background:#f3f3f3}</style></head><body><h1>LotusPlay Connect — Group Chat History</h1><p>${filtered.length} messages · exported ${new Date().toLocaleString("en-SA")}</p><table><thead><tr><th>Time</th><th>Group</th><th>Owner</th><th>Sender</th><th>Type</th><th>Status</th><th>Message</th></tr></thead><tbody>${rowsHtml}</tbody></table><script>window.onload=function(){window.print()}<\/script></body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-4">
      {/* sub-tabs */}
      <div className="flex flex-wrap gap-2">
        {CHAT_VIEWS.map((v) => (
          <button key={v.key} onClick={() => setView(v.key)} className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition", view === v.key ? "bg-lotus-600 text-white" : "border border-line bg-ink-800 text-mist-400 hover:text-mist-100")}>
            <v.icon className="size-3.5" /> {v.label}
          </button>
        ))}
      </div>

      {view === "messages" && (
        <>
          {/* filter bar */}
          <Card className="p-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <div className="relative sm:col-span-2 lg:col-span-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mist-500" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by message, user, group name, group ID or owner…" className="h-9 w-full rounded-lg border border-line bg-ink-900 pl-9 pr-3 text-sm text-mist-100 outline-none focus:border-lotus-400" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-mist-500">Group</label>
                <select value={group} onChange={(e) => setGroup(e.target.value)} className="h-9 w-full rounded-lg border border-line bg-ink-900 px-2 text-sm text-mist-100 outline-none focus:border-lotus-400">
                  <option value="all">All groups</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name} · {g.id}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-mist-500">Group owner</label>
                <select value={owner} onChange={(e) => setOwner(e.target.value)} className="h-9 w-full rounded-lg border border-line bg-ink-900 px-2 text-sm text-mist-100 outline-none focus:border-lotus-400">
                  <option value="all">All owners</option>
                  {owners.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-mist-500">Message type</label>
                <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="h-9 w-full rounded-lg border border-line bg-ink-900 px-2 text-sm text-mist-100 outline-none focus:border-lotus-400">
                  <option value="all">All types</option>
                  {(Object.keys(TYPE_META) as ChatMessageType[]).map((t) => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-mist-500">Date range</label>
                <div className="flex items-center gap-1.5">
                  <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" className="h-9 w-full rounded-lg border border-line bg-ink-900 px-2 text-xs text-mist-100 outline-none focus:border-lotus-400" />
                  <span className="text-mist-500">–</span>
                  <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" className="h-9 w-full rounded-lg border border-line bg-ink-900 px-2 text-xs text-mist-100 outline-none focus:border-lotus-400" />
                </div>
              </div>
            </div>
            {(q || group !== "all" || owner !== "all" || type !== "all" || from || to) && (
              <button onClick={() => { setQ(""); setGroup("all"); setOwner("all"); setType("all"); setFrom(""); setTo(""); }} className="mt-2 text-[11px] text-lotus-300 hover:text-lotus-200">Clear filters</button>
            )}
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-4 py-2.5">
              <span className="text-xs text-mist-400">{filtered.length} of {chats.length} messages</span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={exportCsv}><Download className="size-3.5" /> Export Excel (CSV)</Button>
                <Button size="sm" variant="secondary" onClick={exportPdf}><FileText className="size-3.5" /> Export PDF</Button>
              </div>
            </div>
            <div ref={listRef} onScroll={(e) => ssSet("scroll", String((e.target as HTMLDivElement).scrollTop))} className="max-h-[58vh] divide-y divide-white/5 overflow-y-auto">
              {filtered.map((c) => {
                const meta = typeMeta(c.type);
                return (
                  <div key={c.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-white/[0.02]">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-mist-100">{c.userName}</span>
                        <span className="text-mist-500">{c.roomName}</span>
                        <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold", meta.tone)}><meta.Icon className="size-3" /> {meta.label}</span>
                        {c.deleted && <span className="rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">Deleted{c.deletedBy ? ` · ${c.deletedBy}` : ""}</span>}
                        <span className="text-mist-600">{fmt(c.at)}</span>
                      </div>
                      <p className={cn("text-sm", c.deleted ? "text-mist-500 line-through" : "text-mist-300")}>{c.text}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {!c.deleted && (
                        <button title="Delete this message" onClick={() => onAction({ kind: "deleteMessage", id: c.id }, "Message deleted")} className="grid size-7 place-items-center rounded-lg bg-rose-500/15 text-rose-300 hover:bg-rose-500/25"><Trash2 className="size-3.5" /></button>
                      )}
                      <button title="Block this user from sending messages in this group" onClick={() => onAction({ kind: "blockChatUser", roomId: c.roomId, userId: c.userId, userName: c.userName, roomName: c.roomName, muted: true }, `${c.userName} blocked from chatting`)} className="grid size-7 place-items-center rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"><Ban className="size-3.5" /></button>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && <p className="px-4 py-10 text-center text-sm text-mist-500">No messages match these filters.</p>}
            </div>
          </Card>
        </>
      )}

      {view === "groups" && (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-white/5 p-3">
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mist-500" />
              <input value={groupQuery} onChange={(e) => setGroupQuery(e.target.value)} placeholder="Search by group name, owner or ID…" className="h-9 w-full rounded-lg border border-line bg-ink-900 pl-9 pr-3 text-sm text-mist-100 outline-none focus:border-lotus-400" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-mist-500">
                <th className="px-4 py-3 font-semibold">Group</th><th className="px-4 py-3 font-semibold">Owner</th><th className="px-4 py-3 font-semibold">Type</th><th className="px-4 py-3 font-semibold">Messages</th><th className="px-4 py-3 font-semibold">Blocked</th><th className="px-4 py-3 font-semibold">Last activity</th><th className="px-4 py-3 text-right font-semibold"></th>
              </tr></thead>
              <tbody>
                {groups.filter((g) => { const n = groupQuery.trim().toLowerCase(); return !n || g.name.toLowerCase().includes(n) || g.owner.toLowerCase().includes(n) || g.id.toLowerCase().includes(n); }).map((g) => (
                  <tr key={g.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-3"><div className="font-medium text-mist-100">{g.name}</div><div className="text-[10px] text-mist-500">ID: {g.id}</div></td>
                    <td className="px-4 py-3 text-mist-300">{g.owner}</td>
                    <td className="px-4 py-3 capitalize text-mist-400">{g.type}</td>
                    <td className="px-4 py-3 font-semibold text-mist-100">{g.messages.toLocaleString("en-SA")}</td>
                    <td className="px-4 py-3">{g.chatBlocked > 0 ? <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">{g.chatBlocked} blocked</span> : <span className="text-mist-600">—</span>}</td>
                    <td className="px-4 py-3 text-xs text-mist-400">{g.lastAt ? fmt(g.lastAt) : "—"}</td>
                    <td className="px-4 py-3 text-right"><Button size="sm" variant="secondary" onClick={() => { setGroup(g.id); setView("messages"); }}><Eye className="size-3.5" /> View chat</Button></td>
                  </tr>
                ))}
                {groups.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-mist-500">No groups with chat activity yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {view === "dashboard" && <ChatDashboard chats={chats} groups={groups} />}
    </div>
  );
}

function ChatDashboard({ chats, groups }: { chats: ChatLog[]; groups: ChatGroup[] }) {
  const now = Date.now();
  const within = (ms: number) => chats.filter((c) => now - new Date(c.at).getTime() <= ms).length;
  const day = within(24 * 3600e3);
  const week = within(7 * 24 * 3600e3);
  const month = within(30 * 24 * 3600e3);
  const senders = new Set(chats.map((c) => c.userId)).size;
  const top = [...groups].sort((a, b) => b.messages - a.messages).slice(0, 6);
  const max = Math.max(1, ...top.map((g) => g.messages));

  const cards = [
    { label: "Total messages", value: chats.length, icon: MessageSquare, tone: "bg-sky-500/15 text-sky-300" },
    { label: "Active groups", value: groups.filter((g) => g.messages > 0).length, icon: Users, tone: "bg-lotus-500/15 text-lotus-300" },
    { label: "Unique senders", value: senders, icon: Users, tone: "bg-emerald-500/15 text-emerald-300" },
    { label: "Last 24 hours", value: day, icon: CalendarDays, tone: "bg-gold-500/15 text-gold-300" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="flex items-center gap-3 p-4">
            <span className={cn("grid size-10 place-items-center rounded-full", c.tone)}><c.icon className="size-5" /></span>
            <div><div className="font-display text-xl font-bold text-mist-100">{c.value.toLocaleString("en-SA")}</div><div className="text-xs text-mist-400">{c.label}</div></div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-mist-100"><BarChart3 className="size-4 text-lotus-300" /> Most active groups</h3>
          {top.length === 0 ? <p className="py-4 text-center text-sm text-mist-500">No activity yet.</p> : (
            <div className="space-y-2.5">
              {top.map((g) => (
                <div key={g.id}>
                  <div className="mb-1 flex items-center justify-between text-xs"><span className="truncate font-medium text-mist-200">{g.name}</span><span className="text-mist-400">{g.messages.toLocaleString("en-SA")}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-ink-700"><div className="h-full rounded-full bg-lotus-500" style={{ width: `${(g.messages / max) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-mist-100"><CalendarDays className="size-4 text-gold-300" /> Message statistics</h3>
          <div className="space-y-2">
            {[["Today (24h)", day], ["This week (7d)", week], ["This month (30d)", month], ["All time", chats.length]].map(([label, val]) => (
              <div key={label as string} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2">
                <span className="text-sm text-mist-300">{label}</span>
                <span className="font-display text-base font-bold text-mist-100">{(val as number).toLocaleString("en-SA")}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
