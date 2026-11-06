import { getDB } from "@/server/db";

export const runtime = "nodejs";

// Serve a reel's poster/thumbnail (stored as a base64 data URL on the record).
// Content-addressed & immutable so browsers cache it aggressively.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDB();
  const reel = (db.reels ?? []).find((r) => r.id === id);
  const m = reel?.thumb ? /^data:([^;]+);base64,(.+)$/.exec(reel.thumb) : null;
  if (!m) return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=300" } });
  const buf = Buffer.from(m[2], "base64");
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": m[1], "Content-Length": String(buf.length), "Cache-Control": "public, max-age=2592000, immutable" },
  });
}
