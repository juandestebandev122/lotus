import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { submitAgencyRequest } from "@/server/repo";

export const runtime = "nodejs";

// A registered user submits an Agency Request → lands in Pending Approval.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const b = await readJson<Record<string, unknown>>(req);
  if (typeof b.name !== "string" || !b.name.trim()) return fail("Agency name is required");
  // Only keep a logo when it's an uploaded image data-URL.
  const logo = typeof b.logo === "string" && b.logo.startsWith("data:image/") ? b.logo : undefined;
  const res = await submitAgencyRequest(user.id, { ...b, logo });
  if (!res.ok) return fail(res.error ?? "Could not submit your agency request", 400);
  return ok({ agency: res.agency }, 201);
}
