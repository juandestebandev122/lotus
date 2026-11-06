import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { toggleBusinessFollow, getBusinessProfile } from "@/server/repo";

export const runtime = "nodejs";

// POST: follow / unfollow a business (toggles). Returns the new state + count.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const prof = await getBusinessProfile(id, user.id);
  if (!prof) return fail("Business not found", 404);
  if (prof.access !== "ok") return fail("You can't follow this business.", 403);
  const res = await toggleBusinessFollow(user.id, id);
  return ok(res);
}
