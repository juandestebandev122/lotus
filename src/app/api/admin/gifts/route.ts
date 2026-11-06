import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listGiftLog, deleteGiftLogEntry, clearGiftLog, addAdminLog } from "@/server/repo";

export const runtime = "nodejs";

// Gift activity for the admin panel: sender/receiver details, where each gift
// was sent (game/room), totals, and top senders/receivers.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const data = await listGiftLog();
  return ok(data);
}

// Admin removes gift-log entries: { id } deletes one; { all: true } clears the log.
// This only removes the LOG record (audit view) — it does NOT reverse any coins.
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const b = await readJson<{ id?: string; all?: boolean }>(req);
  if (b.all === true) {
    const n = await clearGiftLog();
    await addAdminLog(user.fullName, `Cleared the gift log (${n} entries)`);
    return ok({ ok: true, cleared: n });
  }
  if (!b.id) return fail("Gift log id is required");
  const done = await deleteGiftLogEntry(String(b.id));
  if (!done) return fail("Gift log entry not found", 404);
  await addAdminLog(user.fullName, `Deleted gift log entry ${b.id}`);
  return ok({ ok: true });
}
