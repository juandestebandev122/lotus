// ============================================================
// LotusPlay Connect — Core domain types (Phase 1 + forward-looking)
// ============================================================

export type ID = string;

export type UserStatus = "online" | "offline" | "in-room" | "playing";

/** A gift another player sent to this user — shown on their profile. */
export interface ReceivedGift {
  id: string;
  giftId: string;
  emoji: string;
  name: string;
  cost: number;
  fromName: string;
  fromUserId?: string;
  /** Sender's permanent member ID number — shown beside their name. */
  fromPublicId?: string;
  at: string;
}

export interface User {
  id: ID;
  publicId?: string; // permanent, human-friendly member ID number (e.g. "100023") — never changes
  fullName: string;
  username: string;
  avatar: string; // url or initials-based fallback handled in <Avatar />
  ownedFrameIds?: string[]; // avatar frames bought from the frame shop (coins)
  equippedFrame?: string; // the frame currently worn ("" = none)
  // Validity-aware ownership: frameId → purchase date + expiry (null = permanent).
  frames?: Record<string, { at: string; expiresAt?: string | null }>;
  // Store ownership for backgrounds/name effects/badges + what's worn per slot.
  storeOwned?: Record<string, { at: string; expiresAt?: string | null }>;
  equipped?: { background?: string; nameEffect?: string; badge?: string; overlay?: string; dice?: string; board?: string; token?: string };
  vip?: boolean; // VIP member flag (admin-set) — unlocks VIP-only store items
  cover?: string;
  bio?: string;
  gender?: "male" | "female" | "other";
  country?: string;
  city?: string;
  dob?: string;
  level: number;
  xp?: number; // total experience points earned from in-app activity (drives level)
  coins: number;
  status: UserStatus;
  lastSeen?: string;
  verified?: boolean;
  role: "user" | "moderator" | "admin";
  adminRole?: "super_admin" | "admin" | "moderator" | "support";
  adminPermissions?: string[];
  mustChangePassword?: boolean; // admin forced a password reset on next login
  joinedAt: string;
  acceptedTermsAt?: string; // when the user accepted Terms + Privacy (gate on first login)
  stats: {
    followers: number;
    following: number;
    friends: number;
    roomsJoined: number;
    gamesPlayed: number;
    wins: number;
    tournamentWins: number;
  };
  receivedGifts?: ReceivedGift[];
  // Per-user privacy settings (Privacy & Security). Low-sensitivity, so exposed
  // via publicUser: `isPrivate`/`hideOnlineStatus`/`hideLastSeen` let other
  // clients render the right thing; the owner reads all of it on their settings.
  privacy?: UserPrivacy;
}

export type ProfileVisibility = "public" | "private";
export type WhoCanMessage = "everyone" | "followers" | "following" | "friends" | "nobody";
export interface UserPrivacy {
  profileVisibility?: ProfileVisibility; // private = only mutual-followers + owner + admins see full content
  whoCanMessage?: WhoCanMessage;         // who may start / send a DM
  hideOnlineStatus?: boolean;            // hide the online dot from others
  hideLastSeen?: boolean;                // hide "last seen" from others
  hideReadReceipts?: boolean;            // others won't see when you've read their messages
  hideFollowersList?: boolean;           // others can't open your followers list
  hideFollowingList?: boolean;           // others can't open your following list
}

export type FriendState = "friends" | "incoming" | "outgoing" | "none";

export interface Friend {
  user: User;
  state: FriendState;
  mutuals?: number;
}

export type NotificationType =
  | "friend_request"
  | "friend_accept"
  | "follow"
  | "message"
  | "room_invite"
  | "game_invite"
  | "tournament"
  | "reward"
  | "reel_like"
  | "reel_comment"
  | "reel_share"
  | "system";

export interface AppNotification {
  id: ID;
  type: NotificationType;
  actor?: Pick<User, "id" | "fullName" | "username" | "avatar">;
  text: string;
  time: string; // human label
  unread: boolean;
  cta?: { label: string; href?: string };
}

export type RoomType = "public" | "private" | "password" | "community";

export interface VoiceRoom {
  id: ID;
  name: string;
  host: Pick<User, "id" | "fullName" | "username" | "avatar">;
  category: string;
  type: RoomType;
  speakers: number;
  listeners: number;
  capacity: number;
  live: boolean;
  trending?: boolean;
  tags?: string[];
}

export interface AdminStat {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down";
  icon: string;
}
