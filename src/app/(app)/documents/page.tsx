"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { FileUploadButton } from "@/components/FileUploadButton";
import { fetchMyDocRequests, submitDocument, DOC_STATUS_META, type DocRequest } from "@/lib/documents";
import type { UploadedFile } from "@/lib/upload";
import { FileText, Clock, CheckCircle2, History, Paperclip, AlertTriangle } from "lucide-react";

function fmt(s?: string) { return s ? new Date(s).toLocaleString("en-SA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; }
function fmtDate(s?: string) { return s ? new Date(s).toLocaleDateString("en-SA", { day: "numeric", month: "short", year: "numeric" }) : ""; }

export default function MyDocumentsPage() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<DocRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => fetchMyDocRequests().then((r) => { setRequests(r); setLoading(false); });
  useEffect(() => { load(); }, []);

  const pending = requests.filter((r) => ["pending", "resubmit", "rejected"].includes(r.status));
  const done = requests.filter((r) => !["pending", "resubmit", "rejected"].includes(r.status));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><FileText className="size-6 text-lotus-300" /> My Documents</h1>
        <p className="text-sm text-mist-400">Upload documents requested by the team and track their status.</p>
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-mist-500">Loading…</p>
      ) : requests.length === 0 ? (
        <Card className="p-10 text-center text-sm text-mist-500"><FileText className="mx-auto mb-2 size-7 text-mist-600" />No document requests yet. When the team asks for a document, it appears here.</Card>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-mist-200"><Clock className="size-4 text-amber-300" /> Action needed</h2>
              {pending.map((r) => <DocCard key={r.id} req={r} onDone={load} />)}
            </div>
          )}
          {done.length > 0 && (
            <div className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-mist-200"><CheckCircle2 className="size-4 text-emerald-300" /> Submitted &amp; reviewed</h2>
              {done.map((r) => <DocCard key={r.id} req={r} onDone={load} />)}
            </div>
          )}
        </>
      )}
    </div>
  );

  function DocCard({ req, onDone }: { req: DocRequest; onDone: () => void }) {
    const [file, setFile] = useState<UploadedFile | null>(null);
    const [comment, setComment] = useState("");
    const [busy, setBusy] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const meta = DOC_STATUS_META[req.status];
    const canSubmit = ["pending", "resubmit", "rejected"].includes(req.status);
    const overdue = req.dueDate && canSubmit && new Date(req.dueDate).getTime() < Date.now();

    const submit = async () => {
      if (!file) { toast("Upload a file first", "error"); return; }
      setBusy(true);
      const res = await submitDocument(req.id, file, comment);
      setBusy(false);
      if (!res.ok) { toast(res.error ?? "Could not submit", "error"); return; }
      toast("Document submitted ✅", "success");
      setFile(null); setComment("");
      onDone();
    };

    return (
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-mist-100">{req.title}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.tone}`}>{meta.label}</span>
              {req.mandatory && <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-300">Required</span>}
            </div>
            <p className="mt-0.5 text-xs text-mist-500">{req.type}{req.dueDate ? ` · due ${fmtDate(req.dueDate)}` : ""} · requested by {req.requestedBy}</p>
            {req.description && <p className="mt-1.5 text-sm text-mist-300">{req.description}</p>}
          </div>
          <button onClick={() => setShowHistory((s) => !s)} className="inline-flex items-center gap-1 text-[11px] text-mist-400 hover:text-mist-200"><History className="size-3.5" /> History</button>
        </div>

        {overdue && <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-amber-300"><AlertTriangle className="size-3.5" /> This request is past its due date.</p>}

        {req.remarks && (req.status === "rejected" || req.status === "resubmit") && (
          <p className="mt-2 rounded-lg bg-rose-500/[0.08] px-3 py-2 text-xs text-mist-200"><span className="font-semibold text-rose-300">Admin note:</span> {req.remarks}</p>
        )}

        {/* Latest submission */}
        {req.submissions.length > 0 && (
          <div className="mt-2 space-y-1">
            {req.submissions.slice(-2).map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink-900 px-2.5 py-1.5 text-xs text-mist-200 hover:border-lotus-400/40">
                <Paperclip className="size-3.5" /> {s.originalName} <span className="text-mist-500">· {fmt(s.at)}</span>
              </a>
            ))}
          </div>
        )}

        {/* Upload form */}
        {canSubmit && (
          <div className="mt-3 space-y-2 rounded-xl border border-white/8 bg-ink-900/50 p-3">
            <FileUploadButton kind="document" label="document (PDF, JPG, PNG, DOC)" value={file} onChange={setFile} />
            <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment (optional)" className="h-10 w-full rounded-lg border border-line bg-ink-900 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400" />
            <Button size="sm" onClick={submit} disabled={busy || !file}><Paperclip className="size-4" /> {busy ? "Submitting…" : "Submit document"}</Button>
          </div>
        )}

        {showHistory && (
          <div className="mt-3 space-y-1 border-t border-white/8 pt-2">
            {req.history.map((h, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px] text-mist-400"><span className="shrink-0 text-mist-600">{fmt(h.at)}</span><span>{h.action} — {h.by}</span></div>
            ))}
          </div>
        )}
      </Card>
    );
  }
}
