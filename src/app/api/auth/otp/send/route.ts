import { ok, fail, readJson } from "@/server/http";
import { sendMobileOtp } from "@/server/sms";

export const runtime = "nodejs";

// Sends a mobile OTP. With SMS keys saved in Admin → Settings (or the Twilio
// env fallback), a real text is sent and the code is not returned. With no
// provider, a demo code is stored and returned so login can still be tested.
export async function POST(req: Request) {
  const body = await readJson<{ identifier?: string; purpose?: string }>(req);
  const identifier = body.identifier;
  if (!identifier || typeof identifier !== "string") return fail("Mobile number is required");

  const digits = identifier.replace(/\D/g, "");
  if (digits.length < 10) return fail("Enter a valid 10-digit mobile number");

  const purpose = body.purpose === "register" ? "register" : "login";
  const res = await sendMobileOtp(identifier, purpose);
  if (!res.ok) return fail(res.error, res.status);
  return ok({
    sent: true,
    demo: res.demo,
    ...(res.demoCode ? { demoCode: res.demoCode } : {}),
    length: res.length,
    resendSeconds: res.resendSeconds,
  });
}
