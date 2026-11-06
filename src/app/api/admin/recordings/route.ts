import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listRecordings, recordingStats, archiveRecording, deleteRecording, sweepRecordingRetention, getConfig, addAdminLog } from "@/server/repo";
import { canAccess } from "@/lib/admin-perms";

export const runtime = "nodejs";

async function requireRecAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { user: null as null };
  if (!canAccess("moderation", user.adminRole, user.adminPermissions)) return { user: null as null };
  return { user };
}

// Admin: all recordings (room + call) + storage/activity stats + the recording
// config. Runs the retention auto-delete sweep opportunistically.
export async function GET() {
  const { user } = await requireRecAdmin();
  if (!user) return fail("Recording management access required", 403);
  await sweepRecordingRetention().catch(() => {}); // enforce retention (throttled, no-op unless enabled)
  const [recordings, stats, cfg] = await Promise.all([listRecordings(), recordingStats(), getConfig()]);
  return ok({ recordings, stats, config: cfg.recording ?? {} });
}

// Admin: archive / unarchive / delete a recording.
export async function POST(req: Request) {
  const { user } = await requireRecAdmin();
  if (!user) return fail("Recording management access required", 403);
  const body = await readJson<{ action?: string; id?: string }>(req);
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return fail("Recording id is required");
  if (body.action === "archive" || body.action === "unarchive") {
    const okd = await archiveRecording(id, body.action === "archive");
    if (!okd) return fail("Recording not found", 404);
    await addAdminLog(user.fullName, `${body.action === "archive" ? "Archived" : "Restored"} recording ${id}`);
    return ok({ ok: true });
  }
  if (body.action === "delete") {
    const okd = await deleteRecording(id);
    if (!okd) return fail("Recording not found", 404);
    await addAdminLog(user.fullName, `Deleted recording ${id}`);
    return ok({ ok: true });
  }
  return fail("Unknown action", 400);
}
