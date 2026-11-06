"use client";

import { withBase } from "./base-path";

// ============================================================
// Admin Panel client helpers — talk to the /api/admin/* routes.
// All are admin-guarded on the server (403 for non-admins).
// ============================================================

export interface AdminStats {
  totalUsers: number;
  onlineUsers: number;
  activeUsers24h: number;
  admins: number;
  suspended: number;
  totalRooms: number;
  liveRooms: number;
  privateRooms: number;
  pendingReports: number;
  gamesPlayed: number;
  revenue: number;
  coins: number;
  newUsersToday: number;
  newUsers7d: number;
  newUsers30d: number;
  growth: number[];
  recent: { text: string; at: string }[];
}

export interface SupportTicket {
  id: string;
  userId?: string;
  publicId?: string;
  username?: string;
  userName: string;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved";
  reply?: string;
  createdAt: string;
  // Set when the message came from the PUBLIC contact form (no account), so the
  // panel can show the sender's email and offer a mailto reply instead of the
  // in-app reply, which would reach nobody.
  email?: string;
  source?: "app" | "contact-form";
}

export interface AdminLog {
  id: string;
  admin: string;
  adminId?: string;
  action: string;
  at: string;
  // Structured fields (Reset & Recovery) — shown in the audit view when present.
  roomId?: string;
  matchId?: string;
  reason?: string;
  category?: string;
}

export type AccountStatus = "active" | "inactive" | "suspended" | "blocked" | "banned" | "pending" | "rejected";

export interface AdminUser {
  id: string;
  publicId?: string;
  fullName: string;
  username: string;
  avatar: string;
  email: string;
  phone: string;
  role: "user" | "moderator" | "admin";
  adminRole?: string;
  verified: boolean;
  status: string;
  accountStatus: AccountStatus;
  mustChangePassword?: boolean;
  walletFrozen?: boolean;
  messagingDisabled?: boolean; // admin turned this user's personal (DM) messaging off
  coins: number;
  coinsPurchased?: number;
  coinsSpent?: number;
  level: number;
  xp?: number;
  joinedAt: string;
  lastSeen: string;
  stats: { followers: number; following: number; friends: number; gamesPlayed: number; wins: number; tournamentWins: number };
  // Account provenance — who created it, how, and when.
  createdVia?: "self" | "admin" | "business" | "system";
  createdByName?: string;
  createdById?: string;
  createdByRole?: string;
  createdAt?: string;
  createdIp?: string;
  // Agency membership (for the Users list "Agency" column + filter).
  agencyName?: string;
  agencyId?: string;
  agencyRole?: string;
  // Refer-a-friend: who invited this user (empty = joined without a referral).
  referredById?: string;
  referredByName?: string;
  // Temporary login lock ("too many failed attempts").
  locked?: boolean;
  lockMinutes?: number;
  // Number of groups/rooms this user has joined.
  groupCount?: number;
}

export interface AdminRoom {
  id: string;
  name: string;
  ownerId: string;
  hostName: string;
  category: string;
  type: string;
  capacity: number;
  live: boolean;
  /** People actually in the room right now (fresh room heartbeat). */
  occupants?: number;
  hostPresent?: boolean;
  coHostPresent?: boolean;
  presentNames?: string[];
  status: "active" | "inactive" | "suspended";
  suspendFrom: string;
  suspendUntil: string;
  suspendReason: string;
  image?: string;
  description: string;
  announcement: string;
  coAdminIds: string[];
  invitedIds: string[];
  coAdminCount: number;
  invitedCount: number;
  createdAt: string;
  /** true = "Hide Admin": admins don't show in this group's member list. */
  hideAdmins?: boolean;
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(withBase(path), { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchAdminStats(): Promise<AdminStats | null> {
  const data = await getJson<{ stats: AdminStats }>("/api/admin/stats");
  return data?.stats ?? null;
}

// ---- Unified Pending Approvals summary (v405) ----
export interface PendingCategory { key: string; label: string; count: number; href: string; group: string }
export interface PendingApprovalsSummary { total: number; groups: string[]; categories: PendingCategory[] }

/** Live count of every approval queue across the app + a grand total. */
export async function fetchPendingSummary(): Promise<PendingApprovalsSummary | null> {
  const data = await getJson<{ summary: PendingApprovalsSummary }>("/api/admin/pending-summary");
  return data?.summary ?? null;
}

export interface ApprovalArrival { id: string; text: string; time: string; unread: boolean; href?: string }

// Review pages a pending-approval alert can point at. Device/security and room
// activity alerts are left out — they are not an approval queue.
const APPROVAL_HREFS = [
  "/admin/transactions", "/admin/coin-purchases", "/admin/referrals", "/admin/store",
  "/admin/registrations", "/admin/kyc", "/admin/photo-editor", "/admin/documents",
  "/admin/agencies", "/admin/agency-users", "/admin/feature-requests", "/admin/paid-zone",
  "/admin/tournaments", "/admin/competitions", "/admin/business", "/admin/jobs",
  "/admin/moderation", "/admin/records", "/admin/support", "/admin/lotus",
];

/** Newest admin alerts that belong to an approval queue, one row per event. */
export async function fetchApprovalArrivals(): Promise<ApprovalArrival[]> {
  const data = await getJson<{ log: ApprovalArrival[] }>("/api/admin/notify?adminsOnly=1");
  const seen = new Set<string>();
  const out: ApprovalArrival[] = [];
  for (const n of data?.log ?? []) {
    const href = n.href ?? "";
    if (!APPROVAL_HREFS.some((h) => href === h || href.startsWith(h + "/") || href.startsWith(h + "?"))) continue;
    const key = `${n.time}|${n.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
    if (out.length >= 12) break;
  }
  return out;
}

// ---- Approval History ----
export interface ApprovalHistoryRow {
  id: string;
  category: string; label: string; group: string; href: string;
  itemId: string;
  subject: string;
  userId?: string; userName?: string; userPublicId?: string;
  status: string;
  decidedBy?: string;
  decidedAt?: string;
  requestedAt?: string;
  amount?: string;
  note?: string;
  source: "record" | "log";
}
export interface ApprovalHistory { groups: string[]; rows: ApprovalHistoryRow[] }

/** Every completed approval decision across all queues, newest first. */
export async function fetchApprovalHistory(): Promise<ApprovalHistory | null> {
  const data = await getJson<{ history: ApprovalHistory }>("/api/admin/approvals/history");
  return data?.history ?? null;
}

// ---- Last Played Match History (v406) ----
export interface MatchHistoryRow {
  id: string; game: string; roomId: string; roomName: string;
  at: string; status: "completed" | "abandoned" | "live";
  winnerName?: string; players: string[]; playerCount: number;
  totalRolls: number; durationSec?: number; createdBy?: string;
}
export interface MatchPlayerStat {
  id?: string; name: string; agency?: string; isWinner: boolean;
  counts: Record<number, number>; total: number; sixes: number; sixPct: number; avg: number; maxConsecutiveSixes: number;
}
export interface MatchMoveRow { n: number; at: string; type: string; by: string; value?: number; text: string }
export interface MatchDetail {
  id: string; game: string; roomId: string; roomName: string;
  createdBy?: string; createdAt?: string; endedAt?: string; durationSec?: number;
  status: "completed" | "abandoned" | "live";
  winnerName?: string; spectatorCount?: number;
  totalPlayers: number; totalRolls: number; totalSixes: number; totalCuts: number; tokensHome: number;
  finishOrder: string[]; players: MatchPlayerStat[]; rolls: MatchMoveRow[]; timeline: MatchMoveRow[];
}

export async function fetchMatchHistory(opts?: { range?: string; from?: string; to?: string; q?: string }): Promise<MatchHistoryRow[]> {
  const p = new URLSearchParams();
  if (opts?.range) p.set("range", opts.range);
  if (opts?.from) p.set("from", opts.from);
  if (opts?.to) p.set("to", opts.to);
  if (opts?.q) p.set("q", opts.q);
  const data = await getJson<{ matches: MatchHistoryRow[] }>(`/api/admin/match-history?${p.toString()}`);
  return data?.matches ?? [];
}

export async function fetchMatchDetail(id: string): Promise<MatchDetail | null> {
  const data = await getJson<{ detail: MatchDetail }>(`/api/admin/match-history?id=${encodeURIComponent(id)}`);
  return data?.detail ?? null;
}

// ---- Room Activities dashboard (v200) ----
export interface RaActiveRoom {
  id: string; name: string; hostId: string; hostName: string; coHosts: string[];
  type: "Normal" | "Competition" | "Agency"; agencyName?: string;
  createdAt: string; memberCount: number; speakingCount: number;
  status: "Active" | "Locked"; category: string;
}
export interface RaEvent { id: string; roomId: string; roomName: string; type: string; label: string; target: string; actorName: string; actorId: string; at: string; }
export interface RaRoundResult { name: string; total: number; average: number; rank: number; qualified?: boolean; }
export interface RaCompetition {
  id: string; roomId: string; roomName: string; title: string; status: string;
  hostName: string; participants: number; votes: number;
  createdAt: string; startedAt?: string; endedAt?: string; resultsAt?: string;
  rounds: { id: string; name: string; status: string; startedAt?: string; completedAt?: string; results: RaRoundResult[] }[];
  winners: { name: string; total: number; rank: number }[];
  modLog: { id: string; at: string; actorName: string; targetName: string; action: string; reason?: string; note?: string; coins?: number; prevScore?: number; newScore?: number }[];
}
export interface RaChatRoom { roomId: string; roomName: string; total: number; deleted: number; }
export interface RaDeletedMsg { roomName: string; userName: string; text: string; deletedBy?: string; deletedAt?: string; }
export interface RaGift { at: string; fromName: string; toName: string; giftName: string; emoji: string; cost: number; context: string; }
export interface RoomActivityReport {
  totalActiveRooms: number; totalUsersJoined: number; totalLeaves: number;
  totalTimeMinutes: number; totalGifts: number; totalGiftCoins: number;
  totalCompetitions: number; totalMessages: number; totalKicks: number;
  byDay: { date: string; joins: number; gifts: number; giftCoins: number; competitions: number; messages: number }[];
}
export interface RoomActivityDashboard {
  generatedAt: string;
  range: { from?: string; to?: string };
  rooms: RaActiveRoom[];
  events: RaEvent[];
  competitions: RaCompetition[];
  chatRooms: RaChatRoom[];
  deletedMessages: RaDeletedMsg[];
  gifts: RaGift[];
  report: RoomActivityReport;
}

export async function fetchRoomActivities(from?: string, to?: string, roomId?: string): Promise<RoomActivityDashboard | null> {
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  if (roomId) qs.set("roomId", roomId);
  const q = qs.toString();
  return getJson<RoomActivityDashboard>(`/api/admin/room-activities${q ? `?${q}` : ""}`);
}

export interface RaMember { id: string; name: string; username: string; avatar: string; seated: boolean; isHost: boolean; isCoHost: boolean; }
export async function fetchRoomMembers(roomId: string): Promise<RaMember[]> {
  const data = await getJson<{ members: RaMember[] }>(`/api/admin/room-activities?members=${encodeURIComponent(roomId)}`);
  return data?.members ?? [];
}

export async function roomActivityControl(action: string, roomId: string, targetId?: string): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch(withBase("/api/admin/room-activities"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action, roomId, targetId }),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, message: data.message } : { ok: false, error: data.error || "Action failed" };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const data = await getJson<{ users: AdminUser[] }>("/api/admin/users");
  return data?.users ?? [];
}

export interface UserLoginEvent { at: string; ip?: string; device?: string; method?: string; deviceId?: string; location?: string; isp?: string; success?: boolean; at2?: string }
export interface UserAuditEntry { id: string; admin: string; action: string; at: string }
export interface UserDeviceSummary { currentDevice?: string; os?: string; model?: string; ip?: string; location?: string; lastLogin?: string; totalDevices: number; totalLogins: number; online: boolean; deviceId?: string }
export interface UserActionEntry { id: string; at: string; kind: string; detail: string; roomId?: string; roomName?: string; coins?: number; status?: string }
export interface UserActivity { loginHistory: UserLoginEvent[]; auditLog: UserAuditEntry[]; actionHistory: UserActionEntry[]; deviceSummary?: UserDeviceSummary }

export async function fetchUserActivity(id: string): Promise<UserActivity> {
  const data = await getJson<UserActivity>(`/api/admin/users/${id}`);
  return data ?? { loginHistory: [], auditLog: [], actionHistory: [] };
}

// ---- Company Profit Coins ----
export interface CompanyProfitEntry { id: string; at: string; userId: string; userName: string; type: string; coins: number; ref?: string; note?: string }
export interface CompanyProfitReport {
  totalLifetime: number; today: number; weekly: number; monthly: number; ledgerTotal: number;
  byType: { type: string; coins: number; count: number }[];
  entries: CompanyProfitEntry[]; totalCount: number;
  referralPaid: number;
}
export async function fetchCompanyProfit(params?: { from?: string; to?: string; type?: string; q?: string }): Promise<CompanyProfitReport> {
  const qs = new URLSearchParams();
  if (params?.from) qs.set("from", params.from);
  if (params?.to) qs.set("to", params.to);
  if (params?.type && params.type !== "all") qs.set("type", params.type);
  if (params?.q) qs.set("q", params.q);
  const data = await getJson<CompanyProfitReport>(`/api/admin/company-profit${qs.toString() ? `?${qs}` : ""}`);
  return data ?? { totalLifetime: 0, today: 0, weekly: 0, monthly: 0, ledgerTotal: 0, byType: [], entries: [], totalCount: 0, referralPaid: 0 };
}

// ---- User Profit (coins users earned) ----
export interface UserProfitEntry { id: string; at: string; userId: string; userName: string; type: string; coins: number; note?: string }
export interface UserProfitReport {
  totalLifetime: number; today: number; weekly: number; monthly: number; ledgerTotal: number;
  byType: { type: string; coins: number; count: number }[];
  topEarners: { userId: string; userName: string; coins: number; count: number }[];
  entries: UserProfitEntry[]; totalCount: number;
}
export async function fetchUserProfit(params?: { from?: string; to?: string; type?: string; q?: string }): Promise<UserProfitReport> {
  const qs = new URLSearchParams();
  if (params?.from) qs.set("from", params.from);
  if (params?.to) qs.set("to", params.to);
  if (params?.type && params.type !== "all") qs.set("type", params.type);
  if (params?.q) qs.set("q", params.q);
  const data = await getJson<UserProfitReport>(`/api/admin/user-profit${qs.toString() ? `?${qs}` : ""}`);
  return data ?? { totalLifetime: 0, today: 0, weekly: 0, monthly: 0, ledgerTotal: 0, byType: [], topEarners: [], entries: [], totalCount: 0 };
}

// ---- Agent (Agency) Profit ----
export interface AgentProfitEntry { id: string; at: string; agencyId: string; agencyPublicId: string; agencyName: string; memberId: string; memberName: string; memberPublicId?: string; senderName: string; senderId?: string; senderPublicId?: string; coins: number; ref?: string; note?: string }
export interface AgentProfitReport {
  totalLifetime: number; today: number; weekly: number; monthly: number; ledgerTotal: number;
  byAgency: { agencyId: string; agencyPublicId: string; agencyName: string; coins: number; count: number }[];
  allAgencies: { agencyId: string; agencyPublicId: string; agencyName: string; earnings: number }[];
  entries: AgentProfitEntry[]; totalCount: number;
}
export async function fetchAgentProfit(params?: { from?: string; to?: string; agencyId?: string; q?: string }): Promise<AgentProfitReport> {
  const qs = new URLSearchParams();
  if (params?.from) qs.set("from", params.from);
  if (params?.to) qs.set("to", params.to);
  if (params?.agencyId && params.agencyId !== "all") qs.set("agencyId", params.agencyId);
  if (params?.q) qs.set("q", params.q);
  const data = await getJson<AgentProfitReport>(`/api/admin/agent-profit${qs.toString() ? `?${qs}` : ""}`);
  return data ?? { totalLifetime: 0, today: 0, weekly: 0, monthly: 0, ledgerTotal: 0, byAgency: [], allAgencies: [], entries: [], totalCount: 0 };
}

// ---- Online Now (dashboard drill-down) ----
export interface OnlineUser {
  id: string; publicId: string; fullName: string; username: string; avatar: string;
  gender?: string; country?: string; city?: string;
  email?: string; phone?: string;
  registeredAt: string; currentLoginAt?: string; lastLoginAt?: string; lastSeen?: string;
  roomId?: string; roomName?: string;
  device?: string; ip?: string;
  location?: string; deviceId?: string;
  coins: number; level: number;
  accountStatus: string; role: string; status: "online";
}

// ---- Device & Security ----
export interface DeviceAccountLite {
  id: string; publicId?: string; username?: string; fullName: string; email?: string; phone?: string;
  createdAt?: string; lastSeen?: string; accountStatus?: string; online?: boolean;
}
export interface DeviceLoginLite {
  at: string; method?: string; ip?: string; location?: string; success?: boolean;
  userId: string; username?: string; fullName: string;
}
export interface DeviceRow {
  id: string; firstSeen: string; lastSeen: string; blocked: boolean; blockedReason?: string; whitelisted: boolean;
  device?: string; os?: string; model?: string; screen?: string; lang?: string; tz?: string;
  netType?: string; appVersion?: string; lastIp?: string; lastLocation?: string;
  online: boolean; accountCount: number; accounts: DeviceAccountLite[]; loginHistory: DeviceLoginLite[];
}
export interface SecurityAlert {
  kind: "multi_account_device" | "multi_device_account" | "proxy_ip";
  id: string;
  severity: "high" | "medium" | "low"; title: string; detail: string;
  deviceId?: string; userId?: string; ip?: string; count: number;
}
export interface DeviceAnalytics {
  totalDevices: number; activeToday: number; onlineDevices: number; offlineDevices: number;
  newToday: number; multiAccountDevices: number; blockedDevices: number; whitelistedDevices: number;
  avgAccountsPerDevice: number; maxAccountsPerDevice: number;
  byCountry: { country: string; count: number }[];
  byPlatform: { platform: string; count: number }[];
}

export async function fetchDevices(): Promise<{ devices: DeviceRow[]; alerts: SecurityAlert[]; analytics?: DeviceAnalytics }> {
  const data = await getJson<{ devices: DeviceRow[]; alerts: SecurityAlert[]; analytics: DeviceAnalytics }>("/api/admin/devices");
  return { devices: data?.devices ?? [], alerts: data?.alerts ?? [], analytics: data?.analytics };
}

export async function deviceAction(
  action: "block" | "unblock" | "forceLogout" | "banAll" | "banOne" | "whitelist" | "unwhitelist" | "dismissAlert",
  deviceId?: string, extra?: { reason?: string; userId?: string; alertId?: string },
): Promise<{ ok: boolean; error?: string; count?: number }> {
  try {
    const res = await fetch(withBase("/api/admin/devices"), {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ action, deviceId, ...extra }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, error: (data as { error?: string }).error, count: (data as { count?: number }).count };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function fetchOnlineUsers(): Promise<OnlineUser[]> {
  const data = await getJson<{ users: OnlineUser[] }>("/api/admin/online");
  return data?.users ?? [];
}

export async function onlineUserAction(userId: string, action: "suspend" | "ban" | "unban" | "logout" | "message", text?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/admin/online"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ userId, action, text }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, error: (data as { error?: string }).error };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

// ---- User Level Management (Admin → User Levels) ----
export interface UserLevelRow {
  id: string; publicId: string; fullName: string; username: string; avatar: string;
  phone?: string; email?: string; joinedAt: string;
  level: number; xp: number; levelLocked: boolean;
  tierName: string; tierEmoji: string; badgeClass: string;
  coins: number; lotusFlowers: number;
  giftsSent: number; giftsReceived: number; coinsSent: number;
  rechargeAmount: number; rechargeCoins: number; rechargeCurrency: string;
  vip: boolean; online: boolean; lastSeen?: string; lastLogin?: string;
  accountStatus: string; role: string;
}
export interface LevelAuditEntry {
  id: string; userId: string; userPublicId?: string; userName: string;
  action: "increase" | "decrease" | "set" | "reset" | "lock" | "unlock";
  previousLevel: number; newLevel: number;
  adminName: string; adminId?: string; reason?: string; ip?: string; at: string;
}
export interface LotusRewardEntry {
  id: string; userId: string; userPublicId?: string; userName: string;
  flowers: number; coinsSent?: number; threshold?: number;
  type: "automatic" | "manual"; reason?: string; adminName?: string;
  status: "granted" | "revoked"; at: string; revokedAt?: string; revokedBy?: string;
}

export async function fetchUserLevels(): Promise<{ users: UserLevelRow[]; audit: LevelAuditEntry[] }> {
  const data = await getJson<{ users: UserLevelRow[]; audit: LevelAuditEntry[] }>("/api/admin/user-levels");
  return { users: data?.users ?? [], audit: data?.audit ?? [] };
}

export async function userLevelAction(
  userId: string,
  action: LevelAuditEntry["action"],
  opts?: { value?: number; reason?: string },
): Promise<{ ok: boolean; error?: string; level?: number; locked?: boolean }> {
  try {
    const res = await fetch(withBase("/api/admin/user-levels"), {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ userId, action, value: opts?.value, reason: opts?.reason }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, error: (data as { error?: string }).error, level: (data as { level?: number }).level, locked: (data as { locked?: boolean }).locked };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

// ---- Messaging Controls (Admin → Messaging Controls) ----
export interface UploadAuditRow {
  name: string; originalName: string; mime: string; size: number; at: string;
  ownerId: string; ownerName: string; ownerPublicId?: string; kind: string;
}
export async function fetchUploadAudit(): Promise<UploadAuditRow[]> {
  const data = await getJson<{ uploads: UploadAuditRow[] }>("/api/admin/messaging");
  return data?.uploads ?? [];
}

export async function deleteUpload(name: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/admin/messaging"), {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ action: "deleteUpload", name }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, error: (data as { error?: string }).error };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function fetchLotusRewards(): Promise<LotusRewardEntry[]> {
  const data = await getJson<{ rewards: LotusRewardEntry[] }>("/api/admin/lotus-rewards");
  return data?.rewards ?? [];
}

export async function lotusRewardAction(
  body: { action: "give"; userId: string; flowers: number; reason?: string } | { action: "revoke"; rewardId: string },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/admin/lotus-rewards"), {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, error: (data as { error?: string }).error };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function updateAdminUser(
  id: string,
  patch: { role?: AdminUser["role"]; verified?: boolean; accountStatus?: string; fullName?: string; email?: string; phone?: string; mustChangePassword?: boolean; dmDisabled?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/admin/users"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, ...patch }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, error: (data as { error?: string }).error };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

/** Admin: set (or clear, with referrerId="") who REFERRED this user — mirrors the
 *  agency assignment. Does not pay the referrer; use Refer-a-Friend for payouts. */
export async function adminSetReferredBy(userId: string, referrerId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/admin/users"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: userId, action: "setReferredBy", referredBy: referrerId }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, error: (data as { error?: string }).error };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

/** Clear a user's temporary login lock ("Too many failed attempts") immediately. */
export async function resetUserLoginLock(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/admin/users"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, resetLock: true }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, error: (data as { error?: string }).error };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

/** Clear a user's profile picture + cover (fixes an oversized/corrupt image that
 *  stops their profile opening). */
export async function resetUserMedia(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/admin/users"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, clearMedia: true }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, error: (data as { error?: string }).error };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function createAdminUserAccount(input: {
  fullName: string; username: string; password: string; email?: string; phone?: string; role: string; accountStatus?: string; mustChangePassword?: boolean; avatar?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/admin/users"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, error: (data as { error?: string }).error };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

// ---------- Account approvals (pending self-sign-up accounts) ----------
export interface RegistrationRequestView {
  id: string;
  publicId?: string;
  fullName: string;
  username: string;
  email?: string;
  phone?: string;
  dob?: string;
  gender?: string;
  emailVerified: boolean;
  status: "pending" | "rejected" | string;
  at: string;
}

export async function fetchRegistrationRequests(): Promise<RegistrationRequestView[]> {
  try {
    const res = await fetch(withBase("/api/admin/registrations"), { credentials: "include" });
    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    return (data.requests as RegistrationRequestView[]) ?? [];
  } catch {
    return [];
  }
}

export async function approveRegistration(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/admin/registrations"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, action: "approve" }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, error: (data as { error?: string }).error };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function rejectRegistration(id: string, note: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/admin/registrations"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, action: "reject", note }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, error: (data as { error?: string }).error };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function deleteAdminUser(id: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/admin/users"), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, reason }),
    });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, error: d.error };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

// ---- Deleted Users (archive) — list + restore + permanent delete + ID toggle ----
export interface DeletedUserRow {
  user: { id: string; publicId?: string; username: string; fullName: string; email?: string; phone?: string; accountStatus?: string };
  publicId: string; username: string; fullName: string; email?: string; phone?: string; accountStatus: string;
  deletedAt: string; deletedBy: string; reason: string;
}
export async function fetchDeletedUsers(): Promise<{ deleted: DeletedUserRow[]; idRearrangement: boolean; superAdmin: boolean }> {
  try {
    const res = await fetch(withBase("/api/admin/deleted-users"), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return { deleted: d.deleted ?? [], idRearrangement: !!d.idRearrangement, superAdmin: !!d.superAdmin };
  } catch { return { deleted: [], idRearrangement: false, superAdmin: false }; }
}
async function deletedUsersPost(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/admin/deleted-users"), { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, error: d.error };
  } catch { return { ok: false, error: "Network error" }; }
}
export const restoreDeletedUser = (id: string) => deletedUsersPost({ action: "restore", id });
export const purgeDeletedUser = (id: string) => deletedUsersPost({ action: "purge", id });
export const setIdRearrangement = (enabled: boolean) => deletedUsersPost({ action: "setIdRearrangement", enabled });

// ---- Deleted Agencies (archive) — list + restore + permanent delete ----
export interface DeletedAgencyRow {
  agency: { id: string; agencyId: string; name: string; ownerName?: string; logo?: string; level?: number };
  id: string; agencyId: string; name: string; ownerName?: string; memberCount: number; level: number;
  deletedAt: string; deletedBy: string; reason?: string;
}
export async function fetchDeletedAgencies(): Promise<{ deleted: DeletedAgencyRow[]; idRearrangement: boolean; superAdmin: boolean }> {
  try {
    const res = await fetch(withBase("/api/admin/deleted-agencies"), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return { deleted: d.deleted ?? [], idRearrangement: !!d.idRearrangement, superAdmin: !!d.superAdmin };
  } catch { return { deleted: [], idRearrangement: false, superAdmin: false }; }
}
async function deletedAgenciesPost(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/admin/deleted-agencies"), { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, error: d.error };
  } catch { return { ok: false, error: "Network error" }; }
}
export const restoreDeletedAgency = (id: string) => deletedAgenciesPost({ action: "restore", id });
export const purgeDeletedAgency = (id: string) => deletedAgenciesPost({ action: "purge", id });

// ---- Storage Management ----
export type StorageCategory = "photo" | "video" | "audio" | "document" | "other";
export interface StorageCats { photo: number; video: number; audio: number; document: number; other: number }
export interface StorageUserRow {
  userId: string; userName: string; username: string; publicId: string;
  agencyId?: string; agencyName?: string; vip: boolean;
  usedBytes: number; limitBytes: number; pct: number; fileCount: number;
  byCategory: StorageCats; limitSource: "user" | "vip" | "agency" | "default";
}
export interface StorageFileRow {
  name: string; ownerId: string; ownerName: string; category: StorageCategory;
  size: number; at: string; source: "upload" | "reel" | "media" | "avatar" | "orphan"; ref?: string;
}
export interface StorageSettings { enabled: boolean; warningsEnabled: boolean; autoCleanupEnabled: boolean; defaultLimitMB: number; vipLimitMB: number; agencyLimitMB: number }
export interface StorageAgencyRow { agencyId: string; agencyPublicId: string; agencyName: string; bytes: number; fileCount: number; memberCount: number; limitBytes: number }
export interface StorageTimeBucket { key: string; bytes: number; count: number }
export interface StorageOverview {
  settings: StorageSettings;
  platform: { totalBytes: number; fileCount: number; byCategory: StorageCats; userCount: number };
  orphans: { count: number; bytes: number };
  users: StorageUserRow[];
  totalUsers: number;
  agencies: StorageAgencyRow[];
  time: { daily: StorageTimeBucket[]; weekly: StorageTimeBucket[]; monthly: StorageTimeBucket[] };
}
const EMPTY_STORAGE: StorageOverview = {
  settings: { enabled: false, warningsEnabled: true, autoCleanupEnabled: false, defaultLimitMB: 500, vipLimitMB: 5000, agencyLimitMB: 2000 },
  platform: { totalBytes: 0, fileCount: 0, byCategory: { photo: 0, video: 0, audio: 0, document: 0, other: 0 }, userCount: 0 },
  orphans: { count: 0, bytes: 0 }, users: [], totalUsers: 0, agencies: [], time: { daily: [], weekly: [], monthly: [] },
};
export async function fetchStorageOverview(params?: { q?: string; sort?: "used" | "pct" | "name" }): Promise<StorageOverview> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.sort) qs.set("sort", params.sort);
  const data = await getJson<StorageOverview>(`/api/admin/storage${qs.toString() ? `?${qs}` : ""}`);
  return data ?? EMPTY_STORAGE;
}
export async function fetchUserStorageFiles(userId: string): Promise<StorageFileRow[]> {
  const data = await getJson<{ files: StorageFileRow[] }>(`/api/admin/storage/files?userId=${encodeURIComponent(userId)}`);
  return data?.files ?? [];
}
async function storagePost(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; deleted?: number; bytesFreed?: number; count?: number }> {
  try {
    const res = await fetch(withBase("/api/admin/storage"), { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, error: d.error, deleted: d.deleted, bytesFreed: d.bytesFreed, count: d.count };
  } catch { return { ok: false, error: "Network error" }; }
}
export const saveStorageSettings = (settings: Partial<StorageSettings>) => storagePost({ action: "settings", settings });
export const setStorageUserLimit = (userId: string, mb: number | null) => storagePost({ action: "setUserLimit", userId, mb });
export const setStorageVip = (userId: string, vip: boolean) => storagePost({ action: "setVip", userId, vip });
export const setStorageAgencyLimit = (agencyId: string, mb: number | null) => storagePost({ action: "setAgencyLimit", agencyId, mb });
export const deleteStorageFiles = (names: string[]) => storagePost({ action: "deleteFiles", names });
export const cleanupOrphanStorage = () => storagePost({ action: "cleanup" });

export async function fetchAdminRooms(): Promise<AdminRoom[]> {
  const data = await getJson<{ rooms: AdminRoom[] }>("/api/admin/rooms");
  return data?.rooms ?? [];
}

export async function deleteAdminRoom(id: string): Promise<boolean> {
  try {
    const res = await fetch(withBase(`/api/rooms/${id}`), { method: "DELETE", credentials: "include" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function createAdminRoom(input: { name: string; category: string; type: string }): Promise<boolean> {
  try {
    const res = await fetch(withBase("/api/rooms"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface AdminRoomPatch {
  name?: string;
  category?: string;
  type?: string;
  capacity?: number;
  announcement?: string;
  description?: string;
  image?: string;
  coAdminIds?: string[];
  invitedIds?: string[];
  transferTo?: string;
  transferToName?: string;
  hideAdmins?: boolean;
}

export async function updateAdminRoom(id: string, patch: AdminRoomPatch): Promise<boolean> {
  try {
    const res = await fetch(withBase(`/api/rooms/${id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(patch),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---- Per-room Reset Controls (v407) ----
export type RoomResetSection =
  | "groupSettings" | "chat" | "memberPerms" | "hostCohost" | "moderation"
  | "games" | "gameConfig" | "voice" | "security" | "announcements" | "reports" | "factory";

/** Reset one section of a single room's config back to defaults (isolated to this
 *  room, audit-logged). Section "games" also clears a stuck / running game. */
export async function adminResetRoomSection(roomId: string, section: RoomResetSection): Promise<{ ok: boolean; error?: string; summary?: string }> {
  try {
    const res = await fetch(withBase(`/api/admin/rooms/${roomId}/reset`), {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ section }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, error: (data as { error?: string }).error, summary: (data as { summary?: string }).summary };
  } catch { return { ok: false, error: "Network error" }; }
}

export async function setAdminRoomStatus(
  id: string,
  status: "active" | "inactive" | "suspended",
  opts?: { from?: string; until?: string; reason?: string },
): Promise<boolean> {
  try {
    const res = await fetch(withBase("/api/admin/rooms"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, status, ...opts }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function broadcastNotification(text: string, cta?: { label: string; href?: string }): Promise<number> {
  try {
    const res = await fetch(withBase("/api/admin/notify"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ text, ...(cta ? { cta } : {}) }),
    });
    if (!res.ok) return 0;
    const data = (await res.json()) as { sent: number };
    return data.sent ?? 0;
  } catch {
    return 0;
  }
}

export async function fetchSupportTickets(): Promise<SupportTicket[]> {
  const data = await getJson<{ tickets: SupportTicket[] }>("/api/admin/support");
  return data?.tickets ?? [];
}

export async function updateSupportTicket(
  id: string,
  patch: { status?: SupportTicket["status"]; reply?: string },
): Promise<boolean> {
  try {
    const res = await fetch(withBase("/api/admin/support"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, ...patch }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Delete a support ticket permanently (used mainly for contact-form spam). */
export async function deleteSupportTicket(id: string): Promise<boolean> {
  try {
    const res = await fetch(withBase("/api/admin/support"), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchAdminLogs(): Promise<AdminLog[]> {
  const data = await getJson<{ logs: AdminLog[] }>("/api/admin/logs");
  return data?.logs ?? [];
}

export interface UserActivityLog {
  id: string;
  at: string;
  user: string;
  userId: string;
  username: string;
  action: string;
  kind: string;
  ip?: string;
  device?: string;
  location?: string;
  status?: string;
}

export async function fetchUserActivityLog(): Promise<UserActivityLog[]> {
  const data = await getJson<{ logs: UserActivityLog[] }>("/api/admin/user-activity");
  return data?.logs ?? [];
}

// ---------- Game sessions ----------
export interface GameSessionView {
  id: string;
  roomId: string;
  roomName: string;
  game: string;
  players: string[];
  startedByName: string;
  status: "running" | "completed" | "ended";
  winner?: string;
  createdAt: string;
  endedAt?: string;
  spectatorCount?: number;
}

export async function fetchGameSessions(): Promise<{ active: GameSessionView[]; history: GameSessionView[]; multiGamePlayers: { name: string; count: number }[] } | null> {
  // Returns null on a network/non-OK error so the caller can KEEP the last data
  // instead of blanking the list on a flaky connection.
  return getJson<{ active: GameSessionView[]; history: GameSessionView[]; multiGamePlayers: { name: string; count: number }[] }>("/api/admin/games-sessions");
}

export interface GiftLogView {
  id: string;
  fromId?: string;
  fromName: string;
  toId?: string;
  toName: string;
  giftId: string;
  emoji: string;
  giftName: string;
  cost: number;
  context: string;
  at: string;
  // ---- v292 Gift Audit fields (older entries predate these) ----
  fromPublicId?: string;
  toPublicId?: string;
  roomId?: string;
  roomName?: string;
  roomType?: string;
  roomLive?: boolean;
  presentCount?: number;
  presentUsers?: { id: string; publicId?: string; name: string }[];
  txId?: string;
  receiverTxId?: string;
  senderBalanceBefore?: number;
  senderBalanceAfter?: number;
  receiverBalanceBefore?: number;
  receiverBalanceAfter?: number;
  receiverUnit?: string;
  receiverShare?: number;
  companyShare?: number;
  agencyShare?: number;
  trustShare?: number;
  status?: "success" | "failed" | "refunded";
  failReason?: string;
}

export interface GiftActivity {
  entries: GiftLogView[];
  totalGifts: number;
  totalCoins: number;
  totalCompany?: number;
  totalAgency?: number;
  totalTrust?: number;
  failedCount?: number;
  topSenders: { name: string; count: number; coins: number }[];
  topReceivers: { name: string; count: number }[];
}

export async function fetchGiftLog(): Promise<GiftActivity> {
  const data = await getJson<GiftActivity>("/api/admin/gifts");
  return data ?? { entries: [], totalGifts: 0, totalCoins: 0, topSenders: [], topReceivers: [] };
}
async function giftLogDelete(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/admin/gifts"), { method: "DELETE", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, error: d.error };
  } catch { return { ok: false, error: "Network error" }; }
}
export const deleteGiftLogEntry = (id: string) => giftLogDelete({ id });
export const clearGiftLog = () => giftLogDelete({ all: true });

// ---------- Violations & penalties ----------
export interface ViolationView {
  id: string;
  userId: string;
  userName: string;
  type: string;
  reason: string;
  penaltyCoins: number;
  action: string;
  status: "active" | "resolved";
  by: string;
  createdAt: string;
  resolvedAt?: string;
}

export async function fetchViolations(): Promise<ViolationView[]> {
  const data = await getJson<{ violations: ViolationView[] }>("/api/admin/violations");
  return data?.violations ?? [];
}

export async function addViolation(input: {
  userId: string;
  type: string;
  reason: string;
  penaltyCoins: number;
  action: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/admin/violations"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, error: (d as { error?: string }).error };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function resolveViolation(id: string): Promise<boolean> {
  try {
    const res = await fetch(withBase("/api/admin/violations"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------- KYC verification ----------
export interface KycDocView { kind: string; url: string; name: string; originalName: string; at: string }
export interface BankView { accountHolder?: string; bankName?: string; accountNumber?: string; iban?: string; branch?: string; swift?: string; status?: "unverified" | "pending" | "verified" | "rejected"; note?: string }
export interface KycView {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  kyc: {
    status: "unverified" | "pending" | "verified" | "rejected" | "resubmit";
    legalName?: string;
    idType?: string;
    idNumber?: string;
    note?: string;
    documents?: KycDocView[];
    bank?: BankView;
    submittedAt?: string;
    reviewedAt?: string;
    reviewedBy?: string;
  };
  purchasedINR: number;
}

// ---------- Moderation Center ----------
export interface ReportView { id: string; reportedId: string; reportedName: string; reportedPublicId?: string; reportedUsername?: string; byId?: string; byName: string; byPublicId?: string; byUsername?: string; roomId?: string; roomName?: string; category: string; detail: string; status: "open" | "actioned" | "dismissed"; at: string; handledBy?: string; }
export interface RecordingView { id: string; roomId: string; roomName: string; startedBy: string; startedAt: string; endedAt?: string; durationSec?: number; participants: string[]; status: "recording" | "stored"; fileUrl?: string; }
export interface MonitorRoom { id: string; name: string; host: string; type: string; status: string; live: boolean; capacity: number; recording: boolean; muted: number; }
export type ChatMessageType = "text" | "image" | "audio" | "video" | "gift" | "sticker" | "file";
export interface ChatLog { id: string; roomId: string; roomName: string; userId: string; userName: string; text: string; at: string; type: ChatMessageType; deleted: boolean; deletedBy?: string; }
export interface ChatGroup { id: string; name: string; owner: string; type: string; messages: number; lastAt: string; chatBlocked: number; }
export interface AuditLog { id: string; admin: string; adminId?: string; action: string; at: string; roomId?: string; matchId?: string; reason?: string; category?: string; }
export interface ModViolation { id: string; userId: string; userName: string; type: string; status: string; createdAt: string; reason?: string; action?: string; by?: string; }
export interface ModerationData {
  reports: ReportView[];
  violations: ModViolation[];
  recordings: RecordingView[];
  rooms: MonitorRoom[];
  chats: ChatLog[];
  groups: ChatGroup[];
  logs: AuditLog[];
  isSuper: boolean;
}

export async function fetchModeration(): Promise<ModerationData | null> {
  return getJson<ModerationData>("/api/admin/moderation");
}

export interface RecordingContent {
  recording: RecordingView;
  chats: { id: string; userName: string; text: string; at: string }[];
  events: { id: string; type: string; target: string; actorName: string; at: string }[];
}
export async function fetchRecordingContent(id: string): Promise<RecordingContent | null> {
  return getJson<RecordingContent>(`/api/admin/recordings/${id}`);
}

export async function moderationAction(body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(withBase("/api/admin/moderation"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function reportUser(reportedId: string, category: string, detail: string, roomId?: string, roomName?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/reports"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ reportedId, category, detail, roomId, roomName }),
    });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, error: (d as { error?: string }).error };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function fetchKyc(): Promise<KycView[]> {
  const data = await getJson<{ users: KycView[] }>("/api/admin/kyc");
  return data?.users ?? [];
}

export async function setKycStatus(userId: string, status: KycView["kyc"]["status"], note: string): Promise<boolean> {
  try {
    const res = await fetch(withBase("/api/admin/kyc"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ userId, status, note }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Admin edits a user's submitted KYC identity + bank fields. */
export async function editKyc(userId: string, patch: { legalName?: string; idType?: string; idNumber?: string; bank?: Record<string, string> }): Promise<boolean> {
  try {
    const res = await fetch(withBase("/api/admin/kyc"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ userId, target: "edit", patch }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function setKycBankStatus(userId: string, status: "verified" | "rejected" | "pending", note: string): Promise<boolean> {
  try {
    const res = await fetch(withBase("/api/admin/kyc"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ userId, target: "bank", status, note }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function forceEndGame(id: string): Promise<boolean> {
  try {
    const res = await fetch(withBase("/api/admin/games-sessions"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------- Admin account management ----------
export interface AdminAccount {
  id: string;
  fullName: string;
  email: string;
  role: "super_admin" | "admin" | "moderator" | "support";
  permissions: string[];
  accountStatus: "active" | "inactive" | "suspended" | "blocked" | "banned";
  lastSeen: string;
  lastIp: string;
  createdAt: string;
  isSelf: boolean;
}

export async function fetchAdmins(): Promise<{ admins: AdminAccount[]; count: number; activeAdmins: number; limit: number }> {
  const data = await getJson<{ admins: AdminAccount[]; count: number; activeAdmins: number; limit: number }>("/api/admin/admins");
  return data ?? { admins: [], count: 0, activeAdmins: 0, limit: 0 };
}

export async function createAdmin(input: { fullName: string; email: string; password: string; adminRole: string; permissions: string[] }): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/admin/admins"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, error: (data as { error?: string }).error };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function updateAdmin(id: string, patch: { adminRole?: string; permissions?: string[]; accountStatus?: string }): Promise<boolean> {
  try {
    const res = await fetch(withBase("/api/admin/admins"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, ...patch }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteAdmin(id: string): Promise<boolean> {
  try {
    const res = await fetch(withBase("/api/admin/admins"), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Super-Admin: reset any user's or admin's password. */
export async function resetUserPassword(id: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/admin/users"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (data.error as string) ?? "Could not reset password" };
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

// ---------- Agency System ----------
export interface AgencyPermissions {
  user: { create: boolean; edit: boolean; delete: boolean; suspend: boolean; view: boolean; resetPassword: boolean; verify: boolean };
  room: { create: boolean; edit: boolean; delete: boolean; close: boolean; reopen: boolean; assignHost: boolean; assignCoHost: boolean; removeHost: boolean; lockUnlock: boolean };
  storage: { view: boolean; deleteFiles: boolean; setLimits: boolean; sendWarnings: boolean; downloadFiles: boolean };
}
export interface AdminAgency {
  id: string;
  agencyId: string;
  name: string;
  logo?: string;
  cover?: string;
  description?: string;
  ownerId?: string;
  ownerName?: string;
  ownerUsername?: string;
  status: "pending" | "active" | "suspended" | "expired" | "rejected";
  commission: { receiverPct: number; agencyPct: number; companyPct: number; trustPct?: number };
  roomLimit: number;
  memberLimit: number;
  features: { rooms: boolean; gifts: boolean; invites: boolean };
  permissions?: AgencyPermissions;
  memberCount: number;
  totalCoins: number;
  earnings: number;
  level: number;
  levelTierId?: string; // manual level override (empty = auto)
  tier?: { id: string; name: string; badge: string; color: string; order: number; level: number; value: number };
  createdAt: string;
  createdByName?: string;
  // Extended "Agency Information"
  type?: string; country?: string; state?: string; city?: string; address?: string;
  contactPerson?: string; mobile?: string; email?: string; website?: string;
  // Membership
  rejectionReason?: string; requestedBy?: string;
  planId?: string; planName?: string; planPriceCoins?: number;
  startDate?: string; expiryDate?: string;
  autoRenewal?: boolean; renewalReminderDays?: number; membershipApproved?: boolean;
  updatedAt?: string;
  // Enriched identity for the admin panel (photo / UID / email / mobile).
  owner?: AdminUserLite | null;
  members?: AdminAgencyMemberLite[];
}
export interface AdminUserLite { id: string; publicId: string; fullName: string; username: string; avatar: string; email?: string; phone?: string; status: string; online: boolean }
export interface AdminAgencyMemberLite extends AdminUserLite { role: string; agencyId: string; agencyName: string; agencyPublicId: string }

export async function fetchAgencies(): Promise<AdminAgency[]> {
  try {
    const res = await fetch(withBase("/api/admin/agencies"), { credentials: "include", cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.agencies ?? []) as AdminAgency[];
  } catch {
    return [];
  }
}

async function agencyWrite(method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; agency?: AdminAgency }> {
  try {
    const res = await fetch(withBase("/api/admin/agencies"), {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (data.error as string) ?? "Request failed" };
    return { ok: true, agency: data.agency as AdminAgency };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export const createAgency = (body: Record<string, unknown>) => agencyWrite("POST", body);
export const updateAgency = (body: Record<string, unknown>) => agencyWrite("PATCH", body);
export const deleteAgency = (id: string) => agencyWrite("DELETE", { id });
