"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Crown, Film, Video, Gamepad2, Eye, Heart, MessageSquare, Share2, Clock, Trophy, Star, Zap } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { NameWithId } from "@/components/NameWithId";
import { withBase } from "@/lib/base-path";
import { profileHrefOf } from "@/lib/profile-href";
import { useConfig } from "@/lib/config";
import { frameImageOf } from "@/lib/frames";
import { framesOnIn } from "@/lib/module-frames";

interface ContentRow { rank: number; userId: string; publicId?: string; name: string; username: string; avatar: string; level: number; count: number; views: number; likes: number; comments: number; shares: number; watchSeconds: number; engagement: number; equippedFrame?: string }
interface GamesRow { rank: number; userId: string; publicId?: string; name: string; username: string; avatar: string; level: number; tier: string; tierEmoji: string; wins: number; games: number; points: number; equippedFrame?: string }

type Category = "reels" | "videos" | "games";
type Range = "day" | "week" | "month" | "all";

const compact = (n: number) => (n < 1000 ? String(n) : n < 1_000_000 ? `${(n / 1000).toFixed(1)}k`.replace(".0", "") : `${(n / 1_000_000).toFixed(1)}M`);
const fmtWatch = (s: number) => { if (!s) return "0m"; const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return h ? `${h}h ${m}m` : m ? `${m}m` : `${s}s`; };

const CATEGORIES: { key: Category; label: string; icon: typeof Film }[] = [
  { key: "reels", label: "Reels", icon: Film },
  { key: "videos", label: "Videos", icon: Video },
  { key: "games", label: "Games", icon: Gamepad2 },
];
const RANGES: { key: Range; label: string }[] = [
  { key: "day", label: "Daily" }, { key: "week", label: "Weekly" }, { key: "month", label: "Monthly" }, { key: "all", label: "All-Time" },
];

export default function LeaderboardPage() {
  const { config } = useConfig();
  const [category, setCategory] = useState<Category>("reels");
  const [range, setRange] = useState<Range>("all");
  const [rows, setRows] = useState<(ContentRow | GamesRow)[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch(withBase(`/api/leaderboard?category=${category}&range=${range}`), { credentials: "include", cache: "no-store" })
      .then((r) => r.json()).then((d) => { setRows(d.rows ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [category, range]);
  useEffect(() => { load(); }, [load]);

  const medal = (r: number) => (r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : String(r));

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-4 flex items-center gap-2">
        <Crown className="size-6 text-gold-300" />
        <h1 className="text-2xl font-extrabold text-mist-100">Leaderboards</h1>
      </div>

      {/* Category tabs */}
      <div className="mb-3 flex gap-1 rounded-full bg-ink-800/70 p-1">
        {CATEGORIES.map((c) => (
          <button key={c.key} onClick={() => setCategory(c.key)} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition sm:text-sm", category === c.key ? "bg-gradient-to-r from-lotus-500 to-petal-500 text-white shadow" : "text-mist-300 hover:text-mist-100")}>
            <c.icon className="size-4" /> {c.label}
          </button>
        ))}
      </div>
      {/* Range filter */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {RANGES.map((r) => (
          <button key={r.key} onClick={() => setRange(r.key)} className={cn("rounded-full px-3 py-1 text-xs font-semibold transition", range === r.key ? "bg-lotus-600 text-white" : "bg-ink-800 text-mist-300 hover:text-mist-100")}>{r.label}</button>
        ))}
      </div>

      {loading ? (
        <div className="grid h-40 place-items-center text-mist-400"><span className="animate-pulse text-sm">Loading rankings…</span></div>
      ) : rows.length === 0 ? (
        <Card className="grid h-40 place-items-center px-6 text-center text-sm text-mist-400">
          {category === "games" ? "No ranked players in this period yet — play some games!" : `No ranked ${category} in this period yet — post some to climb the board!`}
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Link key={row.userId} href={profileHrefOf(row.username, undefined, row.userId)}>
              <Card className={cn("flex items-center gap-3 p-2.5 transition hover:bg-white/[0.03]", row.rank <= 3 && "border-gold-400/25 bg-gold-500/[0.04]")}>
                <span className="grid w-8 shrink-0 place-items-center text-lg font-bold text-mist-200">{medal(row.rank)}</span>
                <Avatar name={row.name} src={row.avatar ? withBase(row.avatar) : undefined} size="md" frameImage={framesOnIn(config, "leaderboard") && row.equippedFrame ? frameImageOf(config, row.equippedFrame) : undefined} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-mist-100">
                    {/* Name AND member ID — several members share a display name,
                        so a name on its own does not identify anyone. */}
                    <NameWithId name={row.name} publicId={row.publicId} inline />
                  </p>
                  <p className="truncate text-xs text-mist-400">@{row.username} · Lv {row.level}</p>
                </div>
                {category === "games" ? <GamesStats row={row as GamesRow} /> : <ContentStats row={row as ContentRow} kind={category} />}
              </Card>
            </Link>
          ))}
        </div>
      )}

      <p className="mt-4 text-center text-xs text-mist-500">
        {category === "games"
          ? "Ranked by points (wins & matches). Daily/Weekly/Monthly count games from that period; All-Time uses your total XP."
          : `Ranked by total ${category === "videos" ? "video" : "reel"} views. Periods count ${category} you posted in that window.`}
      </p>
    </div>
  );
}

function ContentStats({ row, kind }: { row: ContentRow; kind: Category }) {
  return (
    <div className="shrink-0 text-right">
      <p className="flex items-center justify-end gap-1 text-base font-extrabold text-mist-100"><Eye className="size-4 text-sky-300" /> {compact(row.views)}</p>
      <div className="flex items-center justify-end gap-2 text-[11px] text-mist-400">
        <span className="flex items-center gap-0.5"><Heart className="size-3 text-rose-300" /> {compact(row.likes)}</span>
        <span className="flex items-center gap-0.5"><MessageSquare className="size-3 text-violet-300" /> {compact(row.comments)}</span>
        <span className="flex items-center gap-0.5"><Share2 className="size-3 text-fuchsia-300" /> {compact(row.shares)}</span>
      </div>
      <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-gold-300">
        {kind === "videos" ? <><Clock className="size-3" /> {fmtWatch(row.watchSeconds)}</> : <><Zap className="size-3" /> {compact(row.engagement)} pts</>}
      </p>
    </div>
  );
}

function GamesStats({ row }: { row: GamesRow }) {
  return (
    <div className="shrink-0 text-right">
      <p className="flex items-center justify-end gap-1 text-base font-extrabold text-mist-100"><Star className="size-4 text-gold-300" /> {compact(row.points)}</p>
      <div className="flex items-center justify-end gap-2 text-[11px] text-mist-400">
        <span className="flex items-center gap-0.5"><Trophy className="size-3 text-gold-300" /> {compact(row.wins)}</span>
        <span className="flex items-center gap-0.5"><Gamepad2 className="size-3" /> {compact(row.games)}</span>
      </div>
      <p className="mt-0.5 text-[11px] text-lotus-300">{row.tierEmoji} {row.tier}</p>
    </div>
  );
}
