import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getConfig, getPaidZoneMember, requestPaidZone, paidZoneDirectory, sweepPaidZoneRenewals, isPaidZoneActive, getPaidZoneProfile, updatePaidZoneProfile } from "@/server/repo";

export const runtime = "nodejs";

// My Paid Zone status + (if active) the public member directory + prices.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  await sweepPaidZoneRenewals(); // process any due monthly renewals (throttled)
  const cfg = await getConfig();
  if (cfg.membership?.subscriberFeatures?.paidZone && !user.vip && user.role !== "admin") {
    return fail("Paid Zone is available to paid subscribers only.", 403);
  }
  const me = await getPaidZoneMember(user.id);
  // Super Admin / Admin can always open the directory to monitor it — they don't
  // need to buy a membership first.
  const active = isPaidZoneActive(me) || user.role === "admin";
  const directory = active ? await paidZoneDirectory(user.id) : [];
  // The member's OWN separate Friend Zone profile (for the edit form).
  const fzProfile = me ? await getPaidZoneProfile(user.id) : null;
  const pz = cfg.paidZone;
  return ok({
    enabled: (pz?.enabled ?? true) && cfg.features?.paidZone !== false,
    joinCost: pz?.joinCost ?? 500,
    membership: { monthlyCoins: pz?.monthlyCoins ?? 0, renewalDays: pz?.renewalDays ?? 30, autoRenew: pz?.autoRenew !== false },
    me: me
      ? {
          status: me.status,
          accountName: me.accountName,
          gender: me.gender,
          callInterest: me.callInterest,
          note: me.note ?? "",
          active,
          membershipActive: me.membershipActive !== false,
          renewAt: me.renewAt ?? null,
        }
      : null,
    fzProfile,
    directory,
  });
}

// POST — either a JOIN request, or (action:"profile") edit my separate Friend
// Zone profile. The profile edit never touches the login account.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  const cfg = await getConfig();
  if (cfg.membership?.subscriberFeatures?.paidZone && !user.vip && user.role !== "admin") {
    return fail("Paid Zone is available to paid subscribers only.", 403);
  }
  const b = await readJson<{ action?: string; realName?: string; accountName?: string; gender?: string; callInterest?: string; docUrl?: string; docName?: string; fzName?: string; fzUsername?: string; fzAvatar?: string; fzBio?: string; fzVisible?: boolean }>(req);

  if (b.action === "profile") {
    const res = await updatePaidZoneProfile(user.id, {
      fzName: b.fzName, fzUsername: b.fzUsername, fzAvatar: b.fzAvatar, fzBio: b.fzBio, fzVisible: b.fzVisible,
    });
    if (!res.ok) return fail(res.error ?? "Could not save your profile", 400);
    return ok({ ok: true });
  }

  const gender = b.gender === "male" || b.gender === "female" || b.gender === "other" ? b.gender : "other";
  const callInterest = b.callInterest === "audio" || b.callInterest === "video" || b.callInterest === "both" ? b.callInterest : "both";
  const res = await requestPaidZone(user.id, {
    realName: String(b.realName ?? ""),
    accountName: String(b.accountName ?? ""),
    gender,
    callInterest,
    docUrl: b.docUrl ? String(b.docUrl) : undefined,
    docName: b.docName ? String(b.docName) : undefined,
  });
  if (!res.ok) return fail(res.error ?? "Could not submit request", 400);
  return ok(res);
}
