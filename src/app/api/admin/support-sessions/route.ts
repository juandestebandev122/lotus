import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listSupportSessions, requestSupportControl, endSupportSession, addSupportGuidance, addAdminLog } from "@/server/repo";

export const runtime = "nodejs";

// SUPPORT's side. Note what is deliberately absent: there is no way here to
// start a session, to grant control, or to read anything the user has not
// explicitly shared. Support can only ASK; the user answers.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  return ok({ sessions: await listSupportSessions(200) });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const b = await readJson<{ action?: string; sessionId?: string; text?: string }>(req);
  const id = (b.sessionId ?? "").trim();
  if (!id) return fail("sessionId is required");

  switch (b.action) {
    case "requestControl": {
      const r = await requestSupportControl(id, user.fullName);
      if (r.ok) await addAdminLog(user.fullName, `Requested guided control in support session ${id}`);
      return r.ok ? ok({ ok: true }) : fail(r.error ?? "Could not send the request");
    }
    case "guide": {
      const r = await addSupportGuidance(id, user.fullName, b.text ?? "");
      return r.ok ? ok({ ok: true }) : fail(r.error ?? "Could not send the step");
    }
    case "end": {
      const r = await endSupportSession(id, "admin", user.fullName);
      if (r.ok) await addAdminLog(user.fullName, `Ended support session ${id}`);
      return r.ok ? ok({ ok: true }) : fail(r.error ?? "Could not end the session");
    }
    default:
      return fail("Unknown action");
  }
}
