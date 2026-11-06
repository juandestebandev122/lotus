import { ButtonLink } from "@/components/ui/Button";
import { Logo, LotusMark } from "@/components/Logo";
import { Die } from "@/components/Die";
import { RedirectIfAuthed } from "@/components/RedirectIfAuthed";
import { InstallAppButton } from "@/components/InstallAppButton";
import { getConfig } from "@/server/repo";
import { DEFAULT_SITE_CONTENT, resolveHomePage, listHomeFeature } from "@/lib/site-content-default";
import { HomeFeatureGallery } from "@/components/HomeFeatureGallery";
import { sanitizeSiteNav, defaultSiteNav, visibleFooterColumns, visibleHeaderLinks, renderCopyright } from "@/lib/site-nav";
import { cn } from "@/lib/cn";
import {
  Mic,
  Gamepad2,
  Trophy,
  Users2,
  MessageCircle,
  ShieldCheck,
  Bell,
  Crown,
  Sparkles,
  ArrowRight,
  Star,
  Headphones,
  Dice5,
} from "lucide-react";

const PILLARS = [
  {
    icon: Mic,
    title: "Live Voice Rooms",
    text: "Host or join public, private & password-protected rooms. Talk in real time with crystal-clear voice.",
    tone: "from-lotus-500/20 to-lotus-700/10",
  },
  {
    icon: Gamepad2,
    title: "Multiplayer Games",
    text: "Play Ludo (2–4 players) and Chess with friends — right inside your voice room.",
    tone: "from-petal-500/20 to-petal-700/10",
  },
  {
    icon: Trophy,
    title: "Tournaments",
    text: "Knockout & league formats, live brackets, leaderboards and winner announcements.",
    tone: "from-gold-400/20 to-gold-500/10",
  },
  {
    icon: Users2,
    title: "Communities",
    text: "Build interest-based communities with feeds, chat, announcements and dedicated rooms.",
    tone: "from-emerald-500/20 to-emerald-700/10",
  },
];

const FEATURES = [
  { icon: MessageCircle, title: "Private & Group Chat", text: "1:1 and group messaging with media, voice notes, reactions and read receipts." },
  { icon: Users2, title: "Friends & Follow", text: "Send requests, follow creators, and grow your circle across the platform." },
  { icon: Bell, title: "Smart Notifications", text: "Stay updated on invites, requests, tournaments and rewards in real time." },
  { icon: ShieldCheck, title: "Safe & Moderated", text: "OTP verification, blocking, reporting and powerful host/moderator controls." },
  { icon: Headphones, title: "Voice During Gameplay", text: "Trash-talk, strategize and laugh together while you play — all in voice." },
  { icon: Crown, title: "Rankings & Rewards", text: "Climb leaderboards, earn coins, unlock badges and show off your status." },
];

// The landing page reads admin config (site title, meta description, homepage
// intro, search-console verification) but was rendered ONCE at build time — so
// none of those edits ever appeared on the live site until the next deploy.
// Revalidating keeps the page as fast as a static one (it is served from cache)
// while picking up an admin change within a minute.
export const revalidate = 60;

export async function generateMetadata() {
  const seo = (await getConfig()).siteContent?.seo ?? DEFAULT_SITE_CONTENT.seo!;
  return {
    title: seo.siteTitle,
    description: seo.description,
    keywords: seo.keywords,
    alternates: { canonical: "/" },
  };
}

export default async function LandingPage() {
  const cfg = await getConfig();
  // Admin-managed homepage intro (adds real content for SEO / AdSense).
  const homeIntro = cfg.siteContent?.homeIntro ?? DEFAULT_SITE_CONTENT.homeIntro ?? "";
  // Every picture and MP4 saved at Admin → Site Content → SEO & Home.
  const homeFeature = cfg.siteContent?.homeFeature;
  const homeMedia = listHomeFeature(homeFeature);
  // Every word on this page is admin-editable (Admin -> Site Content -> Home Page).
  // Icons, colours and layout stay in code: that is design, not content.
  const H = resolveHomePage(cfg.siteContent?.homePage);
  // Header + footer navigation, fully admin-managed (Admin → Navigation).
  const nav = sanitizeSiteNav(cfg.siteNav ?? defaultSiteNav());
  const footerCfg = nav.footer ?? {};
  const footerColumns = visibleFooterColumns(nav);
  const headerLinks = visibleHeaderLinks(nav);
  return (
    <div className="relative overflow-x-clip">
      {/* A signed-in user landing here (e.g. via the BACK button) is sent to
          /home, so the public "Log in" page never looks like a logout. */}
      <RedirectIfAuthed />
      {/* ===== NAV ===== */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-ink-950 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:px-6 sm:py-3">
          <div className="min-w-0 shrink">
            <Logo size="lg" />
          </div>
          <nav className="hidden items-center gap-7 text-sm text-mist-300 md:flex">
            <a href="#features" className="transition hover:text-mist-100">Features</a>
            <a href="#games" className="transition hover:text-mist-100">Games</a>
            <a href="#tournaments" className="transition hover:text-mist-100">Tournaments</a>
            <a href="#how" className="transition hover:text-mist-100">How it works</a>
            {/* Extra header links added by the admin (Admin → Navigation). */}
            {headerLinks.map((l) => (
              <a key={l.id} href={l.href} target={l.newTab ? "_blank" : undefined} rel={l.newTab ? "noopener noreferrer" : undefined} className="transition hover:text-mist-100">{l.label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <InstallAppButton label="Install" className="hidden h-9 px-3.5 text-sm sm:inline-flex" />
            {nav.header?.showLogin !== false && (
              <ButtonLink href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
                Log in
              </ButtonLink>
            )}
            <ButtonLink href={nav.header?.ctaHref || "/login"} size="sm">
              {nav.header?.ctaText || "Get started"} <ArrowRight className="size-4" />
            </ButtonLink>
          </div>
        </div>
      </header>

      {/* ===== HERO ===== */}
      <section className="relative mx-auto max-w-6xl px-5 pb-10 pt-14 sm:pt-20">
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-10">
          <div className="animate-rise text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-mist-300">
              <Sparkles className="size-3.5 text-gold-300" /> {H.hero.badge}
            </span>
            <h1 className="mt-5 font-display text-[2rem] font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              <span className="text-gradient">{H.hero.titleA}</span>
              <br />
              <span className="text-white">{H.hero.titleB}</span>{" "}
              <span className="text-gold-gradient">{H.hero.titleC}</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-mist-300 sm:text-lg">
              {H.hero.subtitle}
            </p>
            <div className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center lg:justify-start">
              <ButtonLink href={H.hero.primaryHref || "/login"} size="lg">
                {H.hero.primaryLabel} <ArrowRight className="size-5" />
              </ButtonLink>
              <ButtonLink href={H.hero.secondaryHref || "#games"} size="lg" variant="outline">
                <Dice5 className="size-5" /> {H.hero.secondaryLabel}
              </ButtonLink>
              <InstallAppButton label={H.hero.installLabel} className="inline-flex h-12 px-6 text-base" />
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 lg:justify-start">
              {(H.hero.stats ?? []).map((s, i) => (
                <div key={i}>
                  <div className="font-display text-2xl font-bold text-white">{s.value}</div>
                  <div className="text-xs uppercase tracking-wider text-mist-500">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Hero visual — logo centred, six dice evenly ringed around it.
              Each die sits in a wrapper that is *centred on its point* of the
              circle; the float animation runs on the inner die so its transform
              never fights the wrapper's centering (which previously made them
              overlap). */}
          <div className="relative mx-auto aspect-square w-full max-w-[280px] sm:max-w-[400px] lg:max-w-[480px]">
            {/* Centre logo — 1.5× larger than the dice ring's original size */}
            <div className="absolute left-1/2 top-1/2 grid size-[9rem] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full glass-strong ring-1 ring-white/10 sm:size-[12rem] lg:size-[13.5rem]">
              <LotusMark className="size-[6rem] sm:size-[7.5rem] lg:size-[9rem]" />
            </div>
            {/* Six dice at clock positions; wrapper centred on each point. */}
            {[
              { left: "50%", top: "7%", face: 5, color: "red", anim: "animate-float" },
              { left: "87%", top: "28%", face: 3, color: "blue", anim: "animate-float-slow" },
              { left: "87%", top: "72%", face: 6, color: "green", anim: "animate-float" },
              { left: "50%", top: "93%", face: 2, color: "gold", anim: "animate-float-slow" },
              { left: "13%", top: "72%", face: 4, color: "white", anim: "animate-float" },
              { left: "13%", top: "28%", face: 5, color: "yellow", anim: "animate-float-slow" },
            ].map((d, i) => (
              <span
                key={i}
                className="absolute block w-12 -translate-x-1/2 -translate-y-1/2 sm:w-16"
                style={{ left: d.left, top: d.top }}
              >
                <Die face={d.face as never} color={d.color as never} className={`w-full ${d.anim}`} />
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PILLARS ===== */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-16">
        <SectionHeader
          eyebrow={H.pillars.eyebrow}
          title={H.pillars.title}
          subtitle={H.pillars.subtitle}
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(H.pillars.cards ?? []).map((p, i) => (
            <div
              key={i}
              className="group glass rounded-xl p-6 transition-colors duration-150 hover:border-white/15 hover:bg-ink-800"
            >
              <div className="grid size-12 place-items-center rounded-lg bg-lotus-500/12 text-lotus-300">
                {(() => { const Ico = PILLARS[i % PILLARS.length].icon; return <Ico className="size-6" />; })()}
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-white">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mist-300">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== GAMES ===== */}
      <section id="games" className="mx-auto max-w-6xl px-5 py-16">
        <div className="glass-strong overflow-hidden rounded-3xl">
          <div className="grid items-center gap-8 p-8 lg:grid-cols-2 lg:p-12">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-petal-500/15 px-3 py-1 text-xs font-semibold text-petal-400">
                <Gamepad2 className="size-3.5" /> {H.games.badge}
              </span>
              <h2 className="mt-4 font-display text-3xl font-extrabold text-white sm:text-4xl">
                {H.games.titleA}
                <br /> {H.games.titleB}
              </h2>
              <p className="mt-4 max-w-md text-mist-300">
                {H.games.text}
              </p>
              <ul className="mt-6 space-y-3">
                {(H.games.bullets ?? []).map((t) => (
                  <li key={t} className="flex items-center gap-3 text-sm text-mist-200">
                    <span className="grid size-5 place-items-center rounded-full bg-emerald-500/20 text-emerald-300">
                      <Star className="size-3" />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
              <ButtonLink href={H.games.buttonHref || "/login"} className="mt-8">
                {H.games.buttonLabel} <ArrowRight className="size-4" />
              </ButtonLink>
            </div>

            {/* Ludo board motif */}
            <div className="relative mx-auto aspect-square w-full max-w-sm">
              <div className="relative grid size-full grid-cols-2 grid-rows-2 gap-2 rounded-2xl glass p-3">
                <div className="grid place-items-center rounded-2xl bg-rose-500/20"><Die face={4} color="red" className="w-2/3" /></div>
                <div className="grid place-items-center rounded-2xl bg-emerald-500/20"><Die face={4} color="green" className="w-2/3" /></div>
                <div className="grid place-items-center rounded-2xl bg-sky-500/20"><Die face={4} color="blue" className="w-2/3" /></div>
                <div className="grid place-items-center rounded-2xl bg-amber-500/20"><Die face={4} color="yellow" className="w-2/3" /></div>
                <div className="absolute left-1/2 top-1/2 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full glass-strong ring-1 ring-white/10">
                  <LotusMark className="size-12" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURE MEDIA =====
          Every picture and MP4 saved at Admin → Site Content → SEO & Home. */}
      {homeMedia.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pb-4">
          <HomeFeatureGallery feature={homeFeature} />
        </section>
      )}

      {/* ===== FEATURE GRID ===== */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <SectionHeader
          eyebrow={H.features.eyebrow}
          title={H.features.title}
          subtitle={H.features.subtitle}
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(H.features.cards ?? []).map((f, i) => {
            const Ico = FEATURES[i % FEATURES.length].icon;
            return (
              <div key={i} className="glass rounded-xl p-6 transition-colors hover:border-white/15 hover:bg-ink-800">
                <Ico className="size-7 text-lotus-300" />
                <h3 className="mt-4 font-semibold text-white">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-mist-400">{f.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-16">
        <SectionHeader eyebrow={H.journey.eyebrow} title={H.journey.title} />
        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {(H.journey.steps ?? []).map((s, i) => (
            <div key={i} className="relative glass rounded-2xl p-6">
              <span className="font-display text-3xl font-extrabold text-white/10">{s.num}</span>
              <h3 className="-mt-3 font-display font-bold text-white">{s.title}</h3>
              <p className="mt-2 text-sm text-mist-400">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section id="tournaments" className="mx-auto max-w-6xl px-5 py-16">
        <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-ink-850 px-6 py-14 text-center sm:px-12">
          <LotusMark className="mx-auto size-14" />
          <h2 className="mt-5 font-display text-3xl font-extrabold text-white sm:text-4xl">
            {H.cta.title}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-mist-300">
            {H.cta.text}
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <ButtonLink href={H.cta.buttonHref || "/login"} size="lg">
              {H.cta.buttonLabel} <ArrowRight className="size-5" />
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* ===== Content / SEO section (admin-managed homepage intro) ===== */}
      {homeIntro && (
        <section className="border-t border-white/5 px-5 py-14">
          <div className="mx-auto max-w-3xl prose-invert space-y-4 text-sm leading-relaxed text-mist-300 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-mist-100 [&_a]:text-lotus-300 [&_a]:underline [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-mist-100" dangerouslySetInnerHTML={{ __html: homeIntro }} />
        </section>
      )}

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-white/5 px-5 py-10">
        <div className="mx-auto max-w-6xl">
          {/* Every link, the tagline and the copyright line come from
              Admin → Navigation, so they can be renamed, reordered, grouped,
              added to or hidden without a code change. */}
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <Logo />
            {footerCfg.tagline && <p className="text-sm text-mist-500">{footerCfg.tagline}</p>}
            {footerCfg.showLogin !== false && <a href="/login" className="text-sm text-mist-400 hover:text-mist-100">Log in →</a>}
          </div>
          {footerColumns.length > 0 && (
            <div className={cn("mt-6 border-t border-white/5 pt-6", footerColumns.length > 1 && "grid gap-6 sm:grid-cols-2 lg:grid-cols-4")}>
              {footerColumns.map((col) => (
                <nav key={col.id} className={cn(footerColumns.length > 1 ? "text-left" : "flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-mist-400")}>
                  {col.title && <p className="mb-2 font-display text-sm font-bold text-mist-200">{col.title}</p>}
                  {footerColumns.length > 1 ? (
                    <ul className="space-y-1.5 text-xs text-mist-400">
                      {col.links.map((l) => (
                        <li key={l.id}>
                          <a href={l.href} target={l.newTab ? "_blank" : undefined} rel={l.newTab ? "noopener noreferrer" : undefined} className="hover:text-lotus-200">{l.label}</a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    col.links.map((l) => (
                      <a key={l.id} href={l.href} target={l.newTab ? "_blank" : undefined} rel={l.newTab ? "noopener noreferrer" : undefined} className="hover:text-lotus-200">{l.label}</a>
                    ))
                  )}
                </nav>
              ))}
            </div>
          )}
          <p className="mt-4 text-center text-xs text-mist-600">{renderCopyright(footerCfg.copyright)}</p>
        </div>
      </footer>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-lotus-300">{eyebrow}</span>
      <h2 className="mt-3 font-display text-3xl font-extrabold text-white sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-3 text-mist-400">{subtitle}</p>}
    </div>
  );
}
