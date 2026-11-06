"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { withBase } from "./base-path";
import { configureCurrency } from "./money";
import { configureAvatarLabel } from "./avatar-label";
import { defaultTokenDesigns, type TokenDesignCfg } from "./tokenDesigns";
import { defaultDiceDesigns, type DiceDesignCfg } from "./diceDesigns";
import { defaultHomeAreas, type HomeAreasCfg } from "./home-areas";
import type { BoardElement, ElementVis, SafeIconMode, SafeVisibility } from "./board-elements";
import { defaultChessCfg, type ChessCfg } from "./chess-theme";
import { defaultSiteNav, type SiteNav } from "./site-nav";
import { DEFAULT_SITE_CONTENT } from "./site-content-default";
import { DEFAULT_THEMES, type ThemePreset } from "./theme-presets";
import type { TextColors } from "./text-colors";
import { defaultDiceModels, type DiceModel } from "./dice-model";
import type { CustomPage } from "./custom-pages";
import type { AllPagesConfig } from "./all-pages-config";

// ============================================================
// Platform config — the live settings controlled from the Admin
// Panel (enabled games, announcement, maintenance, rewards…).
// Fetched once, shared app-wide, and re-fetched after admin saves.
// ============================================================

export interface RewardRule {
  id: string;
  label: string;
  coins: number;
  on: boolean;
}

export interface GameItem {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  route: string;
  players: number;
  matchesToday: number;
  spectator?: boolean;
  coinCost?: number; // coins to start a match (0/undefined = free)
}

export interface MembershipPlan {
  id: string;
  name: string;
  price: number;
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
  text?: string;      // running/scrolling one-line text (ticker on gameTop ads)
  priority?: number;  // higher shows first when several ads share a position
}

export interface CoinPackage {
  id: string;
  name: string;
  coins: number;
  price: number;
  bonus?: number;
  iconUrl: string;
  active: boolean;
  featured: boolean;
  badge: "" | "popular" | "best_value";
}

export interface GiftItem {
  id: string;
  emoji: string;
  name: string;
  cost: number;
  category?: string;
  active: boolean;
}

export interface CoinOffer {
  id: string;
  name: string;
  type: "bonus" | "discount";
  amount: number;
  from: string;
  until: string;
  active: boolean;
}

export interface AppConfig {
  appName: string;
  companyName?: string; // optional company/brand name shown before the app name (e.g. "THAMARAI NETWORKS")
  themeColor?: string;  // admin accent colour (hex, e.g. "#7c5cfc"); "" = default violet. Live-recolours the app.
  themeColor2?: string; // secondary accent colour (hex) → overrides the petal ramp; "" = default pink.
  // SURFACE THEMING — the tint and brightness of every panel, card and the page
  // canvas. This is what makes the app feel light or dark; "" = the built-in look.
  themeSurface?: string;           // hex tint for the ink-* surfaces
  themeSurfaceBrightness?: number; // 0 = deepest, 100 = much lighter & airier
  themeGlow?: number;              // 0–100 strength of the colourful background glows
  themeBgImage?: string;           // optional background picture (an /api/media path)
  customCss?: string;   // super-admin custom CSS injected app-wide (advanced theme control, no source edits).
  // TEXT COLOURS — a system of its own, separate from Theme Management. Themes
  // style the app; these decide what colour the words are, and they win over a
  // theme so a theme change can never fade them. See lib/text-colors.ts.
  textColors?: TextColors;
  // ALL PAGES directory — the admin's control over the user-facing /all-pages
  // screen: on/off, which sections and tiles appear, and in what order.
  allPages?: AllPagesConfig;
  // Admin menu layout: reorder + show/hide the user-facing nav (keyed by item href),
  // plus SUBMENUS — extra child links nested under a menu item.
  menuLayout?: { order?: string[]; hidden?: string[]; submenus?: Record<string, { label: string; href: string }[]> };
  // Public site HEADER + FOOTER links, tagline and copyright (Admin → Navigation).
  siteNav?: SiteNav;
  // Admin UI style tokens (button corner style, chat bubble style, chat font size). Applied live via CSS vars.
  uiStyle?: { buttonShape?: "sharp" | "rounded" | "pill"; chatBubbleShape?: "sharp" | "rounded" | "round"; chatFontSize?: "small" | "normal" | "large" };
  themes?: ThemePreset[];
  activeThemeId?: string;
  allowUserThemeSwitch?: boolean;
  announcement: string;
  adminLimit: number;
  games: GameItem[];
  competitionPrizes?: { coins: number; enabled: boolean }[];
  settings: {
    signups: boolean;
    otp: boolean;
    roomCreation: boolean;
    gifts: boolean;
    maintenance: boolean;
    signupApproval?: boolean;
    gameWinRewards?: boolean; // compliance: OFF = winning a game gives no coins/rewards
    gameCoinsEnabled?: boolean; // OFF (default) = games never charge coins to start
    primaryGroupDeleteApproval?: boolean; // ON (default) = first group needs admin approval to delete
    agencyUserApproval?: boolean; // ON = agency-created accounts need admin approval; OFF (default) = direct activation
  };
  features?: {
    registration?: boolean; voiceRooms?: boolean; privateRooms?: boolean; paidZone?: boolean;
    gifts?: boolean; coins?: boolean; levels?: boolean; games?: boolean; coHost?: boolean; chat?: boolean;
    business?: boolean; reels?: boolean; tournaments?: boolean; competitions?: boolean; luckyNumber?: boolean;
    // Section switches added so EVERY main area of the app can be turned off
    // from Feature Management, not just the original core modules. Each one
    // hides its menu entry (side nav, bottom nav and the All Pages directory).
    leaderboards?: boolean; jobs?: boolean; agencies?: boolean; customize?: boolean;
    myStorage?: boolean; documents?: boolean; friends?: boolean; search?: boolean;
    support?: boolean; luckySpin?: boolean; store?: boolean; notifications?: boolean;
  };
  tournamentControls?: {
    tournamentRegistration?: boolean; tournamentAutoStart?: boolean; tournamentAutoPrize?: boolean; tournamentMatchRooms?: boolean; tournamentPublicListing?: boolean;
    competitionRegistration?: boolean; competitionVoting?: boolean; competitionGifts?: boolean; competitionResults?: boolean; adminAutoJoinCompetition?: boolean;
  };
  // Dice look & behaviour (admin-controlled).
  gameDice?: { customFace?: boolean; faceImage?: string; showLastRolled?: boolean };
  // New Host-controlled match-start flow (Manual invite / Automatic-Join lobby).
  lobby?: {
    enabled?: boolean; hostOnlyStart?: boolean; autoJoin?: boolean; manualInvite?: boolean;
    countdownSeconds?: number; startingSeconds?: number; minPlayers?: number; maxPlayers?: number;
    // The ORDER the four player colours appear in the lobby seat grid, e.g.
    // ["red","green","blue","yellow"] puts Blue where Yellow used to be.
    // Display only — a seat keeps its colour, its player and its game meaning.
    seatOrder?: string[];
  };
  // AUTO RESET / AUTO CLEANUP of stuck games (Admin → Reset & Recovery).
  // A game lobby had no lifetime of its own: one that never became a real match
  // sat in the room for ever and blocked every later game there. These settings
  // decide when such a lobby is cleared automatically.
  autoReset?: {
    enabled?: boolean;              // master switch (default ON)
    afterHours?: number;            // clear any stuck game older than this (default 24)
    staleStartingMinutes?: number;  // frozen on "Starting…" and no match appeared (default 10)
    emptyLobbyHours?: number;       // opened, nobody ever took a seat (default 2)
    notifyPlayers?: boolean;        // tell seated players their game was cleared (default ON)
  };
  business?: { categories?: string[]; registerCost?: number; fields?: BusinessFieldDef[]; jobTypes?: string[]; jobFields?: BusinessFieldDef[]; profileSections?: BusinessSection[] };
  roomControls: {
    voiceEnabled: boolean; videoEnabled: boolean; defaultSeats: number; maxSeats: number;
    showHostCrown?: boolean;
    showSeatGear?: boolean;    // the ⚙ "Settings" symbol on a manageable seat (default ON)
    showCoHostStar?: boolean;  // the ★ co-host badge on a seat (default ON)
  };
  // ROOM / GROUP LIST VISIBILITY (Admin → Rooms). Decides which rooms appear in
  // the Voice-Rooms list for everyone. It only filters the LISTING — a room that
  // is hidden here still works normally and is still reachable by a direct link,
  // an invite or the room's own members.
  roomList?: {
    mode?: "all" | "hostOnline" | "coHostOnline" | "memberOnline" | "custom";
    hideOffline?: boolean;    // hide rooms with nobody live in them at all
    requireHost?: boolean;    // custom: the host must be live
    requireCoHost?: boolean;  // custom: a co-host must be live
    requireMember?: boolean;  // custom: at least one ordinary member must be live
    minLive?: number;         // custom: minimum live people (0 = no minimum)
    alwaysShowMine?: boolean; // never hide a room the viewer owns or has joined (default ON)
    adminSeesAll?: boolean;   // administrators bypass the filter (default ON)
    // ACTIVE / INACTIVE browsing options on the members' Voice Rooms screen.
    // Each is an independent switch: turn one off and that button disappears for
    // members (the rooms themselves are untouched — this is only a way to browse).
    showActive?: boolean;     // "Active now" button — rooms with someone in them (default ON)
    showInactive?: boolean;   // "Inactive" button — rooms that are empty right now (default ON)
  };
  permissions: { coHostCanRemove: boolean; coHostCanMute: boolean; memberCanInvite: boolean; memberCanGift: boolean };
  content: { welcome: string; supportEmail: string; termsUrl: string; playStoreUrl?: string; apkUrl?: string };
  membership: { paidEnabled: boolean; plans: MembershipPlan[]; subscriberFeatures?: MembershipSubscriberFeatures };
  rewards: RewardRule[];
  ads: AdItem[];
  siteContent?: import("@/lib/site-content-default").SiteContent;
  // CUSTOM CONTENT PAGES — pages the admin writes in the panel (heading, text,
  // pictures, buttons), served at /p/<slug> and linkable from any menu. This is
  // what the navigation editor's "Add Content" creates. See lib/custom-pages.ts.
  customPages?: CustomPage[];
  // LUCKY NUMBER — what a room's Host / Co-Host may do without an admin.
  // Everything defaults to allowed EXCEPT hand-picking the winning number, which
  // would make the spin decorative and let a host choose the winner.
  luckyNumber?: {
    start?: boolean;       // start the game once players have joined
    round?: boolean;       // open number selection for a round
    draw?: boolean;        // run the spin / shuffle
    manualPick?: boolean;  // choose the winning number by hand (default OFF)
    complete?: boolean;    // close a round / finish the game
    joining?: boolean;     // open / close joining
  };
  coinPackages: CoinPackage[];
  coinOffers: CoinOffer[];
  giftCatalog: GiftItem[];
  paymentGateway?: {
    enabled?: boolean; // master ON/OFF for the card / online gateway (Super-Admin)
    provider: "test" | "razorpay" | "stripe";
    keyId?: string;
    currency?: string;
    methods?: { cards: boolean; googlePay: boolean; applePay: boolean; paypal: boolean; local: boolean };
  };
  moderation: Record<string, "actioned" | "dismissed">;
  uploadMaxMB?: number;
  policies?: PolicyDoc[];
  featurePricing?: { roomNameChange: number; videoUnlock: number; coHostSlot?: number; extraPublicRoom?: number };
  coHostLimit?: number;
  gameTurnSeconds?: number; // seconds per game turn before a missed turn (chance-missing timer)
  gameDiceSpeed?: "slow" | "normal" | "fast"; // dice roll animation speed
  gameTokenSpeed?: "slow" | "normal" | "fast"; // Ludo token move (hop) speed per cell
  // PER-GAME overrides (Ludo / Snake / Chess). Each field is optional — unset falls back
  // to the global value above, so existing behaviour is unchanged until an admin sets one.
  perGameSettings?: Record<string, { turnSeconds?: number; diceSpeed?: "slow" | "normal" | "fast"; tokenSpeed?: "slow" | "normal" | "fast"; returnChancesOnRejoin?: boolean }>;
  // Optional admin "Fair Dice" pity system (ships OFF → dice stay pure-random).
  fairDice?: { enabled?: boolean; threshold?: number; boostPercent?: number; guaranteeAfter?: number };
  // Dice Control Management (Admin → Dice Control). mode "random" (default) = current
  // behaviour (pure random + the Fair Dice pity above). Custom modes apply to CASUAL
  // Ludo only — PAID tournaments/cash matches always use certified fair random when
  // fairPlayProtection is on. Every change is audit-logged.
  diceControl?: {
    mode?: "random" | "controlled" | "tournament" | "testing";
    fairPlayProtection?: boolean;
    useProbabilities?: boolean;
    probabilities?: { one?: number; two?: number; three?: number; four?: number; five?: number; six?: number };
    equalProbability?: boolean; winnerBalancing?: boolean; newPlayerSupport?: boolean; autoFairness?: boolean;
    maxRollsWithout6?: number; minRollsBefore6?: number; disableConsecutive6?: boolean; maxConsecutive6?: number;
    boostThreshold?: number; boostPercent?: number;
    playerControls?: { id: string; userId: string; userName: string; preferredValues: number[]; strength?: number; duration?: "match" | "day" | "permanent" | "tournament"; setAt?: string; setBy?: string }[];
  };
  // Profile Photo Editor (Admin → Photo Editor). Controls the crop/zoom/rotate editor
  // shown before a profile picture is saved, plus upload limits + approval.
  photoEditor?: {
    enabled?: boolean;              // show the editor at all (off = plain resize like before)
    mode?: "full" | "cropOnly";     // full editing vs crop-only
    maxSizeMB?: number;             // reject files bigger than this
    formats?: string[];             // allowed input formats: jpg / png / webp / heic
    minRes?: number;                // reject images smaller than this (px, shorter side)
    maxRes?: number;                // output is capped to this many px (longest side)
    autoCompress?: boolean;         // compress the output
    quality?: number;               // output JPEG/WEBP quality % (when compressing)
    forceSquare?: boolean;          // lock the crop to 1:1
    forceCircle?: boolean;          // always show the circular preview
    allowRotate?: boolean; allowZoom?: boolean; allowDrag?: boolean; allowFlip?: boolean;
    autoCenter?: boolean;           // start centred + fitted
    approvalRequired?: boolean;     // new picture waits for admin approval before it shows
    moderation?: "off" | "manual" | "ai"; // ai = flagged in the queue (needs a provider — see note)
    defaultImage?: string;          // picture restored when a user REMOVES their photo
  };
  // What a member with NO profile picture shows. Distinct from photoEditor.defaultImage,
  // which only applies when someone actively removes their own photo.
  defaultAvatar?: {
    mode?: "initials" | "first" | "full"; // "SS" · "Siva" · "Siva Siva"
    maxChars?: number;              // cap the text so a long name still fits the circle
    uppercase?: boolean;            // force UPPER CASE
    keepEmoji?: boolean;            // keep emoji in the text (they read as noise when tiny)
    imageUrl?: string;              // a house picture behind the name instead of the colour circle
    showName?: boolean;             // draw the name on top of that house picture too
  };
  // Admin-managed image overlays placed ON the voice-room screen (banners, logos,
  // decorations). Each can be moved anywhere, resized, toggled, and shown to a chosen
  // audience — all live from the admin panel, no app update.
  roomOverlays?: {
    id: string; name: string; image: string; enabled: boolean;
    // What `image` actually holds. Images stay the default; a video plays muted +
    // looped in place, and any other file shows a tappable download tile.
    mediaType?: "image" | "video" | "audio" | "pdf" | "file";
    fileName?: string;
    xPct: number; yPct: number; widthPct: number; opacity: number;
    visibility: "all" | "hosts" | "vip"; scope: "all" | "specific"; roomIds?: string[]; link?: string;
    coverSeats?: boolean; // when true, the image fills (object-cover) the ENTIRE seat area instead of floating at x/y
    zone?: "free" | "aboveSeats" | "belowChat" | "roomList" | "gameTop"; // fixed placement band (default "free" = the original floating layer)
    closable?: boolean;   // viewers get an X to dismiss the overlay (separate close per display section)
  }[];
  // Admin-controlled speaking (active-speaker) avatar effect in voice rooms.
  // `imageUrl` holds an admin-uploaded custom animation (GIF/PNG/WebP) shown when
  // `style` is "custom".
  speakingFx?: { enabled?: boolean; style?: string; color?: string; speed?: "slow" | "normal" | "fast"; imageUrl?: string };
  // Admin-managed categories for grouping Voice Rooms + Store items.
  categories?: { id: string; name: string; scope: "store" | "room"; enabled?: boolean; order?: number }[];
  tokenDesigns?: TokenDesignCfg[]; // admin-managed game token designs
  diceDesigns?: DiceDesignCfg[];   // admin-managed dice styles (library, not one face)
  // DICE MODEL MANAGEMENT — the full dice system: body colour/texture/shape, pips,
  // a separate design for each number 1–6 (dots / digit / symbol / uploaded image)
  // and the roll animation. `activeDiceModelId` is the one every game draws.
  diceModels?: DiceModel[];
  activeDiceModelId?: string;
  gameBoard?: {
    center?: {
      image?: string; show?: boolean; sizePct?: number; opacityPct?: number;
      rotateDeg?: number; offsetXPct?: number; offsetYPct?: number;
    };
    // Snake board centre watermark (per-game centre image; ships OFF).
    centerSnake?: { image?: string; show?: boolean; sizePct?: number; opacityPct?: number };
    // WHERE the playable 10x10 grid actually sits inside the Snake board image.
    // The coins were always placed across the WHOLE image, so any board picture
    // with a decorative frame (every custom board) put them off the squares.
    // Defaults cover the whole image = exactly the old behaviour.
    snakeGrid?: { topPct?: number; leftPct?: number; widthPct?: number; heightPct?: number };
    // WHERE the Ludo 15x15 grid sits inside the board picture, plus the look of
    // its lines. A custom board's painted squares never match a grid stretched
    // across the whole image, so the grid must be movable. 0/0/100/100 = as before.
    ludoGrid?: { topPct?: number; leftPct?: number; widthPct?: number; heightPct?: number };
    // Snake: which half of the screen the player's OWN seat sits in.
    snakeMyPosition?: "bottom" | "top";
    tokenScalePct?: number; tokenFanPct?: number;
    shareStyle?: "corners" | "diagonal" | "row" | "stack";
    decor?: { homeSymbol?: string; homeSymbolShow?: boolean; safeIcon?: string; safeIconShow?: boolean; safeHighlight?: boolean; safeColor?: string; frameColor?: string; fullImage?: string; fullImageShow?: boolean; fullImageOpacityPct?: number; fullImageFit?: "contain" | "cover" | "fill"; fullImageOffsetXPct?: number; fullImageOffsetYPct?: number; fullImageScalePct?: number; boxBorder?: boolean; borderColor?: string; boxHighlight?: boolean; showArrow?: boolean; hideHomeBg?: boolean; homeBgColor?: string; safeSizePct?: number; safeOpacityPct?: number; safeGlow?: boolean; safeRotateDeg?: number;
      // Full safe-zone STAR editor (appearance only — see lib/board-elements.ts).
      safeIconMode?: SafeIconMode; safeBorder?: boolean; safeBorderColor?: string;
      safeGlowPx?: number; safeShadow?: boolean; safeShadowOpacityPct?: number;
      safePosXPct?: number; safePosYPct?: number; safeVisibility?: SafeVisibility };
    // Show / Hide / Transparent for each visual element of the board.
    elements?: Partial<Record<BoardElement, ElementVis>>;
    // WHICH ring squares are safe (0–51). Empty/absent = the classic 8. This one
    // DOES affect play (captures), so it is applied to the engine for everyone.
    safeCells?: number[];
    // CHESS board + piece customization (see lib/chess-theme.ts). Appearance only.
    chess?: ChessCfg;
    boards?: { id: string; name?: string; image: string; fit?: "contain" | "cover" | "fill"; opacityPct?: number; offsetXPct?: number; offsetYPct?: number; scalePct?: number; enabled?: boolean; createdAt?: string; priceCoins?: number; validityDays?: number }[];
    activeBoardId?: string;
    tokenSlots?: { enabled?: boolean; slots?: { dxPct?: number; dyPct?: number; sizePct?: number; rotateDeg?: number }[] };
    // TOKEN PLACEMENT AREAS — each home (Red/Green/Yellow/Blue) configured on its
    // own: background show/hide/transparent/colour/image, "Hide White Token Area",
    // layer, and full per-slot control of all four token positions. Appearance
    // only: the Ludo engine is never affected. See src/lib/home-areas.ts.
    homeAreas?: HomeAreasCfg;
  }; // §3 centre image + §5 coin spacing + board decorations + full-board image + custom-board library + per-slot token layout + per-home token placement areas (admin, live)
  gameAnim?: {
    diceRoll?: boolean; diceStyle?: "tumble" | "spin" | "flip" | "shake" | "bounce" | "wobble" | "zoom" | "roll2d"; diceDisplaySeconds?: number; turnDelaySeconds?: number; tokenMove?: boolean; moveStyle?: "slide" | "jump" | "bounce" | "fly" | "spin" | "instant"; winCelebration?: boolean;
    winIntensity?: "low" | "normal" | "high"; captureFlash?: boolean;
    coinGlow?: boolean; soundEffects?: boolean;
    turnAnim?: boolean;
    turnAnimStyle?: "shake" | "bounce" | "pulse" | "glow" | "rotate" | "heartbeat" | "ripple" | "breathing" | "sparkle" | "none";
    // While the DICE IS ROLLING, should the rolling player's profile picture
    // move too? This used to be hard-coded on, with no way to switch it off.
    rollShake?: boolean;
    rollShakeStyle?: "shake" | "bounce" | "pulse" | "glow" | "rotate" | "heartbeat" | "ripple" | "breathing" | "sparkle";
    centerReach?: { enabled?: boolean; style?: "bloom" | "sparkle" | "confetti" | "fireworks"; speed?: "slow" | "normal" | "fast" };
  }; // §4 centre-reach + §6 animation management (admin-managed, live)
  // Same-colour-block SHIELD appearance (safe-zone icon on a normal box). Look-only.
  shield?: {
    iconEnabled?: boolean; glow?: boolean; blink?: boolean; particles?: boolean;
    image?: string; color?: string; animationStyle?: "none" | "pulse" | "spin" | "bounce"; speed?: "slow" | "normal" | "fast";
  };
  gameTheme?: {
    preset?: string; bgColor?: string; bgImage?: string; accent?: string;
    music?: { enabled?: boolean; track?: string; volumePct?: number };
  }; // §7 game theme (background + accent + background music), admin-managed, live
  recording?: {
    master?: boolean; roomEnabled?: boolean; callEnabled?: boolean; retentionDays?: number;
    autoDelete?: boolean; maxStorageMB?: number; userAccess?: "adminOnly" | "hostAndAdmin";
    modules?: {
      voiceRoomVoice?: boolean; voiceRoomChat?: boolean; privateRoomVoice?: boolean; privateRoomChat?: boolean;
      competitionAudio?: boolean; competitionChat?: boolean; paidZoneVoice?: boolean; paidZoneVideo?: boolean; paidZoneChat?: boolean;
      privateVoiceCall?: boolean; privateVideoCall?: boolean; personalChat?: boolean; groupChat?: boolean;
    };
    notify?: {
      enabled?: boolean; text?: string;
      voiceRoom?: boolean; privateRoom?: boolean; competition?: boolean;
      paidZoneCall?: boolean; voiceCall?: boolean; videoCall?: boolean; chat?: boolean;
    };
  }; // Record Management: master + per-module toggles + retention + notifications (admin)
  activityReward?: {
    enabled?: boolean; name?: string; requiredMinutes?: number; continuousCoins?: number; accumulatedCoins?: number;
    gapMinutes?: number; dailyLimit?: number; maxPerUser?: number; notifyTitle?: string; continuousMsg?: string; accumulatedMsg?: string;
  }; // Active-time / Startup-Bonus reward (admin-managed)
  freeCoins?: {
    enabled?: boolean;
    welcome?: { enabled?: boolean; amount?: number };
    dailyLogin?: { enabled?: boolean; amount?: number };
    event?: { enabled?: boolean; amount?: number; validUntil?: string };
    periodic?: { enabled?: boolean; intervalMinutes?: number; amount?: number; dailyLimit?: number; minLevel?: number };
  }; // Free Coins Management (welcome / daily login / event / manual / periodic) — admin-managed
  inactivity?: {
    enabled?: boolean; timeoutMinutes?: number; warningSeconds?: number; backgroundMonitor?: boolean;
    exemptAdmins?: boolean; exemptRoles?: string[]; singleSession?: boolean;
    rewardRequiresActivity?: boolean; rewardGraceMinutes?: number; roomTimeoutSeconds?: number;
  }; // Inactivity Detection & Auto Logout (admin-managed; auto-logout ships OFF)
  coinFees?: {
    taxEnabled?: boolean; taxLabel?: string; taxPct?: number;
    serviceEnabled?: boolean; serviceLabel?: string; servicePct?: number; serviceFixed?: number;
    showBreakdown?: boolean;
  }; // Tax + service charge on coin purchases (admin-managed; ships OFF)
  privacy?: {
    enabled?: boolean; mutualFollowToView?: boolean;
    dmLimitEnabled?: boolean; maxUnansweredDMs?: number; unlockOnFollow?: boolean;
  }; // Privacy & Messaging controls (admin-managed; restrictions ship OFF)
  loginSecurity?: { enabled?: boolean; maxAttempts?: number; lockoutMinutes?: number }; // failed-login lock (admin-controlled)
  /**
   * VOICE ROOM AUDIO QUALITY (Admin → Voice Quality).
   *
   * These were previously fixed in the code at the *lowest* settings LiveKit
   * offers, to save mobile data — 12 kbps, silence-skipping on, packet-loss
   * protection off. That is what made voice sound thin and drop out. They are
   * now settings, defaulting to clear speech, so quality and data cost can be
   * balanced without a code change.
   */
  voiceQuality?: {
    bitrateKbps?: number;        // 8–64. 12 = telephone, 20 = speech, 32 = clear (default), 64 = music
    dtx?: boolean;               // stop sending during silence — saves data, can clip the start of words
    red?: boolean;               // send redundant packets so a lost one doesn't become a dropout
    noiseSuppression?: boolean;  // remove background noise (fans, traffic, TV)
    echoCancellation?: boolean;  // stop the speaker's sound being picked up again
    autoGainControl?: boolean;   // even out quiet and loud speakers
    voiceIsolation?: boolean;    // stronger voice-focus where the browser supports it
    stereo?: boolean;            // two channels — doubles the data, pointless for speech
  };
  // Device & Security restrictions (Admin → Device & Security). All limits: 0 = unlimited.
  deviceSecurity?: {
    maxAccountsPerDevice?: number;      // most accounts allowed to sign in from one device
    maxDevicesPerAccount?: number;      // most devices one account may sign in from
    blockMultiAccountPerDevice?: boolean; // hard "one account per device"
    whitelistMode?: boolean;            // only admin-whitelisted devices may log in
    retentionDays?: number;             // auto-prune device/login data older than this (0 = keep forever)
    alertNewDevice?: boolean;           // notify admins when an account signs in from a new device
    alertNewDeviceUser?: boolean;       // notify the account owner when they sign in from a new device
    alertMultiAccount?: boolean;        // notify admins when a device exceeds the account limit
    alertBlockedAttempt?: boolean;      // notify admins when a blocked/unapproved device tries to log in
    alertFailedLogins?: boolean;        // notify admins on repeated failed logins
    failedLoginThreshold?: number;      // failed attempts before the alert fires
  };
  // Messaging & file controls (Admin → Messaging Controls).
  messaging?: {
    types?: Record<string, boolean>;  // per message-type enable/disable
    maxFileMB?: number;               // chat attachment size ceiling (0 = use global uploadMaxMB)
    blockedExtensions?: string[];     // file extensions to reject (no dot, lowercase)
    allowedExtensions?: string[];     // extra extensions to permit beyond the built-in list (zip/rar/apk/…)
    allowAllTypes?: boolean;          // one switch: accept any file type except the dangerous denylist
    allowDownload?: boolean;          // users may download attachments
    allowForward?: boolean;           // users may forward messages
    allowCopy?: boolean;              // users may copy message text
    editWindowMin?: number;           // minutes a sender may still edit (0 = editing off)
    retentionDays?: number;           // auto-delete DMs older than this (0 = keep forever)
    virusScan?: boolean;              // run the upload security scan (needs a provider to actually scan)
    auditUploads?: boolean;           // keep the per-file upload audit trail
    // ---- Edit / Delete permissions (Admin → Messaging Controls) --------------
    // Simple ON/OFF switches for who may edit or delete a message. `perUser` lets
    // the admin override either switch for ONE person without changing everyone
    // else (unset = follow the global switch).
    userEdit?: boolean;               // members may edit their OWN messages (default ON)
    userDelete?: boolean;             // members may delete their OWN messages for everyone (default ON)
    adminEditAny?: boolean;           // admins may edit ANY user's message (default ON)
    adminDeleteAny?: boolean;         // admins may delete ANY user's message (default ON)
    perUser?: Record<string, { edit?: boolean; delete?: boolean }>;
  };
  // Admin → File Storage (the company's own permanent file library).
  fileStorage?: {
    quotaGB?: number;   // total space the library may use (0 = unlimited)
    maxFileMB?: number; // biggest single file an admin may upload (0 = 200 MB default)
  };
  gameRules?: { returnChancesOnRejoin?: boolean }; // rejoin restores remaining chances (default ON)
  giftReceiverSharePct?: number; // % of a gift's value credited to the receiver; rest = company revenue (0–100)
  media?: {
    libraryAccess?: boolean;
    audioEnabled?: boolean; videoEnabled?: boolean; imageEnabled?: boolean;
    audioPaid?: boolean; audioPrice?: number;
    videoPaid?: boolean; videoPrice?: number;
    imagePaid?: boolean; imagePrice?: number;
  };
  paidZone?: { enabled: boolean; joinCost: number; audioPerMin?: number; videoPerMin?: number; callsEnabled?: boolean; videoCallsEnabled?: boolean; recordingEnabled?: boolean; receiverRewardsEnabled?: boolean; receiverSharePct?: number; agencyProfitPct?: number; monthlyCoins?: number; renewalDays?: number; graceDays?: number; autoRenew?: boolean };
  withdraw?: { coinsPerUnit: number; currency: string; feePct: number; minCoins: number; maxCoins: number; autoApprove: boolean };
  lotus?: { enabled: boolean; name: string; icon?: string; coinToLotus: number; lotusToCurrency: number; currency: string; minWithdraw: number; maxWithdraw: number; dailyLimit: number; feePct: number; autoApprove: boolean; userSharePct?: number; agencySharePct?: number; companySharePct?: number; trustSharePct?: number; trustEnabled?: boolean; gstPct?: number; conversionTiers?: { id: string; lotus: number; value: number; enabled: boolean }[]; rewardTypes?: Record<string, boolean> };
  referral?: { enabled: boolean; reward: number; requireApproval: boolean; autoBlockDuplicates: boolean; agencyReward?: number };
  // Configurable Agency level tiers (Bronze/Silver/Gold…). metric = what drives the level.
  agencyLevels?: { enabled?: boolean; metric?: "members" | "earnings" | "coins"; tiers?: { id: string; name: string; badge: string; color: string; minValue: number; perk?: string }[] };
  luckySpin?: { enabled: boolean; cooldownHours: number; segments: { label: string; coins: number; weight: number; weightPaid?: number }[]; spendBoost?: { enabled?: boolean; tiers?: { minCoins: number; boostPct: number }[] }; extraChancesEnabled?: boolean; dailyLoginChances?: number; winTaskChances?: number; buyCostCoins?: number; adChancesPerDay?: number; chanceExpiryDays?: number };
  // Store catalog beyond frames (backgrounds / name effects / badges).
  storeItems?: {
    id: string; kind: "background" | "nameEffect" | "badge" | "overlay"; name: string;
    image?: string; style?: string; price: number; enabled: boolean;
    category?: string; badge?: string; description?: string;
    validityDays?: number; order?: number; vipOnly?: boolean;
    // v400 store controls
    archived?: boolean; featured?: boolean; newArrival?: boolean; trending?: boolean;
    comingSoon?: boolean; limitedEdition?: boolean;
    salePrice?: number; saleStart?: string; saleEnd?: string;
    stock?: number; purchaseLimit?: "once" | "daily" | "weekly" | "monthly" | "lifetime";
    minLevel?: number; maxLevel?: number; displayOnly?: boolean; agencyIds?: string[];
    userIds?: string[]; gender?: "male" | "female"; restrictMode?: "hide" | "show"; freeForVip?: boolean; firstBuyDiscountPct?: number;
  }[];
  // Google Sign-In public OAuth Client ID ("" = button hidden).
  googleClientId?: string;
  // Duplicate-name rule: true / unset = allowed, false = names must be unique.
  duplicateNames?: { user?: boolean; group?: boolean; agency?: boolean };
  // SHA-256 fingerprint of the Play app-signing key (Play Console → Setup →
  // App integrity). Served at /.well-known/assetlinks.json; without it the
  // Android app shows a browser address bar. Public value, not a secret.
  androidFingerprint?: string;
  // Avatar FRAME shop — frames users buy with coins and equip (price 0 = free).
  avatarFrames?: {
    id: string; name: string; image: string; price: number; enabled: boolean;
    category?: string; badge?: string; description?: string;
    validityDays?: number; order?: number; launchAt?: string; endAt?: string;
  }[];
  // Per-module frame + badge visibility (admin) — see lib/module-frames.ts.
  moduleFrames?: Record<string, { framesVisible?: boolean; framesRequired?: boolean; badgesVisible?: boolean; badgesRequired?: boolean }>;
  // In-game activity notifications (single-line alert bar) — full admin control.
  gameAlerts?: {
    enabled?: boolean;
    infoSeconds?: number;
    approvalSeconds?: number;
    types?: { joins?: boolean; leaves?: boolean; seatRequests?: boolean; messages?: boolean; gameEvents?: boolean };
  };
  // Screenshot/recording protection for Paid Zone + wallet (admins exempt).
  captureProtection?: {
    screenshot?: boolean; recording?: boolean; sharing?: boolean; thirdParty?: boolean; autoEndCall?: boolean; warning?: boolean; watermark?: boolean;
    audioRecording?: boolean; videoRecording?: boolean; mirroring?: boolean; allScreens?: boolean;
    modules?: { home?: boolean; profile?: boolean; chat?: boolean; voiceRoom?: boolean; wallet?: boolean; paidZone?: boolean; reels?: boolean; tournaments?: boolean; competitions?: boolean };
  };
  // Sound Management — per-effect ON/OFF + optional custom sound + sound pack.
  gameSound?: {
    pack?: "classic" | "modern" | "premium" | "casino" | "arcade" | "fantasy" | "silent";
    effects?: Partial<Record<"diceRoll" | "tokenMove" | "capture" | "home" | "win" | "lose" | "countdown" | "notification" | "click", { enabled?: boolean; url?: string }>>;
  };
  // Background music per screen (tracks come from the Media Library).
  bgMusic?: {
    enabled?: boolean;
    volumePct?: number;
    screens?: Partial<Record<"home" | "lobby" | "voiceRoom" | "ludo" | "snake" | "tournament" | "waiting" | "result", { url?: string; enabled?: boolean }>>;
  };
  paymentQr?: { enabled?: boolean; imageUrl: string; upiId?: string; note?: string; currency?: string };
  logCleanup?: { enabled: boolean; days: number }; // auto-delete activity logs older than N days
  // Level & reward system — admin-controlled XP + level-up bonus (min(cap, base + level×perLevel))
  levelRewards?: { enabled: boolean; base: number; perLevel: number; cap: number; xpPlay: number; xpWin: number; xpGift: number; xpDailyLogin: number; xpPurchase: number };
  // Lotus Flower loyalty rewards — automatic milestones for SENDING coins/gifts (Admin → Lotus Flower Rewards). Ships disabled.
  lotusRewards?: { enabled: boolean; notifyUser: boolean; validityDays: number; tiers: { minCoins: number; flowers: number }[] };
  productCategoryFields?: ProductFieldDef[]; // admin-defined custom product fields (per category / all)
  labels?: Record<string, string>; // admin-overridden front-end text labels
  images?: Record<string, string>; // admin-overridden app images (slot key → uploaded URL)
  posting?: { users?: boolean; businesses?: boolean; jobs?: boolean }; // who may post reels/videos/jobs
  chat?: { storeMessages?: boolean; groupRetentionDays?: number; deleteForEveryone?: boolean };
}

export interface PolicyDoc {
  id: string;
  slug: string;
  title: string;
  body: string;
  requiredAtSignup: boolean;
  updatedAt: string;
}

/** A custom PRODUCT field the admin defines per category (config.productCategoryFields). */
export interface ProductFieldDef {
  id: string;
  category: string; // "" / "*" = all categories, else a specific category name
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "radio" | "checkbox" | "date" | "file" | "image" | "url";
  options?: string[];
  placeholder?: string;
  required?: boolean;
  enabled?: boolean;
  order?: number;
}

/** A custom business-registration field defined by the admin (config.business.fields).
 *  Mirror of the server type — lets the admin add form fields with no code change. */
export interface BusinessFieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "tel" | "email" | "url" | "number" | "select";
  options?: string[];
  placeholder?: string;
  required?: boolean;
  enabled?: boolean;
}

/** A business-profile section/tab the admin can rename, hide/show and reorder. */
export interface BusinessSection {
  key: string;
  label: string;
  enabled: boolean;
}

export const DEFAULT_CONFIG: AppConfig = {
  appName: "LotusPlay Connect",
  companyName: "",
  themeColor: "",
  themeColor2: "",
  themeSurface: "",
  themeSurfaceBrightness: 0,
  themeGlow: 100,
  themeBgImage: "",
  siteNav: defaultSiteNav(),
  customCss: "",
  themes: DEFAULT_THEMES.map((t) => ({ ...t })),
  activeThemeId: "classic",
  allowUserThemeSwitch: false,
  menuLayout: {},
  uiStyle: {},
  announcement: "",
  adminLimit: 10,
  games: [
    { id: "ludo", name: "Ludo", icon: "dice", enabled: true, route: "/games/ludo", spectator: true, coinCost: 0, players: 0, matchesToday: 0 },
    { id: "chess", name: "Chess", icon: "crown", enabled: true, route: "/games/chess", spectator: true, coinCost: 50, players: 0, matchesToday: 0 },
    { id: "snake", name: "Snake & Ladder", icon: "joystick", enabled: true, route: "/games/snake", spectator: true, coinCost: 50, players: 0, matchesToday: 0 },
    { id: "lucky-number", name: "Lucky Number", icon: "ticket", enabled: true, route: "/lucky-number", spectator: false, coinCost: 0, players: 0, matchesToday: 0 },
  ],
  settings: { signups: true, otp: true, roomCreation: true, gifts: true, maintenance: false, signupApproval: true },
  features: { registration: true, voiceRooms: true, privateRooms: true, paidZone: true, gifts: true, coins: true, levels: true, games: true, coHost: true, chat: true, business: true, reels: true, tournaments: true, competitions: true, luckyNumber: true },
  tournamentControls: { tournamentRegistration: true, tournamentAutoStart: true, tournamentAutoPrize: true, tournamentMatchRooms: true, tournamentPublicListing: true, competitionRegistration: true, competitionVoting: true, competitionGifts: true, competitionResults: true, adminAutoJoinCompetition: true },
  lobby: { enabled: false, hostOnlyStart: true, autoJoin: true, manualInvite: true, countdownSeconds: 20, startingSeconds: 3, minPlayers: 2, maxPlayers: 4, seatOrder: ["red", "green", "yellow", "blue"] },
  gameDice: { customFace: false, faceImage: "", showLastRolled: true },
  business: { categories: [], registerCost: 200, fields: [], jobTypes: [], jobFields: [], profileSections: [] },
  roomControls: { voiceEnabled: true, videoEnabled: true, defaultSeats: 10, maxSeats: 10, showHostCrown: true, showSeatGear: true, showCoHostStar: true },
  roomList: { mode: "all", hideOffline: false, requireHost: false, requireCoHost: false, requireMember: false, minLive: 0, alwaysShowMine: true, adminSeesAll: true, showActive: true, showInactive: true },
  permissions: { coHostCanRemove: true, coHostCanMute: true, memberCanInvite: false, memberCanGift: true },
  content: { welcome: "", supportEmail: "", termsUrl: "", playStoreUrl: "", apkUrl: "" },
  membership: {
    paidEnabled: false,
    plans: [],
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
  },
  rewards: [],
  ads: [],
  siteContent: DEFAULT_SITE_CONTENT,
  coinPackages: [],
  coinOffers: [],
  giftCatalog: [],
  paymentGateway: { enabled: true, provider: "stripe", keyId: "", currency: "SAR", methods: { cards: true, googlePay: true, applePay: true, paypal: true, local: true } },
  moderation: {},
  uploadMaxMB: 10,
  featurePricing: { roomNameChange: 500, videoUnlock: 1000, coHostSlot: 500, extraPublicRoom: 1000 },
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
  diceDesigns: defaultDiceDesigns(),
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
    chess: defaultChessCfg(),
    boards: [],
    activeBoardId: "",
    tokenSlots: { enabled: false, slots: [{ dxPct: 0, dyPct: 0, sizePct: 100, rotateDeg: 0 }, { dxPct: 0, dyPct: 0, sizePct: 100, rotateDeg: 0 }, { dxPct: 0, dyPct: 0, sizePct: 100, rotateDeg: 0 }, { dxPct: 0, dyPct: 0, sizePct: 100, rotateDeg: 0 }] },
    // Ships OFF — the board looks exactly as before until an admin switches the
    // Token Placement Area panel on (/admin/token-areas).
    homeAreas: defaultHomeAreas(),
  },
  gameAnim: {
    diceRoll: true, diceStyle: "tumble", diceDisplaySeconds: 2, turnDelaySeconds: 1, tokenMove: true, moveStyle: "slide", winCelebration: true, winIntensity: "normal",
    captureFlash: true, coinGlow: true, soundEffects: true,
    turnAnim: true, turnAnimStyle: "glow",
    centerReach: { enabled: true, style: "bloom", speed: "normal" },
  },
  shield: { iconEnabled: true, glow: true, blink: false, particles: false, image: "", color: "#10b981", animationStyle: "pulse", speed: "normal" },
  gameTheme: { preset: "default", bgColor: "", bgImage: "", accent: "", music: { enabled: false, track: "", volumePct: 40 } },
  recording: {
    master: false, roomEnabled: false, callEnabled: false, retentionDays: 30, autoDelete: false, maxStorageMB: 0, userAccess: "adminOnly",
    modules: {
      voiceRoomVoice: false, voiceRoomChat: false, privateRoomVoice: false, privateRoomChat: false,
      competitionAudio: false, competitionChat: false, paidZoneVoice: false, paidZoneVideo: false, paidZoneChat: false,
      privateVoiceCall: false, privateVideoCall: false, personalChat: false, groupChat: false,
    },
    notify: { enabled: true, text: "This room is being recorded.", voiceRoom: true, privateRoom: true, competition: true, paidZoneCall: true, voiceCall: true, videoCall: true, chat: true },
  },
  activityReward: { enabled: false, name: "Startup Bonus", requiredMinutes: 60, continuousCoins: 50, accumulatedCoins: 25, gapMinutes: 3, dailyLimit: 0, maxPerUser: 0, notifyTitle: "Congratulations!", continuousMsg: "You earned {coins} coins for {hours} hour of continuous activity.", accumulatedMsg: "You earned {coins} coins for {hours} hour of accumulated activity." },
  freeCoins: { enabled: true, welcome: { enabled: true, amount: 100 }, dailyLogin: { enabled: false, amount: 25 }, event: { enabled: true, amount: 50 }, periodic: { enabled: false, intervalMinutes: 30, amount: 0, dailyLimit: 0, minLevel: 0 } },
  inactivity: {
    enabled: false, timeoutMinutes: 15, warningSeconds: 30, backgroundMonitor: false,
    exemptAdmins: true, exemptRoles: [], singleSession: true,
    rewardRequiresActivity: true, rewardGraceMinutes: 5, roomTimeoutSeconds: 60,
  },
  coinFees: {
    taxEnabled: false, taxLabel: "VAT", taxPct: 15,
    serviceEnabled: false, serviceLabel: "Service charge", servicePct: 0, serviceFixed: 0,
    showBreakdown: true,
  },
  privacy: {
    enabled: true, mutualFollowToView: false,
    dmLimitEnabled: true, maxUnansweredDMs: 4, unlockOnFollow: true,
  },
  loginSecurity: { enabled: true, maxAttempts: 5, lockoutMinutes: 15 },
  voiceQuality: { bitrateKbps: 32, dtx: false, red: true, noiseSuppression: true, echoCancellation: true, autoGainControl: true, voiceIsolation: true, stereo: false },
  deviceSecurity: { maxAccountsPerDevice: 0, maxDevicesPerAccount: 0, blockMultiAccountPerDevice: false, whitelistMode: false, retentionDays: 0, alertNewDevice: false, alertNewDeviceUser: false, alertMultiAccount: true, alertBlockedAttempt: true, alertFailedLogins: false, failedLoginThreshold: 5 },
  messaging: { types: { text: true, image: true, gif: true, sticker: true, video: true, audio: true, file: true, emoji: true }, maxFileMB: 50, blockedExtensions: [], allowedExtensions: [], allowAllTypes: false, allowDownload: true, allowForward: true, allowCopy: true, editWindowMin: 15, retentionDays: 0, virusScan: false, auditUploads: true, userEdit: true, userDelete: true, adminEditAny: true, adminDeleteAny: true, perUser: {} },
  fileStorage: { quotaGB: 0, maxFileMB: 200 },
  gameRules: { returnChancesOnRejoin: false },
  giftReceiverSharePct: 70,
  media: {
    libraryAccess: true,
    audioEnabled: true, videoEnabled: true, imageEnabled: true,
    audioPaid: false, audioPrice: 0,
    videoPaid: false, videoPrice: 0,
    imagePaid: false, imagePrice: 0,
  },
  paidZone: { enabled: true, joinCost: 500, audioPerMin: 10, videoPerMin: 20, callsEnabled: true, videoCallsEnabled: true, recordingEnabled: false, receiverRewardsEnabled: true, receiverSharePct: 70, monthlyCoins: 300, renewalDays: 30, graceDays: 3, autoRenew: true },
  withdraw: { coinsPerUnit: 10, currency: "SAR", feePct: 0, minCoins: 1000, maxCoins: 100000, autoApprove: false },
  levelRewards: { enabled: true, base: 20, perLevel: 10, cap: 500, xpPlay: 12, xpWin: 30, xpGift: 6, xpDailyLogin: 25, xpPurchase: 15 },
  agencyLevels: { enabled: true, metric: "members", tiers: [
    { id: "agl_bronze", name: "Bronze", badge: "🥉", color: "#b45309", minValue: 0 },
    { id: "agl_silver", name: "Silver", badge: "🥈", color: "#94a3b8", minValue: 5 },
    { id: "agl_gold", name: "Gold", badge: "🥇", color: "#f59e0b", minValue: 15 },
    { id: "agl_platinum", name: "Platinum", badge: "💎", color: "#38bdf8", minValue: 30 },
    { id: "agl_diamond", name: "Diamond", badge: "💠", color: "#22d3ee", minValue: 60 },
    { id: "agl_master", name: "Master", badge: "👑", color: "#a855f7", minValue: 100 },
  ] },
  lotusRewards: { enabled: false, notifyUser: true, validityDays: 0, tiers: [ { minCoins: 10000, flowers: 1 }, { minCoins: 50000, flowers: 5 }, { minCoins: 100000, flowers: 10 }, { minCoins: 500000, flowers: 50 }, { minCoins: 1000000, flowers: 100 } ] },
  lotus: { enabled: false, name: "Lotus Flower", coinToLotus: 1, lotusToCurrency: 0.1, currency: "SAR", minWithdraw: 100, maxWithdraw: 100000, dailyLimit: 0, feePct: 5, autoApprove: false, userSharePct: 65, agencySharePct: 5, companySharePct: 25, trustSharePct: 5, trustEnabled: true, gstPct: 18, conversionTiers: [
    { id: "ct_500", lotus: 500, value: 50, enabled: true },
    { id: "ct_800", lotus: 800, value: 80, enabled: true },
    { id: "ct_1000", lotus: 1000, value: 100, enabled: true },
    { id: "ct_2000", lotus: 2000, value: 200, enabled: true },
    { id: "ct_4000", lotus: 4000, value: 400, enabled: true },
    { id: "ct_5000", lotus: 5000, value: 500, enabled: true },
    { id: "ct_10000", lotus: 10000, value: 1000, enabled: true },
  ] },
  referral: { enabled: true, reward: 100, requireApproval: false, autoBlockDuplicates: true },
  captureProtection: { screenshot: true, recording: true, sharing: true, thirdParty: true, autoEndCall: false, warning: true, watermark: false, audioRecording: true, videoRecording: true, mirroring: true, allScreens: false, modules: { home: false, profile: false, chat: false, voiceRoom: false, wallet: true, paidZone: true, reels: false, tournaments: false, competitions: false } },
  gameSound: { pack: "classic", effects: {} },
  bgMusic: { enabled: false, volumePct: 35, screens: {} },
  avatarFrames: [],
  storeItems: [],
  googleClientId: "",
  androidFingerprint: "",
  luckySpin: { enabled: true, cooldownHours: 24, segments: [
    { label: "5", coins: 5, weight: 30 }, { label: "10", coins: 10, weight: 24 }, { label: "20", coins: 20, weight: 18 },
    { label: "Try again", coins: 0, weight: 10 }, { label: "50", coins: 50, weight: 10 }, { label: "100", coins: 100, weight: 5 },
    { label: "250", coins: 250, weight: 2 }, { label: "500", coins: 500, weight: 1 },
  ], extraChancesEnabled: true, dailyLoginChances: 1, winTaskChances: 1, buyCostCoins: 50, adChancesPerDay: 2, chanceExpiryDays: 0 },
  paymentQr: { enabled: true, imageUrl: "", upiId: "", note: "", currency: "₹" },
  productCategoryFields: [],
  labels: {},
  chat: { storeMessages: true, groupRetentionDays: 3, deleteForEveryone: true },
};

export async function fetchConfig(): Promise<AppConfig> {
  try {
    const res = await fetch(withBase("/api/admin/config"), { credentials: "include" });
    const data = await res.json().catch(() => ({}));
    return (data.config as AppConfig) ?? DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

/** Admin-only: persist a partial config change and get the full result back. */
export async function saveConfig(patch: Partial<AppConfig>): Promise<{ ok: boolean; config?: AppConfig; error?: string }> {
  try {
    const res = await fetch(withBase("/api/admin/config"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(patch),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (data.error as string) ?? "Save failed" };
    return { ok: true, config: data.config as AppConfig };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

interface ConfigContextValue {
  config: AppConfig;
  loading: boolean;
  reload: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

// Cache the last-loaded admin config so a page refresh restores the REAL saved
// values instantly (instead of flashing DEFAULT_CONFIG while the fetch runs,
// which made admin forms look "reset"). SSR-safe.
const CONFIG_CACHE_KEY = "lotus.config.v1";
function readConfigCache(): AppConfig | null {
  if (typeof window === "undefined") return null;
  try { const s = window.sessionStorage.getItem(CONFIG_CACHE_KEY); return s ? (JSON.parse(s) as AppConfig) : null; } catch { return null; }
}
function writeConfigCache(c: AppConfig) {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(c)); } catch { /* quota / private mode — ignore */ }
}

// The photo-less avatar settings, with the older photoEditor.defaultImage honoured
// as the picture when the newer field hasn't been set yet (so a client who
// uploaded one before this update doesn't lose it).
function avatarCfgOf(c: AppConfig) {
  return { ...(c.defaultAvatar ?? {}), imageUrl: c.defaultAvatar?.imageUrl || c.photoEditor?.defaultImage || "" };
}

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const c = await fetchConfig();
    setConfig(c);
    writeConfigCache(c);
    configureCurrency(c.paymentGateway?.currency);
    configureAvatarLabel(avatarCfgOf(c));
    setLoading(false);
  }, []);

  useEffect(() => {
    // Restore the cached (real) config immediately on refresh so forms seed from
    // the saved values, not defaults — then fetch the fresh copy in the background.
    const cached = readConfigCache();
    if (cached) { setConfig(cached); configureCurrency(cached.paymentGateway?.currency); configureAvatarLabel(avatarCfgOf(cached)); setLoading(false); }
    reload();
  }, [reload]);

  const value = useMemo(() => ({ config, loading, reload }), [config, loading, reload]);
  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext);
  // Safe fallback if used outside a provider (e.g. isolated admin sub-tree).
  if (!ctx) return { config: DEFAULT_CONFIG, loading: false, reload: async () => {} };
  return ctx;
}
