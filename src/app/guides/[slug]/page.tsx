import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getConfig } from "@/server/repo";
import { readSavedConfigFromDisk } from "@/server/db";
import { PolicyBody } from "@/components/legal/PolicyBody";
import { PublicContentShell } from "@/components/PublicContentShell";
import { legalDocBySlug, sharedLegalDocs } from "@/lib/legal-docs";

// The player guides — How to Play Ludo, Ludo Rules, Tournament Rules. They live
// under /guides rather than /legal because they're how-to content, not policy,
// and search engines (and readers) treat the two very differently.
//
// Like the legal pages they're admin-editable: if a document with the same slug
// exists in Admin → Policies & Terms, that text is shown instead of the built-in
// version below.

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return sharedLegalDocs("guide").map((d) => ({ slug: d.slug }));
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

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = legalDocBySlug(slug);
  if (!doc || doc.section !== "guide") notFound();

  // Same "admin can take this page over" rule as the legal pages — read from
  // disk so an edit shows immediately rather than waiting on a cached config.
  const saved = await readSavedConfigFromDisk();
  const cfg = saved ?? (await getConfig());
  const managed = (cfg.policies ?? []).find((p) => p.slug === doc.slug && (p.body ?? "").trim());
  const updated = managed?.updatedAt ? new Date(managed.updatedAt) : null;

  return (
    <PublicContentShell>
      <h1>{managed?.title || doc.title}</h1>
      {updated && !isNaN(updated.getTime()) && (
        <p className="text-mist-500">
          Last updated: {updated.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      )}
      <PolicyBody body={managed?.body || doc.starter} />
    </PublicContentShell>
  );
}
