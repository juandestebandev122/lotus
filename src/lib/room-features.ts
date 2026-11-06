// ─────────────────────────────────────────────────────────────────────────────
// PER-ROOM FEATURE CONFIGURATION
//
// Every voice/gaming room can store its OWN feature settings in the database
// (RoomRecord.features). Editing one room changes ONLY that room. Any setting a
// room does NOT override falls back to the app-wide / current behaviour, so every
// existing room keeps working exactly as before until an admin customises it.
//
// This file is the single source of truth for the whole catalogue: the admin
// panel renders its toggles straight from ROOM_FEATURE_SECTIONS, and the app reads
// a room's effective value through roomFeatureOn() / roomFeatureNum() /
// roomFeatureText(). To add a new per-room control later, add ONE line here — the
// admin UI and storage pick it up automatically ("supports any new feature added
// later").
// ─────────────────────────────────────────────────────────────────────────────

export type RoomFeatureKind = "toggle" | "number" | "text";

export interface RoomFeatureItem {
  key: string;
  label: string;
  kind: RoomFeatureKind;
  /** Default when the room hasn't overridden it (preserves current app behaviour). */
  def: boolean | number | string;
  hint?: string;
  /** 0 means "unlimited / use the app default" for number controls. */
  zeroMeans?: string;
}

export interface RoomFeatureSection {
  id: string;
  title: string;
  /** lucide icon name (resolved in the admin UI). */
  icon: string;
  items: RoomFeatureItem[];
}

/** The full per-room control catalogue, grouped exactly as the client specified. */
export const ROOM_FEATURE_SECTIONS: RoomFeatureSection[] = [
  {
    id: "voiceVideo",
    title: "Voice & Video",
    icon: "Mic",
    items: [
      { key: "voiceChat", label: "Voice Chat", kind: "toggle", def: true },
      { key: "videoChat", label: "Video Chat", kind: "toggle", def: true },
      { key: "camera", label: "Camera Permission", kind: "toggle", def: true },
      { key: "mic", label: "Microphone Permission", kind: "toggle", def: true },
      { key: "screenShare", label: "Screen Sharing", kind: "toggle", def: false },
      { key: "audioRecording", label: "Audio Recording", kind: "toggle", def: true, hint: "when the app's recording feature is on" },
      { key: "videoRecording", label: "Video Recording", kind: "toggle", def: false },
    ],
  },
  {
    id: "roomMgmt",
    title: "Room Management",
    icon: "Settings2",
    items: [
      { key: "maxCoHosts", label: "Maximum Co-Hosts", kind: "number", def: 0, zeroMeans: "use app default" },
      { key: "maxListeners", label: "Maximum Listeners", kind: "number", def: 0, zeroMeans: "unlimited" },
      { key: "maxParticipants", label: "Maximum Participants", kind: "number", def: 0, zeroMeans: "unlimited" },
      { key: "roomLock", label: "Room Lock", kind: "toggle", def: false },
      { key: "passwordProtected", label: "Password Protected Room", kind: "toggle", def: false },
      { key: "waitingRoom", label: "Waiting Room", kind: "toggle", def: false },
      { key: "inviteOnly", label: "Invite Only", kind: "toggle", def: false },
      { key: "publicRoom", label: "Public / Private Room", kind: "toggle", def: true, hint: "On = Public, Off = Private" },
      { key: "joinApproval", label: "Join Approval", kind: "toggle", def: false },
      { key: "autoMuteNew", label: "Auto Mute New Users", kind: "toggle", def: false },
    ],
  },
  {
    id: "media",
    title: "Media Controls",
    icon: "Music",
    items: [
      { key: "musicPlayer", label: "Music Player", kind: "toggle", def: true },
      { key: "uploadAudio", label: "Upload Audio", kind: "toggle", def: true },
      { key: "uploadVideo", label: "Upload Video", kind: "toggle", def: true },
      { key: "shareImages", label: "Share Images", kind: "toggle", def: true },
      { key: "shareFiles", label: "Share Files", kind: "toggle", def: true },
      { key: "shareDocuments", label: "Share Documents", kind: "toggle", def: true },
      { key: "shareGifs", label: "Share GIFs", kind: "toggle", def: true },
      { key: "voiceMessages", label: "Voice Messages", kind: "toggle", def: true },
      { key: "videoMessages", label: "Video Messages", kind: "toggle", def: true },
    ],
  },
  {
    id: "chat",
    title: "Chat Controls",
    icon: "MessageSquare",
    items: [
      { key: "textChat", label: "Text Chat", kind: "toggle", def: true },
      { key: "emoji", label: "Emoji", kind: "toggle", def: true },
      { key: "stickers", label: "Stickers", kind: "toggle", def: true },
      { key: "customStickers", label: "Custom Stickers", kind: "toggle", def: true },
      { key: "gifMessages", label: "GIF Messages", kind: "toggle", def: true },
      { key: "imageMessages", label: "Image Messages", kind: "toggle", def: true },
      { key: "deleteMessages", label: "Delete Messages", kind: "toggle", def: true },
      { key: "pinMessages", label: "Pin Messages", kind: "toggle", def: true },
      { key: "mentions", label: "Mention (@)", kind: "toggle", def: true },
      { key: "replyMessages", label: "Reply Messages", kind: "toggle", def: true },
      { key: "forwardMessages", label: "Forward Messages", kind: "toggle", def: true },
    ],
  },
  {
    id: "games",
    title: "Game Controls",
    icon: "Gamepad2",
    items: [
      { key: "games", label: "Enable Games", kind: "toggle", def: true },
      { key: "ludo", label: "Ludo", kind: "toggle", def: true },
      { key: "carrom", label: "Carrom", kind: "toggle", def: true },
      { key: "chess", label: "Chess", kind: "toggle", def: true },
      { key: "quiz", label: "Quiz", kind: "toggle", def: true },
      { key: "spinWheel", label: "Spin Wheel", kind: "toggle", def: true },
      { key: "miniGames", label: "Mini Games", kind: "toggle", def: true },
      { key: "tournamentMode", label: "Tournament Mode", kind: "toggle", def: true },
      { key: "practiceMode", label: "Practice Mode", kind: "toggle", def: true },
      { key: "spectatorMode", label: "Spectator Mode", kind: "toggle", def: true },
    ],
  },
  {
    id: "giftsCoins",
    title: "Gift & Coin Controls",
    icon: "Gift",
    items: [
      { key: "virtualGifts", label: "Virtual Gifts", kind: "toggle", def: true },
      { key: "luckyGifts", label: "Lucky Gifts", kind: "toggle", def: true },
      { key: "coinTransfer", label: "Coin Transfer", kind: "toggle", def: true },
      { key: "paidGifts", label: "Paid Gifts", kind: "toggle", def: true },
      { key: "giftAnimation", label: "Gift Animation", kind: "toggle", def: true },
      { key: "luckyDraw", label: "Lucky Draw", kind: "toggle", def: true },
      { key: "luckySpin", label: "Lucky Spin", kind: "toggle", def: true },
      { key: "walletAccess", label: "Wallet Access", kind: "toggle", def: true },
    ],
  },
  {
    id: "userPerms",
    title: "User Permissions",
    icon: "UserCheck",
    items: [
      { key: "userMicRequest", label: "Allow User Mic Request", kind: "toggle", def: true },
      { key: "userCameraRequest", label: "Allow Camera Request", kind: "toggle", def: true },
      { key: "userShareMedia", label: "Allow User to Share Media", kind: "toggle", def: true },
      { key: "userShareScreen", label: "Allow User to Share Screen", kind: "toggle", def: false },
      { key: "userSendStickers", label: "Allow User to Send Stickers", kind: "toggle", def: true },
      { key: "userSendGifts", label: "Allow User to Send Gifts", kind: "toggle", def: true },
      { key: "userCreatePolls", label: "Allow User to Create Polls", kind: "toggle", def: true },
    ],
  },
  {
    id: "moderation",
    title: "Moderation",
    icon: "Shield",
    items: [
      { key: "kickUsers", label: "Kick Users", kind: "toggle", def: true },
      { key: "banUsers", label: "Ban Users", kind: "toggle", def: true },
      { key: "tempBan", label: "Temporary Ban", kind: "toggle", def: true },
      { key: "muteUsers", label: "Mute Users", kind: "toggle", def: true },
      { key: "removeCoHost", label: "Remove Co-Host", kind: "toggle", def: true },
      { key: "blockMediaSharing", label: "Block Media Sharing", kind: "toggle", def: false },
      { key: "blockChat", label: "Block Chat", kind: "toggle", def: false },
      { key: "profanityFilter", label: "Profanity Filter", kind: "toggle", def: false },
      { key: "spamProtection", label: "Spam Protection", kind: "toggle", def: false },
    ],
  },
  {
    id: "appearance",
    title: "Room Appearance",
    icon: "Palette",
    items: [
      { key: "roomTheme", label: "Room Theme", kind: "text", def: "", hint: "theme name / colour" },
      { key: "backgroundImage", label: "Background Image", kind: "text", def: "", hint: "image URL (optional)" },
      { key: "backgroundMusic", label: "Background Music", kind: "toggle", def: true },
      { key: "welcomeMessage", label: "Welcome Message", kind: "text", def: "", hint: "shown when a member joins" },
      { key: "entryAnimation", label: "Entry Animation", kind: "toggle", def: true },
      { key: "exitAnimation", label: "Exit Animation", kind: "toggle", def: true },
      { key: "roomLogo", label: "Room Logo", kind: "text", def: "", hint: "image URL (optional)" },
      { key: "roomBanner", label: "Room Banner", kind: "text", def: "", hint: "image URL (optional)" },
    ],
  },
  {
    id: "logs",
    title: "Recording & Logs",
    icon: "FileText",
    items: [
      { key: "saveChatHistory", label: "Save Chat History", kind: "toggle", def: true },
      { key: "saveVoiceLogs", label: "Save Voice Logs", kind: "toggle", def: false },
      { key: "saveJoinLeave", label: "Save Join/Leave History", kind: "toggle", def: true },
      { key: "saveGiftHistory", label: "Save Gift History", kind: "toggle", def: true },
      { key: "saveGameHistory", label: "Save Game History", kind: "toggle", def: true },
      { key: "saveCoinTx", label: "Save Coin Transactions", kind: "toggle", def: true },
      { key: "exportReports", label: "Export Room Reports", kind: "toggle", def: true },
    ],
  },
];

/** All items flattened, for quick key → item lookups. */
export const ROOM_FEATURE_ITEMS: Record<string, RoomFeatureItem> = Object.fromEntries(
  ROOM_FEATURE_SECTIONS.flatMap((s) => s.items.map((it) => [it.key, it]))
);

/** A room's stored overrides (only the keys the admin has changed). */
export type RoomFeatures = Record<string, boolean | number | string>;

/** Effective ON/OFF for a toggle key: room override → catalogue default. */
export function roomFeatureOn(features: RoomFeatures | undefined, key: string): boolean {
  const v = features?.[key];
  if (typeof v === "boolean") return v;
  const def = ROOM_FEATURE_ITEMS[key]?.def;
  return typeof def === "boolean" ? def : true;
}

/** Effective number for a number key (0 = unlimited / use app default). */
export function roomFeatureNum(features: RoomFeatures | undefined, key: string, appDefault = 0): number {
  const v = features?.[key];
  if (typeof v === "number" && v > 0) return v;
  const def = ROOM_FEATURE_ITEMS[key]?.def;
  if (typeof def === "number" && def > 0) return def;
  return appDefault;
}

/** Effective text for a text key. */
export function roomFeatureText(features: RoomFeatures | undefined, key: string): string {
  const v = features?.[key];
  if (typeof v === "string" && v.trim()) return v;
  const def = ROOM_FEATURE_ITEMS[key]?.def;
  return typeof def === "string" ? def : "";
}

/** The room's visual appearance, resolved from its features (override → default).
 *  `theme` is used as an accent colour ONLY when it's a valid #hex; otherwise the
 *  default violet accent is kept. Used by BOTH the live room and the Preview. */
export interface RoomAppearance { bgImage: string; banner: string; logo: string; welcome: string; theme: string; accent: string }
export function roomAppearance(features: RoomFeatures | undefined): RoomAppearance {
  const theme = roomFeatureText(features, "roomTheme").trim();
  const hex = /^#?[0-9a-fA-F]{6}$/.test(theme) ? (theme.startsWith("#") ? theme : `#${theme}`) : "";
  return {
    bgImage: roomFeatureText(features, "backgroundImage").trim(),
    banner: roomFeatureText(features, "roomBanner").trim(),
    logo: roomFeatureText(features, "roomLogo").trim(),
    welcome: roomFeatureText(features, "welcomeMessage").trim(),
    theme,
    accent: hex, // "" = keep the default theme accent
  };
}

/** Sanitise an incoming features object to only known keys + correct types. Used
 *  by the admin save API so a room can never store junk. */
export function sanitizeRoomFeatures(input: unknown): RoomFeatures {
  const out: RoomFeatures = {};
  if (!input || typeof input !== "object") return out;
  const rec = input as Record<string, unknown>;
  for (const [key, item] of Object.entries(ROOM_FEATURE_ITEMS)) {
    const v = rec[key];
    if (v === undefined || v === null) continue;
    if (item.kind === "toggle" && typeof v === "boolean") out[key] = v;
    else if (item.kind === "number" && typeof v === "number" && Number.isFinite(v)) out[key] = Math.max(0, Math.min(100000, Math.floor(v)));
    else if (item.kind === "text" && typeof v === "string") out[key] = v.slice(0, 2000);
  }
  return out;
}
