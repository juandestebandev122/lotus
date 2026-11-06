"use client";

import { CalendarRange, Search } from "lucide-react";
import { cn } from "@/lib/cn";

// A reusable filter bar for every admin report: by specific user, and by
// date / month / year / a custom From–To range.
export interface ReportFilter {
  mode: "all" | "date" | "month" | "year" | "range";
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM
  year: string; // YYYY
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  user: string; // free text (name / id / number)
}

export const emptyReportFilter: ReportFilter = { mode: "all", date: "", month: "", year: "", from: "", to: "", user: "" };

const pad = (n: number) => String(n).padStart(2, "0");

/** Does an item (with the given date + searchable user text) pass the filter? */
export function matchesReportFilter(f: ReportFilter, dateInput: string | number | Date | undefined, userText?: string): boolean {
  if (f.user.trim()) {
    if (!(userText ?? "").toLowerCase().includes(f.user.trim().toLowerCase())) return false;
  }
  if (f.mode === "all") return true;
  const d = dateInput ? new Date(dateInput) : null;
  if (!d || isNaN(d.getTime())) return false;
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const month = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const year = `${d.getFullYear()}`;
  if (f.mode === "date") return !f.date || day === f.date;
  if (f.mode === "month") return !f.month || month === f.month;
  if (f.mode === "year") return !f.year || year === f.year;
  if (f.mode === "range") {
    if (f.from && d < new Date(f.from)) return false;
    if (f.to) { const e = new Date(f.to); e.setHours(23, 59, 59, 999); if (d > e) return false; }
    return true;
  }
  return true;
}

export function ReportFilters({ value, onChange, className }: { value: ReportFilter; onChange: (f: ReportFilter) => void; className?: string }) {
  const set = (patch: Partial<ReportFilter>) => onChange({ ...value, ...patch });
  const field = "h-9 rounded-lg border border-line bg-ink-800 px-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400";
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {/* Filter by specific user */}
      <div className="flex min-w-44 flex-1 items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-2.5">
        <Search className="size-4 text-mist-500" />
        <input value={value.user} onChange={(e) => set({ user: e.target.value })} placeholder="Filter by user (name / ID)…" className="h-9 w-full bg-transparent text-sm text-mist-100 outline-none placeholder:text-mist-500" />
      </div>
      {/* Date mode */}
      <span className="inline-flex items-center gap-1.5 text-xs text-mist-500"><CalendarRange className="size-4 text-lotus-300" /></span>
      <select value={value.mode} onChange={(e) => set({ mode: e.target.value as ReportFilter["mode"] })} aria-label="Filter by" className={field}>
        <option value="all">All time</option>
        <option value="date">By date</option>
        <option value="month">By month</option>
        <option value="year">By year</option>
        <option value="range">Custom range</option>
      </select>
      {value.mode === "date" && <input type="date" value={value.date} onChange={(e) => set({ date: e.target.value })} className={field} />}
      {value.mode === "month" && <input type="month" value={value.month} onChange={(e) => set({ month: e.target.value })} className={field} />}
      {value.mode === "year" && <input type="number" min={2020} max={2100} value={value.year} onChange={(e) => set({ year: e.target.value })} placeholder="Year" className={cn(field, "w-24")} />}
      {value.mode === "range" && (
        <>
          <label className="flex items-center gap-1 text-xs text-mist-400">From <input type="date" value={value.from} onChange={(e) => set({ from: e.target.value })} className={field} /></label>
          <label className="flex items-center gap-1 text-xs text-mist-400">To <input type="date" value={value.to} onChange={(e) => set({ to: e.target.value })} className={field} /></label>
        </>
      )}
    </div>
  );
}
