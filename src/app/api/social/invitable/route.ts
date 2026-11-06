import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listInvitablePeople } from "@/server/repo";

export const runtime = "nodejs";

// The current user's invitable connections (friends + followers + following) —
// used by the in-app "Invite friends & followers" picker.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const people = await listInvitablePeople(user.id);
  return ok({ people });
}
