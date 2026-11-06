import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { adminStats } from "@/server/repo";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const stats = await adminStats();
  return ok({ stats });
}
