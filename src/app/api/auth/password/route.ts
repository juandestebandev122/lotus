import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser, verifyPassword, setSession } from "@/server/auth";
import { setUserPassword, addAdminLog, setMustChangePassword } from "@/server/repo";
import { passwordIssue } from "@/lib/password";

export const runtime = "nodejs";

// Change the signed-in user's OWN password (works for users and admins).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);

  const body = await readJson<{ currentPassword?: string; newPassword?: string; logoutOthers?: boolean }>(req);
  const current = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const next = typeof body.newPassword === "string" ? body.newPassword : "";

  // Accounts created via Google/OTP/quick sign-in may have no password yet —
  // in that case the user is SETTING one for the first time (no current needed).
  const hasPassword = !!user.passwordHash;
  if (hasPassword) {
    if (!current) return fail("Enter your current password");
    if (!verifyPassword(current, user.passwordHash)) return fail("Your current password is incorrect", 401);
  }

  const issue = passwordIssue(next);
  if (issue) return fail(issue);
  if (hasPassword && current === next) return fail("Your new password must be different from the current one");

  const logoutOthers = body.logoutOthers === true;
  const okSet = await setUserPassword(user.id, next, { invalidateSessions: logoutOthers });
  if (!okSet) return fail("Could not update your password", 500);

  // Keep THIS device signed in after invalidating the others (fresh token).
  if (logoutOthers) await setSession(user.id);

  // Clear any admin-forced "must change password" flag now that it's done.
  if (user.mustChangePassword) await setMustChangePassword(user.id, false);

  if (user.role === "admin") await addAdminLog(user.fullName, "Changed their own password");

  return ok({ ok: true, hadPassword: hasPassword });
}
