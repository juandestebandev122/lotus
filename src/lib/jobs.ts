"use client";

import { withBase } from "./base-path";

export interface Job {
  id: string;
  businessId: string; businessName: string; businessLogo: string;
  title: string; jobType: string; salary?: string; location?: string; description: string;
  qualifications?: string; vacancies?: number; contact?: string; deadline?: string;
  fields?: Record<string, string>;
  status: "pending" | "approved" | "rejected" | "closed"; createdAt: string; expired: boolean;
  applied: boolean; applicantCount: number;
}

export const JOB_TYPES = ["Full Time", "Part Time", "Contract", "Internship", "Remote"] as const;

export async function fetchAllJobs(q = "", type = ""): Promise<Job[]> {
  try {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (type) p.set("type", type);
    const res = await fetch(withBase(`/api/jobs${p.toString() ? `?${p}` : ""}`), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return d.jobs ?? [];
  } catch {
    return [];
  }
}

export async function fetchJob(id: string): Promise<Job | null> {
  try {
    const res = await fetch(withBase(`/api/jobs/${id}`), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return res.ok ? (d.job ?? null) : null;
  } catch {
    return null;
  }
}

export async function applyJob(id: string, input: { message?: string; contact?: string }): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase(`/api/jobs/${id}`), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    const d = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, error: d.error };
  } catch {
    return { ok: false, error: "Network error" };
  }
}
