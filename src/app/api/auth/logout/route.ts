import { ok } from "@/server/http";
import { clearSession, getCurrentUser, parseDevice } from "@/server/auth";
import { recordLogin, logInactivityEvent } from "@/server/repo";
import { clientIp } from "@/server/geo";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Record the logout in the user's history (for the admin Activity Logs view)
  // before clearing the session.
  const user = await getCurrentUser();
  // The client sends { reason: "inactive" } when the Inactivity Detection system
  // signs someone out, so the history shows WHY rather than a plain "logout".
  let reason = "";
  let idleMinutes: number | undefined;
  try {
    const body = (await req.json()) as { reason?: unknown; idleMinutes?: unknown };
    if (typeof body?.reason === "string") reason = body.reason;
    if (typeof body?.idleMinutes === "number") idleMinutes = body.idleMinutes;
  } catch { /* no body — a normal manual logout */ }
  const auto = reason === "inactive";
  if (user) {
    const ip = clientIp(req);
    await recordLogin(user.id, {
      ip,
      device: parseDevice(req.headers.get("user-agent")),
      method: auto ? "auto-logout-inactive" : "logout",
    });
    if (auto) await logInactivityEvent(user.id, "auto_logout", { idleMinutes, reason: "Auto Logout - Inactive User." });
  }
  await clearSession();
  return ok({ ok: true });
}
