import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { purchaseCosmetic, ownedCosmetics, type CosmeticKind } from "@/server/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The GAME COSMETICS shop: dice, boards and tokens.
// The price lives on the design itself (set in its own admin page), so giving a
// design a price is all it takes to put it on sale — there is no separate store
// item to create and keep in step.

const KINDS: CosmeticKind[] = ["dice", "board", "token"];

// GET — everything this player owns, per kind. Free designs are never listed:
// they need no ownership.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  return ok({ owned: await ownedCosmetics(user.id) });
}

// POST { kind, id } — buy one with coins. The balance check, the deduction and
// the ownership write all happen in ONE transaction server-side.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const { kind, id } = await readJson<{ kind?: string; id?: string }>(req);
  if (!kind || !KINDS.includes(kind as CosmeticKind)) return fail("Which kind — dice, board or token?", 400);
  if (!id || typeof id !== "string") return fail("Which item?", 400);

  const res = await purchaseCosmetic(user.id, kind as CosmeticKind, id);
  if (!res.ok) return fail(res.error ?? "Could not complete the purchase", 400);
  return ok({ balance: res.balance, name: res.name, price: res.price, owned: await ownedCosmetics(user.id) });
}
