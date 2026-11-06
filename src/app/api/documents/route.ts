import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listDocRequests, submitDocResponse, notifyAdmins, getUpload } from "@/server/repo";

export const runtime = "nodejs";

// A user's own document requests.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  return ok({ requests: await listDocRequests(user.id) });
}

// User uploads / submits a file in response to a request.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);

  const body = await readJson<{ id?: string; name?: string; url?: string; originalName?: string; comment?: string }>(req);
  if (!body.id || !body.name) return fail("A request and an uploaded file are required");

  // Make sure the uploaded file belongs to this user.
  const rec = await getUpload(String(body.name));
  if (!rec || rec.ownerId !== user.id) return fail("That file is invalid — please re-upload");

  const res = await submitDocResponse(String(body.id), user.id, {
    name: rec.name,
    url: `/api/file/${rec.name}`,
    originalName: rec.originalName,
    comment: typeof body.comment === "string" ? body.comment.slice(0, 400) : undefined,
    at: new Date().toISOString(),
  });
  if (!res.ok) return fail(res.error ?? "Could not submit document", 400);

  await notifyAdmins(`📄 ${user.fullName} submitted a requested document.`, { label: "Review", href: "/admin/documents" });
  return ok({ ok: true });
}
