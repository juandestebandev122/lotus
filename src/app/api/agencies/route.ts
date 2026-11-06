import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { agencyDirectory, listMyAgencyInvites, requestToJoinAgency, respondToAgencyInvite } from "@/server/repo";

export const runtime = "nodejs";

// GET: the public agency directory (browse & join) + this user's invitations.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const [agencies, invites] = await Promise.all([agencyDirectory(user.id), listMyAgencyInvites(user.id)]);
  return ok({ agencies, invites });
}

// POST: a user requests to join, or responds to an invitation.
//   { action: "join", agencyId }
//   { action: "invite-accept" | "invite-decline", agencyId }
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const b = await readJson<{ action?: string; agencyId?: string }>(req);
  const agencyId = String(b.agencyId ?? "");
  if (!agencyId) return fail("Missing agency");

  let res: { ok: boolean; error?: string };
  if (b.action === "join") res = await requestToJoinAgency(user.id, agencyId);
  else if (b.action === "invite-accept") res = await respondToAgencyInvite(user.id, agencyId, true);
  else if (b.action === "invite-decline") res = await respondToAgencyInvite(user.id, agencyId, false);
  else return fail("Unknown action");

  if (!res.ok) return fail(res.error ?? "Action failed", 400);
  return ok({ ok: true });
}
