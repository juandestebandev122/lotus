import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listAgenciesForAdmin, createAgency, updateAgency, deleteAgency, reviewAgencyRequest, addAdminLog } from "@/server/repo";
import type { AgencyStatus } from "@/server/db";
import { canAccess } from "@/lib/admin-perms";

export const runtime = "nodejs";

const AGENCY_STATUSES: AgencyStatus[] = ["pending", "active", "suspended", "expired", "rejected"];
const str = (v: unknown) => (typeof v === "string" ? v : undefined);
// The shared "Agency Information" fields accepted from create/edit forms.
function agencyInfoFromBody(b: Record<string, unknown>) {
  return {
    type: str(b.type), country: str(b.country), state: str(b.state), city: str(b.city), address: str(b.address),
    contactPerson: str(b.contactPerson), mobile: str(b.mobile), email: str(b.email), website: str(b.website),
    autoRenewal: typeof b.autoRenewal === "boolean" ? b.autoRenewal : undefined,
    renewalReminderDays: typeof b.renewalReminderDays === "number" ? b.renewalReminderDays : undefined,
    planId: str(b.planId), startDate: str(b.startDate), expiryDate: str(b.expiryDate),
  };
}

async function requireAgencyAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { user: null as null };
  if (!canAccess("agencies", user.adminRole, user.adminPermissions)) return { user: null as null };
  return { user };
}

// List every agency, enriched with the owner's full identity (photo / UID /
// email / mobile) and the full member list — so the admin cards can drill down.
export async function GET() {
  const { user } = await requireAgencyAdmin();
  if (!user) return fail("Agency management access required", 403);
  return ok({ agencies: await listAgenciesForAdmin() });
}

// Create a new agency (auto Agency ID).
export async function POST(req: Request) {
  const { user } = await requireAgencyAdmin();
  if (!user) return fail("Agency management access required", 403);
  const body = await readJson<Record<string, unknown>>(req);
  const res = await createAgency(
    {
      name: String(body.name ?? ""),
      ownerId: typeof body.ownerId === "string" ? body.ownerId : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      logo: typeof body.logo === "string" && body.logo.startsWith("data:image/") ? body.logo : undefined,
      cover: typeof body.cover === "string" && body.cover.startsWith("data:image/") ? body.cover : undefined,
      commission: (body.commission as Record<string, number>) ?? undefined,
      roomLimit: typeof body.roomLimit === "number" ? body.roomLimit : undefined,
      memberLimit: typeof body.memberLimit === "number" ? body.memberLimit : undefined,
      features: (body.features as Record<string, boolean>) ?? undefined,
      // Persist the permissions chosen on the create form (was being dropped, so
      // new agencies always started with defaults regardless of what admin set).
      permissions: (body.permissions && typeof body.permissions === "object") ? (body.permissions as import("@/server/db").AgencyPermissions) : undefined,
      status: AGENCY_STATUSES.includes(body.status as AgencyStatus) ? (body.status as AgencyStatus) : undefined,
      ...agencyInfoFromBody(body),
    },
    user.fullName,
  );
  if (!res.ok) return fail(res.error ?? "Could not create agency", 400);
  await addAdminLog(user.fullName, `Created agency “${res.agency?.name}” (${res.agency?.agencyId})`);
  return ok({ agency: res.agency }, 201);
}

// Edit an agency / change its status / commission / limits / owner.
export async function PATCH(req: Request) {
  const { user } = await requireAgencyAdmin();
  if (!user) return fail("Agency management access required", 403);
  const body = await readJson<Record<string, unknown>>(req);
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return fail("Agency id is required");
  // Approve / reject an agency REQUEST (sends the rejection reason to the user).
  if (body.action === "approve" || body.action === "reject") {
    const rev = await reviewAgencyRequest(id, body.action === "approve", str(body.reason) ?? "", user.fullName);
    if (!rev.ok) return fail(rev.error ?? "Could not review the request", 400);
    return ok({ agency: rev.agency });
  }
  const res = await updateAgency(id, {
    name: typeof body.name === "string" ? body.name : undefined,
    description: typeof body.description === "string" ? body.description : undefined,
    logo: typeof body.logo === "string" ? body.logo : undefined,
    cover: typeof body.cover === "string" ? body.cover : undefined,
    // Only touch the owner when the request actually sends `ownerId` — otherwise a
    // status/commission edit would wipe the assigned owner.
    ...("ownerId" in body ? { ownerId: typeof body.ownerId === "string" ? body.ownerId : "" } : {}),
    status: AGENCY_STATUSES.includes(body.status as AgencyStatus) ? (body.status as AgencyStatus) : undefined,
    rejectionReason: str(body.rejectionReason),
    commission: (body.commission as Record<string, number>) ?? undefined,
    roomLimit: typeof body.roomLimit === "number" ? body.roomLimit : undefined,
    memberLimit: typeof body.memberLimit === "number" ? body.memberLimit : undefined,
    features: (body.features as Record<string, boolean>) ?? undefined,
    permissions: (body.permissions && typeof body.permissions === "object") ? (body.permissions as import("@/server/db").AgencyPermissions) : undefined,
    // Manual level override (only when the key is present, so other edits don't clear it).
    ...("levelTierId" in body ? { levelTierId: typeof body.levelTierId === "string" ? body.levelTierId : null } : {}),
    ...agencyInfoFromBody(body),
  });
  if (!res.ok) return fail(res.error ?? "Could not update agency", 400);
  await addAdminLog(user.fullName, `Updated agency “${res.agency?.name}” (${res.agency?.agencyId})`);
  return ok({ agency: res.agency });
}

// Delete an agency — SOFT delete: the full record is archived to the "Deleted
// Agencies" section (restorable) and removed from active use.
export async function DELETE(req: Request) {
  const { user } = await requireAgencyAdmin();
  if (!user) return fail("Agency management access required", 403);
  const body = await readJson<{ id?: string; reason?: string }>(req);
  if (!body.id) return fail("Agency id is required");
  const res = await deleteAgency(body.id, { reason: str(body.reason), adminName: user.fullName, adminId: user.id });
  if (!res.ok) return fail(res.error ?? "Could not delete agency", 400);
  await addAdminLog(user.fullName, `Deleted agency ${body.id}`);
  return ok({ ok: true });
}
