import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listAvatarCampaigns, createAvatarCampaign, updateAvatarCampaign, cancelAvatarCampaign, deleteAvatarCampaign, listAgenciesForAdmin } from "@/server/repo";
import type { AvatarCampaign } from "@/server/db";

export const runtime = "nodejs";

// Admin "Common Profile Picture" campaigns. GET returns the campaigns (with live status
// + affected count) and the agency list (the "groups" you target). POST is an action
// router: create | update | cancel | delete.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return fail("Administrator access required", 403);
  const [campaigns, agencies] = await Promise.all([listAvatarCampaigns(), listAgenciesForAdmin()]);
  return ok({
    campaigns,
    agencies: agencies.map((a) => ({ id: a.id, name: a.name, agencyId: a.agencyId, members: a.memberCount })),
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return fail("Administrator access required", 403);
  const body = await readJson<Partial<AvatarCampaign> & { action?: string; id?: string }>(req);
  const action = body.action;

  if (action === "create") {
    const r = await createAvatarCampaign(body, user.fullName);
    return r.ok ? ok({ id: r.id }, 201) : fail(r.error ?? "Could not create the campaign", 400);
  }
  if (!body.id) return fail("Campaign id is required");
  if (action === "update") {
    const r = await updateAvatarCampaign(String(body.id), body);
    return r.ok ? ok({ ok: true }) : fail(r.error ?? "Could not update", 400);
  }
  if (action === "cancel") {
    const r = await cancelAvatarCampaign(String(body.id), user.fullName);
    return r.ok ? ok({ ok: true }) : fail(r.error ?? "Could not cancel", 400);
  }
  if (action === "delete") {
    await deleteAvatarCampaign(String(body.id), user.fullName);
    return ok({ ok: true });
  }
  return fail("Unknown action");
}
