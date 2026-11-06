import { ok } from "@/server/http";
import { smsReady, smsSettings } from "@/server/sms";

export const runtime = "nodejs";

/** Public, non-secret OTP options for the login and sign-up screens. */
export async function GET() {
  const s = await smsSettings();
  return ok({
    loginEnabled: s.loginEnabled,
    registrationEnabled: s.registrationEnabled,
    countryCode: s.countryCode,
    otpLength: s.otpLength,
    resendSeconds: s.resendSeconds,
    configured: smsReady(s),
  });
}
