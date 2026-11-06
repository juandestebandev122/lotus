"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { APP_VERSION } from "@/lib/lifelog";
import { collectDeviceInfo } from "@/lib/device";
import { useAuth } from "@/lib/auth";
import { useVoice } from "@/lib/VoiceProvider";
import { useConfig } from "@/lib/config";
import { lbl } from "@/lib/labels";
import { useNotifications } from "@/lib/notifications";
import { Logo } from "@/components/Logo";
import { AcceptTerms } from "@/components/AcceptTerms";
import { CustomUploads } from "@/components/CustomUploads";
import { AdBanner } from "@/components/AdBanner";
import { InactivityGuard } from "@/components/InactivityGuard";
import { GlobalCaptureGuard } from "@/components/GlobalCaptureGuard";
import { useActivityTracker, idleMs } from "@/lib/use-activity";
import { Avatar } from "@/components/ui/Avatar";
import { CoinPill } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { NAV_ITEMS, BOTTOM_NAV, arrangeNav, type NavItem } from "./nav-items";
import { FRIENDS } from "@/lib/mock-data";
import { IS_PROD_SITE } from "@/lib/prod";
import { withBase } from "@/lib/base-path";
import { ShieldCheck } from "lucide-react";
import { LogOut, Megaphone, Wrench, RefreshCw } from "lucide-react";

const pendingFriends = IS_PROD_SITE
  ? 0
  : FRIENDS.filter((f) => f.state === "incoming").length;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isAuthed, loading, logout, forceLogout, updateUser } = useAuth();
  const voice = useVoice();
  const { config } = useConfig();
  const { unreadCount } = useNotifications();
  const pathname = usePathname();
  const router = useRouter();

  // Badge counts — notifications are live (shared with the bell + page).
  const badgeFor = (item: NavItem): number => {
    if (item.badgeKey === "notifications") return unreadCount;
    if (item.badgeKey === "friends") return pendingFriends;
    return 0;
  };

  // "View as user" mode — an admin previewing the member experience.
  const [viewAsUser, setViewAsUser] = useState(false);
  useEffect(() => {
    try { setViewAsUser(localStorage.getItem("lotus.viewAsUser") === "1"); } catch {}
  }, [pathname]);
  const exitUserView = () => {
    try { localStorage.removeItem("lotus.viewAsUser"); } catch {}
    setViewAsUser(false);
    router.push("/admin");
  };

  // Client-side auth guard. Remember WHERE the visitor was headed (e.g. a shared
  // room link) so they land back there after signing in — instead of being
  // dumped on Home and losing the room they were invited to.
  useEffect(() => {
    if (!loading && !isAuthed) {
      const here = typeof window !== "undefined" ? window.location.pathname + window.location.search : (pathname ?? "");
      const skip = !here || here === "/" || here.startsWith("/login") || here.startsWith("/home");
      router.replace(skip ? "/login" : `/login?next=${encodeURIComponent(here)}`);
    }
  }, [loading, isAuthed, router, pathname]);

  // Does this user own or manage an agency? If so, show the "Agency" portal in
  // the nav (agency owners/managers use their normal login — no separate login).
  const [hasAgency, setHasAgency] = useState(false);
  useEffect(() => {
    if (!isAuthed) return;
    // Shows the "My Agency" item for ANY agency member (owner, manager or member) —
    // /api/my-agency returns their agency (or null), unlike /api/agency which is
    // owner/manager-only.
    fetch(withBase("/api/my-agency"), { credentials: "include" }).then((r) => r.json()).then((d) => setHasAgency(!!d?.agency)).catch(() => {});
  }, [isAuthed, pathname]);

  // AUTO-UPDATE: a single-page app keeps running its loaded bundle until a full
  // reload — so a device can get stuck on an OLD version indefinitely (that's why
  // a fix looked "not applied"). Poll the server's live version; when this bundle
  // is stale, reload to pick up the fix — but NEVER mid-game or inside a room, so
  // it can't interrupt a match or a live call. Runs at idle moments (home, lists…).
  const staleRef = useRef(false);
  // Voice can persist across navigation (VoiceProvider is app-level), so a user
  // may be on a live call while sitting on /home. Track it live so the reload
  // below never drops an active call — one of the client's hard requirements.
  const voiceActiveRef = useRef(false);
  voiceActiveRef.current = !!voice.roomId;
  useEffect(() => {
    if (!isAuthed) return;
    const inGameOrRoom = pathname.includes("/games/") || /\/rooms\/[^/]+$/.test(pathname) || pathname.includes("/paid-zone") || pathname.includes("/reels");
    const check = async () => {
      // Skip the background ping — it re-checks on return via visibilitychange.
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const r = await fetch(withBase("/api/version"), { cache: "no-store" });
        const d = await r.json().catch(() => ({}));
        if (d?.v && typeof d.v === "string" && d.v !== APP_VERSION) staleRef.current = true;
      } catch { /* ignore network blips */ }
      if (staleRef.current && !inGameOrRoom && !voiceActiveRef.current && typeof window !== "undefined") {
        window.location.reload(); // load the newer version now that it's safe
      }
    };
    check();
    const t = setInterval(check, 90000);
    const onVis = () => { if (typeof document !== "undefined" && !document.hidden) check(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [isAuthed, pathname]);

  // First launch → ask for NOTIFICATION permission (once). Microphone & camera
  // are requested on first real use (joining a voice seat / turning on the
  // camera), which is what browsers require and is the least intrusive.
  useEffect(() => {
    if (!isAuthed || typeof window === "undefined") return;
    try {
      if (localStorage.getItem("lotus.perms.asked") === "1") return;
      localStorage.setItem("lotus.perms.asked", "1");
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    } catch { /* ignore */ }
  }, [isAuthed]);

  // Track genuine user interaction (taps, scrolling, typing, page changes). Feeds
  // both the heartbeat's "active" flag below and the auto-logout guard.
  useActivityTracker();

  // Presence heartbeat — keeps "online" status real while the app is open.
  useEffect(() => {
    if (!isAuthed) return;
    const ping = () => {
      // Skip the heartbeat while backgrounded — the user is away, so don't burn
      // their mobile data pinging "online".
      if (typeof document !== "undefined" && document.hidden) return;
      // Report whether the user GENUINELY did something this past minute. An idle
      // minute still keeps them "online" but earns no Startup-Bonus time, which is
      // what stops people farming coins by leaving the app open and untouched.
      // The grace window is the admin's `rewardGraceMinutes` (default 5).
      const graceMs = Math.max(1, config.inactivity?.rewardGraceMinutes ?? 5) * 60_000;
      const active = idleMs() < graceMs;
      // If the heartbeat comes back 401 the session was ended server-side (admin
      // action) — sign the user out immediately as a second safety net alongside
      // the dedicated session poll below.
      fetch(withBase("/api/heartbeat"), {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active, device: collectDeviceInfo(APP_VERSION) }),
      })
        .then(async (r) => {
          if (r.status !== 401) return;
          // Read WHY (another device / admin / password) so the message is right.
          let reason = "admin";
          try { const a = await fetch(withBase("/api/auth/alive"), { credentials: "include", cache: "no-store" }); if (a.status === 401) { const d = await a.json(); if (d?.reason) reason = String(d.reason); } else return; } catch { return; }
          forceLogout(reason);
        })
        .catch(() => {});
    };
    ping();
    const t = setInterval(ping, 60000);
    return () => clearInterval(t);
  }, [isAuthed, forceLogout, config.inactivity?.rewardGraceMinutes]);

  // ENFORCE ADMIN ACTIONS INSTANTLY. When an admin uses Logout / Suspend / Ban /
  // Deactivate (from ANY admin screen), the session is invalidated server-side.
  // A single-page app would otherwise keep running on its cached user until the
  // next navigation — so we actively poll a tiny session gate every ~20s and, on
  // a CONFIRMED 401 (one retry to ride out a deploy/restart blip), force the user
  // out: the client can't stay "Online" or keep using the app until they log in
  // again. Foreground-only (returning from background already re-checks /me).
  useEffect(() => {
    if (!isAuthed) return;
    let stopped = false;
    const check = async () => {
      if (stopped) return;
      if (typeof document !== "undefined" && document.hidden) return; // away → skip
      let res: Response | null = null;
      try { res = await fetch(withBase("/api/auth/alive"), { credentials: "include", cache: "no-store" }); }
      catch { return; } // network blip — never log out on a failed request
      if (!res || res.status !== 401) return;
      // Confirm with one retry so a momentary server restart can't sign anyone out.
      await new Promise((r) => setTimeout(r, 2000));
      if (stopped) return;
      let retry: Response | null = null;
      try { retry = await fetch(withBase("/api/auth/alive"), { credentials: "include", cache: "no-store" }); }
      catch { return; }
      if (retry && retry.status === 401) {
        // The gate tells us WHY (another device / admin / password) so the login
        // screen can show the right message.
        let reason = "admin";
        try { const d = await retry.clone().json(); if (d?.reason) reason = String(d.reason); } catch { /* ignore */ }
        forceLogout(reason);
      }
    };
    const t = setInterval(check, 20000);
    return () => { stopped = true; clearInterval(t); };
  }, [isAuthed, forceLogout]);

  if (loading || !isAuthed || !user) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="flex flex-col items-center gap-3 text-mist-400">
          <span className="size-10 animate-spin rounded-full border-2 border-lotus-500/30 border-t-lotus-400" />
          Loading {config.appName || "…"}
        </div>
      </div>
    );
  }

  // Maintenance mode — block everyone except administrators.
  if (config.settings.maintenance && user.role !== "admin") {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="max-w-md">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-lotus-500/12 text-lotus-300">
            <Wrench className="size-8" />
          </span>
          <h1 className="mt-5 font-display text-2xl font-extrabold text-mist-100">We&apos;ll be right back</h1>
          <p className="mt-2 text-sm text-mist-400">
            {config.appName} is down for scheduled maintenance. Please check back shortly — thanks for your patience.
          </p>
          <button
            onClick={logout}
            className="mt-6 inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-medium text-mist-300 hover:text-mist-100"
          >
            <LogOut className="size-4" /> Log out
          </button>
        </div>
      </div>
    );
  }

  // First-login gate: members must accept Terms & Privacy before the Home page.
  // (Staff/admin accounts are exempt.)
  const isStaff = user.role === "admin" || !!user.adminRole;
  if (!isStaff && !user.acceptedTermsAt) {
    return (
      <AcceptTerms
        onAccepted={() => updateUser({ acceptedTermsAt: new Date().toISOString() })}
        onDecline={logout}
      />
    );
  }

  // Admin forced a password reset — the user must set a new password before
  // using the app. The Security page clears the flag once it's done.
  if (user.mustChangePassword && pathname !== "/profile/security") {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="max-w-md">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-amber-500/12 text-amber-300"><ShieldCheck className="size-8" /></span>
          <h1 className="mt-5 font-display text-2xl font-extrabold text-mist-100">Update your password</h1>
          <p className="mt-2 text-sm text-mist-400">An administrator has asked you to set a new password before continuing.</p>
          <button onClick={() => router.push("/profile/security")} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-lotus-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-lotus-500">
            Change password now
          </button>
          <button onClick={logout} className="mt-3 block w-full text-xs text-mist-500 hover:text-mist-300">Log out</button>
        </div>
      </div>
    );
  }

  return (
    <>
    {/* Inactivity Detection & Auto Logout. Renders nothing at all unless an admin
        has switched it on AND the user has genuinely been idle past the timeout. */}
    <InactivityGuard />
    {/* App-wide, config-driven screenshot / recording deterrent — applies on whichever
        modules (chat, profile, home, reels, …) the admin enabled. */}
    <GlobalCaptureGuard />
    <div className="mx-auto flex min-h-dvh max-w-7xl">
      {/* ===== Sidebar (desktop) ===== */}
      {/* data-lotus-menu marks the menu rails so Admin → Text Colours can colour
          menu items independently of ordinary links. */}
      <aside data-lotus-menu className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-ink-900/40 px-4 py-5 lg:flex">
        <div className="px-2">
          <Logo href="/home" />
        </div>

        {/* THE MENU LIST SCROLLS. The rail is a fixed-height (h-dvh) column, and
            this list had no overflow rule — so once there were more items than
            fit the screen, everything below the fold was simply unreachable
            (the list stopped at Wallet, hiding Store, Frames, My Storage,
            Documents, Friends, Messages and the rest). `min-h-0` is the part
            that matters: without it a flex child refuses to shrink below its
            content, so `overflow-y-auto` alone would still do nothing.
            The logo stays pinned above and the user card below, so Log out is
            always reachable no matter how far the menu is scrolled. */}
        <nav className="lotus-scroll mt-6 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain pr-1">
          {arrangeNav(NAV_ITEMS, config.menuLayout).filter((item) => (!item.feature || config.features?.[item.feature] !== false) && (!item.agencyOnly || hasAgency) && !(item.href === "/all-pages" && config.allPages?.enabled === false)).map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const count = badgeFor(item);
            const subItems = config.menuLayout?.submenus?.[item.href] ?? [];
            return (
              <div key={item.href}>
              <Link
                href={item.href}
                data-active={active ? "true" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-lotus-500/20 text-white font-semibold"
                    : "text-mist-400 hover:bg-white/[0.06] hover:text-mist-100",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-lotus-400" />
                )}
                <item.icon className={cn("size-[18px]", active ? "text-lotus-300" : "")} />
                <span className="flex-1">{lbl(config.labels, `nav.${item.href}`, item.label)}</span>
                {count > 0 && (
                  <span className="grid min-w-5 place-items-center rounded-full bg-petal-500 px-1.5 text-[10px] font-bold text-white">
                    {count}
                  </span>
                )}
                {item.soon && (
                  <span className="rounded-full bg-white/[0.07] px-1.5 py-0.5 text-[9px] font-semibold uppercase text-mist-400">
                    Soon
                  </span>
                )}
              </Link>
              {/* SUBMENUS — child links an admin added under this item
                  (Admin → Navigation). Plain links, so page permissions and
                  feature switches still apply exactly as before. */}
              {subItems.length > 0 && (
                <div className="mb-1 ml-6 mt-0.5 space-y-0.5 border-l border-line pl-3">
                  {subItems.map((s, i) => (
                    <Link
                      key={`${item.href}-sub-${i}`}
                      href={s.href}
                      className={cn(
                        "block truncate rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                        pathname === s.href ? "bg-lotus-500/15 text-white" : "text-mist-500 hover:bg-white/[0.05] hover:text-mist-200",
                      )}
                    >
                      {s.label}
                    </Link>
                  ))}
                </div>
              )}
              </div>
            );
          })}
        </nav>

        {/* Admin advertisement — the "Sidebar" position (desktop rail). */}
        <AdBanner position="sidebar" className="mt-3 shrink-0" />

        {/* User card — pinned to the bottom of the rail, so the profile and
            Log out are always reachable however far the menu is scrolled. */}
        <div className="mt-3 shrink-0 rounded-2xl glass p-3">
          <Link href="/profile" className="flex items-center gap-3">
            <Avatar name={user.fullName} src={user.avatar} status={user.status} size="md" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-mist-100">{user.fullName}</div>
              {/* Name + permanent ID number — never the name alone. */}
              <div className="truncate text-xs text-mist-400">
                {user.publicId && <span className="mr-1.5 font-mono text-[11px] text-mist-500">ID {user.publicId}</span>}
                Level {user.level}
              </div>
            </div>
          </Link>
          <button
            onClick={logout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-line py-2 text-xs font-medium text-mist-400 transition hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-300"
          >
            <LogOut className="size-3.5" /> Log out
          </button>
          <nav className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-mist-600">
            <Link href="/legal/terms" className="hover:text-mist-400">Terms</Link>
            <Link href="/legal/privacy" className="hover:text-mist-400">Privacy</Link>
            <Link href="/legal/community" className="hover:text-mist-400">Community</Link>
            <Link href="/legal/refund" className="hover:text-mist-400">Refund</Link>
            <Link href="/legal/contact" className="hover:text-mist-400">Contact</Link>
          </nav>
        </div>
      </aside>

      {/* ===== Main ===== */}
      <div className="flex min-w-0 flex-1 flex-col pb-20 lg:pb-0">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-line bg-ink-950/80 px-4 py-3 backdrop-blur-xl sm:px-6">
          <div className="lg:hidden">
            <Logo size="sm" href="/home" />
          </div>
          <div className="hidden lg:block">
            <PageTitle pathname={pathname} />
          </div>
          <div className="flex items-center gap-3">
            {/* Tap the coin balance to open the Wallet (buy coins, history). */}
            <Link href="/wallet" title="Open Wallet" aria-label="Open Wallet" className="rounded-full transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-gold-400">
              <CoinPill amount={user.coins} />
            </Link>
            {/* Universal Refresh — reloads the current page (fresh data) from anywhere. */}
            <button onClick={() => window.location.reload()} title="Refresh page" aria-label="Refresh page" className="grid size-10 place-items-center rounded-xl glass text-mist-300 transition hover:border-lotus-400/40 hover:text-mist-100 active:rotate-180">
              <RefreshCw className="size-[18px]" />
            </button>
            <Link href="/notifications" className="relative grid size-10 place-items-center rounded-xl glass hover:border-lotus-400/40">
              <BellGlyph />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-petal-500 px-1 text-[9px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </Link>
            <Link href="/profile" className="lg:hidden">
              <Avatar name={user.fullName} src={user.avatar} size="sm" status={user.status} />
            </Link>
          </div>
        </header>

        {/* View-as-user banner (admins previewing the member experience).
            Sticky so it — and the way back — stay visible on every page. */}
        {viewAsUser && user.role === "admin" && (
          <div className="sticky top-0 z-40 flex flex-wrap items-center gap-2.5 border-b border-amber-400/40 bg-amber-500/15 px-4 py-2.5 text-sm text-amber-100 backdrop-blur sm:px-6">
            <ShieldCheck className="size-4 shrink-0 text-amber-300" />
            <span className="min-w-0 flex-1 font-medium">User Mode — you&apos;re previewing the app as a regular user.</span>
            <button onClick={exitUserView} className="rounded-lg bg-amber-400/25 px-3 py-1 text-xs font-semibold text-amber-50 hover:bg-amber-400/40">
              ← Back to Admin Panel
            </button>
          </div>
        )}

        {config.announcement.trim() && (
          <div className="flex items-center gap-2.5 border-b border-lotus-400/20 bg-lotus-500/10 px-4 py-2.5 text-sm text-lotus-100 sm:px-6">
            <Megaphone className="size-4 shrink-0 text-lotus-300" />
            <span className="min-w-0">{config.announcement}</span>
          </div>
        )}

        {/* ADMIN BANNERS ON EVERY SCREEN (Admin → Custom Uploads & Banners).
            "All pages" placements render here, so a notice or banner can be shown
            across the whole app instead of only on Home. Each renders nothing when
            the admin hasn't published anything for it. */}
        <div className="px-4 pt-4 sm:px-6">
          <CustomUploads placement="all-marquee" variant="marquee" className="mb-2" />
          <CustomUploads placement="all-pages" />
        </div>
        <CustomUploads placement="all-popup" variant="popup" />
        {/* Admin ADVERTISEMENT (Admin → Ads). The "Interstitial (full)" position
            takes over the screen once per session, on any page. */}
        <AdBanner position="interstitial" />

        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>

      {/* ===== Bottom nav (mobile) ===== */}
      <nav data-lotus-menu className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-ink-950/90 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-md items-center justify-around px-2 py-1.5">
          {arrangeNav(BOTTOM_NAV, config.menuLayout).filter((item) => (!item.feature || config.features?.[item.feature] !== false) && !(item.href === "/all-pages" && config.allPages?.enabled === false)).map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const count = badgeFor(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                data-active={active ? "true" : undefined}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium transition",
                  active ? "text-lotus-300" : "text-mist-500",
                )}
              >
                <span className="relative">
                  <item.icon className="size-5" />
                  {count > 0 && (
                    <span className="absolute -right-2 -top-1.5 grid min-w-4 place-items-center rounded-full bg-petal-500 px-1 text-[8px] font-bold text-white">
                      {count}
                    </span>
                  )}
                </span>
                {lbl(config.labels, `nav.${item.href}`, item.label)}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Always-reachable way back to the admin panel while in User Mode */}
      {viewAsUser && user.role === "admin" && (
        <button
          onClick={exitUserView}
          className="fixed bottom-20 right-4 z-[60] inline-flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2.5 text-sm font-bold text-amber-950 shadow-lg shadow-black/30 transition hover:bg-amber-300 lg:bottom-6"
        >
          <ShieldCheck className="size-4" /> Back to Admin Panel
        </button>
      )}
    </div>
    </>
  );
}

function PageTitle({ pathname }: { pathname: string }) {
  const { config } = useConfig();
  const item = NAV_ITEMS.find(
    (i) => pathname === i.href || pathname.startsWith(i.href + "/"),
  );
  return (
    <h1 className="font-display text-lg font-bold text-mist-100">{item?.label ?? config.appName}</h1>
  );
}

function BellGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5 text-mist-200">
      <path
        className="text-mist-300"
        d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
