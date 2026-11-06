"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { downloadCsv, downloadExcel, printPage } from "@/lib/statement-export";
import { ReportFilters, matchesReportFilter, emptyReportFilter, type ReportFilter } from "@/components/admin/ReportFilters";
import { Users, Mic, Trash2, UserSquare2, Download, FileSpreadsheet, Printer, RefreshCw, Layers, List } from "lucide-react";

interface Row {
  roomId: string;
  name: string;
  category: string;
  type: string;
  status: "active" | "deleted";
  ownerId: string;
  ownerName: string;
  ownerPublicId: string;
  ownerUsername: string;
  createdAt: string;
  deletedAt: string;
  deletedBy: string;
  reason: string;
  members: number;
}

const fmt = (iso: string) =>
  iso ? new Date(iso).toLocaleString("en-SA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const fmtDay = (iso: string) => (iso ? new Date(iso).toLocaleDateString("en-SA", { day: "numeric", month: "short", year: "numeric" }) : "—");

export default function AdminGroupReportPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState({ active: 0, deleted: 0, creators: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReportFilter>(emptyReportFilter);
  const [status, setStatus] = useState<"all" | "active" | "deleted">("all");
  const [view, setView] = useState<"user" | "group">("user");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(withBase("/api/admin/group-report"), { credentials: "include", cache: "no-store" });
      const d = await res.json();
      setRows(d?.rows ?? []);
      setTotals(d?.totals ?? { active: 0, deleted: 0, creators: 0, total: 0 });
    } catch { /* leave what we have */ }
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  // A deleted group is filtered on the day it was DELETED; a live one on the day
  // it was created — so "show me last month" answers the question either way.
  const shown = useMemo(
    () => rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      const searchable = `${r.ownerName} ${r.ownerUsername} ${r.ownerPublicId} ${r.ownerId} ${r.name} ${r.category}`;
      return matchesReportFilter(filter, r.deletedAt || r.createdAt, searchable);
    }),
    [rows, filter, status],
  );

  // User-wise: every creator, with their groups under them.
  const byUser = useMemo(() => {
    const m = new Map<string, { name: string; publicId: string; username: string; groups: Row[] }>();
    for (const r of shown) {
      const k = r.ownerId;
      if (!m.has(k)) m.set(k, { name: r.ownerName, publicId: r.ownerPublicId, username: r.ownerUsername, groups: [] });
      m.get(k)!.groups.push(r);
    }
    return [...m.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.groups.length - a.groups.length || a.name.localeCompare(b.name));
  }, [shown]);

  const HEADERS = ["Created by", "Member ID", "Username", "Group name", "Category", "Type", "Status", "Created on", "Deleted on", "Deleted by / reason", "Members", "Group ID"];
  const exportRows = () => shown.map((r) => [
    r.ownerName, r.ownerPublicId, r.ownerUsername, r.name, r.category, r.type,
    r.status === "deleted" ? "Deleted" : "Active",
    r.createdAt ? fmtDay(r.createdAt) : "", r.deletedAt ? fmt(r.deletedAt) : "",
    r.reason || "", r.members, r.roomId,
  ]);
  const stamp = new Date().toISOString().slice(0, 10);

  const tiles = [
    { label: "Groups in total", value: totals.total, icon: Layers, tone: "text-lotus-300" },
    { label: "Active now", value: totals.active, icon: Mic, tone: "text-emerald-300" },
    { label: "Deleted", value: totals.deleted, icon: Trash2, tone: "text-rose-300" },
    { label: "Members who created one", value: totals.creators, icon: UserSquare2, tone: "text-sky-300" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-mist-100">Group report</h1>
          <p className="text-sm text-mist-400">
            Every group, live and deleted — who created it, its category, when it started, and for a removed group when it went and why.
          </p>
        </div>
        <Button variant="secondary" onClick={load} disabled={loading}>
          <RefreshCw className={cn("size-4", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="p-5">
            <t.icon className={`size-6 ${t.tone}`} />
            <div className="mt-3 font-display text-2xl font-extrabold text-mist-100">{t.value}</div>
            <div className="text-sm text-mist-400">{t.label}</div>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <ReportFilters value={filter} onChange={setFilter} className="flex-1" />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            aria-label="Show"
            className="h-9 rounded-lg border border-line bg-ink-800 px-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400"
          >
            <option value="all">All groups</option>
            <option value="active">Active only</option>
            <option value="deleted">Deleted only</option>
          </select>
          <div className="flex overflow-hidden rounded-lg border border-line">
            <button
              onClick={() => setView("user")}
              className={cn("inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold", view === "user" ? "bg-lotus-500/20 text-lotus-200" : "bg-ink-800 text-mist-400 hover:text-mist-200")}
            ><Users className="size-4" /> By user</button>
            <button
              onClick={() => setView("group")}
              className={cn("inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold", view === "group" ? "bg-lotus-500/20 text-lotus-200" : "bg-ink-800 text-mist-400 hover:text-mist-200")}
            ><List className="size-4" /> By group</button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className="text-xs text-mist-500">{shown.length} row{shown.length === 1 ? "" : "s"} shown{shown.length !== rows.length ? ` of ${rows.length}` : ""}</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => downloadCsv(`lotus-group-report-${stamp}`, HEADERS, exportRows())} disabled={!shown.length}>
              <Download className="size-4" /> CSV
            </Button>
            <Button variant="secondary" onClick={() => downloadExcel(`lotus-group-report-${stamp}`, "Group report", HEADERS, exportRows())} disabled={!shown.length}>
              <FileSpreadsheet className="size-4" /> Excel
            </Button>
            <Button variant="secondary" onClick={printPage} disabled={!shown.length}>
              <Printer className="size-4" /> Print / PDF
            </Button>
          </div>
        </div>
      </Card>

      {loading && rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-mist-400">Loading the report…</Card>
      ) : shown.length === 0 ? (
        <Card className="p-8 text-center text-sm text-mist-400">
          No groups match this filter.
          {totals.deleted === 0 && status === "deleted" && (
            <span className="mt-2 block text-xs text-mist-500">
              Deleted groups are recorded from this version onwards — any removed before it were not kept.
            </span>
          )}
        </Card>
      ) : view === "group" ? (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[62rem] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-mist-500">
              <tr>
                <th className="px-4 py-3">Group</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Created by</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Deleted</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3 text-right">Members</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={`${r.roomId}-${r.status}`} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-mist-100">{r.name || "(no name)"}</div>
                    <div className="text-[11px] text-mist-500">{r.type}{r.roomId ? ` · ${r.roomId}` : ""}</div>
                  </td>
                  <td className="px-4 py-3 text-mist-300">{r.category || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="text-mist-200">{r.ownerName}</div>
                    <div className="text-[11px] text-mist-500">{r.ownerPublicId ? `ID ${r.ownerPublicId}` : r.ownerId}</div>
                  </td>
                  <td className="px-4 py-3 text-mist-300">{fmtDay(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", r.status === "deleted" ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/15 text-emerald-300")}>
                      {r.status === "deleted" ? "Deleted" : "Active"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-mist-300">{fmt(r.deletedAt)}</td>
                  <td className="max-w-[18rem] px-4 py-3 text-mist-400">{r.reason || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-mist-300">{r.members || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <div className="space-y-3">
          {byUser.map((u) => (
            <Card key={u.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3">
                <UserSquare2 className="size-4 text-lotus-300" />
                <span className="font-display font-bold text-mist-100">{u.name}</span>
                <span className="text-xs text-mist-500">
                  {u.publicId ? `ID ${u.publicId}` : u.id}{u.username ? ` · @${u.username}` : ""}
                </span>
                <span className="ml-auto flex gap-2 text-xs">
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-300">
                    {u.groups.filter((g) => g.status === "active").length} active
                  </span>
                  <span className="rounded-full bg-rose-500/15 px-2 py-0.5 font-semibold text-rose-300">
                    {u.groups.filter((g) => g.status === "deleted").length} deleted
                  </span>
                </span>
              </div>
              <div className="mt-2 space-y-1.5">
                {u.groups.map((g) => (
                  <div key={`${g.roomId}-${g.status}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg bg-white/[0.03] px-3 py-2">
                    <span className="font-semibold text-mist-100">{g.name || "(no name)"}</span>
                    {g.category && <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-mist-300">{g.category}</span>}
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", g.status === "deleted" ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/15 text-emerald-300")}>
                      {g.status === "deleted" ? "Deleted" : "Active"}
                    </span>
                    <span className="text-[11px] text-mist-500">Created {fmtDay(g.createdAt)}</span>
                    {g.status === "deleted" && <span className="text-[11px] text-rose-300/80">Deleted {fmt(g.deletedAt)}</span>}
                    {g.reason && <span className="w-full text-[11px] text-mist-400">Reason: {g.reason}</span>}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
