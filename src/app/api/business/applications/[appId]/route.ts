import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { ownerDecideApplication } from "@/server/repo";

export const runtime = "nodejs";

// POST: the business owner (or admin) accepts or rejects a job applicant.
//   { action: "accept" | "reject", reason? }
export async function POST(req: Request, { params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const b = await readJson<{ action?: string; reason?: string }>(req);
  const action = b.action === "accept" ? "accept" : "reject";
  const res = await ownerDecideApplication(user.id, appId, action, b.reason);
  if (!res.ok) return fail(res.error ?? "Could not update the application", 400);
  return ok({ ok: true });
}
