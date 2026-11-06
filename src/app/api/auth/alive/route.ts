import { ok } from "@/server/http";
import { getCurrentUser, sessionEndReason } from "@/server/auth";

export const runtime = "nodejs";

// Lightweight session-validity gate. The app polls this every ~20s while open
// so it reacts almost immediately when an administrator ends the session —
// Logout / Suspend / Ban / Deactivate all invalidate the session server-side
// (getCurrentUser returns null), and the client force-logs-out on the 401.
// Deliberately does NO database writes, so it does NOT touch presence or the
// data-usage tally (that stays the heartbeat's job).
export async function GET() {
  const user = await getCurrentUser();
  if (user) return ok({ alive: true });
  // Session ended — include WHY, so the client shows the right message
  // (e.g. "logged in on another device" for single-session sign-outs).
  const reason = await sessionEndReason();
  return new Response(JSON.stringify({ error: "Your session has ended", reason }), {
    status: 401,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
