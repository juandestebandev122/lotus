import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { productEnquiry } from "@/server/repo";

export const runtime = "nodejs";

// POST: a viewer contacts the seller about a product (notifies the owner).
export async function POST(req: Request, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const b = await readJson<{ message?: string }>(req);
  const res = await productEnquiry(user.id, productId, b.message);
  if (!res.ok) return fail(res.error ?? "Could not send enquiry", 400);
  return ok({ ok: true });
}
