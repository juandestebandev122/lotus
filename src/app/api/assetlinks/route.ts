import { getConfig } from "@/server/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The Android package this website is paired with. Fixed for the life of the
// app — Play will never allow it to change once published.
const PACKAGE_NAME = "com.lotusplay.app";

// ============================================================
// /.well-known/assetlinks.json  (served here via a rewrite in next.config.ts)
//
// This is the file Android fetches to confirm that lotusplay.tech and the
// installed app are the same product. When it matches, the app opens clean and
// full-screen. When it does not, Android shows a browser address bar across the
// top and the app looks like a website in a frame.
//
// It used to be a STATIC file in /public containing placeholder text
// ("REPLACE_WITH_YOUR_APP_SIGNING_SHA256_FINGERPRINT"), which could never match
// anything — and the real fingerprint does not exist until the app has been
// uploaded to Play once, so the file could not have been filled in ahead of
// time. That left a rebuild-and-redeploy standing between the owner and a
// working app.
//
// Serving it from config instead means the owner pastes the fingerprint into
// Admin → Settings and it takes effect immediately, with no build and no
// developer. The fingerprint is a public certificate hash, not a secret.
// ============================================================
export async function GET() {
  const fp = ((await getConfig()).androidFingerprint || "").trim();

  // No fingerprint yet → return an EMPTY list rather than a placeholder.
  // An empty list is a valid, honest answer ("this site vouches for no app
  // yet"); a placeholder string is a malformed one, and Google's own App Links
  // tester reports that as a hard error, which is far more confusing to debug.
  const body = fp
    ? [{
        relation: ["delegate_permission/common.handle_all_urls"],
        target: { namespace: "android_app", package_name: PACKAGE_NAME, sha256_cert_fingerprints: [fp] },
      }]
    : [];

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json",
      // Android caches this. Keep it short so pasting the fingerprint takes
      // effect quickly, but not zero — it is fetched on every app install.
      "Cache-Control": "public, max-age=300",
    },
  });
}
