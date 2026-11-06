import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getAgencyPortal, searchUsers } from "@/server/repo";
import { avatarUrl } from "@/server/avatar";

export const runtime = "nodejs";

// Search users to ADD to the agency. Only agency owners/managers may search.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const portal = await getAgencyPortal(user.id);
  if (!portal) return fail("You don't manage an agency.", 404);
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return ok({ results: [] });
  const existing = new Set(portal.members.map((m) => m.id));
  const agencyId = portal.agency.id;
  const results = (await searchUsers(q))
    .filter((u) => u.role !== "admin" && !existing.has(u.id))
    .slice(0, 20)
    // `createdByThisAgency` drives the UI: only accounts THIS agency created can
    // be directly ADDED; all others can only be INVITED (they must accept).
    .map((u) => ({ id: u.id, publicId: u.publicId ?? "", name: u.fullName, username: u.username, avatar: avatarUrl(u), createdByThisAgency: u.createdByAgencyId === agencyId }));
  return ok({ results });
}
