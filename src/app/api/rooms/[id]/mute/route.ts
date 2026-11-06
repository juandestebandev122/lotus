import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getRoomRecord, isSeated } from "@/server/repo";
import { setParticipantMute, setParticipantCanPublish } from "@/server/livekit";

export const runtime = "nodejs";

// Host / Co-Host force-mutes (or unmutes) a member at the voice server, so the
// effect is immediate and the user genuinely can't be heard.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);

  const room = await getRoomRecord(id);
  const isHostOrCoHost =
    !room || // seeded/demo rooms have no record — allow (showcase only)
    room.ownerId === user.id ||
    (room.coAdminIds ?? []).includes(user.id) ||
    user.role === "admin";

  const { targetUserId, muted } = await readJson<{ targetUserId?: string; muted?: boolean }>(req);
  if (!targetUserId) return fail("Missing target user");

  // SELF-UNMUTE: a user may clear a stale server-side (SFU) mute on THEIR OWN
  // track — this is what fixes "I'm shown live but nobody can hear me" (a LiveKit
  // server-mute can't be cleared by the user's own client). Allowed only when the
  // user isn't currently force-muted by the room (so it can't bypass a host mute)
  // AND they actually occupy a SEAT — an audience/listener can never self-unmute.
  const seatGated = !!room && room.category !== "Paid Zone" && !room.isCompetition;
  const forceMuted = !!room && !isHostOrCoHost && (
    (room.mutedMemberIds ?? []).includes(user.id) ||
    room.voiceLocked === true ||
    (seatGated && !isSeated(room, user.id))
  );
  const isSelfUnmute = targetUserId === user.id && muted === false && !forceMuted;

  if (!isHostOrCoHost && !isSelfUnmute) return fail("Only the host or a co-host can mute members", 403);
  // PER-ROOM MODERATION (Admin → Room Settings): "Mute Users" off stops a host/co-host
  // from muting members in THIS room. Self-unmute + admins are unaffected. Unset = allowed.
  if (isHostOrCoHost && !isSelfUnmute && muted === true && room && room.features?.muteUsers === false && user.role !== "admin") {
    return fail("Muting members is turned off in this room", 403);
  }

  await setParticipantMute(`room_${id}`, targetUserId, !!muted);
  // Keep the SFU PUBLISH permission in sync with the mute action:
  //  • ANY unmute (self OR host) of someone entitled to a seat → GRANT publish.
  //    This is the fix for "co-host / member can't speak even after unmuting": a
  //    LiveKit publish grant that was revoked earlier (e.g. muted before being
  //    promoted to co-host, or a stale revoke) is NOT restored by a plain mute:false,
  //    so the user stayed silent. Now unmuting always re-grants publish for a seated
  //    user, so the mic actually works again.
  //  • A HOST/co-host muting a member → REVOKE publish (so they can't self-unmute).
  if (room) {
    if (!muted && isSeated(room, targetUserId)) {
      await setParticipantCanPublish(`room_${id}`, targetUserId, true).catch(() => {});
    } else if (muted && isHostOrCoHost && !isSelfUnmute) {
      await setParticipantCanPublish(`room_${id}`, targetUserId, false).catch(() => {});
    }
  }
  return ok({ ok: true });
}
