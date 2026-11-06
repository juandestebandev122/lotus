import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listCustomUploads, saveCustomUpload, setCustomUploadStatus, duplicateCustomUpload, deleteCustomUpload } from "@/server/repo";
import type { CustomUpload } from "@/server/db";

export const runtime = "nodejs";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return { error: fail("Please log in first", 401) };
  if (user.role !== "admin") return { error: fail("Administrator access required", 403) };
  return { user };
}

// GET — every custom upload (admin management view).
export async function GET() {
  const a = await requireAdmin();
  if (a.error) return a.error;
  return ok({ uploads: await listCustomUploads() });
}

// POST — create/update an upload, or a sub-action (status / duplicate).
export async function POST(req: Request) {
  const a = await requireAdmin();
  if (a.error) return a.error;
  const b = await readJson<{ action?: string; id?: string; status?: CustomUpload["status"] } & Partial<CustomUpload>>(req);

  if (b.action === "status") {
    if (!b.id || !b.status) return fail("id and status are required");
    const r = await setCustomUploadStatus(b.id, b.status, a.user!.fullName);
    return r.ok ? ok(r) : fail(r.error ?? "Could not update", 400);
  }
  if (b.action === "duplicate") {
    if (!b.id) return fail("id is required");
    const r = await duplicateCustomUpload(b.id, a.user!.fullName);
    return r.ok ? ok(r) : fail(r.error ?? "Could not duplicate", 400);
  }
  const r = await saveCustomUpload(b, a.user!.fullName);
  return r.ok ? ok(r) : fail(r.error ?? "Could not save", 400);
}

// DELETE — remove an upload permanently (?id= or JSON {id}).
export async function DELETE(req: Request) {
  const a = await requireAdmin();
  if (a.error) return a.error;
  const url = new URL(req.url);
  let id = url.searchParams.get("id") ?? "";
  if (!id) { const b = await readJson<{ id?: string }>(req); id = b.id ?? ""; }
  if (!id) return fail("id is required");
  const r = await deleteCustomUpload(id, a.user!.fullName);
  return r.ok ? ok(r) : fail(r.error ?? "Could not delete", 400);
}
