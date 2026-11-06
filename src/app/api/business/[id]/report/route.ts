import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { reportBusiness } from "@/server/repo";

export const runtime = "nodejs";

// POST: report a business profile — a reason (category + detail) is required.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const b = await readJson<{ category?: string; detail?: string }>(req);
  const category = String(b.category ?? "").trim();
  const detail = String(b.detail ?? "").trim();
  if (!category && !detail) return fail("Please choose a reason for the report.", 400);
  const res = await reportBusiness(user.id, id, category || "Other", detail);
  if (!res.ok) return fail(res.error ?? "Could not submit the report", 400);
  return ok({ ok: true });
}
