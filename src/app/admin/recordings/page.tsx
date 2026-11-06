"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useConfig, saveConfig } from "@/lib/config";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { Video, Search, Play, Download, Archive, Trash2, HardDrive, Check, Clock, Phone } from "lucide-react";

type Rec = {
  id: string; kind?: "room" | "call"; roomId: string; roomName: string; hostName?: string;
  startedBy: string; startedAt: string; endedAt?: string; durationSec?: number; participants: string[];
  status: "recording" | "processing" | "stored" | "archived" | "deleted";
  fileUrl?: string; sizeBytes?: number; callType?: "audio" | "video"; note?: string;
};
type Stats = { total: number; available: number; archived: number; recording: number; processing: number; roomCount: number; callCount: number; totalBytes: number; capMB: number; usedPct: number; retentionDays: number; autoDelete: boolean };
type RecCfg = { roomEnabled?: boolean; callEnabled?: boolean; retentionDays?: number; autoDelete?: boolean; maxStorageMB?: number; userAccess?: "adminOnly" | "hostAndAdmin" };

const STATUS_LABEL: Record<string, string> = { stored: "Available", processing: "Processing", archived: "Archived", recording: "Recording", deleted: "Deleted" };
const STATUS_TONE: Record<string, string> = { stored: "bg-emerald-500/15 text-emerald-300", processing: "bg-amber-500/15 text-amber-300", archived: "bg-mist-600/30 text-mist-300", recording: "bg-rose-500/15 text-rose-300", deleted: "bg-rose-500/15 text-rose-300" };

function fmtDate(s?: string) { if (!s) return "—"; const d = new Date(s); return isNaN(d.getTime()) ? "—" : d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
function fmtDur(sec?: number) { if (!sec) return "—"; const m = Math.floor(sec / 60), s = sec % 60; return `${m}:${String(s).padStart(2, "0")}`; }
function fmtSize(b?: number) { if (!b) return "—"; const mb = b / (1024 * 1024); return mb < 1 ? `${Math.round(b / 1024)} KB` : `${mb.toFixed(1)} MB`; }

export default function AdminRecordingsPage() {
  const { toast } = useToast();
  const { config, reload } = useConfig();
  const [recs, setRecs] = useState<Rec[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"room" | "call" | "settings">("room");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [playing, setPlaying] = useState<string | null>(null);
  const [savingCfg, setSavingCfg] = useState(false);
  const [cfg, setCfg] = useState<RecCfg>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch(withBase("/api/admin/recordings"), { credentials: "include", cache: "no-store" });
      const d = await res.json();
      setRecs((d?.recordings ?? []) as Rec[]);
      setStats(d?.stats ?? null);
      setCfg((d?.config ?? {}) as RecCfg);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (config.recording) setCfg((c) => (Object.keys(c).length ? c : (config.recording as RecCfg))); }, [config.recording]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return recs
      .filter((r) => (tab === "call" ? r.kind === "call" : r.kind !== "call"))
      .filter((r) => statusFilter === "all" || r.status === statusFilter)
      .filter((r) => !term || r.roomName.toLowerCase().includes(term) || (r.hostName ?? "").toLowerCase().includes(term) || r.roomId.toLowerCase().includes(term) || r.participants.join(" ").toLowerCase().includes(term));
  }, [recs, tab, statusFilter, q]);

  const act = async (id: string, action: "archive" | "unarchive" | "delete") => {
    if (action === "delete" && !window.confirm("Delete this recording permanently? The audio file will be removed.")) return;
    try {
      const res = await fetch(withBase("/api/admin/recordings"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) });
      if (res.ok) { toast(action === "delete" ? "Recording deleted." : action === "archive" ? "Archived." : "Restored.", "success"); await load(); }
      else { const d = await res.json().catch(() => ({})); toast(d.error ?? "Action failed", "error"); }
    } catch { toast("Action failed", "error"); }
  };

  const saveCfg = async () => {
    setSavingCfg(true);
    const res = await saveConfig({ recording: cfg });
    setSavingCfg(false);
    if (res.ok) { await reload(); await load(); toast("Recording settings saved.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
          <Video className="size-6 text-lotus-300" /> Recording Management
        </h1>
        <p className="mt-1 text-sm text-mist-400">Room &amp; call recordings, storage and retention. Recordings are captured on the host&apos;s device and stored securely; play, download, archive or delete them here.</p>
      </div>

      {/* Storage dashboard */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric icon={Video} label="Recordings" value={stats.total} sub={`${stats.roomCount} room · ${stats.callCount} call`} />
          <Metric icon={Check} label="Available" value={stats.available} sub={`${stats.archived} archived`} />
          <Metric icon={HardDrive} label="Storage used" value={fmtSize(stats.totalBytes)} sub={stats.capMB > 0 ? `${stats.usedPct}% of ${stats.capMB} MB` : "no cap set"} />
          <Metric icon={Clock} label="Retention" value={stats.retentionDays > 0 ? `${stats.retentionDays}d` : "∞"} sub={stats.autoDelete ? "auto-delete ON" : "auto-delete OFF"} />
        </div>
      )}
      {stats && stats.capMB > 0 && stats.usedPct >= 80 && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">⚠️ Recording storage is at {stats.usedPct}% of the {stats.capMB} MB limit. Archive or delete old recordings, or raise the cap in Settings.</div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {([["room", "Room Recordings"], ["call", "Call Recordings"], ["settings", "Settings"]] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className={cn("rounded-full px-3.5 py-1.5 text-sm font-semibold transition", tab === t ? "bg-lotus-500 text-white" : "bg-ink-800 text-mist-300 hover:bg-white/[0.06]")}>{label}</button>
        ))}
      </div>

      {tab === "settings" ? (
        <Card className="space-y-4 p-5">
          <h2 className="font-display text-lg font-bold text-mist-100">Admin controls</h2>
          <Toggle label="Room recording" hint="Allow hosts/co-hosts to record their room's audio." on={cfg.roomEnabled === true} onChange={(v) => setCfg((c) => ({ ...c, roomEnabled: v }))} />
          <Toggle label="Call recording" hint="Allow Paid-Zone calls to be recorded." on={cfg.callEnabled === true} onChange={(v) => setCfg((c) => ({ ...c, callEnabled: v }))} />
          <Toggle label="Auto-delete by retention" hint="Automatically delete recordings older than the retention period." on={cfg.autoDelete === true} onChange={(v) => setCfg((c) => ({ ...c, autoDelete: v }))} />
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block"><span className="mb-1 block text-sm font-semibold text-mist-200">Retention (days, 0 = keep forever)</span>
              <input type="number" min={0} max={3650} value={cfg.retentionDays ?? 30} onChange={(e) => setCfg((c) => ({ ...c, retentionDays: Number(e.target.value) || 0 }))} className="h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400" /></label>
            <label className="block"><span className="mb-1 block text-sm font-semibold text-mist-200">Storage cap (MB, 0 = no cap)</span>
              <input type="number" min={0} value={cfg.maxStorageMB ?? 0} onChange={(e) => setCfg((c) => ({ ...c, maxStorageMB: Number(e.target.value) || 0 }))} className="h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400" /></label>
            <label className="block"><span className="mb-1 block text-sm font-semibold text-mist-200">Access</span>
              <select value={cfg.userAccess ?? "adminOnly"} onChange={(e) => setCfg((c) => ({ ...c, userAccess: e.target.value as RecCfg["userAccess"] }))} className="h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400"><option value="adminOnly">Admins only</option><option value="hostAndAdmin">Host &amp; admins</option></select></label>
          </div>
          <div className="flex justify-end"><Button onClick={saveCfg} disabled={savingCfg}><Check className="size-4" /> {savingCfg ? "Saving…" : "Save settings"}</Button></div>
        </Card>
      ) : (
        <>
          {/* Search + status filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mist-500" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === "call" ? "Search by user, call, room id…" : "Search by room, host, room id…"} className="h-10 w-full rounded-xl border border-line bg-ink-800 pl-10 pr-4 text-sm text-mist-100 outline-none focus:border-lotus-400" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-xl border border-line bg-ink-800 px-3 text-sm font-semibold text-mist-100 outline-none focus:border-lotus-400">
              <option value="all">All statuses</option><option value="stored">Available</option><option value="processing">Processing</option><option value="archived">Archived</option><option value="recording">Recording</option>
            </select>
          </div>

          <Card className="overflow-hidden p-0">
            {loading ? <div className="grid place-items-center p-10 text-mist-400">Loading…</div>
              : shown.length === 0 ? (
                <div className="grid place-items-center gap-2 p-10 text-center text-mist-400">
                  {tab === "call" ? <Phone className="size-8 text-mist-600" /> : <Video className="size-8 text-mist-600" />}
                  No {tab} recordings{q ? " match your search" : ""}.
                  <span className="text-xs text-mist-600">{tab === "room" ? "Hosts can record from inside a room once you enable Room recording in Settings." : "Enable Call recording in Settings to capture Paid-Zone calls."}</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-sm">
                    <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-mist-500">
                      <th className="px-4 py-3 font-semibold">{tab === "call" ? "Call" : "Room"}</th>
                      <th className="px-4 py-3 font-semibold">{tab === "call" ? "Type" : "Host"}</th>
                      <th className="px-4 py-3 font-semibold">Started</th>
                      <th className="px-4 py-3 font-semibold">Duration</th>
                      <th className="px-4 py-3 font-semibold">Size</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr></thead>
                    <tbody>
                      {shown.map((r) => (
                        <Fragment key={r.id}>
                          <tr className="border-b border-line/50">
                            <td className="px-4 py-3"><div className="font-semibold text-mist-100">{r.roomName}</div><div className="text-xs text-mist-500">{r.participants.slice(0, 3).join(", ")}</div></td>
                            <td className="px-4 py-3 capitalize text-mist-300">{tab === "call" ? (r.callType ?? "audio") : (r.hostName ?? "—")}</td>
                            <td className="px-4 py-3 text-mist-300">{fmtDate(r.startedAt)}</td>
                            <td className="px-4 py-3 text-mist-300">{fmtDur(r.durationSec)}</td>
                            <td className="px-4 py-3 text-mist-300">{fmtSize(r.sizeBytes)}</td>
                            <td className="px-4 py-3"><span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-bold", STATUS_TONE[r.status] ?? "bg-mist-600/30 text-mist-300")}>{STATUS_LABEL[r.status] ?? r.status}</span></td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1.5">
                                {r.fileUrl ? (
                                  <>
                                    <button onClick={() => setPlaying(playing === r.id ? null : r.id)} title="Play" className="grid size-8 place-items-center rounded-lg bg-white/[0.06] text-mist-200 hover:bg-white/[0.12]"><Play className="size-4" /></button>
                                    <a href={withBase(r.fileUrl)} download title="Download" className="grid size-8 place-items-center rounded-lg bg-white/[0.06] text-mist-200 hover:bg-white/[0.12]"><Download className="size-4" /></a>
                                  </>
                                ) : <span className="text-[11px] text-mist-600" title="No audio file — session log only">log only</span>}
                                {r.status !== "recording" && (
                                  <button onClick={() => act(r.id, r.status === "archived" ? "unarchive" : "archive")} title={r.status === "archived" ? "Restore" : "Archive"} className="grid size-8 place-items-center rounded-lg bg-white/[0.06] text-mist-200 hover:bg-white/[0.12]"><Archive className="size-4" /></button>
                                )}
                                <button onClick={() => act(r.id, "delete")} title="Delete" className="grid size-8 place-items-center rounded-lg bg-rose-500/15 text-rose-300 hover:bg-rose-500/25"><Trash2 className="size-4" /></button>
                              </div>
                            </td>
                          </tr>
                          {playing === r.id && r.fileUrl && (
                            <tr><td colSpan={7} className="bg-ink-900/60 px-4 py-2">
                              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                              <audio controls autoPlay src={withBase(r.fileUrl)} className="w-full" />
                            </td></tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </Card>
        </>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value, sub }: { icon: ComponentType<{ className?: string }>; label: string; value: string | number; sub?: string }) {
  return (
    <Card className="p-4">
      <Icon className="size-5 text-lotus-300" />
      <div className="mt-1.5 font-display text-2xl font-extrabold text-mist-100">{value}</div>
      <div className="text-xs font-semibold text-mist-300">{label}</div>
      {sub && <div className="text-[11px] text-mist-500">{sub}</div>}
    </Card>
  );
}

function Toggle({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 border-t border-line/60 py-3 first:border-t-0">
      <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-mist-100">{label}</div><div className="text-xs text-mist-500">{hint}</div></div>
      <button onClick={() => onChange(!on)} role="switch" aria-checked={on} className={cn("relative h-6 w-11 shrink-0 rounded-full transition", on ? "bg-emerald-500" : "bg-mist-600")}>
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );
}
