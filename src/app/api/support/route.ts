import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { createSupportTicket, listUserTickets } from "@/server/repo";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const tickets = await listUserTickets(user.id, user.fullName);
  return ok({ tickets });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const b = await readJson<{ subject?: string; message?: string }>(req);
  const res = await createSupportTicket(user.id, user.fullName, b.subject ?? "", b.message ?? "");
  if (!res.ok) return fail(res.error ?? "Could not send your message", 400);
  return ok(res);
}
