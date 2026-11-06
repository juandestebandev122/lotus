import { getDB } from "@/server/db";

export const runtime = "nodejs";

// Serve a business logo (or cover) image bytes, decoded from the stored base64
// data URL, with a LONG immutable cache. Referenced via a content-hashed URL
// (/api/business-image/<id>?v=<hash>), so the browser downloads each image once
// and caches it instead of re-downloading it in every directory poll.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const kind = new URL(req.url).searchParams.get("kind") === "cover" ? "cover" : "logo";
  const db = await getDB();
  const biz = (db.businesses ?? []).find((b) => b.id === id);
  const data = (kind === "cover" ? biz?.cover : biz?.logo) || "";

  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)/.exec(data);
  if (!m) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=300" } });
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(m[2], "base64");
  } catch {
    return new Response(null, { status: 404 });
  }

  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": m[1],
      "Content-Length": String(buf.length),
      "Cache-Control": "public, max-age=2592000, immutable",
    },
  });
}
