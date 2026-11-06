"use client";

import { withBase } from "./base-path";

export type AgencyRole = "owner" | "manager" | "cohost" | "member" | "pending";

export interface AgencyMemberRow {
  id: string; publicId: string; name: string; username: string; avatar: string;
  role: AgencyRole; joinedAt?: string; online: boolean; coins: number; accountStatus: string;
}
export type AgencyStatus = "pending" | "active" | "suspended" | "expired" | "rejected";
export interface AgencyMembership { status: AgencyStatus; approved: boolean; planId?: string; planName?: string; planPriceCoins?: number; startDate?: string; expiryDate?: string; autoRenewal: boolean; renewalReminderDays: number; rejectionReason?: string }
export interface AgencyPlan { id: string; name: string; durationDays: number; specificExpiry?: string; priceCoins: number; enabled: boolean; createdAt: string }
export interface AgencyPayment { id: string; agencyId: string; agencyPublicId: string; agencyName: string; userId: string; userName: string; planId: string; planName: string; coins: number; status: "success" | "failed"; reason?: string; startDate?: string; expiryDate?: string; at: string }

// Granular per-agency permission set (mirrors the server AgencyPermissions).
export interface AgencyPermissions {
  user: { create: boolean; edit: boolean; delete: boolean; suspend: boolean; view: boolean; resetPassword: boolean; verify: boolean };
  room: { create: boolean; edit: boolean; delete: boolean; close: boolean; reopen: boolean; assignHost: boolean; assignCoHost: boolean; removeHost: boolean; lockUnlock: boolean };
  storage: { view: boolean; deleteFiles: boolean; setLimits: boolean; sendWarnings: boolean; downloadFiles: boolean };
}

/** An account the agency created, with its admin-approval status (Agency View). */
export interface AgencyUserSubmission {
  id: string; userName: string; username: string; createdByName?: string; createdAt: string;
  status: "pending" | "approved" | "rejected"; decidedByName?: string; decidedAt?: string; note?: string;
}

export interface AgencyPortal {
  agency: { id: string; agencyId: string; name: string; logo?: string; description?: string; status: string; level: number; earnings: number; totalCoins: number; memberLimit: number; commission: { receiverPct: number; agencyPct: number; companyPct: number }; ownerId?: string; ownerName?: string; canCreateUsers?: boolean; permissions?: AgencyPermissions; membership?: AgencyMembership };
  myRole: AgencyRole;
  members: AgencyMemberRow[];
  pending: AgencyMemberRow[];
  blocked?: AgencyMemberRow[];
  sentInvites: { id: string; name: string; username: string; avatar: string; byName?: string; at: string }[];
  counts: { total: number; active: number; inactive: number; managers: number; coHosts: number; pending: number };
  announcements: { id: string; text: string; at: string; byName: string }[];
  history: { id: string; text: string; at: string }[];
  submissions?: AgencyUserSubmission[];
  rank: number;
}
export interface AgencyUserResult { id: string; publicId: string; name: string; username: string; avatar: string; createdByThisAgency?: boolean }

// Public agency directory (browse & join) + this user's invitations.
export interface AgencyDirectoryCard {
  id: string; agencyId: string; name: string; logo?: string; description?: string;
  level: number; tierName?: string; tierBadge?: string; tierColor?: string; rank: number; ownerName?: string;
  memberCount: number; memberLimit: number; full: boolean; status: string;
  myStatus: "none" | "owner" | "manager" | "cohost" | "member" | "pending" | "invited";
}
export interface MyAgencyInvite { agencyId: string; publicId: string; name: string; logo?: string; byName?: string; at: string }

// Public profile for ONE agency (anyone can view): details + members + the rooms
// it manages. Reached by tapping the agency name shown next to a room name.
export interface AgencyProfile {
  id: string; agencyId: string; name: string; logo?: string; cover?: string; description?: string;
  level: number; tierName?: string; tierBadge?: string; tierColor?: string; rank: number; ownerName?: string; ownerId?: string;
  memberCount: number; memberLimit: number; full: boolean; totalCoins: number;
  status: AgencyStatus; expiryDate?: string; planName?: string;
  myStatus: AgencyDirectoryCard["myStatus"];
  members: { id: string; name: string; username: string; avatar: string; role: string; online: boolean }[];
  rooms: { id: string; name: string; type: string; live: boolean }[];
}

// ---- Agency membership: plans, request-to-create, coin purchase, receipts ----
export async function fetchAgencyPlans(): Promise<AgencyPlan[]> {
  try { const r = await fetch(withBase("/api/agency-plans"), { credentials: "include", cache: "no-store" }); return (await r.json()).plans ?? []; } catch { return []; }
}
export async function createAgencyRequest(info: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch(withBase("/api/agency-request"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(info) });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, error: d.error };
  } catch { return { ok: false, error: "Network error" }; }
}
export async function buyAgencyMembership(agencyId: string, planId: string): Promise<{ ok: boolean; error?: string; receipt?: AgencyPayment; balance?: number }> {
  try {
    const r = await fetch(withBase("/api/agency/purchase"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agencyId, planId }) });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, error: d.error, receipt: d.receipt, balance: d.balance };
  } catch { return { ok: false, error: "Network error" }; }
}
export async function fetchAgencyPayments(agencyId?: string): Promise<AgencyPayment[]> {
  try { const r = await fetch(withBase(`/api/agency/payments${agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : ""}`), { credentials: "include", cache: "no-store" }); return (await r.json()).payments ?? []; } catch { return []; }
}

// ---- Admin: membership plans + agency-request review + payment history ----
export async function fetchAdminAgencyPlans(): Promise<AgencyPlan[]> {
  try { const r = await fetch(withBase("/api/admin/agency-plans"), { credentials: "include", cache: "no-store" }); return (await r.json()).plans ?? []; } catch { return []; }
}
export async function saveAgencyPlan(plan: Partial<AgencyPlan> & { name: string; priceCoins: number }): Promise<{ ok: boolean; error?: string }> {
  try { const r = await fetch(withBase("/api/admin/agency-plans"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(plan) }); const d = await r.json().catch(() => ({})); return { ok: r.ok, error: d.error }; } catch { return { ok: false, error: "Network error" }; }
}
export async function deleteAgencyPlan(id: string): Promise<{ ok: boolean }> {
  try { const r = await fetch(withBase("/api/admin/agency-plans"), { method: "DELETE", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); return { ok: r.ok }; } catch { return { ok: false }; }
}
export async function reviewAgencyRequest(id: string, approve: boolean, reason?: string): Promise<{ ok: boolean; error?: string }> {
  try { const r = await fetch(withBase("/api/admin/agencies"), { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: approve ? "approve" : "reject", reason }) }); const d = await r.json().catch(() => ({})); return { ok: r.ok, error: d.error }; } catch { return { ok: false, error: "Network error" }; }
}
export async function fetchAdminAgencyPayments(agencyId?: string): Promise<AgencyPayment[]> {
  try { const r = await fetch(withBase(`/api/admin/agency-payments${agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : ""}`), { credentials: "include", cache: "no-store" }); return (await r.json()).payments ?? []; } catch { return []; }
}

// The agency (id + name) a given user belongs to — for the agency badge shown on
// their profile. Returns null when they're not in an agency.
export interface MyAgency { id: string; agencyId: string; name: string; logo?: string; role: string; canManage: boolean; memberCount: number }
/** The signed-in user's own agency (owner OR member), or null. */
export async function fetchMyAgency(): Promise<MyAgency | null> {
  try {
    const res = await fetch(withBase("/api/my-agency"), { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    const d = await res.json().catch(() => ({}));
    return (d.agency as MyAgency | null) ?? null;
  } catch { return null; }
}

export async function fetchUserAgency(userId: string): Promise<{ id: string; name: string } | null> {
  try {
    const res = await fetch(withBase(`/api/users/${encodeURIComponent(userId)}/agency`), { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    const d = await res.json().catch(() => ({}));
    return (d.agency as { id: string; name: string } | null) ?? null;
  } catch { return null; }
}

export async function fetchAgencyProfile(id: string): Promise<AgencyProfile | null> {
  try {
    const res = await fetch(withBase(`/api/agencies/${encodeURIComponent(id)}`), { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    const d = await res.json().catch(() => ({}));
    return (d.profile as AgencyProfile) ?? null;
  } catch { return null; }
}

export type AgencyMemberActionType = "add" | "approve" | "reject" | "remove" | "setManager" | "setCoHost" | "setMember" | "invite" | "cancelInvite" | "block" | "unblock";

// ---- Public directory + user join / invite flows ----
export async function fetchAgencies(): Promise<{ agencies: AgencyDirectoryCard[]; invites: MyAgencyInvite[] }> {
  try {
    const res = await fetch(withBase("/api/agencies"), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return { agencies: d.agencies ?? [], invites: d.invites ?? [] };
  } catch { return { agencies: [], invites: [] }; }
}

// ---- Member-initiated agency CHANGE (admin-approved, with a reason) ----------
export interface AgencyChangeRequest {
  id: string;
  userId: string; userName: string; userPublicId?: string; userAvatar?: string; userUsername?: string;
  fromAgencyId?: string; fromAgencyName?: string;
  toAgencyId: string; toAgencyName: string; toAgencyPublicId?: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  createdAt: string;
  decidedAt?: string; decidedByName?: string; decisionReason?: string;
}

// ---- User's own request HISTORY (join + change) --------------------------------
export interface AgencyJoinRequest {
  id: string;
  userId: string;
  agencyId: string;
  agencyPublicId?: string;
  agencyName: string;
  status: "pending" | "approved" | "rejected" | "blocked" | "cancelled";
  createdAt: string;
  decidedAt?: string;
  decidedByName?: string;
}

/** The signed-in user's own agency request history — join + change requests. */
export async function fetchMyAgencyRequests(): Promise<{ join: AgencyJoinRequest[]; change: AgencyChangeRequest[] }> {
  try {
    const res = await fetch(withBase("/api/agency/my-requests"), { credentials: "include", cache: "no-store" });
    if (!res.ok) return { join: [], change: [] };
    const d = await res.json().catch(() => ({}));
    return { join: (d.join ?? []) as AgencyJoinRequest[], change: (d.change ?? []) as AgencyChangeRequest[] };
  } catch { return { join: [], change: [] }; }
}

/** User submits a request to switch to a different agency (admin reviews it). */
export async function submitAgencyChangeRequest(toAgencyId: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/agency/change-request"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toAgencyId, reason }) });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, error: d.error };
  } catch { return { ok: false, error: "Network error" }; }
}

/** The signed-in user's latest agency-change request (or null). */
export async function fetchMyAgencyChangeRequest(): Promise<AgencyChangeRequest | null> {
  try {
    const res = await fetch(withBase("/api/agency/change-request"), { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    const d = await res.json().catch(() => ({}));
    return (d.request as AgencyChangeRequest | null) ?? null;
  } catch { return null; }
}

/** Admin: the agency-change review queue. */
export async function fetchAgencyChangeRequests(): Promise<AgencyChangeRequest[]> {
  try {
    const res = await fetch(withBase("/api/admin/agency-changes"), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return (d.requests ?? []) as AgencyChangeRequest[];
  } catch { return []; }
}

/** Admin: approve (transfer the user) or reject (with a reason) a change request. */
export async function decideAgencyChangeRequest(id: string, approve: boolean, reason?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/admin/agency-changes"), { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, approve, reason }) });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, error: d.error };
  } catch { return { ok: false, error: "Network error" }; }
}

/** Admin: cancel (void) a still-pending change request without transferring. */
export async function cancelAgencyChangeRequest(id: string, reason?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/admin/agency-changes"), { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, cancel: true, reason }) });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, error: d.error };
  } catch { return { ok: false, error: "Network error" }; }
}

export async function requestToJoinAgency(agencyId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/agencies"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "join", agencyId }) });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, error: d.error };
  } catch { return { ok: false, error: "Network error" }; }
}

export async function respondToAgencyInvite(agencyId: string, accept: boolean): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/agencies"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: accept ? "invite-accept" : "invite-decline", agencyId }) });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, error: d.error };
  } catch { return { ok: false, error: "Network error" }; }
}

// ---- Agency GROUPS (rooms the agency manages) + permission-gated actions ----
export interface AgencyGroupRow {
  id: string; name: string; type: string; ownerName: string;
  live: boolean; closed: boolean; chatLocked: boolean; image?: string;
  coHosts: { id: string; name: string }[];
}
export async function fetchAgencyGroups(): Promise<{ rooms: AgencyGroupRow[]; perms: AgencyPermissions } | null> {
  try {
    const res = await fetch(withBase("/api/agency/rooms"), { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}
export async function agencyGroupAction(roomId: string, action: "lock" | "unlock" | "close" | "reopen" | "edit" | "assignCoHost" | "removeCoHost", payload?: { name?: string; targetId?: string }): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/agency/rooms"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roomId, action, ...payload }) });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, error: d.error };
  } catch { return { ok: false, error: "Network error" }; }
}

// ---- Member details / edit, and agency storage (permission-gated) ----
export interface AgencyMemberDetails { id: string; publicId: string; name: string; username: string; email?: string; phone?: string; level: number; coins: number; lotus: number; joinedAt?: string; lastSeen?: string; online: boolean; accountStatus: string; role: string | null }
export async function agencyMemberDetails(targetId: string): Promise<{ ok: boolean; error?: string; details?: AgencyMemberDetails }> {
  try {
    const res = await fetch(withBase("/api/agency"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "memberDetails", targetId }) });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, error: d.error, details: d.details };
  } catch { return { ok: false, error: "Network error" }; }
}
export async function agencyEditMember(targetId: string, patch: { fullName?: string; email?: string; phone?: string }): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/agency"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "editMember", targetId, ...patch }) });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, error: d.error };
  } catch { return { ok: false, error: "Network error" }; }
}
export interface AgencyStorageInfo { totalBytes: number; members: { id: string; name: string; usedBytes: number; pct: number; fileCount: number }[] }
export async function fetchAgencyStorage(): Promise<{ ok: boolean; error?: string; data?: AgencyStorageInfo }> {
  try {
    const res = await fetch(withBase("/api/agency"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "storage" }) });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, error: d.error, data: res.ok ? { totalBytes: d.totalBytes ?? 0, members: d.members ?? [] } : undefined };
  } catch { return { ok: false, error: "Network error" }; }
}
export async function agencySendStorageWarning(targetId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/agency"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "sendWarning", targetId }) });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, error: d.error };
  } catch { return { ok: false, error: "Network error" }; }
}

// ---- Owner / manager portal ----
export async function fetchAgencyPortal(): Promise<AgencyPortal | null> {
  try {
    const res = await fetch(withBase("/api/agency"), { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    const d = await res.json().catch(() => ({}));
    return d.portal ?? null;
  } catch { return null; }
}

export async function agencyMemberAction(action: AgencyMemberActionType, targetId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/agency"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "member", action, targetId }) });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, error: d.error };
  } catch { return { ok: false, error: "Network error" }; }
}

/** Owner/manager creates a brand-new member account (agency-created → can be
 *  directly added). Requires the agency's "Create Users" permission. */
export async function agencyCreateMember(input: { fullName: string; username: string; password: string; email?: string; phone?: string }): Promise<{ ok: boolean; error?: string; pending?: boolean }> {
  try {
    const res = await fetch(withBase("/api/agency"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "create", ...input }) });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, error: d.error, pending: d.pending === true };
  } catch { return { ok: false, error: "Network error" }; }
}

export async function agencyAnnounce(text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/agency"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "announce", text }) });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, error: d.error };
  } catch { return { ok: false, error: "Network error" }; }
}

export async function agencySearchUsers(q: string): Promise<AgencyUserResult[]> {
  try {
    const res = await fetch(withBase(`/api/agency/search?q=${encodeURIComponent(q)}`), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return d.results ?? [];
  } catch { return []; }
}

// ---- Admin agency management (structure / members / transfer) ----
export async function fetchAgencyStructure(agencyId: string): Promise<AgencyPortal | null> {
  try {
    const res = await fetch(withBase(`/api/admin/agencies/manage?id=${encodeURIComponent(agencyId)}`), { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    const d = await res.json().catch(() => ({}));
    return d.structure ?? null;
  } catch { return null; }
}

export async function adminAgencySearchUsers(q: string): Promise<AgencyUserResult[]> {
  try {
    const res = await fetch(withBase(`/api/admin/agencies/manage?search=${encodeURIComponent(q)}`), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return d.results ?? [];
  } catch { return []; }
}

export async function adminAgencyMemberAction(agencyId: string, action: AgencyMemberActionType, targetId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/admin/agencies/manage"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agencyId, action, targetId }) });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, error: d.error };
  } catch { return { ok: false, error: "Network error" }; }
}

export async function adminTransferMember(transferTo: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/admin/agencies/manage"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transferTo, userId }) });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, error: d.error };
  } catch { return { ok: false, error: "Network error" }; }
}

// Lightweight agency list for the "assign agency" picker (id/serial/name/status/capacity).
export interface AgencyLite { id: string; agencyId: string; name: string; status: string; memberCount: number; memberLimit: number }
export async function adminListAgenciesLite(): Promise<AgencyLite[]> {
  try {
    const res = await fetch(withBase("/api/admin/agencies/manage?agencies=1"), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return (d.agencies ?? []) as AgencyLite[];
  } catch { return []; }
}

// Remove a user's agency assignment entirely (admin User Management).
export async function adminRemoveUserFromAgency(userId: string): Promise<{ ok: boolean; error?: string; removedFrom?: string }> {
  try {
    const res = await fetch(withBase("/api/admin/agencies/manage"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ removeUserId: userId }) });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, error: d.error, removedFrom: d.removedFrom };
  } catch { return { ok: false, error: "Network error" }; }
}
