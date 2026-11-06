import path from "node:path";
import { promises as fs } from "node:fs";
import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { adminListReels, adminReelAction } from "@/server/repo";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return { error: fail("Please log in first", 401) };
  if (user.role !== "admin") return { error: fail("Admins only", 403) };
  return { user };
}

export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return ok(await adminListReels(q));
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const body = await readJson<{ id?: string; action?: string }>(req);
  const valid = ["hide", "unhide", "feature", "unfeature", "delete", "block"] as const;
  if (!body.id || !body.action || !valid.includes(body.action as (typeof valid)[number])) return fail("Bad request", 400);
  const res = await adminReelAction(gate.user!.fullName, body.id, body.action as (typeof valid)[number]);
  if (!res.ok) return fail(res.error ?? "Action failed", 400);
  if (res.videoFile && /^[a-z0-9_.-]+$/i.test(res.videoFile)) {
    try { await fs.unlink(path.join(UPLOAD_DIR, res.videoFile)); } catch { /* already gone */ }
  }
  return ok({ ok: true });
}
