import Link from "next/link";
import type { ReactNode } from "react";
import { getConfig } from "@/server/repo";
import { sanitizeSiteNav, defaultSiteNav, visibleFooterColumns, visibleHeaderLinks, renderCopyright } from "@/lib/site-nav";

// Shared shell for the public marketing/content pages (About, FAQ, Disclaimer,
// Blog). Public + indexable (no auth), with consistent header/nav/footer so the
// site reads as a complete, navigable site for search engines & AdSense.
// The header + footer links come from Admin → Navigation, so they always match
// the home page and can be edited with no code change.
const NAV = [
  { href: "/about", label: "About" },
  { href: "/blog", label: "Blog" },
  { href: "/faq", label: "FAQ" },
  { href: "/legal/contact", label: "Contact" },
];

export async function PublicContentShell({ children }: { children: ReactNode }) {
  const nav = sanitizeSiteNav((await getConfig()).siteNav ?? defaultSiteNav());
  const footerColumns = visibleFooterColumns(nav);
  const headerLinks = visibleHeaderLinks(nav);
  return (
    <div className="min-h-screen bg-ink-900 text-mist-200">
      <header className="border-b border-white/10 bg-ink-850/60">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Link href="/" className="font-display text-lg font-extrabold text-mist-100">
            <span className="text-lotus-300">Lotus</span> Ludo
          </Link>
          <nav className="flex flex-wrap gap-1.5">
            {NAV.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-full border border-line bg-ink-800 px-3 py-1.5 text-xs font-semibold text-mist-300 transition hover:border-lotus-400/50 hover:text-lotus-200">{l.label}</Link>
            ))}
            {headerLinks.map((l) => (
              <Link key={l.id} href={l.href} target={l.newTab ? "_blank" : undefined} className="rounded-full border border-line bg-ink-800 px-3 py-1.5 text-xs font-semibold text-mist-300 transition hover:border-lotus-400/50 hover:text-lotus-200">{l.label}</Link>
            ))}
            <Link href="/home" className="rounded-full bg-lotus-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110">Play now →</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
        <article className="prose-invert max-w-none space-y-4 text-sm leading-relaxed text-mist-300 [&_h1]:font-display [&_h1]:text-3xl [&_h1]:font-extrabold [&_h1]:text-mist-100 [&_h2]:mt-7 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-mist-100 [&_a]:text-lotus-300 [&_a]:underline [&_li]:ml-5 [&_li]:list-disc [&_p]:leading-relaxed [&_strong]:text-mist-100">
          {children}
        </article>
      </main>

      <footer className="mt-8 border-t border-white/10 bg-ink-850/40">
        <div className="mx-auto max-w-3xl px-5 py-8">
          {footerColumns.map((col) => (
            <nav key={col.id} className="mb-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-mist-400">
              {col.title && <span className="w-full font-display text-sm font-bold text-mist-200">{col.title}</span>}
              {col.links.map((l) => (
                <Link key={l.id} href={l.href} target={l.newTab ? "_blank" : undefined} className="hover:text-lotus-200">{l.label}</Link>
              ))}
            </nav>
          ))}
          <p className="mt-4 text-xs text-mist-600">{renderCopyright(nav.footer?.copyright)}</p>
        </div>
      </footer>
    </div>
  );
}

/** Render admin-authored HTML content. Content is authored in the admin panel
 *  (trusted), so inline HTML is intended here. */
export function ContentHtml({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
