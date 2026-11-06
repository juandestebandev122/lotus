import { withBase } from "./base-path";

export interface Referral {
  id: string;
  referrerId: string;
  referrerName: string;
  referredId: string;
  referredName: string;
  code: string;
  reward: number;
  status: "pending" | "approved" | "rejected" | "blocked";
  flags: string[];
  ip?: string;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  note?: string;
}

export interface ReferralStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  blocked: number;
  coinsPaid: number;
  topReferrers: { name: string; count: number }[];
}

export async function fetchReferrals(): Promise<{ referrals: Referral[]; stats: ReferralStats | null }> {
  try {
    const res = await fetch(withBase("/api/admin/referrals"), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return { referrals: Array.isArray(d.referrals) ? d.referrals : [], stats: d.stats ?? null };
  } catch {
    return { referrals: [], stats: null };
  }
}

export async function decideReferral(id: string, action: "approve" | "reject" | "block", note?: string): Promise<boolean> {
  try {
    const res = await fetch(withBase("/api/admin/referrals"), {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, id, note }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function regenerateUserCode(userId: string): Promise<string | null> {
  try {
    const res = await fetch(withBase("/api/admin/referrals"), {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "regenerateCode", userId }),
    });
    const d = await res.json().catch(() => ({}));
    return res.ok ? (d.code ?? null) : null;
  } catch {
    return null;
  }
}
