import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listAdminUsers, createAdminUser, updateUser, deleteUser, findById, getConfig, addAdminLog } from "@/server/repo";
import type { UserRecord } from "@/server/db";
import { ROLE_DEFAULT_PERMS, type AdminRole } from "@/lib/admin-perms";

export const runtime = "nodejs";

function isSuper(u: UserRecord): boolean {
  return !u.adminRole || u.adminRole === "super_admin";
}
function roleOf(u: UserRecord): AdminRole {
  return (u.adminRole as AdminRole) ?? "super_admin";
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const config = await getConfig();
  const admins = (await listAdminUsers()).map((u) => ({
    id: u.id,
    fullName: u.fullName,
    email: u.email ?? "",
    role: roleOf(u),
    permissions: isSuper(u) ? ROLE_DEFAULT_PERMS.super_admin : u.adminPermissions ?? ROLE_DEFAULT_PERMS[roleOf(u)],
    accountStatus: u.accountStatus ?? "active",
    lastSeen: u.lastSeen ?? "",
    lastIp: u.lastIp ?? "",
    createdAt: u.createdAt ?? u.joinedAt ?? "",
    isSelf: u.id === user.id,
  }));
  const activeAdmins = admins.filter((a) => a.accountStatus === "active").length;
  return ok({ admins, count: admins.length, activeAdmins, limit: config.adminLimit });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin" || !isSuper(user)) return fail("Only a Super Admin can add admins", 403);

  const config = await getConfig();
  const current = (await listAdminUsers()).length;
  // Only enforce when a positive limit is configured and genuinely reached.
  if (config.adminLimit > 0 && current >= config.adminLimit) {
    return fail(`Admin limit reached (${current}/${config.adminLimit}). Raise the maximum first.`, 400);
  }

  const body = await readJson(req);
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const roleStr = String(body.adminRole);
  const adminRole = (["super_admin", "admin", "moderator", "support"].includes(roleStr) ? roleStr : "admin") as AdminRole;
  const permissions = Array.isArray(body.permissions) ? (body.permissions as string[]) : ROLE_DEFAULT_PERMS[adminRole];
  if (!fullName) return fail("Name is required");
  if (!email.includes("@")) return fail("A valid email is required");
  if (password.length < 6) return fail("Password must be at least 6 characters");

  const res = await createAdminUser({
    fullName, email, password, adminRole, permissions,
    creator: { id: user.id, name: user.fullName, role: isSuper(user) ? "Super Admin" : (user.adminRole ?? "Admin") },
  });
  if (!res.ok) return fail(res.error ?? "Could not create admin", 400);
  return ok({ ok: true }, 201);
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin" || !isSuper(user)) return fail("Only a Super Admin can manage admins", 403);

  const body = await readJson(req);
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return fail("Admin id is required");
  if (id === user.id && (body.accountStatus && body.accountStatus !== "active")) {
    return fail("You can't deactivate your own account");
  }

  const patch: Partial<UserRecord> = {};
  const roleStr = String(body.adminRole);
  const statusStr = String(body.accountStatus);
  if (["super_admin", "admin", "moderator", "support"].includes(roleStr)) patch.adminRole = roleStr as UserRecord["adminRole"];
  if (Array.isArray(body.permissions)) patch.adminPermissions = body.permissions as string[];
  if (["active", "inactive", "suspended"].includes(statusStr)) patch.accountStatus = statusStr as UserRecord["accountStatus"];
  if (Object.keys(patch).length === 0) return fail("Nothing to update");

  const updated = await updateUser(id, patch);
  if (!updated) return fail("Admin not found", 404);
  await addAdminLog(user.fullName, `Updated admin ${updated.fullName}: ${JSON.stringify(patch)}`);
  return ok({ ok: true });
}

// Super Admin permanently deletes another admin account.
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin" || !isSuper(user)) return fail("Only a Super Admin can delete admins", 403);

  const { id } = await readJson<{ id?: string }>(req);
  if (!id) return fail("Admin id is required");
  if (id === user.id) return fail("You can't delete your own account");
  const target = await findById(id);
  if (!target) return fail("Admin not found", 404);

  await deleteUser(id, { reason: "Admin account removed", adminName: user.fullName, adminId: user.id });
  await addAdminLog(user.fullName, `Deleted admin ${target.fullName}`);
  return ok({ ok: true });
}
