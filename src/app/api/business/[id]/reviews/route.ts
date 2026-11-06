import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listBusinessReviews, addReview, deleteOwnReview } from "@/server/repo";

export const runtime = "nodejs";

// GET: visible reviews for a business (+ the viewer's own) + rating summary.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const d = await listBusinessReviews(id, user.id);
  return ok(d);
}

// POST: add/update the viewer's review, or delete their own review.
//   { rating, text }            → add / update
//   { action: "delete", reviewId } → remove own review
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const b = await readJson<{ rating?: number; text?: string; action?: string; reviewId?: string }>(req);
  if (b.action === "delete" && b.reviewId) {
    const res = await deleteOwnReview(user.id, b.reviewId);
    if (!res.ok) return fail(res.error ?? "Could not delete", 400);
    return ok({ ok: true });
  }
  const res = await addReview(user.id, id, Number(b.rating) || 0, String(b.text ?? ""));
  if (!res.ok) return fail(res.error ?? "Could not post review", 400);
  return ok(res);
}
