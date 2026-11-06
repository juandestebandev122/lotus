"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LayoutGrid, Search, X, FileText } from "lucide-react";
import { livePages, customPageHref } from "@/lib/custom-pages";
import { useAuth } from "@/lib/auth";
import { useConfig } from "@/lib/config";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { countPages, searchSections, visibleSections, type AppSection } from "@/lib/app-pages";
import { allPagesTileKey } from "@/lib/all-pages-config";
import { lbl, pageLabelKey } from "@/lib/labels";

/**
 * ALL PAGES — the complete, organised directory of the app.
 *
 * Every screen the signed-in user is allowed to open is listed here, grouped by
 * section (Gaming, Voice Rooms, Chat & Calls, Wallet, Tournaments, Agency &
 * Business, and so on). Nothing is hidden behind a menu the user can't find:
 * whatever their permissions allow is on this page, with a one-line explanation
 * of what each screen does, plus a search box for jumping straight to one.
 *
 * Pages the admin has switched off (config.features) and pages the user has no
 * permission for (agency portal, admin panel) are simply not listed.
 */
export default function AllPagesPage() {
  const { user } = useAuth();
  const { config } = useConfig();
  const [q, setQ] = useState("");

  // Agency portal is only shown to people who actually belong to an agency.
  const [hasAgency, setHasAgency] = useState(false);
  useEffect(() => {
    fetch(withBase("/api/my-agency"), { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setHasAgency(!!d?.agency))
      .catch(() => {});
  }, []);

  const isStaff = user?.role === "admin" || !!user?.adminRole;

  // ADMIN CONTROL (Admin → All Pages): the master switch, which sections/tiles
  // appear, their order, and which parts of the screen are shown. Untouched
  // settings keep the built-in behaviour.
  const ap = config.allPages ?? {};
  const directoryOn = ap.enabled !== false;

  const sections = useMemo(() => {
    const base = visibleSections({ features: config.features, hasAgency, isStaff });
    // Pages the admin wrote themselves (Admin → Content Pages) appear here too,
    // so new content is findable without a code change.
    const custom = livePages(config.customPages);
    if (custom.length) {
      base.push({
        key: "custom",
        title: "More from us",
        blurb: "Pages published by the Lotus team.",
        icon: FileText,
        pages: custom.map((p) => ({
          href: customPageHref(p),
          label: p.title,
          desc: p.subtitle || "Read more",
          icon: FileText,
        })),
      });
    }
    return base
      // Hidden sections and hidden tiles never reach a member's screen.
      .filter((s) => ap.sections?.[s.key]?.hidden !== true)
      .map((s) => ({
        ...s,
        pages: [
          ...s.pages.filter((p) => ap.pages?.[allPagesTileKey(s.key, p.label)]?.hidden !== true),
          // Tiles the admin added to this section themselves (Admin → All Pages
          // → Add Content). They sit after the app's own screens.
          ...(ap.customTiles ?? [])
            .filter((t) => t.section === s.key && t.hidden !== true && !!t.href)
            .map((t) => ({ href: t.href, label: t.label, desc: t.desc || "Read more", icon: FileText })),
        ],
      }))
      .filter((s) => s.pages.length > 0)
      // The admin's order wins; anything unordered keeps its catalog position.
      .map((s, i) => ({ s, i, order: ap.sections?.[s.key]?.order }))
      .sort((a, b) => (a.order ?? a.i + 1000) - (b.order ?? b.i + 1000) || a.i - b.i)
      .map((x) => x.s) as AppSection[];
  }, [config.features, config.customPages, hasAgency, isStaff, ap.sections, ap.pages, ap.customTiles]);

  const shown = useMemo(() => searchSections(sections, q), [sections, q]);
  const total = countPages(sections);
  const found = countPages(shown);

  // Switched off by the admin — members get a plain notice instead of the grid.
  if (!directoryOn) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-white/[0.06] text-mist-400">
          <LayoutGrid className="size-6" />
        </span>
        <h1 className="mt-4 font-display text-xl font-bold text-mist-100">Not available</h1>
        <p className="mt-2 text-sm text-mist-400">
          The page directory has been switched off by the administrator. Every screen is still
          reachable from the menu.
        </p>
        <Link href="/home" className="mt-5 inline-flex rounded-xl bg-lotus-500 px-4 py-2 text-sm font-bold text-white hover:bg-lotus-400">
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-lotus-500/15 text-lotus-300">
          <LayoutGrid className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-extrabold text-mist-100">{ap.title?.trim() || "All Pages"}</h1>
          <p className="text-sm text-mist-400">
            {ap.subtitle?.trim() || `Every screen you can open, organised by section — ${total} page${total === 1 ? "" : "s"} available to you.`}
          </p>
        </div>
      </div>

      {/* Search (admin can switch it off) */}
      {ap.showSearch !== false && (
      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mist-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search pages — wallet, ludo, tournament, privacy…"
          className="w-full rounded-xl border border-line bg-ink-900 py-2.5 pl-9 pr-9 text-sm text-mist-100 outline-none placeholder:text-mist-500 focus:border-lotus-400/50"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-mist-400 hover:bg-white/10 hover:text-mist-100"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      )}
      {q && (
        <p className="mt-2 text-xs text-mist-500">
          {found} result{found === 1 ? "" : "s"} for “{q}”
        </p>
      )}

      {/* Section jump links (admin can switch them off) */}
      {!q && ap.showJumpLinks !== false && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {sections.map((s) => (
            <a
              key={s.key}
              href={`#sec-${s.key}`}
              className="rounded-full border border-line bg-ink-900 px-3 py-1 text-xs font-medium text-mist-300 transition hover:border-lotus-400/40 hover:text-mist-100"
            >
              {s.title}
            </a>
          ))}
        </div>
      )}

      {/* Sections */}
      <div className="mt-6 space-y-7">
        {shown.map((s) => (
          <section key={s.key} id={`sec-${s.key}`} className="scroll-mt-24">
            <div className="flex items-center gap-2.5">
              <s.icon className="size-[18px] shrink-0 text-lotus-300" />
              <h2 className="font-display text-base font-bold text-mist-100">{lbl(config.labels, `page.${s.key}.__title`, s.title)}</h2>
              {ap.showCounts !== false && (
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-mist-400">
                  {s.pages.length}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-mist-500">{lbl(config.labels, `page.${s.key}.__blurb`, s.blurb)}</p>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {s.pages.map((p) => (
                <Link
                  key={`${s.key}-${p.label}`}
                  href={p.href}
                  className={cn(
                    "group flex items-start gap-3 rounded-xl border border-line bg-ink-900 px-3.5 py-3 transition",
                    "hover:border-lotus-400/40 hover:bg-ink-850",
                  )}
                >
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-mist-300 transition group-hover:text-lotus-300">
                    <p.icon className="size-[17px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold text-mist-100">{lbl(config.labels, pageLabelKey(s.key, p.label), p.label)}</span>
                      {p.viaRoom && (
                        <span className="rounded-full bg-lotus-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-lotus-300">
                          in a room
                        </span>
                      )}
                      {p.need === "admin" && (
                        <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-300">
                          staff
                        </span>
                      )}
                    </span>
                    {ap.showDescriptions !== false && (
                      <span className="mt-0.5 block text-xs leading-snug text-mist-400">{lbl(config.labels, pageLabelKey(s.key, p.label, "desc"), p.desc)}</span>
                    )}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}

        {shown.length === 0 && (
          <p className="rounded-xl border border-line bg-ink-900 px-4 py-10 text-center text-sm text-mist-500">
            No page matches “{q}”.
          </p>
        )}
      </div>

      {ap.showFooterNote !== false && (
        <p className="mt-8 text-center text-[11px] text-mist-600">
          Pages your account can&apos;t open — and modules the administrator has switched off — are not listed here.
        </p>
      )}
    </div>
  );
}
