import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listMyPendingGameInvites } from "@/server/repo";

export const runtime = "nodejs";

// Pending invites addressed to the signed-in user — drives the incoming-invite
// popup. Polled by the global GameInviteProvider.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return ok({ invites: [] });
  return ok({ invites: await listMyPendingGameInvites(user.id) });
}
