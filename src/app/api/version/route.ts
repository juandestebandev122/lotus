import v8 from "node:v8";
import { APP_VERSION } from "@/lib/lifelog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The app version the SERVER is currently running. The client compares this to
// its own loaded bundle version and reloads if it's stale — so a fix reaches
// every device promptly instead of a tab/PWA running old code indefinitely.
//
// It also reports the server's MEMORY HEADROOM. On 2026-08-31 the process was
// running at node's default ~2 GB heap on a 7.9 GB machine and ran out of it
// while parsing the database. When that happens node does not slow down, it
// DIES: pm2 restarts it, and for the several seconds that takes every player's
// board stops updating and anyone opening a page gets a blank screen with a
// spinner. It looked exactly like the game hanging, and nothing in the app
// itself was wrong. These fields make the headroom checkable at a glance
// instead of only discoverable from a crash log after the fact.
export function GET() {
  let mem: Record<string, number> | undefined;
  try {
    const h = v8.getHeapStatistics();
    const m = process.memoryUsage();
    const mb = (n: number) => Math.round(n / 1048576);
    mem = {
      heapLimitMB: mb(h.heap_size_limit),
      heapUsedMB: mb(m.heapUsed),
      rssMB: mb(m.rss),
      // Percentage of the ceiling in use — the number that matters.
      heapPct: Math.round((m.heapUsed / h.heap_size_limit) * 100),
      uptimeMin: Math.round(process.uptime() / 60),
    };
  } catch { /* never let diagnostics break the version check */ }

  return new Response(JSON.stringify({ v: APP_VERSION, ...(mem ? { mem } : {}) }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
