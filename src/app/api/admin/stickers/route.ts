import path from "node:path";
import { promises as fs } from "node:fs";
import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listGlobalStickers, addGlobalSticker, updateGlobalSticker, deleteGlobalSticker, addAdminLog } from "@/server/repo";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");
const MAX_MB = 5; // keep the grouped grid instant; animated files stay small
const EXT_MIME: Record<string, string> = { png: "image/png", webp: "image/webp", gif: "image/gif", jpg: "image/jpeg", jpeg: "image/jpeg" };

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return { error: fail("Please log in first", 401) };
  if (user.role !== "admin") return { error: fail("Administrator access required", 403) };
  return { user };
}

// List every sticker (enabled + disabled) with usageCount, for the admin grid + stats.
export async function GET() {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  return ok({ stickers: await listGlobalStickers() });
}

// Upload a new sticker image (multipart: file, name, category).
export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const user = gate.user!;
  let form: FormData;
  try { form = await req.formData(); } catch { return fail("Invalid upload"); }
  const file = form.get("file");
  const name = String(form.get("name") ?? "").trim();
  const category = String(form.get("category") ?? "").trim();
  if (!(file instanceof File)) return fail("No image provided");
  if (file.size === 0) return fail("The image is empty");
  if (file.size > MAX_MB * 1024 * 1024) return fail(`Sticker is too large (max ${MAX_MB} MB)`);
  const ext = (file.name.split(".").pop() || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (!EXT_MIME[ext]) return fail("Stickers must be a PNG, WEBP, GIF or JPG image.");
  const fileName = `gsticker_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, fileName), Buffer.from(await file.arrayBuffer()));
  const item = await addGlobalSticker({ url: `/api/media/${fileName}`, fileName, name, category, addedBy: user.fullName });
  await addAdminLog(user.fullName, `Added sticker "${item.name}" (${item.category})`);
  return ok({ sticker: item }, 201);
}

// Edit name / category / enabled.
export async function PATCH(req: Request) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const b = await readJson<{ id?: string; name?: string; category?: string; enabled?: boolean }>(req);
  if (!b.id) return fail("Missing id");
  const item = await updateGlobalSticker(String(b.id), { name: b.name, category: b.category, enabled: b.enabled });
  if (!item) return fail("Sticker not found", 404);
  await addAdminLog(gate.user!.fullName, `Updated sticker "${item.name}"${typeof b.enabled === "boolean" ? ` (${b.enabled ? "enabled" : "disabled"})` : ""}`);
  return ok({ sticker: item });
}

// Remove sticker + its file.
export async function DELETE(req: Request) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const b = await readJson<{ id?: string }>(req);
  if (!b.id) return fail("Missing id");
  const res = await deleteGlobalSticker(String(b.id));
  if (!res.ok) return fail("Sticker not found", 404);
  if (res.fileName) { try { await fs.unlink(path.join(UPLOAD_DIR, res.fileName)); } catch { /* already gone */ } }
  await addAdminLog(gate.user!.fullName, "Removed a sticker");
  return ok({ ok: true });
}
