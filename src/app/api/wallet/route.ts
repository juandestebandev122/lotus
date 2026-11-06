import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { walletSummary } from "@/server/repo";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const summary = await walletSummary(user.id);
  return ok(summary);
}
