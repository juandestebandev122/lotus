import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getAgencyStructure, agencyMemberAction, adminTransferMember, adminRemoveUserFromAgency, listAgenciesForAdmin, searchUsers, addAdminLog } from "@/server/repo";
import { avatarUrl } from "@/server/avatar";
import { canAccess } from "@/lib/admin-perms";

export const runtime = "nodejs";

async function requireAgencyAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;
  if (!canAccess("agencies", user.adminRole, user.adminPermissions)) return null;
  return user;
}

// GET ?id=<agencyId>  → full structure (owner/managers/co-hosts/members + pending)
// GET ?search=<q>     → user search results (to add members)
export async function GET(req: Request) {
  const user = await requireAgencyAdmin();
  if (!user) return fail("Agency management access required", 403);
  const url = new URL(req.url);
  // GET ?agencies=1 → lightweight list of all agencies for the "assign agency"
  // picker (id/name/serial/status + capacity), NO heavy member/logo payloads.
  if (url.searchParams.get("agencies") !== null) {
    const list = (await listAgenciesForAdmin()).map((a) => ({ id: a.id, agencyId: a.agencyId, name: a.name, status: a.status, memberCount: a.memberCount, memberLimit: a.memberLimit }));
    return ok({ agencies: list });
  }
  const search = url.searchParams.get("search")?.trim();
  if (search !== null && search !== undefined) {
    if (search.length < 2) return ok({ results: [] });
    const results = (await searchUsers(search)).filter((u) => u.role !== "admin").slice(0, 20)
      .map((u) => ({ id: u.id, publicId: u.publicId ?? "", name: u.fullName, username: u.username, avatar: avatarUrl(u) }));
    return ok({ results });
  }
  const id = url.searchParams.get("id") ?? "";
  const structure = await getAgencyStructure(id);
  if (!structure) return fail("Agency not found", 404);
  return ok({ structure });
}

// POST member action:   { agencyId, action, targetId }
// POST transfer member:  { transferTo, userId }
export async function POST(req: Request) {
  const user = await requireAgencyAdmin();
  if (!user) return fail("Agency management access required", 403);
  const b = await readJson<{ agencyId?: string; action?: string; targetId?: string; transferTo?: string; userId?: string; removeUserId?: string }>(req);

  // Manual agency assignment (admin User Management): assign/change a user's agency.
  if (b.transferTo && b.userId) {
    const res = await adminTransferMember(String(b.transferTo), String(b.userId));
    if (!res.ok) return fail(res.error ?? "Transfer failed", 400);
    await addAdminLog(user.fullName, `Assigned a user to agency ${b.transferTo}`);
    return ok({ ok: true });
  }
  // Remove a user's agency assignment entirely.
  if (b.removeUserId) {
    const res = await adminRemoveUserFromAgency(String(b.removeUserId), user.fullName);
    if (!res.ok) return fail(res.error ?? "Could not remove", 400);
    return ok({ ok: true, removedFrom: res.removedFrom });
  }

  const action = b.action as "add" | "approve" | "reject" | "remove" | "setManager" | "setCoHost" | "setMember" | "invite" | "cancelInvite" | "block" | "unblock";
  const ALLOWED = ["add", "approve", "reject", "remove", "setManager", "setCoHost", "setMember", "invite", "cancelInvite", "block", "unblock"];
  if (!b.agencyId || !ALLOWED.includes(action) || !b.targetId) return fail("Invalid request");
  const res = await agencyMemberAction(user.id, String(b.agencyId), action, String(b.targetId));
  if (!res.ok) return fail(res.error ?? "Action failed", 400);
  await addAdminLog(user.fullName, `Agency ${b.agencyId}: ${action} member`);
  return ok({ ok: true });
}
