import crypto from "node:crypto";

// ============================================================
// Cacheable business logo / cover images. Like avatars, these are stored as
// base64 data-URL images on the business record. We never embed those bytes in
// list/poll responses (they'd bloat the directory) — instead we return a SHORT,
// content-addressed URL (/api/business-image/<id>?v=<hash>) that the browser
// fetches once and caches forever (the hash changes only when the image does).
// ============================================================

function shortHash(s: string): string {
  return crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);
}

/** Cacheable URL for a business logo (empty string if none). */
export function businessLogoUrl(biz: { id?: string; logo?: string } | null | undefined): string {
  const v = biz?.logo || "";
  if (!v || !biz?.id) return "";
  if (!v.startsWith("data:")) return v; // already a plain URL — leave it
  return `/api/business-image/${biz.id}?v=${shortHash(v)}`;
}

/** Cacheable URL for a business cover image. */
export function businessCoverUrl(biz: { id?: string; cover?: string } | null | undefined): string {
  const v = biz?.cover || "";
  if (!v || !biz?.id) return "";
  if (!v.startsWith("data:")) return v;
  return `/api/business-image/${biz.id}?v=${shortHash(v)}&kind=cover`;
}

/** Cacheable URL for a business POST image (served via /api/business-post-image/<id>). */
export function businessPostImageUrl(post: { id?: string; image?: string } | null | undefined): string {
  const v = post?.image || "";
  if (!v || !post?.id) return "";
  if (!v.startsWith("data:")) return v;
  return `/api/business-post-image/${post.id}?v=${shortHash(v)}`;
}

/** Cacheable URL for a business PRODUCT image (served via /api/business-product-image/<id>). */
export function businessProductImageUrl(product: { id?: string; image?: string } | null | undefined): string {
  const v = product?.image || "";
  if (!v || !product?.id) return "";
  if (!v.startsWith("data:")) return v;
  return `/api/business-product-image/${product.id}?v=${shortHash(v)}`;
}

/** Cacheable URL for a business MEDIA (reel/video) thumbnail (served via /api/business-media-image/<id>). */
export function businessMediaThumbUrl(m: { id?: string; thumb?: string } | null | undefined): string {
  const v = m?.thumb || "";
  if (!v || !m?.id) return "";
  if (!v.startsWith("data:")) return v;
  return `/api/business-media-image/${m.id}?v=${shortHash(v)}`;
}
