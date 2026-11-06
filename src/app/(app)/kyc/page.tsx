"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { FileUploadButton } from "@/components/FileUploadButton";
import { fetchMyKyc, submitKyc, kycDocTypes, kycMandatoryDocs, KYC_DOCS_BY_COUNTRY, type MyKyc, type KycStatus } from "@/lib/kyc";
import type { UploadedFile } from "@/lib/upload";
import { ShieldCheck, ArrowLeft, IdCard, Landmark, Camera, FileText, Clock, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

const STATUS_META: Record<KycStatus, { label: string; tone: string; Icon: typeof Clock }> = {
  unverified: { label: "Not started", tone: "bg-white/[0.06] text-mist-400", Icon: ShieldCheck },
  pending: { label: "Pending review", tone: "bg-amber-500/15 text-amber-300", Icon: Clock },
  verified: { label: "Verified", tone: "bg-emerald-500/15 text-emerald-300", Icon: CheckCircle2 },
  rejected: { label: "Rejected", tone: "bg-rose-500/15 text-rose-300", Icon: XCircle },
  resubmit: { label: "Re-submission required", tone: "bg-amber-500/15 text-amber-300", Icon: RefreshCw },
};

const field = "h-11 w-full rounded-xl border border-line bg-ink-900 px-3.5 text-sm text-mist-100 outline-none placeholder:text-mist-500 focus:border-lotus-400";

export default function KycPage() {
  const { toast } = useToast();
  const [kyc, setKyc] = useState<MyKyc | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // identity
  const [country, setCountry] = useState("India");
  const docTypes = kycDocTypes(country);
  const mandatory = kycMandatoryDocs(country);
  const [idType, setIdType] = useState(docTypes[0]);
  const [idNumber, setIdNumber] = useState("");
  const [legalName, setLegalName] = useState("");
  const [idFront, setIdFront] = useState<UploadedFile | null>(null);
  const [idBack, setIdBack] = useState<UploadedFile | null>(null);
  const [selfie, setSelfie] = useState<UploadedFile | null>(null);
  // bank
  const [bank, setBank] = useState({ accountHolder: "", bankName: "", accountNumber: "", iban: "", branch: "", swift: "" });
  // supporting bank doc
  const [bankDoc, setBankDoc] = useState<UploadedFile | null>(null);
  const [bankDocKind, setBankDocKind] = useState<"passbook" | "statement" | "cheque">("passbook");

  const load = () => fetchMyKyc().then((d) => {
    setKyc(d); setLoading(false);
    if (d) {
      setIdType(d.idType || kycDocTypes(country)[0]); setIdNumber(d.idNumber || ""); setLegalName(d.legalName || "");
      if (d.bank) setBank({ accountHolder: d.bank.accountHolder || "", bankName: d.bank.bankName || "", accountNumber: d.bank.accountNumber || "", iban: d.bank.iban || "", branch: d.bank.branch || "", swift: d.bank.swift || "" });
    }
  });
  useEffect(() => { load(); }, []);

  const status = kyc?.status ?? "unverified";
  const meta = STATUS_META[status];
  const locked = status === "pending" || status === "verified";

  const submit = async () => {
    if (!idNumber.trim()) { toast("Enter your document number", "error"); return; }
    const docs: { kind: string; name: string; url: string; originalName: string }[] = [];
    for (const [kind, f] of [["id_front", idFront], ["id_back", idBack], ["selfie", selfie], [bankDocKind, bankDoc]] as const) {
      if (f) docs.push({ kind, name: f.name, url: f.url, originalName: f.originalName });
    }
    const alreadyHasId = (kyc?.documents ?? []).some((d) => d.kind === "id_front");
    const alreadyHasSelfie = (kyc?.documents ?? []).some((d) => d.kind === "selfie");
    if (!idFront && !alreadyHasId) { toast("Upload a photo of your ID (front)", "error"); return; }
    if (!selfie && !alreadyHasSelfie) { toast("Upload a selfie for verification", "error"); return; }

    setBusy(true);
    const res = await submitKyc({ legalName, idType, idNumber, documents: docs, bank });
    setBusy(false);
    if (!res.ok) { toast(res.error ?? "Could not submit", "error"); return; }
    toast("KYC submitted — we'll review it shortly ✅", "success");
    setIdFront(null); setIdBack(null); setSelfie(null); setBankDoc(null);
    load();
  };

  if (loading) return <div className="py-20 text-center text-sm text-mist-500">Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/wallet" className="grid size-9 place-items-center rounded-lg border border-line bg-ink-800 text-mist-300 hover:text-mist-100"><ArrowLeft className="size-4" /></Link>
        <div className="flex-1">
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><ShieldCheck className="size-6 text-lotus-300" /> KYC &amp; Bank Verification</h1>
          <p className="text-sm text-mist-400">Verify your identity &amp; bank account to withdraw your earnings.</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${meta.tone}`}><meta.Icon className="size-3.5" /> {meta.label}</span>
      </div>

      {/* Status banners */}
      {status === "verified" && (
        <Card className="flex items-center gap-3 border-emerald-500/25 bg-emerald-500/[0.06] p-4">
          <CheckCircle2 className="size-5 text-emerald-300" />
          <p className="text-sm text-mist-200">Your identity is verified. You can request withdrawals from your <Link href="/wallet" className="font-semibold text-emerald-300 underline">wallet</Link>.</p>
        </Card>
      )}
      {(status === "rejected" || status === "resubmit") && kyc?.note && (
        <Card className="flex items-start gap-3 border-rose-500/25 bg-rose-500/[0.06] p-4">
          <XCircle className="mt-0.5 size-5 shrink-0 text-rose-300" />
          <p className="text-sm text-mist-200"><span className="font-semibold">Reviewer note:</span> {kyc.note}</p>
        </Card>
      )}
      {status === "pending" && (
        <Card className="flex items-center gap-3 border-amber-500/25 bg-amber-500/[0.06] p-4">
          <Clock className="size-5 text-amber-300" />
          <p className="text-sm text-mist-200">Your documents are under review. You&apos;ll be notified once a decision is made.</p>
        </Card>
      )}

      {/* Previously uploaded documents */}
      {(kyc?.documents?.length ?? 0) > 0 && (
        <Card className="p-5">
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-mist-100"><FileText className="size-4 text-lotus-300" /> Submitted documents</h2>
          <div className="flex flex-wrap gap-2">
            {kyc!.documents!.map((d) => (
              <a key={d.name} href={d.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink-900 px-3 py-1.5 text-xs text-mist-200 hover:border-lotus-400/40">
                <FileText className="size-3.5" /> {d.kind.replace(/_/g, " ")}
              </a>
            ))}
          </div>
        </Card>
      )}

      {/* Identity */}
      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-semibold text-mist-100"><IdCard className="size-4 text-lotus-300" /> Identity verification</h2>
        <p className="mt-1 text-xs text-mist-400">Upload a government-issued ID and a selfie. {locked && "Submitted — editing is locked while under review."}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-mist-300">Country</label>
            <select disabled={locked} value={country} onChange={(e) => { setCountry(e.target.value); setIdType(kycDocTypes(e.target.value)[0]); }} className={`${field} mt-1 appearance-none disabled:opacity-60`}>
              {[...Object.keys(KYC_DOCS_BY_COUNTRY), "Other"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-mist-300">Document type</label>
            <select disabled={locked} value={idType} onChange={(e) => setIdType(e.target.value)} className={`${field} mt-1 appearance-none disabled:opacity-60`}>
              {docTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {mandatory.length > 0 && <p className="sm:col-span-2 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">🇮🇳 For India, <b>{mandatory.join(" + ")}</b> are required before withdrawals can be approved. Submit each one (you can re-open this form to add more documents).</p>}
          <div>
            <label className="block text-xs font-semibold text-mist-300">Document number</label>
            <input disabled={locked} value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="ID / Passport number" className={`${field} mt-1 disabled:opacity-60`} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-mist-300">Full legal name (as on the document)</label>
            <input disabled={locked} value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Your full legal name" className={`${field} mt-1 disabled:opacity-60`} />
          </div>
        </div>

        {!locked && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div><label className="mb-1 block text-xs font-semibold text-mist-300">ID front *</label><FileUploadButton kind="id_front" label="ID front" value={idFront} onChange={setIdFront} /></div>
            <div><label className="mb-1 block text-xs font-semibold text-mist-300">ID back</label><FileUploadButton kind="id_back" label="ID back" value={idBack} onChange={setIdBack} /></div>
            <div><label className="mb-1 flex items-center gap-1 text-xs font-semibold text-mist-300"><Camera className="size-3" /> Selfie *</label><FileUploadButton kind="selfie" label="selfie" value={selfie} onChange={setSelfie} /></div>
          </div>
        )}
      </Card>

      {/* Bank details */}
      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-semibold text-mist-100"><Landmark className="size-4 text-emerald-300" /> Bank account details</h2>
        <p className="mt-1 text-xs text-mist-400">Where your withdrawals will be paid. {kyc?.bank?.status === "verified" && <span className="font-semibold text-emerald-300">Bank verified ✓</span>}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {([
            ["accountHolder", "Account holder name"],
            ["bankName", "Bank name"],
            ["accountNumber", "Account number"],
            ["iban", "IBAN number"],
            ["branch", "Branch name"],
            ["swift", "SWIFT / IFSC code"],
          ] as const).map(([key, label]) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-mist-300">{label}</label>
              <input disabled={locked} value={bank[key]} onChange={(e) => setBank((b) => ({ ...b, [key]: e.target.value }))} placeholder={label} className={`${field} mt-1 disabled:opacity-60`} />
            </div>
          ))}
        </div>

        {!locked && (
          <div className="mt-4">
            <label className="mb-1 block text-xs font-semibold text-mist-300">Supporting document (optional)</label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select value={bankDocKind} onChange={(e) => setBankDocKind(e.target.value as typeof bankDocKind)} className={`${field} sm:w-48 appearance-none`}>
                <option value="passbook">Bank passbook</option>
                <option value="statement">Bank statement</option>
                <option value="cheque">Cancelled cheque</option>
              </select>
              <div className="flex-1"><FileUploadButton kind={bankDocKind} label="document" value={bankDoc} onChange={setBankDoc} /></div>
            </div>
          </div>
        )}
      </Card>

      {!locked ? (
        <Button size="lg" block onClick={submit} disabled={busy}>
          <ShieldCheck className="size-5" /> {busy ? "Submitting…" : status === "resubmit" || status === "rejected" ? "Re-submit for verification" : "Submit for verification"}
        </Button>
      ) : (
        <p className="text-center text-xs text-mist-500">Your submission is locked while {status === "verified" ? "verified" : "under review"}. Contact support to make changes.</p>
      )}
    </div>
  );
}
