import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getDB } from "@/server/db";
import { autoReactivateRooms, setRoomStatus, addAdminLog, isFreshInRoom, roomPresenceTtlMs } from "@/server/repo";
import { roomImageUrl } from "@/server/avatar";

export const runtime = "nodejs";

// Change a room's status (active / inactive / suspended) with an audit log.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const { id, status, from, until, reason } = await readJson<{
    id?: string;
    status?: string;
    from?: string;
    until?: string;
    reason?: string;
  }>(req);

  if (!id) return fail("Room id is required");
  if (status !== "active" && status !== "inactive" && status !== "suspended") return fail("Invalid status");
  if (status === "suspended" && (!from || !until)) return fail("Suspension needs a start and end date/time");

  const room = await setRoomStatus(id, status, { from, until, reason });
  if (!room) return fail("Room not found", 404);

  const verb = status === "active" ? "Reactivated" : status === "inactive" ? "Deactivated" : "Suspended";
  const detail =
    status === "suspended"
      ? ` until ${new Date(until!).toLocaleString("en-SA")}${reason ? ` — reason: ${reason}` : ""}`
      : "";
  await addAdminLog(user.fullName, `${verb} room “${room.name}” (${id})${detail}`);
  return ok({ room: { id: room.id, status: room.status, suspendUntil: room.suspendUntil ?? "", suspendReason: room.suspendReason ?? "" } });
}

// Every room (admins see private rooms too), newest first.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  await autoReactivateRooms();
  const db = await getDB();

  // REAL occupancy, counted right now. `r.live` is a stored flag that goes
  // stale, which is why the Active/Inactive indicator did not reflect reality.
  // A person counts as being in a room only when their room heartbeat is still
  // fresh, so someone who closed the app is never counted as present.
  const ttl = roomPresenceTtlMs(db);
  const now = Date.now();
  const occupancy = new Map<string, { total: number; hostPresent: boolean; coHostPresent: boolean; names: string[] }>();
  for (const u of db.users) {
    const rid = u.activeRoomId;
    if (!rid || !isFreshInRoom(u, rid, ttl, now)) continue;
    const cell = occupancy.get(rid) ?? { total: 0, hostPresent: false, coHostPresent: false, names: [] };
    cell.total += 1;
    if (cell.names.length < 8) cell.names.push(u.fullName);
    occupancy.set(rid, cell);
  }
  for (const r of db.rooms) {
    const cell = occupancy.get(r.id);
    if (!cell) continue;
    const present = db.users.filter((u) => u.activeRoomId === r.id && isFreshInRoom(u, r.id, ttl, now));
    cell.hostPresent = present.some((u) => u.id === r.ownerId);
    cell.coHostPresent = present.some((u) => (r.coAdminIds ?? []).includes(u.id));
  }

  const rooms = [...db.rooms]
    // Paid Zone 1:1 calls are managed under Admin → Paid Zone → Calls, not here.
    .filter((r) => r.category !== "Paid Zone")
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((r) => ({
      id: r.id,
      name: r.name,
      ownerId: r.ownerId,
      hostName: r.hostName,
      category: r.category,
      type: r.type,
      capacity: r.capacity,
      live: r.live,
      // Live-right-now occupancy for the Active / Inactive indicator.
      occupants: occupancy.get(r.id)?.total ?? 0,
      hostPresent: occupancy.get(r.id)?.hostPresent ?? false,
      coHostPresent: occupancy.get(r.id)?.coHostPresent ?? false,
      presentNames: occupancy.get(r.id)?.names ?? [],
      status: r.status ?? "active",
      suspendFrom: r.suspendFrom ?? "",
      suspendUntil: r.suspendUntil ?? "",
      suspendReason: r.suspendReason ?? "",
      image: roomImageUrl(r),
      description: r.description ?? "",
      announcement: r.announcement ?? "",
      coAdminIds: r.coAdminIds ?? [],
      invitedIds: r.invitedIds ?? [],
      coAdminCount: (r.coAdminIds ?? []).length,
      invitedCount: (r.invitedIds ?? []).length,
      hideAdmins: r.hideAdmins === true,
      createdAt: r.createdAt,
    }));
  return ok({ rooms });
}
