import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getDB, withDB, defaultConfig } from "@/server/db";
import { addAdminLog } from "@/server/repo";
import { canAccess } from "@/lib/admin-perms";
import {
  credsComplete,
  envSmsSettings,
  isSmsProvider,
  smsSettings,
  testSmsConnection,
  type SmsProvider,
  type SmsSettings,
} from "@/server/sms";

export const runtime = "nodejs";

// Admin → Settings → Mobile OTP. The API secret is write-only: it is never
// returned, only whether one is saved and its last 4 characters.

async function requireSettingsAdmin() {
  const user = await getCurrentUser();
  if (!user) return { error: fail("Please log in first", 401) };
  if (user.role !== "admin" || !canAccess("settings", user.adminRole, user.adminPermissions)) {
    return { error: fail("Administrator access required", 403) };
  }
  return { user };
}

const hint = (s: string) => (s.length > 4 ? `…${s.slice(-4)}` : s ? "…" : "");

async function view() {
  const saved = (await getDB()).config?.smsOtp ?? {};
  const active = await smsSettings();
  return {
    saved: {
      provider: saved.provider && isSmsProvider(saved.provider) ? saved.provider : "generic",
      apiKey: saved.apiKey ?? "",
      senderId: saved.senderId ?? "",
      templateId: saved.templateId ?? "",
      apiUrl: saved.apiUrl ?? "",
      countryCode: saved.countryCode ?? "+966",
      otpLength: saved.otpLength ?? 6,
      expiryMinutes: saved.expiryMinutes ?? 5,
      resendSeconds: saved.resendSeconds ?? 30,
      maxAttempts: saved.maxAttempts ?? 5,
      loginEnabled: saved.loginEnabled !== false,
      registrationEnabled: saved.registrationEnabled === true,
      secretSet: !!saved.apiSecret,
      secretHint: hint(saved.apiSecret ?? ""),
      updatedAt: saved.updatedAt ?? "",
      updatedBy: saved.updatedBy ?? "",
    },
    active: {
      source: active.source,
      provider: active.provider,
      ready: active.source !== "none" && credsComplete(active),
      loginEnabled: active.loginEnabled,
      registrationEnabled: active.registrationEnabled,
    },
    envConfigured: !!envSmsSettings(),
  };
}

type Body = {
  provider?: unknown;
  apiKey?: unknown;
  apiSecret?: unknown;
  senderId?: unknown;
  templateId?: unknown;
  apiUrl?: unknown;
  countryCode?: unknown;
  otpLength?: unknown;
  expiryMinutes?: unknown;
  resendSeconds?: unknown;
  maxAttempts?: unknown;
  loginEnabled?: unknown;
  registrationEnabled?: unknown;
  testPhone?: unknown;
  clear?: unknown;
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function num(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Form values → settings. A blank secret means "keep the saved one". */
async function settingsFromBody(b: Body): Promise<SmsSettings> {
  const saved = (await getDB()).config?.smsOtp ?? {};
  const provider: SmsProvider = typeof b.provider === "string" && isSmsProvider(b.provider) ? b.provider : "generic";
  const country = str(b.countryCode, 8);
  return {
    provider,
    apiKey: str(b.apiKey, 200),
    apiSecret: str(b.apiSecret, 300) || saved.apiSecret || "",
    senderId: str(b.senderId, 20),
    templateId: str(b.templateId, 80),
    apiUrl: str(b.apiUrl, 300).replace(/\/+$/, ""),
    countryCode: /^\+\d{1,4}$/.test(country) ? country : "+966",
    otpLength: num(b.otpLength, 4, 8, 6),
    expiryMinutes: num(b.expiryMinutes, 1, 30, 5),
    resendSeconds: num(b.resendSeconds, 15, 300, 30),
    maxAttempts: num(b.maxAttempts, 1, 10, 5),
    loginEnabled: b.loginEnabled !== false,
    registrationEnabled: b.registrationEnabled === true,
    updatedAt: "",
    updatedBy: "",
    source: "settings",
  };
}

function validate(s: SmsSettings): string | null {
  if (!/^\+\d{1,4}$/.test(s.countryCode)) return "The country code must look like +91 or +966.";
  // Switches, country and timing can be saved before any provider keys exist.
  if (!s.apiKey) return null;
  if (/\s/.test(s.apiKey)) return "The API key must not contain spaces.";
  if (s.apiSecret && /\s/.test(s.apiSecret)) return "The API secret must not contain spaces.";
  if (s.provider === "generic") {
    if (!/^https?:\/\/[^\s]+/i.test(s.apiUrl)) return "The API URL must start with https:// (or http://).";
  }
  if (s.provider === "msg91" && !s.templateId) return "MSG91 needs the OTP template ID.";
  if (s.provider === "twilio") {
    if (!s.apiSecret) return "Twilio needs the auth token (API secret).";
    if (!s.senderId) return "Twilio needs the sender number (From).";
  }
  if (s.provider === "twilio-verify") {
    if (!s.apiSecret) return "Twilio needs the auth token (API secret).";
    if (!s.templateId) return "Twilio Verify needs the Verify Service SID (template ID).";
  }
  if ((s.provider === "twilio" || s.provider === "twilio-verify") && s.apiUrl && !/^https?:\/\/[^\s]+/i.test(s.apiUrl)) {
    return "The API URL must start with https:// (or http://).";
  }
  return null;
}

export async function GET() {
  const auth = await requireSettingsAdmin();
  if (auth.error) return auth.error;
  return ok(await view());
}

/** Save (or with { clear: true } remove) the SMS settings. */
export async function PATCH(req: Request) {
  const auth = await requireSettingsAdmin();
  if (auth.error) return auth.error;
  const body = await readJson<Body>(req);

  if (body.clear === true) {
    await withDB((db) => { if (db.config) delete db.config.smsOtp; });
    await addAdminLog(auth.user.fullName, "Removed the mobile OTP settings (back to server defaults)");
    return ok(await view());
  }

  const s = await settingsFromBody(body);
  const err = validate(s);
  if (err) return fail(err);

  await withDB((db) => {
    if (!db.config) db.config = defaultConfig();
    db.config.smsOtp = {
      provider: s.provider,
      apiKey: s.apiKey,
      apiSecret: s.apiSecret,
      senderId: s.senderId,
      templateId: s.templateId,
      apiUrl: s.apiUrl,
      countryCode: s.countryCode,
      otpLength: s.otpLength,
      expiryMinutes: s.expiryMinutes,
      resendSeconds: s.resendSeconds,
      maxAttempts: s.maxAttempts,
      loginEnabled: s.loginEnabled,
      registrationEnabled: s.registrationEnabled,
      updatedAt: new Date().toISOString(),
      updatedBy: auth.user.fullName,
    };
  });
  await addAdminLog(auth.user.fullName, `Updated mobile OTP settings (${s.provider}, login ${s.loginEnabled ? "on" : "off"}, registration ${s.registrationEnabled ? "on" : "off"})`);
  return ok(await view());
}

/** Test credentials without saving. Sends a text only when a number is included. */
export async function POST(req: Request) {
  const auth = await requireSettingsAdmin();
  if (auth.error) return auth.error;
  const body = await readJson<Body>(req);
  const hasForm = typeof body.provider === "string" || typeof body.apiKey === "string";
  const drafted = hasForm ? await settingsFromBody(body) : await smsSettings();
  const s = hasForm && drafted.apiKey ? drafted : await smsSettings();
  if (hasForm && drafted.apiKey) {
    const err = validate(s);
    if (err) return ok({ ok: false, error: err });
  } else if (s.source === "none") {
    return ok({ ok: false, error: "No SMS provider is configured yet. Fill in the keys, or save them first." });
  }
  const testPhone = str(body.testPhone, 24);
  return ok(await testSmsConnection(s, testPhone));
}
