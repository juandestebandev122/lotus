import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getBusinessProfile, listBusinessMedia, createBusinessMedia } from "@/server/repo";

export const runtime = "nodejs";

function normKind(v: unknown): "reel" | "video" {
  return v === "video" ? "video" : "reel";
}

// GET: the reels (Shorts) or videos posted by a business (?kind=reel|video),
// gated by the business's privacy — same access rules as products/jobs.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const prof = await getBusinessProfile(id, user.id, false);
  if (!prof) return fail("Business not found", 404);
  const isOwnerOrAdmin = prof.business.ownerId === user.id || user.role === "admin";
  if (prof.access === "private") return fail("This business is visible to registered businesses only.", 403);
  if (prof.access === "unverified" && !isOwnerOrAdmin) return fail("This business is not available yet.", 403);
  const kind = normKind(new URL(req.url).searchParams.get("kind"));
  const media = await listBusinessMedia(id, kind);
  return ok({ media, canManage: isOwnerOrAdmin });
}

// POST: the owner (or admin) adds a reel/video (a video link + optional thumbnail).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const b = await readJson<{ kind?: string; title?: string; videoUrl?: string; thumb?: string; description?: string }>(req);
  const res = await createBusinessMedia(user.id, id, normKind(b.kind), b);
  if (!res.ok) return fail(res.error ?? "Could not add", 400);
  return ok(res);
}
