// Transactional email (account verification). Activates automatically when an
// SMTP/HTTP email provider is configured in the environment; otherwise the app
// stays in demo mode (the 6-digit code is shown in-app) so the flow is testable
// without a provider.
//
// Set on the server (e.g. pm2 ecosystem env) to enable real delivery:
//   EMAIL_API_URL   — provider HTTP send endpoint (e.g. a Resend/Mailgun proxy)
//   EMAIL_API_KEY   — provider API key
//   EMAIL_FROM      — the From address (e.g. "LotusPlay Connect <no-reply@lotusplay.tech>")

function apiUrl() { return process.env.EMAIL_API_URL || ""; }
function apiKey() { return process.env.EMAIL_API_KEY || ""; }
function from() { return process.env.EMAIL_FROM || "LotusPlay Connect <no-reply@lotusplay.tech>"; }

export function emailConfigured(): boolean {
  return !!(apiUrl() && apiKey());
}

/** Send the account-verification code/link. Returns ok=false on any failure so
 * the caller can fall back to the in-app demo code. */
export async function sendVerificationEmail(to: string, code: string): Promise<{ ok: boolean; error?: string }> {
  if (!emailConfigured()) return { ok: false, error: "Email not configured" };
  try {
    const res = await fetch(apiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` },
      body: JSON.stringify({
        from: from(),
        to,
        subject: "Verify your LotusPlay Connect account",
        text: `Welcome to LotusPlay Connect!\n\nYour email verification code is: ${code}\n\nEnter this code in the app to verify your email. After verification an administrator will review and approve your account.`,
      }),
    });
    if (!res.ok) return { ok: false, error: `Email provider returned ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
