import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getJobDetail, applyToJob } from "@/server/repo";

export const runtime = "nodejs";

// GET /api/jobs/[id] — full details of one job
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const job = await getJobDetail(id, user.id);
  if (!job) return fail("Job not found", 404);
  return ok({ job });
}

// POST /api/jobs/[id] — apply to the job
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const b = await readJson<{ message?: string; contact?: string }>(req);
  const res = await applyToJob(user.id, id, b);
  if (!res.ok) return fail(res.error ?? "Could not apply", 400);
  return ok({ ok: true });
}
