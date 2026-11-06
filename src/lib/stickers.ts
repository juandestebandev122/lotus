"use client";

import { withBase } from "./base-path";

export interface RoomSticker {
  id: string;
  url: string;
  fileName?: string;
  name?: string;
  addedBy?: string;
  at: string;
}

export async function fetchStickers(roomId: string): Promise<RoomSticker[]> {
  try {
    const res = await fetch(withBase(`/api/rooms/${encodeURIComponent(roomId)}/stickers`), { credentials: "include", cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.stickers as RoomSticker[]) ?? [];
  } catch {
    return [];
  }
}

/** Upload a new sticker image (host / co-host only — the server enforces it). */
export async function uploadSticker(roomId: string, file: File, name = ""): Promise<{ ok: boolean; stickers?: RoomSticker[]; error?: string }> {
  try {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", name);
    const res = await fetch(withBase(`/api/rooms/${encodeURIComponent(roomId)}/stickers`), { method: "POST", credentials: "include", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (data.error as string) ?? "Could not add the sticker" };
    return { ok: true, stickers: (data.stickers as RoomSticker[]) ?? [] };
  } catch {
    return { ok: false, error: "Network error while uploading" };
  }
}

export async function deleteSticker(roomId: string, stickerId: string): Promise<{ ok: boolean; stickers?: RoomSticker[]; error?: string }> {
  try {
    const res = await fetch(withBase(`/api/rooms/${encodeURIComponent(roomId)}/stickers`), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ stickerId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (data.error as string) ?? "Could not remove the sticker" };
    return { ok: true, stickers: (data.stickers as RoomSticker[]) ?? [] };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function renameSticker(roomId: string, stickerId: string, name: string): Promise<{ ok: boolean; stickers?: RoomSticker[]; error?: string }> {
  try {
    const res = await fetch(withBase(`/api/rooms/${encodeURIComponent(roomId)}/stickers`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ stickerId, name }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (data.error as string) ?? "Could not rename the sticker" };
    return { ok: true, stickers: (data.stickers as RoomSticker[]) ?? [] };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

// ---------- Global admin-managed sticker library ----------

export interface GlobalSticker {
  id: string;
  url: string;
  fileName?: string;
  name: string;
  category: string;
  enabled: boolean;
  usageCount: number;
  addedBy?: string;
  at: string;
}

/** User picker: enabled library grouped by category. */
export async function fetchGlobalStickers(): Promise<{ category: string; stickers: GlobalSticker[] }[]> {
  try {
    const res = await fetch(withBase("/api/stickers"), { credentials: "include", cache: "no-store" });
    if (!res.ok) return [];
    const d = await res.json();
    return Array.isArray(d.groups) ? d.groups : [];
  } catch {
    return [];
  }
}

/** Admin: every sticker (enabled + disabled) with usage counts. Server enforces admin. */
export async function fetchAdminStickers(): Promise<GlobalSticker[]> {
  try {
    const res = await fetch(withBase("/api/admin/stickers"), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return Array.isArray(d.stickers) ? d.stickers : [];
  } catch {
    return [];
  }
}

/** Admin: upload a new sticker (image only). */
export async function uploadGlobalSticker(file: File, name: string, category: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", name);
    fd.append("category", category);
    const res = await fetch(withBase("/api/admin/stickers"), { method: "POST", credentials: "include", body: fd });
    const d = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, error: (d.error as string) ?? "Could not add the sticker" };
  } catch {
    return { ok: false, error: "Network error while uploading" };
  }
}

/** Admin: edit name / category / enabled. */
export async function editGlobalSticker(id: string, patch: { name?: string; category?: string; enabled?: boolean }): Promise<boolean> {
  try {
    const res = await fetch(withBase("/api/admin/stickers"), {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Admin: delete a sticker. */
export async function removeGlobalSticker(id: string): Promise<boolean> {
  try {
    const res = await fetch(withBase("/api/admin/stickers"), {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Send a sticker into the group chat. */
export async function sendSticker(roomId: string, url: string): Promise<boolean> {
  try {
    const res = await fetch(withBase(`/api/rooms/${encodeURIComponent(roomId)}/chat`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ text: "", type: "sticker", mediaUrl: url }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
