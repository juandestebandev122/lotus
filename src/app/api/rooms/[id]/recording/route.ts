import path from "node:path";
import { promises as fs } from "node:fs";
import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getRoomRecord, startRecording, stopRecording, finalizeRecording, addAdminLog, storageGate, invalidateStorageCache, getConfig } from "@/server/repo";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");
const MAX_BYTES = 300 * 1024 * 1024; // 300 MB per recording

// Host/co-host: start a room recording, stop it, or upload the captured audio blob.
// - JSON  { action: "start" | "stop" }        → create / finalise the recording row
// - multipart { recId, file }                 → store the captured audio + attach it
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const room = await getRoomRecord(id);
  if (!room) return fail("Room not found", 404);
  const isHost = room.ownerId === user.id || (room.coAdminIds ?? []).includes(user.id) || user.role === "admin";
  if (!isHost) return fail("Only the host or a co-host can record this room.", 403);

  const ct = req.headers.get("content-type") ?? "";

  // ---- captured-audio upload (multipart) ----
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    const recId = String(form?.get("recId") ?? "");
    const file = form?.get("file");
    if (!recId) return fail("Missing recording id", 400);
    if (!(file instanceof File) || file.size === 0) return fail("No audio received", 400);
    if (file.size > MAX_BYTES) return fail("Recording is too large (max 300 MB).", 400);
    const gate = await storageGate(user.id, file.size);
    if (!gate.ok) return fail(gate.error ?? "Storage is full.", 413);
    const ext = file.type.includes("mp4") ? "mp4" : file.type.includes("ogg") ? "ogg" : "webm";
    const name = `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
    invalidateStorageCache();
    await finalizeRecording(recId, { fileUrl: `/api/media/${name}`, fileName: name, sizeBytes: file.size });
    return ok({ ok: true, url: `/api/media/${name}` });
  }

  // ---- start / stop (JSON) ----
  const body = await req.json().catch(() => ({}));
  const action = (body as { action?: string }).action;
  if (action === "start") {
    // Host recording requires Record Management ON + a room-voice module enabled
    // (admins record for moderation via the Moderation Center, not gated by this).
    const rc = (await getConfig()).recording;
    const allowed = rc?.master === true && (rc?.roomEnabled === true || rc?.modules?.voiceRoomVoice === true || rc?.modules?.privateRoomVoice === true);
    if (!allowed) return fail("Room recording is turned off by the admin.", 403);
    const res = await startRecording(id, user.fullName);
    if (!res.ok) return fail(res.error ?? "Could not start recording", 400);
    await addAdminLog(user.fullName, `Started recording room "${room.name}"`);
    return ok({ ok: true, id: res.id });
  }
  if (action === "stop") {
    const res = await stopRecording(id);
    await addAdminLog(user.fullName, `Stopped recording room "${room.name}"`);
    return ok({ ok: true, id: res.id });
  }
  return fail("Unknown action", 400);
}
