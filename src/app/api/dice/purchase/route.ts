import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { purchaseDice, ownedDiceIds } from "@/server/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — which paid dice this player already owns (free dice are never listed).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  return ok({ owned: await ownedDiceIds(user.id) });
}

// POST { diceId } — buy a paid dice with coins. The balance check, the deduction
// and the ownership write all happen in ONE transaction server-side, so the price
// can't be bypassed from the client and a double-tap can't double-charge.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const { diceId } = await readJson<{ diceId?: string }>(req);
  if (!diceId || typeof diceId !== "string") return fail("Which dice?", 400);

  const res = await purchaseDice(user.id, diceId);
  if (!res.ok) return fail(res.error ?? "Could not complete the purchase", 400);
  return ok({ balance: res.balance, name: res.name, price: res.price, owned: await ownedDiceIds(user.id) });
}
