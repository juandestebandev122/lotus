import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getDB } from "@/server/db";
import { createStoreRequest, cancelStoreRequest } from "@/server/repo";

export const runtime = "nodejs";

// My own store-item requests (so the user sees their status). Newest first.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const db = await getDB();
  const mine = (db.storeRequests ?? []).filter((r) => r.userId === user.id).slice(0, 50);
  return ok({ requests: mine });
}

// Ask the admin for a new item (kind + description + optional reference image).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const b = await readJson<{ kind?: string; text?: string; image?: string }>(req);
  const res = await createStoreRequest(user.id, String(b.kind ?? "other"), String(b.text ?? ""), typeof b.image === "string" ? b.image : undefined);
  if (!res.ok) return fail(res.error ?? "Could not send the request", 400);
  return ok({ ok: true });
}

// Cancel my own pending request.
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const b = await readJson<{ id?: string }>(req);
  const res = await cancelStoreRequest(user.id, String(b.id ?? ""));
  if (!res.ok) return fail(res.error ?? "Could not cancel", 400);
  return ok({ ok: true });
}
