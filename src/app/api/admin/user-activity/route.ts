import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listUserActivityLog } from "@/server/repo";

export const runtime = "nodejs";

// Member activity for the analytics page (sign-ins, gifts, wallet, reports…).
// Admin actions stay on /api/admin/logs.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const logs = await listUserActivityLog();
  return ok({ logs });
}
