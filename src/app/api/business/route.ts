import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getConfig, businessDirectory, listMyBusinesses, createBusiness } from "@/server/repo";

export const runtime = "nodejs";

// GET: the public directory (verified businesses) + my own businesses + the
// selectable categories + whether the module is enabled.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const category = url.searchParams.get("category") ?? "";
  const cfg = await getConfig();
  const [directory, mine] = await Promise.all([
    businessDirectory(user.id, { q, category }),
    listMyBusinesses(user.id),
  ]);
  return ok({
    enabled: cfg.features?.business !== false,
    categories: cfg.business?.categories ?? [],
    registerCost: Math.max(0, Math.floor(cfg.business?.registerCost ?? 0)),
    coins: user.coins ?? 0,
    directory,
    mine,
  });
}

// POST: register a new business (goes to pending admin verification).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const b = await readJson<{
    name?: string; category?: string; description?: string;
    phone?: string; email?: string; website?: string; location?: string; hours?: string;
    whatsapp?: string; facebook?: string; instagram?: string; youtube?: string;
    logo?: string; cover?: string; visibility?: string;
    fields?: Record<string, string>;
  }>(req);
  const res = await createBusiness(user.id, {
    name: String(b.name ?? ""),
    category: String(b.category ?? "Other"),
    description: String(b.description ?? ""),
    phone: b.phone ? String(b.phone) : undefined,
    email: b.email ? String(b.email) : undefined,
    website: b.website ? String(b.website) : undefined,
    location: b.location ? String(b.location) : undefined,
    hours: b.hours ? String(b.hours) : undefined,
    whatsapp: b.whatsapp ? String(b.whatsapp) : undefined,
    facebook: b.facebook ? String(b.facebook) : undefined,
    instagram: b.instagram ? String(b.instagram) : undefined,
    youtube: b.youtube ? String(b.youtube) : undefined,
    logo: b.logo ? String(b.logo) : undefined,
    cover: b.cover ? String(b.cover) : undefined,
    visibility: b.visibility === "businesses" ? "businesses" : "everyone",
    fields: b.fields && typeof b.fields === "object" ? b.fields : undefined,
  });
  if (!res.ok) return fail(res.error ?? "Could not register business", 400);
  return ok(res);
}
