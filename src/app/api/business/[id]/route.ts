import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getBusinessProfile, updateBusiness, deleteBusiness } from "@/server/repo";

export const runtime = "nodejs";

// GET: a single business profile (records a view for non-owners of a verified,
// accessible one). Enforces the per-business privacy setting.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const res = await getBusinessProfile(id, user.id);
  if (!res) return fail("Business not found", 404);
  if (res.access === "unverified") return fail("This business is not available yet.", 403);
  if (res.access === "private") return fail("This business is visible to registered businesses only.", 403);
  return ok({ business: res.business });
}

// PATCH: the owner (or an admin) edits the business.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const b = await readJson<{
    name?: string; category?: string; description?: string;
    phone?: string; email?: string; website?: string; location?: string; hours?: string;
    whatsapp?: string; facebook?: string; instagram?: string; youtube?: string;
    logo?: string; cover?: string; visibility?: "everyone" | "businesses";
    fields?: Record<string, string>;
  }>(req);
  const upd = await updateBusiness(id, user.id, user.role === "admin", b);
  if (!upd.ok) return fail(upd.error ?? "Could not update business", 400);
  const res = await getBusinessProfile(id, user.id);
  return ok({ ok: true, business: res?.business });
}

// DELETE: the owner (or an admin) deletes the business.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const res = await deleteBusiness(id, user.id, user.role === "admin");
  if (!res.ok) return fail(res.error ?? "Could not delete business", 400);
  return ok({ ok: true });
}
