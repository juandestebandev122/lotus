import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getRecordingContent } from "@/server/repo";

export const runtime = "nodejs";

// The captured content of a recording (chat + activity) — for review & download.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  const { id } = await params;
  const data = await getRecordingContent(id);
  if (!data) return fail("Recording not found", 404);
  return ok(data);
}
