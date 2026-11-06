import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getDB } from "@/server/db";
import { decideStoreRequest, adminGrantStoreItem } from "@/server/repo";

export const runtime = "nodejs";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return { error: fail("Please log in first", 401) };
  if (user.role !== "admin") return { error: fail("Administrator access required", 403) };
  return { user };
}

// Store admin data: user item-requests + recent non-frame purchase history.
export async function GET() {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const db = await getDB();
  return ok({
    requests: (db.storeRequests ?? []).slice(0, 200),
    history: (db.framePurchases ?? []).filter((p) => p.kind && p.kind !== "frame").slice(0, 300),
  });
}

// Approve / reject a user's item request (the user is notified).
export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const b = await readJson<{ requestId?: string; decision?: string; note?: string; action?: string; itemId?: string; target?: string }>(req);
  // Grant a store item to a user (or all users), free of charge.
  if (b.action === "assign") {
    if (!b.itemId || !b.target) return fail("itemId and target required");
    const res = await adminGrantStoreItem(String(b.target), String(b.itemId), gate.user!.fullName);
    if (!res.ok) return fail(res.error ?? "Could not assign", 400);
    return ok({ ok: true, count: res.count });
  }
  if (!b.requestId || (b.decision !== "approved" && b.decision !== "rejected" && b.decision !== "completed")) return fail("requestId and decision required");
  const res = await decideStoreRequest(gate.user!.fullName, String(b.requestId), b.decision, b.note);
  if (!res.ok) return fail(res.error ?? "Could not decide", 400);
  return ok({ ok: true });
}
