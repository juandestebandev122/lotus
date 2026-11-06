import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listPendingAvatars, decidePendingAvatar } from "@/server/repo";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  return ok({ pending: await listPendingAvatars() });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const body = await readJson<{ userId?: string; approve?: boolean }>(req);
  if (!body.userId) return fail("userId required");
  const res = await decidePendingAvatar(String(body.userId), body.approve === true, user.fullName);
  if (!res.ok) return fail(res.error ?? "Could not update", 400);
  return ok({ ok: true });
}
