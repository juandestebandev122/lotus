"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { UserCheck, Search, Check, X, Clock, Building2 } from "lucide-react";
import { UserLink, SortTh, applyFilterSort, type SortDir } from "@/components/admin/TableControls";

type Row = {
  id: string; userId: string; userName: string; username: string;
  agencyId: string; agencyPublicId?: string; agencyName: string; createdByName?: string;
  createdAt: string; status: "pending" | "approved" | "rejected";
  decidedByName?: string; decidedAt?: string; note?: string;
};

const TABS = ["pending", "approved", "rejected", "all"] as const;
type Tab = (typeof TABS)[number];

function fmt(s?: string) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminAgencyUsersPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("pending");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [sort, setSort] = useState("created");
  const [dir, setDir] = useState<SortDir>("desc");
  const sortRows = (col: string) => { if (col === sort) setDir((d) => (d === "asc" ? "desc" : "asc")); else { setSort(col); setDir("desc"); } };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(withBase("/api/admin/agency-users"), { credentials: "include" });
      const d = await res.json();
      setRows((d?.requests ?? []) as Row[]);
    } catch { /* ignore */ }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => ({
    pending: rows.filter((r) => r.status === "pending").length,
    approved: rows.filter((r) => r.status === "approved").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
    all: rows.length,
  }), [rows]);

  const shown = useMemo(() => applyFilterSort(
    rows.filter((r) => tab === "all" || r.status === tab),
    {
      q, sort, dir,
      searchText: (r) => `${r.userName} ${r.username} ${r.userId} ${r.agencyName} ${r.agencyPublicId ?? ""} ${r.createdByName ?? ""} ${r.decidedByName ?? ""} ${r.status}`,
      sortKeys: {
        user: (r) => r.userName ?? "",
        agency: (r) => r.agencyName ?? "",
        created: (r) => new Date(r.createdAt ?? 0).getTime() || 0,
        status: (r) => r.status ?? "",
        by: (r) => r.decidedByName ?? "",
        at: (r) => new Date(r.decidedAt ?? 0).getTime() || 0,
      },
    },
  ), [rows, tab, q, sort, dir]);

  const decide = async (id: string, approve: boolean) => {
    let note: string | undefined;
    if (!approve) { note = window.prompt("Reason for rejection (optional):") ?? undefined; }
    setBusy(id);
    try {
      const res = await fetch(withBase("/api/admin/agency-users"), {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, approve, note }),
      });
      const d = await res.json();
      if (res.ok) { toast(approve ? "Account approved & activated." : "Account rejected.", "success"); await load(); }
      else toast(d.error ?? "Could not update", "error");
    } catch { toast("Could not update", "error"); }
    setBusy(null);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
          <UserCheck className="size-6 text-lotus-300" /> Agency User Approvals
        </h1>
        <p className="mt-1 text-sm text-mist-400">
          Accounts created by agencies. When <b>Agency User Approval</b> is ON (Feature Management), a new
          account stays <b>Pending</b> and the user can&apos;t log in until you approve it here. Approving adds them
          to the agency and activates the account. This list is also the full audit trail.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={cn("rounded-full px-3.5 py-1.5 text-sm font-semibold capitalize transition", tab === tb ? "bg-lotus-500 text-white" : "bg-ink-800 text-mist-300 hover:bg-white/[0.06]")}
          >
            {tb} <span className="ml-1 text-xs opacity-70">{counts[tb]}</span>
          </button>
        ))}
        <div className="relative ml-auto min-w-52 flex-1 sm:flex-none">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mist-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, username or agency…"
            className="h-10 w-full rounded-xl border border-line bg-ink-800 pl-10 pr-4 text-sm text-mist-100 outline-none focus:border-lotus-400"
          />
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="grid place-items-center p-10 text-mist-400">Loading…</div>
        ) : shown.length === 0 ? (
          <div className="grid place-items-center gap-2 p-10 text-center text-mist-400">
            <Clock className="size-8 text-mist-600" />
            No {tab === "all" ? "" : tab} agency accounts{q ? " match your search" : ""}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-mist-500">
                  <SortTh col="user" sort={sort} dir={dir} onSort={sortRows} className="px-4 py-3">User created</SortTh>
                  <SortTh col="agency" sort={sort} dir={dir} onSort={sortRows} className="px-4 py-3">Agency</SortTh>
                  <SortTh col="created" sort={sort} dir={dir} onSort={sortRows} className="px-4 py-3">Created</SortTh>
                  <SortTh col="status" sort={sort} dir={dir} onSort={sortRows} className="px-4 py-3">Status</SortTh>
                  <SortTh col="by" sort={sort} dir={dir} onSort={sortRows} className="px-4 py-3">Decided by</SortTh>
                  <SortTh col="at" sort={sort} dir={dir} onSort={sortRows} className="px-4 py-3">Decided at</SortTh>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="border-b border-line/50 last:border-0">
                    <td className="px-4 py-3">
                      <UserLink name={r.userName} userId={r.userId} username={r.username} showId={false} />
                      <div className="text-xs text-mist-500">@{r.username}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 font-medium text-mist-200"><Building2 className="size-3.5 text-mist-500" /> {r.agencyName}</div>
                      <div className="text-xs text-mist-500">{r.agencyPublicId ?? ""}{r.createdByName ? ` · by ${r.createdByName}` : ""}</div>
                    </td>
                    <td className="px-4 py-3 text-mist-300">{fmt(r.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold",
                        r.status === "approved" ? "bg-emerald-500/15 text-emerald-300" : r.status === "rejected" ? "bg-rose-500/15 text-rose-300" : "bg-amber-500/15 text-amber-300")}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-mist-300">{r.decidedByName ?? "—"}{r.note ? <div className="text-xs text-mist-500">{r.note}</div> : null}</td>
                    <td className="px-4 py-3 text-mist-300">{fmt(r.decidedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {r.status === "pending" ? (
                        <div className="inline-flex gap-2">
                          <Button size="sm" onClick={() => decide(r.id, true)} disabled={busy === r.id}><Check className="size-4" /> Approve</Button>
                          <Button size="sm" variant="danger" onClick={() => decide(r.id, false)} disabled={busy === r.id}><X className="size-4" /> Reject</Button>
                        </div>
                      ) : <span className="text-xs text-mist-600">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
