"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Play, Video, Briefcase, Building2, Heart, Eye, MessageSquare, ChevronRight, UserPlus, UserCheck, Search, FileText, BadgeCheck, Users } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { useConfig } from "@/lib/config";
import { fetchHomeFeeds, toggleFollowUser, type Reel, type HomeFeeds as Feeds } from "@/lib/reels";
import type { Job } from "@/lib/jobs";
import type { BusinessCard } from "@/lib/business";
import { profileHrefOf } from "@/lib/profile-href";

const compact = (n: number) => (n < 1000 ? String(n) : n < 1_000_000 ? `${(n / 1000).toFixed(1)}k`.replace(".0", "") : `${(n / 1_000_000).toFixed(1)}M`);
const rankColor = (i: number) => (i === 0 ? "text-gold-300" : i === 1 ? "text-slate-300" : i === 2 ? "text-amber-500" : "text-mist-400");

export function HomeFeeds() {
  const { config } = useConfig();
  const [feeds, setFeeds] = useState<Feeds>({ trendingShorts: [], trendingVideos: [], latestJobs: [], businesses: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchHomeFeeds().then((f) => { setFeeds(f); setLoading(false); }); }, []);

  const setFollowing = (ownerId: string, following: boolean) =>
    setFeeds((f) => ({
      ...f,
      trendingShorts: f.trendingShorts.map((r) => (r.ownerId === ownerId ? { ...r, following } : r)),
      trendingVideos: f.trendingVideos.map((r) => (r.ownerId === ownerId ? { ...r, following } : r)),
    }));
  const follow = async (r: Reel) => {
    setFollowing(r.ownerId, !r.following);
    const res = await toggleFollowUser(r.ownerId);
    setFollowing(r.ownerId, res.following);
  };

  const reelsOn = config.features?.reels !== false;
  const businessOn = config.features?.business !== false;

  return (
    <div className="space-y-6">
      {/* ===== Trending ranked lists ===== */}
      <div className="grid gap-4 lg:grid-cols-3">
        {reelsOn && (
          <TrendingReels title="Trending Shorts" note="Most Liked" accent="text-rose-300" viewAll="/reels" kind="reel" items={feeds.trendingShorts} loading={loading} onFollow={follow} />
        )}
        {reelsOn && (
          <TrendingReels title="Trending Videos" note="Most Liked" accent="text-violet-300" viewAll="/reels?kind=video" kind="video" items={feeds.trendingVideos} loading={loading} onFollow={follow} />
        )}
        <TrendingJobs items={feeds.latestJobs} loading={loading} />
      </div>

      {/* ===== Business Profiles ===== */}
      {businessOn && <BusinessProfiles items={feeds.businesses} loading={loading} />}

      {/* ===== Category panels ===== */}
      <div className="grid gap-4 lg:grid-cols-3">
        <CategoryPanel title="SHORTS" icon={Play} accent="text-rose-300" tiles={[
          { icon: Play, label: "Fun", sub: "User Reels", href: "/reels?scope=user", grad: "from-rose-500 to-pink-600" },
          { icon: Building2, label: "Business", sub: "Business Reels", href: "/reels?scope=business", grad: "from-amber-400 to-orange-500" },
        ]} />
        <CategoryPanel title="VIDEOS" icon={Video} accent="text-violet-300" tiles={[
          { icon: Play, label: "Fun", sub: "User Videos", href: "/reels?kind=video&scope=user", grad: "from-rose-500 to-pink-600" },
          { icon: Video, label: "Business", sub: "Business Videos", href: "/reels?kind=video&scope=business", grad: "from-indigo-500 to-blue-600" },
        ]} />
        <CategoryPanel title="JOBS" icon={Briefcase} accent="text-amber-300" tiles={[
          { icon: Search, label: "Find Jobs", sub: "Apply & get hired", href: "/jobs", grad: "from-emerald-500 to-teal-600" },
          { icon: FileText, label: "Post a Job", sub: "For businesses", href: "/business/mine", grad: "from-amber-400 to-orange-500" },
        ]} />
      </div>
    </div>
  );
}

function CardShell({ title, note, accent, viewAll, icon: Icon, children }: { title: string; note?: string; accent: string; viewAll: string; icon: typeof Play; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-ink-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className={cn("flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide", accent)}>
          <Icon className="size-4" /> {title} {note && <span className="text-[10px] font-semibold normal-case text-mist-500">({note})</span>}
        </h2>
        <Link href={viewAll} className="inline-flex items-center text-xs font-semibold text-lotus-300 hover:underline">View All <ChevronRight className="size-3.5" /></Link>
      </div>
      {children}
    </div>
  );
}

function TrendingReels({ title, note, accent, viewAll, kind, items, loading, onFollow }: { title: string; note: string; accent: string; viewAll: string; kind: "reel" | "video"; items: Reel[]; loading: boolean; onFollow: (r: Reel) => void }) {
  const icon = kind === "video" ? Video : Play;
  return (
    <CardShell title={title} note={note} accent={accent} viewAll={viewAll} icon={icon}>
      {loading ? (
        <p className="py-6 text-center text-xs text-mist-500 animate-pulse">Loading…</p>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-xs text-mist-500">No {kind === "video" ? "videos" : "shorts"} yet.</p>
      ) : (
        <div className="space-y-1.5">
          {items.slice(0, 10).map((r, i) => (
            <div key={r.id} className="flex items-center gap-2.5 rounded-xl px-1.5 py-1 transition hover:bg-white/[0.04]">
              <span className={cn("w-4 shrink-0 text-center text-sm font-extrabold", rankColor(i))}>{i + 1}</span>
              <Link href={`/reels?r=${r.id}`} className="shrink-0">
                {kind === "video" ? (
                  <span className="grid h-8 w-12 place-items-center overflow-hidden rounded-md bg-black">
                    {r.thumbUrl ? <img src={withBase(r.thumbUrl)} alt="" className="size-full object-cover" /> : <Video className="size-4 text-mist-600" />}
                  </span>
                ) : (
                  <Avatar name={r.ownerName} src={r.ownerAvatar ? withBase(r.ownerAvatar) : undefined} size="sm" />
                )}
              </Link>
              <Link href={profileHrefOf(r.ownerUsername, undefined, r.ownerId)} className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-mist-100">@{r.ownerUsername}</p>
                <p className="flex items-center gap-2 text-[10px] text-mist-400">
                  <span className="flex items-center gap-0.5 font-semibold text-rose-300"><Heart className="size-3 fill-rose-400" /> {compact(r.likeCount)}</span>
                  <span className="flex items-center gap-0.5"><Eye className="size-2.5" /> {compact(r.views)}</span>
                  <span className="flex items-center gap-0.5"><MessageSquare className="size-2.5" /> {compact(r.commentCount)}</span>
                </p>
              </Link>
              {!r.isOwner && (
                <button
                  onClick={() => onFollow(r)}
                  className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold transition", r.following ? "bg-white/10 text-mist-200" : "bg-gradient-to-r from-lotus-500 to-petal-500 text-white")}
                >
                  {r.following ? <span className="flex items-center gap-0.5"><UserCheck className="size-3" /> Following</span> : <span className="flex items-center gap-0.5"><UserPlus className="size-3" /> Follow</span>}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </CardShell>
  );
}

function TrendingJobs({ items, loading }: { items: Job[]; loading: boolean }) {
  const daysLeft = (d?: string) => { if (!d) return null; const n = Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000); return Number.isFinite(n) ? (n < 0 ? null : n === 0 ? "Today" : `${n}d left`) : null; };
  return (
    <CardShell title="Jobs" note="Latest Jobs" accent="text-amber-300" viewAll="/jobs" icon={Briefcase}>
      {loading ? (
        <p className="py-6 text-center text-xs text-mist-500 animate-pulse">Loading…</p>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-xs text-mist-500">No job openings yet.</p>
      ) : (
        <div className="space-y-1.5">
          {items.slice(0, 10).map((j, i) => (
            <Link key={j.id} href={`/jobs/${j.id}`} className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 transition hover:bg-white/[0.04]">
              <span className={cn("w-4 shrink-0 text-center text-sm font-extrabold", rankColor(i))}>{i + 1}</span>
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-lotus-500/15 text-lotus-300"><Building2 className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-mist-100">{j.title}</p>
                <p className="truncate text-[10px] text-mist-400">{j.businessName} · {j.jobType}{daysLeft(j.deadline) ? ` · ` : ""}{daysLeft(j.deadline) && <span className="text-amber-300">{daysLeft(j.deadline)}</span>}</p>
              </div>
              <ChevronRight className="size-3.5 shrink-0 text-mist-500" />
            </Link>
          ))}
        </div>
      )}
    </CardShell>
  );
}

function BusinessProfiles({ items, loading }: { items: BusinessCard[]; loading: boolean }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-ink-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-amber-200">
          <Building2 className="size-4" /> Business Profiles
        </h2>
        <Link href="/business" className="inline-flex items-center text-xs font-semibold text-lotus-300 hover:underline">View All <ChevronRight className="size-3.5" /></Link>
      </div>
      {loading ? (
        <p className="py-6 text-center text-xs text-mist-500 animate-pulse">Loading…</p>
      ) : items.length === 0 ? (
        <div className="py-6 text-center">
          <Building2 className="mx-auto mb-1.5 size-6 text-mist-600" />
          <p className="text-xs text-mist-500">No businesses yet.</p>
          <Link href="/business/mine" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-lotus-300 hover:underline">Register your business <ChevronRight className="size-3.5" /></Link>
        </div>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((b) => (
            <Link key={b.id} href={`/business/${b.id}`} className="flex items-center gap-3 rounded-xl border border-white/8 bg-ink-850 p-2.5 transition-colors hover:border-white/15 hover:bg-ink-800">
              <Avatar name={b.name} src={b.logoUrl ? withBase(b.logoUrl) : undefined} size="md" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-sm font-bold text-mist-100">
                  <span className="truncate">{b.name}</span>
                  {b.verified && <BadgeCheck className="size-3.5 shrink-0 text-sky-400" />}
                </p>
                <p className="truncate text-[11px] text-mist-400">{b.category}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[10px] text-mist-500"><Users className="size-2.5" /> {compact(b.followers)} followers</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-mist-500" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryPanel({ title, icon: Icon, accent, tiles }: { title: string; icon: typeof Play; accent: string; tiles: { icon: typeof Play; label: string; sub: string; href: string; grad: string }[] }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-ink-900/40 p-4">
      <h2 className={cn("mb-3 flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wide", accent)}>
        <Icon className="size-4" /> {title}
      </h2>
      <div className="grid grid-cols-2 gap-2.5">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-ink-850 p-3 transition-colors hover:border-white/15 hover:bg-ink-800">
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-white", t.grad)}><t.icon className="size-4" /></span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-mist-100">{t.label}</span>
              <span className="block truncate text-[11px] text-mist-500">{t.sub}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
