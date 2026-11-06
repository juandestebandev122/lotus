import { ok, fail, readJson } from "@/server/http";
import { verifyUserEmail } from "@/server/repo";

export const runtime = "nodejs";

// Confirm a new account's email with the 6-digit code.
export async function POST(req: Request) {
  const { userId, code } = await readJson<{ userId?: string; code?: string }>(req);
  if (!userId || !code) return fail("Missing verification details");
  const res = await verifyUserEmail(String(userId), String(code));
  if (!res.ok) return fail(res.error ?? "Verification failed", 400);
  return ok({ ok: true });
}
