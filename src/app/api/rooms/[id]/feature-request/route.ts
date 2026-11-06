import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { createFeatureRequest, listMyFeatureRequests } from "@/server/repo";

export const runtime = "nodejs";

// The room's host/co-host requests a paid feature (room name change / video
// unlock). Coins are charged now and refunded if an admin rejects it.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me) return fail("Please log in first", 401);
  const body = await readJson<{ type?: string; newName?: string; reason?: string; comments?: string }>(req);
  const type = body.type === "video" ? "video" : body.type === "room_name" ? "room_name" : body.type === "cohost" ? "cohost" : body.type === "group_deletion" ? "group_deletion" : null;
  if (!type) return fail("Unknown feature");
  // For a group-deletion request the payload is "reason|||comments".
  const payload = type === "group_deletion" ? `${(body.reason ?? "").trim()}|||${(body.comments ?? "").trim()}` : body.newName;
  // [id] is already the full room id (e.g. "room_xxxx") — do not re-prefix.
  const res = await createFeatureRequest({ type, userId: me.id, roomId: id, payload });
  if (!res.ok) return fail(res.error ?? "Could not submit request", res.error === "Insufficient coins" || (res.error ?? "").startsWith("Insufficient") ? 402 : 400);
  return ok({ ok: true, balance: res.balance, request: res.request });
}

// The current user's requests (so the room can show "pending approval").
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me) return ok({ requests: [] });
  const all = await listMyFeatureRequests(me.id);
  return ok({ requests: all.filter((r) => r.roomId === id) });
}
