import path from "node:path";
import { promises as fs } from "node:fs";
import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getConfig, updateConfig, addAdminLog } from "@/server/repo";
import { BRAND_SLOT_KEYS } from "@/lib/brand-images";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");
const MAX_BYTES = 32 * 1024 * 1024; // 32 MB (raised from 12 MB — matches the shared admin image uploader)
const IMG_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif", "svg", "avif", "bmp", "heic", "heif"]);
const VALID = new Set<string>(BRAND_SLOT_KEYS);

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return { error: fail("Please log in first", 401) };
  if (user.role !== "admin") return { error: fail("Admins only", 403) };
  return { user };
}

export async function GET() {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const config = await getConfig();
  return ok({ images: config.images ?? {} });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const ct = req.headers.get("content-type") || "";

  // Reset a slot back to the built-in default.
  if (ct.includes("application/json")) {
    const b = await readJson<{ slot?: string; action?: string }>(req);
    if (b.action !== "reset" || !b.slot || !VALID.has(b.slot)) return fail("Bad request", 400);
    const cfg = await getConfig();
    const images = { ...(cfg.images ?? {}) };
    delete images[b.slot];
    await updateConfig({ images });
    await addAdminLog(gate.user!.fullName, `Reset app image "${b.slot}" to default`);
    return ok({ images });
  }

  // Upload a new image for a slot.
  const form = await req.formData().catch(() => null);
  const slot = String(form?.get("slot") ?? "");
  const file = form?.get("file");
  if (!VALID.has(slot)) return fail("Unknown image slot", 400);
  if (!(file instanceof File)) return fail("No image file received", 400);
  if (file.size === 0) return fail("The image file is empty", 400);
  if (file.size > MAX_BYTES) return fail("Image is too large (max 32 MB).", 400);

  let ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!IMG_EXT.has(ext)) {
    if (file.type.startsWith("image/")) ext = file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : file.type.includes("svg") ? "svg" : file.type.includes("gif") ? "gif" : "jpg";
    else return fail("Please upload an image file (png, jpg, webp).", 400);
  }

  const name = `brand_${slot}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  const cfg = await getConfig();
  const images = { ...(cfg.images ?? {}), [slot]: `/api/media/${name}` };
  await updateConfig({ images });
  await addAdminLog(gate.user!.fullName, `Changed app image "${slot}"`);
  return ok({ images, url: `/api/media/${name}` });
}
