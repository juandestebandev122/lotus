"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { Database, Mic, Lock, Trophy, Phone, Video, MessageSquare, Users, HardDrive, Clock, Shield, Search, Plus, FileText, Check, X, Play } from "lucide-react";
import { UserLink, SortSelect, applyFilterSort, type SortDir } from "@/components/admin/TableControls";

type Dash = Record<string, number | boolean>;
type Mods = Record<string, boolean>;
type Notify = { enabled?: boolean; text?: string; voiceRoom?: boolean; privateRoom?: boolean; competition?: boolean; paidZoneCall?: boolean; voiceCall?: boolean; videoCall?: boolean; chat?: boolean };
type RecCfg = { master?: boolean; retentionDays?: number; autoDelete?: boolean; maxStorageMB?: number; userAccess?: "adminOnly" | "hostAndAdmin"; modules?: Mods; notify?: Notify };

const NOTIFY_ROWS: { k: keyof Notify; label: string }[] = [
  { k: "voiceRoom", label: "Voice Room recording notification" },
  { k: "privateRoom", label: "Private Room recording notification" },
  { k: "competition", label: "Competition Room recording notification" },
  { k: "paidZoneCall", label: "Paid Zone Call recording notification" },
  { k: "voiceCall", label: "Voice Call recording notification" },
  { k: "videoCall", label: "Video Call recording notification" },
  { k: "chat", label: "Chat recording notification" },
];
type Complaint = {
  id: string; code: string; subjectName?: string; subjectUserId?: string; roomId?: string; callId?: string; competitionId?: string; agencyId?: string;
  category?: string; reason: string; status: "pending" | "investigating" | "resolved" | "rejected"; raisedByName?: string; raisedAt: string;
  notes: { at: string; by: string; text: string }[]; decidedByName?: string; decidedAt?: string;
};

const MODULE_GROUPS: { title: string; icon: ComponentType<{ className?: string }>; keys: { k: string; label: string }[] }[] = [
  { title: "Voice Rooms", icon: Mic, keys: [{ k: "voiceRoomVoice", label: "Voice recording" }, { k: "voiceRoomChat", label: "Chat recording" }] },
  { title: "Private Rooms", icon: Lock, keys: [{ k: "privateRoomVoice", label: "Voice recording" }, { k: "privateRoomChat", label: "Chat recording" }] },
  { title: "Competition Rooms", icon: Trophy, keys: [{ k: "competitionAudio", label: "Audio recording" }, { k: "competitionChat", label: "Chat recording" }] },
  { title: "Paid Zone", icon: Phone, keys: [{ k: "paidZoneVoice", label: "Voice call recording" }, { k: "paidZoneVideo", label: "Video call recording" }, { k: "paidZoneChat", label: "Chat recording" }] },
  { title: "Private Voice Calls", icon: Phone, keys: [{ k: "privateVoiceCall", label: "Recording" }] },
  { title: "Private Video Calls", icon: Video, keys: [{ k: "privateVideoCall", label: "Recording" }] },
  { title: "Personal Chats", icon: MessageSquare, keys: [{ k: "personalChat", label: "Message history" }] },
  { title: "Group Chats", icon: Users, keys: [{ k: "groupChat", label: "Message history" }] },
];
const RETENTION_PRESETS = [1, 7, 30, 90, 180, 365];
const STATUS_TONE: Record<string, string> = { pending: "bg-amber-500/15 text-amber-300", investigating: "bg-sky-500/15 text-sky-300", resolved: "bg-emerald-500/15 text-emerald-300", rejected: "bg-rose-500/15 text-rose-300" };
const fmt = (s?: string) => { if (!s) return "—"; const d = new Date(s); return isNaN(d.getTime()) ? "—" : d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); };
const fmtMB = (b: number) => { const mb = b / (1024 * 1024); return mb < 1 ? `${Math.round(b / 1024)} KB` : `${mb.toFixed(1)} MB`; };

export default function AdminRecordsPage() {
  const { toast } = useToast();
  const { reload } = useConfig();
  const [tab, setTab] = useState<"dashboard" | "settings" | "investigations">("dashboard");
  const [dash, setDash] = useState<Dash | null>(null);
  const [cfg, setCfg] = useState<RecCfg>({ modules: {} });
  const [saving, setSaving] = useState(false);
  const [complaints, setComplaints] = useState<Complaint[]>([]);

  const load = useCallback(async () => {
    try {
      const [r, c] = await Promise.all([
        fetch(withBase("/api/admin/records"), { credentials: "include", cache: "no-store" }).then((x) => x.json()),
        fetch(withBase("/api/admin/complaints"), { credentials: "include", cache: "no-store" }).then((x) => x.json()),
      ]);
      setDash(r?.dashboard ?? null);
      setCfg({ ...(r?.config ?? {}), modules: (r?.config?.modules ?? {}) });
      setComplaints((c?.complaints ?? []) as Complaint[]);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const setMod = (k: string, v: boolean) => setCfg((c) => ({ ...c, modules: { ...(c.modules ?? {}), [k]: v } }));
  const setNotify = (patch: Partial<Notify>) => setCfg((c) => ({ ...c, notify: { ...(c.notify ?? {}), ...patch } }));
  const saveCfg = async () => {
    setSaving(true);
    const res = await saveConfig({ recording: cfg });
    setSaving(false);
    if (res.ok) { await reload(); await load(); toast("Record Management settings saved.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><Database className="size-6 text-lotus-300" /> Record Management</h1>
        <p className="mt-1 text-sm text-mist-400">Master control for recording &amp; logging across every communication feature, with retention, a records dashboard, and a Complaint &amp; Investigation Center. Recording only happens when you switch it on.</p>
      </div>

      {/* Master switch banner */}
      <Card className={cn("flex flex-wrap items-center justify-between gap-3 p-4", cfg.master ? "border-emerald-400/30" : "")}>
        <div className="flex items-center gap-3">
          <span className={cn("grid size-11 place-items-center rounded-2xl", cfg.master ? "bg-emerald-500/15 text-emerald-300" : "bg-ink-800 text-mist-500")}><Shield className="size-5" /></span>
          <div><div className="text-sm font-bold text-mist-100">Global Record Management</div><div className="text-xs text-mist-400">{cfg.master ? "ON — modules below record/log per their switches." : "OFF — nothing is recorded or logged anywhere."}</div></div>
        </div>
        <Switch on={cfg.master === true} onChange={(v) => setCfg((c) => ({ ...c, master: v }))} />
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        {([["dashboard", "Dashboard"], ["settings", "Modules & Settings"], ["investigations", "Complaint & Investigation"]] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className={cn("rounded-full px-3.5 py-1.5 text-sm font-semibold transition", tab === t ? "bg-lotus-500 text-white" : "bg-ink-800 text-mist-300 hover:bg-white/[0.06]")}>{label}</button>
        ))}
        <Link href="/admin/recordings" className="ml-auto text-xs font-semibold text-lotus-300 hover:text-lotus-200">Recording files →</Link>
      </div>

      {tab === "dashboard" && dash && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Metric icon={Mic} label="Voice Room records" value={dash.voiceRoomRecords as number} href="/admin/recordings" hint="Open the recording files for voice rooms" />
            <Metric icon={Lock} label="Private Room records" value={dash.privateRoomRecords as number} href="/admin/recordings" hint="Open the recording files for private rooms" />
            <Metric icon={Trophy} label="Competition records" value={dash.competitionRecords as number} href="/admin/competitions" hint="Open Competitions" />
            <Metric icon={Phone} label="Voice call records" value={dash.voiceCallRecords as number} href="/admin/paid-zone" hint="Open Paid Zone → Calls" />
            <Metric icon={Video} label="Video call records" value={dash.videoCallRecords as number} href="/admin/paid-zone" hint="Open Paid Zone → Calls" />
            <Metric icon={MessageSquare} label="Chat records" value={dash.chatRecords as number} sub={`${dash.directMessages} DM · ${dash.groupChatRecords} group`} href="/admin/group-chats" hint="Open group & personal chat history" />
            <Metric icon={FileText} label="Event logs" value={dash.roomEventLogs as number} href="/admin/room-activities" hint="Open Room Activities" />
            <Metric icon={Video} label="Audio recordings" value={dash.recordings as number} sub={`${dash.roomRecordings} room · ${dash.callRecordings} call`} href="/admin/recordings" hint="Open the recording files" />
            <Metric icon={HardDrive} label="Recording storage" value={fmtMB(dash.storageUsedBytes as number)} sub={(dash.storageUsedBytes as number) > 0 ? ((dash.storageCapMB as number) > 0 ? `${dash.storageUsedPct}% of ${dash.storageCapMB} MB` : "recorded media") : (dash.master ? "no recordings saved yet" : "recording is OFF — no media stored")} href="/admin/storage" hint="Media recording files only — open Storage Management for total disk usage" />
            <Metric icon={Clock} label="Today" value={dash.today as number} sub={`${dash.week} this week · ${dash.month} this month`} href="/admin/recordings" hint="Open today's recording files" />
            <Metric icon={Shield} label="Complaints" value={dash.complaintsTotal as number} sub={`${dash.complaintsPending} pending`} onClick={() => setTab("investigations")} hint="Open the Complaint & Investigation Center" />
            <Metric icon={Search} label="Active investigations" value={dash.activeInvestigations as number} sub={`${dash.resolvedComplaints} resolved`} onClick={() => setTab("investigations")} hint="Open the Complaint & Investigation Center" />
          </div>
          <Card className="p-4 text-sm text-mist-400">
            <div className="flex items-center gap-2 font-semibold text-mist-200"><Clock className="size-4 text-lotus-300" /> Deletion schedule</div>
            <p className="mt-1">{dash.autoDelete ? `Auto-delete is ON — records are removed ${dash.retentionDays} day(s) after they're created.` : "Auto-delete is OFF — records are kept until an admin removes them. Turn it on in Modules & Settings."}</p>
          </Card>
        </div>
      )}

      {tab === "settings" && (
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="mb-1 font-display text-lg font-bold text-mist-100">Module ON / OFF</h2>
            <p className="mb-3 text-sm text-mist-400">Enable recording &amp; logging per feature. Voice/video switches capture audio; chat/log switches govern what the records keep.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {MODULE_GROUPS.map((g) => (
                <div key={g.title} className="rounded-xl border border-line bg-ink-800/40 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-mist-100"><g.icon className="size-4 text-lotus-300" /> {g.title}</div>
                  <div className="space-y-1.5">
                    {g.keys.map((row) => (
                      <div key={row.k} className="flex items-center justify-between gap-2">
                        <span className="text-xs text-mist-300">{row.label}</span>
                        <Switch small on={cfg.modules?.[row.k] === true} onChange={(v) => setMod(row.k, v)} disabled={!cfg.master} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-display text-lg font-bold text-mist-100">Retention &amp; storage</h2>
            <div className="mb-1 text-sm font-semibold text-mist-200">Retention period</div>
            <div className="flex flex-wrap gap-2">
              {RETENTION_PRESETS.map((d) => (
                <button key={d} onClick={() => setCfg((c) => ({ ...c, retentionDays: d }))} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition", cfg.retentionDays === d ? "bg-lotus-500 text-white" : "bg-ink-800 text-mist-300 hover:bg-white/[0.06]")}>
                  {d === 1 ? "1 day" : d === 365 ? "1 year" : d === 30 ? "30 days" : d === 90 ? "90 days" : d === 180 ? "180 days" : `${d} days`}
                </button>
              ))}
              <label className="flex items-center gap-1.5 text-xs text-mist-300">Custom
                <input type="number" min={0} max={3650} value={cfg.retentionDays ?? 30} onChange={(e) => setCfg((c) => ({ ...c, retentionDays: Number(e.target.value) || 0 }))} className="h-8 w-20 rounded-lg border border-line bg-ink-800 px-2 text-sm text-mist-100 outline-none focus:border-lotus-400" /> days
              </label>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="flex items-center justify-between rounded-xl border border-line bg-ink-800/40 px-3 py-2.5"><span className="text-sm text-mist-200">Auto-delete after retention</span><Switch small on={cfg.autoDelete === true} onChange={(v) => setCfg((c) => ({ ...c, autoDelete: v }))} /></div>
              <label className="block"><span className="mb-1 block text-sm font-semibold text-mist-200">Storage cap (MB, 0 = none)</span><input type="number" min={0} value={cfg.maxStorageMB ?? 0} onChange={(e) => setCfg((c) => ({ ...c, maxStorageMB: Number(e.target.value) || 0 }))} className="h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400" /></label>
              <label className="block"><span className="mb-1 block text-sm font-semibold text-mist-200">Access</span><select value={cfg.userAccess ?? "adminOnly"} onChange={(e) => setCfg((c) => ({ ...c, userAccess: e.target.value as RecCfg["userAccess"] }))} className="h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400"><option value="adminOnly">Admins only</option><option value="hostAndAdmin">Host &amp; admins</option></select></label>
            </div>
          </Card>

          {/* Recording Notification */}
          <Card className="p-5">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-mist-100">Recording Notification</h2>
              <div className="flex items-center gap-2 text-sm text-mist-300">Show notice to users <Switch small on={cfg.notify?.enabled !== false} onChange={(v) => setNotify({ enabled: v })} /></div>
            </div>
            <p className="mb-3 text-sm text-mist-400">When ON, users see a &quot;being recorded&quot; notice while recording is active. When OFF, no notice is shown (recording still follows your settings).</p>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-mist-200">Notification text (editable)</span>
              <input value={cfg.notify?.text ?? ""} onChange={(e) => setNotify({ text: e.target.value })} placeholder="This room is being recorded." maxLength={300} className="h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400" disabled={cfg.notify?.enabled === false} />
              <span className="mt-1 block text-[11px] text-mist-500">Shown to users e.g. &quot;This room is being recorded.&quot; / &quot;This call is being recorded.&quot;</span>
            </label>
            <div className="mt-4 grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {NOTIFY_ROWS.map((row) => (
                <div key={row.k} className="flex items-center justify-between gap-2 border-t border-line/50 py-2.5">
                  <span className="text-sm text-mist-300">{row.label}</span>
                  <Switch small on={(cfg.notify?.[row.k] as boolean) !== false} onChange={(v) => setNotify({ [row.k]: v })} disabled={cfg.notify?.enabled === false} />
                </div>
              ))}
            </div>
          </Card>

          <div className="flex justify-end"><Button onClick={saveCfg} disabled={saving}><Check className="size-4" /> {saving ? "Saving…" : "Save settings"}</Button></div>
        </div>
      )}

      {tab === "investigations" && <Investigations complaints={complaints} onReload={load} />}
    </div>
  );
}

function Investigations({ complaints, onReload }: { complaints: Complaint[]; onReload: () => void }) {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("opened");
  const [dir, setDir] = useState<SortDir>("desc");
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ reason: "" });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [records, setRecords] = useState<Record<string, { recordings: { id: string; roomName: string; fileUrl?: string; startedAt: string }[]; roomChats: { id: string; userName: string; text: string; at: string }[]; roomEvents: { id: string; type: string; target: string; actorName: string; at: string }[]; calls: { id: string; type: string; callerName: string; receiverName: string; minutesBilled: number }[]; directMessages: { id: string; text: string; at: string }[] }>>({});

  const shown = useMemo(() => applyFilterSort(
    complaints.filter((c) => statusFilter === "all" || c.status === statusFilter),
    {
      q, sort, dir,
      searchText: (c) => `${c.code} ${c.subjectName ?? ""} ${c.subjectUserId ?? ""} ${c.roomId ?? ""} ${c.callId ?? ""} ${c.competitionId ?? ""} ${c.category ?? ""} ${c.reason} ${c.raisedByName ?? ""} ${c.status}`,
      sortKeys: {
        opened: (c) => new Date(c.raisedAt ?? 0).getTime() || 0,
        code: (c) => c.code ?? "",
        subject: (c) => c.subjectName ?? "",
        status: (c) => c.status ?? "",
        category: (c) => c.category ?? "",
      },
    },
  ), [complaints, q, statusFilter, sort, dir]);

  const create = async () => {
    if (!form.reason?.trim()) { toast("Enter a reason.", "error"); return; }
    const res = await fetch(withBase("/api/admin/complaints"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) { toast("Case opened.", "success"); setOpenNew(false); setForm({ reason: "" }); onReload(); }
    else { const d = await res.json().catch(() => ({})); toast(d.error ?? "Could not open case", "error"); }
  };
  const patch = async (id: string, body: { status?: string; note?: string }) => {
    const res = await fetch(withBase("/api/admin/complaints"), { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...body }) });
    if (res.ok) { toast("Updated.", "success"); setNote(""); onReload(); }
    else toast("Update failed", "error");
  };
  const investigate = async (c: Complaint) => {
    const p = new URLSearchParams({ investigate: "1" });
    if (c.subjectUserId) p.set("userId", c.subjectUserId);
    if (c.roomId) p.set("roomId", c.roomId);
    if (c.callId) p.set("callId", c.callId);
    if (c.competitionId) p.set("competitionId", c.competitionId);
    const res = await fetch(withBase(`/api/admin/complaints?${p.toString()}`), { credentials: "include" });
    const d = await res.json();
    setRecords((r) => ({ ...r, [c.id]: d.records }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mist-500" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by case, user, room, call, competition…" className="h-10 w-full rounded-xl border border-line bg-ink-800 pl-10 pr-4 text-sm text-mist-100 outline-none focus:border-lotus-400" /></div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-xl border border-line bg-ink-800 px-3 text-sm font-semibold text-mist-100 outline-none focus:border-lotus-400"><option value="all">All</option><option value="pending">Pending</option><option value="investigating">Investigating</option><option value="resolved">Resolved</option><option value="rejected">Rejected</option></select>
        <SortSelect
          sort={sort} dir={dir} onSort={setSort} onDir={setDir}
          options={[{ key: "opened", label: "Date opened" }, { key: "code", label: "Case code" }, { key: "subject", label: "Subject" }, { key: "status", label: "Status" }, { key: "category", label: "Category" }]}
        />
        <Button onClick={() => setOpenNew((o) => !o)}><Plus className="size-4" /> New case</Button>
      </div>

      {openNew && (
        <Card className="space-y-3 p-4">
          <h3 className="text-sm font-bold text-mist-100">Open a complaint / investigation case</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {[["subjectName", "Subject name"], ["subjectUserId", "User ID"], ["roomId", "Room ID"], ["callId", "Call ID"], ["competitionId", "Competition ID"], ["agencyId", "Agency ID"], ["category", "Category (abuse/dispute/payment…)"]].map(([k, ph]) => (
              <input key={k} value={form[k] ?? ""} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} placeholder={ph} className="h-10 rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400" />
            ))}
          </div>
          <textarea value={form.reason ?? ""} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Reason / description of the complaint *" rows={3} className="w-full rounded-lg border border-line bg-ink-800 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400" />
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setOpenNew(false)}>Cancel</Button><Button onClick={create}><Check className="size-4" /> Open case</Button></div>
        </Card>
      )}

      {shown.length === 0 ? <Card className="grid place-items-center p-10 text-mist-400">No cases{q ? " match your search" : " yet"}.</Card> : shown.map((c) => (
        <Card key={c.id} className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2"><span className="font-mono text-sm font-bold text-lotus-300">{c.code}</span><span className={cn("rounded-full px-2 py-0.5 text-xs font-bold capitalize", STATUS_TONE[c.status])}>{c.status}</span></div>
              <div className="mt-0.5 text-sm text-mist-100">{c.reason}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-mist-500">
                {c.subjectName && <>Subject: <UserLink name={c.subjectName} userId={c.subjectUserId} className="text-xs" /> ·</>}
                <span>{[c.roomId && `Room ${c.roomId}`, c.callId && `Call ${c.callId}`, c.competitionId && `Comp ${c.competitionId}`, c.category].filter(Boolean).join(" · ")}</span>
                <span>· opened {fmt(c.raisedAt)}{c.raisedByName ? ` by ${c.raisedByName}` : ""}</span>
              </div>
            </div>
            <button onClick={() => setExpanded(expanded === c.id ? null : c.id)} className="shrink-0 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-mist-200 hover:bg-white/[0.12]">{expanded === c.id ? "Close" : "Open"}</button>
          </div>

          {expanded === c.id && (
            <div className="mt-3 space-y-3 border-t border-line/60 pt-3">
              {/* status actions */}
              <div className="flex flex-wrap gap-1.5">
                {(["pending", "investigating", "resolved", "rejected"] as const).map((s) => (
                  <button key={s} onClick={() => patch(c.id, { status: s })} className={cn("rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition", c.status === s ? STATUS_TONE[s] : "bg-ink-800 text-mist-400 hover:bg-white/[0.06]")}>{s}</button>
                ))}
              </div>
              {/* notes */}
              <div className="space-y-1.5">
                {c.notes.length > 0 && c.notes.map((n, i) => <div key={i} className="rounded-lg bg-ink-800/60 px-3 py-1.5 text-xs text-mist-300"><span className="text-mist-500">{fmt(n.at)} · {n.by}:</span> {n.text}</div>)}
                <div className="flex gap-2"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal investigation note…" className="h-9 flex-1 rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400" /><Button size="sm" onClick={() => note.trim() && patch(c.id, { note })} disabled={!note.trim()}>Add</Button></div>
              </div>
              {/* linked records */}
              <div>
                <Button size="sm" variant="secondary" onClick={() => investigate(c)}><Search className="size-4" /> Load linked records (evidence)</Button>
                {records[c.id] && (
                  <div className="mt-2 space-y-2 text-xs">
                    <div className="font-semibold text-mist-200">Recordings ({records[c.id].recordings.length})</div>
                    {records[c.id].recordings.map((r) => (
                      <div key={r.id} className="flex items-center gap-2 rounded bg-ink-800/60 px-2 py-1"><span className="flex-1 truncate text-mist-300">{r.roomName} · {fmt(r.startedAt)}</span>{r.fileUrl ? <a href={withBase(r.fileUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-lotus-300"><Play className="size-3" /> play</a> : <span className="text-mist-600">log only</span>}</div>
                    ))}
                    <div className="font-semibold text-mist-200">Chat ({records[c.id].roomChats.length}) · Events ({records[c.id].roomEvents.length}) · Calls ({records[c.id].calls.length}) · DMs ({records[c.id].directMessages.length})</div>
                    {records[c.id].roomChats.slice(0, 20).map((m) => <div key={m.id} className="rounded bg-ink-800/40 px-2 py-1 text-mist-400"><span className="text-mist-500">{fmt(m.at)} {m.userName}:</span> {m.text}</div>)}
                    {records[c.id].roomEvents.slice(0, 20).map((e) => <div key={e.id} className="rounded bg-ink-800/40 px-2 py-1 text-mist-500">{fmt(e.at)} · {e.actorName} {e.type} {e.target}</div>)}
                  </div>
                )}
              </div>
              <div className="text-[11px] text-mist-600"><FileText className="mr-1 inline size-3" />Investigation report: use your browser&apos;s Print (Ctrl/Cmd-P) on this open case to save a PDF.</div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

/** A dashboard summary tile. When `href` is given the whole tile is a LINK to the
 *  screen that holds those records, so every number on the dashboard can be
 *  opened and inspected instead of being a dead figure. `onClick` is used for the
 *  counts that live on another TAB of this same page. */
function Metric({ icon: Icon, label, value, sub, href, onClick, hint }: {
  icon: ComponentType<{ className?: string }>; label: string; value: string | number; sub?: string;
  href?: string; onClick?: () => void; hint?: string;
}) {
  const inner = (
    <>
      <Icon className="size-5 text-lotus-300" />
      <div className="mt-1.5 font-display text-2xl font-extrabold text-mist-100">{value}</div>
      <div className="text-xs font-semibold text-mist-300">{label}</div>
      {sub && <div className="text-[11px] text-mist-500">{sub}</div>}
      {(href || onClick) && <div className="mt-1 text-[11px] font-semibold text-lotus-300 opacity-0 transition group-hover:opacity-100">View →</div>}
    </>
  );
  const cardCls = "block p-4 text-left transition hover:border-lotus-400/50 hover:bg-white/[0.04]";
  if (href) {
    return (
      <Link href={href} title={hint ?? `Open ${label.toLowerCase()}`} className="group">
        <Card className={cardCls}>{inner}</Card>
      </Link>
    );
  }
  if (onClick) {
    return (
      <button onClick={onClick} title={hint ?? `Open ${label.toLowerCase()}`} className="group w-full text-left">
        <Card className={cardCls}>{inner}</Card>
      </button>
    );
  }
  return <Card className="p-4">{inner}</Card>;
}

function Switch({ on, onChange, small, disabled }: { on: boolean; onChange: (v: boolean) => void; small?: boolean; disabled?: boolean }) {
  return (
    <button onClick={() => !disabled && onChange(!on)} role="switch" aria-checked={on} disabled={disabled}
      className={cn("relative shrink-0 rounded-full transition disabled:opacity-40", small ? "h-5 w-9" : "h-6 w-11", on ? "bg-emerald-500" : "bg-mist-600")}>
      <span className={cn("absolute top-0.5 rounded-full bg-white shadow transition-all", small ? "size-4" : "size-5", on ? (small ? "left-[18px]" : "left-[22px]") : "left-0.5")} />
    </button>
  );
}
