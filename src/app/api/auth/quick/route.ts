import { fail } from "@/server/http";

export const runtime = "nodejs";

// Self-service "quick" sign-in is DISABLED — accounts are created only by an
// admin approving a registration request. Sign in with the username + password
// provided by the admin (or Mobile / Google for an already-approved account).
export async function POST() {
  return fail("Self sign-up is disabled. Please request an account — an admin will create your login.", 403);
}
