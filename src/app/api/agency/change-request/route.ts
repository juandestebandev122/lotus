import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { submitAgencyChangeRequest, myAgencyChangeRequest } from "@/server/repo";

export const runtime = "nodejs";

// The signed-in user's latest agency-change request (pending/approved/rejected).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Sign in required", 401);
  return ok({ request: await myAgencyChangeRequest(user.id) });
}

// Submit a request to switch to a different agency (admin will review it).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Sign in required", 401);
  const body = await readJson<{ toAgencyId?: string; reason?: string }>(req);
  const toAgencyId = typeof body.toAgencyId === "string" ? body.toAgencyId : "";
  if (!toAgencyId) return fail("Choose an agency to move to");
  const res = await submitAgencyChangeRequest(user.id, toAgencyId, body.reason ?? "");
  if (!res.ok) return fail(res.error ?? "Could not submit the request", 400);
  return ok({ ok: true });
}
