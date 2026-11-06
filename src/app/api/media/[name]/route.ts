import path from "node:path";
import { promises as fs } from "node:fs";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");

const TYPES: Record<string, string> = {
  mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", aac: "audio/aac",
  ogg: "audio/ogg", oga: "audio/ogg", opus: "audio/ogg", flac: "audio/flac",
  amr: "audio/amr", mp4: "video/mp4", webm: "video/webm",
  mov: "video/quicktime", mkv: "video/x-matroska", avi: "video/x-msvideo",
  m4v: "video/mp4", "3gp": "video/3gpp", "3g2": "video/3gpp2",
  // images (media library "Image" type)
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
  webp: "image/webp", bmp: "image/bmp",
};

// Stream an uploaded room-media file with HTTP Range support (so audio/video
// can play + seek for every member in the room).
export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  // Only allow safe filenames — no path traversal.
  if (!/^[a-z0-9_.-]+$/i.test(name)) return new Response("Not found", { status: 404 });

  const filePath = path.join(UPLOAD_DIR, name);
  let stat;
  try { stat = await fs.stat(filePath); } catch { return new Response("Not found", { status: 404 }); }

  const ext = (name.split(".").pop() || "").toLowerCase();
  const type = TYPES[ext] || "application/octet-stream";
  const total = stat.size;
  const range = req.headers.get("range");

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m && m[1] ? parseInt(m[1], 10) : 0;
    const end = m && m[2] ? parseInt(m[2], 10) : total - 1;
    const fh = await fs.open(filePath, "r");
    const len = end - start + 1;
    const buf = Buffer.alloc(len);
    await fh.read(buf, 0, len, start);
    await fh.close();
    return new Response(buf, {
      status: 206,
      headers: {
        "Content-Type": type,
        "Content-Length": String(len),
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  const buf = await fs.readFile(filePath);
  return new Response(buf, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(total),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
