"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { fetchAdminUsers, type AdminUser } from "@/lib/admin";
import { ReportFilters, matchesReportFilter, emptyReportFilter, type ReportFilter } from "@/components/admin/ReportFilters";
import { UserLink, SortTh, applyFilterSort, type SortDir } from "@/components/admin/TableControls";
import { Users, Coins, Download, Printer, ArrowLeft } from "lucide-react";

const pad = (n: number) => String(n).padStart(2, "0");

export default function JoiningReportPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReportFilter>(emptyReportFilter);
  const [sort, setSort] = useState("joined");
  const [dir, setDir] = useState<SortDir>("desc");

  useEffect(() => {
    // Default to "this month" so the report opens with useful data.
    const now = new Date();
    setFilter({ ...emptyReportFilter, mode: "month", month: `${now.getFullYear()}-${pad(now.getMonth() + 1)}` });
    fetchAdminUsers().then((u) => { setUsers(u); setLoading(false); });
  }, []);

  const preset = (mode: ReportFilter["mode"]) => {
    const now = new Date();
    if (mode === "date") setFilter({ ...emptyReportFilter, mode: "date", date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` });
    else if (mode === "month") setFilter({ ...emptyReportFilter, mode: "month", month: `${now.getFullYear()}-${pad(now.getMonth() + 1)}` });
    else if (mode === "year") setFilter({ ...emptyReportFilter, mode: "year", year: `${now.getFullYear()}` });
    else setFilter({ ...emptyReportFilter, mode: "all" });
  };

  const joined = useMemo(
    () => users.filter((u) => u.joinedAt && matchesReportFilter(filter, u.joinedAt, `${u.fullName} ${u.username} ${u.publicId ?? ""} ${u.email ?? ""} ${u.phone ?? ""}`)),
    [users, filter],
  );
  const totalPurchased = joined.reduce((s, u) => s + (u.coinsPurchased ?? 0), 0);
  const totalSpent = joined.reduce((s, u) => s + (u.coinsSpent ?? 0), 0);

  // Click-to-sort on the per-user table (the date filters above still apply).
  const sortUsers = (col: string) => { if (col === sort) setDir((d) => (d === "asc" ? "desc" : "asc")); else { setSort(col); setDir("desc"); } };
  const sortedJoined = useMemo(() => applyFilterSort(joined, {
    q: "", sort, dir,
    searchText: () => "",
    sortKeys: {
      user: (u) => u.fullName ?? "",
      id: (u) => u.publicId || u.id,
      joined: (u) => new Date(u.joinedAt ?? 0).getTime() || 0,
      purchased: (u) => u.coinsPurchased ?? 0,
      spent: (u) => u.coinsSpent ?? 0,
    },
  }), [joined, sort, dir]);

  const rangeLabel = filter.mode === "all" ? "All time"
    : filter.mode === "date" ? (filter.date || "—")
    : filter.mode === "month" ? (filter.month || "—")
    : filter.mode === "year" ? (filter.year || "—")
    : `${filter.from || "start"} to ${filter.to || "today"}`;

  // Date-wise breakdown (newest day first).
  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of joined) { const day = (u.joinedAt || "").slice(0, 10); m.set(day, (m.get(day) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [joined]);

  const exportCsv = () => {
    const esc = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const head = ["User ID", "Name", "Username", "Email", "Phone", "Joined", "Coins purchased", "Coins spent"];
    const body = joined.map((u) => [u.publicId || u.id, u.fullName, u.username, u.email, u.phone, u.joinedAt, u.coinsPurchased ?? 0, u.coinsSpent ?? 0].map(esc).join(","));
    const summary = [`Joining report,${rangeLabel}`, `Total new users,${joined.length}`, `Total coins purchased,${totalPurchased}`, `Total coins spent,${totalSpent}`, ""];
    const csv = [...summary, head.join(","), ...body].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `joining-report-${rangeLabel.replace(/[^\w-]+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const fmtDay = (d: string) => (d ? new Date(d).toLocaleDateString("en-SA", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "—");

  return (
    <div className="space-y-6 print:text-black">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-mist-100">Joining Report</h1>
          <p className="text-sm text-mist-400">New users by date, with coins purchased &amp; spent. Filter by user / date / month / year / range, then export or print.</p>
        </div>
        <ButtonLink href="/admin/users" variant="secondary" size="sm"><ArrowLeft className="size-4" /> Back to Users</ButtonLink>
      </div>

      {/* Filters */}
      <Card className="space-y-3 p-4 print:hidden">
        <ReportFilters value={filter} onChange={setFilter} />
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-mist-500">Quick:</span>
          <button onClick={() => preset("date")} className="rounded-lg bg-ink-800 px-2.5 py-1.5 text-xs font-semibold text-mist-300 hover:text-mist-100">Today</button>
          <button onClick={() => preset("month")} className="rounded-lg bg-ink-800 px-2.5 py-1.5 text-xs font-semibold text-mist-300 hover:text-mist-100">This month</button>
          <button onClick={() => preset("year")} className="rounded-lg bg-ink-800 px-2.5 py-1.5 text-xs font-semibold text-mist-300 hover:text-mist-100">This year</button>
          <button onClick={() => preset("all")} className="rounded-lg bg-ink-800 px-2.5 py-1.5 text-xs font-semibold text-mist-300 hover:text-mist-100">All time</button>
          <div className="ml-auto flex gap-2">
            <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-3 py-2 text-xs font-semibold text-mist-200 hover:border-emerald-400/40"><Download className="size-3.5 text-emerald-300" /> Export Excel</button>
            <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-3 py-2 text-xs font-semibold text-mist-200 hover:border-lotus-400/40"><Printer className="size-3.5 text-lotus-300" /> Print / PDF</button>
          </div>
        </div>
      </Card>

      <h2 className="hidden text-lg font-bold print:block">Joining Report · {rangeLabel}</h2>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5"><Users className="size-6 text-lotus-300" /><div className="mt-2 font-display text-3xl font-extrabold text-mist-100 print:text-black">{loading ? "…" : joined.length.toLocaleString("en-SA")}</div><div className="text-sm text-mist-400">Total new users</div></Card>
        <Card className="p-5"><Coins className="size-6 text-emerald-300" /><div className="mt-2 font-display text-2xl font-extrabold text-mist-100 print:text-black">{totalPurchased.toLocaleString("en-SA")}</div><div className="text-sm text-mist-400">Coins purchased</div></Card>
        <Card className="p-5"><Coins className="size-6 text-petal-300" /><div className="mt-2 font-display text-2xl font-extrabold text-mist-100 print:text-black">{totalSpent.toLocaleString("en-SA")}</div><div className="text-sm text-mist-400">Coins spent</div></Card>
      </div>

      {/* Date-wise breakdown */}
      <div>
        <h3 className="mb-3 font-semibold text-mist-100 print:text-black">Date-wise joining</h3>
        <Card className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-mist-500"><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">New users</th></tr></thead>
            <tbody>
              {byDay.map(([day, count]) => (
                <tr key={day} className="border-b border-white/5 last:border-0"><td className="px-4 py-2.5 text-mist-200 print:text-black">{fmtDay(day)}</td><td className="px-4 py-2.5 font-semibold text-lotus-300 print:text-black">{count}</td></tr>
              ))}
              {!loading && byDay.length === 0 && <tr><td colSpan={2} className="px-4 py-8 text-center text-sm text-mist-500">No users joined in this range.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Per-user (the new joiners) */}
      <div>
        <h3 className="mb-3 font-semibold text-mist-100 print:text-black">New users ({joined.length})</h3>
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-mist-500 print:hidden">
                  <SortTh col="user" sort={sort} dir={dir} onSort={sortUsers} className="px-4 py-3">User</SortTh>
                  <SortTh col="id" sort={sort} dir={dir} onSort={sortUsers} className="px-4 py-3">ID</SortTh>
                  <SortTh col="joined" sort={sort} dir={dir} onSort={sortUsers} className="px-4 py-3">Joined</SortTh>
                  <SortTh col="purchased" sort={sort} dir={dir} onSort={sortUsers} className="px-4 py-3">Purchased</SortTh>
                  <SortTh col="spent" sort={sort} dir={dir} onSort={sortUsers} className="px-4 py-3">Spent</SortTh>
                </tr>
                <tr className="hidden border-b border-white/5 text-left text-xs uppercase tracking-wide print:table-row"><th className="px-4 py-3 font-semibold">User</th><th className="px-4 py-3 font-semibold">ID</th><th className="px-4 py-3 font-semibold">Joined</th><th className="px-4 py-3 font-semibold">Purchased</th><th className="px-4 py-3 font-semibold">Spent</th></tr>
              </thead>
              <tbody>
                {sortedJoined.map((u) => (
                  <tr key={u.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-2.5 text-mist-100 print:text-black"><UserLink name={u.fullName} publicId={u.publicId} userId={u.id} username={u.username} showId={false} /> <span className="text-xs text-mist-500">@{u.username}</span></td>
                    <td className="px-4 py-2.5 font-mono text-xs text-lotus-300 print:text-black">{u.publicId || "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-mist-300 print:text-black">{u.joinedAt ? new Date(u.joinedAt).toLocaleDateString("en-SA", { day: "numeric", month: "short", year: "numeric" }) : "—"}</td>
                    <td className="px-4 py-2.5 text-emerald-300 print:text-black">{(u.coinsPurchased ?? 0).toLocaleString("en-SA")}</td>
                    <td className="px-4 py-2.5 text-petal-300 print:text-black">{(u.coinsSpent ?? 0).toLocaleString("en-SA")}</td>
                  </tr>
                ))}
                {!loading && sortedJoined.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-mist-500">No users match this filter.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
