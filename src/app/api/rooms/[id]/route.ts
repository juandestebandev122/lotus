import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import {
  getRoomRecord,
  updateRoomRecord,
  deleteRoomRecord,
  canViewRoom,
  findById,
  getConfig,
  agencyBadgeOfUser,
  isSeated,
  isPrimaryGroup,
  duplicateNameError,
} from "@/server/repo";
import type { RoomRecord } from "@/server/db";
import { avatarUrl, roomImageUrl } from "@/server/avatar";
import { setParticipantCanPublish, setParticipantMute } from "@/server/livekit";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const room = await getRoomRecord(id);
  if (!room) return fail("Room not found", 404);
  // Private rooms are only visible to owner / co-admins / invited members.
  // (A removed/blocked member can still READ so the client can show "you were
  // removed" and redirect — the voice token route is what denies them access.)
  if (!canViewRoom(room, user?.id, user?.role)) return fail("This is a private room", 403);
  // Attach the host's real username + avatar so the client can link to their
  // profile and open a private message (the room record only stores the name).
  const host = await findById(room.hostId);
  // The agency that manages this room = the room OWNER's agency (auto-updates if
  // their membership changes). Shown next to the room name for everyone, linking
  // to the agency's profile.
  const agency = await agencyBadgeOfUser(room.ownerId);
  // Is this the owner's PRIMARY group (their first/oldest room)? If so, the owner
  // can't delete it directly — they must request admin deletion.
  const primary = await isPrimaryGroup(room.ownerId, room.id);
  // Return the room picture as a cacheable URL (not the raw ~80KB base64) so the
  // room page's frequent polls stay tiny — see roomImageUrl / /api/room-image.
  // Also trim the moderation log (kept up to 500 entries server-side) to the most
  // recent 30 — this record is polled every ~4-7s and no client reads its modLog,
  // so shipping the full history each tick was pure waste. Full log stays in the DB
  // and in the admin Group Report.
  return ok({ room: { ...room, modLog: (room.modLog ?? []).slice(0, 30), image: roomImageUrl(room), hostUsername: host?.username ?? "", hostAvatar: avatarUrl(host), agencyName: agency?.name, agencyId: agency?.id, isPrimary: primary } });
}

function isManager(room: RoomRecord, userId: string, role: string): boolean {
  return room.ownerId === userId || (room.coAdminIds ?? []).includes(userId) || role === "admin";
}

// Host / co-admin updates: capacity, name, description, announcement, co-admins,
// invitations, transfer ownership.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);

  const room = await getRoomRecord(id);
  if (!room) return fail("Room not found", 404);
  if (!isManager(room, user.id, user.role)) return fail("Only the host or a co-admin can manage this room", 403);

  const body = await readJson(req);
  const patch: Partial<RoomRecord> = {};

  if (typeof body.capacity === "number") {
    // Rooms allow up to 50 seats (1 host + 1 co-host + members).
    if (body.capacity < 2 || body.capacity > 50) return fail("Rooms allow a maximum of 50 seats");
    patch.capacity = Math.floor(body.capacity);
  }
  // Room NAME can only be set directly by an admin. The host/co-host must submit
  // a paid name-change request for admin approval (see /api/rooms/[id]/feature-request).
  if (typeof body.name === "string" && body.name.trim() && user.role === "admin") {
    patch.name = body.name.trim().slice(0, 60);
    const nameErr = await duplicateNameError("group", patch.name, { excludeId: room.id, currentName: room.name });
    if (nameErr) return fail(nameErr, 409);
  }
  if (typeof body.videoUnlocked === "boolean" && user.role === "admin") patch.videoUnlocked = body.videoUnlocked;
  if (typeof body.category === "string" && body.category.trim()) patch.category = body.category.trim().slice(0, 40);
  if (body.type === "public" || body.type === "private" || body.type === "community" || body.type === "password") patch.type = body.type;
  // Room PICTURE — owner / co-host / admin may set or clear it (whole PATCH is
  // isManager-gated). Accept a data-URL image (client downscales it first) or an
  // empty string to remove it (falls back to the host avatar). Cap the size so a
  // huge upload can't bloat the DB / break the rooms list.
  if (typeof body.image === "string") {
    const img = body.image.trim();
    if (img === "") patch.image = "";
    else if (/^data:image\/(png|jpe?g|webp|gif);base64,/.test(img)) {
      if (img.length > 700_000) return fail("Please use an image under ~500KB.");
      patch.image = img;
    }
    // Any other non-empty value is the cacheable URL form (/api/room-image/…) we
    // hand back in GET responses — i.e. an UNCHANGED picture. Leave it as-is.
  }
  if (typeof body.description === "string") patch.description = body.description.slice(0, 300);
  if (typeof body.announcement === "string") patch.announcement = body.announcement.slice(0, 300);
  if (Array.isArray(body.coAdminIds)) {
    const co = [...new Set(body.coAdminIds.filter((x: unknown): x is string => typeof x === "string"))];
    const cfg = await getConfig();
    // Host/Co-host system can be turned off entirely (existing co-hosts only; no new ones).
    if (cfg.features?.coHost === false && co.length > (room.coAdminIds?.length ?? 0)) return fail("The co-host system is currently turned off.", 403);
    // Effective limit = admin base + any EXTRA slots this room paid for. Admins
    // bypass the cap entirely (they manage co-host permissions directly).
    // A per-room "Maximum Co-Hosts" override (Admin → Room Settings) wins when set.
    const roomMax = room.features?.maxCoHosts;
    const base = typeof roomMax === "number" && roomMax > 0 ? roomMax : (cfg.coHostLimit ?? 3);
    const limit = base + (room.coHostBonus ?? 0);
    if (user.role !== "admin" && co.length > limit) return fail(`This room allows at most ${limit} co-host${limit === 1 ? "" : "s"}. Request more co-host slots, or ask an admin.`);
    // PER-ROOM MODERATION: "Remove Co-Host" off stops demoting existing co-hosts in
    // this room (admins unaffected). Unset = allowed.
    const removingCoHost = (room.coAdminIds ?? []).some((cid) => !co.includes(cid));
    if (removingCoHost && room.features?.removeCoHost === false && user.role !== "admin") return fail("Removing co-hosts is turned off in this room", 403);
    patch.coAdminIds = co;
  }
  if (Array.isArray(body.mutedMemberIds)) patch.mutedMemberIds = body.mutedMemberIds.filter((x: unknown) => typeof x === "string");
  if (Array.isArray(body.removedMemberIds)) patch.removedMemberIds = body.removedMemberIds.filter((x: unknown) => typeof x === "string");
  if (Array.isArray(body.audienceIds)) patch.audienceIds = body.audienceIds.filter((x: unknown): x is string => typeof x === "string");
  if (Array.isArray(body.stageApprovedIds)) patch.stageApprovedIds = body.stageApprovedIds.filter((x: unknown): x is string => typeof x === "string");
  if (Array.isArray(body.mediaAllowedIds)) patch.mediaAllowedIds = body.mediaAllowedIds.filter((x: unknown): x is string => typeof x === "string");
  if (Array.isArray(body.blockedMemberIds)) {
    patch.blockedMemberIds = body.blockedMemberIds.filter((x: unknown): x is string => typeof x === "string");
    // PER-ROOM MODERATION: "Ban Users" off stops NEW bans in this room (existing
    // bans + admins unaffected). Unset = allowed.
    const addingBan = (patch.blockedMemberIds ?? []).some((uid) => !(room.blockedMemberIds ?? []).includes(uid));
    if (addingBan && room.features?.banUsers === false && user.role !== "admin") return fail("Banning members is turned off in this room", 403);
  }
  // Moderation log — record WHO blocked/kicked/unblocked WHOM (and the optional
  // reason from body.modReason) whenever the blocked/removed lists change, so
  // "who blocked this member and why" is always answerable in the admin panel.
  if (Array.isArray(body.blockedMemberIds) || Array.isArray(body.removedMemberIds)) {
    const reason = typeof body.modReason === "string" ? body.modReason.trim().slice(0, 200) : "";
    const entries: NonNullable<RoomRecord["modLog"]> = [];
    const diff = (oldIds: string[], newIds: string[], added: "block" | "kick", removed: "unblock" | "unkick") => {
      for (const uid of newIds.filter((x) => !oldIds.includes(x))) entries.push({ id: `ml_${Math.random().toString(36).slice(2, 10)}`, at: new Date().toISOString(), action: added, targetId: uid, byId: user.id, byName: user.fullName, ...(reason ? { reason } : {}) });
      for (const uid of oldIds.filter((x) => !newIds.includes(x))) entries.push({ id: `ml_${Math.random().toString(36).slice(2, 10)}`, at: new Date().toISOString(), action: removed, targetId: uid, byId: user.id, byName: user.fullName });
    };
    if (Array.isArray(body.blockedMemberIds)) diff(room.blockedMemberIds ?? [], patch.blockedMemberIds ?? [], "block", "unblock");
    if (Array.isArray(body.removedMemberIds)) diff(room.removedMemberIds ?? [], patch.removedMemberIds ?? [], "kick", "unkick");
    if (entries.length > 0) {
      // Resolve target names once so the log is readable without extra lookups.
      for (const e of entries) { const t = await findById(e.targetId); if (t) e.targetName = t.fullName; }
      patch.modLog = [...entries, ...(room.modLog ?? [])].slice(0, 500);
    }
  }
  if (Array.isArray(body.invitedIds)) patch.invitedIds = body.invitedIds.filter((x: unknown) => typeof x === "string");
  if (typeof body.voiceLocked === "boolean") patch.voiceLocked = body.voiceLocked;
  if (typeof body.autoLockChat === "boolean") patch.autoLockChat = body.autoLockChat;
  if (typeof body.chatLockedNow === "boolean") patch.chatLockedNow = body.chatLockedNow;
  if (typeof body.autoSeatApproval === "boolean") patch.autoSeatApproval = body.autoSeatApproval;
  // ADMIN VISIBILITY (Show Admin / Hide Admin) — only a platform admin may change
  // it, so a room host can't hide (or expose) admins in their own group.
  if (typeof body.hideAdmins === "boolean" && user.role === "admin") patch.hideAdmins = body.hideAdmins;
  // Video moderation (host/co-host): force-closed cameras + members-video permission.
  if (Array.isArray(body.cameraOffIds)) patch.cameraOffIds = body.cameraOffIds.filter((x: unknown): x is string => typeof x === "string");
  if (typeof body.videoMembersAllowed === "boolean") patch.videoMembersAllowed = body.videoMembersAllowed;
  // Member permissions (host/co-host only — the whole PATCH is isManager-gated).
  // What NON-host/co-host members may do; each is ALLOWED by default and only
  // taken away when explicitly stored as `false`.
  if (body.memberPerms && typeof body.memberPerms === "object") {
    const p = body.memberPerms as Record<string, unknown>;
    const cur = room.memberPerms ?? {};
    patch.memberPerms = {
      seat: typeof p.seat === "boolean" ? p.seat : cur.seat,
      mic: typeof p.mic === "boolean" ? p.mic : cur.mic,
      camera: typeof p.camera === "boolean" ? p.camera : cur.camera,
      chat: typeof p.chat === "boolean" ? p.chat : cur.chat,
      games: typeof p.games === "boolean" ? p.games : cur.games,
    };
  }

  // Host/co-host sets the room's "now playing" media (or clears it with null).
  // Supports a YouTube/link URL OR a LIVE device stream (no upload/storage) plus
  // the pause/resume/mute-for-all/owner flags.
  if ("media" in body) {
    const m = body.media as Record<string, unknown> | null;
    if (m === null) {
      patch.media = null;
    } else if (m && typeof m === "object" && (m.kind === "audio" || m.kind === "video" || m.kind === "youtube" || m.kind === "image")) {
      const isLive = m.live === true;
      const src = typeof m.src === "string" ? (m.src as string) : "";
      // Accept an external link (http/https) OR an uploaded library file
      // (served from /api/media/…) — the admin media library uses the latter.
      const hasUrl = /^https?:\/\//.test(src) || src.startsWith("/api/media/");
      if (!isLive && !hasUrl) return fail("Invalid media");
      patch.media = {
        kind: m.kind as "audio" | "video" | "youtube" | "image",
        src: isLive ? "live" : (m.src as string),
        live: isLive,
        startedAt: typeof m.startedAt === "number" ? (m.startedAt as number) : Date.now(),
        name: typeof m.name === "string" ? (m.name as string).slice(0, 120) : undefined,
        ownerId: typeof m.ownerId === "string" ? (m.ownerId as string) : user.id,
        ownerName: typeof m.ownerName === "string" ? (m.ownerName as string) : user.fullName,
        paused: m.paused === true,
        pausedAtSec: typeof m.pausedAtSec === "number" ? (m.pausedAtSec as number) : undefined,
        mutedForAll: m.mutedForAll === true,
      };
    } else {
      return fail("Invalid media");
    }
  }

  // Transfer ownership (owner only)
  if (typeof body.transferTo === "string") {
    if (room.ownerId !== user.id && user.role !== "admin") return fail("Only the owner can transfer the room", 403);
    patch.ownerId = body.transferTo;
    patch.hostId = body.transferTo;
    if (typeof body.transferToName === "string") patch.hostName = body.transferToName;
  }

  const updated = await updateRoomRecord(id, patch);

  // Keep LiveKit publish (speak) permissions in sync with any SEATING change made
  // through this generic update — bringing a member to the stage grants their
  // mic, moving them to the audience / removing a co-host silences it — so a
  // member can never speak unless they're seated, even via these paths. Normal
  // voice rooms only (Paid Zone calls + Competitions manage voice themselves).
  if (updated && updated.category !== "Paid Zone" && !updated.isCompetition) {
    const affected = new Set<string>();
    for (const f of ["stageApprovedIds", "audienceIds", "coAdminIds"] as const) {
      if (Array.isArray(patch[f])) {
        for (const uid of room[f] ?? []) affected.add(uid);
        for (const uid of patch[f] ?? []) affected.add(uid);
      }
    }
    if (affected.size) {
      await Promise.all([...affected].map(async (uid) => {
        const seated = isSeated(updated, uid);
        await setParticipantCanPublish(`room_${id}`, uid, seated);
        if (!seated) await setParticipantMute(`room_${id}`, uid, true);
      }));
    }
  }
  return ok({ room: updated });
}

// Delete the room (owner / admin only).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const room = await getRoomRecord(id);
  if (!room) return ok({ deleted: true });
  if (room.ownerId !== user.id && user.role !== "admin")
    return fail("Only the owner can delete this room", 403);
  // PRIMARY-GROUP PROTECTION (admin-toggle): when ON (default), a user can't
  // directly delete their first/primary group — they must request admin approval.
  // When the admin turns it OFF, direct deletion is allowed. Admins always can.
  const cfgGD = await getConfig();
  const requireApproval = cfgGD.settings?.primaryGroupDeleteApproval !== false; // default ON
  if (user.role !== "admin" && requireApproval && (await isPrimaryGroup(room.ownerId, room.id)))
    return fail("This is your primary group — it can't be deleted directly. Please submit a deletion request to the admin.", 403);
  await deleteRoomRecord(id, `${user.role === "admin" ? "admin" : "host"} ${user.fullName} (${user.id})`);
  if (user.role === "admin") {
    const { addAdminLog } = await import("@/server/repo");
    await addAdminLog(user.fullName, `Deleted room “${room.name}” (${id})`);
  }
  return ok({ deleted: true });
}
