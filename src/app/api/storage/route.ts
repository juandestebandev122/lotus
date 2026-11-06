import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { userStorageSummary, listUserStorageFiles, deleteStorageFiles } from "@/server/repo";

export const runtime = "nodejs";

// GET — the signed-in user's own storage: Used / Available / Total / % + breakdown + files.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const [summary, files] = await Promise.all([userStorageSummary(user.id), listUserStorageFiles(user.id)]);
  return ok({ ...summary, files });
}

// POST { action:"delete", names:[…] } — a user deletes their OWN files only.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const body = await readJson<{ action?: string; names?: unknown }>(req);
  if (body.action !== "delete") return fail("Unknown action", 400);
  const requested = Array.isArray(body.names) ? body.names.map(String) : [];
  if (!requested.length) return fail("No files selected", 400);
  // Only allow deleting files the user actually owns.
  const owned = new Set((await listUserStorageFiles(user.id)).map((f) => f.name));
  const names = requested.filter((n) => owned.has(n));
  if (!names.length) return fail("Those files are not yours to delete", 403);
  const r = await deleteStorageFiles(names, `${user.fullName} (self)`);
  return ok({ ok: true, ...r });
}
