"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, getSavedAccounts, type SavedAccount } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { levelProgress, tierForLevel, frameForLevel } from "@/lib/levels";
import { useConfig } from "@/lib/config";
import { frameImageOf } from "@/lib/frames";
import { storeImageOf, nameEffectCss } from "@/lib/store";
import { framesOnIn, badgesOnIn } from "@/lib/module-frames";
import {
  MapPin,
  Calendar,
  Pencil,
  CheckCircle2,
  Trophy,
  Gamepad2,
  Star,
  Crown,
  Flame,
  Award,
  Box,
  ShoppingBag,
  Users2,
  LogOut,
  UserPlus,
  Repeat,
  ShieldCheck,
  Wallet,
  ChevronRight,
  Lock,
} from "lucide-react";
import { ConnectionsModal } from "@/components/social/ConnectionsModal";
import { GiftsReceived } from "@/components/social/GiftsReceived";
import { ProfileReels } from "@/components/reels/ProfileReels";
import { MyAgencyCard } from "@/components/MyAgencyCard";
import { AgencyRequestsPanel } from "@/components/AgencyRequestsPanel";
import { BrandImg } from "@/components/BrandImg";
import { AgencyBadge } from "@/components/AgencyBadge";
import { fetchUserAgency } from "@/lib/agency";
import { IS_PROD_SITE } from "@/lib/prod";

const ACTIVITY: [string, string, string][] = IS_PROD_SITE
  ? []
  : [
      ["Won a Ludo match vs Karan Singh", "+50 coins", "2h ago"],
      ["Joined room “Chill Hangout”", "", "5h ago"],
      ["Earned the “Active Player” badge", "", "1d ago"],
      ["Followed Sneha Verma", "", "2d ago"],
    ];

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

export default function ProfilePage() {
  const { user, logout, switchAccount, refresh } = useAuth();
  const { config } = useConfig();
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [loggingOut, setLoggingOut] = useState(false);
  const [switcher, setSwitcher] = useState(false);
  const [listType, setListType] = useState<null | "followers" | "following" | "friends">(null);
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);
  const [myAgency, setMyAgency] = useState<{ id: string; name: string } | null>(null);
  // Pull the latest level / XP / coins whenever the profile opens, so it's never stale.
  useEffect(() => { refresh(); }, [refresh]);
  // The agency I belong to — shown as a badge next to my name.
  useEffect(() => {
    let active = true;
    if (user?.id) fetchUserAgency(user.id).then((a) => { if (active) setMyAgency(a); });
    return () => { active = false; };
  }, [user?.id]);
  if (!user) return null;

  const handleLogout = async () => {
    setLoggingOut(true);
    // Clears the session cookie + cached user. The app layout unmounts, which
    // tears down the voice session (leaves the room, stops any media we own).
    await logout();
    router.replace("/login");
  };

  const openSwitcher = () => {
    setAccounts(getSavedAccounts());
    setSwitcher(true);
  };

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

  return (
    <div className="mx-auto max-w-5xl">
      {/* ===== Hero banner ===== */}
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
        {/* Equipped Store overlay (decorative, non-expired) over the profile header. */}
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
              <span className="relative block rounded-full p-[3px]" style={{ background: frameForLevel(user.level) }} title={`${tierForLevel(user.level).name} tier`}>
                <Avatar name={user.fullName} src={user.avatar} size="2xl" status="online" gift={user.receivedGifts?.[0]?.emoji} frameImage={framesOnIn(config, "profile") ? frameImageOf(config, user.equippedFrame) : undefined} />
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="flex items-center gap-2 font-display text-3xl font-extrabold text-white">
                <span style={nameEffectCss(config, user.equipped?.nameEffect)}>{user.fullName}</span>
                {user.verified && <CheckCircle2 className="size-6 text-lotus-300" />}
                {/* Purchased badge (Store) next to the name */}
                {badgesOnIn(config, "profile") && storeImageOf(config, user.equipped?.badge) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={storeImageOf(config, user.equipped?.badge)} alt="badge" className="size-7 object-contain" />
                )}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-sm text-mist-300">
                <span>@{user.username}</span>
                {/* The agency I belong to — shown next to my name. */}
                {myAgency && <AgencyBadge name={myAgency.name} id={myAgency.id} />}
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold", tierForLevel(user.level).badgeClass)} title={`${tierForLevel(user.level).name} tier`}>
                  {tierForLevel(user.level).emoji} Level {user.level} · {tierForLevel(user.level).name}
                </span>
                {user.publicId && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-ink-800 px-2.5 py-0.5 font-mono text-xs font-semibold text-mist-200" title="Your permanent User ID">
                    🆔 ID: {user.publicId}
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
                  {new Date(user.joinedAt).toLocaleDateString("en-SA", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="my-6 border-t border-white/10" />

          {/* Social stats + actions. Tapping a tile opens the list of who those
              followers / following / friends actually are — for YOUR OWN account
              too (previously these were inert). */}
          <div className="flex flex-wrap items-center gap-x-7 gap-y-4">
            {socialStats.map((s) => (
              <button
                key={s.label}
                onClick={() => setListType(s.key)}
                title={`See your ${s.label.toLowerCase()}`}
                className="group flex items-center gap-2.5 rounded-xl border border-white/10 p-1.5 pr-3 text-left transition hover:border-lotus-400/50 hover:bg-white/[0.06] active:scale-[0.98]"
              >
                <span className={`grid size-11 place-items-center rounded-xl ${s.tile}`}>
                  <Users2 className="size-5" />
                </span>
                <div>
                  <div className="font-display text-lg font-bold text-mist-100">
                    {s.value.toLocaleString("en-SA")}
                  </div>
                  <div className="flex items-center gap-0.5 text-xs text-lotus-300 underline decoration-lotus-400/40 underline-offset-2">
                    {s.label}
                    <ChevronRight className="size-3 transition group-hover:translate-x-0.5" />
                  </div>
                </div>
              </button>
            ))}
            <div className="ml-auto flex flex-wrap gap-2">
              <ButtonLink href="/wallet" size="sm">
                <Wallet className="size-4" /> Wallet
              </ButtonLink>
              <ButtonLink href="/store" size="sm">
                <ShoppingBag className="size-4" /> Store
              </ButtonLink>
              <ButtonLink href="/customize" variant="secondary" size="sm">
                <Box className="size-4" /> Board &amp; Skins
              </ButtonLink>
              <ButtonLink href="/profile/privacy" variant="secondary" size="sm">
                <Lock className="size-4" /> Privacy
              </ButtonLink>
              <ButtonLink href="/profile/security" variant="secondary" size="sm">
                <ShieldCheck className="size-4" /> Security
              </ButtonLink>
              <ButtonLink href="/profile/edit" size="sm">
                <Pencil className="size-4" /> Edit Profile
              </ButtonLink>
              <Button variant="secondary" size="sm" onClick={handleLogout} disabled={loggingOut} className="!text-rose-300 hover:!bg-rose-500/10">
                <LogOut className="size-4" /> {loggingOut ? "Logging out…" : "Log out"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Tabs ===== */}
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
            {/* My Agency — Join/Change entry (owner/member card, or "Join an Agency"). */}
            <MyAgencyCard promptJoin />
            {/* The user's own request history (join + change), Pending/Approved/Rejected. */}
            <AgencyRequestsPanel />
            {/* Level progress — XP earned automatically from games, gifts, daily logins & purchases. */}
            {(() => {
              const lp = levelProgress(user.xp ?? 0);
              const tier = tierForLevel(lp.level);
              const next = tierForLevel(lp.nextLevel);
              return (
                <div className="overflow-hidden rounded-2xl border border-white/8 bg-ink-850/70 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-12 shrink-0 place-items-center rounded-2xl text-2xl" style={{ background: tier.frame }}>{tier.emoji}</span>
                      <div>
                        <div className="font-display text-xl font-extrabold text-mist-100">Level {lp.level} · {tier.name}</div>
                        <div className="text-xs text-mist-400">{(user.xp ?? 0).toLocaleString("en-SA")} total XP</div>
                      </div>
                    </div>
                    <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", tier.badgeClass)}>{tier.emoji} {tier.name}</span>
                  </div>
                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-xs text-mist-400">
                      <span>Progress to Level {lp.nextLevel}{next.name !== tier.name ? ` · ${next.emoji} ${next.name}` : ""}</span>
                      <span className="tabular-nums">{lp.intoLevel} / {lp.span} XP</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-ink-800">
                      <div className="h-full rounded-full bg-gradient-to-r from-lotus-500 to-petal-400 transition-all" style={{ width: `${lp.pct}%` }} />
                    </div>
                    <p className="mt-1.5 text-xs text-mist-500">{lp.toNext} XP to go — earn XP from games, gifts, daily logins &amp; coin purchases.</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {tier.perks.map((p) => (
                      <span key={p} className="rounded-lg bg-white/[0.04] px-2.5 py-1 text-xs text-mist-300">✓ {p}</span>
                    ))}
                  </div>
                </div>
              );
            })()}
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
            <GiftsReceived gifts={user.receivedGifts ?? []} />
          </div>
        )}

        {tab === "Reels" && <ProfileReels username={user.username} kind="reel" createHref="/reels/create?kind=reel" />}
        {tab === "Videos" && <ProfileReels username={user.username} kind="video" createHref="/reels/create?kind=video" />}

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
                <div className="text-sm font-semibold text-mist-100">Next reward: Win 5 games</div>
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
            {ACTIVITY.length === 0 && (
              <div className="px-3 py-10 text-center text-sm text-mist-400">No activity yet.</div>
            )}
            {ACTIVITY.map(([text, reward, time]) => (
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

      {/* Account — Switch / Log out (always visible, esp. on mobile) */}
      <div className="mt-8 space-y-2.5 border-t border-white/10 pt-6">
        <Button variant="secondary" block onClick={openSwitcher}>
          <Repeat className="size-4" /> Switch account
        </Button>
        <Button variant="secondary" block onClick={handleLogout} disabled={loggingOut} className="!text-rose-300 hover:!bg-rose-500/10">
          <LogOut className="size-4" /> {loggingOut ? "Logging out…" : "Log out of your account"}
        </Button>
      </div>

      {listType && user && (
        <ConnectionsModal user={user.username} type={listType} onClose={() => setListType(null)} />
      )}

      {switcher && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4" onClick={() => setSwitcher(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-1 font-display text-lg font-bold text-mist-100">Switch account</h2>
            <p className="mb-4 text-xs text-mist-400">
              Each account is fully separate. Switching signs you out here and opens the login screen — for your security you&apos;ll enter the password.
            </p>
            <div className="space-y-1.5">
              {accounts.filter((a) => a.id !== user.id).map((a) => (
                <button
                  key={a.id}
                  onClick={() => switchAccount(a.email)}
                  className="flex w-full items-center gap-3 rounded-xl border border-line bg-ink-900 px-3 py-2.5 text-left transition hover:border-lotus-400/40"
                >
                  <Avatar name={a.fullName} src={a.avatar} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-mist-100">{a.fullName}</span>
                    <span className="block truncate text-xs text-mist-400">{a.email}</span>
                  </span>
                </button>
              ))}
              {accounts.filter((a) => a.id !== user.id).length === 0 && (
                <p className="rounded-xl border border-white/8 bg-ink-900 px-3 py-3 text-center text-xs text-mist-500">
                  No other accounts saved on this device yet.
                </p>
              )}
            </div>
            <Button block className="mt-3" onClick={() => switchAccount()}>
              <UserPlus className="size-4" /> Add another account
            </Button>
            <button onClick={() => setSwitcher(false)} className="mt-3 w-full text-center text-xs text-mist-400 hover:text-mist-200">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
