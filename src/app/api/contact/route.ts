import { ok, fail, readJson } from "@/server/http";
import { createContactMessage } from "@/server/repo";
import { clientIp } from "@/server/geo";

export const runtime = "nodejs";

/**
 * The PUBLIC contact form (/legal/contact). Deliberately needs no login — a
 * privacy request, a complaint, or a question from someone who cannot get into
 * their account all have to be able to reach us. Messages land in
 * Admin → Support as ordinary tickets.
 */
export async function POST(req: Request) {
  const b = await readJson<{ name?: string; email?: string; subject?: string; message?: string; topic?: string; website?: string }>(req);

  // Honeypot: a hidden field real people never fill in. Bots do. Answer 200 so
  // the bot believes it succeeded and doesn't retry.
  if ((b.website ?? "").trim()) return ok({ ok: true });

  const res = await createContactMessage({
    name: String(b.name ?? ""),
    email: String(b.email ?? ""),
    subject: String(b.subject ?? ""),
    message: String(b.message ?? ""),
    topic: String(b.topic ?? ""),
    ip: clientIp(req),
  });
  if (!res.ok) return fail(res.error ?? "Could not send your message", 400);
  return ok({ ok: true, id: res.id });
}
