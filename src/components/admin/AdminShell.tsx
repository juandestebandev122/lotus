"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth";
import { useConfig } from "@/lib/config";
import { effectivePerms } from "@/lib/admin-perms";
import { fetchPendingSummary } from "@/lib/admin";
import { APP_VERSION } from "@/lib/lifelog";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Mic,
  Gamepad2,
  Dices,
  History,
  CircleDot,
  Trophy,
  Gift,
  Sparkles,
  Coins,
  Calculator,
  CameraOff,
  Volume2,
  CircleUserRound,
  ShoppingBag,
  Flower2,
  Gauge,
  Flag,
  Bell,
  FileText,
  Crown,
  Megaphone,
  LifeBuoy,
  BarChart3,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  MessageSquare,
  Inbox,
  Send,
  Wallet,
  Radio,
  Eye,
  Settings,
  Type,
  LogOut,
  Search,
  KeyRound,
  UserPlus,
  Database,
  ScrollText,
  ClipboardCheck,
  Tags,
  Receipt,
  CalendarRange,
  Gem,
  Activity,
  Music,
  SlidersHorizontal,
  PieChart,
  HandCoins,
  LayoutList,
  LayoutGrid,
  RefreshCw,
  Building2,
  Briefcase,
  Star,
  Landmark,
  Film,
  Image as ImageIcon,
  Camera,
  Swords,
  UserX,
  HardDrive,
  Palette,
  Video,
  Clock,
  Newspaper,
  Code2,
  Hourglass,
  Sticker,
  Tag,
  UploadCloud,
  FolderOpen,
  Grid2x2,
  MonitorUp,
  DatabaseBackup,
} from "lucide-react";

export const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, perm: "" },
  { href: "/admin/approvals", label: "Pending Approvals", icon: ClipboardCheck, perm: "" },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3, perm: "analytics" },
  { href: "/admin/users", label: "Users", icon: Users, perm: "users" },
  { href: "/admin/deleted-users", label: "Deleted Users", icon: UserX, perm: "users" },
  { href: "/admin/online", label: "Online Now", icon: UserCheck, perm: "users" },
  { href: "/admin/messages", label: "Messages (Inbox)", icon: Inbox, perm: "users" },
  { href: "/admin/devices", label: "Device & Security", icon: Smartphone, perm: "users" },
  { href: "/admin/registrations", label: "Account Requests", icon: UserPlus, perm: "users" },
  { href: "/admin/joining-report", label: "Joining Report", icon: CalendarRange, perm: "users" },
  { href: "/admin/levels", label: "Levels & Rewards", icon: Trophy, perm: "users" },
  { href: "/admin/user-levels", label: "User Levels", icon: Gauge, perm: "users" },
  { href: "/admin/profile-pictures", label: "Profile Pictures", icon: CircleUserRound, perm: "users" },
  { href: "/admin/lotus-rewards", label: "Lotus Flower Rewards", icon: Flower2, perm: "users" },
  { href: "/admin/admins", label: "Admins", icon: ShieldCheck, perm: "admins" },
  { href: "/admin/agencies", label: "Agencies", icon: Landmark, perm: "agencies" },
  { href: "/admin/agency-users", label: "Agency User Approvals", icon: UserCheck, perm: "agencies" },
  { href: "/admin/agency-plans", label: "Agency Plans", icon: Landmark, perm: "agencies" },
  { href: "/admin/agency-levels", label: "Agency Levels", icon: Landmark, perm: "agencies" },
  { href: "/admin/deleted-agencies", label: "Deleted Agencies", icon: Landmark, perm: "agencies" },
  { href: "/admin/rooms", label: "Rooms", icon: Mic, perm: "rooms" },
  { href: "/admin/group-report", label: "Group Report (incl. deleted)", icon: FileText, perm: "rooms" },
  { href: "/admin/room-config", label: "Room Settings (per-room)", icon: SlidersHorizontal, perm: "rooms" },
  { href: "/admin/room-activities", label: "Room Activities", icon: Activity, perm: "rooms" },
  { href: "/admin/speaking-effects", label: "Speaking Effects", icon: Volume2, perm: "rooms" },
  { href: "/admin/voice-quality", label: "Voice Quality", icon: Mic, perm: "rooms" },
  { href: "/admin/backup-restore", label: "Backup & Restore", icon: DatabaseBackup, perm: "settings" },
  { href: "/admin/competitions", label: "Competitions", icon: Swords, perm: "competitions" },
  { href: "/admin/feature-requests", label: "Approval Requests", icon: ClipboardCheck, perm: "rooms" },
  { href: "/admin/feature-pricing", label: "Feature Pricing", icon: Tags, perm: "settings" },
  { href: "/admin/games", label: "Games", icon: Gamepad2, perm: "games" },
  { href: "/admin/match-history", label: "Match History", icon: History, perm: "games" },
  { href: "/admin/dice-control", label: "Dice Control", icon: Dices, perm: "games" },
  { href: "/admin/lobby", label: "Game Lobby / Match Start", icon: Gamepad2, perm: "games" },
  { href: "/admin/tokens", label: "Token Management", icon: CircleDot, perm: "games" },
  // The FULL dice system (body, pips, each number 1–6, roll animation). The older
  // "Dice Styles" list below is the simple face-image library, kept as it was.
  { href: "/admin/dice-models", label: "Dice Models", icon: Dices, perm: "games" },
  { href: "/admin/dice", label: "Dice Styles", icon: CircleDot, perm: "games" },
  { href: "/admin/game-board", label: "Game Board", icon: SlidersHorizontal, perm: "games" },
  { href: "/admin/token-areas", label: "Token Placement Areas", icon: Grid2x2, perm: "games" },
  { href: "/admin/chess-board", label: "Chess Board", icon: Swords, perm: "games" },
  { href: "/admin/animations", label: "Animations", icon: Sparkles, perm: "games" },
  { href: "/admin/shield", label: "Shield Protection", icon: ShieldCheck, perm: "games" },
  { href: "/admin/sounds", label: "Sound & Music", icon: Volume2, perm: "games" },
  { href: "/admin/frames", label: "Avatar Frames", icon: CircleUserRound, perm: "content" },
  { href: "/admin/frame-visibility", label: "Frames & Badges Visibility", icon: Eye, perm: "content" },
  { href: "/admin/store", label: "Store Items", icon: ShoppingBag, perm: "content" },
  { href: "/admin/game-themes", label: "Game Themes", icon: Palette, perm: "games" },
  { href: "/admin/games-sessions", label: "Games & History", icon: Radio, perm: "games" },
  { href: "/admin/reset-recovery", label: "Reset & Recovery", icon: LifeBuoy, perm: "rooms" },
  { href: "/admin/gifts", label: "Gift Activity", icon: Gift, perm: "games" },
  { href: "/admin/tournaments", label: "Tournaments", icon: Trophy, perm: "tournaments" },
  { href: "/admin/tournament-rooms", label: "Rooms Control Center", icon: Radio, perm: "tournaments" },
  { href: "/admin/tournament-controls", label: "Tournament & Competition Mgmt", icon: SlidersHorizontal, perm: "tournaments" },
  { href: "/admin/deleted-tournaments", label: "Deleted Tournaments", icon: History, perm: "tournaments" },
  { href: "/admin/lucky-number", label: "Lucky Number", icon: Dices, perm: "games" },
  { href: "/admin/rewards", label: "Rewards", icon: Gift, perm: "coins" },
  { href: "/admin/free-coins", label: "Free Coins", icon: Gift, perm: "coins" },
  { href: "/admin/activity-reward", label: "Activity Reward", icon: Clock, perm: "coins" },
  { href: "/admin/inactivity", label: "Inactivity Detection", icon: Hourglass, perm: "coins" },
  { href: "/admin/lucky-spin", label: "Lucky Spin", icon: Sparkles, perm: "coins" },
  { href: "/admin/coins", label: "Coin Packages", icon: Coins, perm: "coins" },
  { href: "/admin/coin-purchases", label: "Coin Purchases", icon: Receipt, perm: "payments" },
  { href: "/admin/paid-zone", label: "Paid Zone", icon: Gem, perm: "payments" },
  { href: "/admin/business", label: "Business", icon: Building2, perm: "content" },
  { href: "/admin/reels", label: "Reels", icon: Film, perm: "content" },
  { href: "/admin/content-performance", label: "Content Performance", icon: BarChart3, perm: "content" },
  { href: "/admin/jobs", label: "Jobs", icon: Briefcase, perm: "content" },
  { href: "/admin/reviews", label: "Reviews", icon: Star, perm: "content" },
  { href: "/admin/product-fields", label: "Product Fields", icon: LayoutList, perm: "content" },
  { href: "/admin/user-analytics", label: "User Analytics", icon: Activity, perm: "analytics" },
  { href: "/admin/referrals", label: "Referrals", icon: UserPlus, perm: "membership" },
  { href: "/admin/wallet-management", label: "Wallet Management", icon: Wallet, perm: "payments" },
  { href: "/admin/transactions", label: "Financial", icon: Wallet, perm: "payments" },
  { href: "/admin/transaction-management", label: "Transaction Management", icon: Receipt, perm: "payments" },
  { href: "/admin/coin-calculation", label: "Coin Calculation", icon: Calculator, perm: "payments" },
  { href: "/admin/kyc", label: "KYC Management", icon: ShieldCheck, perm: "payments" },
  { href: "/admin/company-profit", label: "Admin Profit", icon: Coins, perm: "payments" },
  { href: "/admin/agent-profit", label: "Agent Profit", icon: Building2, perm: "payments" },
  { href: "/admin/user-profit", label: "User Profit", icon: Users, perm: "payments" },
  { href: "/admin/lotus", label: "Lotus Economy", icon: Flower2, perm: "payments" },
  { href: "/admin/share-distribution", label: "Share Distribution", icon: PieChart, perm: "payments" },
  { href: "/admin/trust", label: "Trust Management", icon: HandCoins, perm: "payments" },
  { href: "/admin/data-usage", label: "Data Usage", icon: Database, perm: "payments" },
  // Hours each member spends in the app, and what the Activity Reward paid them.
  { href: "/admin/activity-report", label: "Activity Time & Rewards", icon: Clock, perm: "payments" },
  // Named "User Storage" because that is what it actually is — every user's
  // uploaded photos/videos/audio/documents, their sizes and per-file controls.
  // It was being missed in the menu when it was just called "Storage".
  { href: "/admin/storage", label: "User Storage", icon: HardDrive, perm: "storage" },
  { href: "/admin/file-storage", label: "File Storage", icon: FolderOpen, perm: "storage" },
  { href: "/admin/documents", label: "Documents", icon: FileText, perm: "documents" },
  { href: "/admin/membership", label: "Membership", icon: Crown, perm: "membership" },
  { href: "/admin/ads", label: "Advertisements", icon: Megaphone, perm: "ads" },
  { href: "/admin/notifications", label: "Notifications", icon: Bell, perm: "notifications" },
  { href: "/admin/media", label: "Media Library", icon: Music, perm: "content" },
  { href: "/admin/uploads", label: "Custom Uploads & Banners", icon: UploadCloud, perm: "content" },
  { href: "/admin/stickers", label: "Stickers", icon: Sticker, perm: "content" },
  { href: "/admin/categories", label: "Categories", icon: Tag, perm: "content" },
  { href: "/admin/content", label: "Content", icon: FileText, perm: "content" },
  { href: "/admin/site-content", label: "Site Content (Blog/SEO)", icon: Newspaper, perm: "content" },
  // Its own entry on purpose. These fields lived inside the Site Content SEO
  // tab and the owner could not find them — a control nobody can locate is not
  // a feature. Named after the words they actually used.
  { href: "/admin/custom-code", label: "AdSense & Custom Code", icon: Code2, perm: "content" },
  // Pages the admin writes themselves ("Add Content") — served at /p/<slug>.
  { href: "/admin/content-pages", label: "Content Pages", icon: FileText, perm: "content" },
  { href: "/admin/policies", label: "Policies & Terms", icon: ScrollText, perm: "content" },
  { href: "/admin/reports", label: "Reports", icon: Flag, perm: "reports" },
  { href: "/admin/log-management", label: "Log Management", icon: ScrollText, perm: "settings" },
  { href: "/admin/moderation", label: "Moderation", icon: ShieldAlert, perm: "moderation" },
  { href: "/admin/records", label: "Record Management", icon: Database, perm: "moderation" },
  { href: "/admin/recordings", label: "Recording Files", icon: Video, perm: "moderation" },
  { href: "/admin/group-chats", label: "Group Chats", icon: MessageSquare, perm: "moderation" },
  { href: "/admin/messaging", label: "Messaging Controls", icon: Send, perm: "settings" },
  { href: "/admin/support", label: "Support", icon: LifeBuoy, perm: "support" },
  { href: "/admin/support-sessions", label: "Support Sessions", icon: MonitorUp, perm: "support" },
  { href: "/admin/features", label: "Feature Management", icon: SlidersHorizontal, perm: "settings" },
  { href: "/admin/privacy", label: "Privacy & Messaging", icon: ShieldCheck, perm: "settings" },
  { href: "/admin/screenshot-protection", label: "Screenshot Protection", icon: CameraOff, perm: "settings" },
  { href: "/admin/labels", label: "Text & Labels", icon: Type, perm: "settings" },
  { href: "/admin/appearance", label: "Appearance & Menu", icon: Palette, perm: "settings" },
  { href: "/admin/themes", label: "Theme Management", icon: Palette, perm: "settings" },
  // Text colours are their OWN system, listed beside Theme Management but
  // deliberately independent of it.
  { href: "/admin/text-colors", label: "Text Colours", icon: Type, perm: "settings" },
  { href: "/admin/navigation", label: "Header, Footer & Menus", icon: LayoutList, perm: "settings" },
  { href: "/admin/all-pages", label: "All Pages Directory", icon: LayoutGrid, perm: "settings" },
  { href: "/admin/branding", label: "App Images", icon: ImageIcon, perm: "settings" },
  { href: "/admin/photo-editor", label: "Photo Editor", icon: Camera, perm: "settings" },
  { href: "/admin/room-overlays", label: "Room Overlays", icon: ImageIcon, perm: "settings" },
  { href: "/admin/settings", label: "Settings", icon: Settings, perm: "settings" },
  // Always visible to every admin (no permission gate) — their own account security.
  { href: "/admin/security", label: "My Security", icon: KeyRound, perm: "" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, isAuthed, logout } = useAuth();
  // Wait for the real config too, so admin form pages only MOUNT after the saved
  // config is loaded. Otherwise a page refresh mounts forms while config is still
  // DEFAULT_CONFIG; each form seeds its inputs from those defaults and never
  // re-seeds, so every saved value looked "reset" until the next save. See the
  // sessionStorage cache in ConfigProvider — with it this wait is near-instant.
  const { config, loading: configLoading } = useConfig();
  const companyName = (config.companyName || "").trim();
  const isLoginPage = pathname === "/admin/login";
  const isAdmin = isAuthed && user?.role === "admin";
  const [pendingTotal, setPendingTotal] = useState(0);
  useEffect(() => {
    if (!isAdmin) return;
    let stop = false;
    const tick = () => { fetchPendingSummary().then((s) => { if (!stop && s) setPendingTotal(s.total); }); };
    tick();
    const id = setInterval(tick, 20000);
    return () => { stop = true; clearInterval(id); };
  }, [isAdmin]);

  // Header search — a quick page finder over the admin sections THIS admin can see.
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const visibleNav = useMemo(
    () => ADMIN_NAV.filter((item) => !item.perm || effectivePerms(user?.adminRole, user?.adminPermissions).includes(item.perm)),
    [user?.adminRole, user?.adminPermissions],
  );
  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return visibleNav.filter((i) => i.label.toLowerCase().includes(term) || i.href.toLowerCase().includes(term));
  }, [q, visibleNav]);
  const goTo = (href: string) => { setQ(""); setSearchOpen(false); router.push(href); };
  // Close the results dropdown on an outside click.
  useEffect(() => {
    if (!searchOpen) return;
    const onDoc = (e: MouseEvent) => { if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setSearchOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [searchOpen]);

  // Guard: non-admins are sent to the admin login.
  useEffect(() => {
    if (isLoginPage) return;
    if (!loading && !isAdmin) router.replace("/admin/login");
  }, [isLoginPage, loading, isAdmin, router]);

  // The login page renders on its own (no sidebar, no guard).
  if (isLoginPage) return <>{children}</>;

  if (loading || !isAdmin || configLoading) {
    const msg = loading
      ? "Checking admin access…"
      : !isAdmin
        ? "Admin access required — redirecting…"
        : "Loading admin data…";
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="flex flex-col items-center gap-3 text-mist-400">
          <span className="size-9 animate-spin rounded-full border-2 border-lotus-500/30 border-t-lotus-400" />
          {msg}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-ink-900/40 px-3 py-5 md:flex">
        <div className="px-2">
          <Logo size="sm" href="/admin" />
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-lotus-300">
              Admin Panel
            </span>
            {/* Visible build version — so it's always obvious which version this
                device is actually running (the recurring "I don't see the new
                feature" issue is almost always an old cached build). */}
            <span title="App version running on this device" className="rounded-full bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9px] font-bold text-mist-400">{APP_VERSION}</span>
          </div>
        </div>
        <nav className="mt-6 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
          {visibleNav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-lotus-500/15 text-lotus-700 ring-1 ring-lotus-400/40"
                    : "text-mist-400 hover:bg-black/[0.06] hover:text-mist-100",
                )}
              >
                <item.icon className="size-[18px]" />
                <span className="flex-1">{item.label}</span>
                {item.href === "/admin/approvals" && pendingTotal > 0 && (
                  <span className="grid min-w-5 place-items-center rounded-full bg-amber-500/20 px-1.5 text-[10px] font-bold text-amber-200">{pendingTotal > 99 ? "99+" : pendingTotal}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-1">
          <button
            onClick={() => {
              try { localStorage.setItem("lotus.viewAsUser", "1"); } catch {}
              router.push("/home");
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-mist-400 transition hover:bg-black/[0.06] hover:text-mist-100"
          >
            <Eye className="size-[18px]" /> View as user
          </button>
          <button
            onClick={async () => {
              await logout();
              router.replace("/admin/login");
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-mist-400 transition hover:bg-rose-500/10 hover:text-rose-300"
          >
            <LogOut className="size-[18px]" /> Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-line bg-ink-950/80 px-5 py-3 backdrop-blur-xl">
          {/* Company name, centred at the top of the admin panel (desktop). Absolute + pointer-events-none
              so it floats in the centre without pushing or blocking the search box or the admin menu. */}
          {companyName && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 hidden max-w-[34%] -translate-x-1/2 -translate-y-1/2 truncate text-center xl:block">
              <span className="text-gradient font-display text-lg font-extrabold tracking-wide">{companyName}</span>
            </div>
          )}
          <div className="md:hidden">
            <Logo size="sm" href="/admin" />
          </div>
          <div ref={searchBoxRef} className="relative hidden flex-1 max-w-sm md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mist-500" />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0]) goTo(results[0].href);
                else if (e.key === "Escape") { setQ(""); setSearchOpen(false); }
              }}
              placeholder="Search admin pages…"
              className="h-10 w-full rounded-xl border border-line bg-ink-800 pl-10 pr-4 text-sm text-mist-100 outline-none focus:border-lotus-400"
            />
            {searchOpen && q.trim() && (
              <div className="absolute left-0 right-0 top-12 z-50 max-h-80 overflow-y-auto rounded-xl border border-line bg-ink-900 p-1.5 shadow-2xl">
                {results.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-mist-500">No admin page matches “{q.trim()}”.</div>
                ) : (
                  results.map((item) => (
                    <button
                      key={item.href}
                      onClick={() => goTo(item.href)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-mist-200 transition hover:bg-lotus-500/15 hover:text-lotus-200"
                    >
                      <item.icon className="size-4 shrink-0 text-mist-400" />
                      <span className="flex-1 truncate">{item.label}</span>
                      <span className="truncate text-[11px] text-mist-600">{item.href}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            {/* Universal Refresh — reloads the current admin page (fresh data). */}
            <button onClick={() => window.location.reload()} title="Refresh page" aria-label="Refresh page" className="grid size-10 place-items-center rounded-xl border border-line bg-ink-800 text-mist-300 transition hover:border-lotus-400/40 hover:text-mist-100 active:rotate-180">
              <RefreshCw className="size-[18px]" />
            </button>
            <Link href="/admin/security" title="My account & password" className="flex items-center gap-3 rounded-xl px-1.5 py-1 transition hover:bg-white/[0.06]">
              <span className="hidden text-right sm:block">
                <span className="block text-sm font-semibold text-mist-100">{user.fullName}</span>
                <span className="block text-xs text-mist-500">Administrator</span>
              </span>
              <Avatar name={user.fullName} size="sm" status="online" />
            </Link>
          </div>
        </header>
        <main className="flex-1 p-5 sm:p-7">{children}</main>
      </div>
    </div>
  );
}
