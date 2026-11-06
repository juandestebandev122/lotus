import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getShareChangeLog } from "@/server/repo";

export const runtime = "nodejs";

// Share Distribution change history (audit trail of % changes).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  return ok({ log: await getShareChangeLog() });
}
