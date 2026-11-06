import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { getDB, effectiveFrame, effectiveEquipped } from "./db";
import type { UserRecord } from "./db";
import { onlineStatus } from "./presence";
import { avatarUrl, coverUrl } from "./avatar";

// ============================================================
// Auth core — password hashing, signed session tokens (JWT-like),
// and cookie helpers. Pure Node crypto, no native dependencies.
// ============================================================

const SECRET =
  process.env.AUTH_SECRET || "lotus-connect-dev-secret-change-in-production";
const COOKIE = "lotus_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// ---------- Passwords (scrypt) ----------
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored?: string): boolean {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return (
    candidate.length === expected.length &&
    crypto.timingSafeEqual(candidate, expected)
  );
}

// ---------- Signed tokens (compact JWT, HS256) ----------
function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function sign(data: string): string {
  return b64url(crypto.createHmac("sha256", SECRET).update(data).digest());
}

export function createToken(userId: string): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ sub: userId, iat: Math.floor(Date.now() / 1000) }),
  );
  const body = `${header}.${payload}`;
  return `${body}.${sign(body)}`;
}

/** Verify a token's signature and return its payload ({sub, iat}) or null. */
export function verifyTokenFull(token: string | undefined): { sub: string; iat: number } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const expected = sign(`${header}.${payload}`);
  // constant-time compare
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    if (typeof data.sub !== "string") return null;
    return { sub: data.sub, iat: typeof data.iat === "number" ? data.iat : 0 };
  } catch {
    return null;
  }
}

export function verifyToken(token: string | undefined): string | null {
  return verifyTokenFull(token)?.sub ?? null;
}

export interface ParsedDevice {
  device: string; // full label e.g. "Chrome 120 on Android 13 (SM-G991B)"
  os: string; osVersion?: string;
  browser: string; browserVersion?: string;
  model?: string; // best-effort device model from an Android UA (browsers rarely expose it)
}

/** Structured device details from a User-Agent. A browser only exposes OS + browser
 *  (+ sometimes an Android model token) — never brand/model reliably, and never a real
 *  hardware id — so this is best-effort. */
export function parseDeviceInfo(ua?: string | null): ParsedDevice {
  if (!ua) return { device: "Unknown device", os: "device", browser: "Browser" };
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /iPhone|iPad|iOS/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "device";
  const first = (m: RegExpMatchArray | null) => (m ? m[1] : undefined);
  const browserVersion = ((): string | undefined => {
    const raw = first(
      browser === "Edge" ? ua.match(/Edg\/([\d.]+)/) :
      browser === "Opera" ? ua.match(/OPR\/([\d.]+)/) :
      browser === "Chrome" ? ua.match(/Chrome\/([\d.]+)/) :
      browser === "Firefox" ? ua.match(/Firefox\/([\d.]+)/) :
      browser === "Safari" ? ua.match(/Version\/([\d.]+)/) : null
    );
    return raw ? raw.split(".")[0] : undefined;
  })();
  const WIN: Record<string, string> = { "10.0": "10/11", "6.3": "8.1", "6.2": "8", "6.1": "7" };
  const osVersion = ((): string | undefined => {
    if (os === "Android") return first(ua.match(/Android ([\d.]+)/));
    if (os === "iOS") { const v = first(ua.match(/OS ([\d_]+)/)); return v ? v.replace(/_/g, ".") : undefined; }
    if (os === "Windows") { const v = first(ua.match(/Windows NT ([\d.]+)/)); return v ? (WIN[v] ?? v) : undefined; }
    if (os === "macOS") { const v = first(ua.match(/Mac OS X ([\d_]+)/)); return v ? v.replace(/_/g, ".") : undefined; }
    return undefined;
  })();
  let model: string | undefined;
  if (os === "Android") {
    const m = ua.match(/Android [\d.]+; ?([^;)]+?)(?: Build\/|\))/);
    const c = m ? m[1].trim() : "";
    if (c && !/^wv$/i.test(c) && c.length <= 40) model = c;
  }
  const osLabel = osVersion ? `${os} ${osVersion}` : os;
  const browserLabel = browserVersion ? `${browser} ${browserVersion}` : browser;
  const device = `${browserLabel} on ${osLabel}${model ? ` (${model})` : ""}`;
  return { device, os, osVersion, browser, browserVersion, model };
}

/** Best-effort "Chrome on Windows"-style label from a User-Agent string. */
export function parseDevice(ua?: string | null): string {
  return parseDeviceInfo(ua).device;
}

// Best-effort phone BRAND from a device MODEL code. A web app can't read the brand
// directly, so we infer it from the model-code prefix reported by Client Hints
// (getHighEntropyValues 'model'). Reliable for Samsung/Google/Oppo/Realme/Vivo; a
// best guess for the rest; "" when unknown (we then just show the raw model code).
const BRAND_RULES: [RegExp, string][] = [
  [/^(SM-|SC-|SCG|SCV|Galaxy)/i, "Samsung"],
  [/^Pixel/i, "Google"],
  [/^(iQOO|I2\d{3}|I1\d{3})/i, "iQOO"],
  [/^(vivo|V2\d{3}|V1\d{3})/i, "Vivo"],
  [/^(RMX\d|realme)/i, "Realme"],
  [/^(ONEPLUS|NE2\d|IN2\d|LE2\d|KB2\d|BE2\d|HD1\d|GM1\d|AC2\d|DN2\d|EB2\d|CPH25)/i, "OnePlus"],
  [/^(CPH\d|PG[A-Z]|PH[A-Z]|PF[A-Z]|PA[A-Z]|OPPO)/i, "Oppo"],
  [/^(Redmi|POCO|Mi[ -]|M2\d{3}|M1\d{3}|2[12345]\d{4}|Xiaomi)/i, "Xiaomi"],
  [/^(moto|XT\d{3,4}|motorola)/i, "Motorola"],
  [/^(Nokia|TA-\d)/i, "Nokia"],
  [/^Infinix/i, "Infinix"],
  [/^(TECNO|Tecno)/i, "Tecno"],
  [/^Lenovo/i, "Lenovo"],
  [/^(iPhone|iPad|Apple)/i, "Apple"],
];
export function deviceBrand(model?: string): string {
  const m = (model || "").trim();
  if (!m) return "";
  for (const [re, brand] of BRAND_RULES) if (re.test(m)) return brand;
  return "";
}

/** Parse the UA and, when the client also sent a REAL device model (via User-Agent
 *  Client Hints — modern Chrome redacts the model in the UA to the placeholder "K"),
 *  upgrade the label to include the phone brand + model, e.g.
 *  "Samsung SM-S921B · Chrome on Android 10". Non-Chromium clients (iPhone, Firefox)
 *  have no model hint and keep the plain UA label. */
export function enrichDevice(ua?: string | null, clientModel?: string): ParsedDevice {
  const p = parseDeviceInfo(ua);
  const cm = (clientModel || "").trim().slice(0, 60);
  if (cm && !/^k$/i.test(cm) && !/^wv$/i.test(cm)) {
    const brand = deviceBrand(cm);
    const brandModel = brand && !new RegExp(`^${brand}`, "i").test(cm) ? `${brand} ${cm}` : cm;
    p.model = brandModel;
    const osLabel = p.osVersion ? `${p.os} ${p.osVersion}` : p.os;
    const browserLabel = p.browserVersion ? `${p.browser} ${p.browserVersion}` : p.browser;
    p.device = `${brandModel} · ${browserLabel} on ${osLabel}`;
  }
  return p;
}

// ---------- Session cookie ----------
export async function setSession(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, createToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: process.env.NEXT_PUBLIC_BASE_PATH || "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, "", {
    httpOnly: true,
    path: process.env.NEXT_PUBLIC_BASE_PATH || "/",
    maxAge: 0,
  });
}

/** Returns the signed-in user record, or null. */
export async function getCurrentUser(): Promise<UserRecord | null> {
  const jar = await cookies();
  let token = jar.get(COOKIE)?.value;
  // Fallback for clients that drop the cookie (installed PWA, in-app browsers,
  // iOS Safari ITP): accept the SAME signed token via the Authorization header.
  // The client saves it at login and re-sends it, so the session survives even
  // when the browser won't keep the cookie. Cookie still takes precedence.
  if (!token) {
    try {
      const h = await headers();
      const auth = h.get("authorization");
      if (auth && auth.startsWith("Bearer ")) token = auth.slice(7).trim();
    } catch { /* headers() unavailable in some contexts */ }
  }
  const payload = verifyTokenFull(token);
  if (!payload) return null;
  const db = await getDB();
  const user = db.users.find((u) => u.id === payload.sub) ?? null;
  if (!user) return null;
  // Session invalidation: reject tokens issued before the user's cut-off
  // (set when they "log out of all other devices" or change their password).
  if (user.sessionsValidFrom && payload.iat < user.sessionsValidFrom) return null;
  // Admin-disabled accounts end the active session immediately: a banned /
  // blocked / suspended / deactivated user is logged out on their next request
  // (one of the ONLY three automatic-logout conditions the client allows).
  const st = user.accountStatus;
  if (st === "banned" || st === "blocked" || st === "suspended" || st === "inactive" || st === "rejected") return null;
  return user;
}

/** When the current session is INVALID, WHY? Lets /api/auth/alive tell the client
 *  whether they were signed out because the account logged in on ANOTHER device
 *  (single-session), by an admin, or after a password change — so the login
 *  screen shows the right message. Returns null when the session is still valid
 *  or there's no recognisable token. */
export async function sessionEndReason(): Promise<"device" | "admin" | "password" | "disabled" | null> {
  const jar = await cookies();
  let token = jar.get(COOKIE)?.value;
  if (!token) {
    try {
      const h = await headers();
      const auth = h.get("authorization");
      if (auth && auth.startsWith("Bearer ")) token = auth.slice(7).trim();
    } catch { /* ignore */ }
  }
  const payload = verifyTokenFull(token);
  if (!payload) return null;
  const db = await getDB();
  const user = db.users.find((u) => u.id === payload.sub);
  if (!user) return null;
  const st = user.accountStatus;
  if (st === "banned" || st === "blocked" || st === "suspended" || st === "inactive" || st === "rejected") return "disabled";
  if (user.sessionsValidFrom && payload.iat < user.sessionsValidFrom) return user.lastLogoutReason ?? "device";
  return null;
}

/** Strip server-only / sensitive fields before sending a user to the client. */
export function publicUser(u: UserRecord) {
  const { passwordHash, email, phone, loginHistory, lastIp, sessionsValidFrom, failedLogins, lockedUntil, blockedUserIds, hiddenChats, lastLogoutReason, ...rest } = u;
  void passwordHash;
  void email;
  void phone;
  void loginHistory;
  void lastIp;
  void sessionsValidFrom;
  void failedLogins;
  void lockedUntil;
  // Never leak the block list, hidden-chat list, or logout reason to other users.
  void blockedUserIds;
  void hiddenChats;
  void lastLogoutReason;
  // Show real presence (active recently), not just "has a session".
  // Avatar/cover are returned as CACHEABLE URLs (not the ~60KB base64) so the
  // browser downloads each image once instead of on every poll — this is the
  // main fix for the app's mobile-data usage.
  // equippedFrame/equipped resolve through the expiry-aware helpers so an
  // EXPIRED item silently disappears everywhere the moment it lapses.
  return { ...rest, avatar: avatarUrl(u), cover: coverUrl(u), status: onlineStatus(u.lastSeen), equippedFrame: effectiveFrame(u), equipped: effectiveEquipped(u) };
}
