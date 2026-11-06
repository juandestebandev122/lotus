import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { addRoomChat, listRoomChatDetailed, getRoomRecord, isBannedFromRoom, featureOn, incrementStickerUsage, listRoomAdmins } from "@/server/repo";
import { livekitConfigured, listRoomParticipants } from "@/server/livekit";

export const runtime = "nodejs";

// Persist a voice-room chat message (kept for moderation history).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (!(await featureOn("chat"))) return fail("Chat is currently turned off.", 403);
  const { id } = await params;
  const room = await getRoomRecord(id);
  // Removed / blocked members cannot post to the room chat.
  if (room && isBannedFromRoom(room, user.id, user.role)) return fail("You no longer have access to this room", 403);

  if (room) {
    const isModerator = room.ownerId === user.id || (room.coAdminIds ?? []).includes(user.id) || user.role === "admin";
    if (!isModerator) {
      // MEMBER PERMISSION: members can chat by default; only blocked when the
      // Host/Co-Host has explicitly switched the "Chat" permission OFF.
      if (room.memberPerms?.chat === false) {
        return fail("Only the Host and Co-Host can chat here right now.", 423);
      }
      // Admin-imposed chat block — this member may view but not send.
      if ((room.chatMutedIds ?? []).includes(user.id)) {
        return fail("An administrator has blocked you from sending messages in this group.", 403);
      }
      // MANUAL LOCK: the host locked the chat right now — members can't post,
      // even while a moderator is present.
      if (room.chatLockedNow === true) {
        return fail("The chat has been locked by the host. Please wait until it is unlocked.", 423);
      }
      // AUTO-LOCK: when enabled (default ON) and NO host/co-host is in the room,
      // members are locked out until a moderator becomes active.
      if (room.autoLockChat !== false && (await livekitConfigured())) {
        const present = await listRoomParticipants(`room_${id}`);
        const ids = new Set(present.map((p) => p.identity));
        // A platform ADMIN in the room counts as a moderator being present, so the
        // chat doesn't stay locked for everyone while an administrator is standing
        // right there. (Admins already bypass this block themselves — this is about
        // what it means for the MEMBERS around them.)
        const adminPresent = (await listRoomAdmins(id, [...ids])).length > 0;
        const moderatorPresent =
          ids.has(room.ownerId) || (room.coAdminIds ?? []).some((cid) => ids.has(cid)) || adminPresent;
        if (!moderatorPresent) {
          return fail("This chat room is temporarily locked. Messages can be sent once the Host or Co-Host joins the room.", 423);
        }
      }
    }
  }

  const body = await readJson<{ text?: string; type?: string; mediaUrl?: string; mediaName?: string; mediaMime?: string }>(req);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  // A media message (sticker / image / video / audio / file) carries no text. Only
  // accept URLs this app itself serves — never an arbitrary remote address.
  const MEDIA = ["sticker", "image", "video", "audio", "file"];
  const isMedia = typeof body.type === "string" && MEDIA.includes(body.type);
  const mediaUrl = typeof body.mediaUrl === "string" && /^\/api\/(file|media)\/[\w.-]+$/.test(body.mediaUrl) ? body.mediaUrl : "";
  if (!text && !(isMedia && mediaUrl)) return fail("Empty message");
  // PER-ROOM chat controls (Admin → Room Settings) — authoritative server enforcement.
  // Moderators are exempt so they can always coordinate. Unset = unchanged.
  if (room) {
    const isMod = room.ownerId === user.id || (room.coAdminIds ?? []).includes(user.id) || user.role === "admin";
    if (!isMod) {
      if (room.features?.blockChat === true) return fail("Chat is turned off in this room.", 423);
      if (!isMedia && room.features?.textChat === false) return fail("Text chat is turned off in this room.", 423);
      if (body.type === "sticker" && room.features?.stickers === false) return fail("Stickers are turned off in this room.", 423);
      // File / image / video / audio uploads honour "Block Media Sharing".
      if (isMedia && body.type !== "sticker" && room.features?.blockMediaSharing === true) return fail("Media sharing is turned off in this room.", 423);
    }
  }
  await addRoomChat({
    roomId: id,
    roomName: room?.name ?? "Room",
    userId: user.id,
    userName: user.fullName,
    text,
    ...(isMedia && mediaUrl ? { type: body.type as "sticker" | "image" | "video" | "audio" | "file", mediaUrl, mediaName: typeof body.mediaName === "string" ? body.mediaName : undefined, mediaMime: typeof body.mediaMime === "string" ? body.mediaMime : undefined } : {}),
  });
  // Track global-sticker usage (no-ops for per-room stickers / images).
  if (isMedia && mediaUrl && body.type === "sticker") await incrementStickerUsage(mediaUrl);
  return ok({ ok: true });
}

// A room's own chat history (members can re-load it).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const { id } = await params;
  const room = await getRoomRecord(id);
  // Removed / blocked members cannot read the room chat either.
  if (room && isBannedFromRoom(room, user.id, user.role)) return fail("You no longer have access to this room", 403);
  const messages = (await listRoomChatDetailed(id)).slice(0, 200).reverse();
  return ok({ messages });
}
