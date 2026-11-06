import path from "node:path";
import { promises as fs } from "node:fs";
import { getCurrentUser } from "@/server/auth";
import { getUpload } from "@/server/repo";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");

// Serve a securely-stored file (KYC doc / document submission / private-chat
// attachment). Only the owner, an administrator, or someone explicitly listed as
// a viewer (e.g. the recipient of a private-chat photo) may download it.
export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[a-z0-9_.-]+$/i.test(name)) return new Response("Not found", { status: 404 });

  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const rec = await getUpload(name);
  if (!rec) return new Response("Not found", { status: 404 });
  // public = a group/room chat attachment (visible to every logged-in member); the rest
  // stay private to the owner, admins, or explicitly-listed viewers (KYC / 1:1 chat).
  const allowed = rec.public === true || rec.ownerId === user.id || user.role === "admin" || (rec.viewerIds ?? []).includes(user.id);
  if (!allowed) return new Response("Forbidden", { status: 403 });

  const filePath = path.join(UPLOAD_DIR, name);
  let buf: Buffer;
  try { buf = await fs.readFile(filePath); } catch { return new Response("Not found", { status: 404 }); }

  const mime = rec.mime || "application/octet-stream";
  // Preview only genuinely safe media inline; every other type downloads. Combined
  // with X-Content-Type-Options: nosniff (below) this stops any uploaded file from
  // being MIME-sniffed or rendered as active content in the browser tab — important
  // now that admins can allow a wider range of file types in chat.
  const inlineSafe = /^(image|video|audio)\//.test(mime) || mime === "application/pdf";
  // ?download=1 forces a real save even for previewable types. The HTML `download`
  // attribute is ignored by several mobile browsers, which would open a photo or
  // PDF in a tab instead of saving it — so the Download button asks for it here.
  const forced = new URL(req.url).searchParams.get("download") === "1";
  const disposition = inlineSafe && !forced ? "inline" : "attachment";
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(buf.length),
      "Content-Disposition": `${disposition}; filename="${rec.originalName.replace(/[^\w.\- ]/g, "_")}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
