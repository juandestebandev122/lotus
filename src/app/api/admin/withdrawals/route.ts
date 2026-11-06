import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listWithdrawalsForAdmin, decideWithdrawal, addAdminLog } from "@/server/repo";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  return ok({ withdrawals: await listWithdrawalsForAdmin() });
}

// Approve / reject / complete a withdrawal.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const body = await readJson<{ id?: string; decision?: string; note?: string }>(req);
  const decision = body.decision as "approved" | "rejected" | "completed" | undefined;
  if (!body.id || !decision || !["approved", "rejected", "completed"].includes(decision)) {
    return fail("A withdrawal id and valid decision are required");
  }
  const res = await decideWithdrawal(String(body.id), decision, user.fullName, typeof body.note === "string" ? body.note.slice(0, 200) : "");
  if (!res.ok) return fail(res.error ?? "Could not update withdrawal", 400);
  await addAdminLog(user.fullName, `Withdrawal ${decision}`);
  return ok({ ok: true });
}
