import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { respondGameInvite } from "@/server/repo";

export const runtime = "nodejs";

// The recipient accepts or rejects a game invite/request.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const { id, accept, color } = await readJson<{ id?: string; accept?: boolean; color?: string }>(req);
  if (!id) return fail("Missing invite id");
  const res = await respondGameInvite(String(id), user.id, accept === true, typeof color === "string" ? color : undefined);
  if (!res.ok) return fail(res.error ?? "Could not respond", 400);
  return ok({ ok: true, invite: res.invite });
}
