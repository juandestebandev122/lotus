import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalDoc } from "@/components/legal/LegalDoc";
import { PolicyBody } from "@/components/legal/PolicyBody";
import { legalDocBySlug, sharedLegalDocs } from "@/lib/legal-docs";

// The policy pages that DON'T have their own React file (Fair Play, Responsible
// Gaming, Coin Purchase, Safety & Moderation, User Reporting). One route renders
// them all from the registry in lib/legal-docs.ts, and each is still fully
// admin-editable through Admin → Policies & Terms — exactly like the older five.
//
// The five hand-written pages (terms, privacy, refund, community, contact) are
// static siblings of this route, so Next serves those files instead of this one.

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return sharedLegalDocs("legal").map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = legalDocBySlug(slug);
  if (!doc) return {};
  return {
    title: `${doc.title} · Lotus Ludo`,
    description: doc.description,
    alternates: { canonical: `https://lotusplay.tech${doc.href}` },
  };
}

export default async function LegalSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = legalDocBySlug(slug);
  if (!doc || doc.section !== "legal" || doc.builtIn) notFound();

  return (
    <LegalDoc slug={doc.slug}>
      <h1>{doc.title}</h1>
      <PolicyBody body={doc.starter} />
    </LegalDoc>
  );
}
