import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { submitPendingAvatar } from "@/server/repo";

export const runtime = "nodejs";

// Submit a new profile photo for admin approval (used when the Photo Editor's
// "approval required" mode is on; the direct-update path uses the normal profile save).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const body = await readJson<{ avatar?: string; forApproval?: boolean }>(req);
  if (!body.avatar || typeof body.avatar !== "string") return fail("No image provided");
  const res = await submitPendingAvatar(user.id, body.avatar);
  if (!res.ok) return fail(res.error ?? "Could not submit the photo", 400);
  return ok({ ok: true });
}
