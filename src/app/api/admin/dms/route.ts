import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listAllDirectMessages, adminDeleteDm, addAdminLog } from "@/server/repo";

export const runtime = "nodejs";

// Admin: personal (DM) message history for review.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const messages = await listAllDirectMessages();
  return ok({ messages });
}

// Admin moderation of a personal message: { action: "deleteMessage", id }.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const body = await readJson<{ action?: string; id?: string }>(req);
  if (body.action === "deleteMessage") {
    if (!body.id) return fail("Message id required");
    const done = await adminDeleteDm(body.id);
    if (!done) return fail("Message not found or already removed", 404);
    await addAdminLog(user.fullName, `Removed a personal (DM) message (${body.id})`);
    return ok({ ok: true });
  }
  return fail("Unknown action");
}
