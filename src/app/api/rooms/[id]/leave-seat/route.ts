import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getRoomRecord, dropSeatApproval, addRoomEvent } from "@/server/repo";
import { setParticipantCanPublish, setParticipantMute } from "@/server/livekit";

export const runtime = "nodejs";

// A seated member LEAVES their seat → back to the audience (listen-only). Their
// speaking seat is released and their mic is silenced at the SFU immediately.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);

  const room = await getRoomRecord(id);
  if (!room) return ok({ ok: true }); // seeded/demo room — nothing to release

  // Hosts/co-hosts don't "leave a seat" this way (they'd stop moderating); this
  // is for regular members stepping down to the audience.
  await dropSeatApproval(id, user.id);
  await setParticipantCanPublish(`room_${id}`, user.id, false);
  await setParticipantMute(`room_${id}`, user.id, true);
  await addRoomEvent(id, "seat_left", user.fullName.split(" ")[0], user.fullName.split(" ")[0], user.id);
  return ok({ ok: true });
}
