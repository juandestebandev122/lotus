import path from "node:path";
import { promises as fs } from "node:fs";
import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getRoomRecord, updateRoomRecord } from "@/server/repo";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");
// Generous ceiling so the host can upload large audio/video. It's intentionally
// NOT unlimited — the file is buffered in memory during upload, so an enormous
// file could exhaust the server's RAM. 1 GB comfortably covers long/high-quality
// tracks while keeping the server safe. (nginx client_max_body_size must match.)
const MAX_BYTES = 1024 * 1024 * 1024; // 1 GB

// Host / Co-Host uploads an audio or video file. It's stored on the server and
// set as the room's "now playing" media, so EVERY member can see + hear it
// (synced), not just the uploader's device.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);

  const room = await getRoomRecord(id);
  const allowed = !room || room.ownerId === user.id || (room.coAdminIds ?? []).includes(user.id) || user.role === "admin";
  if (!allowed) return fail("Only the host or a co-host can play media", 403);
  // PER-ROOM (Admin → Room Settings): "Block Media Sharing" ON, or "Music Player"
  // OFF, stops media playback in this room (admins exempt). Unset = allowed.
  if (room && user.role !== "admin" && (room.features?.blockMediaSharing === true || room.features?.musicPlayer === false)) {
    return fail("Media sharing is turned off in this room", 403);
  }

  let form: FormData;
  try { form = await req.formData(); } catch { return fail("Invalid upload"); }
  const file = form.get("file");
  if (!(file instanceof File)) return fail("No file provided");
  if (file.size > MAX_BYTES) return fail("File is too large (max 1 GB)");

  // Accept by MIME OR by extension — some containers (AVI/MKV/MOV) report an
  // empty/odd MIME type, so the extension is the reliable signal.
  const rawExt = (file.name.split(".").pop() || "").replace(/[^a-z0-9]/gi, "").slice(0, 5).toLowerCase();
  const AUDIO_EXTS = ["mp3", "wav", "aac", "m4a", "ogg"];
  const VIDEO_EXTS = ["mp4", "mkv", "mov", "avi", "webm"];
  const isVideo = file.type.startsWith("video") || VIDEO_EXTS.includes(rawExt);
  const isAudio = file.type.startsWith("audio") || AUDIO_EXTS.includes(rawExt);
  if (!isVideo && !isAudio) return fail("Please choose an audio or video file");

  const ext = rawExt || (isVideo ? "mp4" : "mp3");
  const safeId = id.replace(/[^a-z0-9_-]/gi, "");
  const fileName = `${safeId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(UPLOAD_DIR, fileName), buf);

  const media = {
    kind: (isVideo ? "video" : "audio") as "audio" | "video",
    src: `/api/media/${fileName}`,
    startedAt: Date.now(),
    name: file.name.slice(0, 120),
    ownerId: user.id, // playback auto-stops if the owner leaves the room
    ownerName: user.fullName,
  };
  if (room) await updateRoomRecord(id, { media });
  return ok({ media });
}
