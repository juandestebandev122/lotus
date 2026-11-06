import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getDB, withDB, defaultConfig } from "@/server/db";
import { addAdminLog } from "@/server/repo";
import { canAccess } from "@/lib/admin-perms";
import { stripeSecret, envStripeSecret, stripeKeyValid, testStripeConnection } from "@/server/stripe";
import { razorpayCreds } from "@/server/razorpay";

export const runtime = "nodejs";

// Admin → Settings → Stripe (backup gateway). The secret key is write-only: it
// is never returned, only whether one is saved and its last 4 characters.

async function requireSettingsAdmin() {
  const user = await getCurrentUser();
  if (!user) return { error: fail("Please log in first", 401) };
  if (user.role !== "admin" || !canAccess("settings", user.adminRole, user.adminPermissions)) {
    return { error: fail("Administrator access required", 403) };
  }
  return { user };
}

const hint = (s: string) => (s.length > 4 ? `…${s.slice(-4)}` : s ? "…" : "");
const modeOf = (key: string) => (key.startsWith("sk_live_") ? "live" : key.startsWith("sk_test_") ? "test" : "");

async function view() {
  const saved = (await getDB()).config?.stripe ?? {};
  const active = await stripeSecret();
  return {
    saved: {
      secretSet: !!saved.secretKey,
      secretHint: hint(saved.secretKey ?? ""),
      mode: modeOf(saved.secretKey ?? ""),
      updatedAt: saved.updatedAt ?? "",
      updatedBy: saved.updatedBy ?? "",
    },
    active: { source: active.source, mode: modeOf(active.key), keyHint: hint(active.key) },
    envConfigured: stripeKeyValid(envStripeSecret()),
    // Checkout uses Razorpay whenever it is set up; Stripe only takes over otherwise.
    razorpayActive: (await razorpayCreds()).source !== "none",
  };
}

type Body = { secretKey?: unknown; clear?: unknown };

const keyFrom = (b: Body) => (typeof b.secretKey === "string" ? b.secretKey.trim().slice(0, 300) : "");

function validate(key: string): string | null {
  if (!key) return "Paste the Stripe Secret key.";
  if (!stripeKeyValid(key)) return "The Secret key must start with sk_test_ or sk_live_ (not pk_, which is the publishable key).";
  if (/\s/.test(key)) return "The Secret key must not contain spaces.";
  return null;
}

export async function GET() {
  const auth = await requireSettingsAdmin();
  if (auth.error) return auth.error;
  return ok(await view());
}

/** Save (or with { clear: true } remove) the Stripe secret key. */
export async function PATCH(req: Request) {
  const auth = await requireSettingsAdmin();
  if (auth.error) return auth.error;
  const body = await readJson<Body>(req);

  if (body.clear === true) {
    await withDB((db) => { if (db.config) delete db.config.stripe; });
    await addAdminLog(auth.user.fullName, "Removed the Stripe secret key (back to server defaults)");
    return ok(await view());
  }

  const key = keyFrom(body);
  const err = validate(key);
  if (err) return fail(err);

  await withDB((db) => {
    if (!db.config) db.config = defaultConfig();
    db.config.stripe = { secretKey: key, updatedAt: new Date().toISOString(), updatedBy: auth.user.fullName };
  });
  await addAdminLog(auth.user.fullName, `Updated the Stripe secret key (${modeOf(key)} key ${hint(key)})`);
  return ok(await view());
}

/** Test a key without saving. An empty key tests the one that is live now. */
export async function POST(req: Request) {
  const auth = await requireSettingsAdmin();
  if (auth.error) return auth.error;
  const typed = keyFrom(await readJson<Body>(req));
  if (typed) {
    const err = validate(typed);
    if (err) return ok({ ok: false, error: err });
    return ok(await testStripeConnection(typed));
  }
  const active = await stripeSecret();
  if (active.source === "none") return ok({ ok: false, error: "No Stripe key is set up yet. Paste one to test it." });
  return ok(await testStripeConnection(active.key));
}
