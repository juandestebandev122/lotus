import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { uploadsForUser, trackUploadEvent } from "@/server/repo";

export const runtime = "nodejs";

// GET ?placement=home-top — the published uploads for this placement, already
// filtered by audience + schedule on the server. Works logged-out (login screen).
export async function GET(req: Request) {
  const placement = new URL(req.url).searchParams.get("placement") ?? "";
  if (!placement) return ok({ uploads: [] });
  const user = await getCurrentUser().catch(() => null);
  return ok({ uploads: await uploadsForUser(user?.id ?? null, placement) });
}

// POST {id, kind:"view"|"click"} — best-effort impression / click tracking.
export async function POST(req: Request) {
  const b = await readJson<{ id?: string; kind?: string }>(req);
  if (!b.id) return fail("id is required");
  await trackUploadEvent(b.id, b.kind === "click" ? "click" : "view");
  return ok({ ok: true });
}
