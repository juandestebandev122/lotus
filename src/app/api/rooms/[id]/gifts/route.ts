import { ok } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { recentRoomGifts } from "@/server/repo";

export const runtime = "nodejs";

// Recent gifts sent inside this room (last ~12s). Every client in the room/game
// polls this so the gift animation plays ON THE RECEIVER'S avatar for everyone.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me) return ok({ gifts: [] });
  const gifts = await recentRoomGifts(id);
  return ok({ gifts });
}
