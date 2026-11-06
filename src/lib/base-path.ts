// When the app is served under a sub-path (e.g. https://escapeweb.info/Ludo),
// next/link, the router and /_next assets are prefixed automatically by
// Next.js `basePath`. Raw fetch() calls and <img> srcs are NOT — so they use
// this helper. Locally (no NEXT_PUBLIC_BASE_PATH) it resolves to "" = root.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefix an absolute app path with the configured base path. */
export function withBase(path: string): string {
  return `${BASE_PATH}${path}`;
}
