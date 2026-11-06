import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { setJobStatus } from "@/server/repo";

export const runtime = "nodejs";

// PATCH: close a job (owner/admin).
export async function PATCH(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const res = await setJobStatus(user.id, user.role === "admin", jobId, "close");
  if (!res.ok) return fail(res.error ?? "Could not close job", 400);
  return ok({ ok: true });
}

// DELETE: delete a job + its applications (owner/admin).
export async function DELETE(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const res = await setJobStatus(user.id, user.role === "admin", jobId, "delete");
  if (!res.ok) return fail(res.error ?? "Could not delete job", 400);
  return ok({ ok: true });
}
