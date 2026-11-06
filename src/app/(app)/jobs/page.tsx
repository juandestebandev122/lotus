"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, Search, MapPin, Coins, Users, Clock, ChevronRight, Building2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { withBase } from "@/lib/base-path";
import { fetchAllJobs, JOB_TYPES, type Job } from "@/lib/jobs";

function timeLeft(deadline?: string): string | null {
  if (!deadline) return null;
  const d = new Date(deadline).getTime();
  if (!Number.isFinite(d)) return null;
  const days = Math.ceil((d - Date.now()) / 86_400_000);
  if (days < 0) return "Closed";
  if (days === 0) return "Closes today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);

  const load = (query = q, t = type) => { setLoading(true); fetchAllJobs(query, t).then((j) => { setJobs(j); setLoading(false); }); };
  useEffect(() => { load("", ""); /* eslint-disable-next-line */ }, []);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-1 flex items-center gap-2">
        <Briefcase className="size-6 text-lotus-300" />
        <h1 className="text-2xl font-extrabold text-mist-100">Jobs</h1>
      </div>
      <p className="mb-4 text-sm text-mist-400">Openings posted by verified businesses. Tap a job to see the full details and apply.</p>

      <div className="mb-3 flex items-center gap-2 rounded-xl border border-line bg-ink-800 px-3">
        <Search className="size-4 text-mist-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") load(); }} placeholder="Search title, company or location…" className="h-11 flex-1 bg-transparent text-sm text-mist-100 outline-none" />
        <Button size="sm" onClick={() => load()}>Search</Button>
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {["", ...JOB_TYPES].map((t) => (
          <button key={t || "all"} onClick={() => { setType(t); load(q, t); }} className={cn("rounded-full px-3 py-1 text-xs font-semibold transition", type === t ? "bg-lotus-600 text-white" : "bg-ink-800 text-mist-300 hover:text-mist-100")}>
            {t || "All types"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid h-40 place-items-center text-mist-400"><span className="animate-pulse text-sm">Loading jobs…</span></div>
      ) : jobs.length === 0 ? (
        <Card className="grid h-40 place-items-center px-6 text-center text-sm text-mist-400">No job openings right now. Check back soon!</Card>
      ) : (
        <div className="space-y-2.5">
          {jobs.map((j) => (
            <Link key={j.id} href={`/jobs/${j.id}`}>
              <Card className="flex items-center gap-3 p-3 transition hover:border-white/15 hover:bg-white/[0.03]">
                <Avatar name={j.businessName} src={j.businessLogo ? withBase(j.businessLogo) : undefined} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-mist-100">{j.title}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-mist-400"><Building2 className="size-3" /> {j.businessName}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-mist-300">
                    <span className="rounded-full bg-lotus-500/15 px-2 py-0.5 font-semibold text-lotus-200">{j.jobType}</span>
                    {j.location && <span className="flex items-center gap-0.5"><MapPin className="size-3" /> {j.location}</span>}
                    {j.salary && <span className="flex items-center gap-0.5"><Coins className="size-3 text-gold-300" /> {j.salary}</span>}
                    {j.vacancies ? <span className="flex items-center gap-0.5"><Users className="size-3" /> {j.vacancies} open</span> : null}
                    {timeLeft(j.deadline) && <span className="flex items-center gap-0.5 text-amber-300"><Clock className="size-3" /> {timeLeft(j.deadline)}</span>}
                    {j.applied && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-300">Applied ✓</span>}
                  </div>
                </div>
                <ChevronRight className="size-4 shrink-0 text-mist-500" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
