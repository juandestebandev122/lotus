import path from "node:path";
import { promises as fs } from "node:fs";
import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");
// No practical size limit for media uploads (client asked to remove the cap). A
// generous safety ceiling remains only to protect the server disk/memory from a
// runaway/accidental upload — normal songs & videos are far under it.
const MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB safety ceiling
// Kept in step with the admin media library so a file accepted in one place is
// accepted in the other. Containers shared with video (.webm/.3gp/.ogg) are in
// BOTH lists on purpose — the `kind` the user picked decides which applies.
const AUDIO_EXT = new Set(["mp3", "wav", "m4a", "aac", "ogg", "oga", "opus", "flac", "amr", "wma", "aiff", "aif", "weba", "webm", "mid", "midi", "3gp", "3ga", "caf", "mp4", "ape", "alac"]);
const VIDEO_EXT = new Set(["mp4", "webm", "mov", "m4v", "mkv", "avi", "3gp", "3g2", "flv", "wmv", "mpg", "mpeg", "ts", "ogv"]);
// IMAGES were missing entirely: the room's Media panel offered an Image tab, but
// there was no way to add one from your own device — only an admin could put
// images in the library. Phone cameras produce heic/heif, so those are here too.
const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif", "bmp", "heic", "heif", "avif"]);

const EXT_FOR: Record<string, Set<string>> = { audio: AUDIO_EXT, video: VIDEO_EXT, image: IMAGE_EXT };
const FALLBACK_EXT: Record<string, string> = { audio: "mp3", video: "mp4", image: "jpg" };
const WANTED: Record<string, string> = {
  audio: "an audio (mp3, wav, m4a…)",
  video: "a video (mp4, webm, mov…)",
  image: "an image (jpg, png, webp…)",
};
const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // an image has no reason to be huge

// A host/co-host uploads an audio, video or image file from their device to show
// in the room. Stored in .data/uploads and served back from /api/media/<name>
// (audio/video stream with seek support).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const kind = String(form?.get("kind") ?? "");
  if (!EXT_FOR[kind]) return fail("Choose audio, video or image", 400);
  if (!(file instanceof File)) return fail("No file received", 400);
  if (file.size === 0) return fail("The file is empty", 400);
  const cap = kind === "image" ? MAX_IMAGE_BYTES : MAX_BYTES;
  if (file.size > cap) return fail(kind === "image" ? "That image is too large (max 25 MB)." : "File is too large (max 2 GB).", 400);

  const allowed = EXT_FOR[kind];
  let ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!allowed.has(ext)) {
    if (file.type.startsWith(`${kind}/`)) ext = FALLBACK_EXT[kind];
    else return fail(`Please choose ${WANTED[kind]} file.`, 400);
  }

  const name = `roommedia_${kind}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  const original = (file.name || `${kind} file`).replace(/\.[^.]+$/, "").slice(0, 80);
  return ok({ url: `/api/media/${name}`, kind, name: original });
}
