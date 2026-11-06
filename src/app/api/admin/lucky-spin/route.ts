import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listSpinChanceLog, adminAdjustSpinChances, findById, findByUsername, addAdminLog } from "@/server/repo";

export const runtime = "nodejs";

type Action = "add" | "remove" | "set" | "reset" | "enable" | "disable";
const ACTIONS: Action[] = ["add", "remove", "set", "reset", "enable", "disable"];

// Admin: the extra-chance transaction log (earned / used / expired / reset).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  return ok({ log: await listSpinChanceLog() });
}

// Admin: add / remove / set / reset / enable / disable a user's extra chances.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const b = await readJson<{ user?: string; action?: string; amount?: number }>(req);
  const action = b.action as Action;
  if (!ACTIONS.includes(action)) return fail("Invalid action");

  const raw = String(b.user ?? "").trim().replace(/^@/, "");
  if (!raw) return fail("Enter a username or user ID");
  const target = (await findById(raw)) ?? (await findByUsername(raw.toLowerCase()));
  if (!target) return fail("User not found — enter a valid username or ID", 404);

  const res = await adminAdjustSpinChances(target.id, action, Math.max(0, Math.floor(Number(b.amount) || 0)), user.fullName);
  if (!res.ok) return fail(res.error ?? "Could not update", 400);
  await addAdminLog(user.fullName, `Lucky Spin chances: ${action}${b.amount ? ` ${b.amount}` : ""} → ${target.fullName}`);
  return ok({ ...res, targetName: target.fullName });
}
