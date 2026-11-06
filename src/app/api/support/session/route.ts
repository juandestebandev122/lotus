import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import {
  mySupportSession, startSupportSession, endSupportSession,
  respondSupportControl, revokeSupportControl, attachToSupportSession, setSupportDiagnostics, setSupportLive,
} from "@/server/repo";

export const runtime = "nodejs";

// The USER's side of a screen-share / guided-support session.
//
// Everything here is the user's own decision: they start it, they answer a
// control request, and they can end it at any moment. Support cannot start a
// session, cannot grant itself control, and cannot keep one alive.
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return fail("Please log in first", 401);
  return ok({ session: await mySupportSession(me.id) });
}

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return fail("Please log in first", 401);

  const b = await readJson<{
    action?: string; mode?: string; consentText?: string; ticketId?: string;
    sessionId?: string; accept?: boolean;
    kind?: string; url?: string; name?: string; sizeBytes?: number; live?: boolean;
    diagnostics?: Record<string, string | number | boolean | null>;
  }>(req);

  switch (b.action) {
    case "start": {
      // Consent is a hard requirement, not a formality: no text, no session.
      const consentText = (b.consentText ?? "").trim();
      if (!consentText) return fail("Please agree to the sharing terms first.");
      const r = await startSupportSession({
        userId: me.id, userName: me.fullName, userPublicId: me.publicId,
        mode: b.mode === "live" ? "live" : "recording",
        consentText, ticketId: b.ticketId,
      });
      return r.ok ? ok({ ok: true, session: r.session }) : fail(r.error ?? "Could not start the session");
    }
    case "end": {
      const s = await mySupportSession(me.id);
      if (!s) return ok({ ok: true });
      const r = await endSupportSession(s.id, "user", me.fullName);
      return r.ok ? ok({ ok: true }) : fail(r.error ?? "Could not end the session");
    }
    case "control": {
      // The ONLY place guided control can be granted — and only by the user.
      const s = await mySupportSession(me.id);
      if (!s) return fail("You have no active session.");
      const r = await respondSupportControl(s.id, me.id, b.accept === true);
      return r.ok ? ok({ ok: true }) : fail(r.error ?? "Could not save your answer");
    }
    case "revokeControl": {
      const s = await mySupportSession(me.id);
      if (!s) return fail("You have no active session.");
      const r = await revokeSupportControl(s.id, me.id);
      return r.ok ? ok({ ok: true }) : fail(r.error ?? "Could not withdraw control");
    }
    case "attach": {
      const s = await mySupportSession(me.id);
      if (!s) return fail("You have no active session.");
      const url = (b.url ?? "").trim();
      // Only our own uploaded files — never an arbitrary URL supplied by a client.
      if (!url.startsWith("/api/file/") && !url.startsWith("/api/media/")) return fail("Unsupported file reference.");
      const r = await attachToSupportSession(s.id, me.id, {
        kind: b.kind === "recording" ? "recording" : "screenshot",
        url, name: (b.name ?? "screen").slice(0, 120), sizeBytes: b.sizeBytes,
      });
      return r.ok ? ok({ ok: true }) : fail(r.error ?? "Could not attach that file");
    }
    case "live": {
      // The user telling us their screen is (or is no longer) being published.
      const s = await mySupportSession(me.id);
      if (!s) return fail("You have no active session.");
      await setSupportLive(s.id, me.id, b.live === true);
      return ok({ ok: true });
    }
    case "diagnostics": {
      const s = await mySupportSession(me.id);
      if (!s) return fail("You have no active session.");
      await setSupportDiagnostics(s.id, me.id, b.diagnostics ?? {});
      return ok({ ok: true });
    }
    default:
      return fail("Unknown action");
  }
}
