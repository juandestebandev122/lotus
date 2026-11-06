import path from "node:path";
import { promises as fs } from "node:fs";
import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { addAdminLog } from "@/server/repo";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");
// Raised 8 MB → 32 MB at the client's request. This one route is the image
// uploader behind FOURTEEN admin pages (tokens, dice models, game board, chess
// board, token areas, frames, themes, store, ads, policies, content pages,
// shield, lotus, branding), so the old 8 MB ceiling was the tightest limit in
// the whole admin panel and the first thing high-resolution artwork ran into.
const MAX_BYTES = 32 * 1024 * 1024; // 32 MB
const VIDEO_MAX_BYTES = 64 * 1024 * 1024; // home-page MP4s only
const IMG_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif", "svg", "avif", "bmp", "heic", "heif"]);

// Upload a custom token image → returns its /api/media URL. The admin page then
// saves the design (name + this image) into config.tokenDesigns via the config API.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Admins only", 403);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  // Only the SEO & Home media list may send an MP4. Every other caller of this
  // route is still an image uploader.
  const allowVideo = form?.get("purpose") === "home";
  if (!(file instanceof File)) return fail("No file received", 400);
  if (file.size === 0) return fail("The file is empty", 400);

  let ext = (file.name.split(".").pop() || "").toLowerCase();
  const isMp4 = allowVideo && (ext === "mp4" || file.type === "video/mp4");
  if (isMp4) ext = "mp4";
  if (file.size > (isMp4 ? VIDEO_MAX_BYTES : MAX_BYTES)) {
    return fail(isMp4 ? "Video is too large (max 64 MB)." : "Image is too large (max 32 MB).", 400);
  }
  if (!IMG_EXT.has(ext) && !isMp4) {
    if (file.type.startsWith("image/")) ext = file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : file.type.includes("svg") ? "svg" : file.type.includes("gif") ? "gif" : file.type.includes("avif") ? "avif" : "jpg";
    else return fail(allowVideo ? "Please upload a picture or an MP4 video." : "Please upload an image file (png, jpg, webp).", 400);
  }

  const name = `token_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  await addAdminLog(user.fullName, isMp4 ? "Uploaded a home-page video" : "Uploaded a custom token image");
  return ok({ url: `/api/media/${name}` });
}
