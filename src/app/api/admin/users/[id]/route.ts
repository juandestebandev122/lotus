import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { userActivity, findById } from "@/server/repo";

export const runtime = "nodejs";

// A single user's activity log: login/logout history + account-action audit
// entries (creation, password resets, status changes, deletion attempts…).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return fail("Please log in first", 401);
  if (me.role !== "admin") return fail("Administrator access required", 403);

  const { id } = await params;
  const target = await findById(id);
  if (!target) return fail("User not found", 404);

  const activity = await userActivity(id);
  return ok(activity);
}
