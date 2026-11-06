"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { fetchKyc, setKycStatus, setKycBankStatus, editKyc, type KycView } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { ShieldCheck, ShieldX, Clock, Banknote, X, FileText, Landmark, RefreshCw, Search, Download, Pencil, Save } from "lucide-react";

const STATUS_TONE: Record<string, string> = {
  verified: "bg-emerald-500/15 text-emerald-300",
  pending: "bg-amber-500/15 text-amber-300",
  rejected: "bg-rose-500/15 text-rose-300",
  resubmit: "bg-amber-500/15 text-amber-300",
  unverified: "bg-white/[0.06] text-mist-400",
};

const DOC_LABEL: Record<string, string> = {
  id_front: "ID front", id_back: "ID back", selfie: "Selfie", passbook: "Bank passbook", statement: "Bank statement", cheque: "Cancelled cheque",
};

export function KycPanel() {
  const { toast } = useToast();
  const [users, setUsers] = useState<KycView[]>([]);
  const [filter, setFilter] = useState<string>("pending"); // all | pending | verified | rejected | resubmit | unverified | paid
  const [q, setQ] = useState("");
  const [review, setReview] = useState<KycView | null>(null);

  const load = () => fetchKyc().then(setUsers);
  useEffect(() => { load(); }, []);

  const needsReview = (s: string) => s === "pending" || s === "resubmit";
  const counts = {
    total: users.length,
    pending: users.filter((u) => u.kyc.status === "pending").length,
    resubmit: users.filter((u) => u.kyc.status === "resubmit").length,
    verified: users.filter((u) => u.kyc.status === "verified").length,
    rejected: users.filter((u) => u.kyc.status === "rejected").length,
    unverified: users.filter((u) => u.kyc.status === "unverified").length,
    paid: users.filter((u) => u.purchasedINR > 0).length,
  };
  const ql = q.trim().toLowerCase();
  const shown = users.filter((u) => {
    if (filter === "paid") { if (!(u.purchasedINR > 0)) return false; }
    else if (filter === "pending") { if (!needsReview(u.kyc.status)) return false; }
    else if (["verified", "rejected", "resubmit", "unverified"].includes(filter)) { if (u.kyc.status !== filter) return false; }
    if (ql && !`${u.fullName} ${u.email ?? ""} ${u.phone ?? ""} ${u.kyc.idType ?? ""} ${u.id}`.toLowerCase().includes(ql)) return false;
    return true;
  });

  const cards: { key: string; label: string; n: number; tone: string }[] = [
    { key: "all", label: "Total requests", n: counts.total, tone: "text-mist-100" },
    { key: "pending", label: "Pending / review", n: counts.pending + counts.resubmit, tone: "text-amber-300" },
    { key: "verified", label: "Approved", n: counts.verified, tone: "text-emerald-300" },
    { key: "rejected", label: "Rejected", n: counts.rejected, tone: "text-rose-300" },
    { key: "resubmit", label: "Resubmission", n: counts.resubmit, tone: "text-sky-300" },
    { key: "paid", label: "Paid real money", n: counts.paid, tone: "text-lotus-300" },
  ];
  const exportCsv = () => {
    const rows = [["User ID", "Name", "Email", "Mobile", "Document", "Status", "Bank status", "Spent (real)", "Reviewed"], ...shown.map((u) => [u.id, u.fullName, u.email ?? "", u.phone ?? "", u.kyc.idType ?? "", u.kyc.status, u.kyc.bank?.status ?? "", String(u.purchasedINR), u.kyc.reviewedAt ?? ""])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `kyc-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Clickable KYC summary dashboard */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <button key={c.key} onClick={() => setFilter(c.key)} className={cn("rounded-xl border p-3 text-left transition", filter === c.key ? "border-lotus-400 bg-lotus-500/10" : "border-line bg-ink-800/50 hover:border-white/20")}>
            <div className={cn("font-display text-2xl font-extrabold", c.tone)}>{c.n}</div>
            <div className="text-[11px] text-mist-400">{c.label}</div>
          </button>
        ))}
      </div>

      {/* Search + export */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-2"><Search className="size-3.5 text-mist-500" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, mobile, ID…" className="h-9 w-56 bg-transparent text-sm text-mist-100 outline-none" /></div>
        <span className="text-xs text-mist-500">Showing {shown.length} · filter: <b className="capitalize text-mist-300">{filter}</b></span>
        {(filter !== "pending" || q) && <button onClick={() => { setFilter("pending"); setQ(""); }} className="text-xs text-lotus-300 hover:text-lotus-200">Reset</button>}
        <Button size="sm" variant="secondary" className="ml-auto" onClick={exportCsv}><Download className="size-4" /> Export</Button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-mist-500">
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Spent (real ₹)</th>
                <th className="px-4 py-3 font-semibold">KYC status</th>
                <th className="px-4 py-3 font-semibold">Reviewed</th>
                <th className="px-4 py-3 text-right font-semibold">Review</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3"><Link href={`/admin/users?q=${encodeURIComponent(u.id)}`} className="flex items-center gap-3 hover:opacity-90"><Avatar name={u.fullName} size="sm" /><div><div className="font-semibold text-mist-100 hover:text-lotus-300">{u.fullName} <span className="font-mono text-[10px] text-mist-600">{u.id}</span></div><div className="text-xs text-mist-500">{u.email || "—"}{u.phone ? ` · ${u.phone}` : ""}</div></div></Link></td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-emerald-300">{u.purchasedINR > 0 ? `₹${u.purchasedINR.toLocaleString("en-SA")}` : "—"}</td>
                  <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", STATUS_TONE[u.kyc.status])}>{u.kyc.status}</span></td>
                  <td className="px-4 py-3 text-xs text-mist-400">{u.kyc.reviewedAt ? new Date(u.kyc.reviewedAt).toLocaleDateString("en-SA", { day: "numeric", month: "short" }) : "—"}</td>
                  <td className="px-4 py-3 text-right"><Button size="sm" variant="secondary" onClick={() => setReview(u)}>Review</Button></td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-mist-500">No users in this view.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {review && <KycModal user={review} onClose={() => setReview(null)} onSaved={() => { setReview(null); load(); toast("KYC status updated", "success"); }} />}
    </div>
  );
}

function KycModal({ user, onClose, onSaved }: { user: KycView; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [note, setNote] = useState(user.kyc.note ?? "");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const k = user.kyc;
  const [ed, setEd] = useState({
    legalName: k.legalName ?? "", idType: k.idType ?? "", idNumber: k.idNumber ?? "",
    accountHolder: k.bank?.accountHolder ?? "", bankName: k.bank?.bankName ?? "", accountNumber: k.bank?.accountNumber ?? "",
    iban: k.bank?.iban ?? "", branch: k.bank?.branch ?? "", swift: k.bank?.swift ?? "",
  });
  const field = "h-11 w-full rounded-xl border border-line bg-ink-900 px-3.5 text-sm text-mist-100 outline-none focus:border-lotus-400";
  const bank = k.bank;
  const bankRows: [string, string | undefined][] = [
    ["Account holder", bank?.accountHolder], ["Bank name", bank?.bankName], ["Account number", bank?.accountNumber],
    ["IBAN", bank?.iban], ["Branch", bank?.branch], ["SWIFT / IFSC", bank?.swift],
  ];
  const hasBank = bankRows.some(([, v]) => v);

  const set = async (status: KycView["kyc"]["status"]) => {
    setBusy(true);
    const ok = await setKycStatus(user.id, status, note);
    setBusy(false);
    if (ok) onSaved();
    else toast("Could not update", "error");
  };
  const setBank = async (status: "verified" | "rejected" | "pending") => {
    setBusy(true);
    const ok = await setKycBankStatus(user.id, status, note);
    setBusy(false);
    if (ok) onSaved();
    else toast("Could not update bank status", "error");
  };
  const saveEdit = async () => {
    setBusy(true);
    const ok = await editKyc(user.id, { legalName: ed.legalName, idType: ed.idType, idNumber: ed.idNumber, bank: { accountHolder: ed.accountHolder, bankName: ed.bankName, accountNumber: ed.accountNumber, iban: ed.iban, branch: ed.branch, swift: ed.swift } });
    setBusy(false);
    if (ok) { toast("KYC details updated", "success"); onSaved(); }
    else toast("Could not save edits", "error");
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-lg rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-mist-100">KYC review — {user.fullName}</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing((v) => !v)} className={cn("inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition", editing ? "bg-lotus-500/20 text-lotus-200" : "bg-white/[0.06] text-mist-300 hover:text-mist-100")}><Pencil className="size-3.5" /> {editing ? "Editing…" : "Edit details"}</button>
            <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
          </div>
        </div>

        {/* Admin EDIT form — correct the submitted identity + bank details. */}
        {editing && (
          <div className="mb-3 space-y-2 rounded-xl border border-lotus-400/30 bg-lotus-500/[0.06] p-3">
            <p className="text-xs font-bold text-lotus-200">Edit submitted details</p>
            <div className="grid grid-cols-2 gap-2">
              <input value={ed.legalName} onChange={(e) => setEd({ ...ed, legalName: e.target.value })} placeholder="Legal name" className={cn(field, "col-span-2")} />
              <input value={ed.idType} onChange={(e) => setEd({ ...ed, idType: e.target.value })} placeholder="Document type" className={field} />
              <input value={ed.idNumber} onChange={(e) => setEd({ ...ed, idNumber: e.target.value })} placeholder="Document number" className={field} />
            </div>
            <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-mist-500">Bank details</p>
            <div className="grid grid-cols-2 gap-2">
              <input value={ed.accountHolder} onChange={(e) => setEd({ ...ed, accountHolder: e.target.value })} placeholder="Account holder" className={field} />
              <input value={ed.bankName} onChange={(e) => setEd({ ...ed, bankName: e.target.value })} placeholder="Bank name" className={field} />
              <input value={ed.accountNumber} onChange={(e) => setEd({ ...ed, accountNumber: e.target.value })} placeholder="Account number" className={field} />
              <input value={ed.iban} onChange={(e) => setEd({ ...ed, iban: e.target.value })} placeholder="IBAN" className={field} />
              <input value={ed.branch} onChange={(e) => setEd({ ...ed, branch: e.target.value })} placeholder="Branch" className={field} />
              <input value={ed.swift} onChange={(e) => setEd({ ...ed, swift: e.target.value })} placeholder="SWIFT / IFSC" className={field} />
            </div>
            <Button size="sm" onClick={saveEdit} disabled={busy}><Save className="size-4" /> Save edits</Button>
            <p className="text-[10px] text-mist-500">Every edit is recorded in the admin audit log (before → after).</p>
          </div>
        )}

        {/* Identity summary */}
        <div className="mb-3 space-y-1 rounded-xl bg-white/[0.04] p-3 text-sm">
          <div className="flex justify-between"><span className="text-mist-400">Email / phone</span><span className="text-mist-200">{user.email || user.phone || "—"}</span></div>
          <div className="flex justify-between"><span className="text-mist-400">Legal name</span><span className="text-mist-200">{k.legalName || "—"}</span></div>
          <div className="flex justify-between"><span className="text-mist-400">Document</span><span className="text-mist-200">{k.idType || "—"} {k.idNumber ? `· ${k.idNumber}` : ""}</span></div>
          <div className="flex justify-between"><span className="text-mist-400">Real money spent</span><span className="font-semibold text-emerald-300">{user.purchasedINR > 0 ? `₹${user.purchasedINR.toLocaleString("en-SA")}` : "—"}</span></div>
          <div className="flex justify-between"><span className="text-mist-400">Identity status</span><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", STATUS_TONE[k.status])}>{k.status}</span></div>
        </div>

        {/* Documents */}
        <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-mist-500"><FileText className="size-3.5" /> Documents</h3>
        {(k.documents?.length ?? 0) === 0 ? (
          <p className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-mist-500">No documents uploaded yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {k.documents!.map((d) => (
              <a key={d.name} href={d.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink-900 px-3 py-1.5 text-xs text-mist-200 hover:border-lotus-400/40">
                <FileText className="size-3.5 text-lotus-300" /> {DOC_LABEL[d.kind] ?? d.kind}
              </a>
            ))}
          </div>
        )}

        {/* Bank details */}
        <h3 className="mb-1.5 mt-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-mist-500"><Landmark className="size-3.5" /> Bank details {bank?.status && <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize", STATUS_TONE[bank.status])}>{bank.status}</span>}</h3>
        {!hasBank ? (
          <p className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-mist-500">No bank details submitted.</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-xl bg-white/[0.04] p-3 text-sm">
            {bankRows.filter(([, v]) => v).map(([label, v]) => (
              <div key={label} className="flex flex-col"><span className="text-[10px] uppercase tracking-wide text-mist-500">{label}</span><span className="truncate text-mist-100">{v}</span></div>
            ))}
          </div>
        )}
        {hasBank && (
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setBank("rejected")} disabled={busy}><ShieldX className="size-3.5" /> Reject bank</Button>
            <Button size="sm" onClick={() => setBank("verified")} disabled={busy}><ShieldCheck className="size-3.5" /> Approve bank</Button>
          </div>
        )}

        {/* Reviewer note + identity decisions */}
        <label className="mt-4 block text-xs font-semibold text-mist-300">Reviewer note (sent to the user)</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. ID matched / blurry document / name mismatch" className={cn(field, "mt-1")} />

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button variant="secondary" onClick={() => set("resubmit")} disabled={busy}><RefreshCw className="size-4" /> Resubmit</Button>
          <Button variant="secondary" onClick={() => set("pending")} disabled={busy}><Clock className="size-4" /> Pending</Button>
          <Button variant="danger" onClick={() => set("rejected")} disabled={busy}><ShieldX className="size-4" /> Reject</Button>
          <Button onClick={() => set("verified")} disabled={busy}><ShieldCheck className="size-4" /> Verify</Button>
        </div>
      </div>
    </div>
  );
}
