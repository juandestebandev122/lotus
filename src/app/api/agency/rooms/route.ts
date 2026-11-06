import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listAgencyGroups, agencyGroupAction } from "@/server/repo";

export const runtime = "nodejs";

// GET: the rooms ("groups") this agency manages + the agency's room permissions.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const data = await listAgencyGroups(user.id);
  if (!data) return fail("You don't manage an agency.", 404);
  return ok(data);
}

// POST: a permission-gated action on one of the agency's rooms (lock/unlock/close/
// reopen/edit/assign-co-host/remove-co-host). `name` for edit, `targetId` for co-host.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const b = await readJson<{ roomId?: string; action?: string; name?: string; targetId?: string }>(req);
  const roomId = typeof b.roomId === "string" ? b.roomId : "";
  const ACTIONS = ["lock", "unlock", "close", "reopen", "edit", "assignCoHost", "removeCoHost"];
  const action = b.action as "lock" | "unlock" | "close" | "reopen" | "edit" | "assignCoHost" | "removeCoHost";
  if (!roomId || !ACTIONS.includes(action)) return fail("Invalid request");
  const res = await agencyGroupAction(user.id, roomId, action, { name: b.name, targetId: b.targetId });
  if (!res.ok) return fail(res.error ?? "Action failed", 400);
  return ok({ ok: true });
}
