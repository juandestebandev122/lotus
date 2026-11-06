import { getConfig } from "@/server/repo";

/**
 * ADMIN-MANAGED CODE ON EVERY PAGE.
 *
 * Three things the owner needs to change from time to time, none of which
 * should require a developer, a build or a deploy:
 *
 *   · the AdSense publisher ID  — changing ad account, or switching ads off
 *   · a <head> snippet          — analytics, ad networks, ownership tags
 *   · a footer snippet          — chat widgets, pixels, anything end-of-body
 *
 * The AdSense ID was previously hard-coded in the root layout. It is read from
 * config here instead, with the old constant kept as a fallback so nothing
 * changes for an existing install until the admin sets their own.
 *
 * React 19 hoists <meta> and <script> into <head> from anywhere in the tree, so
 * this can stay a small server component instead of forcing the whole layout to
 * become dynamic.
 */

/** The publisher ID used before this became admin-editable. Kept so the site
 *  keeps serving ads if the field has not been filled in yet. */
const LEGACY_ADSENSE_CLIENT = "ca-pub-2001876551571956";

export async function SiteCodeInjection({ slot }: { slot: "head" | "footer" }) {
  const cc = (await getConfig()).siteContent?.customCode;

  if (slot === "footer") {
    const footer = (cc?.footerCode ?? "").trim();
    if (!footer) return null;
    return <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: footer }} />;
  }

  const client = (cc?.adsenseClient ?? "").trim() || LEGACY_ADSENSE_CLIENT;
  const head = (cc?.headCode ?? "").trim();

  return (
    <>
      {/* AdSense loader. A RAW async <script> on purpose — AdSense's own
          verification and its ad-serving runtime both need a real
          <script async src="…adsbygoogle.js?client=ca-pub-…" crossorigin>.
          next/script's beforeInteractive emits only a <link rel="preload">,
          which the AdSense crawler does not accept. */}
      {client && (
        // eslint-disable-next-line @next/next/no-sync-scripts
        <script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
          crossOrigin="anonymous"
        />
      )}
      {/* The ownership meta tag AdSense looks for when verifying by "Meta tag".
          Deterministic, unlike a script that may not have run when they check. */}
      {client && <meta name="google-adsense-account" content={client} />}
      {head && <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: head }} />}
    </>
  );
}
