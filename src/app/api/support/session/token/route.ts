import { ok, fail } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getSupportSession } from "@/server/repo";
import { createAccessToken, livekitCreds, credsComplete } from "@/server/livekit";

export const runtime = "nodejs";

/**
 * A LiveKit token for ONE support session's private room.
 *
 * THIS IS THE PIECE THAT WAS MISSING. The screen was being captured on the
 * user's machine and then went nowhere — nothing carried it to support, so
 * "live screen share" showed the browser's sharing bar and achieved nothing.
 * The capture is now published into a room of its own and support subscribes.
 *
 * Who gets what:
 *   • the session's OWNER  → may PUBLISH (their screen), cannot subscribe to
 *                            anything (there is nothing to receive).
 *   • an ADMIN             → may SUBSCRIBE only. Support can never publish into
 *                            a user's session, so nothing can be pushed AT them.
 *   • anybody else         → refused.
 *
 * The room is `support_<sessionId>`, so it dies with the session and can never
 * be confused with a voice room.
 */
export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me) return fail("Please log in first", 401);
  const creds = await livekitCreds();
  if (!credsComplete(creds)) return fail("Live sharing is not configured on this server.", 503);

  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return fail("Which session?");

  const s = await getSupportSession(id);
  if (!s) return fail("Session not found", 404);
  if (s.status !== "active") return fail("That session has ended.", 410);

  const isOwner = s.userId === me.id;
  const isAdmin = me.role === "admin";
  if (!isOwner && !isAdmin) return fail("That isn't your session.", 403);

  const token = createAccessToken(creds, {
    room: `support_${s.id}`,
    identity: me.id,
    name: me.fullName,
    // Only the person whose screen it is may send anything.
    canPublish: isOwner,
    ttlSeconds: 4 * 60 * 60, // matches the session's own 4-hour lifetime
  });

  return ok({ url: creds.url, token, role: isOwner ? "publisher" : "viewer" });
}
