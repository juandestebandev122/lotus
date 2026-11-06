import { getConfig } from "@/server/repo";

export const runtime = "nodejs";

// Serve the admin's payment-QR image bytes from its own cacheable URL.
//
// The QR is a base64 data URL in the platform config. The config is public and
// fetched by every client, so embedding it meant shipping ~82 KB — 58% of the
// whole config — to every member on every load, for a picture only shown inside
// the "Buy coins" modal. The config now carries a short URL to this route
// instead, and the browser downloads the image once and caches it.
export async function GET(req: Request) {
  const cfg = await getConfig();
  const data = cfg.paymentQr?.imageUrl ?? "";

  const comma = data.indexOf(",");
  const header = comma >= 0 ? data.slice(0, comma) : "";
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64$/.exec(header);
  // Not a stored data URL (unset, or already a plain URL) → nothing to serve.
  if (comma < 0 || !m) return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=60" } });

  let buf: Buffer;
  try {
    buf = Buffer.from(data.slice(comma + 1), "base64");
  } catch {
    return new Response(null, { status: 404 });
  }
  if (buf.length === 0) return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=60" } });

  // The caller passes ?v=<hash of the image>, so a NEW QR gets a new URL and is
  // re-fetched; the old one can safely be cached for a long time.
  const versioned = new URL(req.url).searchParams.has("v");
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": m[1],
      "Content-Length": String(buf.length),
      "Cache-Control": versioned ? "public, max-age=2592000, immutable" : "public, max-age=300",
    },
  });
}
