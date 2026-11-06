"use client";

import { useRef, useState } from "react";
import { uploadFile, ACCEPTED_UPLOAD, type UploadedFile } from "@/lib/upload";
import { useToast } from "@/components/ui/Toast";
import { Upload, FileCheck2, Loader2, X } from "lucide-react";

/**
 * A single-file upload control. Shows the chosen file once uploaded and lets the
 * user replace/remove it. Reused by KYC and the Document Request module.
 */
export function FileUploadButton({
  kind,
  label,
  value,
  onChange,
  accept = ACCEPTED_UPLOAD,
}: {
  kind: string;
  label: string;
  value?: UploadedFile | null;
  onChange: (file: UploadedFile | null) => void;
  accept?: string;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = () => inputRef.current?.click();

  const onFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    const res = await uploadFile(file, kind);
    setBusy(false);
    if (!res.ok || !res.file) { toast(res.error ?? "Upload failed", "error"); return; }
    onChange(res.file);
    toast(`${label} uploaded`, "success");
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }}
      />
      {value ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2.5">
          <FileCheck2 className="size-4 shrink-0 text-emerald-300" />
          <span className="min-w-0 flex-1 truncate text-sm text-mist-100">{value.originalName}</span>
          <button type="button" onClick={pick} className="text-xs font-semibold text-lotus-300 hover:text-lotus-200">Replace</button>
          <button type="button" onClick={() => onChange(null)} aria-label="Remove" className="text-mist-400 hover:text-rose-300"><X className="size-4" /></button>
        </div>
      ) : (
        <button
          type="button"
          onClick={pick}
          disabled={busy}
          className="flex w-full items-center gap-2 rounded-xl border border-dashed border-line bg-ink-900 px-3 py-2.5 text-left text-sm text-mist-400 transition hover:border-lotus-400/50 hover:text-mist-200 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {busy ? "Uploading…" : `Upload ${label}`}
        </button>
      )}
    </div>
  );
}
