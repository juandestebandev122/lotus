import type { Metadata } from "next";
import Link from "next/link";
import { getConfig } from "@/server/repo";
import { DEFAULT_SITE_CONTENT } from "@/lib/site-content-default";
import { withBase } from "@/lib/base-path";
import { PublicContentShell } from "@/components/PublicContentShell";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const seo = (await getConfig()).siteContent?.seo ?? DEFAULT_SITE_CONTENT.seo!;
  return {
    title: `Blog — ${seo.siteTitle ?? "Lotus Ludo"}`,
    description: "Guides, tips and news about Ludo, voice rooms, tournaments and playing on Lotus Ludo.",
    alternates: { canonical: "/blog" },
  };
}

export default async function BlogListPage() {
  const posts = ((await getConfig()).siteContent?.blog ?? DEFAULT_SITE_CONTENT.blog ?? [])
    .filter((p) => p.published)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <PublicContentShell>
      <h1>Lotus Ludo Blog</h1>
      <p className="text-mist-400">Guides, tips and stories about Ludo, voice rooms, tournaments and our community.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 [&_h1]:contents">
        {posts.map((p) => (
          <Link key={p.id} href={`/blog/${p.slug}`} className="block overflow-hidden rounded-2xl border border-white/10 bg-ink-850 no-underline transition hover:border-lotus-400/50">
            {p.cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={withBase(p.cover)} alt="" className="h-36 w-full object-cover" />
            )}
            <div className="p-4">
              <h2 className="!mt-0 !text-base font-bold text-mist-100">{p.title}</h2>
              <p className="mt-1 text-xs text-mist-400">{p.excerpt}</p>
              <p className="mt-2 text-[11px] text-mist-500">{p.author ? `${p.author} · ` : ""}{new Date(p.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
            </div>
          </Link>
        ))}
        {posts.length === 0 && <p className="text-mist-500">No articles published yet.</p>}
      </div>
    </PublicContentShell>
  );
}
