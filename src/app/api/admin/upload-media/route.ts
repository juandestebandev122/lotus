import path from "node:path";
import { promises as fs } from "node:fs";
import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { addAdminLog, getConfig } from "@/server/repo";

export const runtime = "nodejs";

// A broad admin file upload → returns a PUBLIC /api/media/<name> URL. Used by the
// Custom Uploads & Banners module (and the room-appearance upload buttons). Unlike
// /api/upload (owner-gated /api/file serving), files here are served publicly with
// Range support, so banners/videos/PDFs are visible to every user.
const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");
// Size ceiling. 25 MB rejected almost any real video ("max 25 MB" is what an
// admin saw when trying to upload one), so the limit now comes from the admin
// File Storage setting and only falls back to a generous default.
const DEFAULT_MAX_MB = 200;

// ext → coarse type category (matches CustomUpload.type).
const IMAGE = ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "avif", "heic", "heif", "ico", "tif", "tiff"];
const VIDEO = ["mp4", "webm", "mov", "mkv", "avi", "m4v", "3gp", "3g2", "mpg", "mpeg", "wmv", "flv", "ts", "ogv"];
const AUDIO = ["mp3", "wav", "m4a", "aac", "ogg", "oga", "opus", "flac", "amr", "wma", "aiff", "mid", "midi"];
const DOCS = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "zip", "rar", "7z", "tar", "gz", "rtf", "json", "xml"];

// ANY file type is accepted except things that can never be safely handed back
// out over the web. This is the same denylist the File Storage library uses —
// an allowlist is what made "all types of files" impossible before.
const BLOCKED_EXT = new Set([
  "exe", "bat", "cmd", "scr", "com", "msi", "vbs", "jar", "dll", "sh", "ps1", "reg",
  "apk", "app", "deb", "dmg", "run", "wsf", "hta", "cpl", "msc", "pif", "gadget", "jse", "vbe",
  "ipa", "appx", "appxbundle", "msix", "msixbundle", "xapk", "lnk", "aab",
]);

function categoryOf(ext: string): "image" | "video" | "pdf" | "audio" | "file" {
  if (IMAGE.includes(ext)) return "image";
  if (VIDEO.includes(ext)) return "video";
  if (AUDIO.includes(ext)) return "audio";
  if (ext === "pdf") return "pdf";
  return "file";
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Admins only", 403);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail("No file received", 400);
  if (file.size === 0) return fail("The file is empty", 400);

  const cfg = await getConfig();
  const maxMb = Math.max(1, Math.min(2048, cfg.fileStorage?.maxFileMB || DEFAULT_MAX_MB));
  if (file.size > maxMb * 1024 * 1024) {
    return fail(`That file is ${(file.size / (1024 * 1024)).toFixed(1)} MB — the limit is ${maxMb} MB. Raise it in Admin → File Storage, or upload a smaller file.`, 400);
  }

  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!ext) return fail("That file has no extension, so it can't be stored safely.", 400);
  if (BLOCKED_EXT.has(ext)) return fail("Programs and app installers can't be uploaded.", 400);

  const name = `up_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  await addAdminLog(user.fullName, `Uploaded a file (${categoryOf(ext)}) for Custom Uploads`);
  return ok({ url: `/api/media/${name}`, name, type: categoryOf(ext), fileName: file.name });
}
