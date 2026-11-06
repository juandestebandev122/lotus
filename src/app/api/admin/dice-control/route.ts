import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getDiceControl, saveDiceControl, emergencyDiceReset, listDiceAudit, diceRollStats } from "@/server/repo";

export const runtime = "nodejs";

// Dice Control Management — current settings + audit trail + live roll stats.
// ?range=today|week|month|all|custom (+ from=YYYY-MM-DD&to=YYYY-MM-DD for custom).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const sp = new URL(req.url).searchParams;
  const range = sp.get("range") ?? "today";
  const from = sp.get("from") ?? undefined;
  const to = sp.get("to") ?? undefined;
  const [diceControl, audit, stats] = await Promise.all([getDiceControl(), listDiceAudit(), diceRollStats({ range, from, to })]);
  return ok({ diceControl, audit, stats });
}

// Save settings / emergency controls (all audit-logged).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const body = await readJson<{ action?: string; settings?: unknown }>(req);
  switch (body.action) {
    case "save": {
      const r = await saveDiceControl(body.settings, user.fullName);
      return ok({ ok: true, diceControl: r.diceControl });
    }
    case "emergencyReset": {
      const r = await emergencyDiceReset(user.fullName, true);
      return ok({ ok: true, diceControl: r.diceControl });
    }
    case "disableCustom": {
      const cur = await getDiceControl();
      const r = await saveDiceControl({ ...cur, mode: "random" }, user.fullName);
      return ok({ ok: true, diceControl: r.diceControl });
    }
    default:
      return fail("Unknown action");
  }
}
