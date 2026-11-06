import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listSnapshots, restoreSnapshot, takeSnapshotNow } from "@/server/db";
import { addAdminLog } from "@/server/repo";

export const runtime = "nodejs";

// BACKUP & RESTORE. The app keeps its own restore points (one every 12 hours,
// last 14 kept) so recovering never depends on someone having deployed recently.
// Every action here is written to the admin log.

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  return ok({ snapshots: await listSnapshots() });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const b = await readJson<{ action?: string; name?: string; confirm?: string; label?: string }>(req);

  if (b.action === "snapshot") {
    const r = await takeSnapshotNow(String(b.label ?? "manual"));
    if (!r.ok) return fail(r.error ?? "Could not save a restore point", 400);
    await addAdminLog(user.fullName, `Saved a restore point (${r.name})`);
    return ok(r);
  }

  if (b.action === "restore") {
    if (!b.name) return fail("Choose a restore point first.");
    // Typing the words is deliberate friction: this replaces every account,
    // group and transaction, and a mis-click must not be able to do it.
    if ((b.confirm ?? "").trim().toUpperCase() !== "RESTORE") {
      return fail('Type RESTORE to confirm — this replaces all current data.', 400);
    }
    const r = await restoreSnapshot(String(b.name));
    if (!r.ok) return fail(r.error ?? "Could not restore", 400);
    await addAdminLog(
      user.fullName,
      `RESTORED the database from ${b.name} — now ${r.users} accounts, ${r.rooms} groups. ` +
      `The previous data was saved as ${r.undo || "(safety copy failed)"} and can be restored back.`,
    );
    return ok(r);
  }

  return fail("Unknown action");
}
