import path from "node:path";
import { promises as fs } from "node:fs";
import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { featureOn, storageGate, checkStorageWarnings, invalidateStorageCache } from "@/server/repo";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");
const MAX_BYTES = 120 * 1024 * 1024; // 120 MB — short reels
const VIDEO_EXT = new Set(["mp4", "webm", "mov", "m4v", "ogg"]);

// Accept an uploaded/recorded reel video (multipart), store it in .data/uploads,
// and return its filename — the reel is then created (with caption/music/etc.)
// via POST /api/reels. The file streams back seekably from /api/media/<name>.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (!(await featureOn("reels"))) return fail("Reels are currently turned off.", 403);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail("No video file received", 400);
  if (file.size === 0) return fail("The video file is empty", 400);
  if (file.size > MAX_BYTES) return fail("Video is too large (max 120 MB). Please trim it or lower the quality.", 400);

  // Storage-limit gate (no-op unless the admin turned storage limits ON).
  const gate = await storageGate(user.id, file.size);
  if (!gate.ok) return fail(gate.error ?? "Your storage is full.", 413);

  let ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!VIDEO_EXT.has(ext)) {
    if (file.type.startsWith("video/")) ext = file.type.includes("webm") ? "webm" : file.type.includes("quicktime") ? "mov" : "mp4";
    else return fail("Please upload a video file (mp4, webm or mov).", 400);
  }

  const name = `reel_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  invalidateStorageCache(); // count the new video immediately
  await checkStorageWarnings(user.id);
  return ok({ file: name, url: `/api/media/${name}` });
}
