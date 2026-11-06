import path from "node:path";
import { promises as fs } from "node:fs";
import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import {
  listAdminFiles, listAdminFolders, adminStorageStats, adminFileGroup,
  createAdminFolder, renameAdminFolder, deleteAdminFolder,
  addAdminFile, updateAdminFile, deleteAdminFile,
  addUpload, addAdminLog, getConfig,
} from "@/server/repo";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");

// The admin library takes ANY document, image, video, audio or archive — the only
// refusals are executables / app-installers, which can never be safely stored and
// handed back out over the web. (Same denylist the chat uploader uses.)
const BLOCKED_EXT = new Set([
  "exe", "bat", "cmd", "scr", "com", "msi", "vbs", "jar", "dll", "sh", "ps1", "reg",
  "apk", "app", "deb", "dmg", "run", "wsf", "hta", "cpl", "msc", "pif", "gadget", "jse", "vbe",
  "ipa", "appx", "appxbundle", "msix", "msixbundle", "xapk", "lnk", "aab",
]);

// Well-known types get a real MIME so previews (images, video, audio, PDF) work.
const MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain", csv: "text/csv", rtf: "application/rtf",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml", bmp: "image/bmp",
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", m4v: "video/x-m4v", avi: "video/x-msvideo", mkv: "video/x-matroska",
  mp3: "audio/mpeg", m4a: "audio/mp4", ogg: "audio/ogg", wav: "audio/wav",
  zip: "application/zip", rar: "application/vnd.rar", "7z": "application/x-7z-compressed",
  tar: "application/x-tar", gz: "application/gzip",
};

// GET — the whole library: folders, every uploaded file, and the space stats.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const [files, folders, stats] = await Promise.all([listAdminFiles(), listAdminFolders(), adminStorageStats()]);
  return ok({ files, folders, stats });
}

// POST — either a multipart file upload, or a JSON management action:
//   { action: "createFolder" | "renameFolder" | "deleteFolder"
//           | "renameFile" | "moveFile" | "deleteFile", ... }
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const contentType = req.headers.get("content-type") ?? "";

  // ---- Upload -------------------------------------------------------------
  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try { form = await req.formData(); } catch { return fail("Invalid upload"); }
    const file = form.get("file");
    const folderId = (form.get("folderId")?.toString() ?? "").slice(0, 40);
    const note = (form.get("note")?.toString() ?? "").slice(0, 500);
    if (!(file instanceof File)) return fail("No file provided");
    if (file.size === 0) return fail("The file is empty");

    const cfg = await getConfig();
    const maxMB = Math.max(1, cfg.fileStorage?.maxFileMB || 200);
    if (file.size > maxMB * 1024 * 1024) return fail(`File is too large (max ${maxMB} MB). You can raise this limit in Settings.`);

    // Quota check (0 = unlimited).
    const stats = await adminStorageStats();
    if (stats.quotaBytes > 0 && stats.usedBytes + file.size > stats.quotaBytes) {
      return fail("The File Storage quota is full. Delete some files or raise the quota in Settings.", 413);
    }

    const ext = (file.name.split(".").pop() || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (!ext) return fail("The file needs a file extension (for example .pdf or .png).");
    if (BLOCKED_EXT.has(ext)) return fail("Executable and app-installer files can't be stored here for security reasons.");

    const mime = MIME[ext] ?? "application/octet-stream";
    const safeName = `${user.id}_adminfile_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOAD_DIR, safeName), Buffer.from(await file.arrayBuffer()));

    // Index it in the secure upload table too, so /api/file/<name> serves it with
    // the normal access check (admins + the uploader).
    await addUpload({ name: safeName, ownerId: user.id, originalName: file.name.slice(0, 160), mime, size: file.size });
    const rec = await addAdminFile({
      name: safeName,
      title: file.name.slice(0, 160),
      originalName: file.name.slice(0, 160),
      mime, ext, size: file.size,
      uploaderId: user.id,
      uploaderName: user.fullName,
      folderId: folderId || undefined,
      note: note || undefined,
    });
    await addAdminLog(user.fullName, `Uploaded "${rec.title}" to File Storage (${adminFileGroup(mime, ext)}, ${Math.round(file.size / 1024)} KB)`);
    return ok({ file: rec });
  }

  // ---- Management actions --------------------------------------------------
  const body = await readJson<{ action?: string; id?: string; name?: string; title?: string; folderId?: string; note?: string }>(req);

  switch (body.action) {
    case "createFolder": {
      const folder = await createAdminFolder(body.name ?? "", user.fullName);
      if (!folder) return fail("Give the folder a name that isn't already used.");
      await addAdminLog(user.fullName, `Created File Storage folder "${folder.name}"`);
      return ok({ folder });
    }
    case "renameFolder": {
      if (!body.id) return fail("Folder id required");
      const done = await renameAdminFolder(body.id, body.name ?? "");
      if (!done) return fail("Could not rename that folder", 404);
      await addAdminLog(user.fullName, `Renamed a File Storage folder to "${body.name}"`);
      return ok({ ok: true });
    }
    case "deleteFolder": {
      if (!body.id) return fail("Folder id required");
      const done = await deleteAdminFolder(body.id);
      if (!done) return fail("Folder not found", 404);
      await addAdminLog(user.fullName, `Deleted a File Storage folder (its files were kept)`);
      return ok({ ok: true });
    }
    case "renameFile":
    case "moveFile": {
      if (!body.id) return fail("File id required");
      const done = await updateAdminFile(body.id, { title: body.title, folderId: body.folderId, note: body.note });
      if (!done) return fail("File not found", 404);
      await addAdminLog(user.fullName, body.action === "renameFile" ? `Renamed a File Storage file to "${body.title}"` : `Moved a File Storage file to another folder`);
      return ok({ ok: true });
    }
    case "deleteFile": {
      if (!body.id) return fail("File id required");
      const name = await deleteAdminFile(body.id);
      if (!name) return fail("File not found", 404);
      try { await fs.unlink(path.join(UPLOAD_DIR, name)); } catch { /* already gone on disk */ }
      await addAdminLog(user.fullName, `Deleted a file from File Storage (${name})`);
      return ok({ ok: true });
    }
    default:
      return fail("Unknown action");
  }
}
