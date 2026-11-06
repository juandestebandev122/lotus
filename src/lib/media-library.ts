import { withBase } from "./base-path";

export interface MediaItem {
  id: string;
  kind: "audio" | "video" | "youtube" | "image";
  name: string;
  src: string;
  fileName?: string;
  category?: string;
  addedBy?: string;
  addedAt: string;
  durationSec?: number; // length in seconds (audio + video)
  sizeBytes?: number;   // uploaded file size
  thumb?: string;       // small base64 video frame (data URL)
}

export type MediaTypeKey = "audio" | "video" | "image";
export interface MediaTypeAccess { enabled: boolean; paid: boolean; price: number; unlocked: boolean }
export interface MediaAccess {
  libraryAccess: boolean;
  audio: MediaTypeAccess;
  video: MediaTypeAccess;
  image: MediaTypeAccess;
}
const FREE: MediaTypeAccess = { enabled: true, paid: false, price: 0, unlocked: true };
export const DEFAULT_MEDIA_ACCESS: MediaAccess = { libraryAccess: true, audio: FREE, video: FREE, image: FREE };

// ---- Room hosts / co-hosts: read the approved library to pick a track ----
export async function fetchMediaLibrary(): Promise<{ items: MediaItem[]; access: MediaAccess }> {
  try {
    const res = await fetch(withBase("/api/media-library"), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return { items: Array.isArray(d.items) ? d.items : [], access: d.access ?? DEFAULT_MEDIA_ACCESS };
  } catch {
    return { items: [], access: DEFAULT_MEDIA_ACCESS };
  }
}

// ---- Host/co-host uploads their OWN audio/video file to play in the room ----
export async function uploadRoomMedia(file: File, kind: "audio" | "video" | "image"): Promise<{ ok: boolean; url?: string; name?: string; error?: string }> {
  try {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    const res = await fetch(withBase("/api/room-media/upload"), { method: "POST", credentials: "include", body: fd });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: d.error ?? "Upload failed" };
    return { ok: true, url: d.url, name: d.name };
  } catch {
    return { ok: false, error: "Network error during upload" };
  }
}

// ---- A user buys access to a paid media type (audio/video/image) ----
export async function purchaseMediaAccess(type: MediaTypeKey): Promise<{ ok: boolean; error?: string; balance?: number; access?: MediaAccess }> {
  try {
    const res = await fetch(withBase("/api/media-library/purchase"), {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    const d = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, balance: d.balance, access: d.access } : { ok: false, error: d.error };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

// ---- Admin: manage the library ----
export async function fetchAdminMedia(): Promise<MediaItem[]> {
  try {
    const res = await fetch(withBase("/api/admin/media"), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return Array.isArray(d.items) ? d.items : [];
  } catch {
    return [];
  }
}

export async function uploadMediaFile(
  file: File, name: string, category: string,
  meta?: { durationSec?: number; sizeBytes?: number; thumb?: string },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", name);
    fd.append("category", category);
    if (meta?.durationSec) fd.append("durationSec", String(Math.round(meta.durationSec)));
    if (meta?.sizeBytes) fd.append("sizeBytes", String(Math.round(meta.sizeBytes)));
    if (meta?.thumb) fd.append("thumb", meta.thumb);
    const res = await fetch(withBase("/api/admin/media"), { method: "POST", credentials: "include", body: fd });
    const d = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, error: d.error };
  } catch {
    return { ok: false, error: "Upload failed" };
  }
}

export async function addMediaLink(kind: "audio" | "video", name: string, url: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/admin/media"), {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, name, url }),
    });
    const d = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, error: d.error };
  } catch {
    return { ok: false, error: "Could not add link" };
  }
}

export async function editMediaItem(id: string, name: string, category: string): Promise<boolean> {
  try {
    const res = await fetch(withBase("/api/admin/media"), {
      method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name, category }),
    });
    return res.ok;
  } catch { return false; }
}

export async function deleteMediaItem(id: string): Promise<boolean> {
  try {
    const res = await fetch(withBase("/api/admin/media"), {
      method: "DELETE", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    return res.ok;
  } catch { return false; }
}
