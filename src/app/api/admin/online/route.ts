import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listOnlineUsers, onlineUserAction, addAdminLog, sendMessage, notifyUser, findById } from "@/server/repo";

export const runtime = "nodejs";

// Live list of users active within the presence window, with the full detail the
// admin Online Now page shows.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  return ok({ users: await listOnlineUsers() });
}

// Admin acts on an online user: suspend | ban | unban | logout | message.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const b = await readJson<{ userId?: string; action?: string; text?: string }>(req);
  const userId = typeof b.userId === "string" ? b.userId : "";
  const action = b.action as "suspend" | "ban" | "unban" | "logout" | "message";
  if (!userId || !["suspend", "ban", "unban", "logout", "message"].includes(action)) return fail("Invalid request");
  // "Message" now starts a REAL two-way conversation (not a one-way notification): a
  // DirectMessage the user can reply to, plus a bell alert. The reply lands in the
  // admin's own Messages inbox (Admin → Messages).
  if (action === "message") {
    const t = (typeof b.text === "string" ? b.text : "").trim();
    if (!t) return fail("Message is empty");
    if (userId === user.id) return fail("You can't message yourself");
    const other = await findById(userId);
    if (!other) return fail("User not found", 404);
    await sendMessage(user.id, userId, t.slice(0, 2000));
    await notifyUser(userId, `💬 ${user.fullName} sent you a message`, { label: "Open chat", href: `/messages?to=${user.id}` }, "message");
    await addAdminLog(user.fullName, `Messaged user ${userId}`);
    return ok({ ok: true });
  }
  const res = await onlineUserAction(userId, action, typeof b.text === "string" ? b.text : undefined);
  if (!res.ok) return fail(res.error ?? "Action failed", 400);
  await addAdminLog(user.fullName, `Online Now: ${action} on user ${userId}`);
  return ok({ ok: true });
}
