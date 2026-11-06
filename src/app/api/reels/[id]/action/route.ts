import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { toggleReelLike, toggleReelSave, addReelComment, shareReel, incrReelView, reportReel, addReelWatch } from "@/server/repo";

export const runtime = "nodejs";

// POST /api/reels/[id]/action — { action: like|save|comment|share|view|report, ... }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const body = await readJson<{ action?: string; text?: string; category?: string; detail?: string; seconds?: number }>(req);

  switch (body.action) {
    case "like":
      return ok(await toggleReelLike(user.id, id));
    case "save":
      return ok(await toggleReelSave(user.id, id));
    case "watch":
      await addReelWatch(id, Number(body.seconds) || 0);
      return ok({ ok: true });
    case "comment": {
      const res = await addReelComment(user.id, id, body.text ?? "");
      if (!res.ok) return fail(res.error ?? "Could not comment", 400);
      return ok(res);
    }
    case "share":
      return ok(await shareReel(user.id, id));
    case "view":
      return ok(await incrReelView(id, user.id));
    case "report": {
      const res = await reportReel(user.id, id, body.category ?? "Reel", body.detail ?? "");
      if (!res.ok) return fail(res.error ?? "Could not report", 400);
      return ok({ ok: true });
    }
    default:
      return fail("Unknown action", 400);
  }
}
