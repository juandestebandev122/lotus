import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { toggleFollow } from "@/server/repo";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return fail("Not authenticated", 401);

  const { userId } = await readJson(req);
  if (!userId || typeof userId !== "string") return fail("Missing userId");
  if (userId === me.id) return fail("Cannot follow yourself");

  const following = await toggleFollow(me.id, userId);
  return ok({ userId, following });
}
