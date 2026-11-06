"use client";

import { withBase } from "./base-path";

// ============================================================
// Account security client helpers — Change Password, Forgot/Reset,
// Login History & Active Sessions. Talk to /api/auth/*.
// ============================================================

async function post(path: string, body: unknown): Promise<{ ok: boolean; error?: string; data: Record<string, unknown> }> {
  try {
    const res = await fetch(withBase(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (data.error as string) ?? "Something went wrong", data };
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Network error", data: {} };
  }
}

export function changePassword(currentPassword: string, newPassword: string, logoutOthers = false) {
  return post("/api/auth/password", { currentPassword, newPassword, logoutOthers });
}

export function forgotPassword(identifier: string) {
  return post("/api/auth/forgot", { identifier });
}

export function resetPassword(identifier: string, code: string, newPassword: string) {
  return post("/api/auth/reset", { identifier, code, newPassword });
}

export function logoutOtherDevices() {
  return post("/api/auth/security", {});
}

// Permanently delete the signed-in user's own account (self-service).
// `password` is required for accounts that have one; OTP/Google-only accounts
// can pass an empty string.
export function deleteMyAccount(password: string) {
  return post("/api/account/delete", { password });
}

export interface LoginEventView { at: string; ip: string; device: string; method: string }
export interface SecurityInfo {
  hasPassword: boolean;
  passwordChangedAt: string | null;
  loginHistory: LoginEventView[];
  currentSession: { since: string | null; ip: string; device: string };
}

export async function fetchSecurityInfo(): Promise<SecurityInfo | null> {
  try {
    const res = await fetch(withBase("/api/auth/security"), { credentials: "include" });
    if (!res.ok) return null;
    return (await res.json()) as SecurityInfo;
  } catch {
    return null;
  }
}
