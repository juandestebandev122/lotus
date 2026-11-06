import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { adminGrantCosmetic, type CosmeticKind } from "@/server/repo";

export const runtime = "nodejs";

// "Give it free" — an admin hands a paid dice / board / token to one member or
// to everyone, charging nothing. Audited in the admin log; the member is told.
const KINDS: CosmeticKind[] = ["dice", "board", "token"];

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const { kind, id, target } = await readJson<{ kind?: string; id?: string; target?: string }>(req);
  if (!kind || !KINDS.includes(kind as CosmeticKind)) return fail("Which kind — dice, board or token?", 400);
  if (!id) return fail("Which item?", 400);
  if (!target || !String(target).trim()) return fail("Enter a member's name/ID, or 'all' for everyone.", 400);

  const res = await adminGrantCosmetic(String(target), kind as CosmeticKind, String(id), user.fullName);
  if (!res.ok) return fail(res.error ?? "Could not give the item", 400);
  return ok(res);
}
