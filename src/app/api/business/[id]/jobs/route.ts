import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getBusinessProfile, listBusinessJobs, listBusinessApplications, createJob } from "@/server/repo";

export const runtime = "nodejs";

// GET: a business's jobs (+ forwarded applicants for the owner/admin).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const prof = await getBusinessProfile(id, user.id, false);
  if (!prof) return fail("Business not found", 404);
  const isOwnerOrAdmin = prof.business.ownerId === user.id || user.role === "admin";
  if (prof.access === "private") return fail("This business is visible to registered businesses only.", 403);
  if (prof.access === "unverified" && !isOwnerOrAdmin) return fail("This business is not available yet.", 403);
  const jobs = await listBusinessJobs(id, user.id, isOwnerOrAdmin);
  const applications = isOwnerOrAdmin ? await listBusinessApplications(id) : [];
  return ok({ jobs, applications, canManage: isOwnerOrAdmin });
}

// POST: the business owner (or admin) posts a job (→ pending admin approval).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const b = await readJson<Parameters<typeof createJob>[2]>(req);
  const res = await createJob(user.id, id, b);
  if (!res.ok) return fail(res.error ?? "Could not post job", 400);
  return ok(res);
}
