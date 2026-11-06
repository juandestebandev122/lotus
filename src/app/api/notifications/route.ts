import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listNotifications, markNotificationsRead, dismissNotification, clearNotifications } from "@/server/repo";

export const runtime = "nodejs";

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return fail("Not authenticated", 401);
  const notifications = await listNotifications(me.id);
  return ok({ notifications });
}

// Body: { id?: string, dismiss?: boolean }
//   dismiss=true → remove the notification; otherwise mark one (or all) read.
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return fail("Not authenticated", 401);
  const { id, dismiss, clearAll } = await readJson<{ id?: string; dismiss?: boolean; clearAll?: boolean }>(req);
  if (clearAll) {
    await clearNotifications(me.id);
  } else if (dismiss && typeof id === "string") {
    await dismissNotification(me.id, id);
  } else {
    await markNotificationsRead(me.id, typeof id === "string" ? id : undefined);
  }
  return ok({ ok: true });
}
