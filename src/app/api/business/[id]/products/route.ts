import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getBusinessProfile, listBusinessProducts, createBusinessProduct } from "@/server/repo";

export const runtime = "nodejs";

// GET: the products/services listed by a business (gated by its privacy).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const prof = await getBusinessProfile(id, user.id, false);
  if (!prof) return fail("Business not found", 404);
  const isOwnerOrAdmin = prof.business.ownerId === user.id || user.role === "admin";
  if (prof.access === "private") return fail("This business is visible to registered businesses only.", 403);
  if (prof.access === "unverified" && !isOwnerOrAdmin) return fail("This business is not available yet.", 403);
  const products = await listBusinessProducts(id);
  return ok({ products, canManage: isOwnerOrAdmin });
}

// POST: the owner (or admin) adds a product/service.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const b = await readJson<{ name?: string; description?: string; price?: string; image?: string }>(req);
  const res = await createBusinessProduct(user.id, id, b);
  if (!res.ok) return fail(res.error ?? "Could not add product", 400);
  return ok(res);
}
