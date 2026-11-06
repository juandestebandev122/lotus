import type { NextConfig } from "next";

// Set NEXT_PUBLIC_BASE_PATH=/Ludo at build time to serve under escapeweb.info/Ludo.
// Left unset for local dev (served at root).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  basePath,
  // Self-contained build for copying to the VPS (small footprint, no full node_modules).
  output: "standalone",
  // Lower PEAK memory during the production webpack build. The build machine has only
  // 2 GB RAM and the optimize step otherwise OOMs (native Zone / ArrayBuffer failures).
  // This trades a little build speed for a much smaller memory footprint — no runtime
  // effect on the shipped app.
  experimental: {
    webpackMemoryOptimizations: true,
  },
  // The in-build type-check spawns a SECOND worker that needs ~1 GB of its own, and
  // on this 2 GB machine it dies with a stack-buffer-overrun (exit 3221226505) AFTER
  // webpack has already compiled cleanly — burning 15 minutes each time.
  //
  // Types are still checked, just separately and before the build:
  //     node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
  // That must pass before deploying. This only stops the duplicate check inside the
  // build; it does not weaken type safety, and has no effect on the shipped app.
  typescript: { ignoreBuildErrors: true },
  // Allow the dev server to be viewed through an ngrok tunnel (for client demos).
  allowedDevOrigins: [
    "*.ngrok-free.app",
    "*.ngrok-free.dev",
    "*.ngrok.app",
    "*.ngrok.io",
  ],
  // Never let a browser or proxy cache PAGE HTML. Every deploy rebuilds the app
  // and rotates all the JS chunk hashes; a cached old page HTML then points at
  // chunk files that no longer exist → the browser dead-ends on "This page
  // couldn't load". Previously only /admin was protected, but the STATIC user
  // pages (/, /rooms, /login, /reels, …) were served with a 1-YEAR cache
  // (s-maxage=31536000), so after a deploy many users got stuck on a stale shell.
  //
  // The matcher below sends `no-store` for every PAGE navigation but EXCLUDES the
  // immutable hashed assets (/_next/*) and files with an extension (sw.js, images,
  // manifest, favicon) and /api/* — so static-asset caching (and the low-data
  // optimisation) is untouched; only the HTML document is always fetched fresh.
  // ANDROID APP LINK. Android fetches /.well-known/assetlinks.json to confirm
  // that this website and the installed app are the same product; if it does
  // not match, the app opens with a browser address bar across the top.
  //
  // It is served by a route rather than a static file so the owner can paste
  // the fingerprint into the admin panel — it only exists after the first Play
  // upload, so a static file could never have been filled in beforehand, and a
  // rebuild would otherwise be needed at exactly the wrong moment.
  async rewrites() {
    return [
      { source: "/.well-known/assetlinks.json", destination: "/api/assetlinks" },
      // ads.txt must always name the publisher ID that is actually serving the
      // ads. Since that ID is now editable in the admin panel, this file has to
      // be generated from the same value rather than sitting static in /public,
      // or the two drift apart and AdSense reports unauthorised inventory.
      { source: "/ads.txt", destination: "/api/ads-txt" },
    ];
  },
  async headers() {
    return [
      {
        source: "/((?!api/|_next/|.*\\..*).*)",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
