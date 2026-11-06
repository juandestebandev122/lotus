"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { fetchAdminJobs, adminJobAction, adminPurgeExpiredJobs, type JobCard, type ApplicationCard } from "@/lib/business";
import { Briefcase, Check, X, Send, Banknote, MapPin, Clock, Building2, FileText, Trash2, Timer } from "lucide-react";
import { UserLink, TableSearch, SortSelect, applyFilterSort, type SortDir } from "@/components/admin/TableControls";

const STATUS_PILL: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300",
  approved: "bg-emerald-500/15 text-emerald-300",
  forwarded: "bg-sky-500/15 text-sky-300",
  accepted: "bg-emerald-500/15 text-emerald-300",
  rejected: "bg-rose-500/15 text-rose-300",
  closed: "bg-mist-500/15 text-mist-400",
};
const APP_LABEL: Record<string, string> = {
  pending: "With admin", forwarded: "Forwarded to business", accepted: "Accepted", rejected: "Rejected",
};
const APP_FILTERS = ["all", "pending", "forwarded", "accepted", "rejected"] as const;

export default function AdminJobsPage() {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [apps, setApps] = useState<ApplicationCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"jobs" | "applications">("jobs");
  const [appFilter, setAppFilter] = useState<(typeof APP_FILTERS)[number]>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("newest");
  const [dir, setDir] = useState<SortDir>("desc");

  const reload = () => fetchAdminJobs().then((d) => { setJobs(d.jobs); setApps(d.applications); setLoading(false); });
  useEffect(() => { reload(); }, []);

  const pendingJobs = useMemo(() => jobs.filter((j) => j.status === "pending").length, [jobs]);
  const pendingApps = useMemo(() => apps.filter((a) => a.status === "pending").length, [apps]);

  const jobAction = async (j: JobCard, action: "approve" | "reject") => {
    let note: string | undefined;
    if (action === "reject") { const n = window.prompt(`Reason for rejecting "${j.title}"? (optional)`); if (n === null) return; note = n || undefined; }
    const okRes = await adminJobAction("job", j.id, action, note);
    if (okRes) { toast(`Job ${action}d.`, "success"); reload(); } else toast("Action failed", "error");
  };
  const appAction = async (a: ApplicationCard, action: "forward" | "accept" | "reject") => {
    let reason: string | undefined;
    if (action === "reject") { const n = window.prompt(`Reason for rejecting ${a.userName}? (shown to the applicant)`); if (n === null) return; reason = n || undefined; }
    const okRes = await adminJobAction("application", a.id, action, reason);
    if (okRes) { toast(action === "forward" ? "Forwarded to the business." : action === "accept" ? "Applicant accepted." : "Application rejected.", "success"); reload(); } else toast("Action failed", "error");
  };
  const deleteJob = async (j: JobCard) => {
    if (!confirm(`Delete the job "${j.title}" permanently?`)) return;
    const okRes = await adminJobAction("job", j.id, "delete");
    if (okRes) { toast("Job deleted.", "success"); reload(); } else toast("Action failed", "error");
  };
  const purgeExpired = async () => {
    if (!confirm("Remove all jobs whose application deadline has passed?")) return;
    const res = await adminPurgeExpiredJobs();
    if (res.ok) { toast(res.removed ? `Removed ${res.removed} expired job(s).` : "No expired jobs to remove.", "success"); reload(); } else toast("Action failed", "error");
  };

  const shownJobs = applyFilterSort(jobs, {
    q, sort, dir,
    searchText: (j) => `${j.title} ${j.businessName} ${j.jobType} ${j.location ?? ""} ${j.salary ?? ""} ${j.status} ${j.description ?? ""}`,
    sortKeys: {
      newest: (j) => new Date(j.createdAt ?? 0).getTime() || 0,
      title: (j) => j.title ?? "",
      business: (j) => j.businessName ?? "",
      status: (j) => j.status ?? "",
      applicants: (j) => j.applicantCount ?? 0,
    },
  });
  const shownApps = applyFilterSort(
    apps.filter((a) => appFilter === "all" || a.status === appFilter),
    {
      q, sort, dir,
      searchText: (a) => `${a.userName} ${a.userId} ${a.jobTitle} ${a.businessName} ${a.status} ${a.message ?? ""} ${a.contact ?? ""}`,
      sortKeys: {
        newest: (a) => new Date(a.createdAt ?? 0).getTime() || 0,
        user: (a) => a.userName ?? "",
        title: (a) => a.jobTitle ?? "",
        business: (a) => a.businessName ?? "",
        status: (a) => a.status ?? "",
        applicants: (a) => a.userName ?? "",
      },
    },
  );

  if (loading) return <div className="grid min-h-[60vh] place-items-center text-mist-400">Loading jobs…</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-mist-100"><Briefcase className="size-6 text-lotus-300" /> Jobs</h1>
          <p className="mt-0.5 text-sm text-mist-400">Approve business jobs and review applications before they reach the business.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={purgeExpired}><Timer className="size-4" /> Remove expired</Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {([["jobs", `Jobs${pendingJobs ? ` · ${pendingJobs}` : ""}`], ["applications", `Applications${pendingApps ? ` · ${pendingApps}` : ""}`]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={cn("rounded-lg border px-3.5 py-1.5 text-sm font-semibold transition-colors", tab === k ? "border-lotus-400 bg-lotus-500/15 text-lotus-100" : "border-line bg-ink-800 text-mist-300 hover:bg-ink-700")}>{label}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TableSearch value={q} onChange={setQ} placeholder={tab === "jobs" ? "Search job, business, type…" : "Search applicant, job, business…"} className="w-60" />
          <SortSelect sort={sort} dir={dir} onSort={setSort} onDir={setDir}
            options={tab === "jobs"
              ? [{ key: "newest", label: "Date" }, { key: "title", label: "Job title" }, { key: "business", label: "Business" }, { key: "status", label: "Status" }, { key: "applicants", label: "Applicants" }]
              : [{ key: "newest", label: "Date" }, { key: "user", label: "Applicant" }, { key: "title", label: "Job" }, { key: "business", label: "Business" }, { key: "status", label: "Status" }]} />
        </div>
      </div>

      {tab === "jobs" && (
        <div className="space-y-3">
          {shownJobs.length === 0 ? <Card className="p-8 text-center text-sm text-mist-400">{jobs.length === 0 ? "No jobs yet." : "No jobs match your search."}</Card> : shownJobs.map((j) => (
            <Card key={j.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-mist-100">{j.title}</p>
                  <p className="flex items-center gap-1 text-xs text-mist-400"><Building2 className="size-3" /> {j.businessName}</p>
                </div>
                <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase", STATUS_PILL[j.status])}>{j.status}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mist-300">
                <span className="flex items-center gap-1 rounded-md bg-lotus-500/10 px-2 py-0.5 text-lotus-200"><Clock className="size-3" />{j.jobType}</span>
                {j.salary && <span className="flex items-center gap-1"><Banknote className="size-3.5 text-emerald-300" />{j.salary}</span>}
                {j.location && <span className="flex items-center gap-1"><MapPin className="size-3.5" />{j.location}</span>}
                <span className="text-mist-500">· {j.applicantCount} applicant{j.applicantCount === 1 ? "" : "s"}</span>
              </div>
              {j.description && <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-mist-400">{j.description}</p>}
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                {j.status === "pending" && <>
                  <Button size="sm" onClick={() => jobAction(j, "approve")}><Check className="size-4" /> Approve</Button>
                  <Button size="sm" variant="secondary" onClick={() => jobAction(j, "reject")}><X className="size-4" /> Reject</Button>
                </>}
                <Button size="sm" variant="secondary" className="!text-rose-300" onClick={() => deleteJob(j)}><Trash2 className="size-4" /> Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "applications" && (
        <div className="space-y-3">
          {/* Status filter — full application-status management */}
          <div className="flex flex-wrap gap-1.5">
            {APP_FILTERS.map((f) => {
              const n = f === "all" ? apps.length : apps.filter((a) => a.status === f).length;
              return (
                <button key={f} onClick={() => setAppFilter(f)} className={cn("rounded-lg border px-2.5 py-1 text-xs font-semibold capitalize transition-colors", appFilter === f ? "border-lotus-400 bg-lotus-500/15 text-lotus-100" : "border-line bg-ink-800 text-mist-300 hover:bg-ink-700")}>{f === "all" ? "All" : APP_LABEL[f]} {n > 0 && <span className="text-mist-500">· {n}</span>}</button>
              );
            })}
          </div>

          {(() => {
            const shown = shownApps;
            if (shown.length === 0) return <Card className="p-8 text-center text-sm text-mist-400">No applications {apps.length ? "in this status" : "yet"}.</Card>;
            return shown.map((a) => (
              <Card key={a.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar name={a.userName} src={a.userAvatar || undefined} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-mist-100"><UserLink name={a.userName} userId={a.userId} showId={false} /></p>
                      <p className="flex items-center gap-1 truncate text-[11px] text-mist-500"><FileText className="size-3" /> {a.jobTitle} · {a.businessName}</p>
                    </div>
                  </div>
                  <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase", STATUS_PILL[a.status])}>{APP_LABEL[a.status] ?? a.status}</span>
                </div>
                {a.message && <p className="mt-2 text-sm text-mist-300">{a.message}</p>}
                {a.contact && <p className="mt-1 text-xs text-lotus-300">Contact: {a.contact}</p>}
                {a.status === "rejected" && a.reason && <p className="mt-1 text-xs text-rose-300">Reason: {a.reason}</p>}
                {(a.status === "accepted" || a.status === "rejected") && a.decidedBy && <p className="mt-1 text-[11px] text-mist-500">Decided by {a.decidedBy}</p>}
                {a.status !== "accepted" && a.status !== "rejected" && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                    {a.status === "pending" && <Button size="sm" onClick={() => appAction(a, "forward")}><Send className="size-4" /> Forward to business</Button>}
                    <Button size="sm" variant="secondary" onClick={() => appAction(a, "accept")}><Check className="size-4" /> Accept</Button>
                    <Button size="sm" variant="ghost" className="!text-rose-300 hover:!bg-rose-500/10" onClick={() => appAction(a, "reject")}><X className="size-4" /> Reject</Button>
                  </div>
                )}
              </Card>
            ));
          })()}
        </div>
      )}
    </div>
  );
}
