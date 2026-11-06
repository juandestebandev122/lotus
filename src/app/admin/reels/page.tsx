"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { withBase } from "@/lib/base-path";
import { useConfig, saveConfig } from "@/lib/config";
import {
  fetchAdminReels, adminReelAction,
  type AdminReelRow, type ReelReportRow, type ReelAnalytics,
} from "@/lib/reels";
import {
  Film, Search, Eye, EyeOff, Star, Trash2, Ban, ExternalLink, Pencil,
  Heart, MessageSquare, Share2, Flag, Play, RefreshCw, Video, Users, Building2,
} from "lucide-react";

const compact = (n: number) => (n < 1000 ? String(n) : n < 1_000_000 ? `${(n / 1000).toFixed(1)}k`.replace(".0", "") : `${(n / 1_000_000).toFixed(1)}M`);

const KIND_FILTERS = [["all", "All"], ["reel", "Reels"], ["video", "Videos"], ["business", "Business"]] as const;

export default function AdminReelsPage() {
  const { toast } = useToast();
  const { config, reload } = useConfig();
  const [rows, setRows] = useState<AdminReelRow[]>([]);
  const [reports, setReports] = useState<ReelReportRow[]>([]);
  const [analytics, setAnalytics] = useState<ReelAnalytics>({ total: 0, published: 0, drafts: 0, hidden: 0, featured: 0, views: 0, likes: 0, comments: 0, shares: 0 });
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"reels" | "reports">("reels");
  const [kindF, setKindF] = useState<(typeof KIND_FILTERS)[number][0]>("all");
  const [dateF, setDateF] = useState<"all" | "today" | "yesterday" | "week" | "custom">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulking, setBulking] = useState(false);

  const matchesDate = (iso: string) => {
    if (dateF === "all") return true;
    const t = new Date(iso).getTime();
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (dateF === "today") return t >= startToday;
    if (dateF === "yesterday") return t >= startToday - 86_400_000 && t < startToday;
    if (dateF === "week") return t >= startToday - 6 * 86_400_000;
    // custom range (inclusive)
    const from = fromDate ? new Date(fromDate + "T00:00:00").getTime() : -Infinity;
    const to = toDate ? new Date(toDate + "T23:59:59").getTime() : Infinity;
    return t >= from && t <= to;
  };

  const posting = config.posting ?? {};
  const togglePosting = async (key: "users" | "businesses" | "jobs") => {
    const next = { users: posting.users !== false, businesses: posting.businesses !== false, jobs: posting.jobs !== false, [key]: posting[key] === false };
    const res = await saveConfig({ posting: next });
    if (res.ok) { await reload(); toast(`${key} posting ${next[key] ? "enabled" : "disabled"}`, "success"); }
    else toast("Could not update", "error");
  };
  const visibleRows = rows
    .filter((r) => kindF === "all" ? true : kindF === "business" ? !!r.businessName : r.kind === kindF)
    .filter((r) => matchesDate(r.createdAt));

  const load = useCallback(async (term = "") => {
    setLoading(true);
    const d = await fetchAdminReels(term);
    setRows(d.reels); setReports(d.reports); setAnalytics(d.analytics);
    setSelected(new Set());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: Parameters<typeof adminReelAction>[1], confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    const ok = await adminReelAction(id, action);
    if (ok) { toast("Done", "success"); load(q); }
    else toast("Action failed", "error");
  };

  // ---- Multi-select bulk actions ----
  const toggleSel = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allSelected = visibleRows.length > 0 && visibleRows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(() => allSelected ? new Set() : new Set(visibleRows.map((r) => r.id)));
  const bulk = async (action: "delete" | "hide" | "unhide", confirmMsg?: string) => {
    const ids = [...selected].filter((id) => visibleRows.some((r) => r.id === id));
    if (!ids.length) return;
    if (confirmMsg && !confirm(confirmMsg.replace("{n}", String(ids.length)))) return;
    setBulking(true);
    let ok = 0;
    for (const id of ids) { if (await adminReelAction(id, action)) ok++; }
    setBulking(false);
    toast(`${ok} item${ok === 1 ? "" : "s"} ${action === "delete" ? "deleted" : action === "hide" ? "hidden" : "shown"}`, "success");
    load(q);
  };

  const stats: { label: string; value: number; icon: typeof Eye; tone: string }[] = [
    { label: "Total reels", value: analytics.total, icon: Film, tone: "text-lotus-300" },
    { label: "Published", value: analytics.published, icon: Play, tone: "text-emerald-300" },
    { label: "Drafts", value: analytics.drafts, icon: Pencil, tone: "text-mist-300" },
    { label: "Hidden", value: analytics.hidden, icon: EyeOff, tone: "text-rose-300" },
    { label: "Featured", value: analytics.featured, icon: Star, tone: "text-gold-300" },
    { label: "Views", value: analytics.views, icon: Eye, tone: "text-sky-300" },
    { label: "Likes", value: analytics.likes, icon: Heart, tone: "text-rose-300" },
    { label: "Comments", value: analytics.comments, icon: MessageSquare, tone: "text-violet-300" },
    { label: "Shares", value: analytics.shares, icon: Share2, tone: "text-fuchsia-300" },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-mist-100"><Film className="size-6 text-lotus-300" /> Reels</h1>
        <Button variant="secondary" size="sm" onClick={() => load(q)}><RefreshCw className="size-4" /> Refresh</Button>
      </div>

      {/* Analytics */}
      <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
        {stats.map((s) => (
          <Card key={s.label} className="p-3 text-center">
            <s.icon className={cn("mx-auto mb-1 size-4", s.tone)} />
            <p className="font-display text-lg font-extrabold text-mist-100">{compact(s.value)}</p>
            <p className="text-[10px] text-mist-400">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Posting permissions */}
      <Card className="mb-5 p-4">
        <h2 className="mb-2 text-sm font-bold text-mist-100">Posting permissions</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <PermToggle icon={Users} label="Users can post reels & videos" on={posting.users !== false} onClick={() => togglePosting("users")} />
          <PermToggle icon={Building2} label="Businesses can post reels & videos" on={posting.businesses !== false} onClick={() => togglePosting("businesses")} />
          <PermToggle icon={Film} label="Businesses can post jobs" on={posting.jobs !== false} onClick={() => togglePosting("jobs")} />
        </div>
      </Card>

      {/* Tabs */}
      <div className="mb-4 flex gap-2">
        <button onClick={() => setTab("reels")} className={cn("rounded-full px-4 py-1.5 text-sm font-semibold", tab === "reels" ? "bg-lotus-600 text-white" : "bg-ink-800 text-mist-300")}>All content</button>
        <button onClick={() => setTab("reports")} className={cn("flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold", tab === "reports" ? "bg-lotus-600 text-white" : "bg-ink-800 text-mist-300")}>
          <Flag className="size-3.5" /> Reports {reports.length > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] text-white">{reports.length}</span>}
        </button>
      </div>

      {tab === "reels" ? (
        <>
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-line bg-ink-800 px-3">
            <Search className="size-4 text-mist-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") load(q); }}
              placeholder="Search caption, creator, hashtag or reel ID…"
              className="h-11 flex-1 bg-transparent text-sm text-mist-100 outline-none"
            />
            <Button size="sm" onClick={() => load(q)}>Search</Button>
          </div>

          <div className="mb-3 flex flex-wrap gap-1.5">
            {KIND_FILTERS.map(([k, label]) => (
              <button key={k} onClick={() => setKindF(k)} className={cn("rounded-full px-3 py-1 text-xs font-semibold transition", kindF === k ? "bg-lotus-600 text-white" : "bg-ink-800 text-mist-300 hover:text-mist-100")}>{label}</button>
            ))}
          </div>

          {/* Date filters */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-semibold text-mist-500">Uploaded:</span>
            {([["all", "All time"], ["today", "Today"], ["yesterday", "Yesterday"], ["week", "Last 7 days"], ["custom", "Custom range"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setDateF(k)} className={cn("rounded-full px-3 py-1 text-xs font-semibold transition", dateF === k ? "bg-sky-600 text-white" : "bg-ink-800 text-mist-300 hover:text-mist-100")}>{label}</button>
            ))}
            {dateF === "custom" && (
              <span className="flex items-center gap-1.5">
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-lg border border-line bg-ink-800 px-2 py-1 text-xs text-mist-100 outline-none focus:border-sky-400" />
                <span className="text-xs text-mist-500">to</span>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-lg border border-line bg-ink-800 px-2 py-1 text-xs text-mist-100 outline-none focus:border-sky-400" />
              </span>
            )}
          </div>

          {/* Select-all + bulk actions */}
          {!loading && visibleRows.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-ink-800/60 px-3 py-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-mist-200">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="size-4 accent-lotus-500" />
                Select all ({visibleRows.length})
              </label>
              {selected.size > 0 && (
                <>
                  <span className="text-xs text-lotus-200">{selected.size} selected</span>
                  <div className="ml-auto flex flex-wrap gap-1.5">
                    <Button size="sm" variant="secondary" disabled={bulking} onClick={() => bulk("hide")}><EyeOff className="size-4" /> Hide</Button>
                    <Button size="sm" variant="secondary" disabled={bulking} onClick={() => bulk("unhide")}><Eye className="size-4" /> Unhide</Button>
                    <Button size="sm" variant="ghost" className="!text-rose-300 hover:!bg-rose-500/10" disabled={bulking} onClick={() => bulk("delete", "Delete {n} selected item(s) permanently?")}><Trash2 className="size-4" /> Delete</Button>
                    <Button size="sm" variant="ghost" disabled={bulking} onClick={() => setSelected(new Set())}>Clear</Button>
                  </div>
                </>
              )}
            </div>
          )}

          {loading ? (
            <div className="grid h-40 place-items-center text-mist-400"><span className="animate-pulse text-sm">Loading…</span></div>
          ) : visibleRows.length === 0 ? (
            <Card className="grid h-40 place-items-center text-sm text-mist-400">No content found.</Card>
          ) : (
            <div className="space-y-2">
              {visibleRows.map((r) => (
                <Card key={r.id} className={cn("flex flex-wrap items-center gap-3 p-2.5", selected.has(r.id) && "ring-1 ring-lotus-400/60")}>
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSel(r.id)} className="size-4 shrink-0 accent-lotus-500" />
                  <span className="grid h-16 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-black">
                    {r.thumbUrl ? <img src={withBase(r.thumbUrl)} alt="" className="size-full object-cover" /> : <Film className="size-5 text-mist-600" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-mist-100">{r.caption || "Untitled reel"}</p>
                    <p className="truncate text-xs text-mist-400">@{r.ownerUsername} · {new Date(r.createdAt).toLocaleDateString()}{r.businessName ? ` · ${r.businessName}` : ""}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-mist-300">
                      <span className="flex items-center gap-0.5"><Eye className="size-3" /> {compact(r.views)}</span>
                      <span className="flex items-center gap-0.5"><Heart className="size-3" /> {compact(r.likes)}</span>
                      <span className="flex items-center gap-0.5"><MessageSquare className="size-3" /> {compact(r.comments)}</span>
                      <span className="flex items-center gap-0.5"><Share2 className="size-3" /> {compact(r.shares)}</span>
                      <span className={cn("flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px]", r.kind === "video" ? "bg-violet-500/15 text-violet-300" : "bg-rose-500/15 text-rose-300")}>{r.kind === "video" ? <Video className="size-2.5" /> : <Film className="size-2.5" />} {r.kind}</span>
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[10px]", r.status === "published" ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-mist-300")}>{r.status}</span>
                      <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-mist-300">{r.privacy}</span>
                      {r.hidden && <span className="rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] text-rose-300">hidden</span>}
                      {r.featured && <span className="rounded-full bg-gold-400/15 px-1.5 py-0.5 text-[10px] text-gold-300">★ featured</span>}
                      {r.reportCount > 0 && <span className="rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-200">{r.reportCount} report{r.reportCount === 1 ? "" : "s"}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <a href={withBase(`/reels?r=${r.id}`)} target="_blank" rel="noreferrer" title="View" className="grid size-8 place-items-center rounded-lg bg-ink-800 text-mist-200 hover:bg-ink-700"><ExternalLink className="size-4" /></a>
                    <a href={withBase(`/reels/create?edit=${r.id}`)} target="_blank" rel="noreferrer" title="Edit" className="grid size-8 place-items-center rounded-lg bg-ink-800 text-mist-200 hover:bg-ink-700"><Pencil className="size-4" /></a>
                    <button onClick={() => act(r.id, r.featured ? "unfeature" : "feature")} title={r.featured ? "Unfeature" : "Feature"} className={cn("grid size-8 place-items-center rounded-lg hover:bg-ink-700", r.featured ? "bg-gold-400/20 text-gold-300" : "bg-ink-800 text-mist-200")}><Star className="size-4" /></button>
                    <button onClick={() => act(r.id, r.hidden ? "unhide" : "hide")} title={r.hidden ? "Unhide" : "Hide"} className={cn("grid size-8 place-items-center rounded-lg hover:bg-ink-700", r.hidden ? "bg-rose-500/20 text-rose-300" : "bg-ink-800 text-mist-200")}>{r.hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}</button>
                    <button onClick={() => act(r.id, "block", `Block the creator @${r.ownerUsername}? They won't be able to sign in.`)} title="Block creator" className="grid size-8 place-items-center rounded-lg bg-ink-800 text-amber-300 hover:bg-ink-700"><Ban className="size-4" /></button>
                    <button onClick={() => act(r.id, "delete", "Delete this reel permanently?")} title="Delete" className="grid size-8 place-items-center rounded-lg bg-ink-800 text-rose-300 hover:bg-rose-500/20"><Trash2 className="size-4" /></button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-2">
          {reports.length === 0 ? (
            <Card className="grid h-40 place-items-center text-sm text-mist-400">No reel reports. 🎉</Card>
          ) : reports.map((rep) => (
            <Card key={rep.id} className="flex flex-wrap items-center gap-3 p-3">
              <Flag className="size-4 shrink-0 text-rose-300" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-mist-100"><span className="font-semibold">{rep.category}</span> — {rep.detail}</p>
                <p className="text-xs text-mist-400">Reel by {rep.reportedName} · reported by {rep.byName} · {new Date(rep.at).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-1">
                <a href={withBase(`/reels?r=${rep.reelId}`)} target="_blank" rel="noreferrer" className="grid size-8 place-items-center rounded-lg bg-ink-800 text-mist-200 hover:bg-ink-700"><ExternalLink className="size-4" /></a>
                <button onClick={() => act(rep.reelId, "hide")} title="Hide reel" className="grid size-8 place-items-center rounded-lg bg-ink-800 text-rose-300 hover:bg-ink-700"><EyeOff className="size-4" /></button>
                <button onClick={() => act(rep.reelId, "delete", "Delete this reported reel permanently?")} title="Delete reel" className="grid size-8 place-items-center rounded-lg bg-ink-800 text-rose-300 hover:bg-rose-500/20"><Trash2 className="size-4" /></button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function PermToggle({ icon: Icon, label, on, onClick }: { icon: typeof Users; label: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center justify-between gap-2 rounded-xl border border-line bg-ink-800 p-3 text-left hover:border-white/15">
      <span className="flex items-center gap-2 text-sm text-mist-200"><Icon className="size-4 text-lotus-300" /> {label}</span>
      <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition", on ? "bg-emerald-500" : "bg-ink-700")}>
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition-all", on ? "left-[22px]" : "left-0.5")} />
      </span>
    </button>
  );
}
