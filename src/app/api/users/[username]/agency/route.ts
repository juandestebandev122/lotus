import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { agencyBadgeOfUser, findById, findByUsername } from "@/server/repo";

export const runtime = "nodejs";

// The agency a given user belongs to (id + name), or null. Public info — shown as
// the agency badge on that user's profile. The path param may be a user id OR a
// @username (the folder slug is [username] to match the sibling user route).
export async function GET(_req: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const rec = (await findById(username)) ?? (await findByUsername(username));
  if (!rec) return ok({ agency: null });
  return ok({ agency: await agencyBadgeOfUser(rec.id) });
}
