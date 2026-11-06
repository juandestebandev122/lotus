import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { myAgencyRequestHistory } from "@/server/repo";

export const runtime = "nodejs";

// The signed-in user's own agency request history: join requests + change/transfer
// requests, each with its Pending / Approved / Rejected / Blocked / Cancelled status.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Sign in required", 401);
  return ok(await myAgencyRequestHistory(user.id));
}
