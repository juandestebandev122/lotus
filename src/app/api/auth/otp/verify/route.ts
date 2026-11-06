import { ok, fail, readJson } from "@/server/http";
import { findByPhone, loginBlockReason, touchLastSeen, recordLogin, recordLoginFailure, recordDeviceActivity, deviceLoginDecision, alertNewDeviceLogin } from "@/server/repo";
import { setSession, publicUser, parseDevice, enrichDevice, createToken } from "@/server/auth";
import { geoLookup, geoLabel, clientIp } from "@/server/geo";
import { smsSettings, verifyMobileCode } from "@/server/sms";

export const runtime = "nodejs";

type LoginDevice = { deviceId?: string; screen?: string; lang?: string; tz?: string; netType?: string; ua?: string; appVersion?: string; model?: string; platform?: string; platformVersion?: string };

export async function POST(req: Request) {
  const { identifier, code, device: dev } = await readJson<{ identifier?: string; code?: string; device?: LoginDevice }>(req);
  if (!identifier || typeof identifier !== "string") return fail("Missing identifier");
  if (!code || typeof code !== "string") return fail("Enter the code from the text message");

  const settings = await smsSettings();
  if (!settings.loginEnabled) return fail("Mobile OTP login is turned off.", 403);

  const valid = await verifyMobileCode(identifier, code);
  if (!valid.ok) return fail(valid.error, 401);

  // Mobile login signs in an EXISTING account only — accounts are created solely
  // by admin approval. No self-service account creation here.
  const user = await findByPhone(identifier);
  if (!user) return fail("No account found for this mobile number. Please request an account, then sign in after approval.", 404);

  const blocked = loginBlockReason(user);
  if (blocked) return fail(blocked, 403);
  const ip = clientIp(req);
  const deviceId = typeof dev?.deviceId === "string" ? dev.deviceId.slice(0, 80) : "";
  const ua = (typeof dev?.ua === "string" ? dev.ua : req.headers.get("user-agent")) || "";
  const parsed = enrichDevice(ua, typeof dev?.model === "string" ? dev.model : undefined);
  const device = parsed.device || parseDevice(req.headers.get("user-agent"));
  const decision = await deviceLoginDecision(user.id, deviceId);
  if (!decision.allowed) {
    await recordLoginFailure(user.id, { ip, device, method: "blocked", deviceId });
    return fail(decision.reason ?? "This device cannot be used to log in.", 403);
  }
  const geo = await geoLookup(ip);
  const location = geoLabel(geo);
  await recordDeviceActivity(user.id, deviceId, {
    device, os: parsed.os, osVersion: parsed.osVersion, browser: parsed.browser, browserVersion: parsed.browserVersion, model: parsed.model,
    screen: typeof dev?.screen === "string" ? dev.screen : undefined, lang: typeof dev?.lang === "string" ? dev.lang : undefined,
    tz: typeof dev?.tz === "string" ? dev.tz : undefined, netType: typeof dev?.netType === "string" ? dev.netType : undefined,
    appVersion: typeof dev?.appVersion === "string" ? dev.appVersion : undefined,
  }, ip, location);
  await setSession(user.id);
  await touchLastSeen(user.id, ip);
  await recordLogin(user.id, { ip, device, method: "otp", deviceId, location, isp: geo?.isp, success: true });
  if (decision.newDevice) await alertNewDeviceLogin(user.id, ip, location);
  return ok({ user: publicUser(user), token: createToken(user.id) });
}
