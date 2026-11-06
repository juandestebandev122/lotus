import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getAgencyPortal, agencyMemberAction, agencyAnnounce, agencyCreateMember, agencyEditMember, agencyMemberDetails, agencyStorage, agencySendStorageWarning } from "@/server/repo";
import { passwordIssue } from "@/lib/password";

export const runtime = "nodejs";

// GET: the agency portal for the logged-in owner / manager (their agency +
// members + stats). 404 if they don't own or manage an agency.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const portal = await getAgencyPortal(user.id);
  if (!portal) return fail("You don't manage an agency.", 404);
  return ok({ portal });
}

// POST: owner/manager acts on their own agency.
//   { kind: "member", action, targetId }  → add/approve/reject/remove/setRole
//   { kind: "announce", text }            → send an announcement to all members
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const portal = await getAgencyPortal(user.id);
  if (!portal) return fail("You don't manage an agency.", 404);
  const agencyId = portal.agency.id;
  const b = await readJson<{ kind?: string; action?: string; targetId?: string; text?: string; fullName?: string; username?: string; password?: string; email?: string; phone?: string }>(req);

  if (b.kind === "announce") {
    const res = await agencyAnnounce(user.id, agencyId, String(b.text ?? ""));
    if (!res.ok) return fail(res.error ?? "Could not send", 400);
    return ok({ ok: true });
  }

  // View a member's details (gated by the View-User-Details permission).
  if (b.kind === "memberDetails") {
    const res = await agencyMemberDetails(user.id, String(b.targetId ?? ""));
    if (!res.ok) return fail(res.error ?? "Not allowed", 403);
    return ok({ details: res.details });
  }
  // Edit a member's basic profile (gated by the Edit-Users permission).
  if (b.kind === "editMember") {
    const res = await agencyEditMember(user.id, String(b.targetId ?? ""), { fullName: b.fullName, email: b.email, phone: b.phone });
    if (!res.ok) return fail(res.error ?? "Could not save", 400);
    return ok({ ok: true });
  }
  // Agency storage usage (gated by the View-Storage permission).
  if (b.kind === "storage") {
    const res = await agencyStorage(user.id);
    if (!res.ok) return fail(res.error ?? "Not allowed", 403);
    return ok({ totalBytes: res.totalBytes, members: res.members });
  }
  // Send a storage warning to a member (gated by the Send-Warnings permission).
  if (b.kind === "sendWarning") {
    const res = await agencySendStorageWarning(user.id, String(b.targetId ?? ""));
    if (!res.ok) return fail(res.error ?? "Could not send", 400);
    return ok({ ok: true });
  }

  // Agency creates a brand-new member account (gated by the Create-Users permission).
  if (b.kind === "create") {
    const pw = String(b.password ?? "");
    const issue = passwordIssue(pw);
    if (issue) return fail(issue, 400);
    const res = await agencyCreateMember(user.id, agencyId, {
      fullName: String(b.fullName ?? ""), username: String(b.username ?? ""), password: pw,
      email: b.email ? String(b.email) : undefined, phone: b.phone ? String(b.phone) : undefined,
    });
    if (!res.ok) return fail(res.error ?? "Could not create the account", 400);
    return ok({ ok: true, user: res.user, pending: res.pending === true });
  }

  const action = b.action as "add" | "approve" | "reject" | "remove" | "setManager" | "setCoHost" | "setMember" | "invite" | "cancelInvite" | "block" | "unblock";
  const ALLOWED = ["add", "approve", "reject", "remove", "setManager", "setCoHost", "setMember", "invite", "cancelInvite", "block", "unblock"];
  if (!ALLOWED.includes(action) || !b.targetId) return fail("Invalid request");
  const res = await agencyMemberAction(user.id, agencyId, action, String(b.targetId));
  if (!res.ok) return fail(res.error ?? "Action failed", 400);
  return ok({ ok: true });
}
