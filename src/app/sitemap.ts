import type { MetadataRoute } from "next";
import { getConfig } from "@/server/repo";
import { DEFAULT_SITE_CONTENT } from "@/lib/site-content-default";
import { LEGAL_DOCS } from "@/lib/legal-docs";

export const dynamic = "force-dynamic";

const BASE = "https://lotusplay.tech";

// Sitemap for search engines / AdSense — every public content page + blog post.
// The policy and guide pages come from the LEGAL_DOCS registry, so adding a page
// there puts it in the sitemap automatically and it can't be forgotten.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = (await getConfig()).siteContent?.blog ?? DEFAULT_SITE_CONTENT.blog ?? [];
  const now = new Date();

  const core = ["/", "/about", "/blog", "/faq", "/guides", "/disclaimer"];
  const docs = LEGAL_DOCS.map((d) => d.href);
  // Contact and the home page matter most for a reviewer; guides and policies next.
  const priorityOf = (p: string) => (p === "/" ? 1 : p === "/blog" || p === "/about" || p === "/guides" ? 0.8 : 0.7);

  return [
    ...core.map((p) => ({ url: `${BASE}${p}`, lastModified: now, changeFrequency: "weekly" as const, priority: priorityOf(p) })),
    ...docs.map((p) => ({ url: `${BASE}${p}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...posts
      .filter((p) => p.published)
      .map((p) => ({ url: `${BASE}/blog/${p.slug}`, lastModified: new Date(p.date), changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
