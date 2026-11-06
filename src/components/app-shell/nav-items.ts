import {
  Home,
  Mic,
  Users2,
  Search,
  Bell,
  User,
  Trophy,
  MessageCircle,
  Wallet,
  FileText,
  Building2,
  Landmark,
  Film,
  Crown,
  Briefcase,
  Swords,
  HardDrive,
  Ticket,
  Phone,
  Store,
  Palette,
  Sparkles,
  LifeBuoy,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  soon?: boolean;
  badgeKey?: "notifications" | "friends";
  feature?: "voiceRooms" | "coins" | "chat" | "games" | "paidZone" | "business" | "reels" | "tournaments" | "competitions" | "luckyNumber"
    | "leaderboards" | "jobs" | "agencies" | "customize" | "myStorage" | "documents" | "friends" | "search" | "support" | "luckySpin" | "store"
    | "notifications"; // hidden when this feature is OFF
  agencyOnly?: boolean; // shown only to users who own/manage an agency
}

// Primary navigation (sidebar). Games are played inside a Voice Room (group),
// so there is no standalone Games entry — the "All Pages" directory at the end
// lists EVERY screen in the app (including the games) with a short description,
// so nothing is ever unreachable. The admin can reorder or hide any of these
// from /admin/appearance (config.menuLayout).
export const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/rooms", label: "Voice Rooms", icon: Mic, feature: "voiceRooms" },
  { href: "/paid-zone", label: "Paid Zone", icon: Phone, feature: "paidZone" },
  { href: "/competitions", label: "Competitions", icon: Swords, feature: "competitions" },
  { href: "/reels", label: "Reels", icon: Film, feature: "reels" },
  { href: "/tournaments", label: "Tournaments", icon: Trophy, feature: "tournaments" },
  { href: "/lucky-number", label: "Lucky Number", icon: Ticket, feature: "luckyNumber" },
  { href: "/lucky-spin", label: "Lucky Spin", icon: Sparkles, feature: "luckySpin" },
  { href: "/leaderboard", label: "Leaderboards", icon: Crown, feature: "leaderboards" },
  { href: "/business", label: "Business", icon: Building2, feature: "business" },
  { href: "/jobs", label: "Jobs", icon: Briefcase, feature: "jobs" },
  { href: "/agencies", label: "Agencies", icon: Landmark, feature: "agencies" },
  { href: "/agency", label: "My Agency", icon: Crown, agencyOnly: true },
  { href: "/wallet", label: "Wallet", icon: Wallet, feature: "coins" },
  { href: "/store", label: "Store", icon: Store, feature: "store" },
  { href: "/customize", label: "Frames & Appearance", icon: Palette, feature: "customize" },
  { href: "/storage", label: "My Storage", icon: HardDrive, feature: "myStorage" },
  { href: "/documents", label: "Documents", icon: FileText, feature: "documents" },
  { href: "/friends", label: "Friends", icon: Users2, badgeKey: "friends", feature: "friends" },
  { href: "/messages", label: "Messages", icon: MessageCircle, feature: "chat" },
  { href: "/search", label: "Search", icon: Search, feature: "search" },
  { href: "/notifications", label: "Notifications", icon: Bell, badgeKey: "notifications", feature: "notifications" },
  { href: "/support", label: "Help & Support", icon: LifeBuoy, feature: "support" },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/all-pages", label: "All Pages", icon: LayoutGrid },
];

// Apply the admin menu layout (config.menuLayout) to a nav list: drop hidden items,
// then order the rest by the admin's saved sequence (items not listed keep their
// original relative order and follow after the ordered ones). Items are keyed by href.
export function arrangeNav(items: NavItem[], layout?: { order?: string[]; hidden?: string[] }): NavItem[] {
  const hidden = new Set(layout?.hidden ?? []);
  const visible = items.filter((it) => !hidden.has(it.href));
  const order = layout?.order;
  if (!order || order.length === 0) return visible;
  const rank = new Map(order.map((href, i) => [href, i]));
  return visible
    .map((it, i) => ({ it, i }))
    .sort((a, b) => {
      const ra = rank.has(a.it.href) ? (rank.get(a.it.href) as number) : Infinity;
      const rb = rank.has(b.it.href) ? (rank.get(b.it.href) as number) : Infinity;
      return ra !== rb ? ra - rb : a.i - b.i; // stable for equal/unranked
    })
    .map((x) => x.it);
}

// Compact bottom-nav for mobile. Wallet is included here so coins are always one
// tap away on a phone (the coin balance in the header also opens it), and "All"
// opens the full page directory so every section of the app is reachable from a
// phone without hunting through menus.
export const BOTTOM_NAV: NavItem[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/friends", label: "Friends", icon: Users2, feature: "friends" },
  { href: "/wallet", label: "Wallet", icon: Wallet, feature: "coins" },
  { href: "/notifications", label: "Alerts", icon: Bell, badgeKey: "notifications", feature: "notifications" },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/all-pages", label: "All", icon: LayoutGrid },
];
