import path from "node:path";
import { promises as fs } from "node:fs";
import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { addAdminLog } from "@/server/repo";

export const runtime = "nodejs";

// Custom SOUND-EFFECT upload (Admin → Sound & Music). Short clips only — these
// play as game effects (dice/capture/win…), so keep them snappy.
const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");
const MAX_MB = 10;
const AUDIO_EXT = new Set(["mp3", "wav", "ogg", "m4a", "aac"]);

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const effect = String(form?.get("effect") ?? "sound").replace(/[^a-zA-Z]/g, "").slice(0, 20) || "sound";
  if (!(file instanceof File)) return fail("No audio file received", 400);
  if (file.size === 0) return fail("The file is empty", 400);
  if (file.size > MAX_MB * 1024 * 1024) return fail(`Sound is too large (max ${MAX_MB} MB)`, 400);
  let ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!AUDIO_EXT.has(ext)) {
    if (file.type.startsWith("audio/")) ext = "mp3";
    else return fail("Please choose an audio file (MP3, WAV, OGG…).", 400);
  }

  const name = `sndfx_${effect}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  await addAdminLog(user.fullName, `Uploaded a custom "${effect}" game sound`);
  return ok({ url: `/api/media/${name}` });
}
