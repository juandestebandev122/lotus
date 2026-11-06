"use client";

import { withBase } from "./base-path";

export type DocReqStatus = "pending" | "submitted" | "under_review" | "approved" | "rejected" | "resubmit";

export interface DocSubmission { url: string; name: string; originalName: string; comment?: string; at: string }
export interface DocRequest {
  id: string;
  userId: string;
  userName: string;
  title: string;
  description?: string;
  type: string;
  dueDate?: string;
  mandatory: boolean;
  status: DocReqStatus;
  requestedBy: string;
  createdAt: string;
  submissions: DocSubmission[];
  remarks?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  history: { at: string; action: string; by: string }[];
}

export const DOC_REQUEST_TYPES = [
  "Request Letter", "ID Card / Passport", "Bank Passbook", "Bank Statement",
  "Address Proof", "KYC Documents", "Tax Documents", "Custom Document Request",
];

export const DOC_STATUS_META: Record<DocReqStatus, { label: string; tone: string }> = {
  pending: { label: "Pending", tone: "bg-white/[0.06] text-mist-300" },
  submitted: { label: "Submitted", tone: "bg-sky-500/15 text-sky-300" },
  under_review: { label: "Under review", tone: "bg-amber-500/15 text-amber-300" },
  approved: { label: "Approved", tone: "bg-emerald-500/15 text-emerald-300" },
  rejected: { label: "Rejected", tone: "bg-rose-500/15 text-rose-300" },
  resubmit: { label: "Re-submit required", tone: "bg-amber-500/15 text-amber-300" },
};

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(withBase(path), { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch { return null; }
}

// ---- User ----
export async function fetchMyDocRequests(): Promise<DocRequest[]> {
  const data = await getJson<{ requests: DocRequest[] }>("/api/documents");
  return data?.requests ?? [];
}

export async function submitDocument(id: string, file: { name: string; url: string; originalName: string }, comment?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/documents"), {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ id, ...file, comment }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, error: (data as { error?: string }).error };
  } catch { return { ok: false, error: "Network error" }; }
}

// ---- Admin ----
export async function fetchAllDocRequests(): Promise<DocRequest[]> {
  const data = await getJson<{ requests: DocRequest[] }>("/api/admin/documents");
  return data?.requests ?? [];
}

export async function createDocRequest(input: { userIds: string[]; title: string; description?: string; type: string; dueDate?: string; mandatory: boolean }): Promise<{ ok: boolean; error?: string; created?: number }> {
  try {
    const res = await fetch(withBase("/api/admin/documents"), {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify(input),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, error: (data as { error?: string }).error, created: (data as { created?: number }).created };
  } catch { return { ok: false, error: "Network error" }; }
}

export async function reviewDocRequest(id: string, status: DocReqStatus, remarks?: string): Promise<boolean> {
  try {
    const res = await fetch(withBase("/api/admin/documents"), {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ id, status, remarks }),
    });
    return res.ok;
  } catch { return false; }
}

export async function deleteDocRequest(id: string): Promise<boolean> {
  try {
    const res = await fetch(withBase("/api/admin/documents"), {
      method: "DELETE", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ id }),
    });
    return res.ok;
  } catch { return false; }
}
