import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getConfig } from "@/server/repo";
import { DEFAULT_SITE_CONTENT } from "@/lib/site-content-default";
import { withBase } from "@/lib/base-path";
import { PublicContentShell, ContentHtml } from "@/components/PublicContentShell";

export const dynamic = "force-dynamic";

async function getPost(slug: string) {
  const posts = (await getConfig()).siteContent?.blog ?? DEFAULT_SITE_CONTENT.blog ?? [];
  return posts.find((p) => p.slug === slug && p.published);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPost(slug);
  if (!p) return { title: "Article not found — Lotus Ludo" };
  return { title: p.seoTitle || p.title, description: p.seoDesc || p.excerpt, alternates: { canonical: `/blog/${slug}` } };
}

export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getPost(slug);
  if (!p) notFound();
  return (
    <PublicContentShell>
      <p className="!mb-2 text-xs text-mist-500"><Link href="/blog" className="text-lotus-300">← Blog</Link></p>
      <h1>{p.title}</h1>
      <p className="!mt-1 text-xs text-mist-500">{p.author ? `${p.author} · ` : ""}{new Date(p.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
      {p.cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={withBase(p.cover)} alt="" className="mt-3 max-h-80 w-full rounded-2xl object-cover" />
      )}
      <div className="mt-4">
        <ContentHtml html={p.body} />
      </div>
      <div className="mt-8 rounded-2xl border border-lotus-400/25 bg-lotus-500/[0.06] p-5 text-center">
        <p className="!m-0 font-semibold text-mist-100">Ready to play?</p>
        <Link href="/home" className="mt-3 inline-block rounded-xl bg-lotus-600 px-5 py-2.5 text-sm font-bold text-white no-underline hover:brightness-110">Play Lotus Ludo →</Link>
      </div>
    </PublicContentShell>
  );
}
