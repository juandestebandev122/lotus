import { getDB } from "@/server/db";

export const runtime = "nodejs";

// Serve a room's custom picture bytes, decoded from the stored base64 data URL,
// with a LONG immutable cache. The client references this via a content-hashed
// URL (/api/room-image/<id>?v=<hash>), so the browser downloads each image once
// and caches it — instead of re-downloading the base64 on every room poll.
// Mirrors /api/avatar/[id]; part of the app's mobile-data optimisation.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDB();
  const room = (db.rooms ?? []).find((r) => r.id === id);
  const data = room?.image || "";

  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)/.exec(data);
  if (!m) {
    // No picture → 404 so the UI falls back to the host initials. Cache the 404
    // briefly so a picture-less room isn't re-requested on every poll.
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
      // Content-addressed URL (?v=<hash>) → safe to cache forever.
      "Cache-Control": "public, max-age=2592000, immutable",
    },
  });
}
