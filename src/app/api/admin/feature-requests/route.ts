import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listFeatureRequests, decideFeatureRequest, deleteFeatureRequest, addAdminLog } from "@/server/repo";

export const runtime = "nodejs";

// Admin: list every paid-feature request (room renames, video unlocks).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const requests = await listFeatureRequests();
  return ok({ requests });
}

// Admin: approve or reject a request.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const body = await readJson<{ id?: string; approve?: boolean; note?: string }>(req);
  if (!body.id) return fail("id required");
  const res = await decideFeatureRequest(String(body.id), body.approve === true, user.fullName, typeof body.note === "string" ? body.note : undefined);
  if (!res.ok) return fail(res.error ?? "Could not update request", 400);
  await addAdminLog(user.fullName, `${body.approve ? "Approved" : "Rejected"} feature request ${body.id}`);
  return ok({ ok: true });
}

// Admin: delete a request (refunds the coins if it was still pending).
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const body = await readJson<{ id?: string }>(req);
  if (!body.id) return fail("id required");
  const res = await deleteFeatureRequest(String(body.id));
  if (!res.ok) return fail(res.error ?? "Could not delete request", 400);
  await addAdminLog(user.fullName, `Deleted feature request ${body.id}`);
  return ok({ ok: true });
}
