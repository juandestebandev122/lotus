import { getDB } from "@/server/db";

export const runtime = "nodejs";

// Serve a business-post image, decoded from the stored base64 data URL, with a
// long immutable cache (referenced via a content-hashed URL).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDB();
  const post = (db.businessPosts ?? []).find((p) => p.id === id);
  const data = post?.image || "";

  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)/.exec(data);
  if (!m) return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=300" } });

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
