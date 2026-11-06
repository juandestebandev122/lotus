"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Field, Input, Textarea, Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useConfig } from "@/lib/config";
import { cn } from "@/lib/cn";
import {
  fetchBusinessJobs, postJob, closeJob, deleteJob, applyToJob, decideApplication, JOB_TYPES,
  type JobCard, type ApplicationCard, type JobInput,
} from "@/lib/business";
import { Briefcase, MapPin, Banknote, Plus, Trash2, X, Loader2, Send, Check, Users, Clock } from "lucide-react";

const JOB_STATUS_PILL: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300",
  approved: "bg-emerald-500/15 text-emerald-300",
  rejected: "bg-rose-500/15 text-rose-300",
  closed: "bg-mist-500/15 text-mist-400",
};

const APP_STATUS_PILL: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300",
  forwarded: "bg-sky-500/15 text-sky-300",
  accepted: "bg-emerald-500/15 text-emerald-300",
  rejected: "bg-rose-500/15 text-rose-300",
};
const APP_STATUS_LABEL: Record<string, string> = {
  pending: "With admin",
  forwarded: "Awaiting your reply",
  accepted: "Accepted",
  rejected: "Rejected",
};

export function BusinessJobs({ businessId, canManage }: { businessId: string; canManage: boolean }) {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [applications, setApplications] = useState<ApplicationCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [applyJob, setApplyJob] = useState<JobCard | null>(null);
  const [rejectApp, setRejectApp] = useState<ApplicationCard | null>(null);
  const [busyApp, setBusyApp] = useState("");

  const reload = () => fetchBusinessJobs(businessId).then((d) => { setJobs(d.jobs); setApplications(d.applications); setLoading(false); });
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [businessId]);

  const decide = async (a: ApplicationCard, action: "accept" | "reject", reason?: string) => {
    setBusyApp(a.id + action);
    const r = await decideApplication(a.id, action, reason);
    setBusyApp("");
    if (r.ok) { toast(action === "accept" ? `You accepted ${a.userName}` : `${a.userName} was rejected`, action === "accept" ? "success" : "info"); setRejectApp(null); reload(); }
    else toast(r.error ?? "Failed", "error");
  };

  const doClose = async (j: JobCard) => { const r = await closeJob(j.id); if (r.ok) { toast("Job closed", "success"); reload(); } else toast(r.error ?? "Failed", "error"); };
  const doDelete = async (j: JobCard) => { if (!window.confirm(`Delete "${j.title}"?`)) return; const r = await deleteJob(j.id); if (r.ok) { toast("Job deleted", "success"); reload(); } else toast(r.error ?? "Failed", "error"); };

  if (loading) return <Card className="p-6 text-center text-sm text-mist-500">Loading jobs…</Card>;

  return (
    <div className="space-y-4">
      {canManage && (
        posting ? (
          <JobForm businessId={businessId} onDone={() => { setPosting(false); reload(); }} onCancel={() => setPosting(false)} />
        ) : (
          <Button size="sm" onClick={() => setPosting(true)}><Plus className="size-4" /> Post a job</Button>
        )
      )}

      {/* Owner: applicants — accept / reject with a reason */}
      {canManage && applications.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-mist-100"><Users className="size-4 text-lotus-300" /> Applicants ({applications.length})</h3>
          <div className="space-y-2">
            {applications.map((a) => (
              <div key={a.id} className="rounded-xl border border-line bg-ink-800 p-3">
                <div className="flex items-center gap-2">
                  <Avatar name={a.userName} src={a.userAvatar || undefined} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-mist-100">{a.userName}</p>
                    <p className="truncate text-[11px] text-mist-500">for {a.jobTitle}</p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", APP_STATUS_PILL[a.status])}>{APP_STATUS_LABEL[a.status]}</span>
                </div>
                {a.message && <p className="mt-2 text-xs text-mist-300">{a.message}</p>}
                {a.contact && <p className="mt-1 text-xs text-lotus-300">Contact: {a.contact}</p>}
                {a.status === "rejected" && a.reason && <p className="mt-1 text-xs text-rose-300">Reason given: {a.reason}</p>}
                {/* Owner decides on applicants the admin has forwarded (or any pending one). */}
                {(a.status === "forwarded" || a.status === "pending") && (
                  <div className="mt-2.5 flex flex-wrap gap-2 border-t border-line pt-2.5">
                    <Button size="sm" onClick={() => decide(a, "accept")} disabled={busyApp === a.id + "accept"}>{busyApp === a.id + "accept" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Accept</Button>
                    <Button size="sm" variant="secondary" onClick={() => setRejectApp(a)}><X className="size-4" /> Reject</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {rejectApp && (
        <RejectModal app={rejectApp} busy={busyApp === rejectApp.id + "reject"} onCancel={() => setRejectApp(null)} onReject={(reason) => decide(rejectApp, "reject", reason)} />
      )}

      {jobs.length === 0 ? (
        <Card className="p-8 text-center">
          <Briefcase className="mx-auto size-9 text-mist-500" />
          <p className="mt-2 text-sm text-mist-300">No jobs posted yet.</p>
          {canManage && <p className="text-xs text-mist-500">Post your first job above — it goes live after admin approval.</p>}
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map((j) => (
            <Card key={j.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-mist-100">{j.title}</p>
                  <p className="text-xs text-mist-400">{j.businessName}</p>
                </div>
                {canManage && <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase", JOB_STATUS_PILL[j.status])}>{j.status}</span>}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mist-300">
                <span className="flex items-center gap-1 rounded-md bg-lotus-500/10 px-2 py-0.5 text-lotus-200"><Clock className="size-3" />{j.jobType}</span>
                {j.salary && <span className="flex items-center gap-1"><Banknote className="size-3.5 text-emerald-300" />{j.salary}</span>}
                {j.location && <span className="flex items-center gap-1"><MapPin className="size-3.5" />{j.location}</span>}
              </div>
              {j.description && <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-mist-400">{j.description}</p>}

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                {canManage ? (
                  <>
                    <span className="mr-auto text-xs text-mist-500">{j.applicantCount} applicant{j.applicantCount === 1 ? "" : "s"}</span>
                    {j.status === "approved" && <Button size="sm" variant="secondary" onClick={() => doClose(j)}>Close</Button>}
                    <Button size="sm" variant="ghost" className="!text-rose-300 hover:!bg-rose-500/10" onClick={() => doDelete(j)}><Trash2 className="size-4" /></Button>
                  </>
                ) : (
                  j.applied
                    ? <span className="flex items-center gap-1 text-sm font-semibold text-emerald-300"><Check className="size-4" /> Applied</span>
                    : <Button size="sm" onClick={() => setApplyJob(j)}>Apply now</Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {applyJob && <ApplyModal job={applyJob} onDone={() => { setApplyJob(null); reload(); }} onCancel={() => setApplyJob(null)} />}
    </div>
  );
}

function JobForm({ businessId, onDone, onCancel }: { businessId: string; onDone: () => void; onCancel: () => void }) {
  const { toast } = useToast();
  const { config } = useConfig();
  // Job types are admin-editable (config.business.jobTypes) — fall back to defaults.
  const jobTypes = config.business?.jobTypes?.length ? config.business.jobTypes : JOB_TYPES;
  // Admin-defined EXTRA job-form fields (config.business.jobFields) — no code change.
  const jobFields = (config.business?.jobFields ?? []).filter((cf) => cf.enabled !== false);
  const [f, setF] = useState<JobInput>({ title: "", jobType: jobTypes[0] ?? "Full Time", salary: "", location: "", description: "", qualifications: "", contact: "", deadline: "", fields: {} });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof JobInput, v: string | number) => setF((s) => ({ ...s, [k]: v }));
  const setCustomField = (key: string, v: string) => setF((s) => ({ ...s, fields: { ...(s.fields ?? {}), [key]: v } }));

  const submit = async () => {
    if (!f.title.trim()) { toast("Job title is required.", "error"); return; }
    for (const cf of jobFields) {
      if (cf.required && !(f.fields?.[cf.key] ?? "").trim()) { toast(`Please fill in "${cf.label}".`, "error"); return; }
    }
    setSaving(true);
    const res = await postJob(businessId, f);
    setSaving(false);
    if (!res.ok) { toast(res.error ?? "Could not post", "error"); return; }
    toast("Job submitted — it goes live after admin approval.", "success");
    onDone();
  };

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-mist-100">Post a job</h3>
        <button onClick={onCancel} className="text-mist-500 hover:text-mist-200"><X className="size-4" /></button>
      </div>
      <Field label="Job title *"><Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Sales Executive" maxLength={100} /></Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Type"><Select value={f.jobType} onChange={(e) => set("jobType", e.target.value)}>{jobTypes.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
        <Field label="Salary"><Input value={f.salary ?? ""} onChange={(e) => set("salary", e.target.value)} placeholder="SAR 5,000/month" maxLength={60} /></Field>
        <Field label="Location"><Input value={f.location ?? ""} onChange={(e) => set("location", e.target.value)} placeholder="City / Remote" maxLength={120} /></Field>
      </div>
      <Field label="Description"><Textarea value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Role, responsibilities, requirements…" maxLength={3000} /></Field>
      <Field label="Required qualifications / experience"><Textarea value={f.qualifications ?? ""} onChange={(e) => set("qualifications", e.target.value)} placeholder="e.g. 2+ years in sales, Bachelor's degree…" maxLength={1500} /></Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Vacancies"><Input type="number" min={1} value={f.vacancies ?? ""} onChange={(e) => set("vacancies", e.target.value === "" ? "" : Number(e.target.value))} placeholder="1" /></Field>
        <Field label="Application deadline"><Input type="date" value={f.deadline ?? ""} onChange={(e) => set("deadline", e.target.value)} /></Field>
        <Field label="Contact"><Input value={f.contact ?? ""} onChange={(e) => set("contact", e.target.value)} placeholder="Phone or email" maxLength={160} /></Field>
      </div>
      {/* Admin-defined custom job fields (config.business.jobFields) */}
      {jobFields.map((cf) => (
        <Field key={cf.key} label={cf.required ? `${cf.label} *` : cf.label}>
          {cf.type === "textarea" ? (
            <Textarea value={f.fields?.[cf.key] ?? ""} onChange={(e) => setCustomField(cf.key, e.target.value)} placeholder={cf.placeholder ?? ""} maxLength={500} />
          ) : cf.type === "select" ? (
            <Select value={f.fields?.[cf.key] ?? ""} onChange={(e) => setCustomField(cf.key, e.target.value)}>
              <option value="">Select…</option>
              {(cf.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          ) : (
            <Input
              type={cf.type === "number" ? "number" : cf.type === "email" ? "email" : cf.type === "url" ? "url" : cf.type === "tel" ? "tel" : "text"}
              value={f.fields?.[cf.key] ?? ""}
              onChange={(e) => setCustomField(cf.key, e.target.value)}
              placeholder={cf.placeholder ?? ""}
              maxLength={500}
            />
          )}
        </Field>
      ))}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={submit} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Submit</Button>
      </div>
    </Card>
  );
}

function ApplyModal({ job, onDone, onCancel }: { job: JobCard; onDone: () => void; onCancel: () => void }) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    const res = await applyToJob(job.id, { message, contact });
    setSaving(false);
    if (!res.ok) { toast(res.error ?? "Could not apply", "error"); return; }
    toast("Application sent! It goes to the admin for review before the business sees it.", "success");
    onDone();
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4" onClick={onCancel}>
      <div className="w-full max-w-md space-y-3 rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-mist-100">Apply — {job.title}</h3>
          <button onClick={onCancel} className="text-mist-500 hover:text-mist-200"><X className="size-4" /></button>
        </div>
        <Field label="Message to the employer"><Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell them why you're a good fit…" maxLength={1000} /></Field>
        <Field label="Your contact (phone or email)"><Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="So they can reach you" maxLength={120} /></Field>
        <p className="rounded-lg border border-sky-400/20 bg-sky-500/5 px-3 py-2 text-xs text-sky-200">Your application is reviewed by the admin first, then shared with the business.</p>
        <Button block onClick={submit} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send application</Button>
      </div>
    </div>
  );
}

function RejectModal({ app, busy, onReject, onCancel }: { app: ApplicationCard; busy: boolean; onReject: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4" onClick={onCancel}>
      <div className="w-full max-w-md space-y-3 rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-mist-100">Reject {app.userName}?</h3>
          <button onClick={onCancel} className="text-mist-500 hover:text-mist-200"><X className="size-4" /></button>
        </div>
        <Field label="Reason (shown to the applicant)"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Position filled, or experience not a match…" maxLength={300} /></Field>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button size="sm" onClick={() => onReject(reason.trim())} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />} Reject applicant</Button>
        </div>
      </div>
    </div>
  );
}
