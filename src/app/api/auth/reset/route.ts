import { ok, fail, readJson } from "@/server/http";
import { findByEmailOrPhone, consumeResetOtp, setUserPassword } from "@/server/repo";
import { passwordIssue } from "@/lib/password";

export const runtime = "nodejs";

// Step 2 of Forgot Password — verify the code and set a new password.
export async function POST(req: Request) {
  const { identifier, code, newPassword } = await readJson<{ identifier?: string; code?: string; newPassword?: string }>(req);
  const id = (identifier ?? "").trim();
  const otp = (code ?? "").trim();
  const next = typeof newPassword === "string" ? newPassword : "";

  if (!id || !otp) return fail("Enter the verification code");

  const issue = passwordIssue(next);
  if (issue) return fail(issue);

  const valid = await consumeResetOtp(id, otp);
  if (!valid) return fail("That code is incorrect or has expired", 401);

  const user = await findByEmailOrPhone(id);
  if (!user) return fail("No account found for that email or mobile number", 404);

  // Reset succeeds — set the new password AND sign out every old session.
  await setUserPassword(user.id, next, { invalidateSessions: true });
  return ok({ ok: true });
}
