"use client";

// CONTENT PERFORMANCE — how Reels and Videos are actually doing.
//
// Three layers, in the order an admin wants them: the overall totals, the same
// totals split per category and per content type, then every individual piece of
// content as a sortable, exportable row.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { downloadCsv, downloadExcel, printPage } from "@/lib/statement-export";
import {
  BarChart3, Eye, Heart, MessageSquare, Share2, Bookmark, RefreshCw, Loader2,
  Search, Download, FileSpreadsheet, Printer, Film, Video as VideoIcon, ArrowUpDown, Info,
} from "lucide-react";

type Row = {
  id: string; title: string; type: "reel" | "video"; category: string;
  owner: string; ownerUsername: string; ownerId: string; ownerPublicId: string; ownerStatus: string;
  status: string;
  views: number; likes: number; comments: number; shares: number; saves: number;
  engagement: number; engagementRate: number; watchSeconds: number; createdAt: string;
};

/** A creator's scoreboard, rebuilt from whatever rows survive the filters. */
type CreatorStat = {
  userId: string; name: string; username: string; publicId: string; accountStatus: string;
  items: number; reels: number; videos: number;
  views: number; likes: number; comments: number; shares: number; saves: number; engagement: number;
  avgViews: number; avgLikes: number;
  bestTitle: string; bestViews: number; bestType: string;
  firstUpload: string; lastUpload: string;
  topCategory: string;
  watchSeconds: number;
};

/** How the creator league table is ranked. */
type RankKey = "items" | "views" | "likes" | "comments" | "shares" | "engagement";
const RANKS: { key: RankKey; label: string }[] = [
  { key: "items", label: "Most uploads" },
  { key: "views", label: "Most views" },
  { key: "likes", label: "Most likes" },
  { key: "comments", label: "Most comments" },
  { key: "shares", label: "Most shares" },
  { key: "engagement", label: "Most engagement" },
];

const DATE_RANGES: { key: string; label: string; days: number | null }[] = [
  { key: "all", label: "All time", days: null },
  { key: "1", label: "Today", days: 1 },
  { key: "7", label: "Last 7 days", days: 7 },
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "90", label: "Last 90 days", days: 90 },
  { key: "custom", label: "Custom range", days: null },
];
type Group = { key: string; items: number; views: number; likes: number; comments: number; shares: number; saves: number; reels: number; videos: number };
type Creator = Group & { userId: string; username: string; published: number; drafts: number; hidden: number; featured: number; watchSeconds: number; bestViews: number; bestTitle: string };
type Totals = { items: number; views: number; likes: number; comments: number; shares: number; saves: number };
type Report = { rows: Row[]; totals: Totals; byCategory: Group[]; byType: Group[]; byCreator: Creator[]; categories: string[]; generatedAt: string };
type Detail = Row & {
  hashtags: string[]; privacy: string; published: boolean; hidden: boolean; featured: boolean;
  businessName?: string; videoUrl?: string; thumbUrl?: string; updatedAt?: string; reportCount: number;
  likedBy: { id: string; name: string; username: string }[];
  savedBy: { id: string; name: string; username: string }[];
  commentList: { id: string; userName: string; text: string; at: string }[];
};

type SortKey = "views" | "likes" | "comments" | "shares" | "date" | "category" | "type" | "engagement";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "views", label: "Views" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" },
  { key: "engagement", label: "Engagement" },
  { key: "date", label: "Date" },
  { key: "category", label: "Category" },
  { key: "type", label: "Content type" },
];

const n = (v: number) => (v ?? 0).toLocaleString("en-SA");
const fmtDate = (iso: string) => {
  try { return new Date(iso).toLocaleDateString("en-SA", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return "—"; }
};
const fmtDateTime = (iso: string) => {
  try { return new Date(iso).toLocaleString("en-SA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return "—"; }
};
const fmtWatch = (s: number) => {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : m ? `${m}m ${s % 60}s` : `${s}s`;
};

export default function ContentPerformancePage() {
  const { toast } = useToast();
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [typeF, setTypeF] = useState<"" | "reel" | "video">("");
  const [catF, setCatF] = useState("");
  const [sort, setSort] = useState<SortKey>("views");
  const [desc, setDesc] = useState(true);
  const [creatorF, setCreatorF] = useState("");          // filter the item list by creator
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // ---- creator league table controls -------------------------------------
  const [rankBy, setRankBy] = useState<RankKey>("views");
  const [rankScope, setRankScope] = useState<"" | "reel" | "video">("");   // separate Reels / Videos reports
  const [rankCat, setRankCat] = useState("");
  const [rankTop, setRankTop] = useState<"10" | "50" | "all">("10");
  const [rankQ, setRankQ] = useState("");
  const [range, setRange] = useState("all");
  const [fromD, setFromD] = useState("");
  const [toD, setToD] = useState("");

  // Full detail for ONE item — fetched on demand so the main report stays light.
  const openDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const r = await fetch(withBase(`/api/admin/content-performance?id=${encodeURIComponent(id)}`), { credentials: "include", cache: "no-store" });
      const j = await r.json();
      if (r.ok) setDetail(j.detail as Detail);
      else toast((j as { error?: string }).error ?? "Could not load the details", "error");
    } catch { toast("Network error", "error"); }
    setDetailLoading(false);
  }, [toast]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(withBase("/api/admin/content-performance"), { credentials: "include", cache: "no-store" });
      const j = await r.json();
      if (r.ok) setData(j as Report);
      else toast((j as { error?: string }).error ?? "Could not load the report", "error");
    } catch { toast("Network error", "error"); }
    setLoading(false);
  }, [toast]);
  useEffect(() => { void load(); }, [load]);

  // Filter first, then sort — so the totals strip below always reflects exactly
  // what is on screen, not the whole library.
  const shown = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    let list = data.rows.filter((r) =>
      (!typeF || r.type === typeF) &&
      (!catF || r.category === catF) &&
      (!creatorF || r.ownerUsername === creatorF) &&
      (!term || r.title.toLowerCase().includes(term) || r.owner.toLowerCase().includes(term) ||
        r.ownerUsername.toLowerCase().includes(term) || r.category.toLowerCase().includes(term)));
    const dir = desc ? -1 : 1;
    const cmp: Record<SortKey, (a: Row, b: Row) => number> = {
      views: (a, b) => a.views - b.views,
      likes: (a, b) => a.likes - b.likes,
      comments: (a, b) => a.comments - b.comments,
      shares: (a, b) => a.shares - b.shares,
      engagement: (a, b) => a.engagement - b.engagement,
      date: (a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0),
      category: (a, b) => a.category.localeCompare(b.category),
      type: (a, b) => a.type.localeCompare(b.type),
    };
    list = [...list].sort((a, b) => cmp[sort](a, b) * dir || b.views - a.views);
    return list;
  }, [data, q, typeF, catF, creatorF, sort, desc]);

  // Totals for what's currently shown.
  const shownTotals = useMemo(() => shown.reduce<Totals>((t, r) => ({
    items: t.items + 1, views: t.views + r.views, likes: t.likes + r.likes,
    comments: t.comments + r.comments, shares: t.shares + r.shares, saves: t.saves + r.saves,
  }), { items: 0, views: 0, likes: 0, comments: 0, shares: 0, saves: 0 }), [shown]);

  const filtered = !!(q.trim() || typeF || catF || creatorF);

  // ── THE CREATOR LEAGUE TABLE ──────────────────────────────────────────────
  // Rebuilt from the rows that survive the date range / content type / category,
  // so every creator total matches exactly the content the filters describe —
  // change the range and the whole table re-totals, rather than showing lifetime
  // numbers under a "Last 7 days" heading.
  const rankRows = useMemo(() => {
    if (!data) return [];
    let list = data.rows;
    const preset = DATE_RANGES.find((d) => d.key === range);
    if (preset?.days) {
      const cut = Date.now() - preset.days * 86_400_000;
      list = list.filter((r) => Date.parse(r.createdAt) >= cut);
    } else if (range === "custom") {
      const from = fromD ? Date.parse(`${fromD}T00:00:00`) : null;
      const to = toD ? Date.parse(`${toD}T23:59:59`) : null;
      list = list.filter((r) => {
        const t = Date.parse(r.createdAt);
        return (from === null || t >= from) && (to === null || t <= to);
      });
    }
    if (rankScope) list = list.filter((r) => r.type === rankScope);
    if (rankCat) list = list.filter((r) => r.category === rankCat);
    return list;
  }, [data, range, fromD, toD, rankScope, rankCat]);

  const creators = useMemo<CreatorStat[]>(() => {
    const by = new Map<string, CreatorStat & { catCount: Map<string, number> }>();
    for (const r of rankRows) {
      const key = r.ownerId || r.ownerUsername;
      if (!by.has(key)) {
        by.set(key, {
          userId: r.ownerId, name: r.owner, username: r.ownerUsername,
          publicId: r.ownerPublicId, accountStatus: r.ownerStatus,
          items: 0, reels: 0, videos: 0, views: 0, likes: 0, comments: 0, shares: 0, saves: 0, engagement: 0,
          avgViews: 0, avgLikes: 0, bestTitle: "", bestViews: -1, bestType: "",
          firstUpload: r.createdAt, lastUpload: r.createdAt, topCategory: "", watchSeconds: 0,
          catCount: new Map(),
        });
      }
      const c = by.get(key)!;
      c.items++;
      if (r.type === "video") c.videos++; else c.reels++;
      c.views += r.views; c.likes += r.likes; c.comments += r.comments;
      c.shares += r.shares; c.saves += r.saves; c.engagement += r.engagement;
      c.watchSeconds += r.watchSeconds;
      if (r.views > c.bestViews) { c.bestViews = r.views; c.bestTitle = r.title; c.bestType = r.type; }
      if (r.createdAt < c.firstUpload) c.firstUpload = r.createdAt;
      if (r.createdAt > c.lastUpload) c.lastUpload = r.createdAt;
      c.catCount.set(r.category, (c.catCount.get(r.category) ?? 0) + 1);
    }
    const out: CreatorStat[] = [];
    for (const c of by.values()) {
      c.avgViews = c.items ? Math.round((c.views / c.items) * 10) / 10 : 0;
      c.avgLikes = c.items ? Math.round((c.likes / c.items) * 10) / 10 : 0;
      c.topCategory = [...c.catCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
      if (c.bestViews < 0) c.bestViews = 0;
      const { catCount: _drop, ...rest } = c;
      void _drop;
      out.push(rest);
    }
    const term = rankQ.trim().toLowerCase();
    const searched = term
      ? out.filter((c) => c.name.toLowerCase().includes(term) || c.username.toLowerCase().includes(term) || (c.publicId ?? "").includes(term))
      : out;
    return searched.sort((a, b) => b[rankBy] - a[rankBy] || b.views - a.views || a.name.localeCompare(b.name));
  }, [rankRows, rankBy, rankQ]);

  const shownCreators = rankTop === "all" ? creators : creators.slice(0, Number(rankTop));

  /** Totals for the slice the league table is describing. */
  const rankTotals = useMemo(() => rankRows.reduce(
    (t, r) => ({
      items: t.items + 1, views: t.views + r.views, likes: t.likes + r.likes,
      comments: t.comments + r.comments, shares: t.shares + r.shares,
      engagement: t.engagement + r.engagement,
      reels: t.reels + (r.type === "reel" ? 1 : 0), videos: t.videos + (r.type === "video" ? 1 : 0),
    }),
    { items: 0, views: 0, likes: 0, comments: 0, shares: 0, engagement: 0, reels: 0, videos: 0 },
  ), [rankRows]);

  const CREATOR_HEADERS = [
    "Rank", "User ID", "Username", "Name", "Account status",
    "Total uploads", "Videos", "Reels",
    "Views", "Likes", "Comments", "Shares", "Saves", "Engagement",
    "Avg views per item", "Avg likes per item",
    "Best item", "Best item views", "Best item type",
    "Top category", "First upload", "Last upload", "Watch time (s)",
  ];
  const creatorExportRows = () => shownCreators.map((c, i) => [
    i + 1, c.publicId || c.userId, `@${c.username}`, c.name, c.accountStatus,
    c.items, c.videos, c.reels,
    c.views, c.likes, c.comments, c.shares, c.saves, c.engagement,
    c.avgViews, c.avgLikes,
    c.bestTitle, c.bestViews, c.bestType,
    c.topCategory, fmtDateTime(c.firstUpload), fmtDateTime(c.lastUpload), c.watchSeconds,
  ] as (string | number)[]);
  const rangeLabel = range === "custom"
    ? `${fromD || "start"} to ${toD || "today"}`
    : (DATE_RANGES.find((d) => d.key === range)?.label ?? "All time");

  // ---- export ----------------------------------------------------------------
  const EXPORT_HEADERS = ["Title", "Type", "Category", "Creator", "Username", "Status", "Views", "Likes", "Comments", "Shares", "Saves", "Engagement", "Engagement %", "Watch time (s)", "Date"];
  const exportRows = () => shown.map((r) => [
    r.title, r.type === "video" ? "Video" : "Reel", r.category, r.owner, `@${r.ownerUsername}`, r.status,
    r.views, r.likes, r.comments, r.shares, r.saves, r.engagement, r.engagementRate, r.watchSeconds, fmtDate(r.createdAt),
  ] as (string | number)[]);
  const stamp = new Date().toISOString().slice(0, 10);
  const doCsv = () => { downloadCsv(`content-performance-${stamp}`, EXPORT_HEADERS, exportRows()); toast(`Exported ${shown.length} row(s) to CSV`, "success"); };
  const doExcel = () => { downloadExcel(`content-performance-${stamp}`, "Content Performance", EXPORT_HEADERS, exportRows()); toast(`Exported ${shown.length} row(s) to Excel`, "success"); };

  const th = (key: SortKey, label: string, right = false) => (
    <th
      onClick={() => { if (sort === key) setDesc((d) => !d); else { setSort(key); setDesc(true); } }}
      className={cn("cursor-pointer select-none whitespace-nowrap px-3 py-2 transition hover:text-mist-100", right ? "text-right" : "text-left", sort === key && "text-lotus-300")}
      title={`Sort by ${label}`}
    >
      {label}{sort === key ? (desc ? " ↓" : " ↑") : ""}
    </th>
  );

  return (
    <div className="space-y-5 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100">
            <BarChart3 className="size-6 text-lotus-300" /> Content Performance
          </h1>
          <p className="mt-1 text-sm text-mist-400">
            Views, likes, comments and shares for every Reel and Video — overall, per category, and item by item.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn("size-4", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      {loading && !data ? (
        <div className="grid h-40 place-items-center text-mist-500"><Loader2 className="size-6 animate-spin" /></div>
      ) : !data ? (
        <Card className="p-8 text-center text-mist-400">Could not load the report.</Card>
      ) : (
        <>
          {/* ── OVERALL TOTALS — all categories, all content ──────────────── */}
          <Card className="p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-mist-400">Total — all categories</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Tile icon={Film} label="Content items" value={data.totals.items} accent />
              <Tile icon={Eye} label="Views" value={data.totals.views} accent />
              <Tile icon={Heart} label="Likes" value={data.totals.likes} />
              <Tile icon={MessageSquare} label="Comments" value={data.totals.comments} />
              <Tile icon={Share2} label="Shares" value={data.totals.shares} />
              <Tile icon={Bookmark} label="Saves" value={data.totals.saves} />
            </div>
          </Card>

          {/* ── BY CONTENT TYPE ──────────────────────────────────────────── */}
          <Card className="p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-mist-400">By content type</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {data.byType.map((g) => (
                <div key={g.key} className="rounded-xl border border-line bg-ink-900 p-4">
                  <p className="flex items-center gap-2 font-display text-base font-bold text-mist-100">
                    {g.key === "Videos" ? <VideoIcon className="size-4 text-lotus-300" /> : <Film className="size-4 text-lotus-300" />}
                    {g.key} <span className="text-xs font-normal text-mist-500">· {n(g.items)} item{g.items === 1 ? "" : "s"}</span>
                  </p>
                  <div className="mt-2.5 grid grid-cols-4 gap-2 text-center">
                    <MiniStat label="Views" value={g.views} />
                    <MiniStat label="Likes" value={g.likes} />
                    <MiniStat label="Comments" value={g.comments} />
                    <MiniStat label="Shares" value={g.shares} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* ── BY CATEGORY ──────────────────────────────────────────────── */}
          <Card className="p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-mist-400">By category</h2>
              <span className="text-[11px] text-mist-500">{data.byCategory.length} categor{data.byCategory.length === 1 ? "y" : "ies"}</span>
            </div>
            <p className="mt-1 flex items-start gap-1.5 text-[11px] text-mist-500">
              <Info className="mt-0.5 size-3 shrink-0 text-lotus-300" />
              <span>
                Reels and Videos don&apos;t have a separate category field — creators tag them, so a post&apos;s
                <b className="text-mist-400"> first hashtag</b> is its category. A business promotion falls back to the
                business name, and anything untagged is grouped under <b className="text-mist-400">Uncategorised</b>.
              </span>
            </p>
            {data.byCategory.length === 0 ? (
              <p className="mt-3 rounded-lg border border-line bg-ink-900 px-4 py-6 text-center text-sm text-mist-500">No content yet.</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-lg border border-line">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="bg-ink-900">
                    <tr className="text-xs text-mist-400">
                      <th className="px-3 py-2 text-left">Category</th>
                      <th className="px-3 py-2 text-right">Items</th>
                      <th className="px-3 py-2 text-right">Reels</th>
                      <th className="px-3 py-2 text-right">Videos</th>
                      <th className="px-3 py-2 text-right">Views</th>
                      <th className="px-3 py-2 text-right">Likes</th>
                      <th className="px-3 py-2 text-right">Comments</th>
                      <th className="px-3 py-2 text-right">Shares</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {data.byCategory.map((g) => (
                      <tr
                        key={g.key}
                        onClick={() => setCatF(catF === g.key ? "" : g.key)}
                        title="Filter the list below by this category"
                        className={cn("cursor-pointer border-t border-line/60 transition hover:bg-white/[0.03]", catF === g.key && "bg-lotus-500/[0.08]")}
                      >
                        <td className="px-3 py-2 font-semibold text-mist-100">{g.key}</td>
                        <td className="px-3 py-2 text-right text-mist-300">{n(g.items)}</td>
                        <td className="px-3 py-2 text-right text-mist-400">{n(g.reels)}</td>
                        <td className="px-3 py-2 text-right text-mist-400">{n(g.videos)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-lotus-200">{n(g.views)}</td>
                        <td className="px-3 py-2 text-right text-mist-300">{n(g.likes)}</td>
                        <td className="px-3 py-2 text-right text-mist-300">{n(g.comments)}</td>
                        <td className="px-3 py-2 text-right text-mist-300">{n(g.shares)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-line bg-ink-900 font-bold">
                      <td className="px-3 py-2 text-mist-100">All categories</td>
                      <td className="px-3 py-2 text-right text-mist-200">{n(data.totals.items)}</td>
                      <td className="px-3 py-2 text-right text-mist-400">{n(data.byType.find((t) => t.key === "Reels")?.items ?? 0)}</td>
                      <td className="px-3 py-2 text-right text-mist-400">{n(data.byType.find((t) => t.key === "Videos")?.items ?? 0)}</td>
                      <td className="px-3 py-2 text-right text-lotus-200">{n(data.totals.views)}</td>
                      <td className="px-3 py-2 text-right text-mist-200">{n(data.totals.likes)}</td>
                      <td className="px-3 py-2 text-right text-mist-200">{n(data.totals.comments)}</td>
                      <td className="px-3 py-2 text-right text-mist-200">{n(data.totals.shares)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>

          {/* ── CREATOR LEAGUE TABLE — who uploads most, who earns most ───── */}
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wide text-mist-400">Top creators</h2>
                <p className="mt-1 max-w-2xl text-[11px] text-mist-500">
                  Who is contributing the most content, and who is earning the most engagement.
                  Every number below is for <b className="text-mist-400">{rangeLabel}</b>
                  {rankScope ? <> · <b className="text-mist-400">{rankScope === "video" ? "Videos" : "Reels"} only</b></> : <> · <b className="text-mist-400">Reels + Videos</b></>}
                  {rankCat ? <> · <b className="text-mist-400">{rankCat}</b></> : null}
                  {" "}— change any control and the whole table re-totals.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="secondary" disabled={!shownCreators.length}
                  onClick={() => { downloadCsv(`top-creators-${stamp}`, CREATOR_HEADERS, creatorExportRows()); toast(`Exported ${shownCreators.length} creator(s) to CSV`, "success"); }}>
                  <Download className="mr-1.5 size-4" /> CSV
                </Button>
                <Button size="sm" variant="secondary" disabled={!shownCreators.length}
                  onClick={() => { downloadExcel(`top-creators-${stamp}`, "Top creators", CREATOR_HEADERS, creatorExportRows()); toast(`Exported ${shownCreators.length} creator(s) to Excel`, "success"); }}>
                  <FileSpreadsheet className="mr-1.5 size-4" /> Excel
                </Button>
                <Button size="sm" variant="secondary" disabled={!shownCreators.length} onClick={printPage}>
                  <Printer className="mr-1.5 size-4" /> Print / PDF
                </Button>
              </div>
            </div>

            {/* ---- controls ---- */}
            <div className="mt-3 space-y-2">
              {/* Rank by */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[11px] font-bold uppercase tracking-wide text-mist-500">Rank by</span>
                {RANKS.map((r) => (
                  <button key={r.key} onClick={() => setRankBy(r.key)}
                    className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition", rankBy === r.key ? "bg-lotus-600 text-white" : "bg-ink-800 text-mist-400 hover:text-mist-100")}>
                    {r.label}
                  </button>
                ))}
              </div>

              {/* Scope + how many */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[11px] font-bold uppercase tracking-wide text-mist-500">Report</span>
                {([["", "Reels + Videos"], ["reel", "Reels only"], ["video", "Videos only"]] as const).map(([k, lbl]) => (
                  <button key={k} onClick={() => setRankScope(k)}
                    className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition", rankScope === k ? "bg-lotus-600 text-white" : "bg-ink-800 text-mist-400 hover:text-mist-100")}>
                    {lbl}
                  </button>
                ))}
                <span className="ml-3 mr-1 text-[11px] font-bold uppercase tracking-wide text-mist-500">Show</span>
                {([["10", "Top 10"], ["50", "Top 50"], ["all", "All users"]] as const).map(([k, lbl]) => (
                  <button key={k} onClick={() => setRankTop(k)}
                    className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition", rankTop === k ? "bg-lotus-600 text-white" : "bg-ink-800 text-mist-400 hover:text-mist-100")}>
                    {lbl}
                  </button>
                ))}
              </div>

              {/* Date range + category + search */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[11px] font-bold uppercase tracking-wide text-mist-500">Dates</span>
                {DATE_RANGES.map((d) => (
                  <button key={d.key} onClick={() => setRange(d.key)}
                    className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition", range === d.key ? "bg-lotus-600 text-white" : "bg-ink-800 text-mist-400 hover:text-mist-100")}>
                    {d.label}
                  </button>
                ))}
                {range === "custom" && (
                  <span className="flex items-center gap-1.5">
                    <input type="date" value={fromD} onChange={(e) => setFromD(e.target.value)} className="h-8 rounded-lg border border-line bg-ink-900 px-2 text-xs text-mist-100 outline-none focus:border-lotus-400" />
                    <span className="text-[11px] text-mist-500">to</span>
                    <input type="date" value={toD} onChange={(e) => setToD(e.target.value)} className="h-8 rounded-lg border border-line bg-ink-900 px-2 text-xs text-mist-100 outline-none focus:border-lotus-400" />
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select value={rankCat} onChange={(e) => setRankCat(e.target.value)} className="h-9 max-w-[14rem] rounded-lg border border-line bg-ink-800 px-2 text-sm text-mist-100 outline-none">
                  <option value="">All categories</option>
                  {data.categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="flex items-center gap-2 rounded-lg border border-line bg-ink-800 px-2.5">
                  <Search className="size-4 text-mist-500" />
                  <input value={rankQ} onChange={(e) => setRankQ(e.target.value)} placeholder="Search name, @username or ID…" className="h-9 w-56 bg-transparent text-sm text-mist-100 outline-none placeholder:text-mist-500" />
                </div>
                {(range !== "all" || rankScope || rankCat || rankQ) && (
                  <button onClick={() => { setRange("all"); setRankScope(""); setRankCat(""); setRankQ(""); setFromD(""); setToD(""); }}
                    className="text-xs font-semibold text-lotus-300 hover:text-lotus-200">Reset</button>
                )}
              </div>
            </div>

            {/* ---- what this slice contains ---- */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-lotus-400/25 bg-lotus-500/[0.06] px-3.5 py-2.5 text-xs text-mist-300">
              <span className="font-bold text-lotus-200">{n(creators.length)} creator{creators.length === 1 ? "" : "s"}</span>
              <span>{n(rankTotals.items)} item{rankTotals.items === 1 ? "" : "s"} ({n(rankTotals.reels)} reels · {n(rankTotals.videos)} videos)</span>
              <span><Eye className="mr-1 inline size-3" />{n(rankTotals.views)}</span>
              <span><Heart className="mr-1 inline size-3" />{n(rankTotals.likes)}</span>
              <span><MessageSquare className="mr-1 inline size-3" />{n(rankTotals.comments)}</span>
              <span><Share2 className="mr-1 inline size-3" />{n(rankTotals.shares)}</span>
            </div>

            {shownCreators.length === 0 ? (
              <p className="mt-3 rounded-lg border border-line bg-ink-900 px-4 py-8 text-center text-sm text-mist-500">
                No content matches those choices.
              </p>
            ) : (
              <div className="mt-3 max-h-[34rem] overflow-auto rounded-lg border border-line">
                <table className="w-full min-w-[1180px] text-sm">
                  <thead className="sticky top-0 bg-ink-900 text-xs text-mist-400">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Creator</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-right">Uploads</th>
                      <th className="px-3 py-2 text-right">Videos</th>
                      <th className="px-3 py-2 text-right">Reels</th>
                      <th className="px-3 py-2 text-right">Views</th>
                      <th className="px-3 py-2 text-right">Likes</th>
                      <th className="px-3 py-2 text-right">Comments</th>
                      <th className="px-3 py-2 text-right">Shares</th>
                      <th className="px-3 py-2 text-right">Engagement</th>
                      <th className="px-3 py-2 text-right">Avg views</th>
                      <th className="px-3 py-2 text-right">Avg likes</th>
                      <th className="px-3 py-2 text-left">Best item</th>
                      <th className="px-3 py-2 text-left">Category</th>
                      <th className="px-3 py-2 text-left">Uploads (first → last)</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {shownCreators.map((c, i) => (
                      <tr
                        key={c.userId || c.username}
                        onClick={() => setCreatorF(creatorF === c.username ? "" : c.username)}
                        title="Show only this creator's content in the item list below"
                        className={cn("cursor-pointer border-t border-line/60 transition hover:bg-white/[0.03]", creatorF === c.username && "bg-lotus-500/[0.08]")}
                      >
                        <td className="px-3 py-2">
                          <span className={cn("grid size-6 place-items-center rounded-full text-[11px] font-black",
                            i === 0 ? "bg-gold-400 text-amber-950" : i < 3 ? "bg-white/15 text-mist-100" : "bg-white/[0.06] text-mist-400")}>
                            {i + 1}
                          </span>
                        </td>
                        <td className="max-w-[14rem] px-3 py-2">
                          <span className="block truncate font-semibold text-mist-100">{c.name}</span>
                          <span className="block truncate text-[11px] text-mist-500">
                            @{c.username}{c.publicId ? <span className="ml-1 font-mono">ID {c.publicId}</span> : null}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                            c.accountStatus === "active" ? "bg-emerald-500/15 text-emerald-300"
                              : c.accountStatus === "deleted" ? "bg-rose-500/15 text-rose-300"
                              : "bg-amber-500/15 text-amber-300")}>
                            {c.accountStatus}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-mist-200">{n(c.items)}</td>
                        <td className="px-3 py-2 text-right text-mist-400">{n(c.videos)}</td>
                        <td className="px-3 py-2 text-right text-mist-400">{n(c.reels)}</td>
                        <td className={cn("px-3 py-2 text-right", rankBy === "views" ? "font-bold text-lotus-200" : "text-mist-300")}>{n(c.views)}</td>
                        <td className={cn("px-3 py-2 text-right", rankBy === "likes" ? "font-bold text-lotus-200" : "text-mist-300")}>{n(c.likes)}</td>
                        <td className={cn("px-3 py-2 text-right", rankBy === "comments" ? "font-bold text-lotus-200" : "text-mist-300")}>{n(c.comments)}</td>
                        <td className={cn("px-3 py-2 text-right", rankBy === "shares" ? "font-bold text-lotus-200" : "text-mist-300")}>{n(c.shares)}</td>
                        <td className={cn("px-3 py-2 text-right", rankBy === "engagement" ? "font-bold text-lotus-200" : "text-mist-300")}>{n(c.engagement)}</td>
                        <td className="px-3 py-2 text-right text-mist-400">{c.avgViews}</td>
                        <td className="px-3 py-2 text-right text-mist-400">{c.avgLikes}</td>
                        <td className="max-w-[13rem] px-3 py-2">
                          <span className="block truncate text-xs text-mist-300" title={c.bestTitle}>{c.bestTitle || "—"}</span>
                          {c.bestTitle && <span className="block text-[10px] text-mist-500">{n(c.bestViews)} views · {c.bestType}</span>}
                        </td>
                        <td className="max-w-[9rem] truncate px-3 py-2 text-xs text-mist-400" title={c.topCategory}>{c.topCategory}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-[11px] text-mist-400">
                          {fmtDateTime(c.firstUpload)}
                          <span className="block text-mist-500">→ {fmtDateTime(c.lastUpload)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-line bg-ink-900 font-bold">
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2 text-mist-100">{rankTop === "all" ? "All creators" : `Top ${rankTop} shown`}</td>
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2 text-right text-mist-200">{n(rankTotals.items)}</td>
                      <td className="px-3 py-2 text-right text-mist-400">{n(rankTotals.videos)}</td>
                      <td className="px-3 py-2 text-right text-mist-400">{n(rankTotals.reels)}</td>
                      <td className="px-3 py-2 text-right text-lotus-200">{n(rankTotals.views)}</td>
                      <td className="px-3 py-2 text-right text-mist-200">{n(rankTotals.likes)}</td>
                      <td className="px-3 py-2 text-right text-mist-200">{n(rankTotals.comments)}</td>
                      <td className="px-3 py-2 text-right text-mist-200">{n(rankTotals.shares)}</td>
                      <td className="px-3 py-2 text-right text-mist-200">{n(rankTotals.engagement)}</td>
                      <td className="px-3 py-2" colSpan={5} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <p className="mt-2 text-[11px] text-mist-500">
              The footer totals cover <b className="text-mist-400">every</b> creator in this slice, not just the rows shown —
              so a Top 10 view still tells you what share of the whole they represent. Exports contain the rows shown, in rank order.
            </p>
          </Card>

          {/* ── EVERY ITEM ───────────────────────────────────────────────── */}
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-mist-400">Every item</h2>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="secondary" onClick={doCsv} disabled={!shown.length}><Download className="mr-1.5 size-4" /> CSV</Button>
                <Button size="sm" variant="secondary" onClick={doExcel} disabled={!shown.length}><FileSpreadsheet className="mr-1.5 size-4" /> Excel</Button>
                <Button size="sm" variant="secondary" onClick={printPage} disabled={!shown.length}><Printer className="mr-1.5 size-4" /> Print / PDF</Button>
              </div>
            </div>

            {/* Filters + sort */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-line bg-ink-800 px-2.5">
                <Search className="size-4 text-mist-500" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, creator, category…" className="h-9 w-56 bg-transparent text-sm text-mist-100 outline-none placeholder:text-mist-500" />
              </div>
              <select value={typeF} onChange={(e) => setTypeF(e.target.value as "" | "reel" | "video")} className="h-9 rounded-lg border border-line bg-ink-800 px-2 text-sm text-mist-100 outline-none">
                <option value="">All content types</option>
                <option value="reel">Reels only</option>
                <option value="video">Videos only</option>
              </select>
              <select value={catF} onChange={(e) => setCatF(e.target.value)} className="h-9 max-w-[13rem] rounded-lg border border-line bg-ink-800 px-2 text-sm text-mist-100 outline-none">
                <option value="">All categories</option>
                {data.categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="ml-auto flex items-center gap-1.5">
                <ArrowUpDown className="size-3.5 text-mist-500" />
                <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-9 rounded-lg border border-line bg-ink-800 px-2 text-sm text-mist-100 outline-none">
                  {SORTS.map((s) => <option key={s.key} value={s.key}>Sort: {s.label}</option>)}
                </select>
                <button onClick={() => setDesc((d) => !d)} title={desc ? "Highest first" : "Lowest first"} className="h-9 rounded-lg border border-line bg-ink-800 px-2.5 text-xs font-semibold text-mist-300 transition hover:text-mist-100">
                  {desc ? "High → low" : "Low → high"}
                </button>
              </span>
            </div>

            {/* Totals for what's on screen right now */}
            {filtered && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-lotus-400/25 bg-lotus-500/[0.06] px-3.5 py-2.5 text-xs text-mist-300">
                <span className="font-bold text-lotus-200">Showing {n(shownTotals.items)} of {n(data.totals.items)}</span>
                <span><Eye className="mr-1 inline size-3" />{n(shownTotals.views)} views</span>
                <span><Heart className="mr-1 inline size-3" />{n(shownTotals.likes)} likes</span>
                <span><MessageSquare className="mr-1 inline size-3" />{n(shownTotals.comments)} comments</span>
                <span><Share2 className="mr-1 inline size-3" />{n(shownTotals.shares)} shares</span>
                <button onClick={() => { setQ(""); setTypeF(""); setCatF(""); setCreatorF(""); }} className="ml-auto font-semibold text-lotus-300 hover:text-lotus-200">Clear filters</button>
              </div>
            )}

            {shown.length === 0 ? (
              <p className="mt-3 rounded-lg border border-line bg-ink-900 px-4 py-8 text-center text-sm text-mist-500">
                {data.totals.items === 0 ? "No Reels or Videos have been posted yet." : "Nothing matches those filters."}
              </p>
            ) : (
              <div className="mt-3 max-h-[34rem] overflow-auto rounded-lg border border-line">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="sticky top-0 bg-ink-900 text-xs text-mist-400">
                    <tr>
                      <th className="px-3 py-2 text-left">Content</th>
                      {th("type", "Type")}
                      {th("category", "Category")}
                      {th("views", "Views", true)}
                      {th("likes", "Likes", true)}
                      {th("comments", "Comments", true)}
                      {th("shares", "Shares", true)}
                      {th("engagement", "Engagement", true)}
                      {th("date", "Date", true)}
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {shown.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => void openDetail(r.id)}
                        title="Open the full details for this item"
                        className={cn("cursor-pointer border-t border-line/60 hover:bg-white/[0.02]", detail?.id === r.id && "bg-lotus-500/[0.08]")}
                      >
                        <td className="max-w-[18rem] px-3 py-2">
                          <span className="block truncate font-medium text-mist-100" title={r.title}>{r.title}</span>
                          <span className="block truncate text-[11px] text-mist-500">
                            {r.owner} · @{r.ownerUsername}
                            {r.status !== "published" ? <span className="ml-1.5 text-amber-300">{r.status}</span> : null}
                            {r.watchSeconds ? <span className="ml-1.5">· watched {fmtWatch(r.watchSeconds)}</span> : null}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", r.type === "video" ? "bg-sky-500/15 text-sky-300" : "bg-lotus-500/15 text-lotus-300")}>
                            {r.type === "video" ? <VideoIcon className="size-3" /> : <Film className="size-3" />}
                            {r.type}
                          </span>
                        </td>
                        <td className="max-w-[10rem] truncate px-3 py-2 text-mist-300" title={r.category}>{r.category}</td>
                        <td className="px-3 py-2 text-right font-semibold text-lotus-200">{n(r.views)}</td>
                        <td className="px-3 py-2 text-right text-mist-300">{n(r.likes)}</td>
                        <td className="px-3 py-2 text-right text-mist-300">{n(r.comments)}</td>
                        <td className="px-3 py-2 text-right text-mist-300">{n(r.shares)}</td>
                        <td className="px-3 py-2 text-right text-mist-300">
                          {n(r.engagement)}
                          {r.views > 0 && <span className="ml-1 text-[10px] text-mist-500">{r.engagementRate}%</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-xs text-mist-400">{fmtDate(r.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 text-[11px] text-mist-500">
              Tip: tap any row for that item&apos;s full details, and tap a column heading to sort (tap again to reverse).
              Exports contain exactly the rows shown, in the order shown.
              Report generated {new Date(data.generatedAt).toLocaleString("en-SA")}.
            </p>
          </Card>

          {/* ── FULL DETAIL FOR ONE ITEM ─────────────────────────────────── */}
          {(detailLoading || detail) && (
            <Card className="p-5">
              {detailLoading ? (
                <div className="grid h-24 place-items-center text-mist-500"><Loader2 className="size-5 animate-spin" /></div>
              ) : detail ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-display text-lg font-bold text-mist-100">{detail.title}</h2>
                      <p className="mt-0.5 text-xs text-mist-400">
                        {detail.owner} · @{detail.ownerUsername} · posted {fmtDate(detail.createdAt)}
                        {detail.businessName ? ` · ${detail.businessName}` : ""}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Pill tone={detail.type === "video" ? "sky" : "lotus"}>{detail.type}</Pill>
                        <Pill>{detail.category}</Pill>
                        <Pill tone={detail.published ? "emerald" : "amber"}>{detail.published ? "published" : "draft"}</Pill>
                        <Pill>{detail.privacy}</Pill>
                        {detail.hidden && <Pill tone="rose">hidden</Pill>}
                        {detail.featured && <Pill tone="gold">featured</Pill>}
                        {detail.reportCount > 0 && <Pill tone="rose">{detail.reportCount} report{detail.reportCount === 1 ? "" : "s"}</Pill>}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {detail.videoUrl && (
                        <a href={withBase(detail.videoUrl)} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-3 py-1.5 text-xs font-semibold text-mist-200 transition hover:border-lotus-400/50">
                          <VideoIcon className="size-3.5" /> Open
                        </a>
                      )}
                      <button onClick={() => setDetail(null)} className="rounded-lg border border-line bg-ink-800 px-3 py-1.5 text-xs font-semibold text-mist-300 transition hover:text-mist-100">Close</button>
                    </div>
                  </div>

                  {/* The same tiles, for THIS one item */}
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <Tile icon={Eye} label="Views" value={detail.views} accent />
                    <Tile icon={Heart} label="Likes" value={detail.likes} />
                    <Tile icon={MessageSquare} label="Comments" value={detail.comments} />
                    <Tile icon={Share2} label="Shares" value={detail.shares} />
                    <Tile icon={Bookmark} label="Saves" value={detail.saves} />
                    <div className="rounded-xl border border-line bg-ink-900 p-3">
                      <BarChart3 className="size-4 text-lotus-300" />
                      <div className="mt-1.5 font-display text-xl font-extrabold tabular-nums text-lotus-200">{detail.engagementRate}%</div>
                      <div className="text-[11px] text-mist-400">Engagement rate</div>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-mist-500">
                    <span>Total engagement: <b className="text-mist-300">{n(detail.engagement)}</b></span>
                    <span>Watch time: <b className="text-mist-300">{fmtWatch(detail.watchSeconds)}</b></span>
                    {detail.hashtags.length > 0 && <span>Hashtags: <b className="text-mist-300">{detail.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}</b></span>}
                    {detail.updatedAt && <span>Last edited: <b className="text-mist-300">{fmtDate(detail.updatedAt)}</b></span>}
                  </div>

                  {/* Who did what */}
                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    <PeopleList title="Liked by" icon={Heart} people={detail.likedBy} empty="No likes yet." />
                    <PeopleList title="Saved by" icon={Bookmark} people={detail.savedBy} empty="Nobody has saved this." />
                    <div className="rounded-xl border border-line bg-ink-900 p-3">
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-mist-200">
                        <MessageSquare className="size-3.5 text-lotus-300" /> Comments
                        <span className="font-normal text-mist-500">({detail.commentList.length})</span>
                      </p>
                      {detail.commentList.length === 0 ? (
                        <p className="py-2 text-center text-[11px] text-mist-500">No comments yet.</p>
                      ) : (
                        <div className="max-h-48 space-y-1.5 overflow-y-auto">
                          {detail.commentList.map((c) => (
                            <div key={c.id} className="rounded-lg bg-white/[0.04] px-2.5 py-1.5">
                              <p className="flex items-baseline justify-between gap-2 text-[11px]">
                                <span className="truncate font-semibold text-mist-200">{c.userName}</span>
                                <span className="shrink-0 text-mist-500">{fmtDate(c.at)}</span>
                              </p>
                              <p className="text-xs text-mist-300">{c.text}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Tile({ icon: Icon, label, value, accent }: { icon: typeof Eye; label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-ink-900 p-3">
      <Icon className={cn("size-4", accent ? "text-lotus-300" : "text-mist-400")} />
      <div className={cn("mt-1.5 font-display text-xl font-extrabold tabular-nums", accent ? "text-lotus-200" : "text-mist-100")}>{n(value)}</div>
      <div className="text-[11px] text-mist-400">{label}</div>
    </div>
  );
}

const PILL_TONE: Record<string, string> = {
  lotus: "bg-lotus-500/15 text-lotus-300",
  sky: "bg-sky-500/15 text-sky-300",
  emerald: "bg-emerald-500/15 text-emerald-300",
  amber: "bg-amber-500/15 text-amber-300",
  rose: "bg-rose-500/15 text-rose-300",
  gold: "bg-gold-500/15 text-gold-300",
  plain: "bg-white/[0.06] text-mist-400",
};
function Pill({ children, tone = "plain" }: { children: React.ReactNode; tone?: keyof typeof PILL_TONE }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", PILL_TONE[tone])}>{children}</span>;
}

function PeopleList({ title, icon: Icon, people, empty }: {
  title: string; icon: typeof Heart; people: { id: string; name: string; username: string }[]; empty: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-ink-900 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-mist-200">
        <Icon className="size-3.5 text-lotus-300" /> {title}
        <span className="font-normal text-mist-500">({people.length})</span>
      </p>
      {people.length === 0 ? (
        <p className="py-2 text-center text-[11px] text-mist-500">{empty}</p>
      ) : (
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {people.map((p) => (
            <div key={p.id} className="flex items-baseline justify-between gap-2 rounded-lg bg-white/[0.04] px-2.5 py-1 text-xs">
              <span className="truncate text-mist-200">{p.name}</span>
              {p.username && <span className="shrink-0 text-[11px] text-mist-500">@{p.username}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white/[0.04] px-2 py-1.5">
      <div className="font-display text-sm font-bold tabular-nums text-mist-100">{n(value)}</div>
      <div className="text-[10px] text-mist-500">{label}</div>
    </div>
  );
}
