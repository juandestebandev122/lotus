import { ok, fail, readJson } from "@/server/http";
import { createPendingSignup, getConfig } from "@/server/repo";
import { smsSettings, verifyMobileCode } from "@/server/sms";
import { clientIp } from "@/server/geo";
import { isAdult } from "@/lib/age";
import { passwordIssue } from "@/lib/password";
import { emailConfigured, sendVerificationEmail } from "@/server/email";

export const runtime = "nodejs";

// Public sign-up. Creates a PENDING account (email unverified) and notifies the
// admin for approval. The user CANNOT enter the app until (a) their email is
// verified and (b) an admin approves — they see "Waiting for Admin Approval".
export async function POST(req: Request) {
  const config = await getConfig();
  if (!config.settings.signups || config.features?.registration === false) return fail("New account registration is currently turned off.", 403);

  const body = await readJson<{ name?: string; dob?: string; gender?: string; phone?: string; email?: string; username?: string; password?: string; acceptedPolicies?: string[]; ref?: string; otp?: string }>(req);
  const name = (body.name ?? "").trim();
  const dob = (body.dob ?? "").trim();
  const gender = body.gender === "female" ? "female" : body.gender === "male" ? "male" : "";
  const phone = (body.phone ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const username = (body.username ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const acceptedPolicies = Array.isArray(body.acceptedPolicies) ? body.acceptedPolicies.map(String) : [];

  if (!name) return fail("Please enter your name");
  if (!dob) return fail("Please enter your date of birth");
  if (!isAdult(dob)) return fail("You must be at least 18 years old to use this app.");
  if (!gender) return fail("Please select your gender");
  if (phone.replace(/\D/g, "").length < 10) return fail("Enter a valid mobile number");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Enter a valid email address (required for verification)");
  if (!/^[a-z0-9._]{3,20}$/.test(username)) return fail("Username must be 3–20 chars (letters, numbers, . or _)");
  const issue = passwordIssue(password);
  if (issue) return fail(issue);

  // Every policy marked "required at sign-up" must be accepted.
  const required = (config.policies ?? []).filter((p) => p.requiredAtSignup).map((p) => p.slug);
  const missing = required.filter((slug) => !acceptedPolicies.includes(slug));
  if (missing.length) return fail("Please accept the Terms & Conditions and all required policies to continue.");

  const sms = await smsSettings();
  if (sms.registrationEnabled) {
    const otp = (body.otp ?? "").trim();
    if (!otp) return fail("Enter the code sent to your mobile number");
    const checked = await verifyMobileCode(phone, otp);
    if (!checked.ok) return fail(checked.error, 401);
  }

  const ip = clientIp(req);
  const res = await createPendingSignup({ fullName: name, dob, gender: gender as "male" | "female", phone, email, username, password, acceptedPolicies, ref: (body.ref ?? "").trim().slice(0, 30) || undefined }, ip);
  if (!res.ok) return fail(res.error ?? "Could not submit your request", 400);

  // Send the verification email when an email provider is configured; otherwise
  // surface the demo code so the flow is testable without SMTP.
  let demoCode: string | undefined;
  if (emailConfigured()) {
    await sendVerificationEmail(email, res.code!);
  } else {
    demoCode = res.code;
  }
  return ok({ ok: true, userId: res.userId, email, demoCode }, 201);
}
