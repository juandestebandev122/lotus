"use client";

import { withBase } from "./base-path";

export type CallInterest = "audio" | "video" | "both";
export type PZStatus = "pending" | "approved" | "rejected" | "suspended";

export interface PZDirectoryEntry { userId: string; fzId?: string; name: string; username?: string; bio?: string; gender: string; callInterest: CallInterest; avatar: string; online: boolean }
export interface PZSelf { status: PZStatus; accountName: string; gender: string; callInterest: CallInterest; note: string; active?: boolean; membershipActive?: boolean; renewAt?: string | null }
export interface PZMembershipInfo { monthlyCoins: number; renewalDays: number; autoRenew: boolean }
// The member's own SEPARATE Friend Zone profile (independent from the login account).
export interface PZProfile { fzId?: string; fzName: string; fzUsername: string; fzAvatar: string; fzBio: string; fzVisible: boolean }
export interface PZState { enabled: boolean; joinCost: number; membership: PZMembershipInfo; me: PZSelf | null; fzProfile: PZProfile | null; directory: PZDirectoryEntry[] }

export interface PZAdminMember {
  userId: string; realName: string; accountName: string; gender: string; callInterest: CallInterest;
  docUrl?: string; docName?: string; status: PZStatus; coinsPaid: number; requestedAt: string;
  decidedAt?: string; decidedBy?: string; note?: string; blockedUserIds?: string[];
  membershipActive?: boolean; renewAt?: string; lastRenewedAt?: string;
  fzId?: string; fzName?: string; fzUsername?: string; fzAvatar?: string; fzBio?: string; fzVisible?: boolean;
  fullName: string; username: string; avatar: string;
}

export const CALL_INTEREST_LABEL: Record<CallInterest, string> = { audio: "🎧 Audio call", video: "📹 Video call", both: "🎧📹 Audio & Video" };

export async function fetchPaidZone(): Promise<PZState> {
  const fallbackMembership: PZMembershipInfo = { monthlyCoins: 0, renewalDays: 30, autoRenew: true };
  try {
    const res = await fetch(withBase("/api/paid-zone"), { credentials: "include" });
    const d = await res.json().catch(() => ({}));
    return { enabled: d.enabled ?? true, joinCost: d.joinCost ?? 500, membership: d.membership ?? fallbackMembership, me: d.me ?? null, fzProfile: d.fzProfile ?? null, directory: d.directory ?? [] };
  } catch {
    return { enabled: true, joinCost: 500, membership: fallbackMembership, me: null, fzProfile: null, directory: [] };
  }
}

/** Save my SEPARATE Friend Zone profile (never touches the login account). */
export async function savePaidZoneProfile(profile: Partial<PZProfile>): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(withBase("/api/paid-zone"), {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "profile", ...profile }),
  });
  const d = await res.json().catch(() => ({}));
  return res.ok ? { ok: true } : { ok: false, error: d.error };
}

/** Admin: edit a member's separate Friend Zone profile. */
export async function adminEditPaidZoneProfile(userId: string, profile: Partial<PZProfile> & { accountName?: string }): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(withBase("/api/admin/paid-zone"), {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "editProfile", userId, profile }),
  });
  const d = await res.json().catch(() => ({}));
  return res.ok ? { ok: true } : { ok: false, error: d.error };
}

/** Leave the Paid Zone (removes benefits + stops renewals; account stays active). */
export async function exitPaidZone(): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(withBase("/api/paid-zone/membership"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "exit" }) });
  const d = await res.json().catch(() => ({}));
  return res.ok ? { ok: true } : { ok: false, error: d.error };
}

/** Pay the monthly renewal now to (re)activate the membership. */
export async function renewPaidZone(): Promise<{ ok: boolean; error?: string; balance?: number }> {
  const res = await fetch(withBase("/api/paid-zone/membership"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "renew" }) });
  const d = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, balance: d.balance } : { ok: false, error: d.error };
}

export async function submitPaidZoneRequest(input: { realName: string; accountName: string; gender: string; callInterest: string; docUrl?: string; docName?: string }): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(withBase("/api/paid-zone"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const d = await res.json().catch(() => ({}));
  return res.ok ? { ok: true } : { ok: false, error: d.error };
}

export async function paidZoneBlock(targetUserId: string, blocked: boolean): Promise<void> {
  await fetch(withBase("/api/paid-zone/block"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetUserId, blocked }) }).catch(() => {});
}

export async function startPaidZoneCall(targetUserId: string, mode: "audio" | "video"): Promise<{ ok: boolean; roomId?: string; error?: string }> {
  const res = await fetch(withBase("/api/paid-zone/call"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetUserId, mode }) });
  const d = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, roomId: d.roomId } : { ok: false, error: d.error };
}

export interface CallTick { active: boolean; balance?: number; perMin?: number; minutes?: number; disconnect?: boolean; reason?: string; lowBalance?: boolean; startedAt?: string }
export async function callTick(roomId: string): Promise<CallTick> {
  try {
    const res = await fetch(withBase("/api/paid-zone/call/tick"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roomId }) });
    const d = await res.json().catch(() => ({}));
    return { active: d.active ?? false, balance: d.balance, perMin: d.perMin, minutes: d.minutes, disconnect: d.disconnect, reason: d.reason, lowBalance: d.lowBalance, startedAt: d.startedAt };
  } catch {
    return { active: true };
  }
}
export async function endPaidZoneCall(roomId: string): Promise<void> {
  await fetch(withBase("/api/paid-zone/call/end"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roomId }) }).catch(() => {});
}

export interface IncomingCall { id: string; roomId: string; callerId: string; callerName: string; type: "audio" | "video"; startedAt: string; ringingExpiresAt?: string }
export async function fetchIncomingCalls(): Promise<IncomingCall[]> {
  try {
    const res = await fetch(withBase("/api/paid-zone/call/incoming"), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return d.calls ?? [];
  } catch {
    return [];
  }
}
export async function respondCall(callId: string, accept: boolean): Promise<{ ok: boolean; roomId?: string; error?: string }> {
  try {
    const res = await fetch(withBase("/api/paid-zone/call/respond"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callId, accept }) });
    const d = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, roomId: d.roomId } : { ok: false, error: d.error };
  } catch {
    return { ok: false, error: "Network error" };
  }
}
export interface CallState { status: "ringing" | "active" | "ended" | "none"; reason?: string; type?: string; otherName?: string; minutes?: number; startedAt?: string }
export async function fetchCallState(roomId: string): Promise<CallState> {
  try {
    const res = await fetch(withBase(`/api/paid-zone/call/state?roomId=${encodeURIComponent(roomId)}`), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return { status: d.status ?? "none", reason: d.reason, type: d.type, otherName: d.otherName, minutes: d.minutes, startedAt: d.startedAt };
  } catch {
    return { status: "none" };
  }
}

export interface PZCall {
  id: string; roomId: string; callerId: string; callerName: string; receiverId: string; receiverName: string;
  type: "audio" | "video"; perMin: number; startedAt: string; lastTickAt: string; minutesBilled: number;
  coinsDeducted: number; status: "active" | "ended"; endedAt?: string; endReason?: string; recorded?: boolean;
}
export interface PZStats { members: number; approved: number; online: number; activeCalls: number; totalMinutes: number; totalCoins: number; recordedCalls: number; companyEarnings?: number; receiverPayouts?: number; trustProfit?: number; today: { calls: number; minutes: number; coins: number } }

export async function fetchPaidZoneCalls(): Promise<{ active: PZCall[]; records: PZCall[]; stats: PZStats | null }> {
  try {
    const res = await fetch(withBase("/api/admin/paid-zone/calls"), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return { active: d.active ?? [], records: d.records ?? [], stats: d.stats ?? null };
  } catch {
    return { active: [], records: [], stats: null };
  }
}
export async function adminForceEndCall(callId: string): Promise<boolean> {
  try {
    const res = await fetch(withBase("/api/admin/paid-zone/calls"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callId }) });
    return res.ok;
  } catch {
    return false;
  }
}

export interface PZActivity {
  id: string; at: string; type: string;
  actorId: string; actorName: string; targetId?: string; targetName?: string; detail?: string;
}

export async function fetchAdminPaidZone(): Promise<{ members: PZAdminMember[]; log: PZActivity[] }> {
  try {
    const res = await fetch(withBase("/api/admin/paid-zone"), { credentials: "include" });
    const d = await res.json().catch(() => ({}));
    return { members: d.members ?? [], log: d.log ?? [] };
  } catch {
    return { members: [], log: [] };
  }
}

export async function clearPaidZoneLog(): Promise<boolean> {
  try {
    const res = await fetch(withBase("/api/admin/paid-zone"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "clearLog" }) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function adminPaidZoneAction(userId: string, action: "approve" | "reject" | "suspend" | "restore" | "remove", note?: string): Promise<boolean> {
  try {
    const res = await fetch(withBase("/api/admin/paid-zone"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, action, note }) });
    return res.ok;
  } catch {
    return false;
  }
}
