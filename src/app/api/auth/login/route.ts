import { ok, fail, readJson } from "@/server/http";
import { findByEmail, findByUsername, loginBlockReason, touchLastSeen, recordLogin, recordLoginFailure, registerFailedLogin, clearFailedLogins, lockMinutesLeft, loginLockEnabled, recordDeviceActivity, deviceLoginDecision, alertNewDeviceLogin, alertFailedLoginsIfNeeded } from "@/server/repo";
import { setSession, publicUser, verifyPassword, parseDevice, enrichDevice, createToken } from "@/server/auth";
import { geoLookup, geoLabel, clientIp } from "@/server/geo";

export const runtime = "nodejs";

// Client device blob (from src/lib/device.ts collectDeviceInfo) sent with the login.
type LoginDevice = { deviceId?: string; screen?: string; lang?: string; tz?: string; netType?: string; ua?: string; appVersion?: string; model?: string; platform?: string; platformVersion?: string };

// Password login by USERNAME or email. Accounts are created ONLY by an admin
// approving a registration request — there is NO sign-in-or-up here.
//   - User panel sends { identifier: <username>, password }
//   - Admin panel sends { email, password } (still supported)
export async function POST(req: Request) {
  const body = await readJson<{ identifier?: string; email?: string; password?: string; device?: LoginDevice }>(req);
  const identifier = (body.identifier ?? body.email ?? "").trim();
  const password = body.password;
  if (!identifier) return fail("Enter your username or email");
  if (!password || typeof password !== "string") return fail("Password is required");

  const ip = clientIp(req);
  const deviceId = typeof body.device?.deviceId === "string" ? body.device.deviceId.slice(0, 80) : "";
  // Prefer the client-reported UA (richer), else the request header.
  const ua = (typeof body.device?.ua === "string" ? body.device.ua : req.headers.get("user-agent")) || "";
  // Upgrade the label with the real device model when the client sent one (Client Hints).
  const parsed = enrichDevice(ua, typeof body.device?.model === "string" ? body.device.model : undefined);
  const device = parsed.device || parseDevice(req.headers.get("user-agent"));

  // Resolve by email when it looks like one, otherwise by username.
  const existing = identifier.includes("@")
    ? await findByEmail(identifier)
    : (await findByUsername(identifier)) ?? (await findByEmail(identifier));

  if (!existing) return fail("No account found. Please check your username/password, or request an account.", 401);

  // Temporary lock after too many failed attempts (admin can disable it entirely).
  const lockEnforced = await loginLockEnabled();
  const lockMins = lockEnforced ? lockMinutesLeft(existing) : 0;
  if (lockMins > 0) return fail(`Too many failed attempts. Try again in ${lockMins} minute${lockMins === 1 ? "" : "s"}.`, 429);

  if (!verifyPassword(password, existing.passwordHash)) {
    await recordLoginFailure(existing.id, { ip, device, method: "failed", deviceId });
    const res = await registerFailedLogin(existing.id);
    await alertFailedLoginsIfNeeded(existing.id, ip);
    if (res.locked) return fail(`Too many failed attempts. Your account is locked for ${res.lockMinutes} minute${res.lockMinutes === 1 ? "" : "s"}.`, 429);
    if (!lockEnforced) return fail("Incorrect username or password.", 401);
    return fail(`Incorrect username or password. ${res.remaining} attempt${res.remaining === 1 ? "" : "s"} left before a temporary lock.`, 401);
  }
  const blocked = loginBlockReason(existing);
  if (blocked) return fail(blocked, 403);
  // DEVICE RESTRICTIONS (Admin → Device & Security): blacklist, whitelist-only,
  // max-accounts-per-device, one-account-per-device, max-devices-per-account.
  const decision = await deviceLoginDecision(existing.id, deviceId);
  if (!decision.allowed) {
    await recordLoginFailure(existing.id, { ip, device, method: "blocked", deviceId });
    return fail(decision.reason ?? "This device cannot be used to log in.", 403);
  }
  // Best-effort geolocation (cached per IP) for the login history + device registry.
  const geo = await geoLookup(ip);
  const location = geoLabel(geo);
  await recordDeviceActivity(existing.id, deviceId, {
    device, os: parsed.os, osVersion: parsed.osVersion, browser: parsed.browser, browserVersion: parsed.browserVersion,
    model: parsed.model,
    screen: typeof body.device?.screen === "string" ? body.device.screen : undefined,
    lang: typeof body.device?.lang === "string" ? body.device.lang : undefined,
    tz: typeof body.device?.tz === "string" ? body.device.tz : undefined,
    netType: typeof body.device?.netType === "string" ? body.device.netType : undefined,
    appVersion: typeof body.device?.appVersion === "string" ? body.device.appVersion : undefined,
  }, ip, location);
  await clearFailedLogins(existing.id);
  await setSession(existing.id);
  await touchLastSeen(existing.id, ip);
  await recordLogin(existing.id, { ip, device, method: "password", deviceId, location, isp: geo?.isp, success: true });
  if (decision.newDevice) await alertNewDeviceLogin(existing.id, ip, location);
  return ok({ user: publicUser(existing), mustChangePassword: !!existing.mustChangePassword, token: createToken(existing.id) });
}
