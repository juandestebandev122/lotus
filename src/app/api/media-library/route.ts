import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listMediaLibrary, getMediaAccess } from "@/server/repo";

export const runtime = "nodejs";

// The admin-approved media library, readable by any logged-in member. Hosts /
// co-hosts pick from this to play in their room (selecting/playing is gated to
// them in the room UI; managing the library is admin-only). Also returns the
// per-user ACCESS map: which media types are enabled, free/paid, and unlocked
// for this user — the room UI uses it to show an "Unlock for N coins" prompt.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const [items, access] = await Promise.all([listMediaLibrary(), getMediaAccess(user.id)]);
  return ok({ items, access });
}
