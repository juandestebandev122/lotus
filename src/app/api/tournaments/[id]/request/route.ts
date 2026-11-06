import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { requestJoinTournament, getConfig } from "@/server/repo";

export const runtime = "nodejs";

// A member submits a pre-join request for a tournament.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);

  // Admin master + registration toggles (Tournament & Competition Management).
  const cfg = await getConfig();
  if (cfg.features?.tournaments === false) return fail("Tournaments are currently turned off.", 403);
  if (cfg.tournamentControls?.tournamentRegistration === false) return fail("Tournament registration is currently closed.", 403);
  if (cfg.membership?.subscriberFeatures?.tournaments && !user.vip && user.role !== "admin") {
    return fail("Tournament registration is available to paid subscribers only.", 403);
  }

  const res = await requestJoinTournament(id, user.id, user.fullName);
  if (!res.ok) return fail(res.error ?? "Could not submit request", 400);
  return ok({ ok: true });
}
