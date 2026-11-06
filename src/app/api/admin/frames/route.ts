import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { frameStoreReport, giftAvatarFrame, announceFrame } from "@/server/repo";

export const runtime = "nodejs";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return { error: fail("Please log in first", 401) };
  if (user.role !== "admin") return { error: fail("Administrator access required", 403) };
  return { user };
}

// Frame-store report: totals, revenue, top frames, active wearers + history
// (optional ?from=YYYY-MM-DD&to=YYYY-MM-DD date filter).
export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const url = new URL(req.url);
  const report = await frameStoreReport(url.searchParams.get("from") ?? undefined, url.searchParams.get("to") ?? undefined);
  return ok(report);
}

// action "assign": gift a frame to a specific user (free, admin-logged).
// action "announce": notify every active member about a frame.
export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const b = await readJson<{ action?: string; target?: string; frameId?: string }>(req);
  if (b.action === "assign") {
    if (!b.target || !b.frameId) return fail("target and frameId required");
    const res = await giftAvatarFrame(gate.user!.fullName, b.target, b.frameId);
    if (!res.ok) return fail(res.error ?? "Could not assign the frame", 400);
    return ok({ userName: res.userName });
  }
  if (b.action === "announce") {
    if (!b.frameId) return fail("frameId required");
    const res = await announceFrame(gate.user!.fullName, b.frameId);
    if (!res.ok) return fail(res.error ?? "Could not announce", 400);
    return ok({ notified: res.notified });
  }
  return fail("Unknown action");
}
