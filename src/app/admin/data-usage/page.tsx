"use client";

import { useCallback, useEffect, useState } from "react";
import { withBase } from "@/lib/base-path";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { Database, RefreshCw, Download, TrendingDown, Clock, PieChart, BarChart3, Radio, Users, Info } from "lucide-react";
import { UserLink, TableSearch, SortTh, applyFilterSort, type SortDir } from "@/components/admin/TableControls";

interface DayCell { date: string; appMin: number; voiceMin: number; mb: number; source: "measured" | "estimated" }
interface Row { id: string; name: string; username: string; publicId?: string; days: DayCell[]; totalMb: number; totalAppMin: number; totalVoiceMin: number }
interface Report {
  rows: Row[]; dates: string[]; from: string; to: string;
  records: { date: string; userId: string; userName: string; username: string; publicId?: string; appMin: number; voiceMin: number; mb: number; source: "measured" | "estimated" }[];
  daily: { date: string; mb: number }[];
  weekly: { label: string; mb: number }[];
  monthly: { label: string; mb: number }[];
  hourly: { hour: number; minutes: number }[];
  hours: { hour: number; appMin: number; voiceMin: number; mb: number }[];
  hoursMeasured: boolean;
  appBreakdown: { category: string; mb: number; pct: number }[];
  totalMb: number;
  liveNow: { online: number; inRoom: number; total: number };
  preVoiceRate: number; preAppRate: number; postVoiceRate: number; postAppRate: number;
}

function todayKey(): string { return new Date().toISOString().slice(0, 10); }
function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[Math.max(0, Math.min(11, Number(m) - 1))]} ${y}`;
}

function fmtMb(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}
/** Both units side by side, so "how much is that really?" needs no mental maths. */
function fmtMbGb(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB (${Math.round(mb).toLocaleString()} MB)`;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}
function hourLabel(h: number): string {
  const ampm = h < 12 ? "AM" : "PM";
  const base = h % 12 === 0 ? 12 : h % 12;
  return `${String(h).padStart(2, "0")}:00 (${base} ${ampm})`;
}
function fmtMin(m: number): string {
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

const CAT_COLORS = ["bg-rose-400", "bg-amber-400", "bg-sky-400", "bg-violet-400", "bg-mist-500"];

export default function AdminDataUsagePage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(8);
  const [from, setFrom] = useState("");   // custom range (YYYY-MM-DD); empty = use the preset
  const [to, setTo] = useState("");
  const [live, setLive] = useState(false); // real-time: auto-refresh every 15s
  const [view, setView] = useState<"day" | "week" | "month">("day");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("total");
  const [dir, setDir] = useState<SortDir>("desc");
  const sortRows = (col: string) => { if (col === sort) setDir((d) => (d === "asc" ? "desc" : "asc")); else { setSort(col); setDir("desc"); } };
  // The three plain-English views the client asked for. "Per user" is the
  // default because that is the question actually being asked most often.
  const [mode, setMode] = useState<"user" | "day" | "hour">("user");
  // Filters: hide tiny/idle accounts, and optionally only trust measured days.
  const [minMb, setMinMb] = useState(0);
  const [onlyMeasured, setOnlyMeasured] = useState(false);
  const [details, setDetails] = useState(false); // the estimation/methodology cards
  // "Search usage for a specific user" — focusing one member narrows EVERY view.
  const [focusUser, setFocusUser] = useState<{ id: string; name: string } | null>(null);
  const [recordsQ, setRecordsQ] = useState("");
  const [recordsSort, setRecordsSort] = useState("date");
  const [recordsDir, setRecordsDir] = useState<SortDir>("desc");

  const customOn = !!(from && to);
  const load = useCallback((showSpinner = true) => {
    if (showSpinner) setLoading(true);
    const base = customOn ? `from=${from}&to=${to}` : `days=${days}`;
    // Focusing one member re-runs the WHOLE report for them, so "Per hour" and
    // "Per day" show that person's usage too — not just the per-user table.
    const qs = focusUser ? `${base}&user=${encodeURIComponent(focusUser.id)}` : base;
    fetch(withBase(`/api/admin/data-usage?${qs}`), { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((data) => { if (data && Array.isArray(data.rows)) setReport(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [days, from, to, customOn, focusUser]);
  useEffect(() => { load(); }, [load]);
  // Real-time monitoring: silently refresh every 15s while "Live" is on.
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => { if (typeof document === "undefined" || !document.hidden) load(false); }, 15000);
    return () => clearInterval(t);
  }, [live, load]);
  // Presets clear the custom range; picking custom dates overrides the preset.
  const pickPreset = (d: number) => { setFrom(""); setTo(""); setDays(d); };

  const exportCsv = () => {
    if (!report) return;
    // Export exactly what's on screen (search + filters + sort applied).
    const header = ["User", "Username", "Member ID", ...report.dates.map((d) => `${d} (MB)`), "App (min)", "Voice (min)", "Total MB", "Total GB"];
    const lines = shownRows.map((r) => [r.name, r.username, r.publicId ?? r.id, ...r.days.map((d) => d.mb.toFixed(1)), String(r.totalAppMin), String(r.totalVoiceMin), r.totalMb.toFixed(1), (r.totalMb / 1024).toFixed(3)]);
    const csv = [header, ...lines].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `data-usage-${report.dates[0]}_to_${report.dates[report.dates.length - 1]}.csv`;
    a.click();
  };

  const rangeText = report ? (report.from === todayKey() && report.to === todayKey() ? "today" : report.from === report.to ? report.from : `${report.from} → ${report.to}`) : "";
  const timeline = report ? (view === "month" ? report.monthly.map((m) => ({ key: m.label, label: monthLabel(m.label), mb: m.mb })) : view === "week" ? report.weekly.map((w) => ({ key: w.label, label: w.label, mb: w.mb })) : report.daily.map((d) => ({ key: d.date, label: d.date.slice(5), mb: d.mb }))) : [];
  const maxBar = Math.max(1, ...timeline.map((t) => t.mb));
  const maxHour = report ? Math.max(1, ...report.hourly.map((h) => h.minutes)) : 1;
  const peakHour = report ? report.hourly.reduce((a, b) => (b.minutes > a.minutes ? b : a), { hour: 0, minutes: 0 }) : null;
  // Time usage (how long each user spent in the app / in voice rooms).
  const usersByTime = report ? [...report.rows].sort((a, b) => (b.totalAppMin + b.totalVoiceMin) - (a.totalAppMin + a.totalVoiceMin)) : [];
  const totalAppTime = report ? report.rows.reduce((s, r) => s + r.totalAppMin, 0) : 0;
  const totalVoiceTime = report ? report.rows.reduce((s, r) => s + r.totalVoiceMin, 0) : 0;
  const maxUserTime = Math.max(1, ...usersByTime.map((u) => u.totalAppMin + u.totalVoiceMin));

  // Search + click-to-sort for the per-user breakdown table, then the two
  // explicit filters ("at least N MB" / "measured days only").
  const filteredRows = (report?.rows ?? []).filter((r) => {
    if (r.totalMb < minMb) return false;
    if (onlyMeasured && !r.days.some((d) => d.source === "measured" && d.mb > 0)) return false;
    return true;
  });
  const shownRows = applyFilterSort(filteredRows, {
    q, sort, dir,
    searchText: (r) => `${r.name} ${r.username} ${r.publicId ?? ""} ${r.id}`,
    sortKeys: {
      user: (r) => r.name ?? "",
      app: (r) => r.totalAppMin ?? 0,
      voice: (r) => r.totalVoiceMin ?? 0,
      total: (r) => r.totalMb ?? 0,
    },
  });
  const sortRecords = (col: string) => {
    if (col === recordsSort) setRecordsDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setRecordsSort(col); setRecordsDir(col === "date" ? "desc" : "asc"); }
  };
  const shownRecords = applyFilterSort(report?.records ?? [], {
    q: recordsQ,
    sort: recordsSort,
    dir: recordsDir,
    searchText: (r) => `${r.date} ${r.userName} ${r.username} ${r.publicId ?? ""} ${r.source}`,
    sortKeys: {
      date: (r) => r.date,
      user: (r) => r.userName,
      app: (r) => r.appMin,
      voice: (r) => r.voiceMin,
      mb: (r) => r.mb,
      source: (r) => r.source,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
            <Database className="size-6 text-lotus-300" /> Data Usage
          </h1>
          <p className="text-sm text-mist-400">Where data went, how much per user, and how it&apos;s being reduced.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={customOn ? "custom" : String(days)} onChange={(e) => { if (e.target.value !== "custom") pickPreset(Number(e.target.value)); }} className="rounded-lg border border-line bg-ink-800 px-3 py-2 text-sm text-mist-200">
            <option value={1}>Today</option>
            <option value={7}>Last 7 days</option>
            <option value={8}>Last 8 days</option>
            <option value={15}>Last 15 days</option>
            <option value={31}>Last 31 days</option>
            <option value={90}>Last 90 days</option>
            {customOn && <option value="custom">Custom range</option>}
          </select>
          {/* Custom date range */}
          <div className="flex items-center gap-1 rounded-lg border border-line bg-ink-800 px-2 py-1 text-xs text-mist-300">
            <input type="date" max={todayKey()} value={from} onChange={(e) => { setFrom(e.target.value); if (!to) setTo(todayKey()); }} className="bg-transparent text-mist-100 outline-none" />
            <span>→</span>
            <input type="date" max={todayKey()} value={to} onChange={(e) => setTo(e.target.value)} className="bg-transparent text-mist-100 outline-none" />
            {customOn && <button onClick={() => { setFrom(""); setTo(""); }} title="Clear custom range" className="ml-1 text-mist-500 hover:text-mist-200">✕</button>}
          </div>
          <button onClick={() => setLive((v) => !v)} title="Auto-refresh every 15s" className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition", live ? "border-rose-400/50 bg-rose-500/15 text-rose-200" : "border-line text-mist-200 hover:bg-white/[0.06]")}><Radio className={cn("size-4", live && "animate-pulse")} /> {live ? "Live" : "Go live"}</button>
          <button onClick={() => load()} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-mist-200 hover:bg-white/[0.06]"><RefreshCw className="size-4" /> Refresh</button>
          <button onClick={exportCsv} disabled={!report?.rows.length} className="inline-flex items-center gap-1.5 rounded-lg bg-lotus-600 px-3 py-2 text-sm font-semibold text-white hover:bg-lotus-500 disabled:opacity-50"><Download className="size-4" /> Export (Excel/CSV)</button>
        </div>
      </div>

      {loading || !report ? (
        <Card className="p-10 text-center text-sm text-mist-400">Loading…</Card>
      ) : (
        <>
          {/* Real-time monitoring — live presence (a REAL signal, not an estimate). */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="flex items-center gap-3 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300"><Radio className={cn("size-5", live && "animate-pulse")} /></span>
              <div><div className="font-display text-2xl font-extrabold text-mist-100">{report.liveNow.online}</div><div className="text-[11px] text-mist-400">Online right now{live ? " · live" : ""}</div></div>
            </Card>
            <Card className="flex items-center gap-3 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lotus-500/15 text-lotus-300"><Radio className="size-5" /></span>
              <div><div className="font-display text-2xl font-extrabold text-mist-100">{report.liveNow.inRoom}</div><div className="text-[11px] text-mist-400">In a voice room now</div></div>
            </Card>
            <Card className="flex items-center gap-3 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-500/15 text-sky-300"><Users className="size-5" /></span>
              <div><div className="font-display text-2xl font-extrabold text-mist-100">{report.liveNow.total}</div><div className="text-[11px] text-mist-400">Total members</div></div>
            </Card>
          </div>

          {/* ── THE ANSWER, UP FRONT ─────────────────────────────────────────
              One line that says how much data was used, over what period, by
              how many people — in MB *and* GB so nothing needs converting. */}
          <Card className="p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-mist-500">Total data used · {rangeText}</p>
                <p className="mt-1 font-display text-4xl font-extrabold text-mist-100">{fmtMbGb(report.totalMb)}</p>
                <p className="mt-1 text-sm text-mist-400">
                  {report.rows.length} {report.rows.length === 1 ? "member" : "members"} used data ·
                  average <b className="text-mist-200">{fmtMb(report.rows.length ? report.totalMb / report.rows.length : 0)}</b> each
                </p>
              </div>
              <div className="flex flex-wrap gap-5 text-right">
                <div><div className="text-2xl font-extrabold text-mist-100">{fmtMin(totalVoiceTime)}</div><div className="text-[11px] text-mist-400">voice time</div></div>
                <div><div className="text-2xl font-extrabold text-mist-100">{fmtMin(totalAppTime)}</div><div className="text-[11px] text-mist-400">app time</div></div>
                {peakHour && peakHour.minutes > 0 && (
                  <div><div className="text-2xl font-extrabold text-mist-100">{String(peakHour.hour).padStart(2, "0")}:00</div><div className="text-[11px] text-mist-400">busiest hour</div></div>
                )}
              </div>
            </div>
          </Card>

          {/* Focused on one member — every view below is just them. */}
          {focusUser && (
            <Card className="flex flex-wrap items-center justify-between gap-3 border-lotus-400/30 bg-lotus-500/[0.07] p-3.5">
              <p className="text-sm text-mist-200">
                Showing <b className="text-lotus-200">{focusUser.name}</b> only — the totals, per-day and per-hour views are all for this member.
              </p>
              <button onClick={() => setFocusUser(null)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-mist-200 hover:bg-white/[0.06]">Show everyone</button>
            </Card>
          )}

          {/* View switcher + filters — the "simple options" the client asked for. */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex overflow-hidden rounded-xl border border-line text-sm">
              {([["user", "Per user"], ["day", "Per day"], ["hour", "Per hour"]] as const).map(([m, label]) => (
                <button key={m} onClick={() => setMode(m)} className={cn("px-4 py-2 font-semibold transition", mode === m ? "bg-lotus-600 text-white" : "text-mist-300 hover:bg-white/[0.05]")}>{label}</button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="flex items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-2.5 py-1.5 text-mist-300">
                Show only above
                <select value={minMb} onChange={(e) => setMinMb(Number(e.target.value))} className="bg-transparent font-semibold text-mist-100 outline-none">
                  <option value={0}>any</option>
                  <option value={1}>1 MB</option>
                  <option value={10}>10 MB</option>
                  <option value={100}>100 MB</option>
                  <option value={1024}>1 GB</option>
                </select>
              </label>
              <button onClick={() => setOnlyMeasured((v) => !v)} className={cn("rounded-lg border px-2.5 py-1.5 font-semibold transition", onlyMeasured ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200" : "border-line text-mist-300 hover:bg-white/[0.06]")}>
                Measured days only
              </button>
              <button onClick={() => setDetails((v) => !v)} className={cn("rounded-lg border px-2.5 py-1.5 font-semibold transition", details ? "border-lotus-400/50 bg-lotus-500/15 text-lotus-200" : "border-line text-mist-300 hover:bg-white/[0.06]")}>
                {details ? "Hide" : "Show"} how this is calculated
              </button>
            </div>
          </div>

          {/* Honest scope banner: the MB/GB is a modeled estimate, not measured bytes. */}
          {details && (
          <Card className="flex items-start gap-3 border-amber-400/20 bg-amber-500/[0.05] p-3.5">
            <Info className="mt-0.5 size-4 shrink-0 text-amber-300" />
            <p className="text-xs leading-relaxed text-mist-400">
              <b className="text-amber-200">How to read these numbers.</b> The <b className="text-mist-200">minutes</b>, <b className="text-mist-200">per-user</b> breakdown, dates and the <b className="text-mist-200">live counts</b> above are real. The <b className="text-mist-200">MB / GB</b> figures are the app&apos;s <b className="text-mist-200">best estimate</b> (activity-minutes × a per-minute rate), not a byte-for-byte measurement — a phone&apos;s exact data is only known to its own OS. A true <b className="text-mist-200">upload/download split</b> and measured bytes need a separate byte-metering layer (a planned follow-up); until then those specific figures stay modeled.
            </p>
          </Card>
          )}

          {/* Summary + app-wise breakdown */}
          {details && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-mist-200"><PieChart className="size-4 text-lotus-300" /> App-wise data breakdown ({rangeText}) <span className="text-[10px] font-normal text-mist-500">· estimated split</span></p>
              <p className="mb-3 text-3xl font-extrabold text-mist-100">{fmtMb(report.totalMb)} <span className="text-sm font-normal text-mist-400">total · {report.rows.length} users</span></p>
              <div className="space-y-2.5">
                {report.appBreakdown.map((c, i) => (
                  <div key={c.category}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-mist-300"><span className={cn("size-2.5 rounded-sm", CAT_COLORS[i])} /> {c.category}</span>
                      <span className="tabular-nums text-mist-400">{fmtMb(c.mb)} · {c.pct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-ink-800">
                      <div className={cn("h-full rounded-full", CAT_COLORS[i])} style={{ width: `${c.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Hour-by-hour usage distribution */}
            <Card className="p-4">
              <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-mist-200"><Clock className="size-4 text-amber-300" /> Time-of-day usage (when spikes happen)</p>
              <p className="mb-3 text-xs text-mist-400">Voice-room minutes by hour (UTC){peakHour ? ` · busiest hour: ${String(peakHour.hour).padStart(2, "0")}:00` : ""}</p>
              <div className="flex h-32 items-end gap-[3px]">
                {report.hourly.map((h) => (
                  <div key={h.hour} className="group relative flex flex-1 flex-col items-center justify-end" title={`${String(h.hour).padStart(2, "0")}:00 — ${fmtMin(h.minutes)}`}>
                    <div className={cn("w-full rounded-t", h.minutes >= maxHour * 0.8 ? "bg-rose-400" : h.minutes >= maxHour * 0.4 ? "bg-amber-400" : "bg-sky-500/70")} style={{ height: `${Math.max(2, (h.minutes / maxHour) * 100)}%` }} />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[9px] text-mist-600"><span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>23h</span></div>
            </Card>
          </div>
          )}

          {/* ── PER HOUR ─────────────────────────────────────────────────── */}
          {mode === "hour" && (
            <Card className="p-4">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-mist-200"><Clock className="size-4 text-amber-300" /> Data used per hour of the day ({rangeText})</p>
                  <p className="text-xs text-mist-400">
                    {report.hoursMeasured
                      ? "Measured from real activity minutes, added up across every day in the range."
                      : "No per-hour records exist for this range yet — hour tracking starts from this update, so pick a range that includes today once data builds up."}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const header = ["Hour", "App minutes", "Voice minutes", "Data (MB)"];
                    const lines = report.hours.map((h) => [hourLabel(h.hour), String(h.appMin), String(h.voiceMin), h.mb.toFixed(2)]);
                    const csv = [header, ...lines].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                    a.download = `data-usage-per-hour-${report.from}_to_${report.to}.csv`;
                    a.click();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs text-mist-200 hover:bg-white/[0.06]"
                ><Download className="size-3.5" /> Export hours</button>
              </div>
              {!report.hoursMeasured ? (
                <p className="py-8 text-center text-sm text-mist-400">Nothing recorded per hour for this period yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs text-mist-400">
                        <th className="py-2 pr-3 font-semibold">Hour</th>
                        <th className="px-2 py-2 text-right font-semibold">App time</th>
                        <th className="px-2 py-2 text-right font-semibold">Voice time</th>
                        <th className="px-2 py-2 text-right font-semibold">Data</th>
                        <th className="py-2 pl-2 font-semibold">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.hours.filter((h) => h.appMin > 0).map((h) => {
                        const top = Math.max(1, ...report.hours.map((x) => x.mb));
                        return (
                          <tr key={h.hour} className="border-b border-line/60">
                            <td className="py-2 pr-3 font-medium text-mist-200">{hourLabel(h.hour)}</td>
                            <td className="px-2 py-2 text-right tabular-nums text-mist-400">{fmtMin(h.appMin)}</td>
                            <td className="px-2 py-2 text-right tabular-nums text-mist-400">{fmtMin(h.voiceMin)}</td>
                            <td className="px-2 py-2 text-right font-bold tabular-nums text-lotus-200">{fmtMb(h.mb)}</td>
                            <td className="py-2 pl-2">
                              <div className="h-2 w-full min-w-[80px] overflow-hidden rounded-full bg-ink-800">
                                <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-rose-400" style={{ width: `${Math.max(2, (h.mb / top) * 100)}%` }} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* Time usage per user */}
          {mode === "user" && (
          <Card className="p-4">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-mist-200"><Clock className="size-4 text-sky-300" /> Time usage per user ({rangeText})</p>
                <p className="text-xs text-mist-400">How long each user spent in the app and in voice rooms.</p>
              </div>
              <div className="flex gap-5 text-right">
                <div><div className="text-xl font-extrabold text-mist-100">{fmtMin(totalVoiceTime)}</div><div className="text-[11px] text-mist-400">total voice time</div></div>
                <div><div className="text-xl font-extrabold text-mist-100">{fmtMin(totalAppTime)}</div><div className="text-[11px] text-mist-400">total app time</div></div>
              </div>
            </div>
            <div className="space-y-2">
              {usersByTime.slice(0, 15).map((u) => {
                const total = u.totalAppMin + u.totalVoiceMin;
                return (
                  <div key={u.id}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-mist-200">{u.name}</span>
                      <span className="shrink-0 tabular-nums text-mist-400">{fmtMin(u.totalVoiceMin)} voice · {fmtMin(u.totalAppMin)} app</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-ink-800">
                      <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-lotus-500" style={{ width: `${(total / maxUserTime) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
          )}

          {/* Timeline graph — per day / per week */}
          {mode === "day" && (
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold text-mist-200"><BarChart3 className="size-4 text-emerald-300" /> Usage timeline</p>
              <div className="flex overflow-hidden rounded-lg border border-line text-xs">
                <button onClick={() => setView("day")} className={cn("px-3 py-1.5", view === "day" ? "bg-lotus-600 text-white" : "text-mist-300 hover:bg-white/[0.05]")}>Per day</button>
                <button onClick={() => setView("week")} className={cn("px-3 py-1.5", view === "week" ? "bg-lotus-600 text-white" : "text-mist-300 hover:bg-white/[0.05]")}>Per week</button>
                <button onClick={() => setView("month")} className={cn("px-3 py-1.5", view === "month" ? "bg-lotus-600 text-white" : "text-mist-300 hover:bg-white/[0.05]")}>Per month</button>
              </div>
            </div>
            <div className="flex h-44 items-end gap-2">
              {timeline.map((t) => (
                <div key={t.key} className="group flex flex-1 flex-col items-center justify-end" title={`${t.label}: ${fmtMb(t.mb)}`}>
                  <span className="mb-1 text-[10px] tabular-nums text-mist-400 opacity-0 group-hover:opacity-100">{fmtMb(t.mb)}</span>
                  <div className="w-full rounded-t bg-gradient-to-t from-lotus-700 to-lotus-400" style={{ height: `${Math.max(2, (t.mb / maxBar) * 100)}%` }} />
                  <span className="mt-1 text-[10px] text-mist-500">{t.label}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-300/80"><TrendingDown className="size-3.5" /> Bars should drop sharply after the optimization update as new days are measured at the lower rate.</p>
            {/* Plain per-day table under the chart — a chart alone isn't a report. */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[360px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-mist-400">
                    <th className="py-2 pr-3 font-semibold">{view === "day" ? "Date" : view === "week" ? "Week" : "Month"}</th>
                    <th className="py-2 pl-2 text-right font-semibold">Data used</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.map((t) => (
                    <tr key={t.key} className="border-b border-line/60">
                      <td className="py-2 pr-3 text-mist-200">{t.label}</td>
                      <td className="py-2 pl-2 text-right font-bold tabular-nums text-lotus-200">{fmtMb(t.mb)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          )}

          {/* Per-user table */}
          {mode === "user" && (
          <Card className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-mist-200">Data used by each member ({rangeText})</p>
                <p className="text-xs text-mist-400">
                  Showing <b className="text-mist-200">{shownRows.length}</b> of {report.rows.length} · daily columns are MB ·
                  <span className="italic text-amber-200/90"> amber = estimated</span>, <span className="text-emerald-200/90">green = measured</span> · hover a cell for the minutes
                </p>
              </div>
              <TableSearch value={q} onChange={setQ} placeholder="Search a member by name, @username or ID…" className="w-72" />
            </div>
            {!shownRows.length ? (
              <p className="py-8 text-center text-sm text-mist-400">{report.rows.length ? "No members match this search or filter." : "No usage recorded."}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-mist-400">
                      <SortTh col="user" sort={sort} dir={dir} onSort={sortRows} className="py-2 pr-3">User</SortTh>
                      {report.dates.map((d) => <th key={d} className="px-2 py-2 text-right tabular-nums">{d.slice(5)}</th>)}
                      <SortTh col="app" sort={sort} dir={dir} onSort={sortRows} className="px-2 py-2" align="right">App</SortTh>
                      <SortTh col="voice" sort={sort} dir={dir} onSort={sortRows} className="px-2 py-2" align="right">Voice</SortTh>
                      <SortTh col="total" sort={sort} dir={dir} onSort={sortRows} className="py-2 pl-2" align="right">Total</SortTh>
                    </tr>
                  </thead>
                  <tbody>
                    {shownRows.map((r) => (
                      <tr key={r.id} className="border-b border-line/60">
                        <td className="py-2 pr-3"><UserLink name={r.name} publicId={r.publicId} userId={r.id} username={r.username} showId={false} /><div className="text-xs text-mist-500">@{r.username}</div></td>
                        {r.days.map((d) => (
                          <td key={d.date} title={`${d.date}: ${d.voiceMin}m voice, ${d.appMin}m app → ${fmtMb(d.mb)} (${d.source})`} className={cn("px-2 py-2 text-right tabular-nums", d.mb > 0 ? (d.source === "estimated" ? "italic text-amber-200/90" : "text-emerald-200/90") : "text-mist-600")}>
                            {d.mb > 0 ? d.mb.toFixed(0) : "·"}
                          </td>
                        ))}
                        <td className="px-2 py-2 text-right tabular-nums text-mist-400">{fmtMin(r.totalAppMin)}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-mist-400">{fmtMin(r.totalVoiceMin)}</td>
                        <td className="py-2 pl-2 text-right font-bold tabular-nums text-lotus-200">
                          <button onClick={() => setFocusUser({ id: r.id, name: r.name })} title={`Show only ${r.name} — in every view`} className="hover:underline">
                            {fmtMb(r.totalMb)}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          )}

          <Card className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-mist-200">Usage history by date ({rangeText})</p>
                <p className="text-xs text-mist-400">Complete per-user records across the selected range.</p>
              </div>
              <TableSearch value={recordsQ} onChange={setRecordsQ} placeholder="Search date, member, username, ID…" className="w-80" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-mist-400">
                    <SortTh col="date" sort={recordsSort} dir={recordsDir} onSort={sortRecords} className="px-4 py-2">Date</SortTh>
                    <SortTh col="user" sort={recordsSort} dir={recordsDir} onSort={sortRecords} className="px-3 py-2">User</SortTh>
                    <SortTh col="app" sort={recordsSort} dir={recordsDir} onSort={sortRecords} className="px-2 py-2" align="right">App</SortTh>
                    <SortTh col="voice" sort={recordsSort} dir={recordsDir} onSort={sortRecords} className="px-2 py-2" align="right">Voice</SortTh>
                    <SortTh col="mb" sort={recordsSort} dir={recordsDir} onSort={sortRecords} className="px-2 py-2" align="right">Data</SortTh>
                    <SortTh col="source" sort={recordsSort} dir={recordsDir} onSort={sortRecords} className="px-4 py-2 text-right" align="right">Type</SortTh>
                  </tr>
                </thead>
                <tbody>
                  {shownRecords.map((r) => (
                    <tr key={`${r.userId}:${r.date}:${r.mb}:${r.appMin}:${r.voiceMin}`} className="border-b border-line/60">
                      <td className="px-4 py-2 text-mist-300">{r.date}</td>
                      <td className="px-3 py-2">
                        <UserLink name={r.userName} publicId={r.publicId} userId={r.userId} username={r.username} showId={false} />
                        <div className="text-xs text-mist-500">@{r.username}{r.publicId ? <span className="ml-1.5 font-mono">ID {r.publicId}</span> : null}</div>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-mist-400">{fmtMin(r.appMin)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-mist-400">{fmtMin(r.voiceMin)}</td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums text-lotus-200">{fmtMb(r.mb)}</td>
                      <td className={cn("px-4 py-2 text-right text-xs font-semibold uppercase", r.source === "measured" ? "text-emerald-300" : "text-amber-300")}>{r.source}</td>
                    </tr>
                  ))}
                  {!shownRecords.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-mist-500">No usage records found for this range/filter.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <p className="px-1 text-[11px] text-mist-500">
            Note: a phone&apos;s exact mobile data is only known to its OS. The <b>minutes</b> here are from real activity records; the <b>MB/GB</b> is the app&apos;s best estimate
            (pre-fix ~{report.preVoiceRate} MB/voice-min). Per-day figures are MB. Tracking is exact (&quot;measured&quot;) from the optimization update onward.
          </p>
        </>
      )}
    </div>
  );
}
