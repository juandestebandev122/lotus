// ============================================================
// Shared password policy — used by the client (live validation in
// the Change/Reset password forms) AND the server (enforced on save).
// Keep this pure so it can run in both environments.
// ============================================================

export const PASSWORD_MIN = 8;

export interface PasswordCheck {
  label: string;
  met: boolean;
}

/** The live checklist shown under a password field. */
export function passwordChecks(pw: string): PasswordCheck[] {
  return [
    { label: `At least ${PASSWORD_MIN} characters`, met: pw.length >= PASSWORD_MIN },
    { label: "An uppercase letter (A–Z)", met: /[A-Z]/.test(pw) },
    { label: "A lowercase letter (a–z)", met: /[a-z]/.test(pw) },
    { label: "A number (0–9)", met: /[0-9]/.test(pw) },
    { label: "A special character (!@#$…)", met: /[^A-Za-z0-9]/.test(pw) },
  ];
}

/**
 * Returns the first unmet requirement as a human message, or null when the
 * password is strong enough. The single source of truth for the rules.
 */
export function passwordIssue(pw: string): string | null {
  const failed = passwordChecks(pw).find((c) => !c.met);
  return failed ? `Password must include: ${failed.label.toLowerCase()}` : null;
}

/** True when the password satisfies every requirement. */
export function isStrongPassword(pw: string): boolean {
  return passwordIssue(pw) === null;
}
