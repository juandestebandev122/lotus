"use client";

import { withBase } from "./base-path";
import type { Job } from "./jobs";
import type { BusinessCard } from "./business";

export interface ReelComment {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  text: string;
  at: string;
}

export type ReelPrivacy = "public" | "friends" | "private";

export interface Reel {
  id: string;
  kind: "reel" | "video";
  ownerId: string; ownerName: string; ownerUsername: string; ownerAvatar: string;
  videoUrl: string; embedUrl?: string; thumbUrl: string;
  caption: string; hashtags: string[];
  musicName?: string; musicSrc?: string; stickers: string[];
  privacy: ReelPrivacy;
  disableComments: boolean; disableSharing: boolean;
  status: "draft" | "published"; featured: boolean; hidden: boolean;
  businessId?: string; businessName?: string; productDetail?: string; contact?: string; website?: string;
  likeCount: number; liked: boolean;
  commentCount: number; comments: ReelComment[];
  saveCount: number; saved: boolean;
  shares: number; views: number;
  following: boolean; isOwner: boolean;
  createdAt: string;
}

export interface ReelInput {
  kind?: "reel" | "video";
  videoFile: string;
  videoUrl?: string; // external video LINK (YouTube / Vimeo / direct URL) instead of an upload
  thumb?: string;
  caption?: string;
  hashtags?: string[];
  musicId?: string; musicName?: string; musicSrc?: string;
  stickers?: string[];
  privacy?: ReelPrivacy;
  disableComments?: boolean;
  disableSharing?: boolean;
  status?: "draft" | "published";
  businessId?: string; productDetail?: string; contact?: string; website?: string;
}

export const PRIVACY_LABEL: Record<ReelPrivacy, string> = {
  public: "Public — everyone",
  friends: "Friends only",
  private: "Private — just me",
};

export type ReelTab = "latest" | "trending" | "suggested" | "following" | "featured" | "saved";

export interface ReelPage { reels: Reel[]; nextOffset: number; hasMore: boolean; total: number; disabled?: boolean }

export async function fetchReels(tab: ReelTab, opts: { offset?: number; limit?: number; q?: string; businessId?: string; kind?: "reel" | "video"; scope?: "user" | "business" | "personal" } = {}): Promise<ReelPage> {
  try {
    const p = new URLSearchParams({ tab });
    if (opts.offset) p.set("offset", String(opts.offset));
    if (opts.limit) p.set("limit", String(opts.limit));
    if (opts.q) p.set("q", opts.q);
    if (opts.businessId) p.set("businessId", opts.businessId);
    if (opts.kind) p.set("kind", opts.kind);
    if (opts.scope) p.set("scope", opts.scope);
    const res = await fetch(withBase(`/api/reels?${p.toString()}`), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return { reels: d.reels ?? [], nextOffset: d.nextOffset ?? 0, hasMore: !!d.hasMore, total: d.total ?? 0, disabled: d.disabled };
  } catch {
    return { reels: [], nextOffset: 0, hasMore: false, total: 0 };
  }
}

export async function fetchReel(id: string): Promise<Reel | null> {
  try {
    const res = await fetch(withBase(`/api/reels/${id}`), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return res.ok ? (d.reel ?? null) : null;
  } catch {
    return null;
  }
}

export async function fetchUserReels(username: string, kind?: "reel" | "video"): Promise<{ reels: Reel[]; totalViews: number; totalLikes: number; ownerName: string }> {
  try {
    const q = kind ? `?kind=${kind}` : "";
    const res = await fetch(withBase(`/api/reels/user/${encodeURIComponent(username)}${q}`), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return { reels: d.reels ?? [], totalViews: d.totalViews ?? 0, totalLikes: d.totalLikes ?? 0, ownerName: d.ownerName ?? "" };
  } catch {
    return { reels: [], totalViews: 0, totalLikes: 0, ownerName: "" };
  }
}

/** Upload the video/recording; returns the stored filename to pass into createReel. */
export async function uploadReelVideo(file: File): Promise<{ ok: boolean; file?: string; url?: string; error?: string }> {
  try {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(withBase("/api/reels/upload"), { method: "POST", credentials: "include", body: fd });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: d.error ?? "Upload failed" };
    return { ok: true, file: d.file, url: d.url };
  } catch {
    return { ok: false, error: "Network error during upload" };
  }
}

export async function createReel(input: ReelInput): Promise<{ ok: boolean; error?: string; id?: string }> {
  const res = await fetch(withBase("/api/reels"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const d = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, id: d.id } : { ok: false, error: d.error };
}

export async function updateReel(id: string, patch: Partial<ReelInput> & { featured?: boolean; hidden?: boolean }): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(withBase(`/api/reels/${id}`), { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
  const d = await res.json().catch(() => ({}));
  return res.ok ? { ok: true } : { ok: false, error: d.error };
}

export async function deleteReel(id: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(withBase(`/api/reels/${id}`), { method: "DELETE", credentials: "include" });
  const d = await res.json().catch(() => ({}));
  return res.ok ? { ok: true } : { ok: false, error: d.error };
}

async function reelAction<T>(id: string, payload: Record<string, unknown>, fallback: T): Promise<T> {
  try {
    const res = await fetch(withBase(`/api/reels/${id}/action`), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const d = await res.json().catch(() => ({}));
    return res.ok ? (d as T) : fallback;
  } catch {
    return fallback;
  }
}

export const likeReel = (id: string) => reelAction<{ liked: boolean; likeCount: number }>(id, { action: "like" }, { liked: false, likeCount: 0 });
export const saveReel = (id: string) => reelAction<{ saved: boolean; saveCount: number }>(id, { action: "save" }, { saved: false, saveCount: 0 });
export const shareReel = (id: string) => reelAction<{ shares: number }>(id, { action: "share" }, { shares: 0 });
export const viewReel = (id: string) => reelAction<{ views: number }>(id, { action: "view" }, { views: 0 });
export const reportWatch = (id: string, seconds: number) => { if (seconds >= 1) reelAction(id, { action: "watch", seconds: Math.round(seconds) }, {}); };
export const commentReel = (id: string, text: string) => reelAction<{ ok: boolean; error?: string; comment?: ReelComment; commentCount?: number }>(id, { action: "comment", text }, { ok: false, error: "Network error" });
export const reportReelContent = (id: string, category: string, detail: string) => reelAction<{ ok: boolean; error?: string }>(id, { action: "report", category, detail }, { ok: false, error: "Network error" });

// ---- Home page: trending shorts/videos + latest jobs ----
export interface HomeFeeds { trendingShorts: Reel[]; trendingVideos: Reel[]; latestJobs: Job[]; businesses: BusinessCard[] }
export async function fetchHomeFeeds(): Promise<HomeFeeds> {
  try {
    const res = await fetch(withBase("/api/home-feeds"), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return { trendingShorts: d.trendingShorts ?? [], trendingVideos: d.trendingVideos ?? [], latestJobs: d.latestJobs ?? [], businesses: d.businesses ?? [] };
  } catch {
    return { trendingShorts: [], trendingVideos: [], latestJobs: [], businesses: [] };
  }
}

export async function toggleFollowUser(userId: string): Promise<{ following: boolean }> {
  try {
    const res = await fetch(withBase("/api/follow"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
    const d = await res.json().catch(() => ({}));
    return { following: !!d.following };
  } catch {
    return { following: false };
  }
}

// ---- Leaderboards ----
export interface ReelCreatorRank { userId: string; name: string; username: string; avatar: string; reels: number; views: number; likes: number }
export async function fetchReelLeaderboards(): Promise<{ mostViewed: Reel[]; mostLiked: Reel[]; topCreators: ReelCreatorRank[] }> {
  try {
    const res = await fetch(withBase("/api/reels/leaderboard"), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return { mostViewed: d.mostViewed ?? [], mostLiked: d.mostLiked ?? [], topCreators: d.topCreators ?? [] };
  } catch {
    return { mostViewed: [], mostLiked: [], topCreators: [] };
  }
}

// ---- Admin ----
export interface AdminReelRow {
  id: string; kind: "reel" | "video"; ownerId: string; ownerName: string; ownerUsername: string;
  caption: string; thumbUrl: string; videoUrl: string;
  privacy: string; status: string; hidden: boolean; featured: boolean;
  views: number; likes: number; comments: number; shares: number; saves: number;
  businessName?: string; reportCount: number; createdAt: string;
}
export interface ReelReportRow { id: string; reelId: string; reportedName: string; byName: string; category: string; detail: string; at: string; status: string }
export interface ReelAnalytics { total: number; published: number; drafts: number; hidden: number; featured: number; views: number; likes: number; comments: number; shares: number }

export async function fetchAdminReels(q = ""): Promise<{ reels: AdminReelRow[]; analytics: ReelAnalytics; reports: ReelReportRow[] }> {
  try {
    const res = await fetch(withBase(`/api/admin/reels${q ? `?q=${encodeURIComponent(q)}` : ""}`), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return {
      reels: d.reels ?? [],
      analytics: d.analytics ?? { total: 0, published: 0, drafts: 0, hidden: 0, featured: 0, views: 0, likes: 0, comments: 0, shares: 0 },
      reports: d.reports ?? [],
    };
  } catch {
    return { reels: [], analytics: { total: 0, published: 0, drafts: 0, hidden: 0, featured: 0, views: 0, likes: 0, comments: 0, shares: 0 }, reports: [] };
  }
}

export async function adminReelAction(id: string, action: "hide" | "unhide" | "feature" | "unfeature" | "delete" | "block"): Promise<boolean> {
  try {
    const res = await fetch(withBase("/api/admin/reels"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) });
    return res.ok;
  } catch {
    return false;
  }
}
