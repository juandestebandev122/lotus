import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import {
  listDevicesAdmin, securityAlertsAdmin, deviceAnalytics, pruneDeviceData,
  adminSetDeviceBlocked, adminForceLogoutDevice, adminBanDeviceAccounts, adminSetDeviceWhitelisted, dismissSecurityAlert,
} from "@/server/repo";

export const runtime = "nodejs";

// Device & Security — list every known device (with the accounts that share it),
// the analytics dashboard, and the web-detectable security alerts.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  await pruneDeviceData(); // honour the admin's data-retention window
  const [devices, alerts, analytics] = await Promise.all([listDevicesAdmin(), securityAlertsAdmin(), deviceAnalytics()]);
  return ok({ devices, alerts, analytics });
}

// Device actions: block / unblock / force-logout-all / ban (all or one account).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const body = await readJson<{ action?: string; deviceId?: string; reason?: string; userId?: string; alertId?: string }>(req);
  const deviceId = (body.deviceId || "").trim();
  const reason = typeof body.reason === "string" ? body.reason : "";
  if (body.action !== "dismissAlert" && !deviceId) return fail("deviceId is required");

  switch (body.action) {
    case "block": {
      const r = await adminSetDeviceBlocked(deviceId, true, reason, user.fullName);
      return r.ok ? ok({ ok: true, blocked: true }) : fail(r.error ?? "Could not block", 400);
    }
    case "unblock": {
      const r = await adminSetDeviceBlocked(deviceId, false, "", user.fullName);
      return r.ok ? ok({ ok: true, blocked: false }) : fail(r.error ?? "Could not unblock", 400);
    }
    case "forceLogout": {
      const r = await adminForceLogoutDevice(deviceId, user.fullName);
      return r.ok ? ok({ ok: true, count: r.count }) : fail(r.error ?? "Could not force-logout", 400);
    }
    case "banAll": {
      const r = await adminBanDeviceAccounts(deviceId, undefined, reason, user.fullName);
      return r.ok ? ok({ ok: true, count: r.count }) : fail(r.error ?? "Could not ban", 400);
    }
    case "banOne": {
      if (!body.userId) return fail("userId is required to ban one account");
      const r = await adminBanDeviceAccounts(deviceId, String(body.userId), reason, user.fullName);
      return r.ok ? ok({ ok: true, count: r.count }) : fail(r.error ?? "Could not ban", 400);
    }
    case "whitelist": {
      const r = await adminSetDeviceWhitelisted(deviceId, true, user.fullName);
      return r.ok ? ok({ ok: true, whitelisted: true }) : fail(r.error ?? "Could not whitelist", 400);
    }
    case "unwhitelist": {
      const r = await adminSetDeviceWhitelisted(deviceId, false, user.fullName);
      return r.ok ? ok({ ok: true, whitelisted: false }) : fail(r.error ?? "Could not update", 400);
    }
    case "dismissAlert": {
      const id = (body.alertId || "").trim();
      if (!id) return fail("alertId is required");
      const r = await dismissSecurityAlert(id, user.fullName);
      return r.ok ? ok({ ok: true }) : fail(r.error ?? "Could not dismiss alert", 400);
    }
    default:
      return fail("Unknown action");
  }
}
