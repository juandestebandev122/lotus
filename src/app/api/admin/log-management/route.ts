import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listLogModules, listLogs, deleteLogs, getLogDeletionAudit, runLogCleanup } from "@/server/repo";

export const runtime = "nodejs";

function isSuperAdmin(role?: string): boolean { return !role || role === "super_admin"; }

// GET (no module) → module list + deletion audit; GET (module=…) → that module's rows.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const u = new URL(req.url);
  const moduleKey = u.searchParams.get("module");
  if (!moduleKey) {
    await runLogCleanup(); // opportunistic auto-cleanup when the admin opens Log Management
    return ok({ modules: await listLogModules(), audit: await getLogDeletionAudit(), superAdmin: isSuperAdmin(user.adminRole) });
  }
  const logs = await listLogs(moduleKey, {
    q: u.searchParams.get("q") || undefined,
    from: u.searchParams.get("from") || undefined,
    to: u.searchParams.get("to") || undefined,
  });
  return ok({ ...logs, superAdmin: isSuperAdmin(user.adminRole) });
}

// POST → delete logs (single / selected / all / filtered).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const body = (await readJson(req)) as Record<string, unknown>;
  const scope = body.scope;
  if (scope !== "single" && scope !== "selected" && scope !== "all" && scope !== "filtered") return fail("Invalid scope", 400);
  const res = await deleteLogs({
    key: String(body.key || ""),
    scope,
    ids: Array.isArray(body.ids) ? (body.ids as unknown[]).map(String) : undefined,
    from: body.from ? String(body.from) : undefined,
    to: body.to ? String(body.to) : undefined,
    q: body.q ? String(body.q) : undefined,
    adminName: user.fullName,
    isSuperAdmin: isSuperAdmin(user.adminRole),
  });
  if (!res.ok) return fail(res.error ?? "Failed", 400);
  return ok(res);
}
