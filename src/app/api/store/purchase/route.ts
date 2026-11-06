import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { purchaseStoreItem } from "@/server/repo";

export const runtime = "nodejs";

// Buy a store item (background / name effect / badge) with coins. Auto-equips.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const { itemId } = await readJson<{ itemId?: string }>(req);
  if (typeof itemId !== "string" || !itemId) return fail("itemId required");
  const res = await purchaseStoreItem(user.id, itemId.slice(0, 60));
  if (!res.ok) return fail(res.error ?? "Could not buy the item", res.error?.includes("coins") ? 402 : 400);
  return ok({ balance: res.balance, expiresAt: res.expiresAt ?? null });
}
