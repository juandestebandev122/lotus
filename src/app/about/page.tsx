import type { Metadata } from "next";
import { getConfig } from "@/server/repo";
import { DEFAULT_SITE_CONTENT } from "@/lib/site-content-default";
import { PublicContentShell, ContentHtml } from "@/components/PublicContentShell";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const p = (await getConfig()).siteContent?.about ?? DEFAULT_SITE_CONTENT.about!;
  return { title: p.seoTitle || p.title, description: p.seoDesc, alternates: { canonical: "/about" } };
}

export default async function AboutPage() {
  const p = (await getConfig()).siteContent?.about ?? DEFAULT_SITE_CONTENT.about!;
  return (
    <PublicContentShell>
      <ContentHtml html={p.body} />
    </PublicContentShell>
  );
}
