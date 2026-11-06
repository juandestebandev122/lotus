import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { listKyc, setKyc, setKycBank, adminEditKyc, addAdminLog } from "@/server/repo";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);
  return ok({ users: await listKyc() });
}

// Update a user's KYC identity status OR their bank-details status.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  if (user.role !== "admin") return fail("Administrator access required", 403);

  const body = await readJson<{ userId?: string; status?: string; note?: string; target?: string; patch?: Record<string, unknown> }>(req);
  const note = typeof body.note === "string" ? body.note.slice(0, 240) : "";
  if (!body.userId) return fail("User is required");

  // EDIT the submitted identity + bank fields (admin correcting details).
  if (body.target === "edit") {
    const p = body.patch ?? {};
    const res = await adminEditKyc(String(body.userId), {
      legalName: typeof p.legalName === "string" ? p.legalName : undefined,
      idType: typeof p.idType === "string" ? p.idType : undefined,
      idNumber: typeof p.idNumber === "string" ? p.idNumber : undefined,
      bank: p.bank && typeof p.bank === "object" ? (p.bank as Record<string, string>) : undefined,
    }, user.fullName);
    if (!res.ok) return fail(res.error ?? "Could not edit KYC", 400);
    if (res.changes && res.changes.length) await addAdminLog(user.fullName, `Edited KYC details for a user — ${res.changes.join("; ")}`);
    return ok({ ok: true, changes: res.changes ?? [] });
  }

  // Bank-details decision (separate from identity verification).
  if (body.target === "bank") {
    const bankStatus = body.status as "verified" | "rejected" | "pending" | undefined;
    if (!bankStatus || !["verified", "rejected", "pending"].includes(bankStatus)) return fail("Valid bank status required");
    const res = await setKycBank(String(body.userId), bankStatus, note, user.fullName);
    if (!res.ok) return fail(res.error ?? "Could not update bank status", 400);
    await addAdminLog(user.fullName, `Set bank details to "${bankStatus}" for a user`);
    return ok({ ok: true });
  }

  // Identity (KYC) decision.
  const status = body.status as "unverified" | "pending" | "verified" | "rejected" | "resubmit" | undefined;
  if (!status || !["unverified", "pending", "verified", "rejected", "resubmit"].includes(status)) {
    return fail("A valid status is required");
  }
  const res = await setKyc(String(body.userId), status, note, user.fullName);
  if (!res.ok) return fail(res.error ?? "Could not update KYC", 400);
  await addAdminLog(user.fullName, `Set KYC to "${status}" for a user`);
  return ok({ ok: true });
}
