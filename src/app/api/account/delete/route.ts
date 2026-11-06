import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser, verifyPassword, clearSession } from "@/server/auth";
import { deleteUser } from "@/server/repo";

export const runtime = "nodejs";

// A user permanently deletes THEIR OWN account (self-service, required for app
// stores). The account is archived (a Super Admin can restore it if needed) and
// removed from active use, then the session is cleared. Password re-entry is
// required for accounts that have one (safety against a borrowed unlocked phone).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  // Admin accounts are managed from the Admin Panel, not self-deleted here.
  if (user.role === "admin") return fail("Administrator accounts can't be deleted from here.", 403);

  const { password } = await readJson<{ password?: string }>(req);
  // Require the current password when the account has one. OTP/Google-only
  // accounts (no password set) can delete with just the on-screen confirmation.
  if (user.passwordHash && !verifyPassword(password ?? "", user.passwordHash)) {
    return fail("Incorrect password. Please enter your current password to delete your account.", 401);
  }

  await deleteUser(user.id, { reason: "Self-service account deletion", adminName: user.fullName, adminId: user.id });
  await clearSession();
  return ok({ deleted: true });
}
