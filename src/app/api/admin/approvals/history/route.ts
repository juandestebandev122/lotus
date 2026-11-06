import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { approvalHistory } from "@/server/repo";

export const runtime = "nodejs";

// Approval History: every completed decision (approved / rejected / …) across all
// approval queues, newest first, with who decided and when.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const history = await approvalHistory();
  return ok({ history });
}
