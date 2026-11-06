import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listLuckyDraws, createLuckyDraw, addAdminLog } from "@/server/repo";
import type { LuckyDrawRecord } from "@/server/db";

export const runtime = "nodejs";

// List every Lucky Number game as a per-viewer view (draw method + pre-set number are
// hidden for everyone except admins; the winning number is hidden until the draw).
export async function GET() {
  const user = await getCurrentUser();
  const games = await listLuckyDraws(user?.id, user?.role);
  return ok({ games });
}

// Create a game (admin only).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const body = await readJson(req);
  if (!body.name || typeof body.name !== "string") return fail("A game name is required");
  const g = await createLuckyDraw(body as Partial<LuckyDrawRecord>, user.fullName);
  await addAdminLog(user.fullName, `Created Lucky Number game "${g.name}"`);
  return ok({ game: g }, 201);
}
