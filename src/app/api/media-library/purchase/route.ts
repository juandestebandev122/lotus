import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { purchaseMediaAccess, getMediaAccess } from "@/server/repo";

export const runtime = "nodejs";

// A user buys permanent access to a paid media type (audio | video | image).
// Deducts coins, records a wallet transaction, and unlocks the type for them.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const b = await readJson<{ type?: string }>(req);
  const type = b.type === "video" ? "video" : b.type === "image" ? "image" : b.type === "audio" ? "audio" : null;
  if (!type) return fail("Choose a media type to unlock");
  const res = await purchaseMediaAccess(user.id, type);
  if (!res.ok) return fail(res.error ?? "Could not unlock", res.error === "Insufficient coins" ? 402 : 400);
  const access = await getMediaAccess(user.id);
  return ok({ ok: true, balance: res.balance, unlocked: res.unlocked, access });
}
