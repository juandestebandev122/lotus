import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { myAgencySummary } from "@/server/repo";

export const runtime = "nodejs";

// The signed-in user's own agency (owner OR member) — null if they aren't in one.
// Powers the "My Agency" shortcut on Home, Profile and the sidebar for members.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  return ok({ agency: await myAgencySummary(user.id) });
}
