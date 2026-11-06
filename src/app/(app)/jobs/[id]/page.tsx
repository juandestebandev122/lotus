"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Coins, Users, Clock, Briefcase, Building2, GraduationCap, Phone, Send, Loader2, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { useConfig } from "@/lib/config";
import { withBase } from "@/lib/base-path";
import { fetchJob, applyJob, type Job } from "@/lib/jobs";

function fmtDate(iso?: string) { if (!iso) return null; const d = new Date(iso); return Number.isFinite(d.getTime()) ? d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : null; }

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { toast } = useToast();
  const { config } = useConfig();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [applyOpen, setApplyOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => { fetchJob(id).then((j) => { setJob(j); setDone(!!j?.applied); setLoading(false); }); }, [id]);

  const submit = async () => {
    setBusy(true);
    const res = await applyJob(id, { message, contact });
    setBusy(false);
    if (res.ok) { setDone(true); setApplyOpen(false); toast("Application sent! 🎉", "success"); }
    else toast(res.error ?? "Could not apply", "error");
  };

  if (loading) return <div className="grid min-h-[50vh] place-items-center text-mist-400"><span className="animate-pulse text-sm">Loading job…</span></div>;
  if (!job) return (
    <div className="mx-auto max-w-xl">
      <Card className="p-8 text-center"><p className="text-sm text-mist-300">This job isn&apos;t available.</p><ButtonLink href="/jobs" size="sm" className="mt-4"><ArrowLeft className="size-4" /> All jobs</ButtonLink></Card>
    </div>
  );

  const deadline = fmtDate(job.deadline);
  // Admin-defined custom job fields (config.business.jobFields) that were filled in.
  const customRows = (config.business?.jobFields ?? [])
    .map((cf) => ({ icon: Briefcase, label: cf.label, value: (job.fields ?? {})[cf.key] ?? "" }))
    .filter((x) => x.value.trim());
  const rows: { icon: typeof MapPin; label: string; value: string }[] = [
    { icon: Briefcase, label: "Employment type", value: job.jobType },
    ...(job.location ? [{ icon: MapPin, label: "Location", value: job.location }] : []),
    ...(job.salary ? [{ icon: Coins, label: "Salary", value: job.salary }] : []),
    ...(job.vacancies ? [{ icon: Users, label: "Vacancies", value: String(job.vacancies) }] : []),
    ...(deadline ? [{ icon: Clock, label: "Apply before", value: deadline }] : []),
    ...(job.contact ? [{ icon: Phone, label: "Contact", value: job.contact }] : []),
    ...customRows,
  ];

  return (
    <div className="mx-auto w-full max-w-2xl pb-24">
      <Link href="/jobs" className="mb-3 inline-flex items-center gap-1.5 text-sm text-mist-400 hover:text-mist-100"><ArrowLeft className="size-4" /> All jobs</Link>

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <Avatar name={job.businessName} src={job.businessLogo ? withBase(job.businessLogo) : undefined} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-extrabold text-mist-100">{job.title}</h1>
            <Link href={`/business/${job.businessId}`} className="flex items-center gap-1 text-sm text-lotus-300 hover:underline"><Building2 className="size-3.5" /> {job.businessName}</Link>
          </div>
          <span className="shrink-0 rounded-full bg-lotus-500/15 px-2.5 py-1 text-xs font-semibold text-lotus-200">{job.jobType}</span>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2">
              <r.icon className="size-4 shrink-0 text-lotus-300" />
              <div className="min-w-0"><p className="text-[10px] uppercase tracking-wide text-mist-500">{r.label}</p><p className="truncate text-sm font-semibold text-mist-100">{r.value}</p></div>
            </div>
          ))}
        </div>

        <Section title="Job description" icon={Briefcase}>{job.description}</Section>
        {job.qualifications && <Section title="Required qualifications / experience" icon={GraduationCap}>{job.qualifications}</Section>}

        {job.expired && <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-center text-sm text-rose-300">This job's application deadline has passed.</p>}
      </Card>

      {/* Sticky apply bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink-900/95 p-3 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <p className="min-w-0 flex-1 truncate text-xs text-mist-400">{job.applicantCount} applicant{job.applicantCount === 1 ? "" : "s"}</p>
          {done ? (
            <span className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-4 py-2.5 text-sm font-bold text-emerald-300"><CheckCircle2 className="size-4" /> Applied</span>
          ) : (
            <Button disabled={job.expired} onClick={() => setApplyOpen(true)}><Send className="size-4" /> Apply now</Button>
          )}
        </div>
      </div>

      {applyOpen && (
        <div className="fixed inset-0 z-[130] grid place-items-center bg-black/60 p-4" onClick={() => setApplyOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-line bg-ink-900 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-base font-bold text-mist-100">Apply for {job.title}</h3>
            <p className="mb-3 text-xs text-mist-400">Your application goes to our team, who forward it to <span className="font-semibold">{job.businessName}</span>.</p>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Short cover note (why you're a good fit)…" className="mb-2 w-full resize-none rounded-lg border border-line bg-ink-800 p-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400" />
            <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Your phone or email" className="mb-4 w-full rounded-lg border border-line bg-ink-800 p-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400" />
            <div className="flex gap-2">
              <button onClick={() => setApplyOpen(false)} className="flex-1 rounded-lg border border-line py-2 text-sm font-semibold text-mist-200 hover:bg-white/5">Cancel</button>
              <Button block disabled={busy} onClick={submit}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send application</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Briefcase; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h2 className="mb-1.5 flex items-center gap-1.5 text-sm font-bold text-mist-100"><Icon className="size-4 text-lotus-300" /> {title}</h2>
      <p className="whitespace-pre-wrap text-sm text-mist-300">{children}</p>
    </div>
  );
}
