import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listDocRequests, createDocRequest, reviewDocRequest, deleteDocRequest, addAdminLog } from "@/server/repo";
import type { DocReqStatus } from "@/server/db";

export const runtime = "nodejs";

const REVIEW_STATUSES: DocReqStatus[] = ["under_review", "approved", "rejected", "resubmit"];

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  return ok({ requests: await listDocRequests() });
}

// Create a document request for one or more users.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const body = await readJson<{ userIds?: string[]; title?: string; description?: string; type?: string; dueDate?: string; mandatory?: boolean }>(req);
  const userIds = Array.isArray(body.userIds) ? body.userIds.filter((x) => typeof x === "string") : [];
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const type = typeof body.type === "string" ? body.type.trim() : "Custom Document";
  if (!userIds.length) return fail("Select at least one user");
  if (!title) return fail("Enter a request title");

  let created = 0;
  for (const uid of userIds) {
    const res = await createDocRequest({
      userId: uid, title, description: body.description, type,
      dueDate: body.dueDate || undefined, mandatory: body.mandatory === true, requestedBy: user.fullName,
    });
    if (res.ok) created++;
  }
  if (created === 0) return fail("Could not create the request (users not found)", 400);
  await addAdminLog(user.fullName, `Created document request "${title}" for ${created} user(s)`);
  return ok({ ok: true, created });
}

// Review a submission: approve / reject / request resubmission / under review.
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const body = await readJson<{ id?: string; status?: string; remarks?: string }>(req);
  const status = body.status as DocReqStatus | undefined;
  if (!body.id || !status || !REVIEW_STATUSES.includes(status)) return fail("A request id and valid status are required");

  const res = await reviewDocRequest(String(body.id), status, typeof body.remarks === "string" ? body.remarks.slice(0, 400) : "", user.fullName);
  if (!res.ok) return fail(res.error ?? "Could not update", 400);
  await addAdminLog(user.fullName, `Document "${res.title}" set to ${status}`);
  return ok({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const { id } = await readJson<{ id?: string }>(req);
  if (!id) return fail("Request id is required");
  const okDel = await deleteDocRequest(id);
  if (okDel) await addAdminLog(user.fullName, `Deleted a document request`);
  return okDel ? ok({ ok: true }) : fail("Request not found", 404);
}
