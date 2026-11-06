import { ok, fail } from "@/server/http";
import { findByUsername, findById, isFollowing } from "@/server/repo";
import { publicUser, getCurrentUser } from "@/server/auth";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  // Accept a @username OR a raw user id (so profile links work even when a
  // username isn't known, e.g. opening a profile from a voice-room seat).
  const user = (await findByUsername(username)) ?? (await findById(username));
  if (!user) return fail("User not found", 404);

  const me = await getCurrentUser();
  const following = me ? await isFollowing(me.id, user.id) : false;

  return ok({ user: publicUser(user), following });
}
