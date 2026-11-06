import { ok, fail, readJson } from "@/server/http";
import { findByEmail, findById, loginBlockReason, touchLastSeen, recordLogin, recordLoginFailure, recordDeviceActivity, deviceLoginDecision, alertNewDeviceLogin, createGoogleAccountRequest, getConfig } from "@/server/repo";
import { setSession, publicUser, parseDevice, enrichDevice, createToken, type ParsedDevice } from "@/server/auth";
import { geoLookup, geoLabel, clientIp } from "@/server/geo";

export const runtime = "nodejs";

type LoginDevice = { deviceId?: string; screen?: string; lang?: string; tz?: string; netType?: string; ua?: string; appVersion?: string; model?: string; platform?: string; platformVersion?: string };
// Shared: geolocate + record the device for a Google sign-in.
async function trackGoogleDevice(userId: string, dev: LoginDevice | undefined, parsed: ParsedDevice, device: string, ip: string) {
  const deviceId = typeof dev?.deviceId === "string" ? dev.deviceId.slice(0, 80) : "";
  const geo = await geoLookup(ip);
  const location = geoLabel(geo);
  await recordDeviceActivity(userId, deviceId, {
    device, os: parsed.os, osVersion: parsed.osVersion, browser: parsed.browser, browserVersion: parsed.browserVersion, model: parsed.model,
    screen: typeof dev?.screen === "string" ? dev.screen : undefined, lang: typeof dev?.lang === "string" ? dev.lang : undefined,
    tz: typeof dev?.tz === "string" ? dev.tz : undefined, netType: typeof dev?.netType === "string" ? dev.netType : undefined,
    appVersion: typeof dev?.appVersion === "string" ? dev.appVersion : undefined,
  }, ip, location);
  return { deviceId, location, isp: geo?.isp };
}

// The Google OAuth Client ID (public). The LIVE source is Admin → Settings
// (config.googleClientId); the env vars remain as a legacy fallback.
const ENV_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

interface GooglePayload {
  aud?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
  sub?: string;
}

export async function POST(req: Request) {
  const { credential, device: dev } = await readJson<{ credential?: string; device?: LoginDevice }>(req);
  if (!credential || typeof credential !== "string") return fail("Missing Google credential");
  const ua = (typeof dev?.ua === "string" ? dev.ua : req.headers.get("user-agent")) || "";
  const parsed = enrichDevice(ua, typeof dev?.model === "string" ? dev.model : undefined);
  const deviceLabel = parsed.device || parseDevice(req.headers.get("user-agent"));
  const deviceId = typeof dev?.deviceId === "string" ? dev.deviceId.slice(0, 80) : "";

  // Verify the ID token directly with Google (no client secret needed).
  let payload: GooglePayload;
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!res.ok) return fail("Could not verify your Google account. Please try again.", 401);
    payload = (await res.json()) as GooglePayload;
  } catch {
    return fail("Could not reach Google to verify the sign-in.", 502);
  }

  // The token must have been issued for THIS app.
  const clientId = ((await getConfig()).googleClientId || "").trim() || ENV_CLIENT_ID;
  if (clientId && payload.aud !== clientId) {
    return fail("Google sign-in is not configured for this site.", 401);
  }

  const email = (payload.email || "").toLowerCase().trim();
  if (!email) return fail("This Google account has no email address.", 400);
  const verified = payload.email_verified === true || payload.email_verified === "true";
  if (!verified) return fail("Your Google email address is not verified.", 401);

  // Google sign-in logs into an EXISTING account (matched by the Google email).
  // If there's no account yet, submit an admin-approved sign-up request from the
  // Google profile (email is already verified) so the user isn't left at a dead
  // end — they're told it's pending and can sign in with Google once approved.
  const user = await findByEmail(email);
  if (!user) {
    const created = await createGoogleAccountRequest(email, payload.name || "");
    // Admin toggle OFF → the new account is auto-approved → sign them in now.
    if (created.active && created.userId) {
      const nu = await findById(created.userId);
      if (nu) {
        const ip0 = clientIp(req);
        const decision0 = await deviceLoginDecision(nu.id, deviceId);
        if (!decision0.allowed) { await recordLoginFailure(nu.id, { ip: ip0, device: deviceLabel, method: "blocked", deviceId }); return fail(decision0.reason ?? "This device cannot be used to log in.", 403); }
        const t = await trackGoogleDevice(nu.id, dev, parsed, deviceLabel, ip0);
        await setSession(nu.id);
        await touchLastSeen(nu.id, ip0);
        await recordLogin(nu.id, { ip: ip0, device: deviceLabel, method: "google", deviceId: t.deviceId, location: t.location, isp: t.isp, success: true });
        if (decision0.newDevice) await alertNewDeviceLogin(nu.id, ip0, t.location);
        return ok({ user: publicUser(nu), token: createToken(nu.id) });
      }
    }
    return ok({ pending: true, message: `Welcome! Your account request for ${email} has been sent to the admin for approval. You'll be able to sign in with Google as soon as it's approved.` });
  }

  const blocked = loginBlockReason(user);
  if (blocked) {
    // A still-pending account (incl. a previous Google sign-up) → friendly notice.
    if (user.accountStatus === "pending") return ok({ pending: true, message: "Your account is awaiting admin approval. You'll be able to sign in once it's approved." });
    return fail(blocked, 403);
  }
  const ip = clientIp(req);
  const decision = await deviceLoginDecision(user.id, deviceId);
  if (!decision.allowed) {
    await recordLoginFailure(user.id, { ip, device: deviceLabel, method: "blocked", deviceId });
    return fail(decision.reason ?? "This device cannot be used to log in.", 403);
  }
  const t = await trackGoogleDevice(user.id, dev, parsed, deviceLabel, ip);
  await setSession(user.id);
  await touchLastSeen(user.id, ip);
  await recordLogin(user.id, { ip, device: deviceLabel, method: "google", deviceId: t.deviceId, location: t.location, isp: t.isp, success: true });
  if (decision.newDevice) await alertNewDeviceLogin(user.id, ip, t.location);
  return ok({ user: publicUser(user), token: createToken(user.id) });
}
