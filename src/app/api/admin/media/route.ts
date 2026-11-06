import path from "node:path";
import { promises as fs } from "node:fs";
import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listMediaLibrary, addMediaLibraryItem, updateMediaLibraryItem, deleteMediaLibraryItem, addAdminLog, getConfig } from "@/server/repo";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");
const MAX_BYTES = 1024 * 1024 * 1024; // 1 GB (buffered in memory during upload)
// Audio formats people actually have on a phone. This list was short (mp3/wav/
// aac/m4a/ogg), so anything else — an .opus voice note, a .flac track, .amr,
// .wma — was refused outright with "Please choose an audio, video or image
// file", which is why the Audio tab looked like it was missing files.
const AUDIO_EXTS = ["mp3", "wav", "aac", "m4a", "ogg", "oga", "opus", "flac", "amr", "wma", "aiff", "aif", "weba", "mid", "midi", "3gp", "3ga", "caf", "ape", "alac"];
const VIDEO_EXTS = ["mp4", "mkv", "mov", "avi", "webm", "m4v", "3g2", "flv", "wmv", "mpg", "mpeg", "ts", "ogv"];
const IMAGE_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "avif", "heic", "heif"];

// Whether the admin has this media TYPE enabled in the Media system controls.
async function typeEnabled(kind: "audio" | "video" | "image"): Promise<boolean> {
  const m = (await getConfig()).media ?? {};
  return kind === "video" ? m.videoEnabled !== false : kind === "image" ? m.imageEnabled !== false : m.audioEnabled !== false;
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return { error: fail("Please log in first", 401) };
  if (user.role !== "admin") return { error: fail("Administrator access required", 403) };
  return { user };
}

// List the whole library.
export async function GET() {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  return ok({ items: await listMediaLibrary() });
}

// Add an item: either a MULTIPART file upload (audio/video) OR JSON to add a
// YouTube / direct-link item.
export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const user = gate.user!;
  const ctype = req.headers.get("content-type") || "";

  // ---- YouTube / link (JSON) ----
  if (ctype.includes("application/json")) {
    const b = await readJson<{ kind?: string; name?: string; url?: string }>(req);
    const url = (b.url ?? "").trim();
    if (!/^https?:\/\//.test(url)) return fail("Enter a valid link (http/https)");
    const isYt = /youtube\.com|youtu\.be/.test(url);
    const isImg = b.kind === "image";
    const kind = isYt ? "youtube" : isImg ? "image" : b.kind === "video" ? "video" : "audio";
    // Gate by the admin's Media controls (youtube counts as video).
    if (!(await typeEnabled(kind === "youtube" ? "video" : kind))) return fail(`${kind === "image" ? "Image" : kind === "audio" ? "Audio" : "Video"} media is turned off in Media controls.`);
    let src = url;
    if (isYt) {
      const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
      if (!m) return fail("Enter a valid YouTube link");
      src = `https://www.youtube.com/embed/${m[1]}`;
    }
    const item = await addMediaLibraryItem({ kind, name: (b.name ?? "").trim() || (isYt ? "YouTube video" : "Link"), src, addedBy: user.fullName });
    await addAdminLog(user.fullName, `Added media library item "${item.name}"`);
    return ok({ item }, 201);
  }

  // ---- File upload (multipart) ----
  let form: FormData;
  try { form = await req.formData(); } catch { return fail("Invalid upload"); }
  const file = form.get("file");
  const name = String(form.get("name") ?? "").trim();
  const category = String(form.get("category") ?? "").trim();
  if (!(file instanceof File)) return fail("No file provided");
  if (file.size > MAX_BYTES) return fail("File is too large (max 1 GB)");

  const rawExt = (file.name.split(".").pop() || "").replace(/[^a-z0-9]/gi, "").slice(0, 5).toLowerCase();
  // The browser's MIME type is AUTHORITATIVE and is checked FIRST. Some
  // containers are shared between audio and video (.webm, .mp4, .ogg, .3gp): an
  // audio-only .webm reports "audio/webm" but its extension is in the video
  // list, so extension-first classification filed music under Video and it
  // vanished from the Audio tab. Extensions are only the fallback now, for the
  // phones that report a bare "application/octet-stream".
  const mime = (file.type || "").toLowerCase();
  const isAudio = mime.startsWith("audio/") || (!mime.startsWith("video/") && !mime.startsWith("image/") && AUDIO_EXTS.includes(rawExt));
  const isVideo = !isAudio && (mime.startsWith("video/") || (!mime.startsWith("image/") && VIDEO_EXTS.includes(rawExt)));
  const isImage = !isAudio && !isVideo && (mime.startsWith("image/") || IMAGE_EXTS.includes(rawExt));
  if (!isVideo && !isAudio && !isImage) return fail("Please choose an audio, video, or image file");
  const kind = isAudio ? "audio" : isVideo ? "video" : "image";
  // Gate by the admin's Media system controls.
  if (!(await typeEnabled(kind))) return fail(`${kind === "image" ? "Image" : kind === "audio" ? "Audio" : "Video"} uploads are turned off in Media controls.`);

  const ext = rawExt || (isVideo ? "mp4" : isImage ? "jpg" : "mp3");
  const fileName = `lib_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, fileName), Buffer.from(await file.arrayBuffer()));

  // Media metadata captured by the browser (duration + a small video thumbnail); size
  // we take straight from the uploaded file. All optional / best-effort.
  const durNum = Number(form.get("durationSec"));
  const durationSec = Number.isFinite(durNum) && durNum > 0 ? Math.round(durNum) : undefined;
  const thumbRaw = String(form.get("thumb") ?? "");
  const thumb = thumbRaw.startsWith("data:image/") && thumbRaw.length < 400_000 ? thumbRaw : undefined;
  const item = await addMediaLibraryItem({
    kind,
    name: name || file.name.replace(/\.[^.]+$/, "").slice(0, 120),
    src: `/api/media/${fileName}`,
    fileName,
    category,
    addedBy: user.fullName,
    durationSec,
    sizeBytes: file.size,
    thumb,
  });
  await addAdminLog(user.fullName, `Uploaded media "${item.name}" to the library`);
  return ok({ item }, 201);
}

// Edit name / category.
export async function PATCH(req: Request) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const b = await readJson<{ id?: string; name?: string; category?: string }>(req);
  if (!b.id) return fail("Missing id");
  const item = await updateMediaLibraryItem(String(b.id), { name: b.name, category: b.category });
  if (!item) return fail("Item not found", 404);
  return ok({ item });
}

// Remove an item + its file.
export async function DELETE(req: Request) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const b = await readJson<{ id?: string }>(req);
  if (!b.id) return fail("Missing id");
  const res = await deleteMediaLibraryItem(String(b.id));
  if (!res.ok) return fail("Item not found", 404);
  if (res.fileName) {
    try { await fs.unlink(path.join(UPLOAD_DIR, res.fileName)); } catch { /* already gone */ }
  }
  await addAdminLog(gate.user!.fullName, `Removed a media library item`);
  return ok({ ok: true });
}
