"use client";

import { withBase } from "./base-path";

export interface UploadedFile {
  name: string;
  url: string;
  originalName: string;
  kind: string;
}

/** Documents (KYC / document requests). Chat uses its own narrower accepts. */
export const ACCEPTED_UPLOAD = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt";

/** Upload a single file to the secure store. `kind` tags it (e.g. "selfie"). */
export async function uploadFile(file: File, kind = "document"): Promise<{ ok: boolean; file?: UploadedFile; error?: string }> {
  try {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    const res = await fetch(withBase("/api/upload"), { method: "POST", credentials: "include", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (data.error as string) ?? "Upload failed" };
    return { ok: true, file: data as UploadedFile };
  } catch {
    return { ok: false, error: "Network error during upload" };
  }
}
