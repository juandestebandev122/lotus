import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { contentPerformanceReport, contentItemDetail } from "@/server/repo";

export const runtime = "nodejs";

// The Content Performance report: engagement totals for Reels and Videos, the
// same totals split per category, per content type and per CREATOR, and every
// item as a row the admin can sort and export.
//
// `?id=<reelId>` returns the FULL detail for one item instead — every number
// plus who liked it, who saved it and every comment.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const detail = await contentItemDetail(id);
    return detail ? ok({ detail }) : fail("That content no longer exists", 404);
  }
  return ok(await contentPerformanceReport());
}
