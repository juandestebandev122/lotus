import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listPendingUsers, approvePendingUser, rejectPendingUser } from "@/server/repo";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  return ok({ requests: await listPendingUsers() });
}

// Approve (activate) or reject a pending account.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const body = await readJson<{ id?: string; action?: string; note?: string }>(req);
  if (!body.id) return fail("Account id is required");

  if (body.action === "reject") {
    const res = await rejectPendingUser(String(body.id), user.fullName, typeof body.note === "string" ? body.note.slice(0, 200) : "");
    if (!res.ok) return fail(res.error ?? "Could not reject", 400);
    return ok({ ok: true });
  }

  const res = await approvePendingUser(String(body.id), user.fullName);
  if (!res.ok) return fail(res.error ?? "Could not approve", 400);
  return ok({ ok: true });
}
