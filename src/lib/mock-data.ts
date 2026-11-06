import type {
  User,
  Friend,
  AppNotification,
  VoiceRoom,
  AdminStat,
} from "./types";

// ------------------------------------------------------------
// Helper to build users with sensible defaults
// ------------------------------------------------------------
type UserSeed = Partial<Omit<User, "stats">> &
  Pick<User, "id" | "fullName" | "username"> & { stats?: Partial<User["stats"]> };

function mkUser(partial: UserSeed): User {
  const { stats, ...rest } = partial;
  return {
    avatar: "",
    level: 1,
    coins: 0,
    status: "offline",
    role: "user",
    joinedAt: "2025-01-01",
    ...rest,
    stats: {
      followers: 0,
      following: 0,
      friends: 0,
      roomsJoined: 0,
      gamesPlayed: 0,
      wins: 0,
      tournamentWins: 0,
      ...(stats ?? {}),
    },
  };
}

// The signed-in demo user (mirrors the reference mockups)
export const CURRENT_USER: User = mkUser({
  id: "u_me",
  fullName: "Rahul Sharma",
  username: "rahul.sharma",
  bio: "Living life and enjoying the game. 🪷",
  gender: "male",
  country: "India",
  city: "Mumbai, Maharashtra",
  dob: "1998-06-12",
  level: 12,
  coins: 2450,
  status: "online",
  verified: true,
  role: "user",
  joinedAt: "2024-08-03",
  stats: {
    followers: 1280,
    following: 342,
    friends: 86,
    roomsJoined: 64,
    gamesPlayed: 85,
    wins: 62,
    tournamentWins: 4,
  },
});

export const USERS: User[] = [
  mkUser({
    id: "u_aryan",
    fullName: "Aryan Verma",
    username: "aryanv",
    bio: "Room host • Chess addict ♟️",
    country: "India",
    city: "Delhi",
    level: 24,
    coins: 5860,
    status: "in-room",
    verified: true,
    stats: { followers: 5230, following: 210, friends: 140, gamesPlayed: 410, wins: 290, tournamentWins: 11 },
  }),
  mkUser({
    id: "u_muskan",
    fullName: "Muskan Gupta",
    username: "muskan",
    bio: "Co-host @ Chill Hangout 🎧",
    country: "India",
    city: "Jaipur",
    level: 21,
    coins: 5120,
    status: "in-room",
    verified: true,
    stats: { followers: 4110, following: 320, friends: 122, gamesPlayed: 360, wins: 240, tournamentWins: 8 },
  }),
  mkUser({
    id: "u_karan",
    fullName: "Karan Singh",
    username: "karan_s",
    bio: "Ludo champion 🎲",
    country: "India",
    city: "Chandigarh",
    level: 19,
    coins: 4750,
    status: "playing",
    stats: { followers: 3300, following: 180, friends: 98, gamesPlayed: 520, wins: 360, tournamentWins: 9 },
  }),
  mkUser({
    id: "u_sneha",
    fullName: "Sneha Verma",
    username: "sneha.v",
    bio: "Music lover • Singer 🎵",
    country: "India",
    city: "Pune",
    level: 16,
    coins: 4120,
    status: "online",
    stats: { followers: 2890, following: 401, friends: 156, gamesPlayed: 190, wins: 110, tournamentWins: 2 },
  }),
  mkUser({
    id: "u_rohit",
    fullName: "Rohit Kumar",
    username: "rohitk",
    bio: "Just here for the vibes ✨",
    country: "India",
    city: "Lucknow",
    level: 14,
    coins: 3980,
    status: "online",
    stats: { followers: 1980, following: 250, friends: 77, gamesPlayed: 240, wins: 150, tournamentWins: 3 },
  }),
  mkUser({
    id: "u_anjali",
    fullName: "Anjali Mehta",
    username: "anjali_m",
    bio: "Community builder 🌸",
    country: "India",
    city: "Ahmedabad",
    level: 13,
    coins: 3450,
    status: "offline",
    lastSeen: "2h ago",
    stats: { followers: 1620, following: 290, friends: 64, gamesPlayed: 130, wins: 70, tournamentWins: 1 },
  }),
  mkUser({
    id: "u_vikram",
    fullName: "Vikram Khanna",
    username: "vikram.k",
    bio: "Tech & chess ♞",
    country: "India",
    city: "Bengaluru",
    level: 18,
    coins: 4300,
    status: "online",
    stats: { followers: 2410, following: 160, friends: 88, gamesPlayed: 300, wins: 200, tournamentWins: 5 },
  }),
  mkUser({
    id: "u_pooja",
    fullName: "Pooja Sharma",
    username: "pooja.s",
    bio: "Tamil community 💛",
    country: "India",
    city: "Chennai",
    level: 11,
    coins: 2900,
    status: "offline",
    lastSeen: "1d ago",
    stats: { followers: 1340, following: 220, friends: 53, gamesPlayed: 90, wins: 44, tournamentWins: 0 },
  }),
];

export function findUser(id: string): User | undefined {
  if (id === CURRENT_USER.id) return CURRENT_USER;
  return USERS.find((u) => u.id === id);
}

// ------------------------------------------------------------
// Friends (relative to current user)
// ------------------------------------------------------------
export const FRIENDS: Friend[] = [
  { user: USERS[0], state: "friends", mutuals: 24 },
  { user: USERS[1], state: "friends", mutuals: 18 },
  { user: USERS[2], state: "friends", mutuals: 31 },
  { user: USERS[3], state: "friends", mutuals: 12 },
  { user: USERS[4], state: "incoming", mutuals: 9 },
  { user: USERS[6], state: "incoming", mutuals: 6 },
  { user: USERS[5], state: "outgoing", mutuals: 4 },
  { user: USERS[7], state: "none", mutuals: 2 },
];

// ------------------------------------------------------------
// Notifications
// ------------------------------------------------------------
export const NOTIFICATIONS: AppNotification[] = [
  {
    id: "n1",
    type: "room_invite",
    actor: USERS[0],
    text: "invited you to join room “Chill Hangout”",
    time: "2m ago",
    unread: true,
    cta: { label: "Join", href: "/rooms" },
  },
  {
    id: "n2",
    type: "game_invite",
    actor: USERS[1],
    text: "invited you to play Ludo",
    time: "5m ago",
    unread: true,
    cta: { label: "Play", href: "/games" },
  },
  {
    id: "n3",
    type: "friend_request",
    actor: USERS[4],
    text: "sent you a friend request",
    time: "21m ago",
    unread: true,
    cta: { label: "View", href: "/friends" },
  },
  {
    id: "n4",
    type: "tournament",
    text: "Tournament starting soon — Ludo Championship",
    time: "1h ago",
    unread: false,
    cta: { label: "Details", href: "/notifications" },
  },
  {
    id: "n5",
    type: "reward",
    text: "You received 100 coins for daily login 🎁",
    time: "3h ago",
    unread: false,
  },
  {
    id: "n6",
    type: "follow",
    actor: USERS[3],
    text: "started following you",
    time: "5h ago",
    unread: false,
    cta: { label: "Profile", href: "/u/sneha.v" },
  },
  {
    id: "n7",
    type: "reward",
    text: "Congratulations! You earned the “Active Player” badge 🏅",
    time: "1d ago",
    unread: false,
  },
];

// ------------------------------------------------------------
// Voice rooms (preview for the home dashboard; Phase 2 builds it out)
// ------------------------------------------------------------
export const ROOMS: VoiceRoom[] = [
  {
    id: "r1",
    name: "Chill Hangout",
    host: USERS[0],
    category: "Friendship",
    type: "public",
    speakers: 4,
    listeners: 86,
    capacity: 10,
    live: true,
    trending: true,
    tags: ["chill", "music", "talk"],
  },
  {
    id: "r2",
    name: "Music Lovers",
    host: USERS[3],
    category: "Music",
    type: "public",
    speakers: 6,
    listeners: 142,
    capacity: 12,
    live: true,
    trending: true,
    tags: ["live", "singing"],
  },
  {
    id: "r3",
    name: "Game On",
    host: USERS[2],
    category: "Gaming",
    type: "public",
    speakers: 5,
    listeners: 73,
    capacity: 10,
    live: true,
    tags: ["ludo", "chess"],
  },
  {
    id: "r4",
    name: "Tamil Community",
    host: USERS[7],
    category: "Tamil Community",
    type: "community",
    speakers: 3,
    listeners: 58,
    capacity: 12,
    live: true,
    tags: ["tamil", "culture"],
  },
];

// ------------------------------------------------------------
// Admin analytics
// ------------------------------------------------------------
export const ADMIN_STATS: AdminStat[] = [
  { label: "Total Users", value: "12,856", delta: "+12.5%", trend: "up", icon: "users" },
  { label: "Active Rooms", value: "256", delta: "+8.2%", trend: "up", icon: "mic" },
  { label: "Games Played", value: "8,965", delta: "+15.3%", trend: "up", icon: "gamepad" },
  { label: "Revenue", value: "₹1,25,430", delta: "+10.6%", trend: "up", icon: "coins" },
];

export const ADMIN_USER_ROWS: User[] = [CURRENT_USER, ...USERS];
