"use client";

// Shared filter + sort helpers for admin summary/log tables, so every log gets a
// consistent Search box and click-to-sort column headers with minimal per-page code.

import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";

/** A user's NAME (+ optional member ID) linked to their admin account page.
 *  Consistent across every admin log/summary table. */
export function UserLink({ name, publicId, userId, username, showId = true, className }: {
  name: string; publicId?: string; userId?: string; username?: string; showId?: boolean; className?: string;
}) {
  const q = publicId || username || userId || name;
  return (
    <Link href={`/admin/users?q=${encodeURIComponent(q)}`} className={cn("hover:underline", className)}>
      <span className="font-semibold text-mist-100 hover:text-lotus-300">{name}</span>
      {showId && publicId && <span className="ml-1.5 font-mono text-[11px] font-bold text-lotus-300">ID {publicId}</span>}
    </Link>
  );
}

export type SortDir = "asc" | "desc";

/**
 * Pure filter + sort over a list of rows. Callers keep `q` / `sort` / `dir` in
 * state and wrap this in their own useMemo.
 *  - searchText(row) → the text a search query is matched against.
 *  - sortKeys[sort](row) → the value to sort by (number sorts numerically,
 *    string sorts naturally/alphanumerically).
 */
export function applyFilterSort<T>(
  rows: T[],
  opts: {
    q: string;
    sort: string;
    dir: SortDir;
    searchText: (r: T) => string;
    sortKeys: Record<string, (r: T) => string | number>;
  },
): T[] {
  const needle = opts.q.trim().toLowerCase();
  let list = needle ? rows.filter((r) => opts.searchText(r).toLowerCase().includes(needle)) : rows;
  const acc = opts.sortKeys[opts.sort];
  if (acc) {
    const mult = opts.dir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      const av = acc(a), bv = acc(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * mult;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * mult;
    });
  }
  return list;
}

/** A search input styled for admin toolbars. */
export function TableSearch({ value, onChange, placeholder = "Search…", className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <label className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-mist-500" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-line bg-ink-800 pl-8 pr-3 text-sm text-mist-100 outline-none focus:border-lotus-400"
      />
    </label>
  );
}

/** Sort control for CARD lists (where there are no column headings to click):
 *  a "Sort by" dropdown plus an ascending/descending toggle. */
export function SortSelect({ sort, dir, onSort, onDir, options, className }: {
  sort: string; dir: SortDir; onSort: (v: string) => void; onDir: (v: SortDir) => void;
  options: { key: string; label: string }[]; className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <select
        value={sort}
        onChange={(e) => onSort(e.target.value)}
        aria-label="Sort by"
        className="h-9 rounded-lg border border-line bg-ink-800 px-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400"
      >
        {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
      <button
        onClick={() => onDir(dir === "asc" ? "desc" : "asc")}
        title={dir === "asc" ? "Ascending — click for descending" : "Descending — click for ascending"}
        aria-label="Reverse sort order"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-ink-800 text-mist-300 transition hover:text-mist-100"
      >
        {dir === "asc" ? "▲" : "▼"}
      </button>
    </div>
  );
}

/** A sortable `<th>` — click to sort by `col`, click again to flip direction. */
export function SortTh({ col, sort, dir, onSort, children, className, align = "left" }: {
  col: string; sort: string; dir: SortDir; onSort: (col: string) => void;
  children: React.ReactNode; className?: string; align?: "left" | "right";
}) {
  const active = sort === col;
  return (
    <th className={cn("px-4 py-2 font-semibold", align === "right" && "text-right", className)}>
      <button
        onClick={() => onSort(col)}
        className={cn("inline-flex items-center gap-1 uppercase tracking-wide transition hover:text-mist-200", active ? "text-mist-200" : "text-mist-500")}
      >
        {children}
        <span className="text-[9px]">{active ? (dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}
