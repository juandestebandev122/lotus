import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { applyToJob } from "@/server/repo";

export const runtime = "nodejs";

// POST: a user applies to a job (application goes to the admin for review first).
export async function POST(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const b = await readJson<{ message?: string; contact?: string }>(req);
  const res = await applyToJob(user.id, jobId, b);
  if (!res.ok) return fail(res.error ?? "Could not apply", 400);
  return ok({ ok: true });
}
