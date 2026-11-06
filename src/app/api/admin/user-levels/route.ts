import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listUserLevels, adminSetUserLevel, listLevelAudit } from "@/server/repo";
import type { LevelAuditEntry } from "@/server/db";
import { clientIp } from "@/server/geo";

export const runtime = "nodejs";

// The full per-user level table + the manual-change audit trail.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const [users, audit] = await Promise.all([listUserLevels(), listLevelAudit()]);
  return ok({ users, audit });
}

// Manual level control: increase | decrease | set | reset | lock | unlock.
const ACTIONS: LevelAuditEntry["action"][] = ["increase", "decrease", "set", "reset", "lock", "unlock"];

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const b = await readJson<{ userId?: string; action?: string; value?: number; reason?: string }>(req);
  const userId = typeof b.userId === "string" ? b.userId : "";
  const action = b.action as LevelAuditEntry["action"];
  if (!userId || !ACTIONS.includes(action)) return fail("Invalid request");
  // Capture the admin's IP for the audit (same technique as user-creation).
  const ip = clientIp(req) || undefined;
  const res = await adminSetUserLevel({
    userId, action,
    value: typeof b.value === "number" ? b.value : undefined,
    reason: typeof b.reason === "string" ? b.reason : undefined,
    adminName: user.fullName, adminId: user.id, ip,
  });
  if (!res.ok) return fail(res.error ?? "Action failed", 400);
  return ok(res);
}
