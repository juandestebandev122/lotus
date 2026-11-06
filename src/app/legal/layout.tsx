import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = { title: "Legal · LotusPlay Connect" };

// Every published policy and guide, so a reader (or a reviewer) can reach all of
// them from any legal page.
const LINKS = [
  { href: "/about", label: "About" },
  { href: "/guides", label: "Guides" },
  { href: "/blog", label: "Blog" },
  { href: "/faq", label: "FAQ" },
  { href: "/legal/terms", label: "Terms & Conditions" },
  { href: "/legal/rules", label: "Rules & Regulations" },
  { href: "/legal/privacy", label: "Privacy Policy" },
  { href: "/legal/community", label: "Community Guidelines" },
  { href: "/legal/fair-play", label: "Fair Play" },
  { href: "/legal/safety-moderation", label: "Safety & Moderation" },
  { href: "/legal/reporting", label: "User Reporting" },
  { href: "/legal/responsible-gaming", label: "Responsible Gaming" },
  { href: "/legal/coin-purchase", label: "Coin Purchase" },
  { href: "/legal/refund", label: "Refund Policy" },
  { href: "/disclaimer", label: "Disclaimer" },
  { href: "/legal/contact", label: "Contact Us" },
];

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-ink-900 text-mist-200">
      <header className="border-b border-white/10 bg-ink-850/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/" className="font-display text-lg font-extrabold text-mist-100">
            <span className="text-lotus-300">Lotus</span> Connect
          </Link>
          <Link href="/home" className="text-sm text-mist-400 hover:text-mist-100">
            Back to app →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
        <nav className="mb-8 flex flex-wrap gap-2">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full border border-line bg-ink-800 px-3 py-1.5 text-xs font-semibold text-mist-300 transition hover:border-lotus-400/50 hover:text-lotus-200"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <article className="prose-invert max-w-none space-y-4 text-sm leading-relaxed text-mist-300 [&_h1]:font-display [&_h1]:text-2xl [&_h1]:font-extrabold [&_h1]:text-mist-100 [&_h2]:mt-7 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-mist-100 [&_a]:text-lotus-300 [&_a]:underline [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-mist-100">
          {children}
        </article>

        <footer className="mt-12 border-t border-white/10 pt-5 text-xs text-mist-500">
          © {new Date().getFullYear()} LotusPlay Connect. All rights reserved.
        </footer>
      </main>
    </div>
  );
}
