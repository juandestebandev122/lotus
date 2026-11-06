import { ok, fail } from "@/server/http";
import { getCurrentUser, verifyTokenFull } from "@/server/auth";
import { cookies } from "next/headers";
import { invalidateSessions } from "@/server/repo";

export const runtime = "nodejs";

// Security overview for the signed-in user: login history + current session.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);

  const jar = await cookies();
  const payload = verifyTokenFull(jar.get("lotus_session")?.value);
  const latest = (user.loginHistory ?? [])[0];

  return ok({
    hasPassword: !!user.passwordHash,
    passwordChangedAt: user.passwordChangedAt ?? null,
    loginHistory: (user.loginHistory ?? []).map((e) => ({ at: e.at, ip: e.ip ?? "", device: e.device ?? "Unknown device", method: e.method ?? "password" })),
    currentSession: {
      since: payload ? new Date(payload.iat * 1000).toISOString() : null,
      ip: user.lastIp ?? "",
      device: latest?.device ?? "This device",
    },
  });
}

// "Log out of all other devices" — invalidate every other session.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  await invalidateSessions(user.id);
  // Re-issue THIS device's session so the current user stays signed in.
  const { setSession } = await import("@/server/auth");
  await setSession(user.id);
  return ok({ ok: true });
}
