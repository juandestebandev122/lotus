import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listAllUsers, updateUser, deleteUser, addAdminLog, setUserPassword, findById, adminCreateUser, coinTotalsByUser, agencyOfUser, clearFailedLogins, adminSetUserReferredBy, duplicateNameError } from "@/server/repo";
import { getDB } from "@/server/db";
import { avatarUrl } from "@/server/avatar";
import { clientIp } from "@/server/geo";
import { passwordIssue } from "@/lib/password";

export const runtime = "nodejs";

function isSuperAdmin(role?: string): boolean {
  return !role || role === "super_admin";
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const totals = await coinTotalsByUser();
  const db = await getDB();
  const users = (await listAllUsers()).map((u) => {
    const ag = agencyOfUser(db, u.id);
    return {
    id: u.id,
    publicId: u.publicId ?? "",
    fullName: u.fullName,
    username: u.username,
    avatar: avatarUrl(u),
    email: u.email ?? "",
    phone: u.phone ?? "",
    role: u.role,
    adminRole: u.adminRole,
    verified: !!u.verified,
    status: u.status,
    accountStatus: u.accountStatus ?? "active",
    mustChangePassword: !!u.mustChangePassword,
    walletFrozen: !!u.walletFrozen,
    messagingDisabled: !!u.dmDisabled,
    coins: u.coins,
    coinsPurchased: totals[u.id]?.purchased ?? 0,
    coinsSpent: totals[u.id]?.spent ?? 0,
    level: u.level,
    xp: u.xp ?? 0,
    joinedAt: u.joinedAt,
    lastSeen: u.lastSeen ?? "",
    // Temporary login lock ("too many failed attempts") — for the Reset button.
    locked: !!(u.lockedUntil && u.lockedUntil > Date.now()),
    lockMinutes: u.lockedUntil && u.lockedUntil > Date.now() ? Math.ceil((u.lockedUntil - Date.now()) / 60000) : 0,
    stats: u.stats,
    // Provenance (fall back to "self" for accounts created before this was tracked).
    createdVia: u.createdVia ?? "self",
    createdByName: u.createdByName ?? (u.createdVia && u.createdVia !== "self" ? "" : "Self"),
    createdById: u.createdById ?? "",
    createdByRole: u.createdByRole ?? "",
    createdAt: u.createdAt ?? "",
    createdIp: u.createdIp ?? "",
    // Agency membership (for the Users list "Agency" column + filter).
    agencyName: ag?.name ?? "",
    agencyId: ag?.agencyId ?? "",
    agencyRole: ag?.role ?? "",
    // Refer-a-friend: who invited this user (live name; falls back to the name
    // snapshot on the referral record if the referrer was later deleted).
    referredById: u.referredBy ?? "",
    referredByName: u.referredBy
      ? (db.users.find((x) => x.id === u.referredBy)?.fullName
        ?? (db.referrals ?? []).find((r) => r.referredId === u.id)?.referrerName
        ?? "")
      : ((db.referrals ?? []).find((r) => r.referredId === u.id)?.referrerName ?? ""),
    // How many groups/rooms this member has joined (deduped).
    groupCount: new Set((u.joinedRoomIds ?? []).filter(Boolean)).size,
  };
  });
  return ok({ users });
}

// Create a new user / sub-admin (admin action).
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return fail("Please log in first", 401);
  if (me.role !== "admin") return fail("Administrator access required", 403);

  const body = await readJson<{
    fullName?: string; username?: string; password?: string;
    email?: string; phone?: string; role?: string; accountStatus?: string;
    mustChangePassword?: boolean; avatar?: string;
  }>(req);

  const fullName = (body.fullName ?? "").trim();
  const username = (body.username ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const email = (body.email ?? "").trim();
  const phone = (body.phone ?? "").trim();
  const role = (["user", "moderator", "admin"].includes(String(body.role)) ? body.role : "user") as "user" | "moderator" | "admin";

  if (!fullName) return fail("Full name is required");
  if (!/^[a-z0-9._]{3,20}$/.test(username)) return fail("Username must be 3–20 chars (letters, numbers, . or _)");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Enter a valid email address");
  if (phone && phone.replace(/\D/g, "").length < 10) return fail("Enter a valid mobile number");
  // Only a Super Admin may mint admin/moderator accounts.
  if ((role === "admin" || role === "moderator") && !isSuperAdmin(me.adminRole)) return fail("Only a Super Admin can create admin/moderator accounts", 403);
  const issue = passwordIssue(password);
  if (issue) return fail(issue);
  // Optional profile picture — accept a reasonably-sized data URL only.
  const avatar = typeof body.avatar === "string" && body.avatar.startsWith("data:image/") && body.avatar.length < 3_000_000 ? body.avatar : undefined;

  const createdIp = clientIp(req) || undefined;
  const creatorRole = isSuperAdmin(me.adminRole) ? "Super Admin" : me.adminRole ? me.adminRole.replace("_", " ") : "Admin";
  const res = await adminCreateUser({
    fullName, username, password, email: email || undefined, phone: phone || undefined,
    role, accountStatus: (body.accountStatus === "inactive" ? "inactive" : "active"),
    mustChangePassword: body.mustChangePassword === true, avatar,
    // Provenance — record WHO (this admin) created the account. adminCreateUser
    // writes the audit-log entry, so we don't double-log here.
    createdVia: "admin", creator: { id: me.id, name: me.fullName, role: creatorRole }, createdIp,
  });
  if (!res.ok) return fail(res.error ?? "Could not create user", 400);
  return ok({ ok: true, id: res.id }, 201);
}

// Delete a user account (admins cannot delete other admins or themselves).
export async function DELETE(req: Request) {
  const me = await getCurrentUser();
  if (!me) return fail("Please log in first", 401);
  if (me.role !== "admin") return fail("Administrator access required", 403);

  const { id, reason } = await readJson<{ id?: string; reason?: string }>(req);
  if (!id) return fail("User id is required");
  if (id === me.id) return fail("You cannot delete your own account");
  // A deletion reason is REQUIRED and stored permanently in the Deleted Users log.
  const why = (reason ?? "").trim();
  if (!why) return fail("Please provide a reason for deleting this user.");

  const target = await findById(id);
  if (!target) return fail("User not found", 404);
  if (target.role === "admin") return fail("Admin accounts cannot be deleted here", 403);

  const okDel = await deleteUser(id, { reason: why, adminName: me.fullName, adminId: me.id });
  if (okDel) await addAdminLog(me.fullName, `Deleted user ${target.fullName} (${id}) — reason: ${why}`);
  return okDel ? ok({ ok: true }) : fail("Could not delete user", 500);
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const body = await readJson(req);
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return fail("User id is required");

  // Super-Admin password reset for any user or admin.
  if (typeof body.newPassword === "string") {
    if (!isSuperAdmin(user.adminRole)) return fail("Only a Super Admin can reset passwords", 403);
    const issue = passwordIssue(body.newPassword);
    if (issue) return fail(issue);
    const target = await findById(id);
    if (!target) return fail("User not found", 404);
    await setUserPassword(id, body.newPassword, { invalidateSessions: true });
    await addAdminLog(user.fullName, `Reset password for ${target.fullName} (@${target.username})`);
    return ok({ ok: true });
  }

  // Clear a user's temporary login lock ("Too many failed attempts") immediately,
  // without waiting for the timer. Recorded in the admin activity log.
  if (body.resetLock === true) {
    const target = await findById(id);
    if (!target) return fail("User not found", 404);
    await clearFailedLogins(id);
    await addAdminLog(user.fullName, `Cleared login lock (too-many-attempts) for ${target.fullName} (@${target.username}, ID ${target.publicId ?? target.id})`);
    return ok({ ok: true });
  }

  // Reset a user's profile picture + cover — used to clear an oversized/corrupt
  // image that was preventing their profile from being viewed. Falls back to
  // initials afterwards.
  if (body.clearMedia === true) {
    const target = await findById(id);
    if (!target) return fail("User not found", 404);
    await updateUser(id, { avatar: "", cover: "" });
    await addAdminLog(user.fullName, `Reset profile & cover image for ${target.fullName} (@${target.username})`);
    return ok({ ok: true });
  }

  // Admin manually sets / clears who REFERRED this user (mirrors agency assignment).
  // body.referredBy = a referrer's userId to assign, or "" to clear. Records the
  // relationship only (shown in the Users list + profile); never pays the referrer.
  if (body.action === "setReferredBy") {
    const refId = typeof body.referredBy === "string" ? body.referredBy.trim() : "";
    const res = await adminSetUserReferredBy(id, refId);
    if (!res.ok) return fail(res.error ?? "Could not update referral", 400);
    const target = await findById(id);
    const referrer = refId ? await findById(refId) : null;
    await addAdminLog(user.fullName, refId
      ? `Set referred-by for ${target?.fullName ?? id} → ${referrer?.fullName ?? refId} (@${referrer?.username ?? refId})`
      : `Cleared referred-by for ${target?.fullName ?? id}`);
    return ok({ ok: true });
  }

  const patch: Record<string, unknown> = {};
  if (body.role === "user" || body.role === "moderator" || body.role === "admin") patch.role = body.role;
  if (typeof body.verified === "boolean") patch.verified = body.verified;
  if (typeof body.mustChangePassword === "boolean") patch.mustChangePassword = body.mustChangePassword;
  if (typeof body.dmDisabled === "boolean") patch.dmDisabled = body.dmDisabled;
  // Edit basic profile fields.
  if (typeof body.fullName === "string" && body.fullName.trim()) {
    patch.fullName = body.fullName.trim().slice(0, 60);
    const nameErr = await duplicateNameError("user", patch.fullName as string, { excludeId: id, currentName: (await findById(id))?.fullName });
    if (nameErr) return fail(nameErr, 409);
  }
  if (typeof body.email === "string") {
    const e = body.email.trim().toLowerCase();
    if (e && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return fail("Enter a valid email address");
    patch.email = e || undefined;
  }
  if (typeof body.phone === "string") {
    const p = body.phone.trim();
    if (p && p.replace(/\D/g, "").length < 10) return fail("Enter a valid mobile number");
    patch.phone = p || undefined;
  }
  if (
    body.accountStatus === "active" ||
    body.accountStatus === "inactive" ||
    body.accountStatus === "suspended" ||
    body.accountStatus === "blocked" ||
    body.accountStatus === "banned"
  ) {
    patch.accountStatus = body.accountStatus;
  }
  if (Object.keys(patch).length === 0) return fail("Nothing to update");

  const updated = await updateUser(id, patch);
  if (!updated) return fail("User not found", 404);
  await addAdminLog(user.fullName, `Updated user ${updated.fullName}: ${Object.keys(patch).join(", ")}`);
  return ok({ ok: true });
}
