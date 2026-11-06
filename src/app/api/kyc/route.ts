import { ok, fail, readJson } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getMyKyc, submitKyc, notifyAdmins, getUpload } from "@/server/repo";
import type { KycDoc, BankDetails } from "@/server/db";

export const runtime = "nodejs";

const DOC_KINDS = ["id_front", "id_back", "selfie", "passbook", "statement", "cheque"];

// A user's own KYC + bank verification status.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);
  return ok({ kyc: await getMyKyc(user.id) });
}

// Submit / re-submit KYC: identity, selfie + bank details (with uploaded files).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Please log in first", 401);

  const body = await readJson<{
    legalName?: string; idType?: string; idNumber?: string;
    documents?: { kind: string; name: string; url: string; originalName: string }[];
    bank?: BankDetails;
  }>(req);

  const idType = typeof body.idType === "string" ? body.idType.slice(0, 40) : "";
  const idNumber = typeof body.idNumber === "string" ? body.idNumber.trim().slice(0, 40) : "";
  const legalName = typeof body.legalName === "string" ? body.legalName.trim().slice(0, 80) : "";

  if (!idType) return fail("Choose a document type");
  if (!idNumber) return fail("Enter your document number");

  // Validate the uploaded documents actually belong to this user.
  const documents: KycDoc[] = [];
  for (const d of body.documents ?? []) {
    if (!d || !DOC_KINDS.includes(d.kind) || typeof d.name !== "string") continue;
    const rec = await getUpload(d.name);
    if (!rec || rec.ownerId !== user.id) return fail("One of the uploaded files is invalid — please re-upload");
    documents.push({ kind: d.kind, name: d.name, url: `/api/file/${d.name}`, originalName: rec.originalName, at: new Date().toISOString() });
  }

  // Require an ID document + a selfie for a first identity submission.
  const existing = await getMyKyc(user.id);
  const hasIdNow = documents.some((d) => d.kind === "id_front") || (existing.documents ?? []).some((d) => d.kind === "id_front");
  const hasSelfieNow = documents.some((d) => d.kind === "selfie") || (existing.documents ?? []).some((d) => d.kind === "selfie");
  if (!hasIdNow) return fail("Please upload a photo of your ID (front)");
  if (!hasSelfieNow) return fail("Please upload a selfie for verification");

  const bank: BankDetails = {
    accountHolder: body.bank?.accountHolder?.slice(0, 80),
    bankName: body.bank?.bankName?.slice(0, 80),
    accountNumber: body.bank?.accountNumber?.slice(0, 40),
    iban: body.bank?.iban?.slice(0, 40),
    branch: body.bank?.branch?.slice(0, 80),
    swift: body.bank?.swift?.slice(0, 30),
  };

  const res = await submitKyc(user.id, { legalName, idType, idNumber, documents, bank });
  if (!res.ok) return fail(res.error ?? "Could not submit KYC", 400);

  await notifyAdmins(`🪪 New KYC submission from ${res.userName} — pending review.`, { label: "Review", href: "/admin/transactions" });
  return ok({ ok: true });
}
