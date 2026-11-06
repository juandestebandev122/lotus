import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getConfig } from "@/server/repo";
import { getCurrentUser } from "@/server/auth";
import { withBase } from "@/lib/base-path";
import { findPageBySlug, safePageHref, type CustomPageBlock } from "@/lib/custom-pages";

// A page the admin wrote in Admin → Content Pages ("Add Content"). Everything on
// screen comes from the config, so the client can add, edit and remove pages
// without a code change — which is the whole point of the feature.
//
// Body text is rendered as PLAIN TEXT (never dangerouslySetInnerHTML), so an
// admin's typing can't inject markup into anyone's browser.

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = findPageBySlug((await getConfig()).customPages, slug);
  if (!page) return { title: "Page not found" };
  return {
    title: page.title,
    description: page.seoDescription || page.subtitle || undefined,
  };
}

export default async function CustomContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = await getConfig();
  const page = findPageBySlug(config.customPages, slug);
  if (!page) notFound();

  // A page marked "members only" sends signed-out visitors to the login screen
  // rather than quietly showing them content that wasn't meant to be public.
  if (page.requireLogin) {
    const user = await getCurrentUser();
    if (!user) redirect(`/login?next=${encodeURIComponent(`/p/${slug}`)}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-extrabold text-mist-100 sm:text-4xl">{page.title}</h1>
      {page.subtitle && <p className="mt-2 text-mist-300">{page.subtitle}</p>}

      <div className="mt-7 space-y-5">
        {(page.blocks ?? []).map((b) => <Block key={b.id} b={b} />)}
      </div>
    </div>
  );
}

function Block({ b }: { b: CustomPageBlock }) {
  const center = b.align === "center";

  if (b.kind === "divider") return <hr className="border-line" />;

  if (b.kind === "heading") {
    const text = (b.text ?? "").trim();
    if (!text) return null;
    return b.level === 3
      ? <h3 className={`font-display text-lg font-bold text-mist-100 ${center ? "text-center" : ""}`}>{text}</h3>
      : <h2 className={`font-display text-2xl font-bold text-mist-100 ${center ? "text-center" : ""}`}>{text}</h2>;
  }

  if (b.kind === "image") {
    if (!b.image) return null;
    return (
      <div className={center ? "text-center" : ""}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={withBase(b.image)}
          alt={b.text ?? ""}
          style={{ width: `${Math.max(20, Math.min(100, b.widthPct ?? 100))}%` }}
          className={`h-auto rounded-2xl border border-white/10 ${center ? "mx-auto" : ""}`}
        />
        {b.text && <p className="mt-1.5 text-xs text-mist-500">{b.text}</p>}
      </div>
    );
  }

  if (b.kind === "button") {
    const href = safePageHref(b.href);
    const label = (b.text ?? "").trim() || "Open";
    if (!href) return null;
    const cls = "inline-flex items-center gap-2 rounded-xl bg-lotus-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-lotus-400";
    return (
      <div className={center ? "text-center" : ""}>
        {href.startsWith("/")
          ? <Link href={withBase(href)} className={cls}>{label}</Link>
          : <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{label}</a>}
      </div>
    );
  }

  // Plain text — blank lines become paragraphs, so the admin's layout survives.
  const text = (b.text ?? "").trim();
  if (!text) return null;
  return (
    <div className={`space-y-3 leading-relaxed text-mist-300 ${center ? "text-center" : ""}`}>
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i} className="whitespace-pre-line">{para}</p>
      ))}
    </div>
  );
}
