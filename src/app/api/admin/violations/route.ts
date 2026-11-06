import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listViolations, addViolation, resolveViolation, addAdminLog } from "@/server/repo";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  return ok({ violations: await listViolations() });
}

// Record a violation + penalty.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const body = await readJson<{ userId?: string; type?: string; reason?: string; penaltyCoins?: number; action?: string }>(req);
  if (!body.userId || !body.type) return fail("User and violation type are required");
  const res = await addViolation({
    userId: String(body.userId),
    type: String(body.type),
    reason: typeof body.reason === "string" ? body.reason.slice(0, 240) : "",
    penaltyCoins: Math.max(0, Math.floor(Number(body.penaltyCoins) || 0)),
    action: typeof body.action === "string" ? body.action : "Warning",
    by: user.fullName,
  });
  if (!res.ok) return fail(res.error ?? "Could not record violation", 400);
  await addAdminLog(user.fullName, `Recorded a "${body.type}" violation`);
  return ok({ ok: true });
}

// Resolve an existing violation.
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const { id } = await readJson<{ id?: string }>(req);
  if (!id) return fail("Violation id required");
  const okRes = await resolveViolation(String(id), user.fullName);
  if (!okRes) return fail("Violation not found", 404);
  return ok({ ok: true });
}
