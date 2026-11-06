import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listAdminJobs, decideJob, decideApplication, ownerDecideApplication, setJobStatus, purgeExpiredJobs, addAdminLog } from "@/server/repo";

export const runtime = "nodejs";

// Admin: every job + every application.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const d = await listAdminJobs();
  return ok(d);
}

// Admin: approve/reject a job, or forward/reject an application.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const b = await readJson<{ type?: string; id?: string; action?: string; note?: string; reason?: string }>(req);

  // Remove all expired jobs (no id needed).
  if (b.action === "purgeExpired") {
    const res = await purgeExpiredJobs(user.fullName);
    return ok({ ok: true, removed: res.removed });
  }
  if (!b.id || !b.action) return fail("Missing fields");

  if (b.type === "application") {
    // forward → admin shares with the business; accept/reject → admin decides
    // directly (full application-status control) with an optional reason.
    let res: { ok: boolean; error?: string };
    if (b.action === "forward") res = await decideApplication(b.id, "forward", user.fullName);
    else if (b.action === "accept") res = await ownerDecideApplication(user.id, b.id, "accept");
    else res = await ownerDecideApplication(user.id, b.id, "reject", b.reason);
    if (!res.ok) return fail(res.error ?? "Action failed", 400);
    await addAdminLog(user.fullName, `${b.action} job application (${b.id})`);
    return ok({ ok: true });
  }

  let res: { ok: boolean; error?: string } | undefined;
  switch (b.action) {
    case "approve": res = await decideJob(b.id, true, user.fullName, b.note); break;
    case "reject": res = await decideJob(b.id, false, user.fullName, b.note); break;
    case "delete": res = await setJobStatus(user.id, true, b.id, "delete"); break;
    case "close": res = await setJobStatus(user.id, true, b.id, "close"); break;
    default: return fail("Unknown action");
  }
  if (!res?.ok) return fail(res?.error ?? "Action failed", 400);
  await addAdminLog(user.fullName, `${b.action}d job (${b.id})`);
  return ok({ ok: true });
}
