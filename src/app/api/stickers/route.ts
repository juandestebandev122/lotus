import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listEnabledStickersGrouped } from "@/server/repo";

export const runtime = "nodejs";

// Enabled stickers grouped by category, for the in-room sticker picker.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  return ok({ groups: await listEnabledStickersGrouped() });
}
