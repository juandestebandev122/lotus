import {
  Home,
  Mic,
  Lock,
  Trash2,
  Gamepad2,
  Dices,
  Swords,
  Crown,
  Trophy,
  Ticket,
  Film,
  Clapperboard,
  MessageCircle,
  Users2,
  Search,
  Bell,
  User,
  UserCog,
  ShieldCheck,
  EyeOff,
  Wallet,
  Coins,
  Gift,
  Sparkles,
  Store,
  Palette,
  Landmark,
  Building2,
  Briefcase,
  Phone,
  FileText,
  HardDrive,
  IdCard,
  LifeBuoy,
  Share2,
  Eye,
  ScrollText,
  Receipt,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

/**
 * THE COMPLETE MAP OF THE APP.
 *
 * Every screen a member can reach is listed here exactly once, grouped into the
 * sections the app is actually organised around (gaming, voice, chat, wallet,
 * agency/business, and so on). The sidebar shows the most-used destinations; this
 * catalog is what powers the "All Pages" directory, so nothing is ever hidden or
 * unreachable — a user can always find every part of the app they're allowed to
 * open.
 *
 * Visibility rules:
 *   • `feature` — hidden when the admin switches that module OFF (config.features).
 *   • `need`    — an extra permission gate ("agency" = belongs to an agency,
 *                 "admin" = staff account).
 * Anything with neither is available to every signed-in member.
 */

export type FeatureKey =
  // Section switches (v469) — every remaining area of the app, so Feature
  // Management can hide any of them from this directory too.
  | "leaderboards" | "jobs" | "agencies" | "customize" | "myStorage"
  | "documents" | "friends" | "search" | "support" | "luckySpin" | "store"
  | "notifications"
  | "voiceRooms"
  | "privateRooms"
  | "paidZone"
  | "gifts"
  | "coins"
  | "games"
  | "chat"
  | "business"
  | "reels"
  | "tournaments"
  | "competitions"
  | "luckyNumber";

export interface AppPage {
  href: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  feature?: FeatureKey;
  need?: "agency" | "admin";
  /** Played inside a voice room — opened by picking a room first. */
  viaRoom?: boolean;
}

export interface AppSection {
  key: string;
  title: string;
  blurb: string;
  icon: LucideIcon;
  pages: AppPage[];
}

export const APP_SECTIONS: AppSection[] = [
  {
    key: "gaming",
    title: "Gaming",
    blurb: "Ludo, Chess and Snake & Ladder — played with the people in your voice room.",
    icon: Gamepad2,
    pages: [
      { href: "/rooms", label: "Play Ludo", desc: "Open a voice room, then start a Ludo match with everyone on the seats.", icon: Dices, feature: "games", viaRoom: true },
      { href: "/rooms", label: "Play Chess", desc: "1-v-1 chess with anyone seated in the same voice room.", icon: Swords, feature: "games", viaRoom: true },
      { href: "/rooms", label: "Play Snake & Ladder", desc: "Classic Snake & Ladder for up to four players in a room.", icon: Gamepad2, feature: "games", viaRoom: true },
      { href: "/games/history", label: "Match History", desc: "Every game you have played — result, players, coins won or lost.", icon: ScrollText, feature: "games" },
      { href: "/rooms", label: "Watch a Live Game", desc: "Spectate a match that is running right now — open a room and tap Watch on the live-game bar.", icon: Eye, feature: "games", viaRoom: true },
    ],
  },
  {
    key: "voice",
    title: "Voice Rooms",
    blurb: "Live audio rooms — your rooms, rooms you've joined and every public room.",
    icon: Mic,
    pages: [
      { href: "/rooms", label: "All Voice Rooms", desc: "My Rooms, Joined Rooms and Public Rooms — create or join in one tap.", icon: Mic, feature: "voiceRooms" },
      { href: "/rooms", label: "Private Rooms", desc: "Invite-only rooms. They appear in the Private section of the rooms list.", icon: Lock, feature: "privateRooms" },
      { href: "/rooms", label: "Group Chat", desc: "Each room has its own group chat with photos, files, stickers and gifts.", icon: MessageCircle, feature: "chat", viaRoom: true },
    ],
  },
  {
    key: "messaging",
    title: "Chat, Calls & Friends",
    blurb: "Private messages, audio/video calls and your social connections.",
    icon: MessageCircle,
    pages: [
      { href: "/messages", label: "Messages", desc: "One-to-one chats — photos, voice notes, files, replies and reactions.", icon: MessageCircle, feature: "chat" },
      { href: "/paid-zone", label: "Paid Zone Calls", desc: "Private 1-to-1 audio & video calls with verified members.", icon: Phone, feature: "paidZone" },
      { href: "/friends", label: "Friends", desc: "Friend requests, followers and the people you follow.", icon: Users2, feature: "friends" },
      { href: "/search", label: "Search", desc: "Find people, rooms and agencies by name or ID.", icon: Search, feature: "search" },
      { href: "/refer", label: "Refer a Friend", desc: "Your invite link and the rewards you've earned from it.", icon: Share2 },
    ],
  },
  {
    key: "profile",
    title: "Profile & Customization",
    blurb: "Your public profile, avatar frames, backgrounds and name effects.",
    icon: User,
    pages: [
      { href: "/profile", label: "My Profile", desc: "Your public page — level, badges, gifts received and reels.", icon: User },
      { href: "/profile/edit", label: "Edit Profile", desc: "Photo, cover, name, bio and personal details.", icon: UserCog },
      { href: "/customize", label: "Frames & Appearance", desc: "Equip avatar frames, profile backgrounds, name effects and badges.", icon: Palette, feature: "customize" },
      { href: "/store", label: "Store", desc: "Buy frames, backgrounds, name effects and badges with coins.", icon: Store, feature: "store" },
      { href: "/profile/privacy", label: "Privacy Settings", desc: "Who can message you, see your profile and find you in search.", icon: EyeOff },
      { href: "/profile/security", label: "Security & Password", desc: "Change your password and review your sign-in security.", icon: ShieldCheck },
      // Listed as its own entry so it can actually be FOUND. It lives on the
      // Security page, but nobody searching for "delete account" would ever
      // guess that from a menu item called "Security & Password".
      { href: "/profile/security#delete-account", label: "Delete My Account", desc: "Permanently close and delete your account and all of its data.", icon: Trash2 },
    ],
  },
  {
    key: "wallet",
    title: "Wallet, Coins & Gifts",
    blurb: "Your balance, purchases, gifts, rewards and every transaction.",
    icon: Wallet,
    pages: [
      { href: "/wallet", label: "Wallet", desc: "Coin & Lotus balance, buy coins, send gifts and withdraw earnings.", icon: Wallet, feature: "coins" },
      { href: "/wallet", label: "Transactions & Earnings", desc: "Full statement of everything credited and debited on your account.", icon: Receipt, feature: "coins" },
      { href: "/wallet", label: "Gifts", desc: "Send gifts in rooms and see the gifts you have received.", icon: Gift, feature: "gifts" },
      { href: "/lucky-spin", label: "Lucky Spin", desc: "Spin the wheel for coin rewards — free spins and paid spins.", icon: Sparkles, feature: "luckySpin" },
      { href: "/lucky-number", label: "Lucky Number", desc: "Enter the number draw and see past winners.", icon: Ticket, feature: "luckyNumber" },
      { href: "/kyc", label: "KYC & Bank Details", desc: "Verify your identity and add the bank account used for withdrawals.", icon: IdCard },
    ],
  },
  {
    key: "compete",
    title: "Tournaments & Competitions",
    blurb: "Brackets, prize pools, singing competitions and everything you've entered.",
    icon: Trophy,
    pages: [
      { href: "/tournaments", label: "Tournaments", desc: "Browse tournaments, join a bracket and follow your matches.", icon: Trophy, feature: "tournaments" },
      { href: "/tournaments/my-requests", label: "My Tournament Requests", desc: "The tournaments you've applied to and their approval status.", icon: ScrollText, feature: "tournaments" },
      { href: "/competitions", label: "Competitions", desc: "Singing & talent competitions — register, perform and see results.", icon: Swords, feature: "competitions" },
    ],
  },
  {
    key: "ranking",
    title: "Rankings & Leaderboards",
    blurb: "Where you stand against everyone else.",
    icon: Crown,
    pages: [
      { href: "/leaderboard", label: "Leaderboards", desc: "Top players by level, wins and coins.", icon: Crown, feature: "leaderboards" },
      { href: "/reels/leaderboard", label: "Reels Leaderboard", desc: "The most-watched and most-liked reel creators.", icon: BarChart3, feature: "reels" },
    ],
  },
  {
    key: "reels",
    title: "Reels",
    blurb: "Short videos — watch, create and share.",
    icon: Film,
    pages: [
      { href: "/reels", label: "Reels Feed", desc: "Watch short videos, like, comment, save and share.", icon: Film, feature: "reels" },
      { href: "/reels/create", label: "Create a Reel", desc: "Record or upload a video with a caption, hashtags and music.", icon: Clapperboard, feature: "reels" },
    ],
  },
  {
    key: "agency",
    title: "Agency & Business",
    blurb: "Agencies, official business pages, the marketplace and jobs.",
    icon: Landmark,
    pages: [
      { href: "/agencies", label: "Agencies", desc: "Browse every agency and apply to join one.", icon: Landmark, feature: "agencies" },
      { href: "/agency", label: "My Agency", desc: "Your agency portal — members, earnings and requests.", icon: Crown, need: "agency" },
      { href: "/business", label: "Business Directory", desc: "Official business pages you can follow, review and shop from.", icon: Building2, feature: "business" },
      { href: "/business/mine", label: "My Business Page", desc: "Manage your own business page, posts, products and media.", icon: Building2, feature: "business" },
      { href: "/jobs", label: "Jobs", desc: "Job posts from businesses — apply and track your applications.", icon: Briefcase, feature: "jobs" },
    ],
  },
  {
    key: "alerts",
    title: "Notifications & Announcements",
    blurb: "Everything the app and the admins want you to know.",
    icon: Bell,
    pages: [
      { href: "/notifications", label: "Notifications", desc: "Requests, invites, approvals, rewards and admin announcements.", icon: Bell, feature: "notifications" },
    ],
  },
  {
    key: "files",
    title: "Files, Documents & Storage",
    blurb: "The files you've uploaded and how much space you're using.",
    icon: HardDrive,
    pages: [
      { href: "/storage", label: "My Storage", desc: "Your photos, videos, audio and documents with your space usage.", icon: HardDrive, feature: "myStorage" },
      { href: "/documents", label: "Documents", desc: "Documents you've submitted and any documents the admin requested.", icon: FileText, feature: "documents" },
    ],
  },
  {
    key: "help",
    title: "Settings & Help",
    blurb: "Support, policies and the legal pages.",
    icon: LifeBuoy,
    pages: [
      { href: "/support", label: "Help & Support", desc: "Raise a ticket — the admin team replies inside the app.", icon: LifeBuoy, feature: "support" },
      { href: "/legal/terms", label: "Terms of Service", desc: "The rules for using the app.", icon: ScrollText },
      { href: "/legal/privacy", label: "Privacy Policy", desc: "What data we keep and why.", icon: ShieldCheck },
      { href: "/legal/refund", label: "Refund Policy", desc: "How coin purchases and refunds are handled.", icon: Receipt },
      { href: "/legal/community", label: "Community Guidelines", desc: "What is and isn't allowed in rooms, chats and reels.", icon: Users2 },
      { href: "/legal/contact", label: "Contact Us", desc: "How to reach the team outside the app.", icon: MessageCircle },
    ],
  },
  {
    key: "staff",
    title: "Administration",
    blurb: "Staff-only tools.",
    icon: ShieldCheck,
    pages: [
      { href: "/admin", label: "Admin Panel", desc: "The full control panel — users, coins, rooms, games and reports.", icon: ShieldCheck, need: "admin" },
    ],
  },
];

/** Extra info the gates need, resolved by the caller (they know the session). */
export interface PageAccess {
  features?: Record<string, boolean | undefined>;
  hasAgency?: boolean;
  isStaff?: boolean;
}

export function pageVisible(page: AppPage, access: PageAccess): boolean {
  if (page.feature && access.features?.[page.feature] === false) return false;
  if (page.need === "agency" && !access.hasAgency) return false;
  if (page.need === "admin" && !access.isStaff) return false;
  return true;
}

/** The catalog with everything the current user may not open removed. */
export function visibleSections(access: PageAccess): AppSection[] {
  return APP_SECTIONS
    .map((s) => ({ ...s, pages: s.pages.filter((p) => pageVisible(p, access)) }))
    .filter((s) => s.pages.length > 0);
}

/** Total number of pages this user can reach (shown on the directory header). */
export function countPages(sections: AppSection[]): number {
  return sections.reduce((n, s) => n + s.pages.length, 0);
}

/** Free-text filter across titles, descriptions and section names. */
export function searchSections(sections: AppSection[], q: string): AppSection[] {
  const term = q.trim().toLowerCase();
  if (!term) return sections;
  return sections
    .map((s) => {
      const sectionHit = s.title.toLowerCase().includes(term);
      const pages = sectionHit
        ? s.pages
        : s.pages.filter((p) => `${p.label} ${p.desc}`.toLowerCase().includes(term));
      return { ...s, pages };
    })
    .filter((s) => s.pages.length > 0);
}
