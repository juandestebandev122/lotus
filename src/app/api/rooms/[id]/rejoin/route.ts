import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getRoomRecord, clearRemovedMember } from "@/server/repo";

export const runtime = "nodejs";

// MANUAL REJOIN — called ONCE by the room page when a user deliberately opens a
// room (a navigation/tap). If the host had REMOVED (kicked) them, the kick is
// lifted so they re-enter as a normal member. Auto-reconnects never call this,
// so a kick still ejects reliably; only a real user action brings them back.
// BLOCKED members are refused — only the host unblocking them lets them in.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const { id } = await params;
  const room = await getRoomRecord(id);
  if (!room) return ok({ ok: true }); // seeded/demo room — nothing to lift
  const res = await clearRemovedMember(id, user.id);
  if (!res.ok) return fail("You have been blocked from this room by the host.", 403);
  return ok({ ok: true });
}
