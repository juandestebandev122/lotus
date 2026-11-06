import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { adminUnlockRoomVoice, addAdminLog } from "@/server/repo";
import { setParticipantCanPublish, setParticipantMute } from "@/server/livekit";

export const runtime = "nodejs";

// Super-Admin: one-click "Fix voice" for a room. Clears the mute-all lock + every
// force-mute (in the DB) and re-grants publish / unmutes the host, co-hosts and every
// seated member at the LiveKit SFU — so "co-hosts / some members can't speak" is
// resolved instantly without anyone having to rejoin.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const { id } = await ctx.params;
  const res = await adminUnlockRoomVoice(id, user.fullName);
  if (!res.ok) return fail(res.error ?? "Could not fix the room voice", 400);
  // Apply the permission changes live at the SFU (best-effort per participant).
  let granted = 0;
  for (const uid of res.seatIds) {
    try {
      await setParticipantCanPublish(`room_${id}`, uid, true);
      await setParticipantMute(`room_${id}`, uid, false);
      granted++;
    } catch { /* participant may not be connected right now — the DB reset still applies */ }
  }
  await addAdminLog(user.fullName, `Fixed voice for room ${id} (${granted} speaker${granted === 1 ? "" : "s"} re-enabled)`);
  return ok({ ok: true, granted });
}
