import type { Metadata } from "next";
import { getConfig } from "@/server/repo";
import { DEFAULT_SITE_CONTENT } from "@/lib/site-content-default";
import { PublicContentShell, ContentHtml } from "@/components/PublicContentShell";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const p = (await getConfig()).siteContent?.disclaimer ?? DEFAULT_SITE_CONTENT.disclaimer!;
  return { title: p.seoTitle || p.title, description: p.seoDesc, alternates: { canonical: "/disclaimer" } };
}

export default async function DisclaimerPage() {
  const p = (await getConfig()).siteContent?.disclaimer ?? DEFAULT_SITE_CONTENT.disclaimer!;
  return (
    <PublicContentShell>
      <ContentHtml html={p.body} />
    </PublicContentShell>
  );
}
