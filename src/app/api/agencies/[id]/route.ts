import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getAgencyPublicProfile } from "@/server/repo";

export const runtime = "nodejs";

// Public profile for ONE agency: its details, members, and the rooms it manages.
// Viewable by any logged-in user (the agency name badge next to a room name links
// here). `id` may be the internal id or the public Agency ID (e.g. "AG1001").
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const profile = await getAgencyPublicProfile(id, user?.id ?? "");
  if (!profile) return fail("Agency not found", 404);
  return ok({ profile });
}
