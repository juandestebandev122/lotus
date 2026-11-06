import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { updateBusinessProduct, deleteBusinessProduct } from "@/server/repo";

export const runtime = "nodejs";

// PATCH: the owner (or admin) edits a product.
export async function PATCH(req: Request, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const b = await readJson<{ name?: string; description?: string; price?: string; image?: string }>(req);
  const res = await updateBusinessProduct(user.id, user.role === "admin", productId, b);
  if (!res.ok) return fail(res.error ?? "Could not update product", 400);
  return ok({ ok: true });
}

// DELETE: the owner (or admin) removes a product.
export async function DELETE(req: Request, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const res = await deleteBusinessProduct(user.id, user.role === "admin", productId);
  if (!res.ok) return fail(res.error ?? "Could not delete product", 400);
  return ok({ ok: true });
}
