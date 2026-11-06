"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { Crown, Phone, Video, Clock, Coins, Users, RefreshCw, Download, ArrowUpDown } from "lucide-react";

interface Row {
  userId: string;
  username: string;
  name: string;
  audioSec: number;
  videoSec: number;
  totalSec: number;
  coins: number;
  calls: number;
}

type RangeKey = "today" | "yesterday" | "7d" | "30d" | "custom";
type SortKey = "totalSec" | "audioSec" | "videoSec" | "coins" | "calls";

// seconds → "1h 23m" / "5m 12s" / "0s"
function fmtDur(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${ss}s`;
  return `${ss}s`;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

export default function AdminUserAnalyticsPage() {
  const [range, setRange] = useState<RangeKey>("7d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("totalSec");

  // Resolve the selected range into a concrete from/to window.
  const window = useMemo(() => {
    const now = new Date();
    if (range === "today") return { from: startOfDay(now), to: now };
    if (range === "yesterday") { const y = new Date(now.getTime() - 86400000); return { from: startOfDay(y), to: endOfDay(y) }; }
    if (range === "7d") return { from: new Date(now.getTime() - 7 * 86400000), to: now };
    if (range === "30d") return { from: new Date(now.getTime() - 30 * 86400000), to: now };
    // custom
    const f = from ? startOfDay(new Date(from)) : new Date(now.getTime() - 30 * 86400000);
    const t = to ? endOfDay(new Date(to)) : now;
    return { from: f, to: t };
  }, [range, from, to]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = `from=${encodeURIComponent(window.from.toISOString())}&to=${encodeURIComponent(window.to.toISOString())}`;
      const res = await fetch(withBase(`/api/admin/user-analytics?${qs}`), { credentials: "include", cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      setRows(Array.isArray(d.rows) ? d.rows : []);
    } catch {
      setRows([]);
    }
    setLoading(false);
  }, [window]);

  useEffect(() => { load(); }, [load]);

  const sorted = useMemo(() => [...rows].sort((a, b) => (b[sort] as number) - (a[sort] as number)), [rows, sort]);

  const totals = useMemo(() => rows.reduce((acc, r) => ({
    users: acc.users + 1, audio: acc.audio + r.audioSec, video: acc.video + r.videoSec, total: acc.total + r.totalSec, coins: acc.coins + r.coins, calls: acc.calls + r.calls,
  }), { users: 0, audio: 0, video: 0, total: 0, coins: 0, calls: 0 }), [rows]);

  const exportCsv = () => {
    const head = ["Rank", "User ID", "Username", "Name", "Audio (sec)", "Video (sec)", "Total speaking (sec)", "Coins spent", "Calls"];
    const lines = sorted.map((r, i) => [i + 1, r.userId, r.username, r.name, r.audioSec, r.videoSec, r.totalSec, r.coins, r.calls].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [head.join(","), ...lines].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `user-call-analytics-${range}.csv`;
    a.click();
  };

  const RANGES: [RangeKey, string][] = [["today", "Today"], ["yesterday", "Yesterday"], ["7d", "Last 7 days"], ["30d", "Last 30 days"], ["custom", "Custom range"]];
  const inputCls = "h-9 rounded-lg border border-line bg-ink-800 px-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400";

  const SortTh = ({ k, label, icon: Icon }: { k: SortKey; label: string; icon: typeof Clock }) => (
    <th className="px-4 py-3 font-semibold">
      <button onClick={() => setSort(k)} className={cn("inline-flex items-center gap-1 transition", sort === k ? "text-lotus-200" : "hover:text-mist-200")}>
        <Icon className="size-3.5" /> {label} {sort === k ? <ArrowUpDown className="size-3 text-lotus-300" /> : null}
      </button>
    </th>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-mist-100">User Analytics — most active callers</h1>
          <p className="text-sm text-mist-400">Who spends the most time on Paid Zone calls. Speaking time = total audio + video call duration. Sorted by most active.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-3 py-2 text-sm font-semibold text-mist-200 hover:text-mist-100"><RefreshCw className="size-4" /> Refresh</button>
          <button onClick={exportCsv} disabled={!sorted.length} className="inline-flex items-center gap-1.5 rounded-lg bg-lotus-600 px-3 py-2 text-sm font-semibold text-white hover:bg-lotus-500 disabled:opacity-50"><Download className="size-4" /> CSV</button>
        </div>
      </div>

      {/* Date filters */}
      <Card className="flex flex-wrap items-center gap-2 p-4">
        {RANGES.map(([k, label]) => (
          <button key={k} onClick={() => setRange(k)} className={cn("rounded-full px-3.5 py-1.5 text-sm font-semibold transition", range === k ? "bg-lotus-600 text-white" : "border border-line bg-ink-800 text-mist-400 hover:text-mist-100")}>{label}</button>
        ))}
        {range === "custom" && (
          <div className="ml-1 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-mist-400">From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} /></label>
            <label className="flex items-center gap-1.5 text-xs text-mist-400">To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} /></label>
          </div>
        )}
      </Card>

      {/* Totals */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Mini icon={Users} tone="text-lotus-300" label="Active users" value={String(totals.users)} />
        <Mini icon={Phone} tone="text-emerald-300" label="Audio time" value={fmtDur(totals.audio)} />
        <Mini icon={Video} tone="text-fuchsia-300" label="Video time" value={fmtDur(totals.video)} />
        <Mini icon={Clock} tone="text-sky-300" label="Total speaking" value={fmtDur(totals.total)} />
        <Mini icon={Coins} tone="text-gold-300" label="Coins spent" value={totals.coins.toLocaleString("en-SA")} />
      </div>

      {/* Report table */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-mist-500">
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">User</th>
                <SortTh k="audioSec" label="Audio" icon={Phone} />
                <SortTh k="videoSec" label="Video" icon={Video} />
                <SortTh k="totalSec" label="Speaking time" icon={Clock} />
                <SortTh k="coins" label="Coins spent" icon={Coins} />
                <SortTh k="calls" label="Calls" icon={Phone} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={r.userId + r.username + i} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3 text-mist-400">
                    {i === 0 ? <span className="inline-flex items-center gap-1 font-bold text-gold-300"><Crown className="size-3.5" /> 1</span> : i + 1}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-mist-100">{r.name}</div>
                    <div className="text-xs text-mist-500">@{r.username} · ID {r.userId}</div>
                  </td>
                  <td className="px-4 py-3 text-emerald-200">{fmtDur(r.audioSec)}</td>
                  <td className="px-4 py-3 text-fuchsia-200">{fmtDur(r.videoSec)}</td>
                  <td className="px-4 py-3 font-bold text-sky-200">{fmtDur(r.totalSec)}</td>
                  <td className="px-4 py-3 font-semibold text-gold-300"><span className="inline-flex items-center gap-1"><Coins className="size-3.5" /> {r.coins.toLocaleString("en-SA")}</span></td>
                  <td className="px-4 py-3 text-mist-200">{r.calls}</td>
                </tr>
              ))}
              {!loading && sorted.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-mist-500">No call activity in this period.</td></tr>
              )}
              {loading && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-mist-400">Loading…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-mist-500">Speaking time counts a call&apos;s duration for <b className="text-mist-400">both</b> people on it; coins spent are charged to the caller. Missed / declined calls are excluded.</p>
    </div>
  );
}

function Mini({ icon: Icon, tone, label, value }: { icon: typeof Clock; tone: string; label: string; value: string }) {
  return (
    <Card className="p-4">
      <Icon className={cn("size-5", tone)} />
      <p className="mt-2 font-display text-xl font-extrabold text-mist-100">{value}</p>
      <p className="text-xs text-mist-500">{label}</p>
    </Card>
  );
}
