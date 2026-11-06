"use client";

import { withBase } from "./base-path";
import type { BusinessFieldDef, BusinessSection } from "./config";

export type { BusinessFieldDef, BusinessSection };

export type BizStatus = "pending" | "verified" | "rejected" | "suspended";

export type BizVisibility = "everyone" | "businesses";

export interface BusinessCard {
  id: string; ownerId: string; ownerName: string; ownerUsername: string;
  name: string; category: string; description: string;
  phone?: string; email?: string; website?: string; location?: string; hours?: string;
  whatsapp?: string; facebook?: string; instagram?: string; youtube?: string;
  fields?: Record<string, string>;
  logoUrl: string; coverUrl: string;
  status: BizStatus; verified: boolean;
  visibility: BizVisibility;
  followers: number; views: number; following: boolean;
  createdAt: string; note?: string;
}

export interface BizState {
  enabled: boolean;
  categories: string[];
  registerCost: number;
  coins: number;
  directory: BusinessCard[];
  mine: BusinessCard[];
}

export interface BizInput {
  name: string; category: string; description: string;
  phone?: string; email?: string; website?: string; location?: string; hours?: string;
  whatsapp?: string; facebook?: string; instagram?: string; youtube?: string;
  fields?: Record<string, string>; // admin-defined custom field values
  logo?: string; cover?: string; visibility?: BizVisibility;
}

export const VISIBILITY_LABEL: Record<BizVisibility, string> = {
  everyone: "Visible to everyone",
  businesses: "Registered businesses only",
};

export const STATUS_LABEL: Record<BizStatus, string> = {
  pending: "Pending review",
  verified: "Verified",
  rejected: "Not approved",
  suspended: "Suspended",
};

export async function fetchBusinesses(q = "", category = ""): Promise<BizState> {
  try {
    const url = new URL(withBase("/api/business"), typeof window !== "undefined" ? window.location.origin : "http://x");
    if (q) url.searchParams.set("q", q);
    if (category) url.searchParams.set("category", category);
    const res = await fetch(url.pathname + url.search, { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return { enabled: d.enabled ?? true, categories: d.categories ?? [], registerCost: d.registerCost ?? 0, coins: d.coins ?? 0, directory: d.directory ?? [], mine: d.mine ?? [] };
  } catch {
    return { enabled: true, categories: [], registerCost: 0, coins: 0, directory: [], mine: [] };
  }
}

export async function fetchBusiness(id: string): Promise<BusinessCard | null> {
  try {
    const res = await fetch(withBase(`/api/business/${id}`), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return res.ok ? (d.business ?? null) : null;
  } catch {
    return null;
  }
}

export async function registerBusiness(input: BizInput): Promise<{ ok: boolean; error?: string; id?: string }> {
  const res = await fetch(withBase("/api/business"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const d = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, id: d.id } : { ok: false, error: d.error };
}

export async function editBusiness(id: string, patch: Partial<BizInput>): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(withBase(`/api/business/${id}`), { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
  const d = await res.json().catch(() => ({}));
  return res.ok ? { ok: true } : { ok: false, error: d.error };
}

export async function deleteBusiness(id: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(withBase(`/api/business/${id}`), { method: "DELETE", credentials: "include" });
  const d = await res.json().catch(() => ({}));
  return res.ok ? { ok: true } : { ok: false, error: d.error };
}

export async function toggleFollowBusiness(id: string): Promise<{ following: boolean; followers: number }> {
  try {
    const res = await fetch(withBase(`/api/business/${id}/follow`), { method: "POST", credentials: "include" });
    const d = await res.json().catch(() => ({}));
    return { following: !!d.following, followers: d.followers ?? 0 };
  } catch {
    return { following: false, followers: 0 };
  }
}

// ---- Admin ----
export interface BizActivity { id: string; at: string; type: string; actorName: string; targetName?: string; detail?: string }

export async function fetchAdminBusinesses(): Promise<{ businesses: BusinessCard[]; log: BizActivity[] }> {
  try {
    const res = await fetch(withBase("/api/admin/business"), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return { businesses: d.businesses ?? [], log: d.log ?? [] };
  } catch {
    return { businesses: [], log: [] };
  }
}

// Admin creates a business on behalf of a user (found by username/email/id).
export async function adminCreateBusiness(owner: string, business: BizInput): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    const res = await fetch(withBase("/api/admin/business"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", owner, business }) });
    const d = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, id: d.id } : { ok: false, error: d.error };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

// Admin: upgrade all existing business accounts/profiles to the latest features.
export async function runBusinessMigration(): Promise<{ ok: boolean; businessesUpdated: number; sectionsAdded: string[]; note?: string; error?: string }> {
  try {
    const res = await fetch(withBase("/api/admin/business"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "migrate" }) });
    const d = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, businessesUpdated: d.businessesUpdated ?? 0, sectionsAdded: d.sectionsAdded ?? [], note: d.note } : { ok: false, businessesUpdated: 0, sectionsAdded: [], error: d.error };
  } catch { return { ok: false, businessesUpdated: 0, sectionsAdded: [], error: "Network error" }; }
}

export async function adminBusinessAction(id: string, action: "verify" | "reject" | "suspend" | "restore" | "remove", note?: string): Promise<boolean> {
  try {
    const res = await fetch(withBase("/api/admin/business"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action, note }) });
    return res.ok;
  } catch {
    return false;
  }
}

// ---- Business Pages (posts / announcements / offers) ----
export type BizPostKind = "post" | "announcement" | "offer";
export interface BizComment { id: string; userName: string; text: string; at: string }
export interface BizPost {
  id: string; businessId: string; kind: BizPostKind;
  text: string; imageUrl: string; offer?: string; createdAt: string;
  likeCount: number; liked: boolean;
  comments: BizComment[]; commentCount: number;
}
export interface BizInsights { posts: number; likes: number; comments: number; followers: number; views: number }
export interface BizPostInput { kind: BizPostKind; text: string; image?: string; offer?: string }

export async function fetchBusinessPosts(id: string): Promise<{ posts: BizPost[]; insights: BizInsights | null }> {
  try {
    const res = await fetch(withBase(`/api/business/${id}/posts`), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return { posts: d.posts ?? [], insights: d.insights ?? null };
  } catch {
    return { posts: [], insights: null };
  }
}

export async function createBusinessPost(id: string, input: BizPostInput): Promise<{ ok: boolean; error?: string; id?: string }> {
  const res = await fetch(withBase(`/api/business/${id}/posts`), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const d = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, id: d.id } : { ok: false, error: d.error };
}

export async function deleteBusinessPost(postId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(withBase(`/api/business/posts/${postId}`), { method: "DELETE", credentials: "include" });
  const d = await res.json().catch(() => ({}));
  return res.ok ? { ok: true } : { ok: false, error: d.error };
}

export async function togglePostLike(postId: string): Promise<{ liked: boolean; likeCount: number }> {
  try {
    const res = await fetch(withBase(`/api/business/posts/${postId}`), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "like" }) });
    const d = await res.json().catch(() => ({}));
    return { liked: !!d.liked, likeCount: d.likeCount ?? 0 };
  } catch {
    return { liked: false, likeCount: 0 };
  }
}

export async function addPostComment(postId: string, text: string): Promise<{ ok: boolean; error?: string; comment?: BizComment }> {
  const res = await fetch(withBase(`/api/business/posts/${postId}`), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "comment", text }) });
  const d = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, comment: d.comment } : { ok: false, error: d.error };
}

// ---- Business Marketplace (products / services) ----
export interface BizProduct { id: string; businessId: string; name: string; description?: string; price?: string; imageUrl: string; createdAt: string }
export interface BizProductInput { name: string; description?: string; price?: string; image?: string }

export async function fetchBusinessProducts(id: string): Promise<{ products: BizProduct[]; canManage: boolean }> {
  try {
    const res = await fetch(withBase(`/api/business/${id}/products`), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return { products: d.products ?? [], canManage: !!d.canManage };
  } catch {
    return { products: [], canManage: false };
  }
}

export async function createBusinessProduct(id: string, input: BizProductInput): Promise<{ ok: boolean; error?: string; id?: string }> {
  const res = await fetch(withBase(`/api/business/${id}/products`), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const d = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, id: d.id } : { ok: false, error: d.error };
}

export async function updateBusinessProduct(productId: string, patch: Partial<BizProductInput>): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(withBase(`/api/business/products/${productId}`), { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
  const d = await res.json().catch(() => ({}));
  return res.ok ? { ok: true } : { ok: false, error: d.error };
}

export async function deleteBusinessProduct(productId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(withBase(`/api/business/products/${productId}`), { method: "DELETE", credentials: "include" });
  const d = await res.json().catch(() => ({}));
  return res.ok ? { ok: true } : { ok: false, error: d.error };
}

export async function productEnquiry(productId: string, message?: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(withBase(`/api/business/products/${productId}/enquiry`), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
  const d = await res.json().catch(() => ({}));
  return res.ok ? { ok: true } : { ok: false, error: d.error };
}

// ---- Media: Reels (Shorts) + Videos ----
export type MediaKind = "reel" | "video";
export interface MediaCard {
  id: string; businessId: string; kind: MediaKind; title: string;
  videoUrl: string; thumbUrl: string; description?: string; createdAt: string; views: number;
}
export interface MediaInput { title: string; videoUrl: string; thumb?: string; description?: string }

export async function fetchBusinessMedia(id: string, kind: MediaKind): Promise<{ media: MediaCard[]; canManage: boolean }> {
  try {
    const res = await fetch(withBase(`/api/business/${id}/media?kind=${kind}`), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return { media: d.media ?? [], canManage: !!d.canManage };
  } catch {
    return { media: [], canManage: false };
  }
}

export async function postBusinessMedia(id: string, kind: MediaKind, input: MediaInput): Promise<{ ok: boolean; error?: string; id?: string }> {
  const res = await fetch(withBase(`/api/business/${id}/media`), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, kind }) });
  const d = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, id: d.id } : { ok: false, error: d.error };
}

export async function deleteBusinessMedia(mediaId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(withBase(`/api/business/media/${mediaId}`), { method: "DELETE", credentials: "include" });
  const d = await res.json().catch(() => ({}));
  return res.ok ? { ok: true } : { ok: false, error: d.error };
}

export async function watchBusinessMedia(mediaId: string): Promise<void> {
  try { await fetch(withBase(`/api/business/media/${mediaId}`), { method: "PATCH", credentials: "include" }); } catch { /* ignore */ }
}

// ---- Jobs ----
export type JobType = "Full Time" | "Part Time" | "Contract" | "Internship" | "Remote";
export type JobStatus = "pending" | "approved" | "rejected" | "closed";
export type AppStatus = "pending" | "forwarded" | "accepted" | "rejected";

export interface JobCard {
  id: string; businessId: string; businessName: string; businessLogo: string;
  title: string; jobType: string; salary?: string; location?: string; description: string;
  qualifications?: string; vacancies?: number; contact?: string; deadline?: string;
  fields?: Record<string, string>;
  status: JobStatus; createdAt: string; expired?: boolean; applied: boolean; applicantCount: number;
}
export interface ApplicationCard {
  id: string; jobId: string; jobTitle: string; businessId: string; businessName: string;
  userId: string; userName: string; userAvatar: string;
  message?: string; contact?: string; status: AppStatus; reason?: string; decidedBy?: string; createdAt: string;
}
export interface JobInput { title: string; jobType: string; salary?: string; location?: string; description: string; qualifications?: string; vacancies?: number; contact?: string; deadline?: string; fields?: Record<string, string> }

// Fallback job types — the live list is admin-editable via config.business.jobTypes.
export const JOB_TYPES: string[] = ["Full Time", "Part Time", "Contract", "Internship", "Remote"];

export async function fetchBusinessJobs(id: string): Promise<{ jobs: JobCard[]; applications: ApplicationCard[]; canManage: boolean }> {
  try {
    const res = await fetch(withBase(`/api/business/${id}/jobs`), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return { jobs: d.jobs ?? [], applications: d.applications ?? [], canManage: !!d.canManage };
  } catch {
    return { jobs: [], applications: [], canManage: false };
  }
}

export async function postJob(id: string, input: JobInput): Promise<{ ok: boolean; error?: string; id?: string }> {
  const res = await fetch(withBase(`/api/business/${id}/jobs`), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const d = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, id: d.id } : { ok: false, error: d.error };
}

export async function closeJob(jobId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(withBase(`/api/business/jobs/${jobId}`), { method: "PATCH", credentials: "include" });
  const d = await res.json().catch(() => ({}));
  return res.ok ? { ok: true } : { ok: false, error: d.error };
}

export async function deleteJob(jobId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(withBase(`/api/business/jobs/${jobId}`), { method: "DELETE", credentials: "include" });
  const d = await res.json().catch(() => ({}));
  return res.ok ? { ok: true } : { ok: false, error: d.error };
}

export async function applyToJob(jobId: string, input: { message?: string; contact?: string }): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(withBase(`/api/business/jobs/${jobId}/apply`), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const d = await res.json().catch(() => ({}));
  return res.ok ? { ok: true } : { ok: false, error: d.error };
}

// Business owner accepts / rejects an applicant (rejection carries a reason).
export async function decideApplication(appId: string, action: "accept" | "reject", reason?: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(withBase(`/api/business/applications/${appId}`), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason }) });
  const d = await res.json().catch(() => ({}));
  return res.ok ? { ok: true } : { ok: false, error: d.error };
}

// ---- Business Reviews ----
export interface ReviewCard { id: string; businessId: string; businessName?: string; userId: string; userName: string; userAvatar: string; rating: number; text: string; status: "visible" | "hidden"; createdAt: string; isMine: boolean }
export interface ReviewSummary { count: number; average: number; breakdown: Record<number, number> }

export async function fetchBusinessReviews(id: string): Promise<{ reviews: ReviewCard[]; summary: ReviewSummary; mine?: ReviewCard }> {
  try {
    const res = await fetch(withBase(`/api/business/${id}/reviews`), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return { reviews: d.reviews ?? [], summary: d.summary ?? { count: 0, average: 0, breakdown: {} }, mine: d.mine };
  } catch { return { reviews: [], summary: { count: 0, average: 0, breakdown: {} } }; }
}

export async function postReview(id: string, rating: number, text: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(withBase(`/api/business/${id}/reviews`), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating, text }) });
  const d = await res.json().catch(() => ({}));
  return res.ok ? { ok: true } : { ok: false, error: d.error };
}

export async function deleteReview(id: string, reviewId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(withBase(`/api/business/${id}/reviews`), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", reviewId }) });
  const d = await res.json().catch(() => ({}));
  return res.ok ? { ok: true } : { ok: false, error: d.error };
}

export async function reportBusiness(id: string, category: string, detail: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(withBase(`/api/business/${id}/report`), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, detail }) });
  const d = await res.json().catch(() => ({}));
  return res.ok ? { ok: true } : { ok: false, error: d.error };
}

// ---- Admin review management ----
export async function fetchAdminReviews(): Promise<ReviewCard[]> {
  try {
    const res = await fetch(withBase("/api/admin/reviews"), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return d.reviews ?? [];
  } catch { return []; }
}

export async function adminReviewAction(reviewId: string, action: "hide" | "show" | "remove"): Promise<boolean> {
  try {
    const res = await fetch(withBase("/api/admin/reviews"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reviewId, action }) });
    return res.ok;
  } catch { return false; }
}

export async function fetchAdminJobs(): Promise<{ jobs: JobCard[]; applications: ApplicationCard[] }> {
  try {
    const res = await fetch(withBase("/api/admin/jobs"), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return { jobs: d.jobs ?? [], applications: d.applications ?? [] };
  } catch {
    return { jobs: [], applications: [] };
  }
}

export async function adminJobAction(type: "job" | "application", id: string, action: "approve" | "reject" | "forward" | "accept" | "delete" | "close", note?: string): Promise<boolean> {
  try {
    const res = await fetch(withBase("/api/admin/jobs"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, id, action, note, reason: note }) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function adminPurgeExpiredJobs(): Promise<{ ok: boolean; removed: number }> {
  try {
    const res = await fetch(withBase("/api/admin/jobs"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "purgeExpired" }) });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, removed: d.removed ?? 0 };
  } catch {
    return { ok: false, removed: 0 };
  }
}
