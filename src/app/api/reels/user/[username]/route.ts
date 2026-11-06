import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listUserReels } from "@/server/repo";

export const runtime = "nodejs";

// GET /api/reels/user/[username] — a creator's reels (for their profile "Reels" tab)
export async function GET(req: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const kind = new URL(req.url).searchParams.get("kind") ?? undefined;
  const res = await listUserReels(decodeURIComponent(username), user.id, kind);
  return ok(res);
}
