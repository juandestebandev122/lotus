import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { canAccess } from "@/lib/admin-perms";
import {
  storageOverview, agencyStorageReport, storageTimeReport,
  setStorageSettings, setUserStorageLimit, setUserVip, setAgencyStorageLimit,
  deleteStorageFiles, cleanupOrphanStorage,
} from "@/server/repo";

export const runtime = "nodejs";

async function guard() {
  const user = await getCurrentUser();
  if (!user) return { error: fail("Please log in first", 401) };
  if (user.role !== "admin") return { error: fail("Administrator access required", 403) };
  if (!canAccess("storage", user.adminRole, user.adminPermissions)) return { error: fail("Storage management access required", 403) };
  return { user };
}

// GET: full storage overview (+ optional agency & time reports).
export async function GET(req: Request) {
  const g = await guard(); if (g.error) return g.error;
  const p = new URL(req.url).searchParams;
  const [overview, agencies, time] = await Promise.all([
    storageOverview({
      q: p.get("q") || undefined,
      sort: (p.get("sort") as "used" | "pct" | "name") || "used",
      limit: p.get("limit") ? Number(p.get("limit")) : 1000,
      offset: p.get("offset") ? Number(p.get("offset")) : 0,
    }),
    agencyStorageReport(),
    storageTimeReport(),
  ]);
  return ok({ ...overview, agencies, time });
}

// POST: admin actions.
export async function POST(req: Request) {
  const g = await guard(); if (g.error) return g.error;
  const adminName = g.user!.fullName;
  const body = await readJson<{ action?: string; [k: string]: unknown }>(req);
  switch (body.action) {
    case "settings": {
      const next = await setStorageSettings((body.settings ?? {}) as Record<string, unknown>, adminName);
      return ok({ ok: true, storage: next });
    }
    case "setUserLimit": {
      const r = await setUserStorageLimit(String(body.userId), body.mb === null ? null : Number(body.mb), adminName);
      return r.ok ? ok(r) : fail(r.error ?? "Failed", 400);
    }
    case "setVip": {
      const r = await setUserVip(String(body.userId), !!body.vip, adminName);
      return r.ok ? ok(r) : fail(r.error ?? "Failed", 400);
    }
    case "setAgencyLimit": {
      const r = await setAgencyStorageLimit(String(body.agencyId), body.mb === null ? null : Number(body.mb), adminName);
      return r.ok ? ok(r) : fail(r.error ?? "Failed", 400);
    }
    case "deleteFiles": {
      const names = Array.isArray(body.names) ? body.names.map(String) : [];
      if (!names.length) return fail("No files selected", 400);
      const r = await deleteStorageFiles(names, adminName);
      return ok({ ok: true, ...r });
    }
    case "cleanup": {
      const r = await cleanupOrphanStorage(adminName);
      return r.ok ? ok(r) : fail(r.error ?? "Failed", 400);
    }
    default:
      return fail("Unknown action", 400);
  }
}
