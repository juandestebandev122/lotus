import type { ReactNode } from "react";
import { getConfig } from "@/server/repo";
import { readSavedConfigFromDisk } from "@/server/db";
import { PolicyBody } from "./PolicyBody";

/**
 * A public legal page.
 *
 * If an admin has written this document (Admin → Policies & Terms, matched by
 * slug) their version is shown — title, text, bullets and pictures, all editable
 * from the panel. Otherwise the built-in text passed as `children` is used, so a
 * page nobody has touched looks exactly as it always did.
 */
export async function LegalDoc({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  // Read what the admin last SAVED, straight from disk. Going through the cached
  // config meant this page could keep serving old text after an edit (each Next
  // route bundle carries its own cached copy), which made the whole "edit your
  // legal pages" feature look broken. Falls back to the cached config if the file
  // can't be read for any reason.
  const saved = await readSavedConfigFromDisk();
  const cfg = saved ?? (await getConfig());
  const doc = (cfg.policies ?? []).find((p) => p.slug === slug && (p.body ?? "").trim());

  if (!doc) return <>{children}</>;

  const updated = doc.updatedAt ? new Date(doc.updatedAt) : null;
  return (
    <>
      <h1>{doc.title}</h1>
      {updated && !isNaN(updated.getTime()) && (
        <p className="text-mist-500">
          Last updated: {updated.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      )}
      <PolicyBody body={doc.body} />
    </>
  );
}
