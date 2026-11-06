import { promises as fs, writeFileSync, mkdirSync, renameSync } from "node:fs";
import path from "node:path";
import type { User, AppNotification, FriendState } from "@/lib/types";
import { GIFTS } from "@/lib/gifts";
import { DEFAULT_SITE_CONTENT } from "@/lib/site-content-default";
import { setActiveAvatarCampaigns, avatarCampaignTag } from "./avatar";
import { DEFAULT_THEMES, type ThemePreset } from "@/lib/theme-presets";
import type { TextColors } from "@/lib/text-colors";
import { defaultDiceModels, type DiceModel } from "@/lib/dice-model";
import type { AllPagesConfig } from "@/lib/all-pages-config";

// ============================================================
// LotusPlay Connect — persistence layer
// A small JSON-file backed store. Single source of truth for
// the backend. The repository functions in repo.ts are the only
// place that touches this — so swapping to PostgreSQL/Prisma later
// means rewriting repo.ts, not the API routes or the UI.
// ============================================================

export interface UserRecord extends User {
  email?: string;
  phone?: string;
  passwordHash?: string;
  tokenSkin?: string; // the game-token design this player picked — shown to EVERYONE on the board
  // PAID DICE the player has bought with coins (Admin → Dice Styles sets a price
  // on any non-Free dice). Permanent once bought.
  ownedDiceIds?: string[];
  // Paid BOARDS and TOKENS the player has bought (same model as dice).
  ownedBoardIds?: string[];
  ownedTokenIds?: string[];
  // When a TIMED game-cosmetic purchase runs out, keyed "dice:gold" /
  // "board:xyz" / "token:crown". No entry = permanent, like a permanent frame.
  cosmeticExpiry?: Record<string, string>;
  ownedFrameIds?: string[]; // LEGACY (v354) — frames bought before validity existed; treated as PERMANENT
  equippedFrame?: string; // the frame currently worn ("" = none) — shown to everyone
  // Validity-aware frame ownership: frameId → purchase/expiry state. A frame is
  // usable while expiresAt is empty (permanent) or in the future. The warned*
  // flags stop the expiry reminders from repeating.
  frames?: Record<string, { at: string; expiresAt?: string | null; warned3d?: boolean; warned24h?: boolean; expiredNotified?: boolean }>;
  // Store ownership for the OTHER item kinds (backgrounds/name effects/badges),
  // same validity model as frames. Keyed by store item id.
  storeOwned?: Record<string, { at: string; expiresAt?: string | null }>;
  // What's currently worn, one slot per kind ("" / unset = none).
  // dice / board / token are the GAME cosmetics, sold through the same store.
  equipped?: { background?: string; nameEffect?: string; badge?: string; overlay?: string; dice?: string; board?: string; token?: string };
  activeRoomId?: string; // the room the user is currently in (one at a time)
  roomSeenAt?: string; // heartbeat: last time the user was confirmed live in their room (for presence staleness)
  blockedUserIds?: string[]; // people this user has BLOCKED — neither can DM the other
  hiddenChats?: Record<string, string>; // otherId -> ISO time the user removed that conversation from their list (reappears on newer activity)
  lastLogoutReason?: "device" | "admin" | "password"; // why the account's OTHER sessions were ended (for the sign-out message)
  accountStatus?: "active" | "inactive" | "suspended" | "blocked" | "banned" | "pending" | "rejected"; // moderation / admin / approval state
  dmDisabled?: boolean; // admin turned this user's PERSONAL messaging OFF — they can't send DMs (the DM equivalent of a group "block from chatting")
  emailVerified?: boolean; // email confirmed (new admin-approved sign-up flow)
  emailVerifyCode?: string; // pending email-verification code
  signupAt?: string; // when the self-sign-up request was submitted (for admin review ordering)
  joinedRoomIds?: string[]; // rooms this user has joined (newest first) — for the "Joined Rooms" section
  referredBy?: string; // userId of the member who referred this user (Refer a friend)
  referralCredited?: boolean; // the referrer has already been paid the referral reward
  referralCode?: string; // this user's own invite code (share to earn referral rewards)
  acceptedPolicies?: string[]; // policy slugs the user agreed to at registration (compliance)
  policiesAcceptedAt?: string; // when they accepted the policies
  // Lotus Flowers — the WITHDRAW-ONLY earnings balance. When the Lotus economy is
  // enabled, gifts credit the receiver in Lotus (converted from coins) instead of
  // coins, and withdrawals are made from this balance. Coins can't be re-gifted as
  // earnings, which stops the same coins circulating forever between users.
  lotus?: number;
  // Active-time / Startup-Bonus tracking (rewards coins for hours of app activity).
  activity?: {
    contSec?: number;  // seconds of the CURRENT continuous session (resets on a long gap)
    accSec?: number;   // accumulated activity seconds toward the next accumulated reward
    lastAt?: number;   // last activity tick (epoch ms) — used to detect a continuous run
    rewards?: number;  // total activity rewards ever granted to this user
    bonus?: number;    // total bonus coins ever earned from activity
    dayKey?: string;   // current day (for the daily reward limit)
    dayCount?: number; // rewards granted today
    idleSec?: number;  // seconds NOT credited because the user was idle (abuse protection)
    idleMin?: number;  // idle minutes skipped today (resets with dayKey)
  };
  adminRole?: "super_admin" | "admin" | "moderator" | "support"; // sub-role for admin accounts
  adminPermissions?: string[]; // allowed admin sections (used when not super_admin)
  lastIp?: string; // last login IP (admin activity)
  lastDeviceId?: string; // the device (browser) most recently used to sign in / heartbeat
  lastLocation?: string; // IP-derived "City, Region, Country" at last activity (best-effort)
  loginCount?: number; // lifetime successful sign-ins (Device & Security profile)
  // Profile Photo Editor — a new picture awaiting admin approval (approvalRequired on).
  pendingAvatar?: string;
  pendingAvatarAt?: string;
  createdAt?: string; // account creation timestamp
  // ---- Account CREATOR / provenance (accountability & audit) ----
  createdVia?: "self" | "admin" | "business" | "system" | "agency"; // HOW the account was created
  createdById?: string;   // creator's user id (when an admin/business created it)
  createdByName?: string; // creator's display name (or "Self" for self sign-ups)
  createdByRole?: string; // creator's role label at creation time (e.g. "Super Admin")
  createdByAgencyId?: string; // the agency that created this account (createdVia === "agency") — only THAT agency may directly ADD them without an invite
  createdIp?: string;     // IP the account was created from (if available)
  kyc?: KycRecord; // identity verification (when real money is involved)
  loginHistory?: LoginEvent[]; // recent sign-ins (for Security Settings)
  passwordChangedAt?: string; // ISO — last time the password was changed/reset
  // Sessions issued before this epoch-second are rejected. Bumped when the
  // user (or an admin) chooses to "log out of all other devices".
  sessionsValidFrom?: number;
  mustChangePassword?: boolean; // admin forced a password reset on next login
  failedLogins?: number; // consecutive failed password attempts
  lockedUntil?: number; // epoch ms — account locked after too many failures
  lastXpDay?: string; // YYYY-MM-DD of the last day a daily-login XP bonus was granted
  lastSpinAt?: string; // ISO time of the user's last FREE daily Lucky Spin (cooldown)
  // Periodic (timed) Free Coins claim — server-clock timestamps so the interval
  // can't be bypassed by changing device time, refreshing or reinstalling.
  lastFreeCoinAt?: string;       // ISO time of the last successful periodic free-coin claim
  freeCoinDay?: string;          // YYYY-MM-DD (Saudi day) the daily-claim counter belongs to
  freeCoinClaimsToday?: number;  // successful periodic claims so far on `freeCoinDay`
  // Lucky Spin "extra chances" — a balance of extra spins earned/bought/awarded.
  spinChances?: number; // available extra chances
  lastSpinActionAt?: string; // any spin (anti double-tap / network-retry guard)
  lastChanceAt?: string; // when the chance balance last increased (for optional expiry)
  spinDisabled?: boolean; // admin disabled extra chances for this user
  adSpinDay?: string; // YYYY-MM-DD — day the ad-earn counter belongs to
  adSpinCount?: number; // ad-earned chances used today
  // Media types (audio/video/image) this user has purchased access to (when the
  // admin has set that type as paid). Once unlocked, it stays unlocked for them.
  mediaUnlocks?: string[];
  // ---- Storage Management System ----
  vip?: boolean; // VIP member → gets the VIP storage limit (admin-set)
  storageLimitMB?: number; // per-user storage limit override (admin-set; overrides all)
  storageWarnLevel?: number; // last storage-warning threshold sent (0/80/90/100) — avoids repeat spam
  // ---- Wallet freeze (admin) — holds the coin balance: the user keeps using the
  // app but cannot SPEND/withdraw/transfer while frozen (admin add/deduct still work). ----
  walletFrozen?: boolean;
  frozenReason?: string;
  frozenAt?: string;
  // ---- Manual level control (Admin → User Levels) ----
  levelLocked?: boolean;   // admin froze this user's level — activity still earns XP but the level number won't move until unlocked
  // ---- Lifetime gift counters (monotonic; db.giftLog is a rolling 10k window and can't be trusted for lifetime totals) ----
  coinsSentTotal?: number;    // total coins this user has ever SPENT on gifts (drives Lotus-Flower loyalty rewards)
  giftsSentCount?: number;    // number of gifts ever sent
  giftsReceivedCount?: number; // number of gifts ever received
  // ---- Lotus Flower LOYALTY reward (distinct from `lotus` earnings above) — a
  // gratitude token awarded for SENDING coins/gifts. Editable tiers in config.lotusRewards. ----
  lotusFlowers?: number;         // current Lotus-Flower balance (loyalty reward)
  lotusFlowerMilestone?: number; // highest tier threshold (minCoins) already auto-rewarded — stops re-awarding the same milestone
}

/** One manual level change (Admin → User Levels). Kept in db.levelAudit for the audit trail. */
export interface LevelAuditEntry {
  id: string;
  userId: string; userPublicId?: string; userName: string;
  action: "increase" | "decrease" | "set" | "reset" | "lock" | "unlock";
  previousLevel: number; newLevel: number;
  adminName: string; adminId?: string;
  reason?: string; ip?: string;
  at: string; // ISO
}

/** One Lotus-Flower reward event (automatic milestone or manual admin grant). Kept in db.lotusRewardLog. */
export interface LotusRewardEntry {
  id: string;
  userId: string; userPublicId?: string; userName: string;
  flowers: number;         // Lotus Flowers awarded (negative allowed only via revoke bookkeeping — status carries the truth)
  coinsSent?: number;      // the user's cumulative coins-sent at award time (automatic rewards)
  threshold?: number;      // the tier threshold that fired (automatic rewards)
  type: "automatic" | "manual";
  reason?: string;         // admin note (manual) or auto description
  adminName?: string;      // set for manual grants + revokes
  status: "granted" | "revoked";
  at: string; revokedAt?: string; revokedBy?: string;
}

// One Lucky Spin result (kept for the user's spin history + admin visibility).
export interface SpinResult {
  id: string;
  userId: string;
  userName: string;
  label: string; // the winning segment's label
  coins: number; // coins won (0 = "try again")
  at: string;
}

// One periodic Free-Coins claim ATTEMPT — logged whether it succeeded or was
// rejected, so the admin can audit exactly who claimed, when, how much, the
// interval that was in force, and (on a rejection) why it was refused.
export interface FreeCoinClaim {
  id: string;
  userId: string;
  userName: string;
  publicId?: string;              // permanent member ID number (shown in admin)
  amount: number;                 // coins granted (0 on a rejection)
  intervalMinutes: number;        // the configured interval at claim time
  at: string;                     // ISO time of the attempt (server clock)
  result: "granted" | "rejected";
  reason?: string;                // why it was rejected (e.g. "Too early", "Daily limit reached")
  balanceAfter?: number;          // wallet balance after a successful grant
}

// A Custom Upload / Banner managed from Admin → Custom Uploads & Banners. The
// admin uploads any file into a custom (unlimited) category, then chooses WHERE
// it shows, TO WHOM, and WHEN. Published items are rendered to users as banners /
// popups, filtered SERVER-SIDE by audience + schedule.
export interface CustomUpload {
  id: string;
  title: string;
  category: string;                 // free-text, admin-defined (unlimited categories)
  type: "image" | "video" | "pdf" | "audio" | "file";
  url: string;                      // /api/media/<name> (public)
  fileName?: string;
  thumbnail?: string;               // optional poster/cover image URL
  subtitle?: string;
  description?: string;
  buttonText?: string;
  buttonUrl?: string;               // internal path "/wallet" or external "https://…"
  bgColor?: string;
  textColor?: string;
  placements: string[];             // where to show, e.g. ["home-top","popup","login","wallet"]
  priority: number;                 // higher shows first
  status: "draft" | "published" | "archived";
  startAt?: string;                 // ISO — show FROM (optional)
  endAt?: string;                   // ISO — hide AFTER (optional)
  dismissible?: boolean;            // popups: allow the user to close it
  audience: {
    groups?: string[];              // any-of ["all","new","existing","vip","agency"] (empty / "all" = everyone)
    minLevel?: number;              // user.level must be >= this
    countries?: string[];           // match user country (name/code), when set
    userIds?: string[];             // ONLY these users (publicId or id) when non-empty
  };
  views?: number;
  clicks?: number;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
}

// One extra-chance transaction (earned / used / expired / reset) for the admin log.
export interface SpinChanceEntry {
  id: string;
  userId: string;
  userName: string;
  publicId?: string; // permanent member ID number, shown beside the name in admin
  delta: number; // + earned, − used/expired
  reason: "daily_login" | "task" | "ad" | "purchase" | "admin" | "spin" | "expired" | "reset";
  balanceAfter: number;
  by?: string; // admin name (for admin actions)
  at: string;
}

// A single sign-in event, shown in the user's Security → Login History.
export interface LoginEvent {
  at: string; // ISO timestamp
  ip?: string;
  device?: string; // parsed from the User-Agent (e.g. "Chrome on Windows")
  method?: string; // "password" | "google" | "otp" | "quick" | "logout" | "failed" | "blocked"
  // ---- Device & Security tracking (v386) ----
  deviceId?: string; // the browser's stable device id (localStorage), if reported
  location?: string; // IP-derived "City, Region, Country" (best-effort)
  isp?: string;      // IP-derived network / ISP name (best-effort)
  success?: boolean; // false for a FAILED login attempt (wrong password / blocked device)
  at2?: string;      // logout time paired to this login (session end), when known
}

// IP-geolocation result (best-effort, cached per IP in db.geoCache).
export interface GeoInfo {
  country?: string;
  region?: string;  // state / province
  city?: string;
  isp?: string;     // network / carrier / ISP
  proxy?: boolean;  // the IP is a known VPN / proxy / hosting range
  at: string;       // when this lookup was cached
  v?: number;       // provider/accuracy version — a bump forces stale entries to re-resolve
}

// One physical browser/device (identified by a stable localStorage id). The registry
// is what powers Multiple-Account-Detection: which accounts share one device, and the
// admin block / force-logout controls. NOTE (web app): a browser cannot expose the real
// hardware id, brand/model, push token, GPS, or root/jailbreak/emulator state — those
// are native-only. `id` is a generated id (stable per browser, but clearable/spoofable).
export interface DeviceRecord {
  id: string;            // generated device id (from the client's localStorage)
  firstSeen: string;
  lastSeen: string;
  accounts: string[];    // user ids that have signed in from this device
  blocked?: boolean;     // admin blocked this device (blacklist — logins refused)
  blockedReason?: string;
  blockedAt?: string;
  blockedBy?: string;
  whitelisted?: boolean; // admin-approved device (used when whitelist-only mode is on)
  // Latest client-reported details (best-effort; refreshed on login + heartbeat)
  device?: string;       // full parsed string e.g. "Chrome 120 on Android 13 (SM-G991B)"
  os?: string; osVersion?: string; browser?: string; browserVersion?: string; model?: string;
  screen?: string;       // "412×915 @2x"
  lang?: string;         // navigator.language
  tz?: string;           // IANA timezone
  netType?: string;      // effectiveType hint (4g / wifi / …) — unreliable in browsers
  appVersion?: string;
  lastIp?: string;
  lastLocation?: string; // IP-derived location at last activity
}

export interface OtpRecord {
  identifier: string; // normalized phone/email
  code: string;
  expiresAt: number;
  /** Wrong guesses against this code. A new send starts this over. */
  attempts?: number;
  /** When this code was sent, for the resend wait. */
  sentAt?: number;
}

export interface FriendEdge {
  userId: string; // owner perspective
  otherId: string;
  state: FriendState; // friends | incoming | outgoing
}

export interface FollowEdge {
  followerId: string;
  followingId: string;
}

/** An official Business account (Business Module). One user can own several.
 *  `status` gates public visibility — only "verified" businesses show in the
 *  public directory and carry the blue verified badge. */
export interface BusinessRecord {
  id: string;
  ownerId: string; // the user who registered/owns this business
  name: string;
  category: string;
  description: string;
  phone?: string;
  email?: string;
  website?: string;
  location?: string;
  hours?: string; // working hours (free text, e.g. "Mon–Sat 9am–8pm")
  // Contact & social links (Business User View):
  whatsapp?: string; // WhatsApp number (digits, opens wa.me)
  facebook?: string;
  instagram?: string;
  youtube?: string;
  // Values for the admin-defined EXTRA form fields (config.business.fields).
  // Keyed by the field's `key` so adding a new field never needs a schema change.
  fields?: Record<string, string>;
  logo?: string; // base64 data URL (served via /api/business-image/[id])
  cover?: string; // base64 data URL (served via /api/business-image/[id]?kind=cover)
  status: "pending" | "verified" | "rejected" | "suspended";
  // Who can see this business profile:
  //  "everyone"   → any user can view it (default)
  //  "businesses" → only users who have themselves registered a business
  visibility?: "everyone" | "businesses";
  coinsPaid?: number; // coins charged at registration (refunded if rejected)
  views?: number; // profile views (basic analytics)
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  note?: string; // admin decision note (e.g. rejection reason)
}

/** A user following a business (Business Module). */
export interface BusinessFollowEdge {
  userId: string;
  businessId: string;
}

/** One Business-module activity, for admin monitoring (newest first, capped). */
export interface BusinessActivity {
  id: string;
  at: string;
  type: "create" | "update" | "verify" | "reject" | "suspend" | "restore" | "remove";
  actorId: string;
  actorName: string;
  targetId?: string; // business id
  targetName?: string; // business name
  detail?: string;
}

/** A comment on a business post. */
export interface BusinessComment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  at: string;
}

/** A post on a business "page" (Business Pages sub-module): a normal update, an
 *  announcement, or an offer/discount — optionally with a photo. Users can like,
 *  comment and share. */
export interface BusinessPost {
  id: string;
  businessId: string;
  kind: "post" | "announcement" | "offer";
  text: string;
  image?: string; // base64 data URL (served via /api/business-post-image/[id])
  offer?: string; // short offer/discount detail shown on offer posts (e.g. "20% OFF")
  createdAt: string;
  likes: string[]; // userIds who liked
  comments: BusinessComment[];
}

/** A job posted by a business (Jobs sub-module). Only Business accounts can post;
 *  jobs need admin approval before users see them. */
export interface JobPost {
  id: string;
  businessId: string;
  title: string;
  jobType: string; // e.g. "Full Time" — the list is admin-editable (config.business.jobTypes)
  salary?: string; // free-text (e.g. "SAR 5,000/month" or "Negotiable")
  location?: string;
  description: string;
  qualifications?: string; // required qualifications / experience
  vacancies?: number; // number of open positions
  contact?: string; // how to reach the employer (phone/email)
  deadline?: string; // application deadline (ISO date)
  status: "pending" | "approved" | "rejected" | "closed";
  // Values for the admin-defined EXTRA job-form fields (config.business.jobFields).
  fields?: Record<string, string>;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  note?: string;
}

/** A user's application to a job. Applications go to the ADMIN first, who forwards
 *  approved ones to the business (or rejects them). */
export interface JobApplication {
  id: string;
  jobId: string;
  businessId: string;
  userId: string;
  userName: string;
  message?: string; // cover note
  contact?: string; // phone/email the applicant wants to share
  // pending=with admin · forwarded=shared with business (awaiting owner) ·
  // accepted=business hired/shortlisted · rejected=turned down (by admin or business)
  status: "pending" | "forwarded" | "accepted" | "rejected";
  reason?: string; // rejection reason shown to the applicant
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
}

/** A product/service listed by a business (Business Marketplace sub-module). */
export interface BusinessProduct {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  price?: string; // free-text price the owner enters (e.g. "₹1,299" or "SAR 199")
  image?: string; // base64 data URL (served via /api/business-product-image/[id])
  createdAt: string;
}

/** A short (reel) or long-form video on a business profile. Stored as a LINK
 *  (YouTube/Instagram/hosted URL) + an optional thumbnail image — we never store
 *  raw video bytes (that would bloat the DB). "reel" = Shorts tab, "video" = Videos tab. */
export interface BusinessMedia {
  id: string;
  businessId: string;
  kind: "reel" | "video";
  title: string;
  videoUrl: string; // link to the video (opened externally, or played inline if a direct file)
  thumb?: string; // optional base64 data URL thumbnail (served via /api/business-media-image/[id])
  description?: string;
  createdAt: string;
  views: number;
}

/** A comment on a reel. */
export interface ReelComment {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string; // base64/url snapshot for display
  text: string;
  at: string;
}

/** A user-generated REEL (short video). Unlike BusinessMedia (a link on a business
 *  profile), a reel is a first-class, user-owned piece of content with a real
 *  uploaded video file (streamed from /api/media/<file>), engagement (likes /
 *  comments / saves / shares / views), privacy, and admin moderation. Businesses
 *  can post "promotional" reels too (businessId + product/contact/website set). */
export interface ReelRecord {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerUsername: string;
  kind?: "reel" | "video"; // "reel" = short vertical clip, "video" = longer video (default "reel")
  videoFile: string; // filename in .data/uploads (served via /api/media/<file> with Range); empty for link reels
  videoUrl?: string; // external video LINK (YouTube / Vimeo / direct .mp4 URL) — no file uploaded
  thumb?: string; // base64 data URL poster (served via /api/reel-thumb/[id])
  caption: string;
  hashtags: string[];
  musicId?: string; // media-library item id (audio)
  musicName?: string;
  musicSrc?: string; // playable audio url (/api/media/<file> or link)
  stickers?: string[]; // emoji/sticker overlays chosen by the creator
  privacy: "public" | "friends" | "private";
  disableComments?: boolean;
  disableSharing?: boolean;
  status: "draft" | "published";
  hidden?: boolean; // admin-hidden (kept but not shown publicly)
  featured?: boolean; // admin-featured (boosted in Trending / Featured)
  // Business "promotional reel" fields (optional)
  businessId?: string;
  businessName?: string;
  productDetail?: string;
  contact?: string;
  website?: string;
  // Engagement
  likes: string[]; // userIds
  comments: ReelComment[];
  saves: string[]; // userIds who bookmarked it
  shares: number;
  views: number;
  watchSeconds?: number; // total seconds watched across all viewers (for Videos leaderboard)
  createdAt: string;
  updatedAt?: string;
}

/** Default business categories (admin-editable via config.business.categories). */
export const DEFAULT_BUSINESS_CATEGORIES = [
  "Restaurant & Food",
  "Retail & Shopping",
  "Services",
  "Health & Beauty",
  "Education",
  "Technology",
  "Travel & Hospitality",
  "Real Estate",
  "Entertainment",
  "Automotive",
  "Other",
];

/** A custom business-registration field the ADMIN defines (config.business.fields).
 *  Lets the admin add fields to the business form with NO source-code change —
 *  the register form + business profile render these automatically. */
export interface BusinessFieldDef {
  key: string; // stable id (auto-derived from the label) used as the storage-map key
  label: string; // shown to the user on the form + profile
  type: "text" | "textarea" | "tel" | "email" | "url" | "number" | "select";
  options?: string[]; // choices when type === "select"
  placeholder?: string;
  required?: boolean;
  enabled?: boolean; // admin can hide a field without deleting it (default: shown)
}

/** A custom PRODUCT field the admin defines (config.productCategoryFields). Can be
 *  assigned to a specific product category or to ALL categories — no code needed. */
export interface ProductFieldDef {
  id: string;        // stable id
  category: string;  // "" / "*" = all categories, else a specific category name
  key: string;       // storage key (derived from the label)
  label: string;     // shown on the product form + product page
  type: "text" | "textarea" | "number" | "select" | "radio" | "checkbox" | "date" | "file" | "image" | "url";
  options?: string[]; // choices for select / radio / checkbox
  placeholder?: string;
  required?: boolean;
  enabled?: boolean; // hide without deleting (default: shown)
  order?: number;    // display order within the category
}

/** A game token design the admin can manage (enable/disable, rename, add custom). */
export interface TokenDesign {
  id: string;         // stable id — a built-in skin id, or "custom-xxxx"
  name: string;       // display name shown in Customize
  enabled: boolean;   // available to players when true
  builtin?: string;   // the built-in LudoToken skin id (set for built-in designs)
  image?: string;     // image URL — custom art, or an admin REPLACEMENT for a built-in.
                      // Also the fallback for any colour with no picture below.
  // PER-COLOUR artwork. One shared image made all four players' coins identical,
  // so nobody could tell whose coin was whose in a 4-player game. Anything left
  // empty falls back to `image`, keeping older single-image designs working.
  images?: { red?: string; green?: string; yellow?: string; blue?: string };
  category?: string;  // Free / Premium / VIP / Event / Seasonal
  order?: number;     // display order in Customize
  priceCoins?: number;   // 0/unset = free; above 0 = must be bought
  validityDays?: number; // 0/unset = permanent; else the purchase expires
}

/** The built-in token designs (mirrors lib/cosmetics TOKEN_SKINS) used to seed the
 *  admin-managed catalog. Admin can rename/disable these and add custom ones. */
export function defaultTokenDesigns(): TokenDesign[] {
  return [
    { id: "royal-lotus", name: "Royal Lotus 🪷", enabled: true, builtin: "royal-lotus" },
    { id: "lotus-bloom", name: "Lotus Bloom 🌸", enabled: true, builtin: "lotus-bloom" },
    { id: "animal-lotus", name: "Animal Lotus 🦁", enabled: true, builtin: "animal-lotus" },
    { id: "butterfly-lotus", name: "Butterfly Lotus 🦋", enabled: true, builtin: "butterfly-lotus" },
    { id: "peacock-lotus", name: "Peacock Lotus 🦚", enabled: true, builtin: "peacock-lotus" },
    { id: "shiva-lotus", name: "Shiva Lotus 🕉️", enabled: true, builtin: "shiva-lotus" },
    { id: "coin", name: "Royal Coin", enabled: true, builtin: "coin" },
    { id: "classic", name: "Classic", enabled: true, builtin: "classic" },
    { id: "glossy", name: "Glossy", enabled: true, builtin: "glossy" },
    { id: "ring", name: "Ring", enabled: true, builtin: "ring" },
    { id: "gem", name: "Gem", enabled: true, builtin: "gem" },
    { id: "star", name: "Star", enabled: true, builtin: "star" },
    { id: "pin", name: "Pin", enabled: true, builtin: "pin" },
    { id: "pawn", name: "Pawn", enabled: true, builtin: "pawn" },
    { id: "crown", name: "Crown", enabled: true, builtin: "crown" },
    { id: "pearl", name: "Pearl", enabled: true, builtin: "pearl" },
  ];
}

/** Default job types (admin-editable via config.business.jobTypes). */
export const DEFAULT_JOB_TYPES = [
  "Full Time",
  "Part Time",
  "Contract",
  "Internship",
  "Remote",
];

/** A business-profile SECTION (tab). The admin can rename, hide/show, and reorder
 *  these from the admin panel (config.business.profileSections). `key` maps to the
 *  feature-backed content — the set is fixed (page/reels/videos/products/offers/jobs);
 *  the admin controls their visibility, label and order, not their existence. */
export interface BusinessSection {
  key: string;
  label: string;
  enabled: boolean;
}

export const DEFAULT_PROFILE_SECTIONS: BusinessSection[] = [
  { key: "page", label: "Business Page", enabled: true },
  { key: "reels", label: "Reels / Shorts", enabled: true },
  { key: "videos", label: "Videos", enabled: true },
  { key: "products", label: "Products", enabled: true },
  { key: "offers", label: "Offers", enabled: true },
  { key: "jobs", label: "Jobs", enabled: true },
  { key: "reviews", label: "Reviews", enabled: true },
];

export interface NotificationRecord extends AppNotification {
  userId: string;
}

export interface RoomRecord {
  id: string;
  name: string;
  ownerId: string; // the user who created it
  hostId: string;
  hostName: string;
  category: string;
  type: "public" | "private" | "password" | "community";
  capacity: number; // default 10; admin can raise
  tags: string[];
  live: boolean;
  createdAt: string;
  image?: string; // custom room picture (data URL) set by the owner/co-host/admin; falls back to the host avatar
  description?: string;
  announcement?: string;
  // Sticker collection for THIS group. Only the host / co-hosts (and admins) can
  // add or remove them; every member can send them.
  stickers?: RoomSticker[];
  coAdminIds?: string[]; // members promoted to co-admin
  coHostBonus?: number; // EXTRA co-host slots approved for this room (paid request); effective limit = config.coHostLimit + this
  mutedMemberIds?: string[]; // members force-muted by the host/co-host (mic disabled)
  removedMemberIds?: string[]; // members KICKED — ejected right now; the kick LIFTS when they manually reopen the room (only Block is permanent)
  blockedMemberIds?: string[]; // members BANNED — cannot view/join/request until unblocked
  chatMutedIds?: string[]; // members blocked from SENDING group chat (admin moderation); may still view/join
  voiceLocked?: boolean; // host disabled member voice (e.g. during a game) — members force-muted
  autoLockChat?: boolean; // auto-lock group chat when no host/co-host is present (default ON)
  chatLockedNow?: boolean; // host MANUALLY locked the chat — members can't post even when a mod is present
  autoSeatApproval?: boolean;
  /** ADMIN VISIBILITY. false/undefined = "Show Admin" (default, unchanged): an
   *  admin appears in the member list like anyone else. true = "Hide Admin": an
   *  admin entering this group is INVISIBLE to members — hidden from the member
   *  list, the seat grid, the head-count and the voice channel — while keeping
   *  every administrative power (monitor, manage members, settings, remove). */
  hideAdmins?: boolean; // ON (default) = members join a seat instantly; OFF = needs approval
  // Member permissions — what NON-host/co-host members may do. Each is opt-IN:
  // undefined/false = restricted (host & co-hosts only); true = the host has
  // unlocked it for members. So a room is host-controlled by default.
  memberPerms?: { seat?: boolean; mic?: boolean; camera?: boolean; chat?: boolean; games?: boolean };
  // PER-ROOM FEATURE OVERRIDES — this room's OWN configuration (see
  // src/lib/room-features.ts → ROOM_FEATURE_SECTIONS). Only the keys an admin has
  // customised for THIS room are stored; every other feature falls back to the
  // app-wide / current behaviour, so existing rooms are unchanged and editing one
  // room's features never affects any other room.
  features?: Record<string, boolean | number | string>;
  mediaAllowedIds?: string[]; // members the Host has GRANTED "Allow media" (may play room media); host/co-hosts always may
  seatRequests?: SeatRequest[]; // pending "request to join a seat" (when approval is required)
  // The MIRROR of seatRequests: the Host/Co-Host asking a LISTENER to come up
  // and take a seat. The listener accepts (or declines) from inside the room.
  seatInvites?: SeatInvite[];
  stageApprovedIds?: string[]; // members approved to be on a seat (may speak) when approval is on
  audienceIds?: string[]; // members moved to LISTEN-ONLY (off the speaker seats) by a host/co-host
  invitedIds?: string[]; // for private rooms: who may see/enter
  // Admin status control. "active" by default; suspended rooms auto-reactivate
  // once suspendUntil passes.
  status?: "active" | "inactive" | "suspended";
  suspendFrom?: string; // ISO
  suspendUntil?: string; // ISO
  suspendReason?: string;
  // Last time anyone was present (informational only). Rooms are PERSISTENT and
  // are never auto-removed for inactivity — only the Host/Admin can delete one.
  lastActiveAt?: string;
  // Video chat unlocked for this room (after a coin payment + admin approval).
  videoUnlocked?: boolean;
  // Video moderation (host/co-host controlled, no reconnect):
  cameraOffIds?: string[]; // members whose camera the host force-closed
  videoMembersAllowed?: boolean; // can non-host/co-host members turn on their camera? (default true)
  // Host/co-host "now playing" — broadcast to all members (link/YouTube only).
  media?: RoomMedia | null;
  // Moderation
  mutedUserIds?: string[]; // users muted in this room (by host/admin)
  // Moderation log — WHO blocked/kicked/unblocked WHOM, when, and why. Written
  // automatically whenever the blocked/removed lists change (v292+; earlier
  // actions predate the log and are not recoverable).
  modLog?: { id: string; at: string; action: "block" | "unblock" | "kick" | "unkick"; targetId: string; targetName?: string; byId: string; byName: string; reason?: string }[];
  recording?: boolean; // moderation recording active (shows a notice to members)
  recordingStartedAt?: string; // ISO
  // Competition Voice Room — when true this room hosts a competition (contestants
  // + audience voting + scoreboard, see db.competitions). Additive: normal rooms
  // are unaffected; these appear only in the /competitions section.
  isCompetition?: boolean;
}

// ---------- Public Singing Competition Room ----------
/** A registered singer. `status` is the registration state; approved singers get
 *  an `order` and receive `marks` (voterId → 0..10) during their performance. */
export interface CompetitionParticipant {
  userId: string;
  name: string;
  status: "pending" | "approved" | "rejected" | "disqualified";
  order?: number;                      // performance order among approved singers
  marks: Record<string, number>;       // voterId → mark 0..10 (one per voter — dedupe)
  scoreAdjustment?: number;            // admin manual +/- adjustment on top of the vote total (audited)
  registeredAt: string;
}
export interface CompetitionGift { fromId: string; fromName: string; toUserId: string; giftName: string; coins: number; at: string }

/** One PERMANENTLY-STORED result row inside a finished round (frozen snapshot —
 *  never overwritten when the next round runs). */
export interface CompetitionRoundResult { userId: string; name: string; total: number; average: number; voteCount: number; rank: number; qualified?: boolean }
/** A competition ROUND (Round 1, Quarter Final, custom…). Its `results` are frozen
 *  the moment the round is completed and stay available until the competition ends. */
export interface CompetitionRound {
  id: string;
  name: string;
  order: number;
  status: "pending" | "active" | "completed";
  enabled?: boolean;                   // admin can disable a round without deleting it (default enabled)
  qualifyCount?: number;               // how many top scorers QUALIFY to the next round (0 = all)
  results?: CompetitionRoundResult[];  // frozen when completed — NEVER overwritten
  startedAt?: string;
  completedAt?: string;
}
/** A per-competition prize position (1st / 2nd / …). Amount + individual on/off. */
export interface CompetitionPrize { position: number; coins: number; enabled: boolean; label?: string }
/** A moderation / penalty event in a competition (warning, penalty, disqualify…). */
export interface CompModEvent {
  id: string; at: string;
  actorId: string; actorName: string;
  targetId: string; targetName: string;
  action: "warn" | "penalty" | "disqualify" | "restore" | "remove" | "ban" | "score";
  reason?: string; note?: string; coins?: number;
  prevScore?: number; newScore?: number; // set for "score" edits (audit: before → after)
}
/** A staff member assigned by the Admin, with a granular permission set (see
 *  src/lib/competition-perms.ts). role ∈ host|cohost|moderator|judge. */
export interface CompetitionStaff { userId: string; name: string; role: "host" | "cohost" | "moderator" | "judge"; permissions: string[]; at: string }
export interface CompetitionRecord {
  id: string;
  roomId: string;      // the voice room hosting the competition
  title: string;
  prize?: string;
  hostId: string;
  // Lifecycle: setup (registration) → live (singing) ⇄ paused → ended → results.
  status: "setup" | "live" | "paused" | "ended" | "results";
  registrationOpen: boolean;
  votingEnabled: boolean;
  giftsEnabled: boolean;
  participants: CompetitionParticipant[];
  order: string[];                     // approved participant userIds, in singing order
  currentIndex: number;                // -1 before start; index into `order`
  turnStartedAt?: string;              // when the current singer's (running) turn began
  turnPausedElapsedSec?: number;       // seconds already consumed this turn BEFORE the running segment (so Pause preserves time, Resume continues, Restart resets)
  performanceSeconds: number;          // fixed time per singer (host/admin set)
  gifts?: CompetitionGift[];           // gifts sent to participants (for totals)
  audience: string[];                  // distinct userIds seen in the room (audience count)
  winnerIds?: string[];                // ranked winners, set when results are declared
  // Admin-managed extras:
  staff?: CompetitionStaff[];          // assigned Co-Host/Moderator/Judge + their permissions (Host = the permanent creator/admin)
  speakingSeats?: number;              // # of speaking seats the admin sets after closing registration
  registrationFeeCoins?: number;      // coins charged to register (0 = free / unlimited open registration)
  winnerPrizeCoins?: number;          // coins awarded to the winner when results are declared
  paidRegistrants?: string[];          // userIds who already paid the registration fee (no double-charge)
  // Scheduling (admin-set): registration window, match time, and seat cap.
  totalSeats?: number;                 // max participants (0 = unlimited)
  registrationOpensAt?: string;        // ISO — when registration opens
  registrationClosesAt?: string;       // ISO — when registration closes
  matchAt?: string;                    // ISO — the competition match date & time
  // Multi-round system (opt-in — a competition with no rounds behaves exactly as before):
  rounds?: CompetitionRound[];         // named rounds; each keeps its own frozen results
  currentRoundId?: string;             // the round currently being scored
  prizes?: CompetitionPrize[];         // per-competition prize positions (overrides the global config prizes)
  modLog?: CompModEvent[];             // moderation / penalty history (controllers only)
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  resultsAt?: string;
}

// A per-room moderation/activity event (join, mute, ban, etc.) — feeds the
// room audit trail.
export interface RoomEvent {
  id: string;
  roomId: string;
  type: "join" | "leave" | "mute" | "unmute" | "remove" | "suspend" | "ban" | "cohost" | "uncohost" | "rejoin_blocked" | "seat_request" | "seat_approved" | "seat_declined" | "seat_left" | "seat_invited" | "seat_invite_declined";
  target: string; // display name of the affected member
  actorName: string;
  actorId: string;
  at: string;
}

// A user-submitted report about another user (abuse, spam, etc.).
export interface UserReport {
  id: string;
  reportedId: string;
  reportedName: string;
  reportedPublicId?: string; // member ID NUMBER of the reported user (shown beside the name)
  byId: string;
  byName: string;
  byPublicId?: string; // member ID NUMBER of the reporter
  reportedUsername?: string; // @handle of the reported user (for a clickable link)
  byUsername?: string;
  roomId?: string;
  roomName?: string;
  reelId?: string; // set when the report targets a reel (content report)
  businessId?: string; // set when the report targets a business profile
  businessName?: string;
  targetType?: "user" | "reel" | "business" | "comment" | "room"; // what was reported
  category: string; // Abusive language / Harassment / Spam / Inappropriate / Other
  detail: string;
  status: "open" | "actioned" | "dismissed";
  at: string;
  handledBy?: string;
  handledAt?: string;
}

/** A user review + star rating left on a business, shown to other users. Admins
 *  can hide or remove reviews. */
export interface Review {
  id: string;
  businessId: string;
  userId: string;
  userName: string;
  rating: number; // 1–5 stars
  text: string;
  status: "visible" | "hidden"; // admin-hidden reviews aren't shown publicly
  createdAt: string;
  reply?: string; // optional business-owner reply
  repliedAt?: string;
}

// A persisted voice-room (group) chat message (kept for moderation history).
export interface RoomChatMessage {
  id: string;
  roomId: string;
  roomName: string;
  userId: string;
  userName: string;
  text: string;
  at: string;
  type?: "text" | "image" | "audio" | "video" | "gift" | "sticker" | "file"; // message kind (default text)
  mediaUrl?: string; // for image/audio/video/file/sticker messages
  mediaName?: string; // original filename (documents)
  mediaMime?: string; // MIME type (documents)
  deleted?: boolean; // soft-deleted by an admin (kept for the audit trail)
  deletedBy?: string; // admin who removed it
  deletedAt?: string; // ISO
}

// A voice-room recording (metadata). Actual audio capture requires a media
// server; this stores the session metadata the Super Admin manages.
export interface Recording {
  id: string;
  kind?: "room" | "call"; // room recording vs Paid-Zone call recording (default room)
  roomId: string;
  roomName: string;
  hostId?: string;   // the room's host / owner (for "filter by host")
  hostName?: string;
  startedBy: string; // who started it (admin/host)
  startedAt: string;
  endedAt?: string;
  durationSec?: number;
  participants: string[];
  // Available = "stored"; the others cover the full lifecycle the admin sees.
  status: "recording" | "processing" | "stored" | "archived" | "deleted";
  fileUrl?: string;  // /api/media/<name> once the captured audio is uploaded
  fileName?: string; // stored upload filename (so delete can remove the file)
  sizeBytes?: number;// captured file size (storage dashboards)
  callId?: string;   // linked CallSession id (call recordings)
  callType?: "audio" | "video";
  note?: string;
}

export interface SeatRequest {
  userId: string;
  userName: string;
  username?: string;   // @handle, shown in the approval card
  publicId?: string;   // permanent member ID number, shown in the approval card
  avatar?: string;
  at: string; // ISO
}

/** A Host/Co-Host inviting a listener up to a seat. The invitee sees this in
 *  the room and accepts or declines; accepting seats them immediately. */
export interface SeatInvite {
  userId: string;      // who is being invited
  userName: string;
  byId: string;        // who invited them
  byName: string;
  at: string;          // ISO
}

export interface RoomMedia {
  kind: "audio" | "video" | "youtube" | "image";
  src: string;
  startedAt: number; // epoch ms when playback began (for rough sync)
  name?: string; // file/track name shown to all members
  ownerId?: string; // who started it — playback stops if they leave the room
  ownerName?: string;
  live?: boolean; // true = streamed live from the owner's device (no upload/storage)
  paused?: boolean; // host paused for everyone
  pausedAtSec?: number; // playback position (s) captured when paused, for resume sync
  mutedForAll?: boolean; // host muted the media audio for the whole room
}

// Platform-wide configuration controlled from the Admin Panel.
// Persisted so admin changes actually take effect across the live app.
export interface RewardRule {
  id: string;
  label: string;
  coins: number;
  on: boolean;
}

export interface MembershipPlan {
  id: string;
  name: string;
  price: number; // in INR per period
  period: "month" | "year";
  perks: string[];
  on: boolean;
}
export interface MembershipSubscriberFeatures {
  dice?: boolean;
  boards?: boolean;
  tokens?: boolean;
  frames?: boolean;
  profileStore?: boolean;
  gameCosmetics?: boolean;
  paidZone?: boolean;
  paidZoneCalls?: boolean;
  tournaments?: boolean;
  competitions?: boolean;
}

export interface AdItem {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string;
  position: "top" | "sidebar" | "feed" | "interstitial" | "gameTop";
  active: boolean;
  impressions: number;
  clicks: number;
  text?: string;      // running/scrolling one-line text (shown as a ticker on gameTop ads)
  priority?: number;  // higher shows first when several ads share a position
}

export interface CoinPackage {
  id: string;
  name: string;
  coins: number;
  price: number; // in the QR/UPI currency (admin-set)
  bonus?: number; // bonus coins added on top when the purchase is approved
  iconUrl: string;
  active: boolean;
  featured: boolean;
  badge: "" | "popular" | "best_value";
}

// An admin-managed gift (Admin → Gifts). Drives the in-app gift picker.
export interface GiftItem {
  id: string;
  emoji: string; // the emoji OR a short label
  name: string;
  cost: number; // coins
  category?: string;
  active: boolean;
}

export interface CoinOffer {
  id: string;
  name: string;
  type: "bonus" | "discount"; // bonus coins, or % discount
  amount: number;
  from: string; // ISO
  until: string; // ISO
  active: boolean;
}

export interface SupportTicket {
  id: string;
  userId?: string; // who opened it (for notifying them of a reply)
  userName: string;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved";
  reply?: string;
  createdAt: string;
  // Set when the message came from the PUBLIC contact form (no login), so
  // support has a way to answer someone who has no account yet.
  email?: string;
  source?: "app" | "contact-form";
  ip?: string;
}

/**
 * SCREEN SHARE & REMOTE SUPPORT session.
 *
 * WHAT IS AND ISN'T POSSIBLE (deliberately recorded here so nobody re-promises it):
 * a web page CANNOT capture a phone's screen — getDisplayMedia is not implemented
 * on Android Chrome or iOS Safari — and no web page can remote-CONTROL another
 * device. So:
 *   • "live"      — real screen sharing over LiveKit. Desktop browsers only.
 *   • "recording" — the phone's own screen recorder / screenshots, uploaded here.
 * and remote control is a GUIDED session: support highlights a step, the USER taps
 * it. Every request and every approval is recorded below.
 *
 * Nothing starts without the user's explicit consent, and the user can end it at
 * any moment.
 */
export interface SupportSession {
  id: string;
  userId: string;
  userName: string;
  userPublicId?: string;
  ticketId?: string;                       // the support ticket this belongs to
  status: "active" | "ended";
  mode: "live" | "recording";
  startedAt: string;
  endedAt?: string;
  endedBy?: "user" | "admin" | "expired";
  /** Exactly what the user agreed to, kept verbatim for the record. */
  consent: { at: string; text: string };
  /** Guided-control permission. Never granted without an explicit user Accept. */
  control: {
    state: "none" | "requested" | "granted" | "denied" | "revoked";
    requestedBy?: string;
    requestedAt?: string;
    decidedAt?: string;
  };
  /** True while the user's screen is ACTUALLY being published to the session's
   *  LiveKit room — so support is only offered "Watch live" when there is
   *  something live to watch. */
  liveSharing?: boolean;
  /** Screen recordings / screenshots the user chose to send. */
  attachments: { id: string; kind: "recording" | "screenshot"; url: string; name: string; sizeBytes?: number; at: string }[];
  /** Device / app facts the user agreed to share — what support actually needs. */
  diagnostics?: Record<string, string | number | boolean | null>;
  /** Steps support asked the user to perform during a guided session. */
  guidance: { id: string; at: string; by: string; text: string; doneAt?: string }[];
  /** Full audit trail: who did what, when. */
  events: { at: string; who: string; what: string }[];
  adminName?: string;
}

export interface AdminLog {
  id: string;
  admin: string;
  adminId?: string; // the acting admin's visible ID (publicId ?? id) — for the audit view
  action: string;
  at: string;
  // Optional STRUCTURED fields (additive, back-compatible with existing records).
  // Populated by Reset & Recovery so the audit view can show/filter Room ID, Match
  // ID and the admin's Reason as first-class columns instead of buried in `action`.
  roomId?: string;
  matchId?: string;
  reason?: string;
  category?: string; // e.g. "reset" — groups recovery actions in the audit view
}

/** A security alert dismissed from Admin -> Device & Security. */
export interface DismissedSecurityAlert {
  id: string; // stable alert fingerprint
  at: string;
  by: string;
}

/** One admin decision on an approval-queue item, kept for the Approval History.
 *  Written for queues whose own record doesn't keep who decided (or keeps nothing
 *  at all once decided, like profile-photo approvals). */
export interface ApprovalLogEntry {
  id: string;
  category: string;  // the Pending Approvals category key, e.g. "photoEditor"
  itemId: string;    // the decided item (e.g. agency id, "<tournamentId>:<userId>")
  subject: string;   // what was decided, human-readable
  userId?: string;   // the member the request was about
  userName?: string;
  status: string;    // approved / rejected / removed / resolved …
  decidedBy: string; // admin (or host) name
  at: string;        // ISO decision time
  note?: string;
}

export interface GameSession {
  id: string;
  roomId: string;
  roomName: string;
  game: string; // "Ludo" | "Chess" | "Snake & Ladder"
  players: string[];
  playerIds?: string[]; // user ids of the seated players (parallel to players[])
  startedByName: string;
  status: "running" | "completed" | "ended"; // ended = force-ended OR auto-closed when the room emptied
  winner?: string;
  createdAt: string;
  endedAt?: string;
  // Last time the game had activity OR live participants in its room. Drives the
  // auto-close of abandoned games (see reapAbandonedSessions).
  //
  // ⚠ THIS IS A LIVENESS STAMP, NOT A MOVE STAMP. The reaper refreshes it on a
  // timer for any room that still has people in it, whether or not anybody is
  // actually playing. Never use it to decide whether a player is taking their
  // turn — that is what `lastMoveAt` below is for.
  lastActiveAt?: string;
  // When the server last received a real BOARD PUSH from a player (a roll, a
  // token move, a leave). Written ONLY by syncGameState/markSeatLeft — never by
  // the reaper, a poll, or presence. This is the single witness the turn timer
  // trusts before it may pass an absent player's turn on.
  lastMoveAt?: string;
  state?: string; // serialized live game state (for spectators)
  spectators?: { id: string; at: number }[]; // recent spectator heartbeats
  leftSeats?: string[]; // seat keys (colours) that pressed Leave — server-authoritative
  //                       so every client removes them regardless of the state version.
  moves?: GameMove[]; // COMPLETE move-by-move log of the CURRENT round (server-derived
  //                     from the synced state; copied into GameResult when the round ends).
}

// One entry in a match's move-by-move history (roll, token move, capture, etc.).
export interface GameMove {
  n: number;      // 1-based sequence within the round
  at: string;     // ISO time
  type: "roll" | "move" | "home" | "capture" | "win" | "pass";
  by: string;     // player name (or colour if the name is unknown)
  value?: number; // dice value (for a roll)
  text: string;   // ready-to-show line, e.g. "Red rolled 6"
}

// ---- Game Lobby (new Host-controlled match-start flow) ----
export interface LobbySeat {
  color: string;       // seat colour (ludo: red/green/yellow/blue)
  id?: string;         // occupant user id (empty = open seat)
  name?: string;       // occupant display name
  joinedAt?: string;   // when they took the seat
}
export interface LobbyLogEntry {
  at: string;
  event: string;       // opened | mode | join | leave | start | forceStart | cancel | remove | ban | lock | unlock | public | color | pause | resume | restart | autostart
  actor?: string;      // who did it (display name)
  detail?: string;
}
export interface GameLobby {
  id: string;
  roomId: string;
  roomName: string;
  game: string;        // "ludo" | "snake" | "chess"
  gameName: string;    // display name
  hostId: string;      // who OPENED the lobby (Host/Co-Host/Admin)
  hostName: string;
  startedByRole: "host" | "coHost" | "admin";
  mode: "manual" | "auto" | null;                    // null until the opener chooses
  status: "choosing" | "open" | "starting" | "started" | "cancelled";
  seats: LobbySeat[];                                 // fixed-size lobby (= maxPlayers)
  locked: boolean;                                    // no new joins
  publicJoin: boolean;                                // any eligible member may join
  banned: string[];                                   // user ids barred from THIS lobby
  countdownStartAt?: string;                          // when the current auto-join countdown began
  countdownSeconds: number;                           // countdown duration
  paused: boolean;                                    // host paused the timer
  pausedRemaining?: number;                           // seconds left when paused
  startedAt?: string;
  createdAt: string;
  log: LobbyLogEntry[];
}

/** One line in the stuck-game reset history (Admin → Reset & Recovery). Written
 *  by the automatic cleanup AND by every manual reset, so the admin can always
 *  see what was cleared, when, why, and who it affected. */
export interface StuckResetEntry {
  id: string;
  at: string;                       // ISO
  auto: boolean;                    // automatic cleanup vs an admin pressing Reset
  by: string;                       // "Auto cleanup" or the admin's name
  kind: "lobby" | "session";
  game: string;                     // ludo / snake / chess
  roomId: string;
  roomName: string;
  reason: string;                   // plain-English why it was considered stuck
  ageHours: number;                 // how long it had been stuck
  players: string[];                // who was sitting in it
}

// A real game invitation OR join-request between two users in a room. The
// recipient gets a notification + an in-app popup to Accept/Reject; a player is
// only shown as "joined" after they actually accept (no auto-accept).
export interface GameInvite {
  id: string;
  roomId: string;
  game: string; // "ludo" | "snake" | "chess"
  gameName: string; // "Ludo" | "Snake & Ladder" | "Chess"
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  kind: "invite" | "request"; // host→member invite, or member→host join request
  status: "pending" | "accepted" | "rejected" | "expired" | "cancelled";
  at: string;
  respondedAt?: string;
  color?: string; // invitee's preferred seat colour (Ludo) — honoured by the host at start if it's free
}

export interface Transaction {
  id: string;
  userId: string;
  userName: string;
  type: "purchase" | "spend" | "credit" | "debit"; // credit/debit = admin manual
  coins: number; // positive magnitude of coins moved
  amount: number; // INR paid (purchases only; 0 otherwise)
  status: "success" | "pending" | "failed";
  description: string;
  balanceAfter: number; // COIN wallet balance after this tx (every coin consumer reads this)
  createdAt: string;
  ref?: string; // payment reference / idempotency key (prevents duplicate credits)
  unit?: "coin" | "lotus"; // which wallet this moved (default/absent = coin). Lets the
                            // Wallet Management split a Coin ledger vs a Lotus ledger reliably.
  // For Lotus-wallet movements we DELIBERATELY keep `coins: 0` + `balanceAfter: <coin balance>`
  // so the (many, un-audited) coin reports/ledgers that sum `coins`/read `balanceAfter` are
  // never polluted by Lotus magnitudes. The Lotus amount + Lotus running-balance live in these
  // dedicated fields, read ONLY by the Wallet-Management Lotus ledger (userWalletDetail).
  lotusAmount?: number;       // magnitude of the Lotus movement (positive)
  lotusBalanceAfter?: number; // Lotus wallet balance after this tx
}

// One WALLET-MANAGEMENT admin action, recorded as a durable financial audit trail
// (separate from the capped adminLogs) with before/after balance + IP + device.
export interface WalletAuditEntry {
  id: string;
  at: string;
  admin: string;
  adminId?: string;
  action: string;        // "Add coins" | "Deduct lotus" | "Freeze wallet" | "Transfer coins" | …
  userId: string;
  userName: string;
  publicId?: string;
  currency: "coin" | "lotus" | "";  // "" for non-balance actions (freeze/unfreeze)
  delta: number;         // signed change (0 for freeze/unfreeze)
  oldBalance: number;
  newBalance: number;
  reason?: string;
  ip?: string;
  device?: string;
}

// A wallet cash-out request. Coins are held (deducted) on request and either
// paid out (completed) or refunded (rejected).
export interface WithdrawalRequest {
  id: string;
  userId: string;
  userName: string;
  coins: number; // coins withdrawn / held (0 for Lotus withdrawals)
  amountINR: number; // GROSS payout value (before fee), in the payout currency
  feeAmount?: number; // withdrawal SERVICE fee kept by the company (payout currency)
  gstAmount?: number; // GST deducted from the gross (payout currency)
  netAmount?: number; // NET amount actually paid to the user (gross − GST − fee)
  currency?: string; // payout currency label at request time (e.g. "SAR")
  method: string; // Bank transfer / UPI / PayPal
  details: string; // account no / UPI id / PayPal email
  status: "pending" | "approved" | "rejected" | "completed";
  at: string;
  decidedAt?: string;
  decidedBy?: string;
  note?: string;
  feeProfitRecorded?: boolean; // guard: the withdrawal fee was already logged to the Company Profit ledger (once)
  kind?: "coins" | "lotus"; // which balance was withdrawn (default "coins" for legacy rows)
  lotus?: number; // Lotus Flowers withdrawn / held (when kind === "lotus")
}

// A recorded rule-breach against a user + the penalty applied.
export interface Violation {
  id: string;
  userId: string;
  userName: string;
  type: string; // Fraud, Payment abuse, Chargeback, Cheating, Spam, Harassment, Other
  reason: string;
  penaltyCoins: number; // coins deducted as a fine (0 if none)
  action: string; // "Warning" | "Coin penalty" | "Account suspended"
  status: "active" | "resolved";
  by: string; // admin who recorded it
  createdAt: string;
  resolvedAt?: string;
}

// A single uploaded KYC / bank document.
export interface KycDoc {
  kind: string; // "id_front" | "id_back" | "selfie" | "passbook" | "statement" | "cheque"
  url: string; // /api/file/<name>
  name: string; // stored filename
  originalName: string;
  at: string;
}

// Bank account details (for payouts) + their own verification state.
export interface BankDetails {
  accountHolder?: string;
  bankName?: string;
  accountNumber?: string;
  iban?: string;
  branch?: string;
  swift?: string; // SWIFT / IFSC
  status?: "unverified" | "pending" | "verified" | "rejected";
  note?: string;
}

// KYC (identity) record — used when real money is involved (purchases/payouts).
export interface KycRecord {
  // "resubmit" = admin asked the user to re-upload corrected documents.
  status: "unverified" | "pending" | "verified" | "rejected" | "resubmit";
  legalName?: string;
  idType?: string; // National ID, Passport, Driving License
  idNumber?: string;
  note?: string;
  documents?: KycDoc[]; // ID front/back, selfie, supporting bank docs
  bank?: BankDetails;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

// One record per gift sent — captures BOTH sides + where it happened, so the
// admin can monitor gift activity (who sent what to whom, during which game).
export interface GiftLogEntry {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  giftId: string;
  emoji: string;
  giftName: string;
  cost: number;
  // Earnings split recorded at send time (for audit / troubleshooting). Older
  // entries predate the split and leave these undefined (treated as full credit).
  receiverShare?: number; // coins credited to the receiver's wallet
  companyShare?: number; // coins kept as company/admin revenue
  sharePct?: number; // receiver % applied at the time of this gift
  context: string; // "Ludo game", "Chess game", "Snake & Ladder game", "Voice room", "Profile"…
  at: string;
  // ---- v292 Gift Audit extensions (older entries predate these) ----
  fromPublicId?: string;  // sender's public User ID (e.g. 100008)
  toPublicId?: string;    // receiver's public User ID
  roomId?: string;        // the group/room the gift was sent in (empty = profile/other)
  roomName?: string;
  roomType?: string;      // "Voice Room" | "Private Room" | "Competition Room"
  roomLive?: boolean;     // was the room live at send time
  presentCount?: number;  // how many users were present in the room at that moment
  presentUsers?: { id: string; publicId?: string; name: string }[]; // presence snapshot (capped)
  txId?: string;          // sender's wallet transaction id
  receiverTxId?: string;  // receiver's credit transaction id (coin mode)
  senderBalanceBefore?: number;   // sender coins before / after
  senderBalanceAfter?: number;
  receiverBalanceBefore?: number; // receiver coins (or Lotus) before / after
  receiverBalanceAfter?: number;
  receiverUnit?: string;  // "coins" or the Lotus currency name
  agencyShare?: number;   // agency profit from this gift
  trustShare?: number;    // Trust Wallet profit from this gift
  status?: "success" | "failed" | "refunded"; // failed attempts are logged too
  failReason?: string;    // why a failed gift didn't go through
}

export interface TournamentRequest {
  userId: string;
  userName: string;
  status: "pending" | "approved" | "rejected";
  at: string; // when the join request was submitted
  decidedAt?: string;
  decisionNote?: string; // e.g. "Removed by admin" (distinguishes a removal from a plain reject)
  feeCharged?: number; // entry-fee coins HELD from the player at request time (refunded on reject/remove/cancel; 0 = settled)
}

// A single prize tier (1st–4th place) — amount + optional description.
export interface TournamentPrize {
  place: 1 | 2 | 3 | 4;
  amount: number;
  detail?: string; // e.g. "+ Winner trophy badge"
}

// One match in the knockout bracket. Winner is recorded by the admin (referee
// model) so brackets reflect the REAL result, not a placeholder.
export interface TournamentMatch {
  aId: string | null;
  bId: string | null;
  winnerId?: string | null;
  // TRUE when this player advanced because they had no opponent, NOT because
  // they won a game. Without this a bye is indistinguishable from a real win,
  // which is exactly what made the bracket look like it was picking winners on
  // its own. The UI must label these clearly.
  bye?: boolean;
  // Audit: who recorded the result and when (empty for byes).
  decidedBy?: string;
  decidedAt?: string;
}
export interface TournamentBracket {
  generatedAt: string;
  rounds: { name: string; matches: TournamentMatch[] }[];
}

// ---- Match Room + Qualification system (per the "Tournament Match Configuration" spec) ----
// A physical match room holding 2 or 4 players; stays open until `winnersRequired`
// players qualify, then the rest are eliminated and the room completes.
export type RoomStatus = "waiting" | "live" | "qualifying" | "completed" | "cancelled" | "paused";
export interface TournamentRoom {
  id: string;               // "trm_…" unique room id
  roundNumber: number;      // 1-based round
  roomNumber: number;       // human-readable room number within the tournament
  matchNumber: number;      // sequence within the round
  name: string;             // e.g. "Round 1 · Room 3"
  password: string;         // room access password
  playerIds: string[];      // assigned players (2 or 4)
  winnersRequired: number;  // 1, 2 or 3
  qualifiedIds: string[];   // players who have qualified (in order)
  eliminatedIds: string[];  // filled when the room completes
  status: RoomStatus;
  startAt?: string;
  endAt?: string;
  // ---- Player Ready / join-timer system (availability-aware batching) ----
  readyIds?: string[];      // players who pressed READY for this match
  absentIds?: string[];     // marked absent when the join deadline passed without READY
  joinDeadline?: string;    // ISO — players must press READY before this moment
  remindersSent?: number[]; // deadline reminders already sent (minutes-left marks, e.g. [10,5,1])
  voiceRoomId?: string;     // the actual voice room AUTO-CREATED for this match (players deep-link into it)
}

export interface TournamentRecord {
  id: string;
  title: string;
  game: "Ludo" | "Chess";
  prize: number; // headline/total prize pool (kept for backward compatibility)
  prizes?: TournamentPrize[]; // per-place breakdown (1st/2nd/3rd/4th)
  poster?: string; // poster image (data URL or link) shown before joining
  description?: string; // tournament details shown with the poster
  entry: number;
  capacity: number; // max participants
  status: "upcoming" | "live" | "completed" | "cancelled";
  regOpen: boolean; // manual registration open/close
  regStart?: string; // ISO
  regEnd?: string; // ISO
  startAt?: string; // ISO — fixed start date/time; auto-goes LIVE at this moment
  createdAt: string;
  joinedUserIds: string[]; // approved & joined participants
  requests: TournamentRequest[];
  // Knockout bracket + real results (admin-recorded winners → auto-advance).
  bracket?: TournamentBracket;
  // Final standings once decided (ids), for the results view + prize payout.
  championId?: string;
  runnerUpId?: string;
  thirdIds?: string[]; // the two semifinal losers (3rd/4th)
  prizesPaidAt?: string; // set when 1st–4th prizes were auto-distributed
  cancelledReason?: string;
  // ---- Match Room + Qualification config (Tournament Match Configuration spec) ----
  tournamentType?: "public" | "private";
  matchType?: "1v1" | "4player";   // players per room = 2 or 4
  winnersPerRoom?: 1 | 2 | 3;      // 1v1 is always 1
  autoNextRound?: boolean;         // auto-generate the next round when a round completes
  autoPrizeDist?: boolean;         // auto-credit prizes when the champion is decided
  rooms?: TournamentRoom[];        // every match room across all rounds
  currentRound?: number;           // highest round generated
  roomsGeneratedAt?: string;
  // ---- Availability-aware batching settings (per tournament, admin toggles) ----
  readyCheck?: boolean;            // players must press READY before the match (default ON)
  joinTimerMinutes?: number;       // minutes to press READY after rooms are made (default 10)
  autoReplace?: boolean;           // deadline passed → auto-swap absent players from the waiting pool (default OFF)
  autoStartWhenReady?: boolean;    // all players READY → the room goes LIVE by itself (default ON)
  allowSpectators?: boolean;       // non-players may watch this tournament's match rooms (default ON)
  autoCloseRoom?: boolean;         // a room auto-completes once its winners qualify (default ON); OFF = admin closes it manually
}

// ---- Lucky Number Game (admin-created number lottery) ------------------------
// One user's entry into a draw. `numbers` holds the picked number(s) (1+ when the
// admin allows multiple picks). `feeCharged` is the coin entry-fee HELD, refunded
// if the game is cancelled (mirrors TournamentRequest.feeCharged).
export interface LuckyNumberEntry {
  userId: string;
  userName: string;
  publicId?: string;
  numbers: number[];
  at: string;
  feeCharged?: number;
}

// One Lucky Number draw event. The draw METHOD (auto/manual) and the pre-selected
// `manualNumber` are ADMIN-ONLY — the view mapper never sends them to users or to a
// host/co-host. `winningNumber` is only revealed once `drawnAt` is set.
export interface LuckyDrawRecord {
  id: string;
  name: string;
  status: "scheduled" | "open" | "closed" | "drawn" | "cancelled";
  enabled: boolean;                 // per-game on/off (master switch = config.features.luckyNumber)
  minNumber: number;                // inclusive range
  maxNumber: number;
  drawMethod: "auto" | "manual";    // HIDDEN from users + host/co-host
  manualNumber?: number;            // admin's pre-selected winning number (manual) — HIDDEN until draw
  winningNumber?: number;           // revealed after the draw
  numberLocked?: boolean;           // once the draw runs the winning number can't change
  startAt?: string;                 // ISO — entry opens (auto scheduled→open)
  endAt?: string;                   // ISO — entry closes (auto open→closed)
  drawAt?: string;                  // ISO — planned draw time (shown as countdown)
  entryFee?: number;                // coins per entry (0 = free)
  maxPicksPerUser?: number;         // how many numbers one user may submit (default 1)
  allowEditPick?: boolean;          // user may change their pick before the game closes
  prize?: number;                   // prize paid to each/all winners via creditEarning
  prizeDetail?: string;
  splitPrize?: boolean;             // multiple winners: split the prize (true) vs each gets full (false)
  /** MULTI-ROUND games only: pay the prize to every round's winner ("round",
   *  the default), or once at the end to whoever finishes top ("final"). */
  prizeMode?: "round" | "final";
  roomId?: string;                  // optional linked voice room — its host/co-host may run the draw
  roomName?: string;
  entries: LuckyNumberEntry[];
  winnerIds?: string[];             // set at draw time
  drawnAt?: string;
  drawnBy?: string;                 // name of the admin/host who ran the draw
  prizePaid?: number;               // per-winner prize actually credited
  createdAt: string;
  createdBy?: string;
  cancelledReason?: string;

  // ---- Multi-round tournament model (Lucky Number Game Requirements) --------
  // The original record above is a SINGLE draw. The client's specification is a
  // multi-round, group-gated, host-run game, so those fields are added here.
  // A record with no `totalRounds` stays a classic single draw and behaves
  // exactly as before — nothing existing is disturbed.
  totalRounds?: number;             // §3 admin fixes the round count up front
  currentRound?: number;            // 1-based index into `rounds`
  maxPlayers?: number;              // §2
  minPlayers?: number;
  hostId?: string; hostName?: string;        // §34 — must be a group member
  coHostId?: string; coHostName?: string;
  groupRoomId?: string;             // §6 the group a player MUST belong to
  groupRoomName?: string;
  joiningMode?: "manual" | "auto" | "both";  // §5 invitation and/or open joining
  joiningOpen?: boolean;            // §4 open / close joining
  selectionSeconds?: number;        // §21 number-selection countdown
  selectionMethod?: "pick" | "type" | "both"; // §17
  winnerContinuation?: "continue" | "removed" | "noWin"; // §31
  finalRankBy?: "wins" | "points" | "firstToTarget" | "manual"; // §48
  pointsPerWin?: number;            // used by the "points" ranking method
  gameStatus?: LuckyGameStatus;     // §58 lifecycle
  players?: LuckyPlayer[];          // §54
  rounds?: LuckyRound[];            // §53
  audit?: LuckyAudit[];             // §56 — append-only
  startedAt?: string;
  completedAt?: string;
  finalRanks?: { userId: string; userName: string; wins: number; points: number; rank: number }[];
}

// §58 — the game lifecycle.
export type LuckyGameStatus =
  | "draft" | "waiting" | "joiningOpen" | "joiningClosed"
  | "started" | "paused" | "completed" | "cancelled";

// §43 — every player carries a clear status.
export type LuckyPlayerStatus =
  | "invited" | "joined" | "eligible" | "removedFromGroup"
  | "leftGame" | "disqualified" | "completed";

// §54 — per-player record.
export interface LuckyPlayer {
  userId: string;
  userName: string;
  publicId?: string;
  status: LuckyPlayerStatus;
  invitationType?: "manual" | "auto";
  joinedAt?: string;
  invitedBy?: string;
  removedAt?: string;
  removeReason?: string;
  wins?: number;
  points?: number;
  /** Joining cost actually taken from this player, so it can be given back
   *  if the game is cancelled or they are removed. 0 once refunded. */
  feeCharged?: number;
  /** Prize coins paid to this player so far (for the admin's audit). */
  prizePaid?: number;
}

// §55 — one reserved number. The engine enforces uniqueness of
// (round + number) and (round + userId) before writing either of these.
export interface LuckyPick {
  userId: string;
  userName: string;
  number: number;
  at: string;                       // server timestamp — §14 decides priority
  released?: boolean;
  releasedAt?: string;
  releaseReason?: string;
}

// §53 — per-round record.
export interface LuckyRound {
  id: string;
  index: number;                    // 1-based
  status: "pending" | "selection" | "closed" | "drawn" | "completed" | "skipped";
  startedAt?: string;
  selectionOpenAt?: string;
  selectionCloseAt?: string;        // when the countdown ends
  closedAt?: string;
  drawAt?: string;
  winningNumber?: number;
  drawMethod?: "auto" | "manual";
  drawnBy?: string;
  hostId?: string;
  coHostId?: string;
  picks: LuckyPick[];
  winnerIds?: string[];
  overridden?: boolean;
  completedAt?: string;
}

// §56 — audit entry. Written by the engine, never editable by a normal user.
export interface LuckyAudit {
  at: string;
  actor: string;                    // display name
  actorId?: string;
  role: "Admin" | "Host" | "Co-Host" | "Player" | "System";
  action: string;
  detail?: string;
}

// A game in the scalable catalog. Built-in games have a playable `route`;
// new games added by an admin start with no route ("coming soon") until a
// developer ships the gameplay.
export interface GameItem {
  id: string;
  name: string;
  icon: string; // icon key (Lucide), e.g. "dice", "crown", "joystick"
  enabled: boolean;
  route: string; // "/games/ludo" etc. Empty = coming soon (not launchable yet).
  spectator?: boolean; // can non-players watch this game live? (default true)
  coinCost?: number; // coins required to start a match (0/undefined = free, e.g. Ludo)
  players: number;
  matchesToday: number;
}

/** A legal/policy document users must accept at registration. Admin-editable. */
export interface PolicyDoc {
  id: string;
  slug: string; // URL slug, e.g. "terms" → /policies/terms
  title: string; // e.g. "Terms & Conditions"
  body: string; // full text (plain text / simple markdown-ish, rendered as paragraphs)
  requiredAtSignup: boolean; // must be accepted to register
  updatedAt: string; // ISO
}

export interface AppConfig {
  appName: string;
  companyName?: string; // optional company/brand name shown before the app name
  themeColor?: string;  // admin accent colour (hex); "" = default violet
  themeColor2?: string; // secondary accent colour (hex) → overrides the petal ramp; "" = default pink
  // SURFACE THEMING — the tint + brightness of every panel/card and the page canvas.
  // This is what decides how light or dark the whole app feels. "" = built-in look.
  themeSurface?: string;
  themeSurfaceBrightness?: number; // 0 = deepest, 100 = much lighter
  themeGlow?: number;              // 0–100 background glow strength
  themeBgImage?: string;           // optional background picture (/api/media path)
  customCss?: string;   // super-admin custom CSS injected app-wide (advanced theme control, no source edits)
  // TEXT COLOURS — separate from Theme Management on purpose; a theme must never
  // repaint or fade text the admin chose. See lib/text-colors.ts.
  textColors?: TextColors;
  // ALL PAGES directory — admin control over the user-facing /all-pages screen.
  allPages?: AllPagesConfig;
  // Admin menu layout: reorder + show/hide the user-facing nav (keyed by item href),
  // plus SUBMENUS — child links nested under a menu item.
  menuLayout?: { order?: string[]; hidden?: string[]; submenus?: Record<string, { label: string; href: string }[]> };
  // Public site HEADER + FOOTER: links, tagline, copyright (Admin → Navigation).
  // See src/lib/site-nav.ts. Navigation only — never changes what a page does.
  siteNav?: {
    header?: { links?: { id: string; label: string; href: string; enabled?: boolean; newTab?: boolean }[]; showLogin?: boolean; ctaText?: string; ctaHref?: string };
    footer?: {
      tagline?: string; copyright?: string; showLogin?: boolean;
      columns?: { id: string; title: string; links: { id: string; label: string; href: string; enabled?: boolean; newTab?: boolean }[] }[];
    };
  };
  // Admin UI style tokens (applied live via CSS variables; safe global shapes, no free positioning).
  uiStyle?: { buttonShape?: "sharp" | "rounded" | "pill"; chatBubbleShape?: "sharp" | "rounded" | "round"; chatFontSize?: "small" | "normal" | "large" };
  // Theme Management — saved themes (ready-made + custom); activating one writes its
  // colours/shape/css into themeColor/themeColor2/uiStyle/customCss (applied live).
  themes?: ThemePreset[];
  activeThemeId?: string;          // the currently activated theme
  allowUserThemeSwitch?: boolean;  // (reserved) let users pick from allowed themes
  announcement: string; // shown as a banner to everyone (blank = none)
  adminLimit: number; // max number of admin accounts allowed
  games: GameItem[];
  settings: {
    signups: boolean; // allow new registrations
    otp: boolean; // require OTP verification
    roomCreation: boolean; // members may create rooms
    gifts: boolean; // in-game gifts
    maintenance: boolean; // take the app offline for non-admins
    signupApproval?: boolean; // ON (default) = new sign-ups need admin approval; OFF = auto-approved
    // COMPLIANCE (default OFF): when OFF, winning a game gives NO coins/rewards of
    // any kind (no win-XP bonus, no spin chances) — "GAME WIN = NO COIN INCREASE".
    // Games stay free with results recorded for history only. Only turn ON in a
    // jurisdiction where rewarding game wins is permitted.
    gameWinRewards?: boolean;
    // COIN-FREE GAMES (default OFF): when OFF, games never charge coins to start —
    // no coins are used/deducted through any game. Turn ON only to charge coins.
    gameCoinsEnabled?: boolean;
    // PRIMARY GROUP DELETION (default ON): ON = a user must request admin approval
    // to delete their first (primary) group; OFF = they can delete it directly.
    primaryGroupDeleteApproval?: boolean;
    // AGENCY USER APPROVAL (default OFF): ON = an account created by an agency is
    // Pending until an admin approves it (the user can't log in until then); OFF =
    // the account is activated immediately (direct activation).
    agencyUserApproval?: boolean;
  };
  // Master feature ON/OFF switches (admin "Feature Management"). Default = all ON.
  // Turning one OFF disables that whole feature across the app instantly.
  features?: {
    registration?: boolean; // new account sign-ups
    voiceRooms?: boolean; // the Voice Rooms feature (browse/create/join)
    privateRooms?: boolean; // creating private rooms
    paidZone?: boolean; // the Paid Zone
    gifts?: boolean; // gift system
    coins?: boolean; // coin / wallet system (buy, spend, balance)
    levels?: boolean; // XP / level system
    games?: boolean; // games section (Ludo / Snake / Chess)
    coHost?: boolean; // host / co-host assignment
    chat?: boolean; // chat / messages
    business?: boolean; // Business accounts + directory (Business Module)
    reels?: boolean; // Reels (short video) feature
    tournaments?: boolean; // the Tournaments section
    competitions?: boolean; // the Competitions (singing) section
    luckyNumber?: boolean; // the Lucky Number (lottery) game
    // Section switches (v469) so every main area can be turned off from
    // Feature Management. Each hides its menu entry + All Pages tile.
    leaderboards?: boolean; jobs?: boolean; agencies?: boolean; customize?: boolean;
    myStorage?: boolean; documents?: boolean; friends?: boolean; search?: boolean;
    support?: boolean; luckySpin?: boolean; store?: boolean; notifications?: boolean;
  };
  // Tournament & Competition management — granular ON/OFF for each sub-feature,
  // all admin-controlled with no app update. Master on/off lives in features.
  tournamentControls?: {
    tournamentRegistration?: boolean;   // allow users to request to join tournaments
    tournamentAutoStart?: boolean;      // auto flip Upcoming → Live at start time
    tournamentAutoPrize?: boolean;      // allow auto prize distribution
    tournamentMatchRooms?: boolean;     // allow the room/qualification format
    tournamentPublicListing?: boolean;  // show tournaments to users (else admin-only)
    competitionRegistration?: boolean;  // allow users to register for competitions
    competitionVoting?: boolean;        // allow audience voting
    competitionGifts?: boolean;         // allow gifts inside competitions
    competitionResults?: boolean;       // show competition results to the audience
    adminAutoJoinCompetition?: boolean; // ON (default): admins count as present/participants in competition rooms. OFF: admins are not counted as joined (they moderate without inflating the room/voting numbers).
  };
  // Dice look & behaviour (admin-controlled).
  gameDice?: {
    customFace?: boolean;    // show an uploaded picture on the die before a roll
    faceImage?: string;      // the uploaded idle-face image (empty = blank die)
    showLastRolled?: boolean; // show the persistent "Last rolled" chip (default ON)
  };
  // Game Lobby / new match-start flow (Host-Co/Host opens a lobby; Manual invite or
  // Automatic-Join with a countdown). All OFF by default — the classic start flow
  // is unchanged until an admin turns `enabled` ON.
  lobby?: {
    enabled?: boolean;          // master ON/OFF for the whole new lobby flow (default OFF)
    hostOnlyStart?: boolean;    // only Host/Co-Host may open a game (default ON)
    autoJoin?: boolean;         // allow the Automatic-Join mode (default ON)
    manualInvite?: boolean;     // allow the classic Manual-Invitation mode (default ON)
    countdownSeconds?: number;  // auto-join lobby countdown (default 20)
    startingSeconds?: number;   // "Game Starting…" countdown before the board (default 3)
    minPlayers?: number;        // minimum players to auto-start (default 2)
    maxPlayers?: number;        // lobby size / max players (default 4)
    // ORDER the four player colours are shown in on the lobby seat grid, e.g.
    // ["red","green","blue","yellow"] swaps Yellow and Blue. DISPLAY ONLY — a
    // seat keeps its colour, its player and its meaning to the game engine; only
    // the position it is drawn in changes.
    seatOrder?: string[];
  };
  // AUTO RESET / AUTO CLEANUP of stuck games — see AppConfig in lib/config.tsx.
  autoReset?: {
    enabled?: boolean;
    afterHours?: number;
    staleStartingMinutes?: number;
    emptyLobbyHours?: number;
    notifyPlayers?: boolean;
  };
  // Business Module settings (the on/off flag lives in `features.business`).
  business?: {
    categories?: string[]; // selectable business categories (admin-editable)
    registerCost?: number; // coins charged to register a business (refunded if rejected)
    fields?: BusinessFieldDef[]; // admin-defined EXTRA business-form fields (no code change needed)
    jobTypes?: string[]; // admin-editable job types for the Post-a-Job form
    jobFields?: BusinessFieldDef[]; // admin-defined EXTRA job-post-form fields
    profileSections?: BusinessSection[]; // business-profile tabs: rename / hide-show / reorder
  };
  // Voice/video room + seat controls.
  roomControls: {
    voiceEnabled: boolean;
    videoEnabled: boolean;
    defaultSeats: number; // seats a new room opens with
    maxSeats: number; // hard cap a host may raise to
    showHostCrown?: boolean; // show the 👑 crown badge on the host's avatar (default true)
    showSeatGear?: boolean;   // show the ⚙ "Settings" symbol on a seat you can manage (default true)
    showCoHostStar?: boolean; // show the ★ co-host badge on a seat (default true)
  };
  // ROOM / GROUP LIST VISIBILITY (Admin → Rooms → "Room list visibility").
  // Chooses which rooms are LISTED in the Voice-Rooms browse list, for everyone.
  // It filters the LISTING ONLY — a room that isn't listed still works exactly as
  // before and is still reachable by its members, an invite or a direct link.
  roomList?: {
    mode?: "all"            // show every room (default, unchanged behaviour)
        | "hostOnline"      // only rooms whose HOST is live
        | "coHostOnline"    // only rooms with a live CO-HOST
        | "memberOnline"    // only rooms with a live MEMBER
        | "custom";         // use the individual switches below
    hideOffline?: boolean;    // hide rooms with nobody live in them at all
    requireHost?: boolean;    // custom: the host must be live
    requireCoHost?: boolean;  // custom: a co-host must be live
    requireMember?: boolean;  // custom: an ordinary member must be live
    minLive?: number;         // custom: minimum live people (0 = no minimum)
    alwaysShowMine?: boolean; // never hide a room the viewer owns / has joined (default ON)
    adminSeesAll?: boolean;   // administrators bypass the filter (default ON)
    // ACTIVE / INACTIVE browsing options on the members' Voice Rooms screen.
    // Independent switches; turning one off only removes that browse button.
    showActive?: boolean;     // "Active now" — rooms with someone in them (default ON)
    showInactive?: boolean;   // "Inactive" — rooms empty right now (default ON)
  };
  // What hosts/co-hosts/members are allowed to do.
  permissions: {
    coHostCanRemove: boolean;
    coHostCanMute: boolean;
    memberCanInvite: boolean;
    memberCanGift: boolean;
  };
  // Editable site content.
  content: {
    welcome: string;
    supportEmail: string;
    termsUrl: string;
    // "Install Now" button (Home page): the Play Store link takes priority; if it's
    // blank, the button downloads the APK from apkUrl. Both blank = button hidden.
    playStoreUrl?: string;
    apkUrl?: string;
  };
  // Membership / subscription plans.
  membership: {
    paidEnabled: boolean;
    plans: MembershipPlan[];
    subscriberFeatures?: MembershipSubscriberFeatures;
  };
  agencyPlans?: AgencyPlan[]; // Agency membership plans (bought with wallet coins)
  // Configurable Agency LEVEL tiers (Bronze/Silver/Gold…). `metric` = what drives
  // the level (member count / agency earnings / coins received). When disabled, the
  // legacy numeric level (coins/1000) is used.
  agencyLevels?: { enabled?: boolean; metric?: "members" | "earnings" | "coins"; tiers?: AgencyLevelTier[] };
  // Competition prize positions (1st–4th). Each has a coin amount + an ON/OFF
  // toggle the admin controls individually. Index 0 = Prize 1 (winner) … 3 = Prize 4.
  competitionPrizes?: { coins: number; enabled: boolean }[];
  // Super-Admin-only: when ON, deleting a user renumbers the remaining users'
  // permanent ID (publicId) into a continuous serial sequence (no gaps). OFF
  // (default) keeps IDs fixed and leaves gaps when a user is deleted.
  idRearrangement?: boolean;
  rewards: RewardRule[];
  // Advertisements shown across the app.
  ads: AdItem[];
  // Public marketing/content site (About, FAQ, Disclaimer, Blog, SEO) — fully
  // admin-manageable so no content needs a code change (AdSense requirement).
  siteContent?: import("@/lib/site-content-default").SiteContent;
  // CUSTOM CONTENT PAGES the admin writes in the panel, served at /p/<slug>.
  // Created by the navigation editor's "Add Content". See lib/custom-pages.ts.
  customPages?: import("@/lib/custom-pages").CustomPage[];
  // LUCKY NUMBER — what a room's Host / Co-Host may do without an admin.
  // See DEFAULT_HOST_PERMS in server/lucky-engine.ts.
  luckyNumber?: {
    start?: boolean; round?: boolean; draw?: boolean;
    manualPick?: boolean; complete?: boolean; joining?: boolean;
  };
  // Coin store: purchasable packages + promotional offers.
  coinPackages: CoinPackage[];
  coinOffers: CoinOffer[];
  // Admin-managed gift catalog (the in-app gift picker reads this).
  giftCatalog: GiftItem[];
  // Payment gateway for buying coins. "test" = simulated checkout (no real
  // charge). Set provider + publishable key to go live; the secret key lives
  // on the server, never in the config/client.
  paymentGateway?: {
    enabled?: boolean; // master ON/OFF for the card / online gateway (Super-Admin)
    provider: "test" | "razorpay" | "stripe";
    keyId?: string;
    currency?: string;
    // Which payment methods are offered to users at checkout.
    methods?: { cards: boolean; googlePay: boolean; applePay: boolean; paypal: boolean; local: boolean };
  };
  // Moderation report id -> the action an admin took on it.
  moderation: Record<string, "actioned" | "dismissed">;
  // Max upload size (MB) for KYC docs & document-request submissions.
  uploadMaxMB?: number;
  // Legal policies shown at registration (admin can edit + add more).
  policies?: PolicyDoc[];
  // Coin price of paid features (admin can change any time).
  featurePricing?: {
    roomNameChange: number; // coins to request a room-name change (admin approves)
    videoUnlock: number; // coins to request video unlock for a room (admin approves)
    coHostSlot?: number; // coins to request ONE extra co-host slot for a room (admin approves)
    extraPublicRoom?: number; // coins to request an EXTRA public room (1 free per user; admin approves)
  };
  // Max number of co-hosts a host may assign per room.
  coHostLimit?: number;
  gameTurnSeconds?: number; // Chance-missing timer: seconds per turn before a missed turn (heart lost)
  gameDiceSpeed?: "slow" | "normal" | "fast"; // dice roll animation speed (admin-set)
  gameTokenSpeed?: "slow" | "normal" | "fast"; // Ludo token move (hop) speed per cell (admin-set)
  perGameSettings?: Record<string, { turnSeconds?: number; diceSpeed?: "slow" | "normal" | "fast"; tokenSpeed?: "slow" | "normal" | "fast"; returnChancesOnRejoin?: boolean }>; // per-game overrides (ludo/snake/chess); unset = global fallback
  // OPTIONAL "Fair Dice" pity system (admin-controlled). Ships OFF, so the dice
  // stay 100% pure-random (uniform 1–6) exactly as before. When enabled, a player
  // who has gone `threshold`+ turns without a 6 gets a `boostPercent` chance for
  // their next roll to become a 6, and a guaranteed 6 after `guaranteeAfter` turns.
  fairDice?: {
    enabled?: boolean;       // master switch (default false)
    threshold?: number;      // 6-less rolls before help starts (3–40, default 12)
    boostPercent?: number;   // % chance to turn a roll into a 6 past the threshold (0–100, default 50)
    guaranteeAfter?: number; // hard-guarantee a 6 after this many 6-less rolls (0 = never, default 20)
  };
  // Profile Photo Editor (see src/lib/config.tsx for field docs).
  photoEditor?: {
    enabled?: boolean; mode?: "full" | "cropOnly"; maxSizeMB?: number; formats?: string[];
    minRes?: number; maxRes?: number; autoCompress?: boolean; quality?: number;
    forceSquare?: boolean; forceCircle?: boolean; allowRotate?: boolean; allowZoom?: boolean;
    allowDrag?: boolean; allowFlip?: boolean; autoCenter?: boolean; approvalRequired?: boolean;
    moderation?: "off" | "manual" | "ai"; defaultImage?: string;
  };
  // What a member with NO profile picture shows (see src/lib/avatar-label.ts).
  defaultAvatar?: {
    mode?: "initials" | "first" | "full";
    maxChars?: number; uppercase?: boolean; keepEmoji?: boolean;
    imageUrl?: string; showName?: boolean;
  };
  // Admin image overlays placed on the voice-room screen (see src/lib/config.tsx).
  roomOverlays?: {
    id: string; name: string; image: string; enabled: boolean;
    // What `image` holds: a picture (default), a video that plays muted + looped in
    // place, or any other uploaded file shown as a tappable download tile.
    mediaType?: "image" | "video" | "audio" | "pdf" | "file";
    fileName?: string;
    xPct: number; yPct: number; widthPct: number; opacity: number;
    visibility: "all" | "hosts" | "vip"; scope: "all" | "specific"; roomIds?: string[]; link?: string;
    coverSeats?: boolean; // fills the whole seat area (existing behaviour)
    zone?: "free" | "aboveSeats" | "belowChat" | "roomList" | "gameTop"; // fixed placement band (default free)
    closable?: boolean;   // viewers get an X to dismiss it (per display section)
  }[];
  // Dice Control Management (see src/lib/config.tsx for field docs). mode "random" = current behaviour.
  diceControl?: {
    mode?: "random" | "controlled" | "tournament" | "testing";
    fairPlayProtection?: boolean; useProbabilities?: boolean;
    probabilities?: { one?: number; two?: number; three?: number; four?: number; five?: number; six?: number };
    equalProbability?: boolean; winnerBalancing?: boolean; newPlayerSupport?: boolean; autoFairness?: boolean;
    maxRollsWithout6?: number; minRollsBefore6?: number; disableConsecutive6?: boolean; maxConsecutive6?: number;
    boostThreshold?: number; boostPercent?: number;
    playerControls?: { id: string; userId: string; userName: string; preferredValues: number[]; strength?: number; duration?: "match" | "day" | "permanent" | "tournament"; setAt?: string; setBy?: string }[];
  };
  // Speaking (active-speaker) effect shown on a member's avatar in voice rooms.
  // Admin-controlled (style / colour / speed / on-off). Default = a CALM steady
  // glow that does NOT flicker with mic level (replaces the old jittery blink+zoom).
  speakingFx?: {
    enabled?: boolean;  // master on/off (default true)
    style?: string;     // glow|pulse|scale|float|neon|ringPulse|ripple|waves|rotatingRing|equalizer|custom|none
    color?: string;     // hex accent ("" = theme violet)
    speed?: "slow" | "normal" | "fast";
    imageUrl?: string;  // admin-uploaded custom animation (GIF/PNG/WebP), shown when style="custom"
  };
  // Admin-managed CATEGORIES (config.categories) — used to group Voice Rooms and
  // Store items. Admin can create/edit/delete/enable-disable each; disabled ones
  // stop appearing in the pickers/filters but keep any items already tagged with them.
  categories?: { id: string; name: string; scope: "store" | "room"; enabled?: boolean; order?: number }[];
  tokenDesigns?: TokenDesign[]; // admin-managed game token designs (enable/disable/rename/custom)
  // Admin-managed DICE library. Previously there was one shared custom face
  // (gameDice.faceImage), so multiple dice styles were impossible.
  diceDesigns?: {
    id: string; name: string; enabled: boolean; builtin?: string;
    image?: string;   // uploaded face art (replaces the pips)
    surface?: string; // Tailwind classes for a non-image die
    pip?: string;
    category?: string; order?: number;
    priceCoins?: number;   // 0/unset = free; above 0 = must be bought
    validityDays?: number; // 0/unset = permanent; else the purchase expires
  }[];
  // DICE MODEL MANAGEMENT — the full dice system (body, pips, per-number designs
  // and the roll animation). See src/lib/dice-model.ts for the field docs.
  // `activeDiceModelId` names the ONE model every game draws, which is what makes
  // the admin's choice apply consistently everywhere.
  diceModels?: DiceModel[];
  activeDiceModelId?: string;
  // Ludo board look — admin-managed centre image (§3) + coin spacing (§5). Live
  // (no app update): the game reads these each render and applies them on the board.
  gameBoard?: {
    center?: {
      image?: string;      // custom centre image URL; empty/omitted = the default lotus
      show?: boolean;      // show/hide the centre image (default true)
      sizePct?: number;    // image size within the centre home, 30–100 (default 84)
      opacityPct?: number; // 0–100, lower = fainter so coins stay visible (default 40)
      rotateDeg?: number;  // rotate the image, -180..180 (default 0)
      offsetXPct?: number; // nudge left/right, -40..40 (default 0)
      offsetYPct?: number; // nudge up/down, -40..40 (default 0)
    };
    // Snake board centre watermark (per-game centre image; ships OFF so the
    // Snake board is unchanged until the admin turns it on).
    centerSnake?: {
      image?: string;      // image URL ("" = nothing)
      show?: boolean;      // default false
      sizePct?: number;    // 20–100% of the board width (default 50)
      opacityPct?: number; // 0–100 (default 25 so cells stay readable)
    };
    // WHERE the playable 10x10 grid sits inside the Snake board picture. Coins
    // were always laid out across the WHOLE image, so any board with a
    // decorative frame put them off the squares. 0/0/100/100 = whole image.
    snakeGrid?: { topPct?: number; leftPct?: number; widthPct?: number; heightPct?: number };
    // Where the Ludo 15x15 grid sits inside the board picture (see config.tsx).
    ludoGrid?: { topPct?: number; leftPct?: number; widthPct?: number; heightPct?: number };
    snakeMyPosition?: "bottom" | "top"; // which half holds the player's own seat
    tokenScalePct?: number; // coin size on the board, 70–140 (default 100)
    tokenFanPct?: number;   // spread between different-colour coins sharing one cell, 0–200% (default 100)
    // HOW several coins ARRANGE when they share one square. "corners" is the
    // current default and is unchanged; the others are extra styles the admin can
    // pick without altering the default. (Client: keep the existing feature, add
    // more visual styles.)
    shareStyle?: "corners" | "diagonal" | "row" | "stack";
    // Board design decorations (admin, live) — an image behind each player's home
    // yard (e.g. a lotus), the icon shown on safe cells, and the outer frame colour.
    decor?: {
      homeSymbol?: string;     // image URL behind the home yards ("" = none)
      homeSymbolShow?: boolean;// show/hide the home symbol (default true)
      safeIcon?: string;       // image URL for safe-cell markers ("" = default star)
      safeIconShow?: boolean;  // show/hide safe-cell markers (default true)
      safeHighlight?: boolean; // distinct tint + ring on the 8 safe squares (default true)
      safeColor?: string;      // safe-zone colour — tint/ring/star ("" = emerald #10b981)
      frameColor?: string;     // override the board's outer frame colour ("" = theme default)
      // FULL BOARD image — a complete custom Ludo board picture shown as the playing
      // surface. When set + shown, the generated path cells go transparent so the art
      // shows through; yards/centre/tokens still render on top. Use a standard 15×15
      // Ludo layout so tokens land on the right squares.
      fullImage?: string;      // full-board image URL ("" = use the generated board)
      fullImageShow?: boolean; // show/hide the full-board image (default true when set)
      fullImageOpacityPct?: number; // 30–100 (default 100)
      // HOW the board art maps onto the square 15×15 grid. Default "contain" =
      // keep the picture's shape (no stretch, no crop), centred — the client's
      // requested behaviour. "cover" = fill edge-to-edge, may crop. "fill" =
      // force-stretch to the grid (the old behaviour). A square board fills the
      // grid identically for all three; only non-square art differs.
      fullImageFit?: "contain" | "cover" | "fill";
      fullImageOffsetXPct?: number; // fine align nudge left/right, -40..40 (default 0)
      fullImageOffsetYPct?: number; // fine align nudge up/down, -40..40 (default 0)
      fullImageScalePct?: number;   // fine zoom, 50..150 (default 100)
      // Board Settings (admin toggles, live on the real board):
      boxBorder?: boolean;     // show the outline around each board cell (default true)
      borderColor?: string;    // cell border colour ("" = theme default)
      boxHighlight?: boolean;  // show the coloured path/home-column highlights (default true)
      showArrow?: boolean;     // show the "coins start here" entry arrows (default true)
      // TOKEN HOME area (client "Hide White Token Area"): a custom board has its own
      // home art, but the built-in white home box covers it. hideHomeBg makes the four
      // home yards fully TRANSPARENT so the board design shows through; homeBgColor sets
      // a custom home background instead of white (ignored while hideHomeBg is on).
      hideHomeBg?: boolean;    // ON = transparent home yards (default false = white)
      homeBgColor?: string;    // custom home background colour ("" = white)
      // SAFE-ZONE STAR editor. APPEARANCE ONLY — hiding the star never removes the
      // protection on that square. (Where the safe squares ARE is `safeCells` below.)
      safeSizePct?: number;    // star/icon size, 20–200 (default 100)
      safeOpacityPct?: number; // 0–100 (default 100)
      safeGlow?: boolean;      // soft glow around the star (default false)
      safeRotateDeg?: number;  // rotate the star/icon, -180..180 (default 0)
      safeIconMode?: "default" | "custom" | "none"; // built-in star / uploaded icon / nothing
      safeBorder?: boolean;    // ring outline around the star
      safeBorderColor?: string;// "" = follow the safe colour
      safeGlowPx?: number;     // glow intensity in px, 1–24 (default 4)
      safeShadow?: boolean;    // drop shadow under the star (default true)
      safeShadowOpacityPct?: number; // 0–100 (default 55)
      safePosXPct?: number;    // nudge inside the square, -50..50 (default 0)
      safePosYPct?: number;
      safeVisibility?: "visible" | "hidden" | "transparent" | "gameplayOnly";
    };
    // SHOW / HIDE / TRANSPARENT for each visual element of the board. Appearance
    // only: "hide" removes the drawing, "transparent" keeps the space but paints
    // almost nothing so an uploaded board design shows through in its place.
    elements?: Partial<Record<
      "board" | "grid" | "safeStar" | "startArrow" | "pathNumbers" | "tokenAreaBg" | "tokenSlot" | "cellBorder" | "homeArea",
      "show" | "hide" | "transparent"
    >>;
    // WHICH of the 52 ring squares are safe (no captures). Empty/absent = the
    // classic 8 (4 starts + 4 guard stars). Unlike everything else on this page
    // this DOES change play, so it is applied to the engine for every player from
    // the server config — see lib/ludo.ts → configureSafeCells().
    safeCells?: number[];
    // CHESS board + piece customization. Appearance only — every chess RULE
    // (legality, check, checkmate, stalemate, turn order) lives in lib/chess.ts
    // and is untouched by anything here. See lib/chess-theme.ts.
    chess?: {
      themeId?: "green" | "brown" | "blue" | "grey" | "midnight" | "lotus" | "custom";
      lightColor?: string; darkColor?: string;
      boardImage?: string; boardImageOpacityPct?: number;
      boardImageFit?: "contain" | "cover" | "fill";
      boardImageOffsetXPct?: number; boardImageOffsetYPct?: number; boardImageScalePct?: number;
      pieceStyle?: "classic" | "solid" | "outline" | "letters" | "custom";
      pieceImages?: Record<string, string>; // "w-k", "b-q", …
      pieceScalePct?: number;
      showCoords?: boolean; showLegalDots?: boolean; showLastMove?: boolean;
      showCheckHighlight?: boolean; showWatermark?: boolean;
      animateMoves?: boolean; animMs?: number; captureFlash?: boolean;
      flipForBlack?: boolean; showMoveHistory?: boolean; showCapturedTray?: boolean;
      boardBorder?: boolean;
    };
    // Custom Board LIBRARY (admin) — save several complete board pictures, name
    // them, and pick which one is active. Purely a visual surface; gameplay,
    // token coordinates and rules are unchanged. When activeBoardId matches an
    // enabled board it becomes the playing surface (overrides decor.fullImage);
    // otherwise the legacy single decor.fullImage still applies (backward-compat).
    boards?: {
      id: string;           // stable id
      name?: string;        // admin label
      image: string;        // full-board image URL
      fit?: "contain" | "cover" | "fill"; // how it maps to the 15×15 grid (default contain)
      opacityPct?: number;  // 30–100 (default 100)
      offsetXPct?: number;  // align nudge left/right, -40..40 (default 0)
      offsetYPct?: number;  // align nudge up/down, -40..40 (default 0)
      scalePct?: number;    // zoom, 50..150 (default 100)
      enabled?: boolean;    // false = kept but never used as surface (default true)
      createdAt?: string;   // ISO
      // Coin price. 0/unset = FREE for everyone. Above 0 makes this board
      // purchase-only: it appears in the Store's Boards category and a player
      // buys it once (permanently) before they can play on it.
      priceCoins?: number;
      validityDays?: number; // 0/unset = permanent; else the purchase expires
    }[];
    activeBoardId?: string; // which saved board is the surface ("" = none / use legacy fullImage)
    // TOKEN SLOT layout (client spec §6) — nudge/resize/rotate each of the 4 parked
    // tokens INSIDE every home yard, to line them up with a custom board's own home
    // circles. enabled=false = the default 2×2 grid (unchanged). Each slot's dx/dy are
    // a % offset from its default grid position; size is a % of the default token size.
    tokenSlots?: {
      enabled?: boolean; // false = default 2×2 layout (backward-compatible)
      slots?: { dxPct?: number; dyPct?: number; sizePct?: number; rotateDeg?: number }[]; // up to 4 (slots 1–4)
    };
    // TOKEN PLACEMENT AREAS — every home (Red/Green/Yellow/Blue) configured on its
    // own: background show/hide/transparent/colour/image + image opacity, the
    // "Hide White Token Area" switch, a layer choice, and full control of each of
    // the four token slots (position, size, rotation, visibility, background,
    // border, opacity, layer). Appearance ONLY — the Ludo engine is untouched, so
    // hiding any of this never disables a game function. Ships disabled.
    homeAreas?: {
      enabled?: boolean;
      areas?: Partial<Record<"red" | "green" | "yellow" | "blue", {
        hideWhite?: boolean;
        bgMode?: "default" | "show" | "hide" | "transparent" | "white" | "color" | "image";
        bgColor?: string; bgImage?: string; bgOpacityPct?: number;
        showBorder?: boolean;
        layer?: "aboveBoard" | "behindBoard" | "aboveTokens" | "hidden";
        slots?: {
          visible?: boolean;
          xPct?: number; yPct?: number; widthPct?: number; heightPct?: number;
          tokenSizePct?: number; rotateDeg?: number;
          bgMode?: "default" | "transparent" | "white" | "color" | "image";
          bgColor?: string; bgImage?: string;
          border?: boolean; borderColor?: string;
          opacityPct?: number;
          layer?: "aboveBoard" | "behindBoard" | "aboveTokens" | "hidden";
        }[];
      }>>;
    };
  };
  // Animation Management (§4 + §6) — admin turns each game animation on/off and
  // tunes it. Live (no app update): the game reads these every render. These are
  // MASTER switches — a player's own "effects" toggle still applies on top.
  gameAnim?: {
    diceRoll?: boolean;        // dice tumble animation (off = show the result instantly)
    diceStyle?: "tumble" | "spin" | "flip" | "shake" | "bounce" | "wobble" | "zoom" | "roll2d"; // dice-roll animation style
    diceDisplaySeconds?: number; // how long the rolled number stays clearly on screen (1–10s, default 2)
    turnDelaySeconds?: number;   // extra pause before the next player's turn after the dice shows (1–10s, default 1)
    tokenMove?: boolean;       // token step-by-step walk (off = the coin jumps straight to the cell)
    moveStyle?: "slide" | "jump" | "bounce" | "fly" | "spin" | "instant"; // coin movement style
    winCelebration?: boolean;  // victory sparkles + confetti
    winIntensity?: "low" | "normal" | "high"; // how many sparkles/confetti
    captureFlash?: boolean;    // the gold star-burst when a coin captures another
    coinGlow?: boolean;        // the glowing hint around a coin you can move
    soundEffects?: boolean;    // master game sound effects on/off
    turnAnim?: boolean;        // animate the ACTIVE player's profile picture on their turn
    turnAnimStyle?: "shake" | "bounce" | "pulse" | "glow" | "rotate" | "heartbeat" | "ripple" | "breathing" | "sparkle" | "none";
    rollShake?: boolean;       // move the rolling player's profile picture WHILE the dice rolls
    rollShakeStyle?: "shake" | "bounce" | "pulse" | "glow" | "rotate" | "heartbeat" | "ripple" | "breathing" | "sparkle";
    centerReach?: {            // §4 — animation when a coin reaches the centre home
      enabled?: boolean;
      style?: "bloom" | "sparkle" | "confetti" | "fireworks"; // celebration style
      speed?: "slow" | "normal" | "fast";
    };
  };
  // Same-colour-block SHIELD look (the safe-zone icon shown when 2 same-colour coins
  // stack on a NORMAL box). Appearance-only — the safe-zone RULE is unchanged.
  shield?: {
    iconEnabled?: boolean;   // show the shield icon at all (default ON)
    glow?: boolean;          // green halo around the protected coins (default ON)
    blink?: boolean;         // blinking effect (default OFF)
    particles?: boolean;     // sparkle particles around the shield (default OFF)
    image?: string;          // custom shield image URL (default "" = 🛡️ emoji)
    color?: string;          // shield colour (hex, default emerald #10b981)
    animationStyle?: "none" | "pulse" | "spin" | "bounce"; // shield animation (default pulse)
    speed?: "slow" | "normal" | "fast"; // animation speed (default normal)
  };
  // Game theme (§7) — the Ludo screen background + accent + optional background
  // music. A preset id (incl. event/seasonal) or "custom". Player colours & board
  // layout are unaffected — only the surrounding look changes. Live, no app update.
  gameTheme?: {
    preset?: string;   // preset id (see lib/gameThemes) or "custom"
    bgColor?: string;  // custom background CSS (used when preset === "custom")
    bgImage?: string;  // optional image layered faintly behind the board
    accent?: string;   // custom accent hex (used when preset === "custom")
    music?: { enabled?: boolean; track?: string; volumePct?: number }; // background music (Media Library track)
  };
  // GIFT earnings split: % of a gift's coin value credited to the RECEIVER's
  // wallet; the remaining (100 − this) is company/admin revenue. 0–100.
  giftReceiverSharePct?: number;
  // MEDIA library system controls (admin-managed room media: audio/video/image).
  media?: {
    libraryAccess?: boolean; // master: can users open/use the room Media library at all
    audioEnabled?: boolean; // Audio feature on/off (upload + play)
    videoEnabled?: boolean; // Video feature on/off
    imageEnabled?: boolean; // Image feature on/off
    // Per-type coin gating: paid=false → free for all; paid=true → user must buy
    // access once (price coins) before they can play that media type.
    audioPaid?: boolean; audioPrice?: number;
    videoPaid?: boolean; videoPrice?: number;
    imagePaid?: boolean; imagePrice?: number;
  };
  // Paid Zone — premium, admin-approved area where verified members find each
  // other for 1:1 audio/video calls.
  paidZone?: {
    enabled: boolean; // is the Paid Zone open at all?
    joinCost: number; // coins charged to request membership (refunded if rejected)
    audioPerMin?: number; // coins/min the CALLER pays during an audio call
    videoPerMin?: number; // coins/min the CALLER pays during a video call
    callsEnabled?: boolean; // AUDIO calls on/off (kept for back-compat)
    videoCallsEnabled?: boolean; // VIDEO calls on/off (separate control)
    recordingEnabled?: boolean; // admin toggle (media capture wired separately)
    receiverRewardsEnabled?: boolean; // credit the RECEIVER a share of each billed minute?
    receiverSharePct?: number; // % of billed coins credited to the receiver (rest = company profit)
    agencyProfitPct?: number; // GLOBAL % of a paid-call's coins credited to the CALLER's OWN agency (0 = off). Only that user's agency is paid — never split across agencies.
    // Monthly membership renewal:
    monthlyCoins?: number; // coins charged each renewal period to stay a member
    renewalDays?: number; // renewal period length in days (e.g. 30)
    graceDays?: number; // extra days after the due date before membership goes inactive
    autoRenew?: boolean; // auto-charge the renewal when due (if the member has enough coins)
  };
  // Wallet withdrawal (cash-out) settings — fully admin-configurable.
  withdraw?: {
    coinsPerUnit: number; // coins per 1 currency unit (e.g. 10 coins = 1 SAR)
    currency: string; // payout currency label (e.g. "SAR")
    feePct: number; // withdrawal fee % kept by the company
    minCoins: number; // minimum coins per withdrawal
    maxCoins: number; // maximum coins per withdrawal (0 = no cap)
    autoApprove: boolean; // true = auto-approve requests; false = manual admin approval
  };
  // Lotus Flower economy (gift → Lotus conversion + Lotus-only withdrawals). When
  // OFF the classic coin gifting/withdrawal behaviour is unchanged. All rates and
  // limits are admin-editable at any time (no app update needed).
  lotus?: {
    enabled: boolean;        // master on/off for the whole Lotus economy
    name: string;            // display name (e.g. "Lotus Flower" / "Lotus Points")
    icon?: string;           // admin-uploaded Lotus Flower icon URL (/api/media/…); empty = default 🪷
    coinToLotus: number;     // Lotus credited per 1 coin of the receiver's gift share
    lotusToCurrency: number; // payout value of 1 Lotus (e.g. 0.1 SAR)
    currency: string;        // payout currency label
    minWithdraw: number;     // minimum Lotus per withdrawal
    maxWithdraw: number;     // maximum Lotus per withdrawal (0 = no cap)
    dailyLimit: number;      // max Lotus a user may withdraw per day (0 = no cap)
    feePct: number;          // withdrawal SERVICE fee % (kept by company)
    autoApprove: boolean;    // true = auto-approve; false = manual admin approval
    // 4-way Lotus distribution (Final Plan). Every coin spend is converted to
    // Lotus and split: User (receiver) / Agency / Company / Trust Wallet. Admin-
    // editable; should total 100 (the engine normalises + gives any rounding
    // remainder to the user). If a receiver has no active agency, the agency slice
    // rolls into Company so 100% is always distributed.
    userSharePct?: number;    // receiver's Lotus share % (default 65)
    agencySharePct?: number;  // agency's Lotus share % (default 5)
    companySharePct?: number; // company's Lotus share % (default 25)
    trustSharePct?: number;   // Trust Wallet / Trust Fund share % (default 5)
    trustEnabled?: boolean;   // master on/off for the Trust Share (default true; OFF → trust slice rolls into Company)
    gstPct?: number;          // GST % applied to a withdrawal's gross cash value (default 18)
    // Admin-defined conversion slabs ("500 Lotus = ₹300"): the exact payout for a
    // withdrawal that matches the slab amount. Fully admin-controlled — add / edit /
    // delete / enable / disable any rule, nothing hardcoded. Amounts that don't
    // match an ENABLED slab fall back to the linear lotusToCurrency rate.
    conversionTiers?: { id: string; lotus: number; value: number; enabled: boolean }[];
    // Which FREE-reward types convert to Lotus (vs stay as coins) when the economy
    // is ON. Keyed by reward type; a missing/true entry = eligible (converts),
    // false = stays as coins. Keys: welcome, dailyLogin, timed, activity, luckySpin,
    // referral, tournament, levelUp, event, manual.
    rewardTypes?: Record<string, boolean>;
  };
  // Level & reward system — ADMIN-CONTROLLED XP amounts + level-up bonus coins
  // (client: "how does admin control the reward system"). Level-up bonus per
  // level L = min(cap, base + L×perLevel); enabled=false stops paying bonuses.
  levelRewards?: {
    enabled: boolean;
    base: number;      // default 20
    perLevel: number;  // default 10
    cap: number;       // default 500
    xpPlay: number;    // XP for finishing a game (default 12)
    xpWin: number;     // XP for winning (default 30)
    xpGift: number;    // XP for sending a gift (default 6)
    xpDailyLogin: number; // XP for first login of the day (default 25)
    xpPurchase: number;   // XP for an approved coin purchase (default 15)
  };
  // Lotus Flower loyalty rewards — automatic milestones for SENDING coins/gifts, fully
  // admin-editable (Admin → Lotus Flower Rewards). Each tier awards its flowers ONCE, the
  // first time the user's lifetime coins-sent crosses `minCoins`. Ships DISABLED.
  lotusRewards?: {
    enabled: boolean;              // master on/off for automatic rewards
    notifyUser: boolean;           // send the "Congratulations!" in-app notification on award
    validityDays: number;          // optional expiry for rewarded flowers (0 = never expires; informational)
    tiers: { minCoins: number; flowers: number }[]; // editable milestone table (sorted by minCoins)
  };
  // Automatic activity-log cleanup — delete log records older than `days`.
  logCleanup?: { enabled: boolean; days: number };
  // Admin-defined custom PRODUCT fields (per category or all). No-code product forms.
  productCategoryFields?: ProductFieldDef[];
  // Refer-a-friend system (admin-controlled).
  referral?: {
    enabled: boolean; // master on/off for the whole referral system
    reward: number; // coins the referrer earns per successful referral
    requireApproval: boolean; // if true, an admin must approve each reward before it's paid
    autoBlockDuplicates: boolean; // auto-flag/block self- or same-device (same-IP) referrals
    agencyReward?: number; // coins an AGENCY earns when it (its owner/manager) brings a user to the app (0 = off)
  };
  // Lucky Spin — a daily spin-the-wheel coin reward (admin-configurable segments).
  // Sound Management — per-effect ON/OFF + optional custom uploaded sound per
  // effect (custom URL overrides the built-in synthesized sound) + selectable
  // sound PACK (different synthesized styles; "silent" = everything off).
  gameSound?: {
    pack?: "classic" | "modern" | "premium" | "casino" | "arcade" | "fantasy" | "silent";
    effects?: Partial<Record<
      "diceRoll" | "tokenMove" | "capture" | "home" | "win" | "lose" | "countdown" | "notification" | "click",
      { enabled?: boolean; url?: string }
    >>;
  };
  // Background music per screen (tracks come from the Media Library).
  bgMusic?: {
    enabled?: boolean;   // master switch (default OFF)
    volumePct?: number;  // 0–100 (default 35)
    screens?: Partial<Record<
      "home" | "lobby" | "voiceRoom" | "ludo" | "snake" | "tournament" | "waiting" | "result",
      { url?: string; enabled?: boolean }
    >>;
  };
  // STORE items beyond frames — one flexible catalog for every purchasable
  // cosmetic. `kind` decides where it renders: "background" = profile header
  // image, "nameEffect" = styled display name (style key from the preset list),
  // "badge" = small image next to the name. New kinds can be added later
  // without breaking old items.
  storeItems?: {
    id: string;
    kind: "background" | "nameEffect" | "badge" | "overlay";
    name: string;
    image?: string;        // uploaded image (backgrounds/badges; GIF ok)
    style?: string;        // nameEffect preset key (see lib/store.ts NAME_EFFECTS)
    price: number;         // coins; 0 = free
    enabled: boolean;
    category?: string;     // grouping shown in the store
    badge?: string;        // label chip: "New" / "Limited" / custom
    description?: string;
    validityDays?: number; // 0/unset = permanent
    order?: number;
    vipOnly?: boolean;     // only VIP members (admin-set flag on the user) can buy
    // ---- v400 store controls ----
    archived?: boolean;    // hidden from the store, kept for restore
    featured?: boolean; newArrival?: boolean; trending?: boolean;
    comingSoon?: boolean;  // teaser, not buyable
    limitedEdition?: boolean;
    salePrice?: number;    // sale/discount price (used while the window is active)
    saleStart?: string; saleEnd?: string; // ISO dates
    stock?: number;        // remaining stock; unset = unlimited
    purchaseLimit?: "once" | "daily" | "weekly" | "monthly" | "lifetime";
    minLevel?: number; maxLevel?: number; // level eligibility
    displayOnly?: boolean; // visible but NOT purchasable
    agencyIds?: string[];  // restrict to members of these agencies (empty = everyone)
    userIds?: string[];    // restrict to these selected users (empty = everyone)
    gender?: "male" | "female"; // restrict to a gender (optional)
    restrictMode?: "hide" | "show"; // audience restriction hides ("hide") or only blocks purchase ("show")
    freeForVip?: boolean;  // VIP members get it free
    firstBuyDiscountPct?: number; // % off a user's first purchase of this item
  }[];
  // Google Sign-In: the PUBLIC OAuth Client ID (…apps.googleusercontent.com).
  // Set from Admin → Settings; empty = the Google button stays hidden. This is
  // a public identifier, not a secret, so config is a safe home for it.
  googleClientId?: string;
  // Admin → Settings → Duplicate names. true / unset = duplicates allowed;
  // false = a new or renamed name must not match an existing one (compared
  // case- and space-insensitively). "user" is the display name (fullName) —
  // login usernames are always unique regardless of this setting.
  duplicateNames?: { user?: boolean; group?: boolean; agency?: boolean };
  // LiveKit voice server, set from Admin → Settings. Used only when url, apiKey
  // and apiSecret are ALL set; otherwise the LIVEKIT_* env vars apply. apiSecret
  // is SECRET: getConfig() strips this whole object, and it is only read/written
  // through /api/admin/livekit (masked).
  livekit?: {
    url?: string;       // wss://… (sent to clients with their join token)
    apiKey?: string;
    apiSecret?: string;
    serverUrl?: string; // optional internal URL for server-to-server calls
    updatedAt?: string;
    updatedBy?: string;
  };
  // Razorpay API keys, set from Admin → Settings. Used only when keyId and
  // keySecret are BOTH set; otherwise the RAZORPAY_* env vars apply. keySecret is
  // SECRET: getConfig() strips this whole object, and it is only read/written
  // through /api/admin/razorpay (masked).
  razorpay?: {
    keyId?: string;     // rzp_test_… / rzp_live_… (public, sent to the checkout popup)
    keySecret?: string;
    updatedAt?: string;
    updatedBy?: string;
  };
  // Stripe secret key (backup gateway, used when Razorpay isn't set up), set
  // from Admin → Settings; otherwise STRIPE_SECRET_KEY applies. SECRET: stripped
  // by getConfig(), only read/written through /api/admin/stripe (masked).
  stripe?: {
    secretKey?: string; // sk_test_… / sk_live_…
    updatedAt?: string;
    updatedBy?: string;
  };
  // Mobile OTP / SMS, set from Admin → Settings. apiKey and apiSecret are
  // SECRET: getConfig() strips this whole object. Read and written only through
  // /api/admin/sms (the secret is masked). Used for login and registration
  // codes; the TWILIO_* env vars apply only when nothing usable is saved here.
  smsOtp?: {
    provider?: "generic" | "msg91" | "twilio" | "twilio-verify";
    apiKey?: string;
    apiSecret?: string;
    senderId?: string;
    templateId?: string;
    apiUrl?: string;
    countryCode?: string;
    otpLength?: number;
    expiryMinutes?: number;
    resendSeconds?: number;
    maxAttempts?: number;
    loginEnabled?: boolean;
    registrationEnabled?: boolean;
    updatedAt?: string;
    updatedBy?: string;
  };
  // ANDROID APP LINK — the SHA-256 certificate fingerprint of the Play Store
  // app signing key, from Play Console → Setup → App integrity.
  //
  // It is served at /.well-known/assetlinks.json, which is how Android decides
  // that lotusplay.tech and the installed app are the same product. Until it is
  // set, the app opens with a browser address bar across the top and looks like
  // a website rather than an app. It is a PUBLIC certificate hash, not a secret,
  // and it only exists after the first upload to Play — so it lives in config,
  // where the owner can paste it in themselves without needing a new build.
  androidFingerprint?: string;
  // Avatar FRAME shop — admin-managed frames users BUY WITH COINS and equip
  // around their profile photo (transparent PNG/WEBP/GIF; price 0 = free).
  avatarFrames?: {
    id: string; name: string; image: string; price: number; enabled: boolean;
    category?: string;     // Normal / Premium / VIP / Animated / Festival / Event / custom…
    badge?: string;        // label chip shown in the store: "New" / "Limited" / "VIP" / custom
    description?: string;  // short promo text under the name
    validityDays?: number; // 0 or unset = PERMANENT; else auto-expires N days after purchase
    order?: number;        // display order in the store (lower = first)
    launchAt?: string;     // ISO — hidden from the store BEFORE this date
    endAt?: string;        // ISO — hidden from the store AFTER this date (owners keep theirs)
  }[];
  // Per-module FRAME + BADGE visibility (admin). Keyed by module id (see
  // lib/module-frames.ts FRAME_MODULES). Missing key = Visible + Optional
  // (today's behaviour), so this is purely additive.
  moduleFrames?: Record<string, { framesVisible?: boolean; framesRequired?: boolean; badgesVisible?: boolean; badgesRequired?: boolean }>;
  // In-game ACTIVITY notifications (single-line alert bar) — full admin control.
  // Missing = all ON with default timings, so purely additive.
  gameAlerts?: {
    enabled?: boolean;         // master ON/OFF for all in-game notifications (default ON)
    infoSeconds?: number;      // how long an info alert stays (default 3)
    approvalSeconds?: number;  // how long a join-approval alert stays (default 10)
    types?: {                  // per-event ON/OFF
      joins?: boolean;         // user entered the room
      leaves?: boolean;        // user left the room
      seatRequests?: boolean;  // listener asked to join / approvals
      messages?: boolean;      // text messages in the room
      gameEvents?: boolean;    // a player left the game / game ended
    };
  };
  // Screenshot & screen-recording protection (Paid Zone + wallet screens).
  // A WEB app cannot hard-block OS captures the way a native app can
  // (FLAG_SECURE); these switches control every web-possible layer: the entry
  // warning, a privacy shield when the app is backgrounded (blanks the
  // app-switcher snapshot), the PrintScreen deterrent, an identifying viewer
  // watermark, and blocking in-page screen sharing. Admins are always exempt.
  captureProtection?: {
    screenshot?: boolean;  // privacy shield + watermark + PrintScreen deterrent (default ON)
    recording?: boolean;   // recording countermeasures where the platform reports capture (default ON)
    sharing?: boolean;     // block screen-sharing from protected screens (default ON)
    thirdParty?: boolean;  // third-party capture detection where available (native wrapper) (default ON)
    autoEndCall?: boolean; // end the call when a recording IS detected (default OFF)
    warning?: boolean;     // show the "no screenshots" notice on entry (default ON)
    watermark?: boolean;   // traceable viewer name+ID overlay (default OFF — opt-in; client asked to remove it)
    audioRecording?: boolean; // audio-recording protection (native app; no web effect) (default ON)
    videoRecording?: boolean; // video-recording protection (native app; no web effect) (default ON)
    mirroring?: boolean;      // screen mirroring / casting protection (native app) (default ON)
    allScreens?: boolean;     // master switch: apply the web deterrent to EVERY app screen (overrides the per-module list). Default OFF.
    // WHICH modules the web deterrent is applied to (screens the admin wants protected).
    // Defaults preserve today's behaviour: wallet + Paid Zone protected, others off.
    modules?: {
      home?: boolean; profile?: boolean; chat?: boolean; voiceRoom?: boolean;
      wallet?: boolean; paidZone?: boolean; reels?: boolean; tournaments?: boolean; competitions?: boolean;
    };
  };
  luckySpin?: {
    enabled: boolean;
    cooldownHours: number; // hours a user must wait between free spins
    // Wheel slices. `weight` = odds for the FREE daily spin; `weightPaid` = odds
    // when the spin uses a purchased/earned EXTRA chance (unset → same as free).
    segments: { label: string; coins: number; weight: number; weightPaid?: number }[];
    // Spending-based reward boost: users who purchased/spent more coins hit the
    // no-win ("Try again") slices less often. Highest matching tier applies.
    spendBoost?: { enabled?: boolean; tiers?: { minCoins: number; boostPct: number }[] };
    // Extra chances (extra spins beyond the daily free one):
    extraChancesEnabled?: boolean; // master on/off for the extra-chances system
    dailyLoginChances?: number; // extra chances awarded on daily login
    winTaskChances?: number; // extra chances awarded for winning a game (a "task")
    buyCostCoins?: number; // coins to buy one extra chance (0 = buying off)
    adChancesPerDay?: number; // max extra chances a user can earn per day by watching a promo (0 = off)
    chanceExpiryDays?: number; // extra chances expire this many days after last earned (0 = never)
  };
  // Manual QR/UPI payment collection for buying coins (admin scan code).
  paymentQr?: {
    enabled?: boolean; // master ON/OFF for the QR / manual payment method (Super-Admin)
    imageUrl: string; // QR image (data URL or path)
    upiId?: string; // optional UPI id / pay handle shown under the QR
    note?: string; // instructions shown to the user
    currency?: string; // symbol shown next to prices (default "₹")
  };
  // Admin-editable front-end text labels: key → custom text (overrides the
  // built-in default). See src/lib/labels.ts for the editable label registry.
  labels?: Record<string, string>;
  // Admin-editable app images: slot key → image URL (uploaded, overrides the
  // built-in default asset). See src/lib/brand-images.ts for the slot registry.
  images?: Record<string, string>;
  // Posting permissions (admin can turn off who may post). Default = all ON.
  posting?: {
    users?: boolean; // users may post reels/videos
    businesses?: boolean; // businesses may post reels/videos
    jobs?: boolean; // businesses may post job vacancies
  };
  // Chat & messages policy (admin-controlled).
  chat?: {
    storeMessages?: boolean; // keep chat history for admin review (default true)
    groupRetentionDays?: number; // group-room messages auto-delete after N days (default 3)
    deleteForEveryone?: boolean; // allow users to "delete for everyone" in DMs (default true)
  };
  // ---- Storage Management System (admin-controlled per-user upload storage) ----
  storage?: {
    enabled?: boolean; // master: ENFORCE storage limits (block uploads over limit). Default OFF (never affects existing uploads until an admin turns it on).
    warningsEnabled?: boolean; // send 80/90/100% warning notifications
    autoCleanupEnabled?: boolean; // allow the admin one-click "remove orphaned/expired files" cleanup
    defaultLimitMB?: number; // "All Users" limit
    vipLimitMB?: number; // "VIP Users" limit
    agencyLimitMB?: number; // default limit for agency members (per-agency override in perAgencyMB)
    perAgencyMB?: Record<string, number>; // agencyId -> MB (Agencies override)
    // (Individual-user overrides live on UserRecord.storageLimitMB.)
  };
  // Recording system (rooms + Paid-Zone calls). Master switches, retention +
  // auto-delete, a storage cap for alerts, and who may access recordings. Capture
  // is host-side (records the room audio) and uploaded to the normal file storage.
  recording?: {
    master?: boolean;        // GLOBAL Record Management ON/OFF (nothing records/logs when OFF)
    roomEnabled?: boolean;   // allow room recordings (host/admin)
    callEnabled?: boolean;   // allow Paid-Zone call recordings
    retentionDays?: number;  // auto-delete recordings older than N days (0 = keep forever)
    autoDelete?: boolean;    // enforce the retention period automatically
    maxStorageMB?: number;   // recordings storage cap (0 = no cap) — drives the % dashboard + alerts
    userAccess?: "adminOnly" | "hostAndAdmin"; // who can access/download recordings
    // Per-module ON/OFF for every communication feature (privacy-first: all OFF by
    // default). Voice/video toggles gate AUDIO capture; chat/log toggles govern what
    // the Record Management module retains + surfaces.
    modules?: {
      voiceRoomVoice?: boolean; voiceRoomChat?: boolean;
      privateRoomVoice?: boolean; privateRoomChat?: boolean;
      competitionAudio?: boolean; competitionChat?: boolean;
      paidZoneVoice?: boolean; paidZoneVideo?: boolean; paidZoneChat?: boolean;
      privateVoiceCall?: boolean; privateVideoCall?: boolean;
      personalChat?: boolean; groupChat?: boolean;
    };
    // "Recording is active" notifications shown to users. Master + per-feature ON/OFF
    // and fully-editable text. When notify.enabled is OFF, no banner is shown to users
    // even though recording continues per the module switches above.
    notify?: {
      enabled?: boolean;      // master switch for showing recording notices
      text?: string;          // editable notice text (default: "This room is being recorded.")
      voiceRoom?: boolean; privateRoom?: boolean; competition?: boolean;
      paidZoneCall?: boolean; voiceCall?: boolean; videoCall?: boolean; chat?: boolean;
    };
  };
  // Active-time / Startup-Bonus reward — coins for hours of app activity. Fully admin-
  // controlled (amounts, hours, notification text, limits, on/off). Nothing hardcoded.
  activityReward?: {
    enabled?: boolean;          // feature ON/OFF (default OFF)
    name?: string;              // reward name shown in history (e.g. "Startup Bonus")
    requiredMinutes?: number;   // minutes of activity per reward (default 60 = 1 hour)
    continuousCoins?: number;   // reward for a CONTINUOUS hour (default 50)
    accumulatedCoins?: number;  // reward for an ACCUMULATED hour (default 25)
    gapMinutes?: number;        // a gap longer than this breaks the "continuous" run (default 3)
    dailyLimit?: number;        // max rewards per user per day (0 = unlimited)
    maxPerUser?: number;        // lifetime max rewards per user (0 = unlimited)
    notifyTitle?: string;       // notification title (e.g. "Congratulations!")
    continuousMsg?: string;     // uses {coins} and {hours}
    accumulatedMsg?: string;    // uses {coins} and {hours}
  };
  // FREE COINS MANAGEMENT — one place to control the coins the platform gives away
  // for free. `enabled` is the master kill-switch for the reward types managed here
  // (welcome / daily login / event / manual). The other free-coin systems (referral,
  // lucky spin, tournament, level) keep their own dedicated settings and are only
  // SHOWN + linked from the Free Coins page.
  freeCoins?: {
    enabled?: boolean; // master switch for the reward types below (default true)
    welcome?: { enabled?: boolean; amount?: number };                      // one-time bonus on new-account approval
    dailyLogin?: { enabled?: boolean; amount?: number };                   // coins on the first login each day
    event?: { enabled?: boolean; amount?: number; validUntil?: string };   // default amount for manual event grants + optional end date
    // PERIODIC (timed) reward — every user can claim `amount` coins once each
    // `intervalMinutes`. The interval/amount/limit/eligibility are the SINGLE
    // SOURCE OF TRUTH: the client never hard-codes them, the countdown and the
    // grant are both computed on the server clock from `user.lastFreeCoinAt`, so
    // device-time changes, page refreshes and reinstalls can't shorten the wait.
    periodic?: {
      enabled?: boolean;          // default OFF — no timed reward until admin turns it on
      intervalMinutes?: number;   // wait between claims (admin value; default 30)
      amount?: number;            // coins per claim (default 0)
      dailyLimit?: number;        // max claims per user per calendar day (0 = unlimited)
      minLevel?: number;          // minimum account level to be eligible (0 = everyone)
    };
  };
  // Inactivity Detection — protects the Startup Bonus from idle-farming and can
  // (optionally) auto-log-out idle users.
  //
  // ⚠ HISTORY: v160 REMOVED a 3-minute idle auto-logout because it signed people
  // out while the app was merely in the background. `enabled` therefore ships OFF
  // and `backgroundMonitor` ships OFF, so that bug cannot return unless an admin
  // deliberately turns both on. `rewardRequiresActivity` (the part that actually
  // stops bonus abuse) ships ON and never logs anyone out.
  inactivity?: {
    enabled?: boolean;                // auto-logout ON/OFF (default OFF)
    timeoutMinutes?: number;          // idle minutes before the warning (3/5/10/15/custom)
    warningSeconds?: number;          // countdown shown before logout (30 or 60)
    backgroundMonitor?: boolean;      // ALSO count idle time while the app is backgrounded (default OFF)
    exemptAdmins?: boolean;           // never auto-log-out admins (default ON)
    exemptRoles?: string[];           // extra exempt roles, e.g. ["agency","business"]
    singleSession?: boolean;          // a new login ends that account's other sessions
    rewardRequiresActivity?: boolean; // hourly bonus counts ONLY genuinely active minutes (default ON)
    rewardGraceMinutes?: number;      // minutes after the last real interaction that still count (default 5)
    roomTimeoutSeconds?: number;      // seconds without a room heartbeat before a member is treated as GONE — drops them from the participant list, the "in room" count and any bonus. Default 60.
  };
  // Tax + service charge added on top of a coin package's price. One global rate
  // for every package (see lib/coin-price.ts for the calculator). Ships OFF, so
  // prices are unchanged until an admin switches it on.
  coinFees?: {
    taxEnabled?: boolean;
    taxLabel?: string;       // shown to the user, e.g. "VAT"
    taxPct?: number;         // percent of the package price
    serviceEnabled?: boolean;
    serviceLabel?: string;   // e.g. "Service charge"
    servicePct?: number;     // percent of the package price
    serviceFixed?: number;   // flat amount added as well
    showBreakdown?: boolean; // show the itemised breakdown at checkout
  };
  // Game rules the admin can tune without an app update.
  gameRules?: {
    // What happens to a player's chances (hearts) when they LEAVE and REJOIN a
    // game. ON (default): leaving costs ONE chance and they keep the rest — they
    // can rejoin and continue with their remaining chances. OFF: leaving forfeits
    // ALL chances (fixed) — the used chances stay used and they don't come back in.
    returnChancesOnRejoin?: boolean;
  };
  // Privacy & Messaging controls (admin-managed). Everything ships OFF so
  // existing behaviour is unchanged until an admin enables it.
  privacy?: {
    enabled?: boolean;            // master switch for all privacy/messaging restrictions (default true)
    mutualFollowToView?: boolean; // a profile is viewable only if the two users follow EACH OTHER (default false)
    dmLimitEnabled?: boolean;     // limit how many unanswered messages one user can send another (default false)
    maxUnansweredDMs?: number;    // that limit (default 4)
    unlockOnFollow?: boolean;     // the recipient FOLLOWING the sender also unlocks more messages, not only a reply (default true)
  };
  // Login attempt limit / temporary lockout — admin-controlled.
  loginSecurity?: {
    enabled?: boolean;       // enforce the failed-attempt lock at all (default true)
    maxAttempts?: number;    // wrong passwords before a temporary lock (default 5)
    lockoutMinutes?: number; // how long the lock lasts (default 15)
  };
  // VOICE ROOM AUDIO QUALITY (Admin → Voice Quality). See src/lib/config.tsx.
  voiceQuality?: {
    bitrateKbps?: number; dtx?: boolean; red?: boolean;
    noiseSuppression?: boolean; echoCancellation?: boolean; autoGainControl?: boolean;
    voiceIsolation?: boolean; stereo?: boolean;
  };
  // Device & Security restrictions (see src/lib/config.tsx for field docs). 0 = unlimited.
  deviceSecurity?: {
    maxAccountsPerDevice?: number; maxDevicesPerAccount?: number;
    blockMultiAccountPerDevice?: boolean; whitelistMode?: boolean; retentionDays?: number;
    alertNewDevice?: boolean; alertNewDeviceUser?: boolean; alertMultiAccount?: boolean; alertBlockedAttempt?: boolean;
    alertFailedLogins?: boolean; failedLoginThreshold?: number;
  };
  // Messaging & file controls (Admin → Messaging Controls). See src/lib/config.tsx for docs.
  messaging?: {
    types?: Record<string, boolean>; // per message-type enable/disable (text/image/gif/sticker/video/audio/file/emoji)
    maxFileMB?: number;              // upload ceiling for chat attachments (0 = fall back to global uploadMaxMB)
    blockedExtensions?: string[];    // file extensions to reject (without dot, lowercase)
    allowedExtensions?: string[];    // OPTIONAL extra extensions to allow beyond the built-in list (e.g. zip, rar, apk)
    allowAllTypes?: boolean;         // one switch: accept ANY file type EXCEPT the dangerous denylist (exe/bat/apk/…); "all files except executables"
    allowDownload?: boolean;         // let users download attachments (default true)
    allowForward?: boolean;          // let users forward messages (default true)
    allowCopy?: boolean;             // let users copy message text (default true)
    editWindowMin?: number;          // minutes a sender may still edit a message (0 = editing off)
    retentionDays?: number;          // auto-delete DMs older than this (0 = keep forever)
    virusScan?: boolean;             // run the (pluggable) upload security scan — needs a provider to actually scan
    auditUploads?: boolean;          // keep the per-file upload audit trail
    // Edit / Delete message permissions. Global ON/OFF switches, plus a per-user
    // override so ONE member can lose (or keep) either option on their own.
    userEdit?: boolean;              // members may edit their own messages (default ON)
    userDelete?: boolean;            // members may delete their own messages for everyone (default ON)
    adminEditAny?: boolean;          // admins may edit ANY user's message (default ON)
    adminDeleteAny?: boolean;        // admins may delete ANY user's message (default ON)
    perUser?: Record<string, { edit?: boolean; delete?: boolean }>;
  };
  // Admin → File Storage (the company's own permanent file library).
  fileStorage?: {
    quotaGB?: number;   // total space the library may use (0 = unlimited)
    maxFileMB?: number; // biggest single file an admin may upload (0 = 200 MB default)
  };
}

/** One inactivity event, kept for audit. `publicId` is the member's permanent ID
 *  NUMBER so admins can identify the account, not just read a name. */
export interface InactivityEvent {
  id: string;
  userId: string;
  userName: string;
  publicId?: string;          // member ID number (shown next to the name everywhere)
  kind: "auto_logout" | "session_replaced";
  at: string;
  idleMinutes?: number;
  reason: string;             // e.g. "Auto Logout - Inactive User."
}

/** Daily + lifetime counters behind the admin Inactivity dashboard. */
export interface InactivityStats {
  dayKey?: string;
  autoLogouts?: number;       // auto logouts today
  sessionsEnded?: number;     // duplicate sessions terminated today
  idleMinutes?: number;       // idle minutes not credited today
  coinsSaved?: number;        // estimated coins NOT paid out today thanks to protection
  totalAutoLogouts?: number;  // lifetime
  totalIdleMinutes?: number;  // lifetime
  totalCoinsSaved?: number;   // lifetime
  logs?: InactivityEvent[];   // most-recent-first, capped
}

/** A complaint / investigation case for the Record Management "Complaint &
 *  Investigation Center". Links to whatever record it concerns (user/room/call/
 *  competition/agency) and carries the admin's status + internal notes. */
export interface ComplaintCase {
  id: string;
  code: string;              // human ref, e.g. CMP-1042
  subjectUserId?: string;
  subjectName?: string;
  roomId?: string;
  callId?: string;
  competitionId?: string;
  agencyId?: string;
  category?: string;         // abuse / dispute / payment / other
  reason: string;
  status: "pending" | "investigating" | "resolved" | "rejected";
  raisedBy: string;          // admin who logged it
  raisedByName?: string;
  raisedAt: string;
  notes: { at: string; by: string; text: string }[];
  decidedByName?: string;
  decidedAt?: string;
}

/** Starter legal policies — admins edit these and can add more in /admin/policies. */
export function defaultPolicies(): PolicyDoc[] {
  const at = "2026-01-01T00:00:00.000Z";
  return [
    {
      id: "terms",
      slug: "terms",
      title: "Terms & Conditions",
      requiredAtSignup: true,
      updatedAt: at,
      body:
        "Welcome to LotusPlay Connect. By creating an account and using this app you agree to these Terms & Conditions.\n\n" +
        "1. Eligibility: You must be at least 18 years old to register and use the app.\n\n" +
        "2. Your account: You are responsible for keeping your login details secure and for all activity on your account. Provide accurate information when registering.\n\n" +
        "3. Acceptable use: Be respectful in voice rooms, chats and games. Harassment, hate speech, fraud, cheating, impersonation and any illegal activity are prohibited and may result in suspension or removal.\n\n" +
        "4. Virtual coins & gifts: Coins and gifts are a virtual, in-app convenience and have no real-world cash value except where a withdrawal is explicitly offered and approved. We may adjust features and balances to correct errors or abuse.\n\n" +
        "5. Service changes: We may update, suspend or discontinue features at any time. Continued use after changes means you accept the updated Terms.\n\n" +
        "6. Liability: The app is provided \"as is\". To the extent permitted by law, we are not liable for losses arising from use of the service.\n\n" +
        "If you do not agree with these Terms, please do not use the app.",
    },
    {
      id: "privacy",
      slug: "privacy",
      title: "Privacy Policy",
      requiredAtSignup: true,
      updatedAt: at,
      body:
        "This Privacy Policy explains how LotusPlay Connect handles your information.\n\n" +
        "1. What we collect: Account details you provide (name, date of birth, gender, mobile number, email, username), profile content you upload, and activity needed to run the service (rooms joined, messages, games, transactions).\n\n" +
        "2. How we use it: To create and secure your account, operate voice rooms and games, process coins/gifts, prevent fraud and abuse, and provide support.\n\n" +
        "3. Sharing: We do not sell your personal data. We share information only with service providers needed to run the app (e.g. voice infrastructure, payment processing) and where required by law.\n\n" +
        "4. Security: We take reasonable measures to protect your data. No method of transmission or storage is 100% secure.\n\n" +
        "5. Your choices: You can edit your profile, request account changes, or contact support to ask about your data.\n\n" +
        "By using the app you consent to this Privacy Policy.",
    },
    {
      id: "refund",
      slug: "refund",
      title: "Refund Policy",
      requiredAtSignup: true,
      updatedAt: at,
      body:
        "This Refund Policy applies to purchases of virtual coins and paid features in LotusPlay Connect.\n\n" +
        "1. Virtual items: Coins, gifts and paid features are digital goods delivered to your account immediately. As a rule, purchases are final and non-refundable once delivered.\n\n" +
        "2. Exceptions: If you were charged in error, charged twice, or did not receive coins you paid for, contact support within 7 days with your transaction details and we will investigate.\n\n" +
        "3. Approved refunds: Where a refund is approved, it is returned to the original payment method; the related coins/gifts may be removed from your balance.\n\n" +
        "4. Abuse: Refunds may be declined where there is evidence of fraud, chargeback abuse, or violation of our Terms.\n\n" +
        "For any billing question, contact our support team.",
    },
    {
      id: "responsible-gaming",
      slug: "responsible-gaming",
      title: "Responsible Gaming Policy",
      requiredAtSignup: true,
      updatedAt: at,
      body:
        "LotusPlay Connect is for entertainment. We are committed to a safe and responsible experience.\n\n" +
        "1. Play for fun: Games are intended for enjoyment and social interaction, not as a source of income.\n\n" +
        "2. Set limits: Play within your time and budget. Take regular breaks and never spend more than you can comfortably afford.\n\n" +
        "3. Age requirement: The app is strictly for users aged 18 and above.\n\n" +
        "4. Stay in control: If gaming stops being fun or starts to feel like a problem, please pause and seek support from friends, family, or a professional helpline in your country.\n\n" +
        "5. Our commitment: We act against cheating and unfair play, and we may provide tools or limits to help you stay in control.\n\n" +
        "Play responsibly.",
    },
  ];
}

/** Starter Agency LEVEL tiers (Bronze → Supreme). Admin edits names/badges/colours/
 *  thresholds freely. Default metric = member count, so levels are meaningful from
 *  day one (replacing the old always-"1" coins metric that was never fed). */
export function defaultAgencyLevels(): { enabled: boolean; metric: "members" | "earnings" | "coins"; tiers: AgencyLevelTier[] } {
  return {
    enabled: true,
    metric: "members",
    tiers: [
      { id: "agl_bronze", name: "Bronze", badge: "🥉", color: "#b45309", minValue: 0 },
      { id: "agl_silver", name: "Silver", badge: "🥈", color: "#94a3b8", minValue: 5 },
      { id: "agl_gold", name: "Gold", badge: "🥇", color: "#f59e0b", minValue: 15 },
      { id: "agl_platinum", name: "Platinum", badge: "💎", color: "#38bdf8", minValue: 30 },
      { id: "agl_diamond", name: "Diamond", badge: "💠", color: "#22d3ee", minValue: 60 },
      { id: "agl_master", name: "Master", badge: "👑", color: "#a855f7", minValue: 100 },
    ],
  };
}

/** Starter agency membership plans (admin can edit/add/disable freely). */
export function defaultAgencyPlans(): AgencyPlan[] {
  const at = "2026-01-01T00:00:00.000Z"; // fixed (Date.now() unavailable at seed time in some contexts)
  return [
    { id: "agp_1m", name: "1 Month", durationDays: 30, priceCoins: 5000, enabled: true, createdAt: at },
    { id: "agp_3m", name: "3 Months", durationDays: 90, priceCoins: 12000, enabled: true, createdAt: at },
    { id: "agp_6m", name: "6 Months", durationDays: 180, priceCoins: 20000, enabled: true, createdAt: at },
    { id: "agp_1y", name: "1 Year", durationDays: 365, priceCoins: 35000, enabled: true, createdAt: at },
    { id: "agp_2y", name: "2 Years", durationDays: 730, priceCoins: 60000, enabled: true, createdAt: at },
  ];
}

/** Starter competition prize positions (1st–4th). Admin edits coins + ON/OFF. */
export function defaultCompetitionPrizes(): { coins: number; enabled: boolean }[] {
  return [
    { coins: 1000, enabled: true },  // Prize 1 (winner)
    { coins: 500, enabled: true },   // Prize 2
    { coins: 250, enabled: true },   // Prize 3
    { coins: 100, enabled: false },  // Prize 4
  ];
}

/** The frame-store ownership entry for a frame, or null when not owned / EXPIRED.
 *  Legacy v354 purchases (ownedFrameIds, no validity data) count as permanent. */
export function frameActiveEntry(u: UserRecord, frameId: string): { at: string; expiresAt?: string | null } | null {
  const e = u.frames?.[frameId];
  if (e) return !e.expiresAt || new Date(e.expiresAt).getTime() > Date.now() ? e : null;
  if (u.ownedFrameIds?.includes(frameId)) return { at: "", expiresAt: null };
  return null;
}

/** The frame OTHERS should see on this user RIGHT NOW — "" when none is worn or
 *  the worn frame has expired (automatic expiry needs no cron: every read path
 *  resolves through this). */
export function effectiveFrame(u: UserRecord): string {
  const id = u.equippedFrame;
  if (!id) return "";
  return frameActiveEntry(u, id) ? id : "";
}

/** Store-item ownership entry (backgrounds/name effects/badges), or null when
 *  not owned / expired. Same validity model as frames. */
export function storeActiveEntry(u: UserRecord, itemId: string): { at: string; expiresAt?: string | null } | null {
  const e = u.storeOwned?.[itemId];
  if (!e) return null;
  return !e.expiresAt || new Date(e.expiresAt).getTime() > Date.now() ? e : null;
}

/** What this user is effectively wearing per store slot RIGHT NOW — expired
 *  items silently drop off, exactly like frames. */
export function effectiveEquipped(u: UserRecord): { background: string; nameEffect: string; badge: string; overlay: string; dice: string; board: string; token: string } {
  const pick = (id?: string) => (id && storeActiveEntry(u, id) ? id : "");
  return {
    background: pick(u.equipped?.background),
    nameEffect: pick(u.equipped?.nameEffect),
    badge: pick(u.equipped?.badge),
    overlay: pick(u.equipped?.overlay),
    // The GAME cosmetics. These must be returned too, or a dice/board/token the
    // player has paid for would never reach the board — the game reads what is
    // worn from here, and an expired item disappears on its own via `pick`.
    dice: pick(u.equipped?.dice),
    board: pick(u.equipped?.board),
    token: pick(u.equipped?.token),
  };
}

export function defaultConfig(): AppConfig {
  return {
    appName: "LotusPlay Connect",
    companyName: "",
    themeColor: "",
    themeColor2: "",
    themeSurface: "",
    themeSurfaceBrightness: 0,
    themeGlow: 100,
    themeBgImage: "",
    customCss: "",
    themes: DEFAULT_THEMES.map((t) => ({ ...t })),
    activeThemeId: "classic",
    allowUserThemeSwitch: false,
    menuLayout: {},
    uiStyle: {},
    announcement: "",
    adminLimit: 10,
    games: [
      { id: "ludo", name: "Ludo", icon: "dice", enabled: true, route: "/games/ludo", spectator: true, coinCost: 0, players: 1840, matchesToday: 612 },
      { id: "chess", name: "Chess", icon: "crown", enabled: true, route: "/games/chess", spectator: true, coinCost: 50, players: 920, matchesToday: 188 },
      { id: "snake", name: "Snake & Ladder", icon: "joystick", enabled: true, route: "/games/snake", spectator: true, coinCost: 50, players: 540, matchesToday: 97 },
      // Lucky Number is a draw, not a turn-based board game, so it has no spectator
      // mode; it is listed here so admins manage every game from one place.
      { id: "lucky-number", name: "Lucky Number", icon: "ticket", enabled: true, route: "/lucky-number", spectator: false, coinCost: 0, players: 0, matchesToday: 0 },
    ],
    settings: { signups: true, otp: true, roomCreation: true, gifts: true, maintenance: false, signupApproval: true, gameWinRewards: false },
    features: { registration: true, voiceRooms: true, privateRooms: true, paidZone: true, gifts: true, coins: true, levels: true, games: true, coHost: true, chat: true, business: true, reels: true, tournaments: true, competitions: true, luckyNumber: true },
    tournamentControls: { tournamentRegistration: true, tournamentAutoStart: true, tournamentAutoPrize: true, tournamentMatchRooms: true, tournamentPublicListing: true, competitionRegistration: true, competitionVoting: true, competitionGifts: true, competitionResults: true, adminAutoJoinCompetition: true },
    lobby: { enabled: false, hostOnlyStart: true, autoJoin: true, manualInvite: true, countdownSeconds: 20, startingSeconds: 3, minPlayers: 2, maxPlayers: 4, seatOrder: ["red", "green", "yellow", "blue"] },
    gameDice: { customFace: false, faceImage: "", showLastRolled: true },
    business: { categories: [...DEFAULT_BUSINESS_CATEGORIES], registerCost: 200, fields: [], jobTypes: [...DEFAULT_JOB_TYPES], jobFields: [], profileSections: [...DEFAULT_PROFILE_SECTIONS] },
    roomControls: { voiceEnabled: true, videoEnabled: true, defaultSeats: 10, maxSeats: 10, showHostCrown: true, showSeatGear: true, showCoHostStar: true },
    roomList: { mode: "all", hideOffline: false, requireHost: false, requireCoHost: false, requireMember: false, minLive: 0, alwaysShowMine: true, adminSeesAll: true, showActive: true, showInactive: true },
    permissions: { coHostCanRemove: true, coHostCanMute: true, memberCanInvite: false, memberCanGift: true },
    content: {
      welcome: "Welcome to LotusPlay Connect — connect, chat, play & grow together!",
      supportEmail: "support@lotus.com",
      termsUrl: "",
      playStoreUrl: "",
      apkUrl: "",
    },
    membership: {
      paidEnabled: false,
      subscriberFeatures: {
        dice: false,
        boards: false,
        tokens: false,
        frames: false,
        profileStore: false,
        gameCosmetics: false,
        paidZone: false,
        paidZoneCalls: false,
        tournaments: false,
        competitions: false,
      },
      plans: [
        { id: "free", name: "Free", price: 0, period: "month", perks: ["Join rooms", "Play games", "Daily rewards"], on: true },
        { id: "silver", name: "Silver", price: 99, period: "month", perks: ["Everything in Free", "Create rooms", "Profile badge", "2× coins"], on: true },
        { id: "gold", name: "Gold", price: 299, period: "month", perks: ["Everything in Silver", "Priority support", "Exclusive frames", "Ad-free"], on: true },
      ],
    },
    rewards: [
      { id: "daily", label: "Daily login bonus", coins: 50, on: true },
      { id: "win", label: "Game win reward", coins: 20, on: true },
      { id: "referral", label: "Refer a friend", coins: 100, on: true },
      { id: "firstroom", label: "Host your first room", coins: 30, on: true },
    ],
    ads: [
      { id: "ad_welcome", title: "Welcome bonus — 2× coins this week!", imageUrl: "", linkUrl: "/rewards", position: "top", active: true, impressions: 0, clicks: 0 },
    ],
    siteContent: DEFAULT_SITE_CONTENT,
    coinPackages: [
      { id: "cp_500", name: "Starter", coins: 500, price: 49, iconUrl: "", active: true, featured: false, badge: "" },
      { id: "cp_1200", name: "Popular", coins: 1200, price: 99, iconUrl: "", active: true, featured: true, badge: "popular" },
      { id: "cp_3000", name: "Value", coins: 3000, price: 199, iconUrl: "", active: true, featured: false, badge: "best_value" },
      { id: "cp_8000", name: "Mega", coins: 8000, price: 499, iconUrl: "", active: true, featured: false, badge: "" },
    ],
    coinOffers: [
      { id: "of_launch", name: "Launch bonus", type: "bonus", amount: 200, from: "", until: "", active: true },
    ],
    giftCatalog: GIFTS.map((g) => ({
      id: g.id, emoji: g.emoji, name: g.name, cost: g.cost, category: g.category, active: g.active !== false,
    })),
    paymentGateway: {
      enabled: true,
      provider: "stripe",
      keyId: "",
      currency: "SAR",
      methods: { cards: true, googlePay: true, applePay: true, paypal: true, local: true },
    },
    moderation: {},
    uploadMaxMB: 10,
    policies: defaultPolicies(),
    featurePricing: { roomNameChange: 500, videoUnlock: 1000, coHostSlot: 500, extraPublicRoom: 1000 },
    agencyPlans: defaultAgencyPlans(),
    agencyLevels: defaultAgencyLevels(),
    competitionPrizes: defaultCompetitionPrizes(),
    coHostLimit: 3,
    gameTurnSeconds: 10,
    gameDiceSpeed: "normal",
    gameTokenSpeed: "normal",
    fairDice: { enabled: false, threshold: 12, boostPercent: 50, guaranteeAfter: 20 },
    photoEditor: { enabled: true, mode: "full", maxSizeMB: 10, formats: ["jpg", "png", "webp"], minRes: 0, maxRes: 512, autoCompress: true, quality: 82, forceSquare: false, forceCircle: true, allowRotate: true, allowZoom: true, allowDrag: true, allowFlip: true, autoCenter: true, approvalRequired: false, moderation: "off", defaultImage: "" },
    defaultAvatar: { mode: "first", maxChars: 10, uppercase: false, keepEmoji: false, imageUrl: "", showName: true },
    roomOverlays: [],
    diceControl: { mode: "random", fairPlayProtection: true, useProbabilities: false, probabilities: { one: 17, two: 17, three: 17, four: 17, five: 16, six: 16 }, equalProbability: false, winnerBalancing: false, newPlayerSupport: false, autoFairness: false, maxRollsWithout6: 0, minRollsBefore6: 0, disableConsecutive6: false, maxConsecutive6: 0, boostThreshold: 0, boostPercent: 0, playerControls: [] },
    speakingFx: { enabled: true, style: "glow", color: "", speed: "normal" },
    categories: [
      { id: "rc_friend", name: "Friendship", scope: "room", enabled: true, order: 0 },
      { id: "rc_music", name: "Music", scope: "room", enabled: true, order: 1 },
      { id: "rc_gaming", name: "Gaming", scope: "room", enabled: true, order: 2 },
      { id: "rc_tamil", name: "Tamil Community", scope: "room", enabled: true, order: 3 },
      { id: "rc_chat", name: "Just Chatting", scope: "room", enabled: true, order: 4 },
      { id: "rc_study", name: "Study", scope: "room", enabled: true, order: 5 },
      { id: "sc_frames", name: "Frames", scope: "store", enabled: true, order: 0 },
      { id: "sc_backgrounds", name: "Backgrounds", scope: "store", enabled: true, order: 1 },
      { id: "sc_effects", name: "Name Effects", scope: "store", enabled: true, order: 2 },
      { id: "sc_badges", name: "Badges", scope: "store", enabled: true, order: 3 },
    ],
    tokenDesigns: defaultTokenDesigns(),
    diceModels: defaultDiceModels(),
    activeDiceModelId: "classic-white",
    gameBoard: {
      center: { image: "", show: true, sizePct: 84, opacityPct: 40, rotateDeg: 0, offsetXPct: 0, offsetYPct: 0 },
      centerSnake: { image: "", show: false, sizePct: 50, opacityPct: 25 },
      snakeGrid: { topPct: 0, leftPct: 0, widthPct: 100, heightPct: 100 },
      ludoGrid: { topPct: 0, leftPct: 0, widthPct: 100, heightPct: 100 },
      snakeMyPosition: "bottom",
      tokenScalePct: 100,
      tokenFanPct: 100,
      shareStyle: "corners",
      decor: { homeSymbol: "", homeSymbolShow: true, safeIcon: "", safeIconShow: true, safeHighlight: true, safeColor: "#10b981", frameColor: "", fullImage: "", fullImageShow: true, fullImageOpacityPct: 100, fullImageFit: "contain", fullImageOffsetXPct: 0, fullImageOffsetYPct: 0, fullImageScalePct: 100, boxBorder: true, borderColor: "", boxHighlight: true, showArrow: true, hideHomeBg: false, homeBgColor: "", safeSizePct: 100, safeOpacityPct: 100, safeGlow: false, safeRotateDeg: 0,
        safeIconMode: "default", safeBorder: false, safeBorderColor: "", safeGlowPx: 4, safeShadow: true, safeShadowOpacityPct: 55, safePosXPct: 0, safePosYPct: 0, safeVisibility: "visible" },
      elements: {},
      safeCells: [],
      chess: {
        themeId: "green", lightColor: "", darkColor: "", boardImage: "", boardImageOpacityPct: 100,
        pieceStyle: "solid", pieceImages: {}, pieceScalePct: 100,
        showCoords: true, showLegalDots: true, showLastMove: true, showCheckHighlight: true,
        showWatermark: true, animateMoves: true, animMs: 220, captureFlash: true,
        flipForBlack: true, showMoveHistory: true, showCapturedTray: true, boardBorder: true,
      },
      boards: [],
      activeBoardId: "",
      tokenSlots: { enabled: false, slots: [{ dxPct: 0, dyPct: 0, sizePct: 100, rotateDeg: 0 }, { dxPct: 0, dyPct: 0, sizePct: 100, rotateDeg: 0 }, { dxPct: 0, dyPct: 0, sizePct: 100, rotateDeg: 0 }, { dxPct: 0, dyPct: 0, sizePct: 100, rotateDeg: 0 }] },
      homeAreas: { enabled: false },
    },
    gameAnim: {
      diceRoll: true, diceStyle: "tumble", diceDisplaySeconds: 2, turnDelaySeconds: 1, tokenMove: true, moveStyle: "slide", winCelebration: true, winIntensity: "normal",
      captureFlash: true, coinGlow: true, soundEffects: true,
      turnAnim: true, turnAnimStyle: "glow",
      centerReach: { enabled: true, style: "bloom", speed: "normal" },
    },
    shield: { iconEnabled: true, glow: true, blink: false, particles: false, image: "", color: "#10b981", animationStyle: "pulse", speed: "normal" },
    gameTheme: { preset: "default", bgColor: "", bgImage: "", accent: "", music: { enabled: false, track: "", volumePct: 40 } },
    giftReceiverSharePct: 70, // receiver keeps 70% of a gift's value; 30% = company revenue
    media: {
      libraryAccess: true,
      audioEnabled: true, videoEnabled: true, imageEnabled: true,
      audioPaid: false, audioPrice: 0,
      videoPaid: false, videoPrice: 0,
      imagePaid: false, imagePrice: 0,
    },
    paidZone: { enabled: true, joinCost: 500, audioPerMin: 10, videoPerMin: 20, callsEnabled: true, videoCallsEnabled: true, recordingEnabled: false, receiverRewardsEnabled: true, receiverSharePct: 70, agencyProfitPct: 0, monthlyCoins: 300, renewalDays: 30, graceDays: 3, autoRenew: true },
    withdraw: { coinsPerUnit: 10, currency: "SAR", feePct: 0, minCoins: 1000, maxCoins: 100000, autoApprove: false },
    lotus: { enabled: false, name: "Lotus Flower", icon: "", coinToLotus: 1, lotusToCurrency: 0.1, currency: "SAR", minWithdraw: 100, maxWithdraw: 100000, dailyLimit: 0, feePct: 5, autoApprove: false, userSharePct: 65, agencySharePct: 5, companySharePct: 25, trustSharePct: 5, trustEnabled: true, gstPct: 18,
      // Seed slabs (client's example table at the default 0.1 rate) — every value is
      // editable/deletable in Admin → Lotus → Conversion rules.
      conversionTiers: [
        { id: "ct_500", lotus: 500, value: 50, enabled: true },
        { id: "ct_800", lotus: 800, value: 80, enabled: true },
        { id: "ct_1000", lotus: 1000, value: 100, enabled: true },
        { id: "ct_2000", lotus: 2000, value: 200, enabled: true },
        { id: "ct_4000", lotus: 4000, value: 400, enabled: true },
        { id: "ct_5000", lotus: 5000, value: 500, enabled: true },
        { id: "ct_10000", lotus: 10000, value: 1000, enabled: true },
      ] },
    levelRewards: { enabled: true, base: 20, perLevel: 10, cap: 500, xpPlay: 12, xpWin: 30, xpGift: 6, xpDailyLogin: 25, xpPurchase: 15 },
    lotusRewards: { enabled: false, notifyUser: true, validityDays: 0, tiers: [ { minCoins: 10000, flowers: 1 }, { minCoins: 50000, flowers: 5 }, { minCoins: 100000, flowers: 10 }, { minCoins: 500000, flowers: 50 }, { minCoins: 1000000, flowers: 100 } ] },
    logCleanup: { enabled: false, days: 90 },
    referral: { enabled: true, reward: 100, requireApproval: false, autoBlockDuplicates: true },
    captureProtection: { screenshot: true, recording: true, sharing: true, thirdParty: true, autoEndCall: false, warning: true, watermark: false, audioRecording: true, videoRecording: true, mirroring: true, allScreens: false, modules: { home: false, profile: false, chat: false, voiceRoom: false, wallet: true, paidZone: true, reels: false, tournaments: false, competitions: false } },
    gameSound: { pack: "classic", effects: {} },
    bgMusic: { enabled: false, volumePct: 35, screens: {} },
    avatarFrames: [],
    storeItems: [],
    googleClientId: "",
    androidFingerprint: "",
    luckySpin: {
      enabled: true,
      cooldownHours: 24,
      segments: [
        { label: "5", coins: 5, weight: 30 },
        { label: "10", coins: 10, weight: 24 },
        { label: "20", coins: 20, weight: 18 },
        { label: "Try again", coins: 0, weight: 10 },
        { label: "50", coins: 50, weight: 10 },
        { label: "100", coins: 100, weight: 5 },
        { label: "250", coins: 250, weight: 2 },
        { label: "500", coins: 500, weight: 1 },
      ],
      extraChancesEnabled: true,
      dailyLoginChances: 1,
      winTaskChances: 1,
      buyCostCoins: 50,
      adChancesPerDay: 2,
      chanceExpiryDays: 0,
    },
    paymentQr: { enabled: true, imageUrl: "", upiId: "", note: "Scan the QR and pay the exact amount, then upload your payment screenshot. Coins are added after admin verification.", currency: "₹" },
    labels: {}, // no front-end text overrides by default (defaults live in lib/labels.ts)
    chat: { storeMessages: true, groupRetentionDays: 3, deleteForEveryone: true },
    // Storage limits START DISABLED so nothing changes for existing users until
    // the admin turns them on. Sensible defaults are ready for when they do.
    storage: { enabled: false, warningsEnabled: true, autoCleanupEnabled: false, defaultLimitMB: 500, vipLimitMB: 5000, agencyLimitMB: 2000, perAgencyMB: {} },
    recording: {
      master: false, roomEnabled: false, callEnabled: false, retentionDays: 30, autoDelete: false, maxStorageMB: 0, userAccess: "adminOnly",
      modules: {
        voiceRoomVoice: false, voiceRoomChat: false, privateRoomVoice: false, privateRoomChat: false,
        competitionAudio: false, competitionChat: false, paidZoneVoice: false, paidZoneVideo: false, paidZoneChat: false,
        privateVoiceCall: false, privateVideoCall: false, personalChat: false, groupChat: false,
      },
      notify: {
        enabled: true, text: "This room is being recorded.",
        voiceRoom: true, privateRoom: true, competition: true, paidZoneCall: true, voiceCall: true, videoCall: true, chat: true,
      },
    },
    activityReward: {
      enabled: false, name: "Startup Bonus", requiredMinutes: 60, continuousCoins: 50, accumulatedCoins: 25,
      gapMinutes: 3, dailyLimit: 0, maxPerUser: 0, notifyTitle: "Congratulations!",
      continuousMsg: "You earned {coins} coins for {hours} hour of continuous activity.",
      accumulatedMsg: "You earned {coins} coins for {hours} hour of accumulated activity.",
    },
    freeCoins: {
      // Master ON. Welcome bonus defaults to 100 coins — the amount new accounts
      // already got — but is now configurable and recorded. Daily-login ships OFF
      // (a new giveaway shouldn't switch on by surprise).
      enabled: true,
      welcome: { enabled: true, amount: 100 },
      dailyLogin: { enabled: false, amount: 25 },
      event: { enabled: true, amount: 50 },
      // Timed reward ships OFF (an automatic every-N-minutes giveaway must be a
      // deliberate admin choice). 30-minute default interval only takes effect
      // once an admin enables it and sets an amount.
      periodic: { enabled: false, intervalMinutes: 30, amount: 0, dailyLimit: 0, minLevel: 0 },
    },
    inactivity: {
      // Auto-logout ships OFF (see the v160 note on the type above). Bonus
      // protection ships ON — it is the part that stops idle-farming, and it
      // never signs anyone out.
      enabled: false, timeoutMinutes: 15, warningSeconds: 30, backgroundMonitor: false,
      // singleSession ON (client requirement: one account = one device). The
      // idle auto-logout above stays OFF. Admin can still toggle either.
      exemptAdmins: true, exemptRoles: [], singleSession: true,
      rewardRequiresActivity: true, rewardGraceMinutes: 5, roomTimeoutSeconds: 60,
    },
    coinFees: {
      // OFF by default — turning either on immediately changes what users pay.
      taxEnabled: false, taxLabel: "VAT", taxPct: 15,
      serviceEnabled: false, serviceLabel: "Service charge", servicePct: 0, serviceFixed: 0,
      showBreakdown: true,
    },
    privacy: {
      // Mutual-follow profile gate ships OFF (opt-in). The 4-unanswered-message DM
      // limit ships ON (client requirement) — the admin can still turn it off.
      enabled: true, mutualFollowToView: false,
      dmLimitEnabled: true, maxUnansweredDMs: 4, unlockOnFollow: true,
    },
    loginSecurity: { enabled: true, maxAttempts: 5, lockoutMinutes: 15 },
    // Quality-first defaults. The old settings (12 kbps + DTX + no RED) were
    // chosen to save mobile data and are what made voice sound thin.
    voiceQuality: { bitrateKbps: 32, dtx: false, red: true, noiseSuppression: true, echoCancellation: true, autoGainControl: true, voiceIsolation: true, stereo: false },
    deviceSecurity: { maxAccountsPerDevice: 0, maxDevicesPerAccount: 0, blockMultiAccountPerDevice: false, whitelistMode: false, retentionDays: 0, alertNewDevice: false, alertNewDeviceUser: false, alertMultiAccount: true, alertBlockedAttempt: true, alertFailedLogins: false, failedLoginThreshold: 5 },
    messaging: { types: { text: true, image: true, gif: true, sticker: true, video: true, audio: true, file: true, emoji: true }, maxFileMB: 50, blockedExtensions: [], allowedExtensions: [], allowAllTypes: false, allowDownload: true, allowForward: true, allowCopy: true, editWindowMin: 15, retentionDays: 0, virusScan: false, auditUploads: true, userEdit: true, userDelete: true, adminEditAny: true, adminDeleteAny: true, perUser: {} },
    fileStorage: { quotaGB: 0, maxFileMB: 200 },
    // Default OFF = FIXED chances: leaving a game ends it promptly and decisively
    // (the proven, stable behaviour). Turning it ON is gentler on the leaver but
    // must never be relied on for a knockout tournament — see the leave handler.
    gameRules: { returnChancesOnRejoin: false },
  };
}

// A securely-stored uploaded file (KYC docs, document-request submissions).
// The index lets the file-serving route check ownership before streaming.
/** One sticker in a group's collection. Served from /api/media/<file>, which is
 *  public and cacheable — correct here, since stickers are meant to be seen by
 *  everyone in the room and load instantly. */
export interface RoomSticker {
  id: string;
  url: string;       // /api/media/<file>
  fileName?: string; // stored filename, so deleting also removes the file
  name?: string;     // optional label
  addedBy?: string;  // who added it
  at: string;
}

export interface UploadRecord {
  name: string; // stored filename on disk
  ownerId: string; // user who uploaded it
  originalName: string;
  mime: string;
  size: number;
  at: string;
  // Extra people allowed to open this file besides the owner and admins. Used by
  // private chat: the RECIPIENT of a photo/video/voice note must be able to view
  // it, but nobody else. Without this the file serving route 403s for them.
  viewerIds?: string[];
  // GROUP/ROOM chat attachments are shown to the WHOLE room, whose membership changes
  // over time — so instead of a fixed viewer list they're marked public: any logged-in
  // user may open them. Private docs (KYC / document submissions) stay gated (public
  // absent/false). This is what makes a room-chat image visible to every member.
  public?: boolean;
}

// ---- Admin File Storage (Admin → File Storage) ----------------------------
// A permanent, centralised library for the company's own files: project
// documents, training material, manuals, images, videos, archives. Files live in
// the same secure .data/uploads directory as everything else (so /api/file/<name>
// still enforces access), but they are indexed SEPARATELY here so they are never
// mixed with users' chat/KYC uploads and are never auto-pruned — they stay until
// an administrator deletes them.

/** A folder / category in the admin file library. */
export interface AdminFolder {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string; // admin's display name
}

export interface AdminFileRecord {
  id: string;
  name: string;          // stored filename on disk (also the /api/file/<name> key)
  title: string;         // editable display name (defaults to the original file name)
  originalName: string;
  mime: string;
  ext: string;
  size: number;
  at: string;            // uploaded
  uploaderId: string;
  uploaderName: string;
  folderId?: string;     // "" / undefined = not filed into a folder
  note?: string;         // optional description
}

// ---- Admin-requested documents module ----
export type DocReqStatus = "pending" | "submitted" | "under_review" | "approved" | "rejected" | "resubmit";

export interface DocSubmission {
  url: string; // /api/file/<name>
  name: string; // stored filename
  originalName: string;
  comment?: string;
  at: string;
}

export interface DocRequest {
  id: string;
  userId: string;
  userName: string;
  title: string;
  description?: string;
  type: string; // Request Letter, ID Card / Passport, Bank Passbook, …
  dueDate?: string; // ISO date
  mandatory: boolean;
  status: DocReqStatus;
  requestedBy: string; // admin name
  createdAt: string;
  submissions: DocSubmission[]; // upload history (latest last)
  remarks?: string; // admin's review note
  reviewedBy?: string;
  reviewedAt?: string;
  history: { at: string; action: string; by: string }[]; // audit trail
}

// A pending account-creation request submitted from the public sign-up form.
// Users do NOT self-create accounts — an admin reviews this and, on approval,
// creates the account with an admin-chosen username + password.
export interface RegistrationRequest {
  id: string;
  name: string;
  dob: string; // ISO date
  gender: "male" | "female";
  phone: string; // normalized
  email?: string;
  status: "pending" | "approved" | "rejected";
  at: string; // submitted at
  reviewedAt?: string;
  reviewedBy?: string;
  note?: string; // admin note / rejection reason
  createdUserId?: string; // the account created on approval
  createdUsername?: string; // shown to the admin to relay to the user
}

/** A group/room that has been DELETED, kept as a permanent record.
 *
 *  Deleting a room used to remove it from the database and write a single line
 *  to the console log, which rotates away — so there was no way to answer "who
 *  created that group, when, and why was it removed?" after the fact. The room's
 *  own details are copied here at the moment it is deleted, because afterwards
 *  there is nothing left to read them from. */
export interface DeletedRoomRecord {
  id: string;            // the room's original id
  name: string;
  category?: string;
  type?: string;         // public / private / password / community
  ownerId: string;       // the member who CREATED the group
  ownerName?: string;
  ownerPublicId?: string;
  createdAt?: string;    // when the group was created
  deletedAt: string;     // when it was deleted
  deletedBy?: string;    // who deleted it (name / "admin X" / "host Y")
  reason?: string;       // why
  memberCount?: number;  // size at the moment of deletion
}

export interface DBShape {
  users: UserRecord[];
  otps: OtpRecord[];
  friends: FriendEdge[];
  follows: FollowEdge[];
  notifications: NotificationRecord[];
  rooms: RoomRecord[];
  deletedRooms?: DeletedRoomRecord[]; // permanent history of removed groups
  config?: AppConfig;
  supportTickets?: SupportTicket[];
  supportSessions?: SupportSession[]; // screen-share / guided-support sessions
  adminLogs?: AdminLog[];
  dismissedSecurityAlerts?: DismissedSecurityAlert[]; // admin-dismissed Device & Security alerts
  approvalLog?: ApprovalLogEntry[]; // Approval History — decisions on queues whose records don't keep who decided
  tournaments?: TournamentRecord[];
  luckyDraws?: LuckyDrawRecord[];
  avatarCampaigns?: AvatarCampaign[];
  transactions?: Transaction[];
  walletAuditLog?: WalletAuditEntry[]; // durable Wallet-Management audit (balance before/after + IP/device)
  gameSessions?: GameSession[];
  gameLobbies?: GameLobby[]; // Host-controlled pre-game lobbies (new match-start flow)
  resetLog?: StuckResetEntry[]; // history of every stuck-game reset, auto or manual
  gameInvites?: GameInvite[]; // real game invitations / join requests (accept/reject)
  ludoColorClaims?: { roomId: string; userId: string; color: string; at: string }[]; // live Ludo colour reservations during setup (prevents duplicate picks)
  giftLog?: GiftLogEntry[];
  violations?: Violation[];
  withdrawals?: WithdrawalRequest[];
  luckySpins?: SpinResult[]; // Lucky Spin history log
  customUploads?: CustomUpload[]; // Admin → Custom Uploads & Banners (files + placements + audience + schedule)
  freeCoinClaims?: FreeCoinClaim[]; // periodic Free-Coins claim log (granted + rejected attempts)
  spinChanceLog?: SpinChanceEntry[]; // extra-chance transactions (earned/used/expired/reset)
  reports?: UserReport[];
  roomChats?: RoomChatMessage[];
  recordings?: Recording[];
  complaints?: ComplaintCase[]; // Complaint & Investigation Center cases
  nextComplaintNo?: number;     // running counter for CMP-#### codes
  roomEvents?: RoomEvent[];
  roomGifts?: RoomGift[]; // recent in-room gifts (so EVERYONE sees the burst on the receiver's avatar)
  featureRequests?: FeatureRequest[]; // paid-feature requests awaiting admin approval (room rename, video unlock)
  gameResults?: GameResult[]; // finished-match log (games played, winners, player records)
  coinPurchases?: CoinPurchaseRequest[]; // QR/UPI coin-purchase requests awaiting admin verification
  messages?: DirectMessage[];
  uploads?: UploadRecord[]; // secure file index (KYC + document submissions)
  adminFolders?: AdminFolder[]; // Admin → File Storage: categories/folders
  adminFiles?: AdminFileRecord[]; // Admin → File Storage: the "All Uploaded Files" library
  docRequests?: DocRequest[]; // admin-requested documents
  registrationRequests?: RegistrationRequest[]; // pending sign-up requests (admin-approved)
  paidZone?: PaidZoneMember[]; // Paid Zone membership requests + members (admin-approved premium area)
  paidZoneLog?: PaidZoneActivity[]; // Paid Zone activity log (admin monitoring)
  businesses?: BusinessRecord[]; // official Business accounts (Business Module)
  businessFollows?: BusinessFollowEdge[]; // user→business follows
  businessLog?: BusinessActivity[]; // Business-module activity log (admin monitoring)
  businessPosts?: BusinessPost[]; // posts on business pages (Business Pages sub-module)
  businessProducts?: BusinessProduct[]; // products/services (Business Marketplace sub-module)
  businessMedia?: BusinessMedia[]; // reels (Shorts) + videos on business profiles
  reviews?: Review[]; // user reviews + star ratings on businesses
  reels?: ReelRecord[]; // user-generated Reels (short videos) — the Reels feature
  jobPosts?: JobPost[]; // jobs posted by businesses (admin-approved)
  jobApplications?: JobApplication[]; // user applications (User → Admin → Business)
  callSessions?: CallSession[]; // Paid Zone calls (active + ended records) — per-minute billing
  companyEarnings?: number; // running total of ALL company profit (coins) — the single source of truth (== sum of companyProfits going forward)
  receiverPayouts?: number; // running total of coins paid out to call receivers (their share)
  companyProfits?: CompanyProfitEntry[]; // structured ledger of every company-profit coin event (gift/call commission, fees, …)
  agencyProfits?: AgencyProfitEntry[]; // ledger of agency-commission earnings (Agent Profit report)
  referrals?: ReferralRecord[]; // Refer-a-friend records (admin approve/reject/block + reports)
  mediaLibrary?: MediaLibraryItem[]; // admin-curated music/video library (rooms play from this)
  globalStickers?: GlobalSticker[]; // admin-curated sticker library shown in every room's picker
  // Store purchase history (frames + every other item kind) — reports + audit.
  // One row per purchase/repurchase/admin-gift; expiry snapshotted at purchase.
  // `kind` is absent on old frame rows (treat as "frame").
  framePurchases?: { id: string; userId: string; userName: string; frameId: string; frameName: string; price: number; validityDays: number; at: string; expiresAt?: string | null; source: "purchase" | "admin"; kind?: string }[];
  // User requests for NEW store items ("please add a fire name effect") —
  // admin approves/rejects from the Store admin page; the user is notified.
  storeRequests?: { id: string; userId: string; userName: string; kind: string; text: string; image?: string; status: "pending" | "approved" | "rejected" | "cancelled" | "completed"; at: string; decidedAt?: string; decidedBy?: string; note?: string }[];
  // Per-user, per-day app-activity for the admin Data Usage report:
  // dataUsage[userId][YYYY-MM-DD] = { appMin, voiceMin } (foreground minutes,
  // and minutes connected to a voice room). Estimated MB is derived from these.
  // `appHr`/`voiceHr` are sparse 24-slot hour-of-day arrays (server local hour)
  // so the report can answer "per hour" with MEASURED data rather than a guess.
  // They only exist for days recorded after per-hour tracking shipped (v469).
  dataUsage?: Record<string, Record<string, { appMin: number; voiceMin: number; appHr?: number[]; voiceHr?: number[] }>>;
  // Inactivity Detection audit trail + daily counters (admin dashboard).
  inactivityStats?: InactivityStats;
  nextMemberId?: number; // running counter for permanent member ID numbers (publicId)
  nextFzId?: number; // running counter for Friend Zone IDs (FZ1001, FZ1002, …)
  agencies?: Agency[]; // Agency System — admin-managed agencies (owners + members + commission)
  nextAgencyId?: number; // running counter for public Agency IDs (AG1001, AG1002, …)
  agencyChangeRequests?: AgencyChangeRequest[]; // member "switch my agency" requests → admin-approved
  agencyJoinRequests?: AgencyJoinRequest[]; // per-user log of "request to join" outcomes (pending/approved/rejected/blocked) — the user-visible request history
  agencyPayments?: AgencyPayment[]; // agency membership coin-payment receipts + history
  agencyUserApprovals?: AgencyUserApproval[]; // agency-created accounts awaiting/decided admin approval (+ audit)
  lotusGenerated?: number;   // running total of Lotus Flowers ever generated (all sources)
  giftedCoinsTotal?: number; // running total of coins ever spent on gifts (for reports)
  companyLotus?: number;     // running total of Lotus paid to the Company from distributions
  companyLotusReconciled?: boolean; // one-time: existing companyLotus folded into the company-profit ledger (v296)
  lotusCreditsBackfilled?: boolean; // one-time: pre-v296 Lotus earning credits (coins:0) got their real amount (v297)
  companyGiftGranular?: boolean;    // one-time: historical lump company-profit split into per-gift records (v298)
  profitPayouts?: ProfitPayout[]; // withdrawals/payouts recorded against a profit pool (company/agency/trust)
  trustWallet?: number;      // Trust Wallet / Trust Fund current balance (Lotus)
  trustWalletLog?: TrustWalletEntry[]; // Trust Wallet ledger (credits in + admin spends out)
  shareChangeLog?: ShareChangeEntry[]; // audit trail of Share Distribution % changes
  logDeletionAudit?: LogDeletionEntry[]; // secure audit trail of who deleted which logs, when
  competitions?: CompetitionRecord[]; // Competition Voice Rooms (contestants + votes)
  deletedUsers?: DeletedUser[]; // archive of deleted accounts (restorable) + deletion metadata
  deletedAgencies?: DeletedAgency[]; // archive of deleted agencies (restorable) + deletion metadata
  deletedTournaments?: DeletedTournament[]; // archive of deleted tournaments (restorable) + metadata
  devices?: DeviceRecord[]; // Device & Security — device registry (multiple-account detection, block/force-logout)
  geoCache?: Record<string, GeoInfo>; // ip → cached geolocation (best-effort)
  diceAudit?: DiceAuditEntry[]; // Dice Control — audit trail of every settings change (admin/date/prev/new)
  levelAudit?: LevelAuditEntry[]; // Admin → User Levels — every manual level change (prev/new/admin/reason/ip/time)
  lotusRewardLog?: LotusRewardEntry[]; // Lotus Flower rewards — automatic + manual grant/revoke history
  seededAt?: string;
}

/** One Dice Control settings change — the client wants admin name, date/time, previous
 *  value and updated value for every change. */
export interface DiceAuditEntry {
  id: string; admin: string; at: string; summary: string;
  changes: { field: string; from: string; to: string }[];
}

/** An archived (deleted) user — the full record is snapshotted so a Super Admin
 *  can RESTORE the account, plus who/why/when it was deleted. */
export interface DeletedUser {
  user: UserRecord;      // full snapshot (for restore)
  deletedAt: string;
  deletedBy: string;     // admin name
  deletedById?: string;
  reason: string;        // required deletion reason (stored permanently)
}

/** An archived (deleted) agency — the full record is snapshotted so a Super Admin
 *  can RESTORE it, plus who/why/when it was deleted. Mirrors DeletedUser. */
export interface DeletedAgency {
  agency: Agency;        // full snapshot (for restore)
  deletedAt: string;
  deletedBy: string;     // admin name
  deletedById?: string;
  reason?: string;       // optional deletion reason
}

// Admin "Common Profile Picture" campaign. During [startAt, endAt] the targeted users
// SEE `image` as their avatar everywhere — but this is a DISPLAY-TIME OVERRIDE ONLY: no
// user's stored `avatar` is ever changed, so on expiry/cancel everyone's real picture
// shows again automatically (nothing to restore, nothing can be lost). Targeting: empty
// agencyIds + empty userIds = ALL users; otherwise members of `agencyIds` ∪ `userIds`.
export interface AvatarCampaign {
  id: string;
  name: string;
  image: string;            // base64 data URL (JPG/PNG/WEBP)
  agencyIds?: string[];     // target = members of these agencies (empty + no userIds = everyone)
  userIds?: string[];       // target = these specific users (union with agencyIds)
  startAt: string;          // ISO — becomes active at this time
  endAt: string;            // ISO — reverts after this time
  lockUserAvatar?: boolean; // while active, targeted users can't change their own picture
  cancelledAt?: string;     // set when cancelled (stops immediately)
  createdBy?: string;
  createdAt: string;
}

// Archive of a deleted tournament (restorable) — its auto-created voice rooms are
// removed on delete, so a restore rebuilds the tournament but NOT the old rooms.
export interface DeletedTournament {
  tournament: TournamentRecord; // full snapshot (for restore)
  deletedAt: string;
  deletedBy: string;            // admin name
  deletedById?: string;
  reason?: string;
  roomsRemoved: number;         // how many orphan voice rooms were cleaned up on delete
}

// ---------- Agency System ----------
// An agency groups members under an owner. Gifts sent to its members split 3
// ways (receiver / agency / company) by the agency's commission %. The agency
// levels up (1–200) as its members receive more coins. Batch 1 = admin-managed.
/** Full lifecycle of an agency: awaiting review → active → (suspended by admin) /
 *  expired (membership lapsed) / rejected (request declined). */
export type AgencyStatus = "pending" | "active" | "suspended" | "expired" | "rejected";

/** A membership plan an agency can buy with wallet coins (admin-managed). Either a
 *  fixed DURATION (durationDays) or a fixed EXPIRY DATE (specificExpiry). */
export interface AgencyPlan {
  id: string;
  name: string;            // "1 Month", "6 Months", "Pro 1 Year", …
  durationDays: number;    // e.g. 30/90/180/365/730, or a custom number of days; ignored if specificExpiry set
  specificExpiry?: string; // ISO date — admin fixed expiry (overrides durationDays)
  priceCoins: number;      // coins required to buy this plan
  enabled: boolean;        // disabled plans can't be purchased
  createdAt: string;
}

/** A membership payment / receipt (coin purchase). Kept for full history — both
 *  successful activations and failed attempts. */
export interface AgencyPayment {
  id: string;              // receipt id (e.g. "RCPT-AG1001-…")
  agencyId: string;        // Agency.id
  agencyPublicId: string;  // "AG1001"
  agencyName: string;
  userId: string; userName: string;
  planId: string; planName: string;
  coins: number;
  status: "success" | "failed";
  reason?: string;         // failure reason (e.g. "Insufficient coins")
  startDate?: string; expiryDate?: string; // set on success
  at: string;
}

// Granular per-agency permission set (admin-controlled ON/OFF). Governs what an
// agency owner/manager may do across users, rooms and storage.
export interface AgencyPermissions {
  user: { create: boolean; edit: boolean; delete: boolean; suspend: boolean; view: boolean; resetPassword: boolean; verify: boolean };
  room: { create: boolean; edit: boolean; delete: boolean; close: boolean; reopen: boolean; assignHost: boolean; assignCoHost: boolean; removeHost: boolean; lockUnlock: boolean };
  storage: { view: boolean; deleteFiles: boolean; setLimits: boolean; sendWarnings: boolean; downloadFiles: boolean };
}
/** Sensible defaults: agencies can run their rooms + view/create users & storage,
 *  but the destructive/sensitive actions start OFF until an admin turns them on. */
export function defaultAgencyPermissions(): AgencyPermissions {
  return {
    user: { create: true, edit: true, delete: false, suspend: false, view: true, resetPassword: false, verify: false },
    room: { create: true, edit: true, delete: false, close: true, reopen: true, assignHost: true, assignCoHost: true, removeHost: true, lockUnlock: true },
    storage: { view: true, deleteFiles: false, setLimits: false, sendWarnings: true, downloadFiles: false },
  };
}

export interface Agency {
  id: string;            // internal id
  agencyId: string;      // public unique Agency ID (auto-generated, e.g. "AG1001")
  name: string;
  logo?: string;         // data URL
  cover?: string;        // data URL
  description?: string;
  type?: string;         // agency type / category (free text or preset)
  // Contact & location
  country?: string; state?: string; city?: string; address?: string;
  contactPerson?: string; mobile?: string; email?: string; website?: string;
  ownerId?: string;      // the Agency Owner (a platform user)
  ownerName?: string;
  status: AgencyStatus;
  rejectionReason?: string; // why a request was rejected (sent to the user)
  requestedBy?: string;  // the user who SUBMITTED the agency request (null = admin-created)
  // Membership (drives active/expired). Filled when a plan is purchased/assigned.
  planId?: string; planName?: string; planPriceCoins?: number;
  startDate?: string;    // membership start (ISO)
  expiryDate?: string;   // membership expiry (ISO)
  autoRenewal?: boolean; // auto-charge the owner to renew on expiry
  renewalReminderDays?: number; // notify the owner this many days before expiry (0 = off)
  membershipApproved?: boolean; // admin approved the request → owner may pay to activate
  updatedAt?: string;    // last updated (ISO)
  // Commission split (percentages, should total 100) applied to gifts to members.
  // trustPct = the Trust Wallet's cut (optional; default 0 for older agencies).
  commission: { receiverPct: number; agencyPct: number; companyPct: number; trustPct?: number };
  roomLimit: number;     // max rooms the agency may run
  memberLimit: number;   // max members
  features: { rooms: boolean; gifts: boolean; invites: boolean }; // enabled per agency
  permissions?: AgencyPermissions; // granular ON/OFF powers (user/room/storage management)
  memberIds: string[];   // member user ids (owner is also counted)
  managerIds?: string[]; // agency managers (can manage members + announce)
  coHostIds?: string[];  // agency co-hosts (a highlighted member role)
  pendingMemberIds?: string[]; // users who requested to join (await owner/manager approval)
  blockedMemberIds?: string[]; // users barred from requesting to join this agency (Block action)
  invites?: { userId: string; byName?: string; at: string }[]; // owner/manager invited these users (await accept/decline)
  memberSince?: Record<string, string>; // userId → join ISO date (for member-since + reports)
  announcements?: { id: string; text: string; at: string; byName: string }[]; // owner→members
  history?: { id: string; text: string; at: string }[]; // membership history log (join/leave/transfer/role)
  totalCoins: number;    // total coins RECEIVED by all members (legacy level metric)
  earnings: number;      // agency wallet balance (coins) from its commission share
  level: number;         // group level (legacy numeric; now derived from the tier order)
  levelTierId?: string;  // MANUAL level override — force this tier (empty/unset = auto by metric)
  createdAt: string;
  createdByName?: string;
}

// A configurable Agency LEVEL TIER (Bronze / Silver / Gold …). Admin-managed in
// Admin → Agency Levels. Each agency is placed on the highest tier whose
// `minValue` its metric (members / earnings / coins) meets — or a manual override.
export interface AgencyLevelTier {
  id: string;
  name: string;      // e.g. "Gold"
  badge: string;     // emoji shown beside the name, e.g. "🥇"
  color: string;     // hex accent for the badge, e.g. "#f59e0b"
  minValue: number;  // threshold on the chosen metric to reach this tier
  perk?: string;     // short free-text benefit note (shown to admins/agencies)
}

/** A member's request to SWITCH agencies. A user may belong to only one agency at
 *  a time, so moving to a different one needs ADMIN approval with a valid reason;
 *  on approval the user is transferred (removed from the old agency, added to the
 *  new one). Distinct from the owner-approved "request to join" flow. */
export interface AgencyChangeRequest {
  id: string;
  userId: string;
  userName: string;
  userPublicId?: string;
  fromAgencyId?: string;   // the user's current agency (undefined if none)
  fromAgencyName?: string;
  toAgencyId: string;      // the agency they want to move to
  toAgencyName: string;
  toAgencyPublicId?: string;
  reason: string;          // user's justification (required)
  status: "pending" | "approved" | "rejected" | "cancelled";
  createdAt: string;
  decidedAt?: string;
  decidedByName?: string;  // admin who approved/rejected/cancelled
  decisionReason?: string; // admin's note (shown to the user, esp. on reject)
}

/** One row per "request to join an agency" — the user-visible request HISTORY.
 *  Pending rows mirror `Agency.pendingMemberIds`; once the owner/admin decides,
 *  the row is settled (approved/rejected/blocked) so the user keeps a permanent
 *  record of every request and its outcome (client: "complete request history
 *  with Pending, Approved, and Rejected status"). */
export interface AgencyJoinRequest {
  id: string;
  userId: string;
  agencyId: string;          // internal agency id
  agencyPublicId?: string;   // "AG1001"
  agencyName: string;
  status: "pending" | "approved" | "rejected" | "blocked" | "cancelled";
  createdAt: string;
  decidedAt?: string;
  decidedByName?: string;    // owner/admin who settled it
}

/** An account CREATED BY AN AGENCY that (when "Agency User Approval" is ON) needs
 *  admin approval before it activates. Also serves as the audit trail — one row per
 *  agency-created account, whether it went through approval or was auto-activated. */
export interface AgencyUserApproval {
  id: string;
  userId: string;
  userName: string;       // the new account's full name
  username: string;
  agencyId: string;       // internal agency id
  agencyPublicId?: string;// e.g. AG1001
  agencyName: string;
  createdByName?: string;  // who at the agency created it (owner/manager)
  createdAt: string;       // account-created date/time
  status: "pending" | "approved" | "rejected";
  decidedById?: string;    // admin id
  decidedByName?: string;  // admin name (audit)
  decidedAt?: string;      // approval/rejection date/time (audit)
  note?: string;           // admin note / auto reason
}

/** A Paid Zone membership record — one per user. Created when a user requests to
 *  join (paying coins). An admin must approve before the user can enter the zone.
 *  `accountName` is the public display handle (shown in the directory); `realName`
 *  + the uploaded doc are verification details only the admin can see. */
export interface PaidZoneMember {
  userId: string;
  realName: string; // verification name (private — admin only)
  accountName: string; // public display handle (shown to other members)
  gender: "male" | "female" | "other";
  callInterest: "audio" | "video" | "both"; // preferred call type, shown by their name
  docUrl?: string; // uploaded verification file (served via /api/file/[name], admin only)
  docName?: string; // original filename
  status: "pending" | "approved" | "rejected" | "suspended";
  coinsPaid: number;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  note?: string;
  blockedUserIds?: string[]; // members this user blocked (hidden from each other)
  // Monthly membership lifecycle:
  renewAt?: string; // ISO date the next monthly renewal is due
  membershipActive?: boolean; // false = lapsed/inactive (renewal not paid) → features locked
  lastRenewedAt?: string; // last successful renewal (or approval) timestamp
  // ── SEPARATE Friend Zone identity (independent from the login account) ──
  // These are a private, second identity that ONLY other Friend Zone members can
  // see. Changing them never touches the login profile, and vice-versa. They are
  // never exposed to normal/public users anywhere. `fzVisible` is the member's own
  // ON/OFF switch: OFF hides them from the whole directory even while approved.
  fzId?: string;        // permanent Friend Zone ID number (e.g. "FZ1001")
  fzName?: string;      // Friend Zone display name (falls back to accountName)
  fzUsername?: string;  // Friend Zone username/handle
  fzAvatar?: string;    // Friend Zone profile picture (separate from login avatar)
  fzBio?: string;       // Friend Zone bio
  fzVisible?: boolean;  // member's visibility switch (default true = visible to members)
}

/** One Paid Zone activity, recorded for admin monitoring (join, approve, reject,
 *  suspend, restore, remove, block, call). Newest first, capped on write. */
export interface PaidZoneActivity {
  id: string;
  at: string;
  type: "request" | "approve" | "reject" | "suspend" | "restore" | "remove" | "block" | "unblock" | "call" | "settings";
  actorId: string; // who did it (user or admin)
  actorName: string;
  targetId?: string; // the affected member, if any
  targetName?: string;
  detail?: string;
}

/** A Paid Zone 1:1 call — created when a call starts. Coins are billed per minute
 *  to the caller; auto-disconnect when their balance can't cover the next minute.
 *  Active sessions = status "active"; "ended" sessions are the call records. */
/** A Refer-a-friend record: one per user who signed up via someone's invite.
 *  Admin can approve/reject/block the reward; fraud flags are auto-detected. */
export interface ReferralRecord {
  id: string;
  referrerId: string;
  referrerName: string;
  referredId: string;
  referredName: string;
  code: string; // the invite code / username used
  reward: number; // coins snapshot at signup time
  status: "pending" | "approved" | "rejected" | "blocked";
  flags: string[]; // auto fraud checks: "self_ip" | "duplicate_ip" | "already_referred"
  ip?: string; // signup IP (duplicate detection)
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  note?: string; // reason for reject/block
}

/** An admin-managed media library item. Hosts/co-hosts pick from these to play
 *  in their room; only the admin can add/remove/edit them. */
/** One company-profit coin event (the coins the COMPANY earned). Immutable
 *  ledger — appended automatically wherever the company takes a commission/fee. */
export type CompanyProfitType = "gift" | "call" | "audio_call" | "video_call" | "game" | "recharge" | "withdrawal_fee" | "commission" | "room" | "other";

// A withdrawal/payout recorded against a profit pool (company / agency / trust).
// Deducts from that pool and is a permanent audit record. User profit is withdrawn
// through the normal Lotus/coin withdrawal flow (this is for the other 3 pools).
export interface ProfitPayout {
  id: string;            // "pp_…"
  at: string;
  pool: "company" | "agency" | "trust";
  agencyId?: string;     // set when pool === "agency"
  agencyName?: string;
  amount: number;        // amount paid out (coins/Lotus units)
  method: string;        // Bank / UPI / STC Pay / Manual…
  details?: string;      // account / reference
  note?: string;
  by: string;            // admin who recorded it
  balanceAfter: number;  // pool balance after this payout
}
export interface CompanyProfitEntry {
  id: string; // "cp_…" — the reference / transaction id
  at: string; // ISO date-time
  userId: string; // the user whose activity generated the profit ("" if none)
  userName: string;
  type: CompanyProfitType;
  coins: number; // coins received by the company
  ref?: string; // related id (gift id, call session id, …)
  note?: string; // human-readable detail
}

/** Agent (Agency) profit — the AGENCY's commission share of a gift to one of its
 *  members. One entry per commission event; feeds the admin "Agent Profit" report. */
export interface AgencyProfitEntry {
  id: string;          // "ap_…"
  at: string;
  agencyId: string;    // internal agency id
  agencyPublicId: string; // "AG1001"
  agencyName: string;
  memberId: string;    // the agency member who received the gift
  memberName: string;
  memberPublicId?: string; // the member's public User ID (e.g. 100008) — shown next to the name
  senderName: string;  // who sent the gift
  senderId?: string;   // the sender's internal id (persisted from v294)
  senderPublicId?: string; // the sender's public User ID
  coins: number;       // coins credited to the agency
  ref?: string;        // gift id
  note?: string;
}

/** Trust Wallet / Trust Fund ledger — the admin-set % (default 5) of every Lotus
 *  distribution flows in here; the admin spends it (debits) on reward campaigns,
 *  festival bonuses, lucky-spin prizes, emergency compensation, etc. */
export interface TrustWalletEntry {
  id: string;             // "tw_…"
  at: string;             // ISO date-time
  type: "credit" | "debit";
  lotus: number;          // Lotus in (credit) or out (debit)
  source: string;         // "gift" | "call" | "referral" | "transfer" | "lucky_spin" | "campaign" | …
  userId?: string;        // related user (recipient of a payout, or "" for pooled credits)
  userName?: string;
  note?: string;
}

/** Secure audit trail entry: an admin deleted activity-log records. Never auto-purged. */
export interface LogDeletionEntry {
  id: string; at: string; by: string;
  module: string; moduleLabel: string;
  scope: "single" | "selected" | "all" | "cleanup" | "filtered";
  count: number; note?: string;
}

/** Audit trail of every change to the Share Distribution percentages. */
export interface ShareChangeEntry {
  id: string; at: string; by: string;
  before: { user: number; agency: number; company: number; trust: number; trustEnabled: boolean; gst: number };
  after: { user: number; agency: number; company: number; trust: number; trustEnabled: boolean; gst: number };
}

export interface MediaLibraryItem {
  id: string;
  kind: "audio" | "video" | "youtube" | "image";
  name: string;
  src: string; // /api/media/<file> for uploads, or a URL for youtube/link
  fileName?: string; // stored upload filename (so delete can remove the file)
  category?: string;
  addedBy?: string;
  addedAt: string;
  // Media metadata captured at upload (so the picker can show duration / size /
  // a real video thumbnail without probing every file). Optional — older items
  // simply omit them and the picker computes them on the fly.
  durationSec?: number; // length in seconds (audio + video)
  sizeBytes?: number;   // uploaded file size
  thumb?: string;       // small base64 JPEG frame for a video (data URL)
}

/** One sticker in the GLOBAL admin-managed library (shown in every room's sticker
 *  picker). Distinct from RoomSticker (per-room) — this one carries category,
 *  enable/disable, and usage stats so admins can curate one shared set. */
export interface GlobalSticker {
  id: string;          // "gstk_xxxxxxxx"
  url: string;         // /api/media/<file> (public, cacheable route)
  fileName?: string;   // stored upload filename, so delete removes the file
  name: string;        // admin label
  category: string;    // "Funny" | "Love" | "Emoji" | "Greetings" | "Festival" | custom
  enabled: boolean;    // disabled = hidden from all rooms but kept for stats
  usageCount: number;  // times sent into any group chat
  addedBy?: string;    // admin fullName
  at: string;          // ISO createdAt
}

/** Which media TYPE a pricing/enable rule applies to (youtube counts as video). */
export type MediaType = "audio" | "video" | "image";

export interface CallSession {
  id: string;
  roomId: string;
  callerId: string;
  callerName: string; // public account name
  receiverId: string;
  receiverName: string;
  type: "audio" | "video";
  perMin: number; // coins/min snapshot at start
  startedAt: string; // when BILLING starts (reset to the moment the call is answered)
  ringingExpiresAt?: string; // a "ringing" call auto-cancels (no answer) after this
  lastTickAt: string; // heartbeat — stale active sessions are reaped to "ended"
  minutesBilled: number;
  coinsDeducted: number;
  receiverEarned?: number; // total coins credited to the receiver over this call
  companyEarned?: number; // total coins kept as company profit over this call
  trustEarned?: number; // total credited to the Trust Wallet from this call (Trust Profit)
  status: "ringing" | "active" | "ended"; // ringing = waiting for the receiver to accept
  endedAt?: string;
  endReason?: "hangup" | "no_coins" | "admin" | "timeout" | "rejected" | "missed" | "cancelled";
  recorded?: boolean; // whether recording was on for this call (media capture wired separately)
}

/** A gift sent inside a room/game — broadcast so all clients animate it on the
 *  receiver's avatar. Pruned by age on read (only the last few seconds matter). */
export interface RoomGift {
  id: string;
  roomId: string;
  toName: string; // recipient full name (lowercased match handled on read)
  toFirst: string; // recipient first name (avatars are often labelled by first name)
  toId: string;
  fromName: string;
  emoji: string;
  name: string;
  at: number; // epoch ms
}

/** A paid-feature request that needs admin approval. Coins are charged when the
 *  request is submitted and refunded if it is rejected. */
export interface FeatureRequest {
  id: string;
  type: "room_name" | "video" | "cohost" | "public_room" | "group_deletion";
  userId: string;
  userName: string;
  roomId: string; // "" for public_room (the room doesn't exist yet)
  roomName: string; // the room's current name, or the requested new public-room name
  payload?: string; // requested new name (room_name) or "name|||category" (public_room)
  coinCost: number; // coins charged for this request
  status: "pending" | "approved" | "rejected";
  at: string; // ISO submitted
  decidedAt?: string; // ISO decided
  decidedBy?: string; // admin name
  note?: string; // optional admin note / reason
}

/** A finished match — one record per completed game (incl. Play-Again rounds).
 *  Drives the "Games Played" count, winner history, and per-user game records. */
export interface GameResult {
  id: string;
  game: string; // "Ludo" | "Chess" | "Snake & Ladder"
  roomId: string;
  roomName: string;
  playerIds: string[]; // registered players (may be fewer than playerNames)
  playerNames: string[];
  winnerId?: string;
  winnerName?: string;
  at: string; // ISO finished
  moves?: GameMove[]; // full move-by-move history of this match (Ludo)
}

/** A coin-purchase request paid via QR/UPI, awaiting admin verification. Coins
 *  (incl. bonus) are credited ONLY when an admin approves it. */
export interface CoinPurchaseRequest {
  id: string;
  userId: string;
  userName: string;
  userIdNumber?: string; // the permanent member ID the user entered (for admin cross-check)
  packageId: string;
  packageName: string;
  coins: number;
  bonus: number;
  price: number;          // TOTAL the user paid (package price + tax + service charge)
  // Breakdown of `price`, snapshotted at purchase time so a later rate change
  // never rewrites history. All optional — older records simply have none.
  basePrice?: number;     // the package price before extras
  tax?: number;
  taxLabel?: string;
  serviceCharge?: number;
  serviceLabel?: string;
  currency: string;
  screenshotUrl?: string; // /api/file/<name> of the uploaded payment proof
  screenshotName?: string;
  paymentRef?: string; // optional UTR / reference the user typed
  status: "pending" | "approved" | "rejected";
  at: string;
  decidedAt?: string;
  decidedBy?: string;
  note?: string;
}

/** A 1-on-1 direct message between two users. */
export interface DirectMessage {
  id: string;
  fromId: string;
  toId: string;
  text: string;
  at: string; // ISO timestamp
  read: boolean; // read by the recipient (they opened the chat)
  delivered?: boolean; // reached the recipient's device (they were online / synced messages)
  deletedFor?: string[]; // user ids who deleted this just for themselves ("delete for me")
  deleted?: boolean; // deleted for EVERYONE (by the sender) — shown as a removed placeholder
  deletedAt?: string; // when it was deleted-for-everyone
  // ---- Attachments (private chat rich media) ----
  // `text` stays the caption for media messages, so chat history and admin review
  // keep working unchanged.
  // ⚠ Any field added here must ALSO be added to the thread projection in
  // src/app/api/messages/[userId]/route.ts — that route whitelists fields, so
  // anything missing there silently never reaches the app.
  type?: "text" | "image" | "video" | "audio" | "file" | "sticker";
  mediaUrl?: string;    // /api/file/<name> (private) or /api/media/<name> (stickers)
  mediaName?: string;   // original filename, shown for documents
  mediaMime?: string;
  mediaSize?: number;   // bytes
  duration?: number;    // seconds, for voice notes
  replyToId?: string;   // the message this one replies to
  replyToText?: string; // snapshot, so the quote survives the original being deleted
  replyToFrom?: string; // sender name of the quoted message
  // ---- Message management (v395) ----
  reactions?: Record<string, string>; // userId → emoji (one reaction per user)
  starredBy?: string[];  // user ids who starred/favourited this message (private per user)
  pinned?: boolean;      // pinned in the conversation (either party)
  pinnedAt?: string;
  editedAt?: string;     // set when the sender edits the text (within the allowed window)
  forwarded?: boolean;   // this message was forwarded from another chat
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(DATA_DIR, "db.json");

let cache: DBShape | null = null;
/** mtime of db.json when THIS module instance loaded it — see getDB()'s stale-cache
 *  guard. 0 = never loaded from disk. */
let loadedMtimeMs = 0;
let writing: Promise<void> = Promise.resolve();
// Debounced-persist state (see persist() below).
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushDueAt = 0;
let dirty = false;
const PERSIST_DEBOUNCE_MS = 700;
// Writes that are high-frequency AND replaceable — a live game board, a
// spectator heartbeat — wait longer. Writing the file is not free (it is one
// large serialise, and it blocks everything else while it happens), so pulling
// a flush forward for data that the players' own devices re-send within seconds
// is what made the game stutter during play.
const PERSIST_LOW_DEBOUNCE_MS = 8000;

function empty(): DBShape {
  return { users: [], otps: [], friends: [], follows: [], notifications: [], rooms: [] };
}

// Keep the in-memory "which avatar campaign is active for whom" cache fresh. Runs on
// every getDB() (cheap: filters a handful of campaigns by the current time) so that
// avatarUrl() can synchronously override targeted users' pictures + bust their cache.
// Time-based, so it must re-evaluate each call (a scheduled campaign flips on/off). It
// NEVER throws (a bad campaign can't break the DB).
function refreshAvatarCampaignCache(db: DBShape): void {
  try {
    const now = Date.now();
    const active = (db.avatarCampaigns ?? []).filter((c) => !!c.image && campaignLive(c, now));
    setActiveAvatarCampaigns(active.map((c) => {
      const noAg = !c.agencyIds || c.agencyIds.length === 0;
      const noU = !c.userIds || c.userIds.length === 0;
      // Expand agency targets → member user-ids, so avatarUrl (which only has user.id)
      // targets them correctly without needing a (non-existent) user.agencyId field.
      const userIds = new Set(c.userIds ?? []);
      if (!noAg) {
        const agset = new Set(c.agencyIds);
        for (const ag of db.agencies ?? []) if (agset.has(ag.id)) for (const m of ag.memberIds ?? []) userIds.add(m);
      }
      return { tag: avatarCampaignTag(c.id, c.image), all: noAg && noU, userIds };
    }));
  } catch { /* never break getDB */ }
}

/** THE single targeting rule (used everywhere for consistency): empty agencyIds + empty
 *  userIds = ALL users; otherwise the listed users, PLUS every member of the listed
 *  agencies (a user's agency link is Agency.memberIds — there is no user.agencyId). */
export function campaignTargetsUser(db: DBShape, c: AvatarCampaign, userId: string): boolean {
  const noAg = !c.agencyIds || c.agencyIds.length === 0;
  const noU = !c.userIds || c.userIds.length === 0;
  if (noAg && noU) return true; // all users
  if (!noU && c.userIds!.includes(userId)) return true;
  if (!noAg) {
    for (const ag of db.agencies ?? []) {
      if (c.agencyIds!.includes(ag.id) && (ag.memberIds ?? []).includes(userId)) return true;
    }
  }
  return false;
}

function campaignLive(c: AvatarCampaign, now: number): boolean {
  return !c.cancelledAt && Date.parse(c.startAt) <= now && now <= Date.parse(c.endAt);
}

/** The campaign image a user should currently SEE as their avatar, or null. Pure
 *  read (dates + targeting); used by /api/avatar to serve the override bytes. */
export function activeAvatarImageFor(db: DBShape, userId: string): string | null {
  const now = Date.now();
  for (const c of db.avatarCampaigns ?? []) {
    if (c.image && campaignLive(c, now) && campaignTargetsUser(db, c, userId)) return c.image;
  }
  return null;
}

/** True when a LOCK-enabled campaign is currently active for this user (they may not
 *  change their own picture while it runs). */
export function avatarLockedFor(db: DBShape, userId: string): boolean {
  const now = Date.now();
  for (const c of db.avatarCampaigns ?? []) {
    if (c.lockUserAvatar && campaignLive(c, now) && campaignTargetsUser(db, c, userId)) return true;
  }
  return false;
}

/**
 * Read the saved config STRAIGHT FROM DISK, bypassing every in-memory cache.
 *
 * Server-rendered public pages (the /legal/* documents) must always show what the
 * admin most recently saved. They live in a different Next route bundle from the
 * admin-config route, and each bundle holds its own instance of this module with
 * its own cache — so a page could sit on a stale copy and keep serving old text
 * until the process restarted. Reading the file here removes any doubt: it is one
 * small file read on a page that is viewed rarely, and it is always current.
 */
export async function readSavedConfigFromDisk(): Promise<AppConfig | null> {
  // THIS USED TO READ AND PARSE THE WHOLE DATABASE ON EVERY CALL.
  //
  // It existed because each route bundle holds its own copy of this module with
  // its own cache, so a public page could serve a stale config. It solved that by
  // going straight to disk — but it did so by reading all 45 MB and running
  // JSON.parse over it just to pull out one small object, with no caching at all.
  // Every view of a legal or guide page (crawlers included) therefore allocated a
  // 45 MB string plus a complete object graph and threw it away. A handful of
  // those at once is enough to exhaust the heap, and when node exhausts its heap
  // it does not slow down — it dies, pm2 restarts it, and every live game freezes
  // for the seconds that takes.
  //
  // getDB() now carries its own staleness guard: it stats the file and re-reads
  // when disk is newer than the copy it holds, which is exactly the guarantee
  // this function was written to provide. So it can simply use it — same
  // freshness, no duplicate parse, and the cache is shared instead of bypassed.
  try {
    const db = await getDB();
    return db.config ?? null;
  } catch {
    return null;
  }
}

export async function getDB(): Promise<DBShape> {
  // STALE-CACHE GUARD.
  //
  // Next bundles this module into SEVERAL route chunks, so a running server holds
  // more than one instance of it — each with its own `cache`. A write through one
  // route (e.g. Admin → Policies, which lives in the admin-config route's bundle)
  // updated that copy and the file on disk, but a server-rendered page in a
  // different bundle (e.g. /legal/contact) kept serving its own older copy until
  // the process restarted. Symptom: "I saved it in the admin panel and the public
  // page still shows the old text."
  //
  // So: before trusting the cache, check whether the file on disk has been written
  // more recently than the copy we hold, and re-read if it has. One stat() per
  // call, and only THIS instance's writes are trusted without it.
  if (cache) {
    let fresh = true;
    try {
      const st = await fs.stat(DB_PATH);
      const mtime = st.mtimeMs;
      if (loadedMtimeMs !== 0 && mtime > loadedMtimeMs + 1) fresh = false;
      // Never discard unflushed local changes — that would lose a write.
      if (dirty) fresh = true;
    } catch { /* no file yet — keep what we have */ }
    if (fresh) { refreshAvatarCampaignCache(cache); return cache; }
    // Fall through and re-read the newer file.
    //
    // NOTE: this deliberately does NOT clear `cache` first. It used to, and that
    // was a live crash: `cache` is module-level, the re-read below is `await`ed,
    // and the long migration tail after it awaits `persist()` many times. Every
    // one of those awaits lets another request run — and that request would find
    // `cache` set to null and hand it straight to its caller, producing
    // "Cannot read properties of null (reading 'users')" (39 times in the live
    // log, from /api/avatar and others). During a match db.json is rewritten
    // every second or so, so this path runs constantly and the race was easy to
    // hit. Keeping the previous copy in place means a concurrent caller gets the
    // slightly older database — correct data, one poll behind — instead of null,
    // and it also stops several requests each parsing the whole file at once.
  }
  // ==========================================================================
  // READING THE DATABASE — and the rule that protects it.
  //
  // THE INCIDENT THIS PREVENTS (2026-08-29): this used to be
  //     try  { cache = JSON.parse(await fs.readFile(DB_PATH)) }
  //     catch { cache = empty() }        // ← ANY failure produced an EMPTY db
  // followed by "no users? then seed and persist" — which WROTE THE SEED OVER
  // THE REAL FILE. One transient read or parse failure on the 40 MB file was
  // therefore enough to replace 226 accounts, 58 rooms and 2,584 transactions
  // with three demo accounts, silently, with nothing in the log.
  //
  // The rule now: a file that EXISTS but cannot be read or parsed is a fault to
  // shout about, never a reason to start again from nothing. We refuse to
  // continue rather than risk overwriting real data we simply failed to read.
  // ==========================================================================
  let fileExists = true;
  try { await fs.stat(DB_PATH); } catch { fileExists = false; }

  try {
    const raw = await fs.readFile(DB_PATH, "utf8");
    const parsed = JSON.parse(raw) as DBShape;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.users)) {
      throw new Error("database file is not a valid database (no users array)");
    }
    cache = parsed;
    try { loadedMtimeMs = (await fs.stat(DB_PATH)).mtimeMs; } catch { loadedMtimeMs = Date.now(); }
  } catch (err) {
    if (fileExists) {
      // The file is THERE and we could not read it. Never continue: an empty
      // cache here would be persisted straight over it. Fail loudly instead so
      // the process restarts and the next attempt can succeed, leaving the real
      // data untouched on disk.
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[db] FATAL: ${DB_PATH} exists but could not be read/parsed — refusing to start from an empty database ` +
        `(that would overwrite real data). Fix or restore the file. Cause: ${msg}`,
      );
      throw new Error(`Database unreadable — refusing to overwrite it. Cause: ${msg}`);
    }
    // Genuinely no file yet: a brand-new install. Starting empty is correct.
    console.warn(`[db] no database at ${DB_PATH} — starting a new one (first run).`);
    cache = empty();
    loadedMtimeMs = Date.now();
  }
  // Migrate older saves that predate newer collections
  if (!cache.rooms) cache.rooms = [];
  // SEED ONLY A GENUINELY NEW DATABASE. The old condition also fired when
  // `users` was merely EMPTY, which is what let a failed read turn into a
  // seed-over-real-data. A database that has ever been seeded is never seeded
  // again, whatever its contents.
  if (!cache.seededAt && !fileExists) {
    const { seedDatabase } = await import("./seed");
    cache = seedDatabase(cache);
    await persist();
  } else if (!cache.seededAt && fileExists) {
    // An existing file with no seed marker — an older database. Mark it seeded
    // so this branch can never fire for it again, but DO NOT add demo data.
    cache.seededAt = new Date().toISOString();
  }
  // Ensure the admin account exists even on databases seeded before it was added.
  if (!cache.users.some((u) => u.role === "admin")) {
    const { ensureAdmin } = await import("./seed");
    cache = ensureAdmin(cache);
    await persist();
  }
  // Seed platform config on databases that predate it.
  if (!cache.config) {
    cache.config = defaultConfig();
    await persist();
  }
  // REPAIR: avatars/covers that hold one of our OWN /api/avatar links instead of
  // image bytes.
  //
  // /api/avatar/<id> serves the picture by READING this field, so a record whose
  // avatar is "/api/avatar/<id>?v=…" points at itself: the endpoint finds a URL
  // where the image should be and 404s forever, and the member's photo silently
  // disappears. It was written there by the profile-edit save, which sent the
  // link the server had given it straight back (both ends now refuse to do that).
  //
  // The original bytes are unrecoverable, so the only honest repair is to clear
  // the field — the UI then falls back to clean initials and the member can
  // upload a new picture, instead of being stuck with a broken image forever.
  {
    const selfLink = /^\/api\/avatar\//i;
    let repaired = 0;
    for (const u of cache.users ?? []) {
      if (typeof u.avatar === "string" && selfLink.test(u.avatar.trim())) { u.avatar = ""; repaired++; }
      if (typeof u.cover === "string" && selfLink.test(u.cover.trim())) { u.cover = ""; repaired++; }
      if (typeof u.pendingAvatar === "string" && selfLink.test(u.pendingAvatar.trim())) { u.pendingAvatar = undefined; repaired++; }
    }
    if (repaired > 0) {
      console.info(`[db] repaired ${repaired} self-referencing avatar/cover field(s) — those members now show initials until they upload again`);
      await persist();
    }
  }
  // Migrate the old { ludo, chess, snake } games object to the scalable array.
  if (cache.config.games && !Array.isArray(cache.config.games)) {
    const old = cache.config.games as unknown as Record<string, boolean>;
    cache.config.games = defaultConfig().games.map((g) => ({ ...g, enabled: old?.[g.id] ?? true }));
    await persist();
  }
  // Backfill the `icon` key for games saved with the old emoji field.
  if (Array.isArray(cache.config.games) && cache.config.games.some((g) => !g.icon)) {
    const idIcon: Record<string, string> = { ludo: "dice", chess: "crown", snake: "joystick" };
    cache.config.games = cache.config.games.map((g) => ({ ...g, icon: g.icon || idIcon[g.id] || "gamepad" }));
    await persist();
  }
  // Backfill spectator flag (default on) for games saved before it existed.
  if (Array.isArray(cache.config.games) && cache.config.games.some((g) => g.spectator === undefined)) {
    cache.config.games = cache.config.games.map((g) => ({ ...g, spectator: g.spectator ?? true }));
    await persist();
  }
  // Seed the default legal policies on databases saved before they existed.
  if (!Array.isArray(cache.config.policies) || cache.config.policies.length === 0) {
    cache.config.policies = defaultPolicies();
    await persist();
  }
  // Seed feature pricing + co-host limit on databases saved before they existed.
  if (!cache.config.featurePricing || cache.config.coHostLimit === undefined || cache.config.featurePricing.coHostSlot === undefined) {
    cache.config.featurePricing = { roomNameChange: 500, videoUnlock: 1000, ...(cache.config.featurePricing ?? {}) };
    if (cache.config.featurePricing.coHostSlot === undefined) cache.config.featurePricing.coHostSlot = 500;
    cache.config.coHostLimit = cache.config.coHostLimit ?? 3;
    await persist();
  }
  // Backfill per-game coin cost (Ludo free, others 50) for games saved before it.
  if (Array.isArray(cache.config.games) && cache.config.games.some((g) => g.coinCost === undefined)) {
    cache.config.games = cache.config.games.map((g) => ({ ...g, coinCost: g.coinCost ?? (g.id === "ludo" ? 0 : 50) }));
    await persist();
  }
  // Assign a permanent member ID number to every user that doesn't have one,
  // and advance the counter past them. IDs are never reused or changed.
  if (cache.nextMemberId === undefined || cache.users.some((u) => !u.publicId)) {
    if (cache.nextMemberId === undefined) cache.nextMemberId = 100001;
    for (const u of cache.users) {
      if (!u.publicId) { u.publicId = String(cache.nextMemberId); cache.nextMemberId += 1; }
    }
    await persist();
  }
  // Backfill config keys added after the first seed.
  if (!cache.config.ads) {
    cache.config.ads = defaultConfig().ads;
    await persist();
  }
  if (!cache.config.coinPackages) {
    cache.config.coinPackages = defaultConfig().coinPackages;
    cache.config.coinOffers = defaultConfig().coinOffers;
    await persist();
  }
  if (!cache.config.giftCatalog) {
    cache.config.giftCatalog = defaultConfig().giftCatalog;
    await persist();
  }
  if (!cache.config.paymentGateway) {
    cache.config.paymentGateway = defaultConfig().paymentGateway;
    await persist();
  }
  if (cache.config.paymentGateway && !cache.config.paymentGateway.methods) {
    cache.config.paymentGateway.methods = defaultConfig().paymentGateway!.methods;
    await persist();
  }
  // Seed a few sample support tickets the first time. (Skipped in production.)
  if (!cache.supportTickets && process.env.LOTUS_DEMO === "1") {
    cache.supportTickets = [
      { id: "t1", userName: "Priya Sharma", subject: "Can't join a voice room", message: "It says room is full but it shows empty seats.", status: "open", createdAt: "2026-06-10T09:00:00.000Z" },
      { id: "t2", userName: "Arjun Mehta", subject: "Coins not credited", message: "I won a Ludo match but didn't get my reward coins.", status: "in_progress", createdAt: "2026-06-11T14:20:00.000Z" },
      { id: "t3", userName: "Sara Khan", subject: "Great app!", message: "Loving the new games. Please add Carrom too 🙏", status: "resolved", reply: "Thank you! Carrom is on our roadmap.", createdAt: "2026-06-09T18:05:00.000Z" },
    ];
    await persist();
  }
  if (!cache.adminLogs) {
    cache.adminLogs = [];
    await persist();
  }
  if (!cache.transactions) {
    cache.transactions = [];
    await persist();
  }
  if (!cache.gameSessions) {
    cache.gameSessions = [];
    await persist();
  }
  // Seed a few tournaments the first time (uses real seeded users). (Skipped in production.)
  if (!cache.tournaments && process.env.LOTUS_DEMO === "1") {
    const pick = cache.users.filter((u) => u.role !== "admin").slice(0, 6);
    const ids = pick.map((u) => u.id);
    cache.tournaments = [
      {
        id: "t1", title: "Sunday Ludo Showdown", game: "Ludo", prize: 5000, entry: 100, capacity: 16,
        status: "live", regOpen: false, createdAt: "2026-06-10T00:00:00.000Z",
        joinedUserIds: ids.slice(0, 4),
        requests: ids.slice(0, 4).map((id, i) => ({ userId: id, userName: pick[i].fullName, status: "approved" as const, at: "2026-06-09T00:00:00.000Z", decidedAt: "2026-06-09T01:00:00.000Z" })),
      },
      {
        id: "t2", title: "Grandmaster Chess Cup", game: "Chess", prize: 10000, entry: 250, capacity: 8,
        status: "upcoming", regOpen: true, createdAt: "2026-06-12T00:00:00.000Z",
        joinedUserIds: ids.slice(0, 2),
        requests: [
          ...ids.slice(0, 2).map((id, i) => ({ userId: id, userName: pick[i].fullName, status: "approved" as const, at: "2026-06-11T00:00:00.000Z", decidedAt: "2026-06-11T02:00:00.000Z" })),
          ...(pick[4] ? [{ userId: ids[4], userName: pick[4].fullName, status: "pending" as const, at: "2026-06-12T09:00:00.000Z" }] : []),
        ],
      },
    ];
    await persist();
  }
  refreshAvatarCampaignCache(cache);
  void autoSnapshot(cache);
  return cache;
}

/**
 * AUTOMATIC DAILY SNAPSHOT.
 *
 * On 2026-08-29 the database was lost and the only restore points were the
 * backups taken by deployments — the newest was 39 hours old, purely by luck.
 * A platform holding real accounts and balances must not depend on someone
 * happening to deploy.
 *
 * Takes at most one snapshot every 12 hours, keeps the most recent 14, and can
 * never throw: a backup failing must never stop the app serving.
 */
let lastSnapshotCheck = 0;
async function autoSnapshot(db: DBShape): Promise<void> {
  try {
    const TWELVE_HOURS = 12 * 60 * 60 * 1000;
    if (Date.now() - lastSnapshotCheck < TWELVE_HOURS) return;
    lastSnapshotCheck = Date.now();
    // Never snapshot something that isn't worth keeping.
    if (!Array.isArray(db.users) || db.users.length < 5) return;

    const dir = `${DATA_DIR}/snapshots`;
    await fs.mkdir(dir, { recursive: true });

    const existing = (await fs.readdir(dir)).filter((f) => f.startsWith("db-") && f.endsWith(".json")).sort();
    const newest = existing[existing.length - 1];
    if (newest) {
      const age = Date.now() - (await fs.stat(`${dir}/${newest}`)).mtimeMs;
      if (age < TWELVE_HOURS) return; // recent enough
    }

    const name = `db-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`;
    const tmp = `${dir}/.${name}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(db), "utf8");
    await fs.rename(tmp, `${dir}/${name}`);
    await writeSnapMeta(dir, name, db);

    // Keep the most recent 14, delete the rest.
    const all = (await fs.readdir(dir)).filter((f) => f.startsWith("db-") && f.endsWith(".json")).sort();
    for (const old of all.slice(0, Math.max(0, all.length - 14))) {
      await fs.rm(`${dir}/${old}`).catch(() => {});
      await fs.rm(`${dir}/${old}.meta`).catch(() => {});
    }
    console.log(`[db] snapshot saved: ${name} (${db.users.length} accounts)`);
  } catch {
    /* a snapshot must never break the app */
  }
}

/** One restore point the admin can go back to. */
export interface DbSnapshot {
  name: string;      // file name — also the id used to restore
  at: string;        // when it was taken (ISO)
  sizeBytes: number;
  users: number;
  rooms: number;
  transactions: number;
  source: "automatic" | "before-restore" | "deployment";
}

/** Counts written next to each snapshot when it is taken.
 *  A snapshot is tens of megabytes; re-parsing all fourteen of them every time
 *  the Backup & Restore page loads would stall the server, so the counts live in
 *  a tiny sidecar file and the big one is only ever parsed to restore it. */
interface SnapMeta { users: number; rooms: number; transactions: number }

async function writeSnapMeta(dir: string, name: string, db: DBShape): Promise<void> {
  const meta: SnapMeta = {
    users: Array.isArray(db.users) ? db.users.length : 0,
    rooms: Array.isArray(db.rooms) ? db.rooms.length : 0,
    transactions: Array.isArray(db.transactions) ? db.transactions.length : 0,
  };
  await fs.writeFile(`${dir}/${name}.meta`, JSON.stringify(meta), "utf8").catch(() => {});
}

// Counts for a snapshot taken before sidecars existed (or whose sidecar was
// lost). Parsed once, then written to a sidecar so it never happens again.
async function backfillSnapMeta(dir: string, name: string): Promise<SnapMeta> {
  try {
    const parsed = JSON.parse(await fs.readFile(`${dir}/${name}`, "utf8")) as DBShape;
    const meta: SnapMeta = {
      users: Array.isArray(parsed.users) ? parsed.users.length : 0,
      rooms: Array.isArray(parsed.rooms) ? parsed.rooms.length : 0,
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions.length : 0,
    };
    await fs.writeFile(`${dir}/${name}.meta`, JSON.stringify(meta), "utf8").catch(() => {});
    return meta;
  } catch {
    return { users: 0, rooms: 0, transactions: 0 };
  }
}

/** Every restore point, newest first — the app's own 12-hourly snapshots plus
 *  the safety copies taken immediately before a previous restore. */
export async function listSnapshots(): Promise<DbSnapshot[]> {
  const dir = `${DATA_DIR}/snapshots`;
  let names: string[] = [];
  try { names = (await fs.readdir(dir)).filter((f) => f.endsWith(".json") && !f.startsWith(".")); } catch { return []; }
  const out: DbSnapshot[] = [];
  for (const name of names) {
    try {
      const p = `${dir}/${name}`;
      const st = await fs.stat(p);
      let meta: SnapMeta | null = null;
      try { meta = JSON.parse(await fs.readFile(`${p}.meta`, "utf8")) as SnapMeta; } catch { meta = null; }
      if (!meta || typeof meta.users !== "number") meta = await backfillSnapMeta(dir, name);
      out.push({
        name,
        at: st.mtime.toISOString(),
        sizeBytes: st.size,
        users: meta.users,
        rooms: meta.rooms,
        transactions: meta.transactions,
        source: name.startsWith("pre-restore-") ? "before-restore" : "automatic",
      });
    } catch { /* skip an unreadable snapshot rather than failing the whole list */ }
  }
  return out.sort((a, b) => (a.at < b.at ? 1 : -1));
}

/**
 * GO BACK TO A RESTORE POINT.
 *
 * Deliberately careful, because this replaces everything:
 *   1. the chosen snapshot is verified as readable and non-trivial FIRST;
 *   2. the CURRENT database is snapshotted as `pre-restore-…` so a restore can
 *      itself be undone;
 *   3. only then is it swapped in.
 * Nothing is deleted at any point.
 */
export async function restoreSnapshot(name: string): Promise<{ ok: boolean; error?: string; users?: number; rooms?: number; undo?: string }> {
  if (!/^[A-Za-z0-9._-]+\.json$/.test(name)) return { ok: false, error: "Invalid restore point." };
  const dir = `${DATA_DIR}/snapshots`;
  const src = `${dir}/${name}`;

  let restored: DBShape;
  try {
    restored = JSON.parse(await fs.readFile(src, "utf8")) as DBShape;
  } catch {
    return { ok: false, error: "That restore point could not be read. Nothing was changed." };
  }
  if (!restored || !Array.isArray(restored.users) || restored.users.length < 2) {
    return { ok: false, error: "That restore point looks empty or damaged. Nothing was changed." };
  }

  // Safety copy of what we are about to replace, so this is reversible.
  let undo = "";
  try {
    if (cache) {
      undo = `pre-restore-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`;
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(`${dir}/${undo}`, JSON.stringify(cache), "utf8");
      await writeSnapMeta(dir, undo, cache);
    }
  } catch { /* a failed safety copy must not block a recovery the admin needs */ }

  cache = restored;
  loadedMtimeMs = Date.now();
  dirty = true;
  // A restore is the ONE case where replacing many accounts with fewer is
  // intentional, so the anti-wipe guard is stood down for this single write —
  // the admin chose this restore point, and the safety copy above makes it
  // reversible. Cleared in `finally` so it can never stay off.
  restoreInProgress = true;
  try {
    // Write it through immediately rather than waiting on the debounce — a
    // restore must be on disk before we tell the admin it succeeded.
    await flushToDisk();
  } finally {
    restoreInProgress = false;
  }
  return { ok: true, users: restored.users.length, rooms: Array.isArray(restored.rooms) ? restored.rooms.length : 0, undo };
}

/** Take a restore point right now, on demand (before a risky change). */
export async function takeSnapshotNow(label = "manual"): Promise<{ ok: boolean; name?: string; error?: string }> {
  try {
    const db = await getDB();
    if (!Array.isArray(db.users) || db.users.length < 2) return { ok: false, error: "Nothing worth saving yet." };
    const dir = `${DATA_DIR}/snapshots`;
    await fs.mkdir(dir, { recursive: true });
    const safe = label.replace(/[^a-z0-9-]/gi, "").slice(0, 20) || "manual";
    const name = `db-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}-${safe}.json`;
    const tmp = `${dir}/.${name}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(db), "utf8");
    await fs.rename(tmp, `${dir}/${name}`);
    await writeSnapMeta(dir, name, db);
    return { ok: true, name };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save a restore point." };
  }
}

// `shuttingDown` makes the synchronous exit flush AUTHORITATIVE: once set, no
// async flush may write, so the two paths can never race on the DB file.
let shuttingDown = false;

// Write the whole DB to disk (atomically via tmp + rename), MINIFIED. Coalesced
// through the `writing` promise so concurrent flushes never interleave.
/**
 * LAST LINE OF DEFENCE BEFORE A WRITE.
 *
 * Refuses to replace a database that has real accounts in it with one that has
 * almost none. Nothing in this app legitimately empties the user table — there
 * is no "delete everything" feature — so a write like that is always a fault,
 * and on 2026-08-29 exactly such a write replaced 226 accounts with 3.
 *
 * Returns null when the write is safe, or the reason to refuse.
 */
let restoreInProgress = false;

async function unsafeWipeReason(next: DBShape): Promise<string | null> {
  // An admin-chosen restore is allowed to reduce the account count — that is the
  // whole point of it, and it is made reversible by a safety copy first.
  if (restoreInProgress) return null;
  const nextUsers = Array.isArray(next.users) ? next.users.length : 0;
  if (nextUsers > 25) return null; // plenty of accounts — obviously fine
  let onDisk = 0;
  try {
    const raw = await fs.readFile(DB_PATH, "utf8");
    const prev = JSON.parse(raw) as DBShape;
    onDisk = Array.isArray(prev.users) ? prev.users.length : 0;
  } catch {
    return null; // nothing readable to protect
  }
  // Losing more than half the accounts, or dropping from a real user base to
  // almost nothing, is never something the app should do on its own.
  if (onDisk >= 25 && nextUsers < onDisk / 2) {
    return `refusing to overwrite ${onDisk} accounts with ${nextUsers}`;
  }
  return null;
}

async function flushToDisk(): Promise<void> {
  if (!cache || !dirty || shuttingDown) return;
  dirty = false;
  const snapshot = JSON.stringify(cache); // minified (was pretty-printed — ~30% smaller + faster to serialize)
  writing = writing.then(async () => {
    if (shuttingDown) return; // the synchronous exit flush is the source of truth now
    // Never let a catastrophic in-memory state reach the file.
    const refuse = cache ? await unsafeWipeReason(cache) : null;
    if (refuse) {
      console.error(`[db] REFUSED WRITE: ${refuse}. The database on disk is unchanged. This is a bug — investigate before restarting.`);
      return;
    }
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = DB_PATH + ".tmp";
    await fs.writeFile(tmp, snapshot, "utf8");
    await fs.rename(tmp, DB_PATH);
    // Remember that THIS instance produced the file now on disk, so the
    // stale-cache guard in getDB() doesn't mistake our own write for someone
    // else's and pointlessly re-read it.
    try { loadedMtimeMs = (await fs.stat(DB_PATH)).mtimeMs; } catch { /* non-fatal */ }
  }).catch(() => { dirty = true; void persist(); /* a failed write re-arms and retries */ });
  return writing;
}

// PERSIST IS DEBOUNCED. The in-memory `cache` is the source of truth and is
// updated synchronously (every read is always current), but disk writes are
// COALESCED to at most one every ~700ms. Previously EVERY mutation rewrote the
// whole ~13 MB db.json — and a live game syncs its state ~1×/second per player,
// so under load the server spent most of its time re-serialising + rewriting the
// file. Debouncing turns those dozens of writes/second into a couple, which is
// the single biggest server-speed win. Worst case on a hard crash: the last
// ~700 ms of writes are lost (clients re-sync game state anyway); a graceful
// restart (every deploy) flushes synchronously via the exit hooks below.
//
// PRIORITY. A "low" write never pulls the flush FORWARD; it only makes sure one
// is coming. A "normal" write always brings it back to ~700ms. So a burst of
// game moves costs one write every 8 seconds instead of one every 700ms, while
// anything that matters — a coin balance, a message, a setting — still reaches
// disk as quickly as it always did. Whatever triggers the flush writes the whole
// database, so a low-priority change is never left behind by a normal one.
async function persist(priority: "normal" | "low" = "normal"): Promise<void> {
  dirty = true;
  if (!cache || shuttingDown) return;
  const delay = priority === "low" ? PERSIST_LOW_DEBOUNCE_MS : PERSIST_DEBOUNCE_MS;
  const due = Date.now() + delay;
  if (flushTimer) {
    if (flushDueAt <= due) return;    // one is already coming sooner
    clearTimeout(flushTimer);         // a normal write overtakes a low-priority wait
  }
  flushDueAt = due;
  flushTimer = setTimeout(() => { flushTimer = null; flushDueAt = 0; void flushToDisk(); }, delay);
}

// Synchronous + atomic flush on shutdown, on its OWN tmp file so it can NEVER
// interleave with an in-flight async flush (which uses ".tmp"). Marks the process
// shutting down so the async path stops writing. Called on shutdown signals AND
// on the final 'exit' event, so writes made while the framework drains requests
// are still captured. We do NOT force process.exit — the framework/pm2 completes
// the shutdown (pm2's kill-timeout is the backstop), so in-flight requests drain.
function flushSyncOnExit(): void {
  shuttingDown = true;
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  try {
    if (!cache || !dirty) return;
    mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DB_PATH + ".exit.tmp"; // distinct from flushToDisk's ".tmp"
    writeFileSync(tmp, JSON.stringify(cache), "utf8");
    renameSync(tmp, DB_PATH);
    dirty = false;
  } catch { /* best effort */ }
}
let exitHooked = false;
function hookExitFlush(): void {
  if (exitHooked || typeof process === "undefined") return;
  exitHooked = true;
  (["SIGTERM", "SIGINT"] as NodeJS.Signals[]).forEach((s) => process.once(s, () => flushSyncOnExit()));
  process.once("exit", () => flushSyncOnExit()); // final synchronous catch-all
}
hookExitFlush();

/** Mutate the DB, then schedule a (debounced) persist. The in-memory update is
 *  immediate, so read-after-write is always consistent; the disk flush coalesces.
 *
 *  Pass priority "low" for high-frequency, replaceable data (a live game board,
 *  a spectator heartbeat). It is stored in memory just the same and is included
 *  in the very next write — it simply does not make one happen sooner. */
export async function withDB<T>(fn: (db: DBShape) => T, priority: "normal" | "low" = "normal"): Promise<T> {
  const db = await getDB();
  const result = fn(db);
  await persist(priority);
  return result;
}
