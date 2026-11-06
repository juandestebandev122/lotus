import { fail } from "@/server/http";

export const runtime = "nodejs";

// Direct self-registration is DISABLED. New accounts are created only by an
// admin approving a registration request (see /api/auth/request → admin review).
export async function POST() {
  return fail("Self sign-up is disabled. Please submit an account request — an admin will create your login.", 403);
}
