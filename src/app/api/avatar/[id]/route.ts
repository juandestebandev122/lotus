import { getDB, activeAvatarImageFor } from "@/server/db";

export const runtime = "nodejs";

// Serve a user's avatar (or cover) image bytes, decoded from the stored base64
// data URL, with a LONG immutable cache. The client references this via a
// content-hashed URL (/api/avatar/<id>?v=<hash>), so the browser downloads each
// image once and caches it — instead of re-downloading 60KB of base64 on every
// poll. This is the core fix for the app's mobile-data usage.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const kind = new URL(req.url).searchParams.get("kind") === "cover" ? "cover" : "avatar";
  const db = await getDB();
  const user = db.users.find((u) => u.id === id);
  // Admin "Common Profile Picture" campaign: while active for this user, serve the
  // campaign image INSTEAD of their real avatar (never for covers). The stored avatar
  // is untouched, so this reverts automatically when the campaign ends.
  const campaign = kind === "avatar" ? activeAvatarImageFor(db, id) : null;
  const data = campaign || (kind === "cover" ? user?.cover : user?.avatar) || "";

  // Parse the data URL robustly. The previous regex captured the base64 body with
  // [A-Za-z0-9+/=]+, which STOPS at the first whitespace/newline — so a large
  // image whose base64 was line-wrapped (common for big covers) got TRUNCATED to
  // its first line and served as a corrupt, unviewable image. Here we split on the
  // first comma, validate the header, then let Buffer.from decode the whole body
  // (Node ignores embedded whitespace), so any valid image serves correctly
  // regardless of size or line-wrapping.
  const comma = data.indexOf(",");
  const header = comma >= 0 ? data.slice(0, comma) : "";
  const headMatch = /^data:(image\/[a-zA-Z0-9.+-]+);base64$/.exec(header);
  if (comma < 0 || !headMatch) {
    // No stored image → 404 so the UI falls back to initials. Cache the 404
    // briefly so a missing avatar isn't re-requested on every poll either.
    return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=300" } });
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(data.slice(comma + 1), "base64"); // whitespace-tolerant
  } catch {
    return new Response(null, { status: 404 });
  }
  if (buf.length === 0) return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=60" } });
  const m = headMatch; // reuse mime below

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
