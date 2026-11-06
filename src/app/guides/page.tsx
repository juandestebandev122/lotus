import type { Metadata } from "next";
import Link from "next/link";
import { PublicContentShell } from "@/components/PublicContentShell";
import { sharedLegalDocs } from "@/lib/legal-docs";

export const metadata: Metadata = {
  title: "Guides · Lotus Ludo",
  description: "Learn how to play Ludo, read the full Ludo rules, and understand how Lotus Ludo tournaments work.",
  alternates: { canonical: "https://lotusplay.tech/guides" },
};

export default function GuidesIndexPage() {
  const guides = sharedLegalDocs("guide");
  return (
    <PublicContentShell>
      <h1>Guides</h1>
      <p className="text-mist-400">
        Everything you need to play well on Lotus Ludo — from your very first game to competing in
        tournaments.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {guides.map((g) => (
          <Link
            key={g.slug}
            href={g.href}
            className="block rounded-2xl border border-white/10 bg-ink-850 p-4 no-underline transition hover:border-lotus-400/50"
          >
            <h2 className="!mt-0 !text-base font-bold text-mist-100">{g.title}</h2>
            <p className="mt-1 text-xs text-mist-400">{g.description}</p>
          </Link>
        ))}
      </div>

      <h2>More reading</h2>
      <ul>
        <li><Link href="/blog">The Lotus Ludo blog</Link> — strategy, safety and community articles.</li>
        <li><Link href="/faq">Frequently asked questions</Link>.</li>
        <li><Link href="/legal/fair-play">Fair Play Policy</Link> — how we keep games honest.</li>
        <li><Link href="/legal/community">Community Guidelines</Link> — the rules everyone plays by.</li>
      </ul>
    </PublicContentShell>
  );
}
