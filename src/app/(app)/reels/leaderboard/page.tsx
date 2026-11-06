"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy, Eye, Heart, Users, ArrowLeft, Film } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { withBase } from "@/lib/base-path";
import { fetchReelLeaderboards, type Reel, type ReelCreatorRank } from "@/lib/reels";
import { profileHrefOf } from "@/lib/profile-href";

const compact = (n: number) => (n < 1000 ? String(n) : n < 1_000_000 ? `${(n / 1000).toFixed(1)}k`.replace(".0", "") : `${(n / 1_000_000).toFixed(1)}M`);

type Tab = "viewed" | "liked" | "creators";

export default function ReelLeaderboardPage() {
  const [tab, setTab] = useState<Tab>("viewed");
  const [data, setData] = useState<{ mostViewed: Reel[]; mostLiked: Reel[]; topCreators: ReelCreatorRank[] }>({ mostViewed: [], mostLiked: [], topCreators: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchReelLeaderboards().then((d) => { setData(d); setLoading(false); }); }, []);

  const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`);

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/reels" className="grid size-9 place-items-center rounded-full bg-ink-800 text-mist-200 hover:bg-ink-700"><ArrowLeft className="size-4" /></Link>
        <h1 className="flex items-center gap-2 text-xl font-extrabold text-mist-100"><Trophy className="size-5 text-gold-300" /> Reel Leaderboards</h1>
      </div>

      <div className="mb-4 flex gap-1 rounded-full bg-ink-800/70 p-1">
        {([["viewed", "Most Viewed", Eye], ["liked", "Most Liked", Heart], ["creators", "Top Creators", Users]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition", tab === k ? "bg-gradient-to-r from-lotus-500 to-petal-500 text-white shadow" : "text-mist-300 hover:text-mist-100")}>
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid h-40 place-items-center text-mist-400"><span className="animate-pulse text-sm">Loading…</span></div>
      ) : (
        <div className="space-y-2">
          {tab !== "creators" && (data[tab === "viewed" ? "mostViewed" : "mostLiked"]).map((r, i) => (
            <Link key={r.id} href={`/reels?r=${r.id}`}>
              <Card className="flex items-center gap-3 p-2.5 transition hover:bg-white/[0.03]">
                <span className="w-7 shrink-0 text-center text-lg font-bold text-mist-200">{medal(i)}</span>
                <span className="grid h-16 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-black">
                  {r.thumbUrl ? <img src={withBase(r.thumbUrl)} alt="" className="size-full object-cover" /> : <Film className="size-5 text-mist-500" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-mist-100">{r.caption || "Untitled reel"}</p>
                  <p className="truncate text-xs text-mist-400">@{r.ownerUsername}</p>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-mist-100">
                  {tab === "viewed" ? <><Eye className="size-4 text-sky-300" /> {compact(r.views)}</> : <><Heart className="size-4 fill-rose-500 text-rose-500" /> {compact(r.likeCount)}</>}
                </span>
              </Card>
            </Link>
          ))}

          {tab === "creators" && data.topCreators.map((c, i) => (
            <Link key={c.userId} href={profileHrefOf(c.username, undefined, c.userId)}>
              <Card className="flex items-center gap-3 p-2.5 transition hover:bg-white/[0.03]">
                <span className="w-7 shrink-0 text-center text-lg font-bold text-mist-200">{medal(i)}</span>
                <Avatar name={c.name} src={c.avatar ? withBase(c.avatar) : undefined} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-mist-100">{c.name}</p>
                  <p className="truncate text-xs text-mist-400">@{c.username} · {c.reels} reel{c.reels === 1 ? "" : "s"}</p>
                </div>
                <div className="shrink-0 text-right text-xs text-mist-300">
                  <p className="flex items-center justify-end gap-1"><Eye className="size-3 text-sky-300" /> {compact(c.views)}</p>
                  <p className="flex items-center justify-end gap-1"><Heart className="size-3 fill-rose-500 text-rose-500" /> {compact(c.likes)}</p>
                </div>
              </Card>
            </Link>
          ))}

          {((tab === "viewed" && data.mostViewed.length === 0) || (tab === "liked" && data.mostLiked.length === 0) || (tab === "creators" && data.topCreators.length === 0)) && (
            <p className="py-10 text-center text-sm text-mist-400">No reels yet — post one to climb the leaderboard!</p>
          )}
        </div>
      )}
    </div>
  );
}
