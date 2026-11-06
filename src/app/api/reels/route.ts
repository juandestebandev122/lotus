import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { featureOn, listReels, createReel } from "@/server/repo";

export const runtime = "nodejs";

// TikTok's mobile "Copy link" gives a SHORT link (vm.tiktok.com / vt.tiktok.com /
// tiktok.com/t/…) that redirects to the full …/@user/video/{id} URL our embedder
// needs. Follow it once, server-side, so those links embed too. Best-effort with a
// short timeout — on any failure we keep the original link unchanged.
async function resolveShortLink(url: string): Promise<string> {
  const isTikTokShort =
    /^https?:\/\/(?:vm|vt)\.tiktok\.com\//i.test(url) ||
    /^https?:\/\/(?:www\.)?tiktok\.com\/t\//i.test(url);
  if (!isTikTokShort) return url;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(url, { method: "HEAD", redirect: "follow", signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0" } });
    clearTimeout(timer);
    return /tiktok\.com\/@[^/]+\/video\/\d+/i.test(res.url) ? res.url : url;
  } catch {
    return url;
  }
}

// GET /api/reels?tab=latest|trending|suggested|following|featured|saved&q=&offset=&limit=
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (!(await featureOn("reels"))) return ok({ reels: [], nextOffset: 0, hasMore: false, total: 0, disabled: true });
  const sp = new URL(req.url).searchParams;
  const res = await listReels(user.id, {
    tab: sp.get("tab") ?? "latest",
    q: sp.get("q") ?? "",
    businessId: sp.get("businessId") ?? undefined,
    kind: sp.get("kind") ?? undefined,
    scope: sp.get("scope") ?? undefined,
    offset: parseInt(sp.get("offset") ?? "0", 10) || 0,
    limit: parseInt(sp.get("limit") ?? "6", 10) || 6,
  });
  return ok(res);
}

// POST /api/reels — create a reel (after uploading the video via /api/reels/upload)
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (!(await featureOn("reels"))) return fail("Reels are currently turned off.", 403);
  const body = await readJson<Parameters<typeof createReel>[1]>(req);
  // Resolve a TikTok short share-link into its full URL so it embeds (no-op otherwise).
  if (body && typeof body.videoUrl === "string" && body.videoUrl.trim()) {
    body.videoUrl = await resolveShortLink(body.videoUrl.trim());
  }
  const res = await createReel(user.id, body);
  if (!res.ok) return fail(res.error ?? "Could not post the reel", 400);
  return ok(res);
}
