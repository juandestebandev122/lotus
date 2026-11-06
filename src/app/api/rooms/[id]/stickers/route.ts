import path from "node:path";
import { promises as fs } from "node:fs";
import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listRoomStickers, addRoomSticker, removeRoomSticker, renameRoomSticker, canViewRoom, getRoomRecord } from "@/server/repo";

export const runtime = "nodejs";

const MEDIA_DIR = path.join(process.cwd(), ".data", "uploads");
const MAX_MB = 5; // stickers should be small so the grid loads instantly
const EXT_MIME: Record<string, string> = {
  png: "image/png", webp: "image/webp", gif: "image/gif", jpg: "image/jpeg", jpeg: "image/jpeg",
};

// GET — the group's sticker collection (any member who can see the room).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const { id } = await params;
  const room = await getRoomRecord(id);
  if (!room) return fail("Room not found", 404);
  if (!canViewRoom(room, user.id, user.role)) return fail("You don't have access to this room", 403);
  return ok({ stickers: await listRoomStickers(id) });
}

// POST — upload a new sticker image (multipart). Host / co-host / admin only.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const { id } = await params;

  let form: FormData;
  try { form = await req.formData(); } catch { return fail("Invalid upload"); }
  const file = form.get("file");
  const name = form.get("name")?.toString() ?? "";
  if (!(file instanceof File)) return fail("No image provided");
  if (file.size === 0) return fail("The image is empty");
  if (file.size > MAX_MB * 1024 * 1024) return fail(`Sticker is too large (max ${MAX_MB} MB)`);

  const ext = (file.name.split(".").pop() || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const mime = EXT_MIME[ext];
  if (!mime) return fail("Stickers must be a PNG, WEBP, GIF or JPG image.");

  const safeName = `sticker_${id}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await fs.mkdir(MEDIA_DIR, { recursive: true });
  await fs.writeFile(path.join(MEDIA_DIR, safeName), Buffer.from(await file.arrayBuffer()));

  // Stickers are served from the PUBLIC media route: everyone in the group must
  // be able to load them, and they should be cacheable so the grid is instant.
  const res = await addRoomSticker(id, user.id, { url: `/api/media/${safeName}`, fileName: safeName, name });
  if (!res.ok) {
    await fs.unlink(path.join(MEDIA_DIR, safeName)).catch(() => {});
    return fail(res.error ?? "Could not add the sticker", 403);
  }
  return ok({ stickers: res.stickers });
}

// PATCH { stickerId, name } — rename. DELETE-style body { stickerId } — remove.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const { id } = await params;
  const { stickerId, name } = await readJson<{ stickerId?: string; name?: string }>(req);
  if (!stickerId) return fail("Missing sticker");
  const res = await renameRoomSticker(id, user.id, stickerId, typeof name === "string" ? name : "");
  if (!res.ok) return fail(res.error ?? "Could not update the sticker", 403);
  return ok({ stickers: res.stickers });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const { id } = await params;
  const { stickerId } = await readJson<{ stickerId?: string }>(req);
  if (!stickerId) return fail("Missing sticker");
  const res = await removeRoomSticker(id, user.id, stickerId);
  if (!res.ok) return fail(res.error ?? "Could not remove the sticker", 403);
  // Tidy up the image file too, so removed stickers don't take up disk forever.
  if (res.fileName) await fs.unlink(path.join(MEDIA_DIR, res.fileName)).catch(() => {});
  return ok({ stickers: res.stickers });
}
