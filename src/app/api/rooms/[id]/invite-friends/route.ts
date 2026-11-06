import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { inviteFriendsToRoom } from "@/server/repo";

export const runtime = "nodejs";

// Invite the current user's friends/followers into this room (in-app invite +
// a one-tap "Join room" notification). Only the inviter's own connections can
// be targeted (enforced server-side).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const body = await readJson<{ userIds?: string[] }>(req);
  const userIds = Array.isArray(body.userIds) ? body.userIds.filter((x) => typeof x === "string") : [];
  if (!userIds.length) return fail("Pick at least one friend to invite");
  const res = await inviteFriendsToRoom(user.id, String(id), userIds);
  if (!res.ok) return fail(res.error ?? "Could not send invites", 400);
  return ok({ invited: res.invited });
}
