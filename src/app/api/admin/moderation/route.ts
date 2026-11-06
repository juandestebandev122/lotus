import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import {
  listReports, handleReport,
  listRecordings, startRecording, stopRecording, deleteRecording,
  listRoomsForMonitor, listRoomChats, listAdminLogs, listViolations,
  setRoomMute, updateUser, addViolation, addAdminLog, addRoomEvent,
  deleteRoomChat, setRoomChatMute, deleteAdminLog, clearAdminLogs,
} from "@/server/repo";

export const runtime = "nodejs";

function isSuper(role?: string): boolean {
  return !role || role === "super_admin";
}

// Everything the Moderation Center needs, in one call.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const [reports, recordings, rooms, chats, logs, violations] = await Promise.all([
    listReports(), listRecordings(), listRoomsForMonitor(), listRoomChats(), listAdminLogs(), listViolations(),
  ]);

  // Per-group (room) chat summary for the Group Chat History dashboard.
  const byRoom = new Map<string, { count: number; last: string }>();
  for (const c of chats) {
    const cur = byRoom.get(c.roomId);
    if (!cur) byRoom.set(c.roomId, { count: 1, last: c.at });
    else { cur.count++; if (c.at > cur.last) cur.last = c.at; }
  }
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  // Include rooms that appear in chats but may not be in the live monitor list.
  const groupIds = new Set<string>([...rooms.map((r) => r.id), ...byRoom.keys()]);
  const groups = [...groupIds].map((id) => {
    const r = roomById.get(id);
    const fromChat = chats.find((c) => c.roomId === id);
    const s = byRoom.get(id);
    return {
      id,
      name: r?.name ?? fromChat?.roomName ?? "Room",
      owner: r?.hostName ?? "—",
      type: r?.type ?? "—",
      messages: s?.count ?? 0,
      lastAt: s?.last ?? "",
      chatBlocked: (r?.chatMutedIds ?? []).length,
    };
  }).sort((a, b) => b.messages - a.messages);

  return ok({
    reports,
    violations: violations.map((v) => ({ id: v.id, userId: v.userId, userName: v.userName, type: v.type, status: v.status, createdAt: v.createdAt, reason: v.reason, action: v.action, by: v.by })),
    recordings,
    rooms: rooms.map((r) => ({
      id: r.id, name: r.name, host: r.hostName, type: r.type,
      status: r.status ?? "active", live: r.live, capacity: r.capacity,
      recording: !!r.recording, muted: (r.mutedUserIds ?? []).length,
    })),
    chats: chats.slice(0, 2000).map((c) => ({
      id: c.id, roomId: c.roomId, roomName: c.roomName, userId: c.userId, userName: c.userName,
      text: c.text, at: c.at, type: c.type ?? "text", deleted: !!c.deleted, deletedBy: c.deletedBy,
    })),
    groups,
    logs,
    isSuper: isSuper(user.adminRole),
  });
}

// Action dispatcher — one place for all moderation actions (scalable).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const body = await readJson<Record<string, unknown>>(req);
  const kind = String(body.kind);

  switch (kind) {
    case "handleReport": {
      const decision = body.decision === "actioned" ? "actioned" : "dismissed";
      const res = await handleReport(String(body.id), decision, user.fullName);
      if (!res.ok) return fail(res.error ?? "Report not found", 404);
      // Optional escalation against the reported user.
      const penalty = String(body.penalty || "none");
      if (decision === "actioned" && res.report && penalty !== "none") {
        if (penalty === "suspend" || penalty === "ban") {
          await updateUser(res.report.reportedId, { accountStatus: penalty === "ban" ? "banned" : "suspended" });
          // Surface it in the room's live activity feed when the report came from a room.
          if (res.report.roomId) {
            await addRoomEvent(res.report.roomId, penalty === "ban" ? "ban" : "suspend", res.report.reportedName.split(" ")[0], user.fullName, user.id);
          }
        }
        await addViolation({
          userId: res.report.reportedId,
          type: res.report.category,
          reason: `From report by ${res.report.byName}: ${res.report.detail}`,
          penaltyCoins: 0,
          action: penalty === "ban" ? "Account suspended" : penalty === "suspend" ? "Account suspended" : "Warning",
          by: user.fullName,
        });
      }
      await addAdminLog(user.fullName, `Report ${decision}${penalty !== "none" ? ` + ${penalty}` : ""}: ${res.report?.reportedName ?? ""}`);
      return ok({ ok: true });
    }
    case "startRecording": {
      if (!isSuper(user.adminRole)) return fail("Super Admin only", 403);
      const res = await startRecording(String(body.roomId), user.fullName);
      if (!res.ok) return fail(res.error ?? "Could not start", 400);
      await addAdminLog(user.fullName, `Started recording room ${body.roomId}`);
      return ok({ ok: true });
    }
    case "stopRecording": {
      if (!isSuper(user.adminRole)) return fail("Super Admin only", 403);
      await stopRecording(String(body.roomId));
      await addAdminLog(user.fullName, `Stopped recording room ${body.roomId}`);
      return ok({ ok: true });
    }
    case "deleteRecording": {
      if (!isSuper(user.adminRole)) return fail("Super Admin only", 403);
      const okDel = await deleteRecording(String(body.id));
      await addAdminLog(user.fullName, `Deleted recording ${body.id}`);
      return ok({ ok: okDel });
    }
    case "muteRoomUser": {
      await setRoomMute(String(body.roomId), String(body.userId), Boolean(body.muted));
      await addAdminLog(user.fullName, `${body.muted ? "Muted" : "Unmuted"} a user in room ${body.roomId}`);
      return ok({ ok: true });
    }
    case "deleteMessage": {
      // Soft-delete an inappropriate group-chat message.
      const okDel = await deleteRoomChat(String(body.id), user.fullName);
      if (!okDel) return fail("Message not found", 404);
      await addAdminLog(user.fullName, `Deleted a group-chat message (${body.id})`);
      return ok({ ok: true });
    }
    case "blockChatUser": {
      // Block / unblock a member from SENDING messages in a group.
      const muted = Boolean(body.muted);
      const okSet = await setRoomChatMute(String(body.roomId), String(body.userId), muted);
      if (!okSet) return fail("Group not found", 404);
      await addAdminLog(user.fullName, `${muted ? "Blocked" : "Unblocked"} ${body.userName ?? "a member"} from chatting in ${body.roomName ?? body.roomId}`);
      return ok({ ok: true });
    }
    case "moderateUser": {
      // suspend / ban / activate a user account directly.
      const status = String(body.status);
      if (!["active", "suspended", "banned", "blocked"].includes(status)) return fail("Invalid status");
      await updateUser(String(body.userId), { accountStatus: status as "active" | "suspended" | "banned" | "blocked" });
      await addAdminLog(user.fullName, `Set account ${status} for user ${body.userId}`);
      return ok({ ok: true });
    }
    case "deleteAuditLog": {
      // Super Admin removes a single audit-log entry (cleanup).
      if (!isSuper(user.adminRole)) return fail("Super Admin only", 403);
      const okDel = await deleteAdminLog(String(body.id));
      return ok({ ok: okDel });
    }
    case "clearAuditLogs": {
      // Super Admin clears the whole audit log.
      if (!isSuper(user.adminRole)) return fail("Super Admin only", 403);
      const n = await clearAdminLogs();
      return ok({ ok: true, cleared: n });
    }
    default:
      return fail("Unknown action");
  }
}
