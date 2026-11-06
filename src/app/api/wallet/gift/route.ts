import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { spendCoins, sendGift, getConfig } from "@/server/repo";
import { giftById } from "@/lib/gifts";

export const runtime = "nodejs";

// Send a gift to a player. The gift is delivered to the recipient's profile
// (and they get a notification); the cost is deducted from the sender. Only
// charges when a real recipient is found, so coins aren't lost on undelivered
// gifts. Falls back to a plain coin-spend if no giftId/toName is supplied.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);

  const body = await readJson<{ giftId?: string; toName?: string; toId?: string; context?: string; roomId?: string; coins?: number; description?: string }>(req);

  // New flow: deliver a real gift to a named player.
  if (body.giftId && body.toName) {
    // Resolve the gift from the ADMIN-CONFIGURED catalog (config.giftCatalog)
    // FIRST — that's the price the admin set and the price the user sees. Only
    // fall back to the built-in default catalog if the admin catalog is empty.
    // (Previously we always used the hard-coded default cost, so an admin price
    // change showed on screen but the CHARGE still used the old value.)
    const cfg = await getConfig();
    const fromCatalog = (cfg.giftCatalog ?? []).find((g) => g.id === String(body.giftId));
    if (fromCatalog && fromCatalog.active === false) return fail("This gift is currently unavailable.");
    const gift = fromCatalog ?? giftById(String(body.giftId));
    if (!gift) return fail("Unknown gift");
    const res = await sendGift({
      fromId: user.id,
      fromName: user.fullName,
      toName: String(body.toName),
      toId: typeof body.toId === "string" ? body.toId : undefined,
      gift: { id: gift.id, emoji: gift.emoji, name: gift.name, cost: gift.cost },
      context: typeof body.context === "string" ? body.context : undefined,
      roomId: typeof body.roomId === "string" ? body.roomId : undefined,
    });
    if (!res.ok) {
      const code = res.error === "Insufficient coins" ? 402 : res.error === "Recipient not found" ? 404 : 400;
      return fail(res.error ?? "Could not send gift", code);
    }
    return ok({ ok: true, balance: res.balance, delivered: res.delivered, recipientName: res.recipientName, receiverShare: res.receiverShare, companyShare: res.companyShare });
  }

  // Legacy flow: plain coin deduction (kept for backward compatibility).
  const coins = Math.max(0, Math.floor(Number(body.coins) || 0));
  if (!coins) return fail("Invalid gift amount");
  const description = typeof body.description === "string" ? body.description.slice(0, 80) : "Gift";
  const res = await spendCoins(user.id, user.fullName, coins, description);
  if (!res.ok) return fail(res.error ?? "Could not send gift", res.error === "Insufficient coins" ? 402 : 400);
  return ok({ ok: true, balance: res.balance });
}
