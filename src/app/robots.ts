import type { MetadataRoute } from "next";

const BASE = "https://lotusplay.tech";

// Allow indexing of the public site; point crawlers to the sitemap.
//
// Note on `allow`: listing paths explicitly alongside `allow: "/"` is harmless
// but redundant, and an incomplete list reads as if everything else is off
// limits. We allow everything and then disallow the parts that genuinely should
// not be crawled — the API, the admin panel, and the signed-in app shell (which
// requires a login, so a crawler only ever sees an empty screen there).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/admin/",
          // Signed-in app areas: nothing useful for a crawler, and indexing them
          // produces thin "please log in" pages that hurt the site's rating.
          "/wallet",
          "/messages",
          "/notifications",
          "/settings",
          "/profile",
          "/my-storage",
          "/documents",
          "/watch",
          "/support",
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
