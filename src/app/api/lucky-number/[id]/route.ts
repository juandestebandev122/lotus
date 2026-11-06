import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { updateLuckyDraw, deleteLuckyDraw, addAdminLog } from "@/server/repo";
import type { LuckyDrawRecord } from "@/server/db";

export const runtime = "nodejs";

// Edit a game / change its status (admin only). updateLuckyDraw whitelists every field,
// so unknown or protected fields (entries, winningNumber, …) can't be set from the body.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const body = await readJson(req);
  const r = await updateLuckyDraw(id, body as Partial<LuckyDrawRecord> & { cancelledReason?: string });
  if (!r.ok) return fail(r.error ?? "Could not update the game", 400);
  await addAdminLog(user.fullName, `Updated Lucky Number game ${id}`);
  return ok({ ok: true });
}

// Delete a game (admin only) — refunds any held entry fees first.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  await deleteLuckyDraw(id);
  await addAdminLog(user.fullName, `Deleted Lucky Number game ${id}`);
  return ok({ deleted: true });
}
