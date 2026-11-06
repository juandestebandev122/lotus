"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TableSearch, SortTh, applyFilterSort, type SortDir } from "@/components/admin/TableControls";
import { downloadCsv, downloadExcel } from "@/lib/statement-export";
import { fetchAdminStats, fetchAdminLogs, fetchUserActivityLog, type AdminStats, type AdminLog, type UserActivityLog } from "@/lib/admin";
import { Users, UserCheck, Mic, Gamepad2, Flag, TrendingUp, Activity, ScrollText, Download, FileSpreadsheet } from "lucide-react";

// Columns for the downloadable audit trail. Kept as separate fields (rather than
// one prose line) so the file can be sorted and filtered in Excel.
const LOG_HEADERS = ["Date & time", "Admin", "Admin ID", "Action", "Category", "Room ID", "Match ID", "Reason"];
const logRows = (logs: AdminLog[]): (string | number)[][] =>
  logs.map((l) => [
    l.at ? new Date(l.at).toLocaleString("en-SA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "",
    l.admin ?? "",
    l.adminId ?? "",
    l.action ?? "",
    l.category ?? "",
    l.roomId ?? "",
    l.matchId ?? "",
    l.reason ?? "",
  ]);

const USER_LOG_HEADERS = ["Date & time", "User", "User ID", "Username", "Action", "Kind", "Status", "IP", "Device", "Location"];
const userLogRows = (logs: UserActivityLog[]): (string | number)[][] =>
  logs.map((l) => [
    l.at ? new Date(l.at).toLocaleString("en-SA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "",
    l.user ?? "",
    l.userId ?? "",
    l.username ?? "",
    l.action ?? "",
    l.kind ?? "",
    l.status ?? "",
    l.ip ?? "",
    l.device ?? "",
    l.location ?? "",
  ]);
const when = (at: string) => new Date(at).toLocaleString("en-SA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [userLogs, setUserLogs] = useState<UserActivityLog[]>([]);
  const [userQ, setUserQ] = useState("");
  const [userSort, setUserSort] = useState("when");
  const [userDir, setUserDir] = useState<SortDir>("desc");

  useEffect(() => {
    fetchAdminStats().then(setStats);
    fetchAdminLogs().then(setLogs);
    fetchUserActivityLog().then(setUserLogs);
  }, []);

  const sortUserLog = (col: string) => {
    if (col === userSort) setUserDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setUserSort(col); setUserDir(col === "when" ? "desc" : "asc"); }
  };

  const shownUserLogs = useMemo(() => applyFilterSort(userLogs, {
    q: userQ, sort: userSort, dir: userDir,
    searchText: (l) => [l.user, l.username, l.userId, l.action, l.kind, l.status, l.ip, l.device, l.location, l.at ? new Date(l.at).toLocaleString("en-SA") : ""].filter(Boolean).join(" "),
    sortKeys: {
      when: (l) => new Date(l.at).getTime() || 0,
      user: (l) => l.user ?? "",
      id: (l) => l.userId ?? "",
      username: (l) => l.username ?? "",
      action: (l) => l.action ?? "",
      kind: (l) => l.kind ?? "",
      status: (l) => l.status ?? "",
    },
  }), [userLogs, userQ, userSort, userDir]);

  const tiles = [
    { label: "Total Users", value: stats?.totalUsers, icon: Users, tone: "text-lotus-300" },
    { label: "Online Now", value: stats?.onlineUsers, icon: UserCheck, tone: "text-emerald-300" },
    { label: "Active (24h)", value: stats?.activeUsers24h, icon: Activity, tone: "text-sky-300" },
    { label: "Total Groups / Rooms", value: stats?.totalRooms, icon: Mic, tone: "text-petal-400" },
    { label: "Live Voice Rooms", value: stats?.liveRooms, icon: Mic, tone: "text-rose-300" },
    { label: "Games Played", value: stats?.gamesPlayed, icon: Gamepad2, tone: "text-amber-300" },
    { label: "Pending Reports", value: stats?.pendingReports, icon: Flag, tone: "text-rose-300" },
  ];

  const periods = [
    { label: "Today", value: stats?.newUsersToday },
    { label: "This week", value: stats?.newUsers7d },
    { label: "This month", value: stats?.newUsers30d },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-mist-100">Reports &amp; analytics</h1>
        <p className="text-sm text-mist-400">Live platform metrics, growth trends, admin activity and user activity.</p>
      </div>

      {/* Metric tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="p-5">
            <t.icon className={`size-6 ${t.tone}`} />
            <div className="mt-3 font-display text-2xl font-extrabold text-mist-100">{t.value ?? "—"}</div>
            <div className="text-sm text-mist-400">{t.label}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Growth chart */}
        <Card className="p-6 lg:col-span-2">
          <h2 className="flex items-center gap-2 font-display font-bold text-mist-100">
            <TrendingUp className="size-4 text-lotus-300" /> User growth (last 8 weeks)
          </h2>
          <GrowthBars data={stats?.growth ?? []} />
          <div className="mt-4 grid grid-cols-3 gap-3">
            {periods.map((p) => (
              <div key={p.label} className="rounded-xl bg-white/[0.04] px-3 py-2.5 text-center">
                <div className="font-display text-xl font-bold text-mist-100">+{p.value ?? 0}</div>
                <div className="text-xs text-mist-500">{p.label}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Admin activity log */}
        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-display font-bold text-mist-100">
            <ScrollText className="size-4 text-lotus-300" /> Admin activity log
          </h2>
          {/* DOWNLOAD THE WHOLE LOG. The panel can only show a scrolling window
              of the most recent entries; these buttons export EVERY entry held,
              with the full date and time, so it can be kept and reviewed later. */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-mist-500">{logs.length} action{logs.length === 1 ? "" : "s"} recorded</span>
            <div className="ml-auto flex gap-2">
              <Button
                variant="secondary"
                className="h-8 px-2.5 text-xs"
                disabled={!logs.length}
                onClick={() => downloadCsv(`lotus-admin-activity-${new Date().toISOString().slice(0, 10)}`, LOG_HEADERS, logRows(logs))}
              ><Download className="size-3.5" /> CSV</Button>
              <Button
                variant="secondary"
                className="h-8 px-2.5 text-xs"
                disabled={!logs.length}
                onClick={() => downloadExcel(`lotus-admin-activity-${new Date().toISOString().slice(0, 10)}`, "Admin activity", LOG_HEADERS, logRows(logs))}
              ><FileSpreadsheet className="size-3.5" /> Excel</Button>
            </div>
          </div>
          <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-sm text-mist-500">No admin actions recorded yet.</p>
            ) : (
              logs.map((l) => (
                <div key={l.id} className="rounded-lg border border-line bg-ink-800 px-3 py-2">
                  <p className="text-xs text-mist-200">{l.action}</p>
                  <p className="mt-0.5 text-[10px] text-mist-500">
                    {l.admin}{l.adminId ? ` (ID ${l.adminId})` : ""} · {when(l.at)}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* User activity log — full width, under the admin log. Search matches
            name, ID, username, action and the rest; column headers sort.
            CSV / Excel download the rows currently shown. */}
        <Card className="p-5 lg:col-span-3">
          <h2 className="flex items-center gap-2 font-display font-bold text-mist-100">
            <Activity className="size-4 text-sky-300" /> User activity log
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-mist-500">
              {shownUserLogs.length === userLogs.length
                ? `${userLogs.length} action${userLogs.length === 1 ? "" : "s"} recorded`
                : `${shownUserLogs.length} of ${userLogs.length} actions`}
            </span>
            <TableSearch value={userQ} onChange={setUserQ} placeholder="Search name, ID, username, action…" className="w-full sm:w-72" />
            <div className="ml-auto flex gap-2">
              <Button
                variant="secondary"
                className="h-8 px-2.5 text-xs"
                disabled={!shownUserLogs.length}
                onClick={() => downloadCsv(`lotus-user-activity-${new Date().toISOString().slice(0, 10)}`, USER_LOG_HEADERS, userLogRows(shownUserLogs))}
              ><Download className="size-3.5" /> CSV</Button>
              <Button
                variant="secondary"
                className="h-8 px-2.5 text-xs"
                disabled={!shownUserLogs.length}
                onClick={() => downloadExcel(`lotus-user-activity-${new Date().toISOString().slice(0, 10)}`, "User activity", USER_LOG_HEADERS, userLogRows(shownUserLogs))}
              ><FileSpreadsheet className="size-3.5" /> Excel</Button>
            </div>
          </div>
          <div className="mt-3 max-h-96 overflow-auto rounded-xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-ink-850 text-xs uppercase tracking-wide text-mist-500">
                <tr>
                  <SortTh col="when" sort={userSort} dir={userDir} onSort={sortUserLog}>When</SortTh>
                  <SortTh col="user" sort={userSort} dir={userDir} onSort={sortUserLog}>Name</SortTh>
                  <SortTh col="id" sort={userSort} dir={userDir} onSort={sortUserLog}>ID</SortTh>
                  <SortTh col="username" sort={userSort} dir={userDir} onSort={sortUserLog}>Username</SortTh>
                  <SortTh col="action" sort={userSort} dir={userDir} onSort={sortUserLog}>Action</SortTh>
                  <SortTh col="kind" sort={userSort} dir={userDir} onSort={sortUserLog}>Kind</SortTh>
                  <SortTh col="status" sort={userSort} dir={userDir} onSort={sortUserLog}>Status</SortTh>
                </tr>
              </thead>
              <tbody>
                {shownUserLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-mist-500">
                      {userLogs.length === 0 ? "No user activity recorded yet." : "No activity matches your search."}
                    </td>
                  </tr>
                ) : (
                  shownUserLogs.map((l) => (
                    <tr key={l.id} className="border-t border-line">
                      <td className="whitespace-nowrap px-4 py-2 text-xs text-mist-400">{l.at ? when(l.at) : "—"}</td>
                      <td className="px-4 py-2 text-xs font-semibold text-mist-100">{l.user || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-lotus-300">{l.userId || "—"}</td>
                      <td className="px-4 py-2 text-xs text-mist-300">{l.username || "—"}</td>
                      <td className="px-4 py-2 text-xs text-mist-200">{l.action}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-xs capitalize text-mist-400">{l.kind || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-xs capitalize text-mist-400">{l.status || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function GrowthBars({ data }: { data: number[] }) {
  const max = Math.max(1, ...data);
  return (
    <div className="mt-4 flex h-40 items-end gap-2">
      {(data.length ? data : Array(8).fill(0)).map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t-md bg-gradient-to-t from-lotus-600 to-petal-500 transition-all"
            style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
            title={`${v} new users`}
          />
          <span className="text-[10px] text-mist-600">W{i + 1}</span>
        </div>
      ))}
    </div>
  );
}
