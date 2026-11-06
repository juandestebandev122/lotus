import { getConfig } from "@/server/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The publisher ID the site shipped with, used until an admin sets their own.
const LEGACY_PUB = "pub-2001876551571956";
// Google's certification-authority ID in ads.txt. Constant for all publishers.
const GOOGLE_TAG_ID = "f08c47fec0942fa0";

// ============================================================
// /ads.txt   (served here via a rewrite in next.config.ts)
//
// ads.txt tells ad networks which accounts are allowed to sell inventory on
// this domain. If it does not list the publisher ID that is actually serving
// the ads, AdSense reports "unauthorised inventory" and stops paying out.
//
// It used to be a STATIC file in /public with the publisher ID written into
// it. That was fine while the ID was also hard-coded in the app — but now the
// ID is editable from the admin panel, a static file would silently fall out of
// step with it the first time the owner changed advertising account, and the
// only symptom would be ads quietly not earning.
//
// Serving it from the same config value means the two can never disagree.
// ============================================================
export async function GET() {
  const configured = ((await getConfig()).siteContent?.customCode?.adsenseClient ?? "").trim();
  // The admin panel stores "ca-pub-…"; ads.txt wants it without the "ca-" prefix.
  const pub = configured ? configured.replace(/^ca-/i, "") : LEGACY_PUB;

  const body = `google.com, ${pub}, DIRECT, ${GOOGLE_TAG_ID}\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // Crawlers re-read this periodically; a short cache keeps a change from
      // taking days to be noticed without hammering the app.
      "Cache-Control": "public, max-age=600",
    },
  });
}
