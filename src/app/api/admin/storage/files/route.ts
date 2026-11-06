import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { canAccess } from "@/lib/admin-perms";
import { listUserStorageFiles } from "@/server/repo";

export const runtime = "nodejs";

// GET ?userId=… — every stored file owned by one user (for the admin file browser).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  if (!canAccess("storage", user.adminRole, user.adminPermissions)) return fail("Storage management access required", 403);

  const userId = new URL(req.url).searchParams.get("userId");
  if (!userId) return fail("Missing userId", 400);
  const files = await listUserStorageFiles(userId);
  return ok({ files });
}
