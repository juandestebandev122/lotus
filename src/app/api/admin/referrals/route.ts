import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listReferrals, referralStats, decideReferral, regenerateReferralCode, addAdminLog } from "@/server/repo";

export const runtime = "nodejs";

// Admin referral centre: list all referrals + report stats.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const [referrals, stats] = await Promise.all([listReferrals(), referralStats()]);
  return ok({ referrals, stats });
}

// Approve / reject / block a referral reward, or regenerate a user's invite code.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const body = await readJson<{ action?: string; id?: string; userId?: string; note?: string }>(req);

  if (body.action === "regenerateCode" && body.userId) {
    const code = await regenerateReferralCode(String(body.userId));
    await addAdminLog(user.fullName, `Regenerated referral code for a user`);
    return ok({ code });
  }

  const action = body.action;
  if ((action === "approve" || action === "reject" || action === "block") && body.id) {
    const res = await decideReferral(String(body.id), action, user.fullName, body.note);
    if (!res.ok) return fail(res.error ?? "Could not update", 400);
    await addAdminLog(user.fullName, `Referral ${action}ed (${body.id})`);
    return ok({ ok: true });
  }
  return fail("Unknown action");
}
