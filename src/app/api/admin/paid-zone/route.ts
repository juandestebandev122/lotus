import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listPaidZoneMembers, decidePaidZone, setPaidZoneStatus, listPaidZoneLog, clearPaidZoneLog, addAdminLog, sweepPaidZoneRenewals, adminUpdatePaidZoneProfile } from "@/server/repo";

export const runtime = "nodejs";

// Admin: every Paid Zone request + member (with verification details) + activity log.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  await sweepPaidZoneRenewals(); // keep active/inactive accurate before listing
  const [members, log] = await Promise.all([listPaidZoneMembers(), listPaidZoneLog()]);
  return ok({ members, log });
}

// Admin: approve / reject / suspend / restore / remove a member.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const b = await readJson<{ userId?: string; action?: string; note?: string; profile?: { fzName?: string; fzUsername?: string; fzAvatar?: string; fzBio?: string; fzVisible?: boolean; accountName?: string } }>(req);
  if (!b.action) return fail("Missing fields");

  // Clear the activity log (no userId needed).
  if (b.action === "clearLog") {
    await clearPaidZoneLog();
    await addAdminLog(user.fullName, "Cleared Paid Zone activity log");
    return ok({ ok: true });
  }
  if (!b.userId) return fail("Missing user");

  // Admin edits a member's separate Friend Zone profile (names, picture, bio,
  // visibility). Never affects the member's login account.
  if (b.action === "editProfile") {
    const res = await adminUpdatePaidZoneProfile(b.userId, b.profile ?? {});
    if (!res.ok) return fail(res.error ?? "Could not update the profile", 400);
    await addAdminLog(user.fullName, `edited Friend Zone profile (${b.userId})`);
    return ok({ ok: true });
  }

  let res: { ok: boolean; error?: string } | undefined;
  let log = "";
  switch (b.action) {
    case "approve": res = await decidePaidZone(b.userId, true, user.fullName, b.note); log = "approved Paid Zone request"; break;
    case "reject": res = await decidePaidZone(b.userId, false, user.fullName, b.note); log = "rejected Paid Zone request"; break;
    case "suspend": res = await setPaidZoneStatus(b.userId, "suspended", user.fullName); log = "suspended Paid Zone member"; break;
    case "restore": res = await setPaidZoneStatus(b.userId, "approved", user.fullName); log = "restored Paid Zone member"; break;
    case "remove": res = await setPaidZoneStatus(b.userId, "remove", user.fullName); log = "removed Paid Zone member"; break;
    default: return fail("Unknown action");
  }
  if (!res?.ok) return fail(res?.error ?? "Action failed", 400);
  await addAdminLog(user.fullName, `${log} (${b.userId})`);
  return ok({ ok: true });
}
