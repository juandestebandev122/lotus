import Link from "next/link";
import { Greeting } from "@/components/Greeting";
import { HomeMoreOptions } from "@/components/HomeMoreOptions";
import { HomeFeeds } from "@/components/home/HomeFeeds";
import { MyAgencyCard } from "@/components/MyAgencyCard";
import { InstallAppButton } from "@/components/InstallAppButton";
import { AdBanner } from "@/components/AdBanner";
import { FreeCoinsClaim } from "@/components/FreeCoinsClaim";
import { CustomUploads } from "@/components/CustomUploads";
import { HomeFeatureGallery } from "@/components/HomeFeatureGallery";
import { getConfig } from "@/server/repo";
import { lbl } from "@/lib/labels";
import { brandSrc } from "@/lib/brand-images";
import {
  Mic,
  Gem,
  Plus,
  Gamepad2,
  Trophy,
  Users2,
  Gift,
  Sparkles,
  Building2,
  MessageCircle,
  BarChart3,
  Play,
  Swords,
} from "lucide-react";

export const metadata = { title: "Home · LotusPlay Connect" };

// Render on every request so admin-edited text labels, feature toggles and
// announcements from Admin → Text & Labels take effect immediately. Without
// this, Next.js statically pre-renders the home page at BUILD time with the
// default labels baked in, so saved label changes never appear.
export const dynamic = "force-dynamic";

const QUICK_ACTIONS: { icon: typeof Mic; lk: string; label: string; sub: string; href: string; grad: string; feature?: "voiceRooms" | "paidZone" | "chat" | "games" | "business" | "reels" }[] = [
  { icon: Mic, lk: "qa.voiceRooms", label: "Voice Rooms", sub: "Join live conversations", href: "/rooms", grad: "from-rose-500 to-rose-600", feature: "voiceRooms" },
  { icon: Play, lk: "qa.reels", label: "Reels", sub: "Watch & post short videos", href: "/reels", grad: "from-pink-500 to-rose-600", feature: "reels" },
  { icon: Building2, lk: "qa.business", label: "Businesses", sub: "Discover verified businesses", href: "/business", grad: "from-indigo-500 to-blue-600", feature: "business" },
  { icon: Gem, lk: "qa.paidZone", label: "Paid Zone", sub: "Premium 1:1 audio & video", href: "/paid-zone", grad: "from-fuchsia-500 to-purple-600", feature: "paidZone" },
  { icon: MessageCircle, lk: "qa.messages", label: "Messages", sub: "Chat with friends", href: "/messages", grad: "from-emerald-500 to-teal-600", feature: "chat" },
  { icon: Trophy, lk: "qa.tournaments", label: "Tournaments", sub: "Compete & win", href: "/tournaments", grad: "from-amber-400 to-amber-500" },
  { icon: Users2, lk: "qa.findFriends", label: "Find Friends", sub: "Connect & play", href: "/search", grad: "from-sky-500 to-blue-600" },
  { icon: Sparkles, lk: "qa.luckySpin", label: "Lucky Spin", sub: "Spin daily for free coins", href: "/lucky-spin", grad: "from-amber-400 to-orange-500" },
  { icon: Gamepad2, lk: "qa.games", label: "Games", sub: "Play Ludo, Chess & more", href: "/games", grad: "from-rose-500 to-pink-600", feature: "games" },
  { icon: BarChart3, lk: "qa.leaderboards", label: "Leaderboards", sub: "Top players & rankings", href: "/leaderboard", grad: "from-violet-500 to-purple-600" },
  { icon: Swords, lk: "qa.competitions", label: "Competitions", sub: "Sing, vote & win", href: "/competitions", grad: "from-fuchsia-500 to-pink-600", feature: "voiceRooms" },
];

export default async function HomePage() {
  const config = await getConfig();
  const labels = config.labels;
  const features = config.features ?? {};
  const quickActions = QUICK_ACTIONS.filter((a) => !a.feature || features[a.feature] !== false);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Admin advertisements (shown to users) — top banner slot. */}
      <AdBanner position="top" />

      {/* Admin custom uploads — scrolling notice, top banner(s) + a session popup
          (each renders only when the admin has published something for this viewer). */}
      <CustomUploads placement="marquee" variant="marquee" />
      <CustomUploads placement="home-top" />
      <CustomUploads placement="home-popup" variant="popup" />

      {/* ===== Greeting + hero banner ===== */}
      <div>
        <Greeting />
        <div className="relative mt-3 overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(125deg,#ec4899_0%,#d6409f_42%,#7c3aed_100%)] p-6 shadow-[0_22px_60px_-24px_rgba(214,64,160,0.8)] sm:p-8">
          <div className="absolute -right-10 -top-12 size-52 rounded-full bg-amber-300/30 blur-3xl" />
          <div className="relative flex items-center justify-between gap-5">
            <div className="max-w-lg">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                <Gift className="size-3.5" /> {lbl(labels, "home.dailyRewards")}
              </span>
              <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight text-white sm:text-4xl">
                {lbl(labels, "home.heroTitle")}
              </h1>
              <p className="mt-3 max-w-md text-sm text-white/90">
                {lbl(labels, "home.heroSubtitle")}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/rooms" className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-lotus-700 shadow-sm transition hover:bg-white/90">
                  <Mic className="size-4" /> {lbl(labels, "home.joinRoom")}
                </Link>
                <Link href="/rooms" className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/40 bg-white/15 px-5 text-sm font-bold text-white transition hover:bg-white/25">
                  <Plus className="size-4" /> {lbl(labels, "home.createRoom")}
                </Link>
                {/* Install Now — opens the Play Store / APK if a link is set, else
                    fires the browser's PWA install (or shows Add-to-Home-Screen). */}
                <InstallAppButton
                  storeUrl={config.content?.playStoreUrl}
                  apkUrl={config.content?.apkUrl}
                  label={lbl(labels, "home.installNow", "Install Now")}
                />
              </div>
            </div>
            {/* Reward illustration (3D render) */}
            <div className="relative hidden h-60 w-[26rem] shrink-0 lg:block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={brandSrc(config.images, "hero2")} alt="Trophy, game controller and dice" className="size-full animate-float object-contain drop-shadow-[0_22px_44px_rgba(0,0,0,0.4)]" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={brandSrc(config.images, "badgeRewards")} alt="Lotus Rewards" className="absolute right-4 top-0 z-10 w-16 animate-float-slow drop-shadow-lg" />
            </div>
          </div>
        </div>
      </div>

      {/* Every picture and MP4 uploaded at Admin → Site Content → SEO & Home. */}
      <HomeFeatureGallery feature={config.siteContent?.homeFeature} />

      {/* Timed free-coins claim (renders only when the admin turns it on). */}
      <FreeCoinsClaim />

      {/* ===== Quick actions ===== */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {quickActions.map((a) => (
          <Link key={a.label} href={a.href} className="group rounded-2xl border border-white/8 bg-ink-850 p-4 transition-colors hover:border-white/15 hover:bg-ink-800">
            <span className={`grid size-12 place-items-center rounded-xl bg-gradient-to-br ${a.grad} text-white shadow-[0_8px_20px_-10px_rgba(0,0,0,0.7)]`}>
              <a.icon className="size-5" />
            </span>
            <div className="mt-3 font-semibold text-mist-100">{lbl(labels, a.lk, a.label)}</div>
            <div className="text-xs text-mist-400">{lbl(labels, `${a.lk}.sub`, a.sub)}</div>
          </Link>
        ))}
      </div>

      {/* ===== My Agency shortcut (only for agency members) ===== */}
      <MyAgencyCard />

      {/* Admin advertisement — the "In feed" position, between the home rails. */}
      <AdBanner position="feed" />

      {/* ===== Content rails: user/business reels & videos + latest jobs ===== */}
      <HomeFeeds />

      {/* ===== More Options ===== */}
      <HomeMoreOptions />

      {/* ===== Footer ===== */}
      <footer className="border-t border-white/8 pt-6 text-center">
        <p className="text-xs text-mist-500">© 2026 LotusPlay Connect. All rights reserved.</p>
        <p className="mt-1 text-xs font-medium uppercase tracking-[0.2em] text-mist-600">Connect · Chat · Play · Win</p>
      </footer>
    </div>
  );
}
