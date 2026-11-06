import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getDB, withDB, defaultConfig } from "@/server/db";
import { addAdminLog } from "@/server/repo";
import { canAccess } from "@/lib/admin-perms";
import { razorpayCreds, envRazorpayCreds, razorpayCredsComplete, testRazorpayConnection, type RazorpayCreds } from "@/server/razorpay";

export const runtime = "nodejs";

// Admin → Settings → Razorpay. The Key Secret is write-only: it is never
// returned, only whether one is saved and its last 4 characters.

async function requireSettingsAdmin() {
  const user = await getCurrentUser();
  if (!user) return { error: fail("Please log in first", 401) };
  if (user.role !== "admin" || !canAccess("settings", user.adminRole, user.adminPermissions)) {
    return { error: fail("Administrator access required", 403) };
  }
  return { user };
}

const hint = (s: string) => (s.length > 4 ? `…${s.slice(-4)}` : s ? "…" : "");
const modeOf = (keyId: string) => (keyId.startsWith("rzp_live_") ? "live" : keyId.startsWith("rzp_test_") ? "test" : "");

async function view() {
  const saved = (await getDB()).config?.razorpay ?? {};
  const active = await razorpayCreds();
  return {
    saved: {
      keyId: saved.keyId ?? "",
      secretSet: !!saved.keySecret,
      secretHint: hint(saved.keySecret ?? ""),
      updatedAt: saved.updatedAt ?? "",
      updatedBy: saved.updatedBy ?? "",
    },
    active: { source: active.source, keyId: active.keyId, mode: modeOf(active.keyId) },
    envConfigured: razorpayCredsComplete(envRazorpayCreds()),
  };
}

type Body = { keyId?: unknown; keySecret?: unknown; clear?: unknown };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Form values → credentials. A blank secret means "keep the saved one". */
async function credsFromBody(b: Body): Promise<RazorpayCreds> {
  const saved = (await getDB()).config?.razorpay ?? {};
  return { keyId: str(b.keyId, 100), keySecret: str(b.keySecret, 200) || saved.keySecret || "" };
}

function validate(c: RazorpayCreds): string | null {
  if (!/^rzp_(test|live)_[A-Za-z0-9]+$/.test(c.keyId)) return "The Key ID must start with rzp_test_ or rzp_live_ (copy it from the Razorpay Dashboard).";
  if (!c.keySecret) return "The Key Secret is required.";
  if (/\s/.test(c.keySecret)) return "The Key Secret must not contain spaces.";
  return null;
}

export async function GET() {
  const auth = await requireSettingsAdmin();
  if (auth.error) return auth.error;
  return ok(await view());
}

/** Save (or with { clear: true } remove) the Razorpay keys. */
export async function PATCH(req: Request) {
  const auth = await requireSettingsAdmin();
  if (auth.error) return auth.error;
  const body = await readJson<Body>(req);

  if (body.clear === true) {
    await withDB((db) => { if (db.config) delete db.config.razorpay; });
    await addAdminLog(auth.user.fullName, "Removed the Razorpay keys (back to server defaults)");
    return ok(await view());
  }

  const c = await credsFromBody(body);
  const err = validate(c);
  if (err) return fail(err);

  await withDB((db) => {
    if (!db.config) db.config = defaultConfig();
    db.config.razorpay = { ...c, updatedAt: new Date().toISOString(), updatedBy: auth.user.fullName };
  });
  await addAdminLog(auth.user.fullName, `Updated the Razorpay keys (${c.keyId})`);
  return ok(await view());
}

/** Test keys without saving. An empty body tests what is live now. */
export async function POST(req: Request) {
  const auth = await requireSettingsAdmin();
  if (auth.error) return auth.error;
  const body = await readJson<Body>(req);
  const hasForm = typeof body.keyId === "string";
  const c = hasForm ? await credsFromBody(body) : await razorpayCreds();
  if (hasForm) {
    const err = validate(c);
    if (err) return ok({ ok: false, error: err });
  }
  return ok(await testRazorpayConnection(c));
}
