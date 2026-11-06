import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getDB } from "@/server/db";
import { getConfig, drawLuckyNumber, canManageRoom, addAdminLog } from "@/server/repo";

export const runtime = "nodejs";

// Run the draw. Allowed for an admin OR the host/co-host of the game's linked room.
// The draw method (auto/manual) + any pre-set number are never exposed here.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const cfg = await getConfig();
  if (cfg.features?.luckyNumber === false) return fail("The Lucky Number game is currently turned off.", 403);

  let allowed = user.role === "admin";
  if (!allowed) {
    const db = await getDB();
    const g = (db.luckyDraws ?? []).find((x) => x.id === id);
    if (g?.roomId) {
      const room = (db.rooms ?? []).find((r) => r.id === g.roomId);
      if (room) allowed = canManageRoom(room, user.id, user.role);
    }
  }
  if (!allowed) return fail("Only an admin or the room host/co-host can run the draw.", 403);

  const r = await drawLuckyNumber(id, user.fullName);
  if (!r.ok) return fail(r.error ?? "Could not run the draw", 400);
  if (user.role === "admin") await addAdminLog(user.fullName, `Ran Lucky Number draw ${id} → winning number ${r.winningNumber}`);
  return ok(r);
}
