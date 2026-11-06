import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { setUserTokenSkin, setUserEquippedFrame, equipStoreItem } from "@/server/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — the cosmetics saved on THIS account. The game token is stored here as
// well as in the browser, so the last token a player used comes back on a new
// phone, in a private window, or after the browser has been cleared. Without
// this the choice lived only in one browser and quietly reset to the default.
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return fail("Please log in first", 401);
  return ok({ tokenSkin: me.tokenSkin ?? "", equippedFrame: me.equippedFrame ?? "" });
}

// Save the current user's cosmetics so every OTHER player sees them too:
// - tokenSkin: the game-token design shown on the board
// - equippedFrame: the avatar frame ("" = none; ownership enforced server-side)
// - equipStore: wear/clear a store item per slot (background/nameEffect/badge)
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return fail("Please log in first", 401);
  const body = await readJson<{ tokenSkin?: string; equippedFrame?: string; equipStore?: { kind?: string; itemId?: string } }>(req);
  let did = false;
  if (typeof body.tokenSkin === "string" && body.tokenSkin) {
    await setUserTokenSkin(me.id, body.tokenSkin);
    did = true;
  }
  if (typeof body.equippedFrame === "string") {
    const res = await setUserEquippedFrame(me.id, body.equippedFrame.slice(0, 60));
    if (!res.ok) return fail(res.error ?? "Could not equip the frame", 400);
    did = true;
  }
  if (body.equipStore && typeof body.equipStore === "object") {
    const kind = String(body.equipStore.kind ?? "");
    // "dice" / "board" / "token" are game cosmetics sold through the same store.
    const SLOTS = ["background", "nameEffect", "badge", "overlay", "dice", "board", "token"];
    if (!SLOTS.includes(kind)) return fail("Unknown store slot");
    const res = await equipStoreItem(me.id, kind, String(body.equipStore.itemId ?? "").slice(0, 60));
    if (!res.ok) return fail(res.error ?? "Could not equip the item", 400);
    did = true;
  }
  if (!did) return fail("Nothing to save");
  return ok({ ok: true });
}
