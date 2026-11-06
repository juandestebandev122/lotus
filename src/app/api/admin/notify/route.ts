import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { broadcastNotification, addAdminLog, adminNotificationLog } from "@/server/repo";

export const runtime = "nodejs";

// Notification LOG — recent notifications the system generated (admin monitoring /
// troubleshooting). ?adminsOnly=1 shows only the alerts sent to administrators.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const url = new URL(req.url);
  const adminsOnly = url.searchParams.get("adminsOnly") === "1";
  const log = await adminNotificationLog({ adminsOnly, limit: 200 });
  return ok({ log });
}

// Broadcast a notification to every user.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const body = await readJson(req);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return fail("Message text is required");

  let cta: { label: string; href?: string } | undefined;
  if (body.cta && typeof body.cta === "object") {
    const label = typeof (body.cta as { label?: unknown }).label === "string" ? (body.cta as { label: string }).label : "";
    const href = typeof (body.cta as { href?: unknown }).href === "string" ? (body.cta as { href: string }).href : undefined;
    if (label) cta = { label, ...(href ? { href } : {}) };
  }

  const count = await broadcastNotification(text.slice(0, 280), cta);
  await addAdminLog(user.fullName, `Broadcast notification to ${count} members`);
  return ok({ sent: count });
}
