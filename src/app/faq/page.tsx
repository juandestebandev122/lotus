import type { Metadata } from "next";
import { getConfig } from "@/server/repo";
import { DEFAULT_SITE_CONTENT } from "@/lib/site-content-default";
import { PublicContentShell } from "@/components/PublicContentShell";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const f = (await getConfig()).siteContent?.faq ?? DEFAULT_SITE_CONTENT.faq!;
  return { title: f.seoTitle || f.title || "FAQ", description: f.seoDesc, alternates: { canonical: "/faq" } };
}

export default async function FaqPage() {
  const f = (await getConfig()).siteContent?.faq ?? DEFAULT_SITE_CONTENT.faq!;
  const items = f.items ?? [];
  return (
    <PublicContentShell>
      <h1>{f.title || "Frequently Asked Questions"}</h1>
      <div className="mt-4 space-y-3">
        {items.map((it, i) => (
          <details key={i} className="group rounded-xl border border-line bg-ink-850 p-4 [&_a]:text-lotus-300 [&_a]:underline" open={i === 0}>
            <summary className="cursor-pointer list-none font-semibold text-mist-100 marker:hidden">
              <span className="mr-2 text-lotus-300 group-open:hidden">＋</span>
              <span className="mr-2 hidden text-lotus-300 group-open:inline">－</span>
              {it.q}
            </summary>
            <p className="mt-2 pl-6 text-mist-300" dangerouslySetInnerHTML={{ __html: it.a }} />
          </details>
        ))}
        {items.length === 0 && <p className="text-mist-500">No FAQs yet.</p>}
      </div>
    </PublicContentShell>
  );
}
