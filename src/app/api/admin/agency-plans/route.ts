import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listAgencyPlans, saveAgencyPlan, deleteAgencyPlan, addAdminLog } from "@/server/repo";
import { canAccess } from "@/lib/admin-perms";

export const runtime = "nodejs";

async function requireAgencyAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;
  if (!canAccess("agencies", user.adminRole, user.adminPermissions)) return null;
  return user;
}

// Admin: manage the agency membership plans (create unlimited, set coin price,
// enable/disable, change price/duration/fixed-expiry anytime).
export async function GET() {
  if (!(await requireAgencyAdmin())) return fail("Agency management access required", 403);
  return ok({ plans: await listAgencyPlans(true) });
}

export async function POST(req: Request) {
  const user = await requireAgencyAdmin();
  if (!user) return fail("Agency management access required", 403);
  const b = await readJson<Record<string, unknown>>(req);
  const res = await saveAgencyPlan({
    id: typeof b.id === "string" ? b.id : undefined,
    name: String(b.name ?? ""),
    priceCoins: typeof b.priceCoins === "number" ? b.priceCoins : NaN,
    durationDays: typeof b.durationDays === "number" ? b.durationDays : undefined,
    specificExpiry: typeof b.specificExpiry === "string" ? b.specificExpiry : undefined,
    enabled: typeof b.enabled === "boolean" ? b.enabled : undefined,
  });
  if (!res.ok) return fail(res.error ?? "Could not save plan", 400);
  await addAdminLog(user.fullName, `${b.id ? "Updated" : "Created"} agency plan “${res.plan?.name}” (${res.plan?.priceCoins} coins)`);
  return ok({ plan: res.plan });
}

export async function DELETE(req: Request) {
  const user = await requireAgencyAdmin();
  if (!user) return fail("Agency management access required", 403);
  const b = await readJson<{ id?: string }>(req);
  if (!b.id) return fail("Plan id is required");
  await deleteAgencyPlan(b.id);
  await addAdminLog(user.fullName, `Deleted agency plan ${b.id}`);
  return ok({ ok: true });
}
