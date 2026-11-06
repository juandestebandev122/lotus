import { ok, fail, readJson } from "@/server/http";
import { trackAdEvent } from "@/server/repo";

export const runtime = "nodejs";

// Public: record an advertisement impression or click (so the admin CTR numbers work).
export async function POST(req: Request) {
  const b = await readJson<{ adId?: string; type?: string }>(req);
  if (!b.adId) return fail("adId is required");
  await trackAdEvent(String(b.adId), b.type === "click" ? "click" : "impression");
  return ok({ ok: true });
}
