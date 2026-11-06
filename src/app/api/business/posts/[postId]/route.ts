import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { togglePostLike, addPostComment, deleteBusinessPost } from "@/server/repo";

export const runtime = "nodejs";

// POST: like/unlike or comment on a post. Body: { action: "like" | "comment", text? }.
export async function POST(req: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const b = await readJson<{ action?: string; text?: string }>(req);
  if (b.action === "like") {
    const res = await togglePostLike(user.id, postId);
    return ok(res);
  }
  if (b.action === "comment") {
    const res = await addPostComment(user.id, postId, String(b.text ?? ""));
    if (!res.ok) return fail(res.error ?? "Could not comment", 400);
    return ok(res);
  }
  return fail("Unknown action");
}

// DELETE: the business owner (or an admin) removes a post.
export async function DELETE(req: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const res = await deleteBusinessPost(user.id, user.role === "admin", postId);
  if (!res.ok) return fail(res.error ?? "Could not delete post", 400);
  return ok({ ok: true });
}
