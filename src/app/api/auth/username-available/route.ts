import { ok } from "@/server/http";
import { findByUsername } from "@/server/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Live username-availability check for the sign-up form, so a member is told a
// username is taken BEFORE they submit (and again on submit). Returns
// { valid, available }. `valid` = passes the sign-up format rule; `available` =
// not already in use. Only meaningful for a well-formed username.
export async function GET(req: Request) {
  const u = (new URL(req.url).searchParams.get("u") ?? "").trim().toLowerCase();
  const valid = /^[a-z0-9._]{3,20}$/.test(u);
  if (!valid) return ok({ valid: false, available: false });
  const taken = !!(await findByUsername(u));
  return ok({ valid: true, available: !taken });
}
