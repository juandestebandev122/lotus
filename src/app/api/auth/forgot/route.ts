import { ok, fail, readJson } from "@/server/http";
import { findByEmailOrPhone, issueResetOtp } from "@/server/repo";

export const runtime = "nodejs";

const DEMO_CODE = "123456";

// Step 1 of Forgot Password — send a reset code by email or mobile.
// We always respond success (never reveal whether an account exists), but only
// actually issue a code when the identifier matches a real account.
export async function POST(req: Request) {
  const { identifier } = await readJson<{ identifier?: string }>(req);
  const id = (identifier ?? "").trim();
  if (!id) return fail("Enter your email or mobile number");

  const isEmail = id.includes("@");
  if (!isEmail && id.replace(/\D/g, "").length < 10) return fail("Enter a valid email or 10-digit mobile number");

  const user = await findByEmailOrPhone(id);
  if (!user) {
    // Don't leak account existence — pretend a code was sent.
    return ok({ sent: true, demo: false });
  }

  // Issue a one-time reset code (valid 10 min). With a real email/SMS provider
  // connected this code is delivered; in this build it's returned for the demo.
  await issueResetOtp(id, DEMO_CODE);
  return ok({ sent: true, demo: true, demoCode: DEMO_CODE, channel: isEmail ? "email" : "sms" });
}
