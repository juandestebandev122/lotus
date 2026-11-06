import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { deleteBusinessMedia, incrBusinessMediaView } from "@/server/repo";

export const runtime = "nodejs";

// PATCH: bump the view count when someone watches (fire-and-forget, no auth gate
// needed beyond being logged in).
export async function PATCH(req: Request, { params }: { params: Promise<{ mediaId: string }> }) {
  const { mediaId } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const res = await incrBusinessMediaView(mediaId);
  return ok(res);
}

// DELETE: the owner (or admin) removes a reel/video.
export async function DELETE(req: Request, { params }: { params: Promise<{ mediaId: string }> }) {
  const { mediaId } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const res = await deleteBusinessMedia(user.id, user.role === "admin", mediaId);
  if (!res.ok) return fail(res.error ?? "Could not delete", 400);
  return ok({ ok: true });
}
