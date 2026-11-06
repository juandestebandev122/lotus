import path from "node:path";
import { promises as fs } from "node:fs";
import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { addUpload, getConfig, storageGate, checkStorageWarnings } from "@/server/repo";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");

// Allowed types: documents (KYC + document-request submissions) AND private-chat
// attachments (photo / video / voice note / document).
const EXT_MIME: Record<string, string> = {
  // documents
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain", csv: "text/csv",
  // images (gif included so animated stickers/GIFs work)
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  // video
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", m4v: "video/x-m4v",
  // audio / voice notes (browsers record webm/opus; iOS Safari gives mp4/m4a)
  mp3: "audio/mpeg", m4a: "audio/mp4", ogg: "audio/ogg", wav: "audio/wav", oga: "audio/ogg",
};

// MIME for admin-enabled EXTRA extensions (config.messaging.allowedExtensions) —
// e.g. archives / installers the client asked to support behind an admin switch.
const EXTRA_MIME: Record<string, string> = {
  zip: "application/zip", rar: "application/vnd.rar", "7z": "application/x-7z-compressed",
  apk: "application/vnd.android.package-archive",
};

// Executables / installers refused for security whenever the admin's "security scan"
// is ON, OR whenever "allow all file types" is ON (so the one-switch can never open a
// hole) — unless explicitly allow-listed. Includes APK per the client's requirement
// to exclude app installers. A real virus scan still needs a provider.
const DANGEROUS_EXT = new Set([
  "exe", "bat", "cmd", "scr", "com", "msi", "vbs", "js", "jar", "dll", "sh", "ps1", "reg",
  "apk", "app", "deb", "dmg", "bin", "run", "wsf", "hta", "cpl", "msc", "pif", "gadget", "jse", "vbe",
  // more app-installers / mountable images / shortcuts (client: exclude installers)
  "ipa", "appx", "appxbundle", "msix", "msixbundle", "xapk", "lnk", "iso", "img", "aab",
]);

// Chat media can be much larger than a KYC document, so it gets its own ceiling.
const CHAT_KINDS = new Set(["chat", "chatmedia", "chatimage", "chatvideo", "chataudio", "chatfile", "sticker"]);
const CHAT_MAX_MB = 50;

// Secure, authenticated file upload. Stores the file on the server and records
// who owns it so the file-serving route can enforce access (owner or admin).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);

  const config = await getConfig();

  let form: FormData;
  try { form = await req.formData(); } catch { return fail("Invalid upload"); }
  const file = form.get("file");
  const kind = (form.get("kind")?.toString() || "document").replace(/[^a-z0-9_-]/gi, "").slice(0, 24);
  if (!(file instanceof File)) return fail("No file provided");
  if (file.size === 0) return fail("The file is empty");
  const msg = config.messaging ?? {};
  const isChat = CHAT_KINDS.has(kind.toLowerCase());
  // GROUP/ROOM chat media (kind "chatmedia") is shown to the whole room, so it's public.
  // PRIVATE 1:1 DM media uses kind "chatimage"/"chatvideo"/… and stays viewer-gated —
  // do NOT mark those public or private DM images would leak to everyone.
  const isPublicChat = kind.toLowerCase() === "chatmedia";
  // Chat attachments use the admin's messaging size limit; 0 = fall back to the
  // global upload limit (as the admin panel documents), otherwise the 50 MB default.
  const globalMax = Math.max(1, config.uploadMaxMB ?? 10);
  const chatMax = typeof msg.maxFileMB === "number" ? (msg.maxFileMB > 0 ? msg.maxFileMB : globalMax) : CHAT_MAX_MB;
  const maxMB = isChat ? chatMax : globalMax;
  if (file.size > maxMB * 1024 * 1024) return fail(`File is too large (max ${maxMB} MB)`);

  // Storage-limit gate (no-op unless the admin turned storage limits ON).
  const gate = await storageGate(user.id, file.size);
  if (!gate.ok) return fail(gate.error ?? "Your storage is full.", 413);

  const ext = (file.name.split(".").pop() || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const allowed = (msg.allowedExtensions ?? []).map((e) => e.toLowerCase());
  const allowAll = msg.allowAllTypes === true; // one-switch: accept any non-executable file
  // Admin block-list (Admin → Messaging Controls) — refused even if otherwise valid.
  if ((msg.blockedExtensions ?? []).map((e) => e.toLowerCase()).includes(ext)) return fail("This file type has been blocked by the admin.");
  // Dangerous executables/installers (exe, bat, apk, …) — ALWAYS refused when the
  // security scan is ON or when "allow all file types" is ON, so the one-switch never
  // opens a hole. An admin can still permit a specific one via the allow-list.
  if (DANGEROUS_EXT.has(ext) && !allowed.includes(ext) && (msg.virusScan || allowAll)) return fail("This file type is not allowed for security reasons (executable / app-installer files are blocked).");
  // Resolve MIME: the built-in list, then an admin-enabled EXTRA / allow-listed
  // extension, then — when "allow all types" is ON — ANY non-dangerous file as a
  // generic download. Files with no extension are still rejected.
  let mime = EXT_MIME[ext];
  if (!mime && allowed.includes(ext)) mime = EXTRA_MIME[ext] ?? "application/octet-stream";
  if (!mime && allowAll && ext && !DANGEROUS_EXT.has(ext)) mime = EXTRA_MIME[ext] ?? "application/octet-stream";
  if (!mime) return fail("Unsupported file type. Use a photo, video, audio file, PDF or Office document.");

  const safeName = `${user.id}_${kind}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(UPLOAD_DIR, safeName), buf);

  // Group/room chat attachments are shown to the WHOLE room, so mark them public
  // (any logged-in user may open them). Private docs (KYC / document submissions)
  // stay gated. This is what lets every room member see a chat image, not just the
  // sender. (Private 1:1-chat recipients are still handled via viewerIds elsewhere.)
  await addUpload({ name: safeName, ownerId: user.id, originalName: file.name.slice(0, 160), mime, size: file.size, ...(isPublicChat ? { public: true } : {}) });
  await checkStorageWarnings(user.id);
  return ok({ name: safeName, url: `/api/file/${safeName}`, originalName: file.name.slice(0, 160), kind });
}
