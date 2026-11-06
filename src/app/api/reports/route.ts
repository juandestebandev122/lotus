import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { addReport } from "@/server/repo";

export const runtime = "nodejs";

// Any logged-in user can report another user (e.g. from inside a voice room).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);

  const body = await readJson<{ reportedId?: string; category?: string; detail?: string; roomId?: string; roomName?: string }>(req);
  if (!body.reportedId) return fail("Who are you reporting?");
  if (body.reportedId === user.id) return fail("You can't report yourself");

  const res = await addReport({
    reportedId: String(body.reportedId),
    byId: user.id,
    byName: user.fullName,
    roomId: body.roomId,
    roomName: body.roomName,
    category: typeof body.category === "string" ? body.category.slice(0, 40) : "Other",
    detail: typeof body.detail === "string" ? body.detail : "",
  });
  if (!res.ok) return fail(res.error ?? "Could not submit report", 400);
  return ok({ ok: true });
}
