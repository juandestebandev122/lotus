import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listBusinessesAdmin, listBusinessLog, decideBusiness, setBusinessStatus, addAdminLog, adminCreateBusiness, runDataMigration } from "@/server/repo";

export const runtime = "nodejs";

// Admin: every business (all statuses) + the activity log.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const [businesses, log] = await Promise.all([listBusinessesAdmin(), listBusinessLog()]);
  return ok({ businesses, log });
}

// Admin: verify / reject / suspend / restore / remove a business.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const b = await readJson<{ id?: string; action?: string; note?: string; owner?: string; business?: Record<string, unknown> }>(req);

  // Upgrade all existing accounts/profiles to the latest features (idempotent).
  if (b.action === "migrate") {
    const res = await runDataMigration();
    await addAdminLog(user.fullName, `ran data migration (${res.businessesUpdated} businesses, sections +[${res.sectionsAdded.join(",")}])`);
    return ok(res);
  }

  // Admin creates a business on behalf of a user (goes straight to verified).
  if (b.action === "create") {
    const inp = (b.business ?? {}) as Parameters<typeof adminCreateBusiness>[2];
    const cr = await adminCreateBusiness(String(b.owner ?? ""), user.fullName, inp);
    if (!cr.ok) return fail(cr.error ?? "Could not create business", 400);
    await addAdminLog(user.fullName, `created business ${cr.id} for ${b.owner}`);
    return ok(cr);
  }

  if (!b.id || !b.action) return fail("Missing fields");

  let res: { ok: boolean; error?: string } | undefined;
  let log = "";
  switch (b.action) {
    case "verify": res = await decideBusiness(b.id, true, user.fullName, b.note); log = "verified business"; break;
    case "reject": res = await decideBusiness(b.id, false, user.fullName, b.note); log = "rejected business"; break;
    case "suspend": res = await setBusinessStatus(b.id, "suspended", user.fullName); log = "suspended business"; break;
    case "restore": res = await setBusinessStatus(b.id, "verified", user.fullName); log = "restored business"; break;
    case "remove": res = await setBusinessStatus(b.id, "remove", user.fullName); log = "removed business"; break;
    default: return fail("Unknown action");
  }
  if (!res?.ok) return fail(res?.error ?? "Action failed", 400);
  await addAdminLog(user.fullName, `${log} (${b.id})`);
  return ok({ ok: true });
}
