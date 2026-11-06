"use client";

import { withBase } from "./base-path";

export type KycStatus = "unverified" | "pending" | "verified" | "rejected" | "resubmit";

export interface KycDoc { kind: string; url: string; name: string; originalName: string; at: string }
export interface BankDetails {
  accountHolder?: string; bankName?: string; accountNumber?: string;
  iban?: string; branch?: string; swift?: string;
  status?: "unverified" | "pending" | "verified" | "rejected"; note?: string;
}
export interface MyKyc {
  status: KycStatus;
  legalName?: string; idType?: string; idNumber?: string; note?: string;
  documents?: KycDoc[]; bank?: BankDetails;
  submittedAt?: string; reviewedAt?: string; reviewedBy?: string;
}

export const ID_TYPES = ["National ID", "Passport", "Driving License"];

/** Country → accepted government-ID document types (KYC list changes by country). */
export const KYC_DOCS_BY_COUNTRY: Record<string, string[]> = {
  India: ["Aadhaar Card (Front)", "Aadhaar Card (Back)", "PAN Card", "Passport", "Driving Licence", "Voter ID"],
  "Saudi Arabia": ["National ID", "Iqama (Residence ID)", "Passport", "Driving Licence"],
  "United Arab Emirates": ["Emirates ID", "Passport", "Driving Licence"],
};
const GENERIC_KYC_DOCS = ["National ID", "Passport", "Driving Licence", "Voter ID"];
/** The ID document types offered for a given country (falls back to a generic set). */
export function kycDocTypes(country?: string): string[] {
  if (!country) return GENERIC_KYC_DOCS;
  return KYC_DOCS_BY_COUNTRY[country] ?? GENERIC_KYC_DOCS;
}
/** Documents that must be verified before a withdrawal is allowed (per country).
 *  India → PAN + Aadhaar are mandatory. */
export function kycMandatoryDocs(country?: string): string[] {
  if ((country ?? "").toLowerCase().includes("india")) return ["PAN Card", "Aadhaar Card (Front)"];
  return [];
}

export async function fetchMyKyc(): Promise<MyKyc | null> {
  try {
    const res = await fetch(withBase("/api/kyc"), { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.kyc as MyKyc;
  } catch {
    return null;
  }
}

export async function submitKyc(payload: {
  legalName?: string; idType?: string; idNumber?: string;
  documents?: { kind: string; name: string; url: string; originalName: string }[];
  bank?: BankDetails;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/kyc"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (data.error as string) ?? "Could not submit KYC" };
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error" };
  }
}
