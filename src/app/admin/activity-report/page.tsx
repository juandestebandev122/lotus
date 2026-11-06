"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { downloadCsv, downloadExcel, printPage } from "@/lib/statement-export";
import { Clock, Search, Download, FileSpreadsheet, Printer, Loader2, RefreshCw, Users2, Flower2, Timer, Mic } from "lucide-react";
import { UserLink, TableSearch, SortTh, applyFilterSort, type SortDir } from "@/components/admin/TableControls";

/**
 * ACTIVITY TIME & REWARD REPORT.
 *
 * Answers the two questions the client actually asked: how many hours does each
 * user spend in the app, and how much Lotus did they receive for that time.
 *
 * Neither number is estimated — the minutes come from the app's own ~60s
 * heartbeat and the rewards come from the transaction ledger, so a figure here
 * can always be traced back to a real record.
 */

interface Row {
  id: string; name: string; username: string; publicId?: string; agency?: string;
  appMin: number; voiceMin: number; hours: number; voiceHours: number;
  activeDays: number; avgMinPerDay: number;
  rewards: number; lotus: number; coins: number;
  lotusPerHour: number; coinsPerHour: number;
  lastActive?: string;
}
interface Report {
  rows: Row[]; from: string; to: string;
  records: { date: string; userId: string; userName: string; username: string; publicId?: string; agency?: string; appMin: number; voiceMin: number; rewards: number; lotus: number; coins: number }[];
  daily: { date: string; minutes: number; lotus: number; coins: number; rewards: number }[];
  totals: { users: number; hours: number; voiceHours: number; lotus: number; coins: number; rewards: number; lotusPerHour: number };
  rule: { enabled: boolean; name: string; requiredMinutes: number; continuousCoins: number; accumulatedCoins: number; gapMinutes: number; dailyLimit: number; maxPerUser: number };
  lotusOn: boolean; lotusName: string;
}

type SortKey = "hours" | "voice" | "lotus" | "perHour" | "rewards" | "days";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

/** 95 → "1h 35m" — hours are what the client reads, not raw minutes. */
function hm(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export default function ActivityReportPage() {
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(iso(new Date()));
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("hours");
  const [recordsQ, setRecordsQ] = useState("");
  const [recordsSort, setRecordsSort] = useState("date");
  const [recordsDir, setRecordsDir] = useState<SortDir>("desc");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(withBase(`/api/admin/activity-report?from=${from}&to=${to}`), { credentials: "include", cache: "no-store" });
      const d = await r.json();
      if (r.ok) setData(d as Report);
    } catch { /* leave the previous data on screen */ }
    setLoading(false);
  }, [from, to]);
  useEffect(() => { void load(); }, [load]);

  const preset = (days: number) => { setFrom(daysAgo(days)); setTo(iso(new Date())); };

  const rows = useMemo(() => {
    const list = (data?.rows ?? []).filter((r) => {
      const term = q.trim().toLowerCase();
      if (!term) return true;
      return `${r.name} ${r.username} ${r.publicId ?? ""} ${r.agency ?? ""}`.toLowerCase().includes(term);
    });
    const by: Record<SortKey, (a: Row, b: Row) => number> = {
      hours: (a, b) => b.appMin - a.appMin,
      voice: (a, b) => b.voiceMin - a.voiceMin,
      lotus: (a, b) => b.lotus - a.lotus,
      perHour: (a, b) => b.lotusPerHour - a.lotusPerHour,
      rewards: (a, b) => b.rewards - a.rewards,
      days: (a, b) => b.activeDays - a.activeDays,
    };
    return [...list].sort(by[sort]);
  }, [data, q, sort]);

  const unit = data?.lotusOn ? (data?.lotusName ?? "Lotus") : "coins";
  const sortRecords = (col: string) => {
    if (col === recordsSort) setRecordsDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setRecordsSort(col); setRecordsDir(col === "date" ? "desc" : "asc"); }
  };
  const recordsRows = useMemo(() => applyFilterSort(data?.records ?? [], {
    q: recordsQ,
    sort: recordsSort,
    dir: recordsDir,
    searchText: (r) => `${r.userName} ${r.username} ${r.publicId ?? ""} ${r.agency ?? ""} ${r.date}`,
    sortKeys: {
      date: (r) => r.date,
      user: (r) => r.userName,
      agency: (r) => r.agency ?? "",
      app: (r) => r.appMin,
      voice: (r) => r.voiceMin,
      rewards: (r) => r.rewards,
      unit: (r) => (data?.lotusOn ? r.lotus : r.coins),
    },
  }), [data, recordsQ, recordsSort, recordsDir]);

  // ---- Exports: the same rows that are on screen, in the order shown ----
  const HEADERS = ["User", "ID No.", "Username", "Agency", "Hours in app", "Minutes in app", "Voice-room hours", "Active days", "Avg min/day", "Rewards paid", `${unit} earned`, `${unit} per hour`, "Last active"];
  const exportRows = () => rows.map((r) => [
    r.name, r.publicId ?? "", r.username, r.agency ?? "",
    r.hours, r.appMin, r.voiceHours, r.activeDays, r.avgMinPerDay,
    r.rewards, data?.lotusOn ? r.lotus : r.coins, data?.lotusOn ? r.lotusPerHour : r.coinsPerHour,
    r.lastActive ?? "",
  ] as (string | number)[]);
  const stamp = `${data?.from ?? from}_to_${data?.to ?? to}`;

  return (
    <div className="space-y-5">
      {/* ===== Header ===== */}
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
            <Clock className="size-6 text-lotus-300" /> Activity Time &amp; Rewards
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-mist-400">
            How long each member spends in the app, and how much {unit} the Activity Reward paid them
            for that time. Minutes are <b className="text-mist-200">measured</b> by the app&rsquo;s own
            heartbeat; rewards are read straight from the <b className="text-mist-200">transaction ledger</b>.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Refresh
          </Button>
          <Button variant="secondary" onClick={() => downloadCsv(`activity-report_${stamp}`, HEADERS, exportRows())}><Download className="size-4" /> CSV</Button>
          <Button variant="secondary" onClick={() => downloadExcel(`activity-report_${stamp}`, "Activity", HEADERS, exportRows())}><FileSpreadsheet className="size-4" /> Excel</Button>
          <Button variant="secondary" onClick={printPage}><Printer className="size-4" /> Print / PDF</Button>
        </div>
      </div>

      {/* ===== Range + search ===== */}
      <Card className="p-4 print:hidden">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-mist-300">From</span>
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-10 rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400/50" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-mist-300">To</span>
            <input type="date" value={to} min={from} max={iso(new Date())} onChange={(e) => setTo(e.target.value)} className="h-10 rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400/50" />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {([["Today", 0], ["7 days", 6], ["30 days", 29], ["90 days", 89], ["1 year", 364]] as const).map(([label, d]) => (
              <button key={label} onClick={() => preset(d)} className="rounded-lg border border-line bg-ink-800 px-3 py-2 text-xs font-semibold text-mist-300 transition hover:border-lotus-400/40 hover:text-mist-100">{label}</button>
            ))}
          </div>
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mist-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, ID number, username or agency…"
              className="h-10 w-full rounded-lg border border-line bg-ink-800 pl-9 pr-3 text-sm text-mist-100 outline-none placeholder:text-mist-500 focus:border-lotus-400/50"
            />
          </div>
        </div>
      </Card>

      {/* ===== The rule these numbers came from ===== */}
      {data && (
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-mist-300">
            <span className={cn("rounded-full px-2.5 py-1 font-bold", data.rule.enabled ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300")}>
              {data.rule.name}: {data.rule.enabled ? "ON" : "OFF"}
            </span>
            <span>Every <b className="text-mist-100">{data.rule.requiredMinutes} min</b> of activity pays</span>
            <span><b className="text-mist-100">{data.rule.continuousCoins}</b> coins continuous</span>
            <span>or <b className="text-mist-100">{data.rule.accumulatedCoins}</b> accumulated</span>
            <span>· break over <b className="text-mist-100">{data.rule.gapMinutes} min</b> ends a run</span>
            <span>· daily limit <b className="text-mist-100">{data.rule.dailyLimit || "none"}</b></span>
            <span>· lifetime cap <b className="text-mist-100">{data.rule.maxPerUser || "none"}</b></span>
            {data.lotusOn && <span className="rounded-full bg-lotus-500/15 px-2.5 py-1 font-bold text-lotus-200">Paid as {data.lotusName}</span>}
          </div>
        </Card>
      )}

      {/* ===== Totals ===== */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat icon={Users2} label="Members with activity" value={data ? String(data.totals.users) : "—"} />
        <Stat icon={Timer} label="Total hours in app" value={data ? `${data.totals.hours.toLocaleString("en-SA")} h` : "—"} />
        <Stat icon={Mic} label="Of which in voice rooms" value={data ? `${data.totals.voiceHours.toLocaleString("en-SA")} h` : "—"} />
        <Stat icon={Flower2} label={`Total ${unit} paid`} value={data ? (data.lotusOn ? data.totals.lotus : data.totals.coins).toLocaleString("en-SA") : "—"} />
        <Stat icon={Clock} label={`${unit} per hour (average)`} value={data ? String(data.totals.lotusPerHour || 0) : "—"} />
      </div>

      {/* ===== Per-user table ===== */}
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 print:hidden">
          <h2 className="text-sm font-bold text-mist-100">Per member — {rows.length} row{rows.length === 1 ? "" : "s"}</h2>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-mist-500">Sort by</span>
            {([["hours", "Hours"], ["voice", "Voice"], ["lotus", unit], ["perHour", `${unit}/hour`], ["rewards", "Rewards"], ["days", "Active days"]] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setSort(k as SortKey)}
                className={cn("rounded-lg px-2.5 py-1 text-[11px] font-semibold transition", sort === k ? "bg-lotus-500/20 text-lotus-200" : "text-mist-400 hover:text-mist-100")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-mist-500">
                <th className="px-4 py-2.5 font-semibold">Member</th>
                <th className="px-3 py-2.5 text-right font-semibold">Time in app</th>
                <th className="px-3 py-2.5 text-right font-semibold">In voice</th>
                <th className="px-3 py-2.5 text-right font-semibold">Active days</th>
                <th className="px-3 py-2.5 text-right font-semibold">Avg / day</th>
                <th className="px-3 py-2.5 text-right font-semibold">Rewards</th>
                <th className="px-3 py-2.5 text-right font-semibold">{unit} earned</th>
                <th className="px-3 py-2.5 text-right font-semibold">{unit} / hour</th>
                <th className="px-4 py-2.5 text-right font-semibold">Last active</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2.5">
                    {/* Name + permanent ID number — names repeat, IDs don't. */}
                    <div className="font-semibold text-mist-100">{r.name}</div>
                    <div className="text-[11px] text-mist-500">
                      @{r.username}
                      {r.publicId && <span className="ml-1.5 font-mono">ID {r.publicId}</span>}
                      {r.agency && <span className="ml-1.5">· {r.agency}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="font-semibold text-mist-100">{r.hours} h</div>
                    <div className="text-[10px] text-mist-500">{hm(r.appMin)}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right text-mist-300">{r.voiceHours} h</td>
                  <td className="px-3 py-2.5 text-right text-mist-300">{r.activeDays}</td>
                  <td className="px-3 py-2.5 text-right text-mist-300">{hm(r.avgMinPerDay)}</td>
                  <td className="px-3 py-2.5 text-right text-mist-300">{r.rewards}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-lotus-200">
                    {(data?.lotusOn ? r.lotus : r.coins).toLocaleString("en-SA")}
                  </td>
                  <td className="px-3 py-2.5 text-right text-mist-300">{data?.lotusOn ? r.lotusPerHour : r.coinsPerHour}</td>
                  <td className="px-4 py-2.5 text-right text-[11px] text-mist-500">{r.lastActive ?? "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-mist-500">
                    {loading ? "Loading…" : "No activity recorded in this range."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ===== Day-by-day totals ===== */}
      {data && data.daily.some((d) => d.minutes > 0 || d.rewards > 0) && (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-bold text-mist-100">Day by day — everyone together</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-mist-500">
                  <th className="px-4 py-2.5 font-semibold">Date</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Total time</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Rewards paid</th>
                  <th className="px-4 py-2.5 text-right font-semibold">{unit}</th>
                </tr>
              </thead>
              <tbody>
                {data.daily.filter((d) => d.minutes > 0 || d.rewards > 0).reverse().map((d) => (
                  <tr key={d.date} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-2 text-mist-200">{d.date}</td>
                    <td className="px-3 py-2 text-right text-mist-300">{hm(d.minutes)}</td>
                    <td className="px-3 py-2 text-right text-mist-300">{d.rewards}</td>
                    <td className="px-4 py-2 text-right font-semibold text-lotus-200">{(data.lotusOn ? d.lotus : d.coins).toLocaleString("en-SA")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ===== Complete per-user records ===== */}
      {data && (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h2 className="text-sm font-bold text-mist-100">Complete activity records — {recordsRows.length} row{recordsRows.length === 1 ? "" : "s"}</h2>
            <TableSearch value={recordsQ} onChange={setRecordsQ} placeholder="Search date, member, username, ID or agency…" className="w-80" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-mist-500">
                  <SortTh col="date" sort={recordsSort} dir={recordsDir} onSort={sortRecords} className="px-4 py-2.5">Date</SortTh>
                  <SortTh col="user" sort={recordsSort} dir={recordsDir} onSort={sortRecords} className="px-3 py-2.5">Member</SortTh>
                  <SortTh col="agency" sort={recordsSort} dir={recordsDir} onSort={sortRecords} className="px-3 py-2.5">Agency</SortTh>
                  <SortTh col="app" sort={recordsSort} dir={recordsDir} onSort={sortRecords} className="px-3 py-2.5" align="right">App time</SortTh>
                  <SortTh col="voice" sort={recordsSort} dir={recordsDir} onSort={sortRecords} className="px-3 py-2.5" align="right">Voice time</SortTh>
                  <SortTh col="rewards" sort={recordsSort} dir={recordsDir} onSort={sortRecords} className="px-3 py-2.5" align="right">Rewards</SortTh>
                  <SortTh col="unit" sort={recordsSort} dir={recordsDir} onSort={sortRecords} className="px-4 py-2.5" align="right">{unit}</SortTh>
                </tr>
              </thead>
              <tbody>
                {recordsRows.map((r) => (
                  <tr key={`${r.userId}:${r.date}:${r.appMin}:${r.voiceMin}:${r.rewards}`} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-2.5 text-mist-300">{r.date}</td>
                    <td className="px-3 py-2.5">
                      <UserLink name={r.userName} publicId={r.publicId} userId={r.userId} username={r.username} showId={false} />
                      <div className="text-[11px] text-mist-500">@{r.username}{r.publicId ? <span className="ml-1.5 font-mono">ID {r.publicId}</span> : null}</div>
                    </td>
                    <td className="px-3 py-2.5 text-mist-400">{r.agency ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right text-mist-300">{hm(r.appMin)}</td>
                    <td className="px-3 py-2.5 text-right text-mist-300">{hm(r.voiceMin)}</td>
                    <td className="px-3 py-2.5 text-right text-mist-300">{r.rewards}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-lotus-200">{(data.lotusOn ? r.lotus : r.coins).toLocaleString("en-SA")}</td>
                  </tr>
                ))}
                {recordsRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-mist-500">No activity records found for this range/filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="text-[11px] text-mist-600 print:hidden">
        Time is counted one minute at a time while the app is open, so a member who leaves the app
        running in the background but never touches it does not earn reward time (Inactivity
        Detection). Voice-room minutes always count as real participation.
      </p>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-mist-500">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className="mt-1.5 font-display text-2xl font-extrabold text-mist-100">{value}</div>
    </Card>
  );
}
