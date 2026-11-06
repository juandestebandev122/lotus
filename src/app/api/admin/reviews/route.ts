import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { adminListReviews, adminReviewAction, addAdminLog } from "@/server/repo";

export const runtime = "nodejs";

// GET: every business review (for moderation).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const reviews = await adminListReviews();
  return ok({ reviews });
}

// POST: hide / show / remove a review. { reviewId, action }
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const b = await readJson<{ reviewId?: string; action?: string }>(req);
  const action = (["hide", "show", "remove"].includes(b.action ?? "") ? b.action : "") as "hide" | "show" | "remove" | "";
  if (!b.reviewId || !action) return fail("Invalid request");
  const res = await adminReviewAction(String(b.reviewId), action);
  if (!res.ok) return fail(res.error ?? "Action failed", 400);
  await addAdminLog(user.fullName, `${action} review (${b.reviewId})`);
  return ok({ ok: true });
}
