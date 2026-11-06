// Mobile OTP. Credentials come from Admin → Settings (db.config.smsOtp).
// The TWILIO_* environment variables are used only when the panel has no
// usable keys saved, so nothing has to be hard-coded in the app.
//
// Providers:
//   generic        POST JSON to the admin's API URL (Bearer key, optional secret)
//   msg91          MSG91 OTP API (auth key + template id)
//   twilio         Twilio Messages API — this app generates the code
//   twilio-verify  Twilio Verify — Twilio generates the code

import { getDB } from "@/server/db";
import { randomInt } from "crypto";
import {
  bumpOtpAttempts,
  clearOtp,
  consumeOtp,
  issueOtp,
  normalizePhone,
  otpAttemptLocked,
  otpResendWait,
  type OtpCheck,
} from "@/server/repo";

export type SmsProvider = "generic" | "msg91" | "twilio" | "twilio-verify";

export interface SmsSettings {
  provider: SmsProvider;
  apiKey: string;
  apiSecret: string;
  senderId: string;
  templateId: string;
  apiUrl: string;
  countryCode: string;
  otpLength: number;
  expiryMinutes: number;
  resendSeconds: number;
  maxAttempts: number;
  loginEnabled: boolean;
  registrationEnabled: boolean;
  updatedAt: string;
  updatedBy: string;
  source: "settings" | "env" | "none";
}

const PROVIDERS: SmsProvider[] = ["generic", "msg91", "twilio", "twilio-verify"];

export function isSmsProvider(v: string): v is SmsProvider {
  return (PROVIDERS as string[]).includes(v);
}

function clamp(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function policy(raw: {
  provider?: string;
  countryCode?: string;
  otpLength?: number;
  expiryMinutes?: number;
  resendSeconds?: number;
  maxAttempts?: number;
  loginEnabled?: boolean;
  registrationEnabled?: boolean;
  senderId?: string;
  templateId?: string;
  apiUrl?: string;
  updatedAt?: string;
  updatedBy?: string;
} | undefined): Omit<SmsSettings, "apiKey" | "apiSecret" | "source"> {
  const provider = raw?.provider && isSmsProvider(raw.provider) ? raw.provider : "generic";
  const country = typeof raw?.countryCode === "string" && /^\+\d{1,4}$/.test(raw.countryCode.trim())
    ? raw.countryCode.trim()
    : "+966";
  return {
    provider,
    senderId: (raw?.senderId ?? "").trim().slice(0, 20),
    templateId: (raw?.templateId ?? "").trim().slice(0, 80),
    apiUrl: (raw?.apiUrl ?? "").trim().replace(/\/+$/, "").slice(0, 300),
    countryCode: country,
    otpLength: clamp(raw?.otpLength ?? 6, 4, 8, 6),
    expiryMinutes: clamp(raw?.expiryMinutes ?? 5, 1, 30, 5),
    resendSeconds: clamp(raw?.resendSeconds ?? 30, 15, 300, 30),
    maxAttempts: clamp(raw?.maxAttempts ?? 5, 1, 10, 5),
    loginEnabled: raw?.loginEnabled !== false,
    registrationEnabled: raw?.registrationEnabled === true,
    updatedAt: raw?.updatedAt ?? "",
    updatedBy: raw?.updatedBy ?? "",
  };
}

/** Keys present on the server, used only when the admin panel has not saved a working set. */
export function envSmsSettings(): SmsSettings | null {
  const sid = process.env.TWILIO_ACCOUNT_SID || "";
  const token = process.env.TWILIO_AUTH_TOKEN || "";
  const verify = process.env.TWILIO_VERIFY_SID || "";
  if (!sid || !token || !verify) return null;
  const base = policy({ provider: "twilio-verify", templateId: verify, countryCode: process.env.SMS_COUNTRY_CODE || "+966" });
  return { ...base, apiKey: sid, apiSecret: token, source: "env" };
}

export function credsComplete(s: { provider?: string; apiKey?: string; apiSecret?: string; senderId?: string; templateId?: string; apiUrl?: string }): boolean {
  const provider = s.provider && isSmsProvider(s.provider) ? s.provider : "";
  const key = (s.apiKey ?? "").trim();
  const secret = (s.apiSecret ?? "").trim();
  if (!provider || !key) return false;
  if (provider === "generic") return /^https?:\/\/[^\s]+/i.test((s.apiUrl ?? "").trim());
  if (provider === "msg91") return !!(s.templateId ?? "").trim();
  if (provider === "twilio") return !!secret && !!(s.senderId ?? "").trim();
  if (provider === "twilio-verify") return !!secret && !!(s.templateId ?? "").trim();
  return false;
}

export async function smsSettings(): Promise<SmsSettings> {
  const saved = (await getDB()).config?.smsOtp;
  const p = policy(saved);
  if (saved && credsComplete({ ...p, apiKey: saved.apiKey, apiSecret: saved.apiSecret })) {
    return { ...p, apiKey: (saved.apiKey ?? "").trim(), apiSecret: (saved.apiSecret ?? "").trim(), source: "settings" };
  }
  const env = envSmsSettings();
  if (env) {
    // Panel switches and timing still apply when the keys come from the server env.
    return {
      ...env,
      countryCode: saved?.countryCode ? p.countryCode : env.countryCode,
      otpLength: saved?.otpLength ? p.otpLength : env.otpLength,
      expiryMinutes: saved?.expiryMinutes ? p.expiryMinutes : env.expiryMinutes,
      resendSeconds: saved?.resendSeconds ? p.resendSeconds : env.resendSeconds,
      maxAttempts: saved?.maxAttempts ? p.maxAttempts : env.maxAttempts,
      loginEnabled: saved ? p.loginEnabled : true,
      registrationEnabled: saved ? p.registrationEnabled : false,
    };
  }
  return { ...p, apiKey: "", apiSecret: "", source: "none" };
}

export function smsReady(s: SmsSettings): boolean {
  return s.source !== "none" && credsComplete(s);
}

function demoCode(len: number): string {
  return "123456789".slice(0, len);
}

function randomCode(len: number): string {
  const max = 10 ** len;
  const n = randomInt(0, max);
  return String(n).padStart(len, "0");
}

function providerError(status: number, body: string): string {
  let detail = "";
  try {
    const j = JSON.parse(body) as { message?: string; error?: string; type?: string };
    detail = (j.message || j.error || "").toString().slice(0, 160);
  } catch { /* not JSON */ }
  return detail ? `SMS provider said: ${detail}` : `SMS provider error (${status})`;
}

async function postForm(url: string, auth: string, fields: Record<string, string>): Promise<{ ok: boolean; error?: string; status: number }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: auth },
    body: new URLSearchParams(fields).toString(),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return { ok: false, status: res.status, error: providerError(res.status, await res.text()) };
  return { ok: true, status: res.status };
}

/** Deliver `text` (or, for Twilio Verify, ask Twilio to create the code). */
async function deliver(s: SmsSettings, phoneE164: string, code: string | null, text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (s.provider === "twilio-verify") {
      const auth = "Basic " + Buffer.from(`${s.apiKey}:${s.apiSecret}`).toString("base64");
      const r = await postForm(
        `https://verify.twilio.com/v2/Services/${encodeURIComponent(s.templateId)}/Verifications`,
        auth,
        { To: phoneE164, Channel: "sms" },
      );
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }
    if (s.provider === "twilio") {
      const auth = "Basic " + Buffer.from(`${s.apiKey}:${s.apiSecret}`).toString("base64");
      const url = s.apiUrl || `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(s.apiKey)}/Messages.json`;
      const r = await postForm(url, auth, { To: phoneE164, From: s.senderId, Body: text });
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }
    if (s.provider === "msg91") {
      const url = s.apiUrl || "https://control.msg91.com/api/v5/otp";
      const mobile = phoneE164.replace(/\D/g, "");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", authkey: s.apiKey },
        body: JSON.stringify({
          template_id: s.templateId,
          mobile,
          otp: code ?? "000000",
          ...(s.senderId ? { sender: s.senderId } : {}),
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return { ok: false, error: providerError(res.status, await res.text()) };
      const data = await res.json().catch(() => ({})) as { type?: string; message?: string };
      if (data.type && data.type !== "success") return { ok: false, error: (data.message || "MSG91 rejected the request").slice(0, 160) };
      return { ok: true };
    }
    // Generic HTTP API. The provider receives the code and can place it in its own template.
    if (!s.apiUrl) return { ok: false, error: "The API URL is required for a generic provider." };
    const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${s.apiKey}` };
    if (s.apiSecret) headers["X-Api-Secret"] = s.apiSecret;
    const res = await fetch(s.apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        to: phoneE164,
        otp: code,
        senderId: s.senderId,
        templateId: s.templateId,
        message: text,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { ok: false, error: providerError(res.status, await res.text()) };
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach the SMS provider" };
  }
}

export function otpFailMessage(status: OtpCheck): string {
  if (status === "locked") return "Too many incorrect attempts. Request a new code.";
  if (status === "expired") return "This code has expired. Request a new one.";
  return "Incorrect or expired code";
}

export async function sendMobileOtp(
  phoneRaw: string,
  purpose: "login" | "register",
): Promise<{ ok: true; demo: boolean; demoCode?: string; length: number; resendSeconds: number } | { ok: false; error: string; status: number }> {
  const s = await smsSettings();
  if (purpose === "login" && !s.loginEnabled) return { ok: false, error: "Mobile OTP login is turned off.", status: 403 };
  if (purpose === "register" && !s.registrationEnabled) return { ok: false, error: "Mobile OTP is not used for registration.", status: 403 };

  const phone = normalizePhone(phoneRaw, s.countryCode);
  if (phone.replace(/\D/g, "").length < 10) return { ok: false, error: "Enter a valid mobile number", status: 400 };

  const wait = await otpResendWait(phoneRaw, s.resendSeconds * 1000, s.countryCode);
  if (wait > 0) return { ok: false, error: `Please wait ${wait} seconds before requesting another code.`, status: 429 };

  const length = smsReady(s) && s.provider === "twilio-verify" ? 6 : s.otpLength;
  if (!smsReady(s)) {
    const code = demoCode(length);
    await issueOtp(phoneRaw, code, s.expiryMinutes * 60 * 1000, s.countryCode);
    return { ok: true, demo: true, demoCode: code, length, resendSeconds: s.resendSeconds };
  }

  if (s.provider === "twilio-verify") {
    const sent = await deliver(s, phone, null, "");
    if (!sent.ok) return { ok: false, error: sent.error ?? "Could not send the code", status: 502 };
    // Empty code: Twilio holds the real one. The record only tracks resend and attempts.
    await issueOtp(phoneRaw, "", s.expiryMinutes * 60 * 1000, s.countryCode);
    return { ok: true, demo: false, length, resendSeconds: s.resendSeconds };
  }

  const code = randomCode(length);
  const text = `Your LotusPlay code is ${code}. It expires in ${s.expiryMinutes} minutes.`;
  const sent = await deliver(s, phone, code, text);
  if (!sent.ok) return { ok: false, error: sent.error ?? "Could not send the code", status: 502 };
  await issueOtp(phoneRaw, code, s.expiryMinutes * 60 * 1000, s.countryCode);
  return { ok: true, demo: false, length, resendSeconds: s.resendSeconds };
}

export async function verifyMobileCode(phoneRaw: string, code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const s = await smsSettings();
  const phone = normalizePhone(phoneRaw, s.countryCode);
  const entered = code.trim();
  if (!/^\d{4,8}$/.test(entered)) return { ok: false, error: "Enter the code from the text message" };

  if (smsReady(s) && s.provider === "twilio-verify") {
    if (await otpAttemptLocked(phoneRaw, s.maxAttempts, s.countryCode)) {
      return { ok: false, error: otpFailMessage("locked") };
    }
    const approved = await checkTwilioVerify(s, phone, entered);
    if (!approved) {
      const status = await bumpOtpAttempts(phoneRaw, s.maxAttempts, s.countryCode);
      return { ok: false, error: otpFailMessage(status === "locked" ? "locked" : "wrong") };
    }
    await clearOtp(phoneRaw, s.countryCode);
    return { ok: true };
  }

  const status = await consumeOtp(phoneRaw, entered, s.maxAttempts, s.countryCode);
  if (status !== "ok") return { ok: false, error: otpFailMessage(status) };
  return { ok: true };
}

async function checkTwilioVerify(s: SmsSettings, phoneE164: string, code: string): Promise<boolean> {
  try {
    const auth = "Basic " + Buffer.from(`${s.apiKey}:${s.apiSecret}`).toString("base64");
    const res = await fetch(`https://verify.twilio.com/v2/Services/${encodeURIComponent(s.templateId)}/VerificationCheck`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: auth },
      body: new URLSearchParams({ To: phoneE164, Code: code }).toString(),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { status?: string };
    return data.status === "approved";
  } catch {
    return false;
  }
}

/** Credential check, and a test text when `testPhone` is set. Does not store a login code. */
export async function testSmsConnection(s: SmsSettings, testPhone: string): Promise<{ ok: boolean; error?: string; detail?: string }> {
  if (!credsComplete(s)) return { ok: false, error: "Fill in the required keys for this provider before testing." };
  const phone = testPhone.trim() ? normalizePhone(testPhone, s.countryCode) : "";
  if (testPhone.trim() && phone.replace(/\D/g, "").length < 10) return { ok: false, error: "Enter a valid mobile number to send the test to." };

  try {
    if (s.provider === "twilio" || s.provider === "twilio-verify") {
      const auth = "Basic " + Buffer.from(`${s.apiKey}:${s.apiSecret}`).toString("base64");
      const url = s.provider === "twilio-verify"
        ? `https://verify.twilio.com/v2/Services/${encodeURIComponent(s.templateId)}`
        : `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(s.apiKey)}.json`;
      const res = await fetch(url, { headers: { Authorization: auth }, signal: AbortSignal.timeout(15000) });
      if (!res.ok) return { ok: false, error: providerError(res.status, await res.text()) };
      if (!phone) return { ok: true, detail: "The provider accepted the keys. Add a mobile number to also send a test text." };
    } else if (s.provider === "msg91") {
      const url = `https://control.msg91.com/api/balance.php?authkey=${encodeURIComponent(s.apiKey)}&type=4`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const body = (await res.text()).trim().slice(0, 80);
      if (!res.ok || !body || /error|invalid|auth/i.test(body)) return { ok: false, error: body ? `MSG91 said: ${body}` : `MSG91 error (${res.status})` };
      if (!phone) return { ok: true, detail: `MSG91 accepted the key (balance ${body}). Add a mobile number to also send a test text.` };
    } else if (!phone) {
      const headers: Record<string, string> = { Authorization: `Bearer ${s.apiKey}` };
      if (s.apiSecret) headers["X-Api-Secret"] = s.apiSecret;
      const res = await fetch(s.apiUrl, { method: "GET", headers, signal: AbortSignal.timeout(15000) });
      if (res.status === 401 || res.status === 403) return { ok: false, error: providerError(res.status, await res.text()) };
      return { ok: true, detail: `The API address responded (${res.status}). Add a mobile number to also send a test text.` };
    }

    const sent = await deliver(
      s,
      phone,
      null,
      "LotusPlay SMS test. Your settings are working. You can ignore this message.",
    );
    // MSG91's OTP API requires a code. deliver() sends 000000 when code is null,
    // and that code is not stored, so it cannot be used to log in.
    if (!sent.ok) return { ok: false, error: sent.error };
    if (s.provider === "twilio-verify") {
      return { ok: true, detail: "Twilio accepted the keys and sent a real verification code to that number. It can be used once on the login screen." };
    }
    return { ok: true, detail: "The test message was accepted by the provider." };
  } catch {
    return { ok: false, error: "Could not reach the SMS provider" };
  }
}
