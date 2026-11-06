import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listReports, resolveReport, addAdminLog } from "@/server/repo";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  return ok({ reports: await listReports() });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const { id } = await readJson<{ id?: string }>(req);
  if (!id) return fail("Report id required");
  const okRes = await resolveReport(String(id));
  if (!okRes) return fail("Report not found", 404);
  await addAdminLog(user.fullName, "Resolved a violation report");
  return ok({ ok: true });
}
