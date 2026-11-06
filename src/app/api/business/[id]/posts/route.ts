import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getBusinessProfile, listBusinessPosts, createBusinessPost, businessPageInsights } from "@/server/repo";

export const runtime = "nodejs";

// GET: the post feed for a business page (+ insights for the owner/admin).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  // Gate by the business's privacy/visibility (don't count a view here — the
  // profile GET already does).
  const prof = await getBusinessProfile(id, user.id, false);
  if (!prof) return fail("Business not found", 404);
  const isOwnerOrAdmin = prof.business.ownerId === user.id || user.role === "admin";
  if (prof.access === "private") return fail("This business is visible to registered businesses only.", 403);
  if (prof.access === "unverified" && !isOwnerOrAdmin) return fail("This business is not available yet.", 403);
  const [posts, insights] = await Promise.all([listBusinessPosts(id, user.id), businessPageInsights(id)]);
  return ok({ posts, insights: isOwnerOrAdmin ? insights : null });
}

// POST: the owner (or admin) publishes a post / announcement / offer.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const b = await readJson<{ kind?: string; text?: string; image?: string; offer?: string }>(req);
  const res = await createBusinessPost(user.id, id, b);
  if (!res.ok) return fail(res.error ?? "Could not post", 400);
  return ok(res);
}
