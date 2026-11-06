"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { GiftsReceived } from "@/components/social/GiftsReceived";
import { ProfileReels } from "@/components/reels/ProfileReels";
import { BrandImg } from "@/components/BrandImg";
import { AgencyBadge } from "@/components/AgencyBadge";
import { withBase } from "@/lib/base-path";
import { profileHref } from "@/lib/profile-href";
import { ConnectionsModal } from "@/components/social/ConnectionsModal";
import { useConfig } from "@/lib/config";
import { frameImageOf } from "@/lib/frames";
import { storeImageOf, nameEffectCss } from "@/lib/store";
import { framesOnIn, badgesOnIn } from "@/lib/module-frames";
import { cn } from "@/lib/cn";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  CheckCircle2,
  UserPlus,
  UserCheck,
  MessageCircle,
  Mic,
  Trophy,
  Gamepad2,
  Star,
  Flame,
  Crown,
  Award,
  Users2,
  Share2,
  Lock,
  ChevronRight,
} from "lucide-react";

const BADGES = [
  { icon: Trophy, label: "Winner", tone: "from-gold-300 to-gold-500" },
  { icon: Flame, label: "Challenger", tone: "from-rose-400 to-rose-600" },
  { icon: Star, label: "Active Player", tone: "from-lotus-400 to-lotus-600" },
  { icon: Crown, label: "Champion", tone: "from-amber-300 to-amber-500" },
];

const TABS = ["Overview", "Reels", "Videos", "Badges", "Activity"] as const;

/** A glowing wavy sparkline used on the overview stat cards. */
function Sparkline({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 220 56" preserveAspectRatio="none" className="mt-4 h-12 w-full">
      <path
        d="M2,46 C24,44 34,22 56,27 C78,32 88,43 110,34 C132,25 142,11 164,17 C186,23 196,11 214,9"
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 4px ${color}aa)` }}
      />
      <circle cx="214" cy="9" r="4.5" fill={color} style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
    </svg>
  );
}

export function PublicProfile({ user, agency, locked = false, isPrivate = false, initiallyFollowing = false, initialFriendState = "none" }: {
  user: User;
  agency?: { id: string; name: string };
  locked?: boolean; // gate: hide details until both follow each other / it's private
  isPrivate?: boolean; // the user set their profile to Private (shows a badge)
  initiallyFollowing?: boolean;
  initialFriendState?: string; // "friends" | "incoming" | "outgoing" | "none"
}) {
  const [following, setFollowing] = useState(initiallyFollowing);
  const [friendState, setFriendState] = useState<string>(initialFriendState);
  const [friendBusy, setFriendBusy] = useState(false);
  const [listType, setListType] = useState<null | "followers" | "following" | "friends">(null);
  const { toast } = useToast();
  const { config } = useConfig();
  const router = useRouter();

  const winRate = user.stats.gamesPlayed
    ? Math.round((user.stats.wins / user.stats.gamesPlayed) * 100)
    : 0;

  const socialStats = [
    { key: "followers" as const, label: "Followers", value: user.stats.followers, tile: "bg-lotus-500/15 text-lotus-300" },
    { key: "following" as const, label: "Following", value: user.stats.following, tile: "bg-sky-500/15 text-sky-300" },
    { key: "friends" as const, label: "Friends", value: user.stats.friends, tile: "bg-emerald-500/15 text-emerald-300" },
  ];

  const overview = [
    {
      value: user.stats.gamesPlayed,
      label: "Games Played",
      icon: Gamepad2,
      ring: "bg-lotus-500/15 text-lotus-300",
      card: "border-lotus-500/20 bg-lotus-500/[0.06]",
      line: "#a78bfa",
    },
    {
      value: user.stats.tournamentWins,
      label: "Tournaments Won",
      icon: Trophy,
      ring: "bg-gold-500/15 text-gold-300",
      card: "border-gold-500/20 bg-gold-500/[0.06]",
      line: "#fbbf24",
    },
    {
      value: `${winRate}%`,
      label: "Win Rate",
      icon: Star,
      ring: "bg-emerald-500/15 text-emerald-300",
      card: "border-emerald-500/20 bg-emerald-500/[0.06]",
      line: "#34d399",
    },
  ];

  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const first = user.fullName.split(" ")[0];

  const toggleFollow = () => {
    const next = !following;
    setFollowing(next);
    toast(next ? `Following ${user.fullName}` : `Unfollowed ${user.fullName}`, next ? "success" : "info");
    fetch(withBase("/api/follow"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ userId: user.id }),
    }).catch(() => {});
  };

  // Send a REAL friend request. Previously this button only showed a fake toast
  // and never called the server, so the other user never received the request.
  // Already-friends / already-requested users just open the Friends page instead.
  const addFriend = async () => {
    if (friendBusy) return;
    if (friendState === "friends" || friendState === "outgoing") return;
    if (friendState === "incoming") { router.push("/friends"); return; } // go accept
    setFriendBusy(true);
    try {
      const res = await fetch(withBase("/api/friends"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ otherId: user.id, action: "add" }),
      });
      if (res.ok) { setFriendState("outgoing"); toast(`Friend request sent to ${first}`, "success"); }
      else {
        const d = await res.json().catch(() => ({}));
        toast(d.error ?? "Could not send the friend request", "error");
      }
    } catch {
      toast("Could not send the friend request", "error");
    } finally {
      setFriendBusy(false);
    }
  };
  const friendLabel = friendBusy ? "Sending…"
    : friendState === "friends" ? "Friends"
    : friendState === "outgoing" ? "Requested"
    : friendState === "incoming" ? "Respond"
    : "Add friend";

  return (
    <div className="mx-auto max-w-5xl">
      <button
        onClick={() => {
          // router.back() is a no-op when this profile was opened in a FRESH tab
          // (e.g. admin "View profile") — there's no history to return to. Fall back
          // to Home in that case so Back always does something.
          if (typeof window !== "undefined" && window.history.length > 1) router.back();
          else router.push("/");
        }}
        className="mb-4 inline-flex items-center gap-2 text-sm text-mist-400 hover:text-mist-100"
      >
        <ArrowLeft className="size-4" /> Back
      </button>

      {/* ===== Hero banner (matches the main profile interface) ===== */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10">
        {/* Store background (equipped, non-expired) wins over the cover photo. */}
        {storeImageOf(config, user.equipped?.background) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={storeImageOf(config, user.equipped?.background)} alt="" className="absolute inset-0 size-full object-cover" />
        ) : user.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.cover.startsWith("data:") ? user.cover : withBase(user.cover)} alt="" className="absolute inset-0 size-full object-cover" />
        ) : null}
        <div className={cn("absolute inset-0 bg-gradient-to-b from-lotus-700/55 via-[#241b46]/70 to-ink-900", (user.cover || storeImageOf(config, user.equipped?.background)) && "from-ink-950/60 via-ink-950/70 to-ink-900")} />
        <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_28%_-15%,rgba(139,92,246,0.5),transparent_62%)]" />
        {/* Equipped Store overlay (decorative, non-expired). */}
        {storeImageOf(config, user.equipped?.overlay) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={storeImageOf(config, user.equipped?.overlay)} alt="" className="pointer-events-none absolute inset-0 size-full object-cover" />
        )}

        {/* Floating glossy 3D objects */}
        <BrandImg slot="objDice" className="pointer-events-none absolute left-5 top-4 w-14 rotate-6 animate-float drop-shadow-xl" />
        <BrandImg slot="objCoin" className="pointer-events-none absolute right-[34%] top-24 hidden w-12 -rotate-6 animate-float-slow drop-shadow-xl sm:block" />
        <BrandImg slot="objGem" className="pointer-events-none absolute right-8 top-1/2 hidden w-12 rotate-3 animate-float drop-shadow-xl sm:block" />

        <div className="relative p-5 sm:p-8">
          {/* Identity */}
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative shrink-0">
              <span className="absolute -inset-2 rounded-full bg-gradient-to-br from-white/40 via-lotus-300/50 to-petal-400/50 blur-md" />
              <span className="relative block rounded-full bg-gradient-to-br from-white/80 to-lotus-400/60 p-[3px]">
                <Avatar name={user.fullName} src={user.avatar} size="2xl" status={user.status} gift={user.receivedGifts?.[0]?.emoji} frameImage={framesOnIn(config, "profile") ? frameImageOf(config, user.equippedFrame) : undefined} />
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="flex flex-wrap items-center gap-2 font-display text-3xl font-extrabold text-white">
                <span style={nameEffectCss(config, user.equipped?.nameEffect)}>{user.fullName}</span>
                {user.verified && <CheckCircle2 className="size-6 text-lotus-300" />}
                {badgesOnIn(config, "profile") && storeImageOf(config, user.equipped?.badge) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={storeImageOf(config, user.equipped?.badge)} alt="badge" className="size-7 object-contain" />
                )}
                {isPrivate && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-lotus-500/15 px-2.5 py-1 text-[11px] font-bold text-lotus-200" title="This is a private account">
                    <Lock className="size-3" /> Private Account
                  </span>
                )}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-sm text-mist-300">
                <span>@{user.username}</span>
                {/* The agency this user belongs to — shown beside their name. */}
                {agency && <AgencyBadge name={agency.name} id={agency.id} />}
                <Badge tone="lotus">Level {user.level}</Badge>
                {user.publicId && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-ink-800 px-2.5 py-0.5 font-mono text-xs font-semibold text-mist-200" title="User ID">
                    🆔 {user.publicId}
                  </span>
                )}
              </div>
              {user.bio && <p className="mt-3 text-mist-200">{user.bio}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-mist-400">
                {user.city && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-4" /> {user.city}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Calendar className="size-4" /> Joined{" "}
                  {new Date(user.joinedAt).toLocaleDateString("en-SA", { month: "short", year: "numeric" })}
                </span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="my-6 border-t border-white/10" />

          {/* Social stats + actions. The count tiles are CLICKABLE — tapping one
              opens the list of exactly who those followers / following / friends
              are. When the profile is locked (mutual-follow gate), the counts are
              still shown but the lists and the rest of the profile are hidden. */}
          <div className="flex flex-wrap items-center gap-x-7 gap-y-4">
            {socialStats.map((s) => (
              <button
                key={s.label}
                onClick={() => !locked && setListType(s.key)}
                disabled={locked}
                title={locked ? "Follow each other to see this list" : `See who the ${s.label.toLowerCase()} are`}
                className={cn(
                  "group flex items-center gap-2.5 rounded-xl border p-1.5 pr-3 text-left transition",
                  locked
                    ? "cursor-not-allowed border-transparent"
                    : "cursor-pointer border-white/10 hover:border-lotus-400/50 hover:bg-white/[0.06] active:scale-[0.98]",
                )}
              >
                <span className={`grid size-11 place-items-center rounded-xl ${s.tile}`}>
                  <Users2 className="size-5" />
                </span>
                <div>
                  <div className="font-display text-lg font-bold text-mist-100">
                    {s.value.toLocaleString("en-SA")}
                  </div>
                  {/* Underlined + chevron so it reads as a LINK. Without this the
                      tiles worked but looked inert, so nobody tapped them. */}
                  <div className={cn("flex items-center gap-0.5 text-xs", locked ? "text-mist-400" : "text-lotus-300 underline decoration-lotus-400/40 underline-offset-2")}>
                    {s.label}
                    {!locked && <ChevronRight className="size-3 transition group-hover:translate-x-0.5" />}
                  </div>
                </div>
              </button>
            ))}

            <div className="ml-auto flex flex-wrap gap-2">
              <Button onClick={toggleFollow} variant={following ? "secondary" : "primary"} size="sm">
                {following ? <UserCheck className="size-4" /> : <UserPlus className="size-4" />}
                {following ? "Following" : "Follow"}
              </Button>
              <Button variant="outline" size="sm" onClick={addFriend} disabled={friendBusy || friendState === "friends" || friendState === "outgoing"}>
                {friendState === "friends" && <UserCheck className="size-4" />}{friendLabel}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => router.push(`/messages?to=${encodeURIComponent(user.username)}`)}>
                <MessageCircle className="size-4" /> Message
              </Button>
              <Button variant="ghost" size="sm" onClick={() => toast(`${first} invited to your room`, "success")}>
                <Mic className="size-4" /> Invite
              </Button>
              <Button
                variant="ghost"
                size="sm"
                title="Share profile"
                onClick={async () => {
                  const url = `${typeof window !== "undefined" ? window.location.origin : ""}${withBase(profileHref(user))}`;
                  try { await navigator.clipboard.writeText(url); toast("Profile link copied", "success"); }
                  catch { toast(url, "info"); }
                }}
              >
                <Share2 className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* When locked by the mutual-follow gate, stop here: no stats detail, no tabs. */}
      {locked && (
        <Card className="mt-5 flex flex-col items-center gap-2 p-8 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-lotus-500/15 text-lotus-300"><Lock className="size-6" /></span>
          <h2 className="font-display text-lg font-bold text-mist-100">This profile is private</h2>
          <p className="max-w-sm text-sm text-mist-400">
            {user.fullName} shares their full profile only with people they follow back. Follow them — once they
            follow you back, you&apos;ll both see each other&apos;s full profile.
          </p>
          <Button onClick={toggleFollow} variant={following ? "secondary" : "primary"} size="sm" className="mt-1">
            {following ? <UserCheck className="size-4" /> : <UserPlus className="size-4" />} {following ? "Following" : "Follow"}
          </Button>
        </Card>
      )}

      {listType && (
        <ConnectionsModal user={user.username} type={listType} onClose={() => setListType(null)} />
      )}

      {/* ===== Tabs (hidden entirely when the profile is locked) ===== */}
      {!locked && (<>
      <div className="mt-5 grid grid-cols-5 gap-1 rounded-2xl border border-white/8 bg-ink-850/70 p-1.5">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "relative rounded-xl py-3 text-sm font-semibold transition " +
              (tab === t ? "bg-lotus-600/90 text-white shadow-sm" : "text-mist-400 hover:text-mist-100")
            }
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "Overview" && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              {overview.map((s) => (
                <div key={s.label} className={`relative overflow-hidden rounded-2xl border p-5 ${s.card}`}>
                  <div className="flex items-center gap-3">
                    <span className={`grid size-12 shrink-0 place-items-center rounded-full ${s.ring}`}>
                      <s.icon className="size-6" />
                    </span>
                    <div>
                      <div className="font-display text-3xl font-extrabold text-mist-100">{s.value}</div>
                      <div className="text-sm text-mist-400">{s.label}</div>
                    </div>
                  </div>
                  <Sparkline color={s.line} />
                </div>
              ))}
            </div>
            <GiftsReceived gifts={user.receivedGifts ?? []} name={first} />
          </div>
        )}

        {tab === "Reels" && <ProfileReels username={user.username} kind="reel" />}
        {tab === "Videos" && <ProfileReels username={user.username} kind="video" />}

        {tab === "Badges" && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {BADGES.map((b) => (
              <Card key={b.label} className="flex flex-col items-center gap-2 p-5 text-center">
                <span className={`grid size-12 place-items-center rounded-xl bg-gradient-to-br ${b.tone} text-white shadow-md`}>
                  <b.icon className="size-6" />
                </span>
                <span className="text-sm font-semibold text-mist-100">{b.label}</span>
              </Card>
            ))}
            <Card className="col-span-2 flex items-center gap-4 p-5 sm:col-span-4">
              <Award className="size-8 text-lotus-300" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-mist-100">{first}&apos;s next reward: Win 5 games</div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-700">
                  <div className="h-full w-3/5 rounded-full bg-lotus-500" />
                </div>
              </div>
              <span className="text-sm font-bold text-mist-300">3/5</span>
            </Card>
          </div>
        )}

        {tab === "Activity" && (
          <Card className="divide-y divide-white/[0.06] p-2">
            {[
              [`Won a Ludo match`, "+50 coins", "2h ago"],
              [`Joined room “Chill Hangout”`, "", "5h ago"],
              [`Earned the “Active Player” badge`, "", "1d ago"],
              [`Reached Level ${user.level}`, "", "3d ago"],
            ].map(([text, reward, time]) => (
              <div key={text} className="flex items-center gap-3 px-3 py-3">
                <span className="size-2 rounded-full bg-lotus-400" />
                <span className="flex-1 text-sm text-mist-200">{text}</span>
                {reward && <span className="text-xs font-semibold text-gold-300">{reward}</span>}
                <span className="text-xs text-mist-500">{time}</span>
              </div>
            ))}
          </Card>
        )}
      </div>
      </>)}
    </div>
  );
}

