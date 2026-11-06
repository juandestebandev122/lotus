import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { playerView, refreshGame } from "@/server/lucky-engine";

export const runtime = "nodejs";

// One game, as the PLAYER is allowed to see it (§44) — never the manual draw
// number, never anything that would let a client predict the result.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return fail("Please log in first", 401);
  const { id } = await params;
  // Membership + host reconciliation + expired-countdown close happen on every
  // read, so the state a player sees is always current (§45).
  await refreshGame(id);
  // The viewer's role travels with the view, so a Host/Co-Host is shown their
  // run-the-game controls and an ordinary player is not.
  const view = await playerView(id, me.id, me.role === "admin");
  if (!view) return fail("Game not found", 404);
  return ok({ game: view });
}
