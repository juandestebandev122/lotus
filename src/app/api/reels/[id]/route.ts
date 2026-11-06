import path from "node:path";
import { promises as fs } from "node:fs";
import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getReel, updateReel, deleteReel } from "@/server/repo";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const reel = await getReel(id, user.id);
  if (!reel) return fail("Reel not found", 404);
  return ok({ reel });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const body = await readJson<Parameters<typeof updateReel>[3]>(req);
  const res = await updateReel(user.id, user.role === "admin", id, body);
  if (!res.ok) return fail(res.error ?? "Could not update the reel", 400);
  return ok({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const res = await deleteReel(user.id, user.role === "admin", id);
  if (!res.ok) return fail(res.error ?? "Could not delete the reel", 400);
  // Best-effort: remove the underlying video file from disk.
  if (res.videoFile && /^[a-z0-9_.-]+$/i.test(res.videoFile)) {
    try { await fs.unlink(path.join(UPLOAD_DIR, res.videoFile)); } catch { /* already gone */ }
  }
  return ok({ ok: true });
}
