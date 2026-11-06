import { ok, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";

export const runtime = "nodejs";

// Lightweight voice-connection diagnostics. The client posts the outcome of its
// LiveKit connection attempt so we can see (in the server logs) exactly why
// voice fails for a user — connection vs media vs permission — without needing
// access to their browser console.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  const b = await readJson<{ stage?: string; roomId?: string; error?: string; ua?: string; ms?: number; ice?: string }>(req);
  const who = user ? `${user.username} (${user.id})` : "anon";
  console.info(
    `[voice-diag] ${who} room=${b.roomId ?? "?"} stage=${b.stage ?? "?"}` +
      (b.ms != null ? ` ms=${b.ms}` : "") +
      (b.ice ? ` ice=${b.ice}` : "") +
      (b.error ? ` error="${String(b.error).slice(0, 200)}"` : "") +
      ` ua="${String(b.ua ?? "").slice(0, 120)}" @ ${new Date().toISOString()}`,
  );
  return ok({ ok: true });
}
