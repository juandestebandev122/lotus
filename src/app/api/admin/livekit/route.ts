import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getDB, withDB, defaultConfig } from "@/server/db";
import { addAdminLog } from "@/server/repo";
import { canAccess } from "@/lib/admin-perms";
import { livekitCreds, envLivekitCreds, credsComplete, testLivekitConnection, type LivekitCreds } from "@/server/livekit";

export const runtime = "nodejs";

// Admin → Settings → Voice (LiveKit). The API secret is write-only: it is never
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

async function view() {
  const saved = (await getDB()).config?.livekit ?? {};
  const active = await livekitCreds();
  return {
    saved: {
      url: saved.url ?? "",
      apiKey: saved.apiKey ?? "",
      serverUrl: saved.serverUrl ?? "",
      secretSet: !!saved.apiSecret,
      secretHint: hint(saved.apiSecret ?? ""),
      updatedAt: saved.updatedAt ?? "",
      updatedBy: saved.updatedBy ?? "",
    },
    active: { source: active.source, url: active.url, apiKeyHint: hint(active.apiKey) },
    envConfigured: credsComplete(envLivekitCreds()),
  };
}

type Body = { url?: unknown; apiKey?: unknown; apiSecret?: unknown; serverUrl?: unknown; clear?: unknown };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Form values → credentials. A blank secret means "keep the saved one". */
async function credsFromBody(b: Body): Promise<LivekitCreds> {
  const saved = (await getDB()).config?.livekit ?? {};
  return {
    url: str(b.url, 300).replace(/\/+$/, ""),
    apiKey: str(b.apiKey, 200),
    apiSecret: str(b.apiSecret, 300) || saved.apiSecret || "",
    serverUrl: str(b.serverUrl, 300).replace(/\/+$/, ""),
  };
}

function validate(c: LivekitCreds): string | null {
  if (!/^wss?:\/\/[^\s/]+/i.test(c.url)) return "The server address must start with wss:// (for example wss://your-project.livekit.cloud).";
  if (!c.apiKey) return "The API key is required.";
  if (/\s/.test(c.apiKey)) return "The API key must not contain spaces.";
  if (!c.apiSecret) return "The API secret is required.";
  if (/\s/.test(c.apiSecret)) return "The API secret must not contain spaces.";
  if (c.serverUrl && !/^https?:\/\/[^\s/]+/i.test(c.serverUrl)) return "The internal server address must start with http:// or https://.";
  return null;
}

export async function GET() {
  const auth = await requireSettingsAdmin();
  if (auth.error) return auth.error;
  return ok(await view());
}

/** Save (or with { clear: true } remove) the LiveKit credentials. */
export async function PATCH(req: Request) {
  const auth = await requireSettingsAdmin();
  if (auth.error) return auth.error;
  const body = await readJson<Body>(req);

  if (body.clear === true) {
    await withDB((db) => { if (db.config) delete db.config.livekit; });
    await addAdminLog(auth.user.fullName, "Removed the LiveKit voice settings (back to server defaults)");
    return ok(await view());
  }

  const c = await credsFromBody(body);
  const err = validate(c);
  if (err) return fail(err);

  await withDB((db) => {
    if (!db.config) db.config = defaultConfig();
    db.config.livekit = { ...c, updatedAt: new Date().toISOString(), updatedBy: auth.user.fullName };
  });
  await addAdminLog(auth.user.fullName, `Updated the LiveKit voice settings (${c.url}, key ${hint(c.apiKey)})`);
  return ok(await view());
}

/** Test credentials without saving. An empty body tests what is live now. */
export async function POST(req: Request) {
  const auth = await requireSettingsAdmin();
  if (auth.error) return auth.error;
  const body = await readJson<Body>(req);
  const hasForm = typeof body.url === "string" || typeof body.apiKey === "string";
  const c = hasForm ? await credsFromBody(body) : await livekitCreds();
  if (hasForm) {
    const err = validate(c);
    if (err) return ok({ ok: false, error: err });
  }
  return ok(await testLivekitConnection(c));
}
