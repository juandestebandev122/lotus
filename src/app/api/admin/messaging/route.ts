import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listUploadAudit, pruneOldDms, adminDeleteUpload } from "@/server/repo";

export const runtime = "nodejs";

// The uploaded-file audit trail for the Messaging Controls page. Config edits go
// through the shared /api/admin/config route (config.messaging sanitizer).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  await pruneOldDms(); // honour the admin's message-retention window
  return ok({ uploads: await listUploadAudit(300) });
}

// Admin actions on an uploaded file. action: "deleteUpload" (remove from index + disk).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const b = await readJson<{ action?: string; name?: string }>(req);
  if (b.action === "deleteUpload") {
    const name = typeof b.name === "string" ? b.name : "";
    if (!name) return fail("Missing file");
    const res = await adminDeleteUpload(name, user.fullName);
    if (!res.ok) return fail(res.error ?? "Could not delete", 400);
    return ok({ ok: true });
  }
  return fail("Invalid request");
}
