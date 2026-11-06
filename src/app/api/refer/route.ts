import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { referralInfo } from "@/server/repo";

export const runtime = "nodejs";

// Refer-a-friend summary for the logged-in user: their invite CODE, the reward
// per friend, how many joined, coins earned, and their referral history.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const info = await referralInfo(user.id);
  return ok(info);
}
