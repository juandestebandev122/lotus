import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

// TEMPORARY diagnostic endpoint: the front-end beacons any client-side error
// (script/chunk 404, JS exception, unhandled rejection) here so we can see the
// REAL reason a page fails to load in a user's browser — something curl/SSR
// can't reveal. Appends one JSON line per error to .data/client-errors.log.
const LOG = path.join(process.cwd(), ".data", "client-errors.log");
const MAX = 512 * 1024; // keep the log small

export async function POST(req: Request) {
  try {
    const body = (await req.text()).slice(0, 4000);
    const ua = req.headers.get("user-agent") ?? "";
    const line = JSON.stringify({ t: new Date().toISOString(), ua, body }) + "\n";
    await fs.mkdir(path.dirname(LOG), { recursive: true });
    // Trim if the file got large, then append.
    try {
      const stat = await fs.stat(LOG);
      if (stat.size > MAX) await fs.writeFile(LOG, "");
    } catch {
      /* no file yet */
    }
    await fs.appendFile(LOG, line, "utf8");
  } catch {
    /* never throw from the beacon endpoint */
  }
  return new Response(null, { status: 204 });
}
