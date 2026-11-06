"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { fetchPendingSummary, fetchApprovalHistory, fetchApprovalArrivals, type PendingApprovalsSummary, type ApprovalHistory, type ApprovalHistoryRow, type ApprovalArrival } from "@/lib/admin";
import { TableSearch, SortTh, UserLink, applyFilterSort, type SortDir } from "@/components/admin/TableControls";
import { ReportFilters, emptyReportFilter, matchesReportFilter, type ReportFilter } from "@/components/admin/ReportFilters";
import { ClipboardCheck, RefreshCw, ArrowRight, CheckCircle2, Loader2, History, X, XCircle, ExternalLink } from "lucide-react";

type Tab = "pending" | "history";

const POSITIVE = new Set(["approved", "verified", "active", "completed", "forwarded", "accepted", "actioned", "resolved"]);
const NEGATIVE = new Set(["rejected", "blocked", "disqualified", "removed", "dismissed", "suspended", "cancelled", "expired"]);
const statusTone = (s: string) =>
  POSITIVE.has(s) ? "bg-emerald-500/15 text-emerald-300" : NEGATIVE.has(s) ? "bg-rose-500/15 text-rose-300" : "bg-amber-500/15 text-amber-200";
const statusLabel = (s: string) => s.replace(/_/g, " ");
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-SA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

const PAGE = 200;

export default function AdminApprovalsPage() {
  const [tab, setTab] = useState<Tab>("pending");
  const [summary, setSummary] = useState<PendingApprovalsSummary | null>(null);
  const [arrivals, setArrivals] = useState<ApprovalArrival[]>([]);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<ApprovalHistory | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);

  const load = (silent = false) => {
    if (!silent) setBusy(true);
    fetchPendingSummary().then(setSummary).finally(() => { if (!silent) setBusy(false); });
    fetchApprovalArrivals().then(setArrivals);
  };
  const loadHistory = () => { setHistoryBusy(true); fetchApprovalHistory().then(setHistory).finally(() => setHistoryBusy(false)); };
  useEffect(() => {
    load();
    if (new URLSearchParams(window.location.search).get("tab") === "history") setTab("history");
    const id = setInterval(() => load(true), 20000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (tab === "history" && !history && !historyBusy) loadHistory(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => (tab === "history" ? loadHistory() : load());
  const refreshing = tab === "history" ? historyBusy : busy;

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
            <ClipboardCheck className="size-6 text-lotus-300" /> {tab === "history" ? "Approval history" : "Pending approvals"}
          </h1>
          <p className="mt-1 text-sm text-mist-400">
            {tab === "history"
              ? "Every completed decision across the app — what was decided, for whom, by which admin, and when. Tap any row for the full details."
              : "Every request across the app that needs an admin decision — in one place. Counts are live; tap any card to review and act on that queue."}
          </p>
        </div>
        <button onClick={refresh} disabled={refreshing} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-3 py-2 text-sm font-semibold text-mist-300 hover:border-lotus-400/40 disabled:opacity-50">
          <RefreshCw className={cn("size-4", refreshing && "animate-spin")} /> Refresh
        </button>
      </div>

      {/* Pending / History switch */}
      <div className="inline-flex rounded-xl border border-line bg-ink-900/40 p-1">
        {([["pending", "Pending", ClipboardCheck], ["history", "Approval history", History]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition",
              tab === key ? "bg-lotus-500/15 text-lotus-700 ring-1 ring-lotus-400/40" : "text-mist-400 hover:text-mist-100",
            )}
          >
            <Icon className="size-4" /> {label}
            {key === "pending" && summary && <span className="rounded-full bg-white/[0.06] px-1.5 text-[10px] font-bold">{summary.total}</span>}
          </button>
        ))}
      </div>

      {tab === "pending" ? (
        <>
          {/* Total banner */}
          <Card className={cn("flex items-center justify-between gap-3 p-5", summary && summary.total > 0 ? "border-amber-400/30 bg-amber-500/[0.06]" : "border-emerald-400/25 bg-emerald-500/[0.05]")}>
            <div className="flex items-center gap-3">
              {summary && summary.total === 0 ? <CheckCircle2 className="size-8 text-emerald-300" /> : <ClipboardCheck className="size-8 text-amber-300" />}
              <div>
                <div className="font-display text-3xl font-extrabold text-white">{summary ? summary.total : <Loader2 className="size-6 animate-spin text-mist-500" />}</div>
                <div className="text-sm text-mist-300">{summary && summary.total === 0 ? "All caught up — nothing awaiting approval." : "Total items awaiting your approval"}</div>
              </div>
            </div>
          </Card>

          {arrivals.length > 0 && (
            <Card className="p-4">
              <h2 className="text-sm font-bold text-mist-100">Just arrived</h2>
              <p className="mt-0.5 text-xs text-mist-500">Newest alert from each approval queue. This list refreshes on its own.</p>
              <div className="mt-3 space-y-1.5">
                {arrivals.map((n) => (
                  <Link key={n.id} href={n.href || "/admin/approvals"} className="flex items-start gap-2 rounded-lg border border-line bg-ink-900/50 px-3 py-2 transition hover:border-lotus-400/40">
                    {n.unread && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-300" title="Unread" />}
                    <span className="min-w-0 flex-1 text-xs text-mist-200">{n.text}</span>
                    <span className="shrink-0 text-[10px] text-mist-500">{fmt(n.time)}</span>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {!summary ? (
            <div className="grid h-40 place-items-center text-mist-500"><Loader2 className="size-5 animate-spin" /></div>
          ) : (
            summary.groups.map((group) => {
              const items = summary.categories.filter((c) => c.group === group);
              const groupTotal = items.reduce((n, c) => n + c.count, 0);
              return (
                <div key={group}>
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <h2 className="text-sm font-bold uppercase tracking-wide text-mist-400">{group}</h2>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", groupTotal > 0 ? "bg-amber-500/20 text-amber-200" : "bg-white/[0.06] text-mist-500")}>{groupTotal}</span>
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((c) => (
                      <Link key={c.key} href={c.href} className={cn("group flex items-center justify-between gap-3 rounded-xl border p-3.5 transition", c.count > 0 ? "border-amber-400/25 bg-amber-500/[0.06] hover:border-amber-400/50" : "border-line bg-ink-900/40 hover:border-lotus-400/30")}>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-mist-100">{c.label}</div>
                          <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-lotus-300/80 opacity-0 transition group-hover:opacity-100">Review &amp; act <ArrowRight className="size-3" /></div>
                        </div>
                        <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg text-sm font-extrabold", c.count > 0 ? "bg-amber-500/20 text-amber-200" : "bg-white/[0.05] text-mist-500")}>{c.count}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })
          )}

          <p className="px-1 text-[11px] text-mist-600">Each card opens the full management page for that queue, where you can view details and Approve / Reject / act on individual requests. Counts update every time this page loads or you tap Refresh. Completed decisions stay available under <button onClick={() => setTab("history")} className="font-semibold text-lotus-300 hover:underline">Approval history</button>.</p>
        </>
      ) : (
        <HistoryView history={history} busy={historyBusy} />
      )}
    </div>
  );
}

function HistoryView({ history, busy }: { history: ApprovalHistory | null; busy: boolean }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<ReportFilter>(emptyReportFilter);
  const [group, setGroup] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [admin, setAdmin] = useState("");
  const [sort, setSort] = useState("decidedAt");
  const [dir, setDir] = useState<SortDir>("desc");
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<ApprovalHistoryRow | null>(null);

  const rows = useMemo(() => history?.rows ?? [], [history]);
  const categoryOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (!group || r.group === group) m.set(r.category, r.label);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows, group]);
  const statusOptions = useMemo(() => [...new Set(rows.map((r) => r.status))].sort(), [rows]);
  const adminOptions = useMemo(() => [...new Set(rows.map((r) => r.decidedBy).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b)), [rows]);

  const filtered = useMemo(() => {
    const base = rows.filter((r) =>
      (!group || r.group === group) &&
      (!category || r.category === category) &&
      (!status || r.status === status) &&
      (!admin || (admin === "__none" ? !r.decidedBy : r.decidedBy === admin)) &&
      matchesReportFilter(filter, r.decidedAt || r.requestedAt, `${r.userName ?? ""} ${r.userPublicId ?? ""} ${r.userId ?? ""}`),
    );
    return applyFilterSort(base, {
      q, sort, dir,
      searchText: (r) => `${r.subject} ${r.label} ${r.group} ${r.userName ?? ""} ${r.userPublicId ?? ""} ${r.status} ${r.decidedBy ?? ""} ${r.note ?? ""} ${r.amount ?? ""} ${r.itemId}`,
      sortKeys: {
        decidedAt: (r) => r.decidedAt || r.requestedAt || "",
        requestedAt: (r) => r.requestedAt || "",
        category: (r) => r.label,
        subject: (r) => r.subject,
        user: (r) => r.userName ?? "",
        status: (r) => r.status,
        decidedBy: (r) => r.decidedBy ?? "",
      },
    });
  }, [rows, group, category, status, admin, filter, q, sort, dir]);

  useEffect(() => { setLimit(PAGE); }, [group, category, status, admin, filter, q, sort, dir]);

  const counts = useMemo(() => {
    let approved = 0, rejected = 0;
    for (const r of filtered) { if (POSITIVE.has(r.status)) approved++; else if (NEGATIVE.has(r.status)) rejected++; }
    return { total: filtered.length, approved, rejected, other: filtered.length - approved - rejected };
  }, [filtered]);

  const onSort = (col: string) => {
    if (col === sort) setDir(dir === "asc" ? "desc" : "asc");
    else { setSort(col); setDir(col === "decidedAt" || col === "requestedAt" ? "desc" : "asc"); }
  };
  const field = "h-9 rounded-lg border border-line bg-ink-800 px-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400";
  const hasFilters = !!(q || group || category || status || admin || filter.mode !== "all" || filter.user);

  if (!history) {
    return <div className="grid h-40 place-items-center text-mist-500">{busy ? <Loader2 className="size-5 animate-spin" /> : "Could not load the approval history."}</div>;
  }

  return (
    <>
      {/* Totals (respect the filters below) */}
      <div className="grid gap-3 sm:grid-cols-4">
        {([
          ["Completed", counts.total, "text-white", ""],
          ["Approved", counts.approved, "text-emerald-300", "approved"],
          ["Rejected", counts.rejected, "text-rose-300", "rejected"],
          ["Other outcomes", counts.other, "text-amber-200", ""],
        ] as const).map(([label, n, tone, quick]) => (
          <Card key={label} className={cn("p-4", quick && "cursor-pointer transition hover:border-lotus-400/40")} onClick={quick ? () => setStatus(status === quick ? "" : quick) : undefined}>
            <div className={cn("font-display text-2xl font-extrabold", tone)}>{n.toLocaleString("en-SA")}</div>
            <div className="text-xs text-mist-400">{label}</div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <TableSearch value={q} onChange={setQ} placeholder="Search subject, user, admin, note…" className="min-w-52 flex-1" />
          <select value={group} onChange={(e) => { setGroup(e.target.value); setCategory(""); }} aria-label="Area" className={field}>
            <option value="">All areas</option>
            {history.groups.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" className={field}>
            <option value="">All categories</option>
            {categoryOptions.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" className={cn(field, "capitalize")}>
            <option value="">All statuses</option>
            {statusOptions.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
          <select value={admin} onChange={(e) => setAdmin(e.target.value)} aria-label="Decided by" className={field}>
            <option value="">Any admin</option>
            {adminOptions.map((a) => <option key={a} value={a}>{a}</option>)}
            <option value="__none">Not recorded</option>
          </select>
        </div>
        <ReportFilters value={filter} onChange={setFilter} />
        {hasFilters && (
          <button
            onClick={() => { setQ(""); setGroup(""); setCategory(""); setStatus(""); setAdmin(""); setFilter(emptyReportFilter); }}
            className="text-xs font-semibold text-lotus-300 hover:text-lotus-200"
          >
            Clear all filters
          </button>
        )}
      </Card>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs">
                <SortTh col="decidedAt" sort={sort} dir={dir} onSort={onSort}>Decided</SortTh>
                <SortTh col="category" sort={sort} dir={dir} onSort={onSort}>Category</SortTh>
                <SortTh col="subject" sort={sort} dir={dir} onSort={onSort}>What</SortTh>
                <SortTh col="user" sort={sort} dir={dir} onSort={onSort}>User</SortTh>
                <SortTh col="status" sort={sort} dir={dir} onSort={onSort}>Status</SortTh>
                <SortTh col="decidedBy" sort={sort} dir={dir} onSort={onSort}>Decided by</SortTh>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, limit).map((r) => (
                <tr key={r.id} onClick={() => setOpen(r)} className="cursor-pointer border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-mist-300">{fmt(r.decidedAt)}</td>
                  <td className="px-4 py-2.5">
                    <div className="text-xs font-semibold text-mist-200">{r.label}</div>
                    <div className="text-[10px] text-mist-500">{r.group}</div>
                  </td>
                  <td className="max-w-xs px-4 py-2.5"><div className="truncate text-mist-100" title={r.subject}>{r.subject}</div></td>
                  <td className="whitespace-nowrap px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                    {r.userName ? <UserLink name={r.userName} publicId={r.userPublicId} userId={r.userId} /> : <span className="text-mist-600">—</span>}
                  </td>
                  <td className="px-4 py-2.5"><span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize", statusTone(r.status))}>{statusLabel(r.status)}</span></td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-mist-300">{r.decidedBy || <span className="text-mist-600">Not recorded</span>}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-mist-500">{rows.length === 0 ? "No completed approvals yet." : "No approvals match these filters."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > limit && (
          <div className="border-t border-white/5 p-3 text-center">
            <button onClick={() => setLimit(limit + PAGE)} className="text-xs font-semibold text-lotus-300 hover:text-lotus-200">
              Show more ({(filtered.length - limit).toLocaleString("en-SA")} remaining)
            </button>
          </div>
        )}
      </Card>

      <p className="px-1 text-[11px] text-mist-600">Decisions made before approval history was introduced show the details each queue kept at the time — for a few queues (tournament and competition entries, agency registrations, violations, support tickets) the deciding admin wasn&apos;t recorded then and shows as &quot;Not recorded&quot;. Every new decision on those queues records it.</p>

      {open && <HistoryDetail row={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function HistoryDetail({ row, onClose }: { row: ApprovalHistoryRow; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const positive = POSITIVE.has(row.status), negative = NEGATIVE.has(row.status);
  const items: [string, React.ReactNode][] = [
    ["Category", <>{row.label} <span className="text-mist-500">· {row.group}</span></>],
    ["What", row.subject],
    ["User", row.userName ? <UserLink name={row.userName} publicId={row.userPublicId} userId={row.userId} /> : "—"],
    ["Status", <span key="s" className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize", statusTone(row.status))}>{statusLabel(row.status)}</span>],
    ["Decided by", row.decidedBy || "Not recorded"],
    ["Decided at", fmt(row.decidedAt)],
    ["Requested at", fmt(row.requestedAt)],
  ];
  if (row.amount) items.push(["Amount", row.amount]);
  if (row.note) items.push(["Note", <span key="n" className="whitespace-pre-wrap">{row.note}</span>]);
  items.push(["Reference", <span key="r" className="font-mono text-xs text-mist-400">{row.itemId}</span>]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <Card className="max-h-[90dvh] w-full max-w-lg overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
            {positive ? <CheckCircle2 className="size-5 text-emerald-300" /> : negative ? <XCircle className="size-5 text-rose-300" /> : <History className="size-5 text-amber-200" />}
            Approval details
          </h2>
          <button onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-lg text-mist-400 transition hover:bg-white/[0.06] hover:text-mist-100">
            <X className="size-4" />
          </button>
        </div>
        <dl className="mt-4 space-y-2.5">
          {items.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[110px_1fr] gap-3 text-sm">
              <dt className="text-xs font-semibold uppercase tracking-wide text-mist-500">{k}</dt>
              <dd className="min-w-0 break-words text-mist-100">{v}</dd>
            </div>
          ))}
        </dl>
        <Link href={row.href} className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-3 py-2 text-sm font-semibold text-mist-200 transition hover:border-lotus-400/40 hover:text-mist-100">
          <ExternalLink className="size-4" /> Open {row.label} page
        </Link>
      </Card>
    </div>
  );
}
