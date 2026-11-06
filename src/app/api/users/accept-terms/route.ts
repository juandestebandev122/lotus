import { ok, fail } from "@/server/http";
import { getCurrentUser, publicUser } from "@/server/auth";
import { updateUser } from "@/server/repo";

export const runtime = "nodejs";

// Record that the user accepted the Terms & Conditions and Privacy Policy.
export async function POST() {
  const me = await getCurrentUser();
  if (!me) return fail("Not authenticated", 401);
  const updated = await updateUser(me.id, { acceptedTermsAt: new Date().toISOString() });
  return ok({ user: updated ? publicUser(updated) : null });
}
