import { ok, fail } from "@/server/http";
import { getCurrentUser, enrichDevice } from "@/server/auth";
import { touchLastSeen, recordActivityMinute, recordDeviceActivity } from "@/server/repo";
import { clientIp } from "@/server/geo";

export const runtime = "nodejs";

type HbDevice = { deviceId?: unknown; screen?: unknown; lang?: unknown; tz?: unknown; netType?: unknown; ua?: unknown; appVersion?: unknown; model?: unknown; platform?: unknown; platformVersion?: unknown };
const str = (v: unknown, n = 120) => (typeof v === "string" ? v.slice(0, n) : undefined);

// The app pings this every ~60s while open (foreground) so "online" reflects
// real activity. We also tally one minute of app/voice activity for the admin
// Data Usage report.
//
// The body may carry { active: boolean } — whether the user GENUINELY interacted
// during that minute (tap / scroll / message / game move / …). Idle minutes still
// count for presence and data usage, but earn no Startup-Bonus time when the
// admin has inactivity reward protection on. Older clients that send no body
// default to `true`, so nothing breaks mid-deploy.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Not authenticated", 401);
  let active = true;
  let device: HbDevice | undefined;
  try {
    const body = (await req.json()) as { active?: unknown; device?: HbDevice };
    if (typeof body?.active === "boolean") active = body.active;
    if (body?.device && typeof body.device === "object") device = body.device;
  } catch { /* no body — treat as active (old clients) */ }
  const ip = clientIp(req);
  await touchLastSeen(user.id, ip || undefined);
  await recordActivityMinute(user.id, active);
  // Keep the device registry fresh (Device & Security). Best-effort; geolocation is
  // resolved at login, so the heartbeat stays a cheap upsert with no external calls.
  const deviceId = str(device?.deviceId, 80);
  if (deviceId) {
    const ua = str(device?.ua, 400);
    const parsed = ua ? enrichDevice(ua, str(device?.model, 60)) : undefined;
    await recordDeviceActivity(user.id, deviceId, {
      device: parsed?.device, os: parsed?.os, osVersion: parsed?.osVersion, browser: parsed?.browser,
      browserVersion: parsed?.browserVersion, model: parsed?.model,
      screen: str(device?.screen, 40), lang: str(device?.lang, 20), tz: str(device?.tz, 60),
      netType: str(device?.netType, 20), appVersion: str(device?.appVersion, 20),
    }, ip || undefined);
  }
  return ok({ ok: true });
}
