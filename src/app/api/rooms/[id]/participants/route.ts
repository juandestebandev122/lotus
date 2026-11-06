import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listRoomParticipants } from "@/server/livekit";
import { profilesByIds, getRoomRecord, isSeated, adminIdSet } from "@/server/repo";

export const runtime = "nodejs";

// The people CURRENTLY in the room's live voice channel who are ON A SEAT — the
// source of truth for who can be invited to / play a game. LISTENERS (audience)
// are excluded: they're connected to voice to hear, but they may not join games.
// Excludes the requester. Returns [] when LiveKit isn't configured.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me) return fail("Please log in first", 401);

  const room = await getRoomRecord(id);
  // "Hide Admin" group → an admin monitoring it never appears in the game-invite
  // picker for members (admins still see everyone).
  const hideAdmins = room?.hideAdmins === true && me.role !== "admin";
  const admins = hideAdmins ? await adminIdSet() : null;
  const parts = (await listRoomParticipants(`room_${id}`)).filter(
    (p) => p.identity !== me.id && isSeated(room, p.identity) && !(admins && admins.has(p.identity)),
  );
  // Resolve real name + avatar from the account (the live-voice metadata can't
  // carry large data-URL avatars), falling back to metadata for guests.
  const profiles = await profilesByIds(parts.map((p) => p.identity));
  const byId = new Map(profiles.map((pr) => [pr.id, pr]));
  const members = parts.map((p) => {
    let meta: { username?: string; avatar?: string } = {};
    try { meta = p.metadata ? JSON.parse(p.metadata) : {}; } catch {}
    const prof = byId.get(p.identity);
    return { id: p.identity, name: prof?.fullName || p.name || meta.username || "Guest", publicId: prof?.publicId, avatar: prof?.avatar || meta.avatar || "" };
  });
  return ok({ members });
}
