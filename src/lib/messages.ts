"use client";

import { withBase } from "./base-path";

export interface DMPeer {
  id: string;
  fullName: string;
  username: string;
  /** Permanent member ID number — shown beside the name in the chat list/header. */
  publicId?: string;
  avatar?: string;
  status?: string;
  verified?: boolean;
}

export interface DMConversation {
  peer: DMPeer;
  lastText: string;
  lastAt: string;
  fromMe: boolean;
  unread: number;
}

export type DMType = "text" | "image" | "video" | "audio" | "file" | "sticker";

export interface DMessage {
  id: string;
  fromMe: boolean;
  text: string;
  at: string;
  deleted?: boolean; // removed for everyone → show a placeholder
  delivered?: boolean; // reached the recipient's device (double grey tick)
  read?: boolean; // recipient opened the chat (double colour tick)
  // Attachments — `text` doubles as the caption.
  type?: DMType;
  mediaUrl?: string;
  mediaName?: string;
  mediaMime?: string;
  mediaSize?: number;
  duration?: number; // seconds, voice notes
  // Reply quote (snapshotted at send time, so it survives the original's deletion)
  replyToId?: string;
  replyToText?: string;
  replyToFrom?: string;
  // Message management (v395)
  reactions?: string[];  // emoji list for the reaction chips
  myReaction?: string;   // my own reaction (for toggling)
  starred?: boolean;     // I starred/favourited this message
  pinned?: boolean;      // pinned in this conversation
  editedAt?: string;     // shown as "edited"
  forwarded?: boolean;   // shown as "forwarded"
}

export interface SendDMOptions {
  type?: DMType;
  mediaUrl?: string;
  mediaName?: string;
  mediaMime?: string;
  mediaSize?: number;
  duration?: number;
  replyToId?: string;
  forwarded?: boolean;
}

export async function fetchConversations(): Promise<DMConversation[]> {
  try {
    const res = await fetch(withBase("/api/messages"), { credentials: "include", cache: "no-store" });
    const data = await res.json();
    return (data.conversations as DMConversation[]) ?? [];
  } catch {
    return [];
  }
}

export async function fetchThread(idOrUsername: string): Promise<{ peer: DMPeer | null; messages: DMessage[]; iBlocked: boolean; blockedMe: boolean }> {
  try {
    const res = await fetch(withBase(`/api/messages/${encodeURIComponent(idOrUsername)}`), {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return { peer: null, messages: [], iBlocked: false, blockedMe: false };
    const data = await res.json();
    return {
      peer: (data.peer as DMPeer) ?? null,
      messages: (data.messages as DMessage[]) ?? [],
      iBlocked: !!data.iBlocked,
      blockedMe: !!data.blockedMe,
    };
  } catch {
    return { peer: null, messages: [], iBlocked: false, blockedMe: false };
  }
}

/** Send a DM. Returns { ok, error } — the error carries the server message (e.g.
 *  the 4-unanswered-message limit) so the UI can show it as a popup. */
export async function sendDM(toUserId: string, text: string, opts: SendDMOptions = {}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/messages"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ toUserId, text, ...opts }),
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: (data?.error as string) || "Could not send the message." };
  } catch {
    return { ok: false, error: "Could not send the message." };
  }
}

/** Delete SEVERAL of my messages at once ("delete selected"). */
export async function deleteDmMany(other: string, ids: string[]): Promise<boolean> {
  try {
    const res = await fetch(withBase(`/api/messages/${encodeURIComponent(other)}`), {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ action: "deleteMany", ids }),
    });
    return res.ok;
  } catch { return false; }
}

/** Remove a conversation from my list (reappears on newer activity). */
export async function removeDmConversationApi(other: string): Promise<boolean> {
  try {
    const res = await fetch(withBase(`/api/messages/${encodeURIComponent(other)}`), {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ action: "removeConversation" }),
    });
    return res.ok;
  } catch { return false; }
}

/** Block or unblock a user (affects DMs both ways). */
export async function setDmBlocked(other: string, blocked: boolean): Promise<boolean> {
  try {
    const res = await fetch(withBase(`/api/messages/${encodeURIComponent(other)}`), {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ action: blocked ? "block" : "unblock" }),
    });
    return res.ok;
  } catch { return false; }
}

/** Report a user (reason). Reuses the general report queue. */
export async function reportDmUser(otherId: string, detail: string): Promise<boolean> {
  try {
    const res = await fetch(withBase("/api/reports"), {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ reportedId: otherId, category: "Private message", detail }),
    });
    return res.ok;
  } catch { return false; }
}

/** Human-readable file size for document bubbles. */
export function fmtBytes(n?: number): string {
  if (!n || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** mm:ss for voice notes. */
export function fmtDuration(sec?: number): string {
  const s = Math.max(0, Math.round(sec ?? 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Delete a DM. forEveryone=true unsends it for both (sender only, if admin-enabled). */
export async function deleteDmMessage(other: string, msgId: string, forEveryone: boolean): Promise<boolean> {
  try {
    const res = await fetch(withBase(`/api/messages/${encodeURIComponent(other)}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: forEveryone ? "deleteForEveryone" : "deleteForMe", id: msgId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** React to a message with an emoji (same emoji again clears it). */
export async function reactDm(other: string, msgId: string, emoji: string): Promise<boolean> {
  try {
    const res = await fetch(withBase(`/api/messages/${encodeURIComponent(other)}`), {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ action: "react", id: msgId, emoji }),
    });
    return res.ok;
  } catch { return false; }
}

/** Star / unstar (favourite) a message — private to me. */
export async function starDm(other: string, msgId: string): Promise<boolean> {
  try {
    const res = await fetch(withBase(`/api/messages/${encodeURIComponent(other)}`), {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ action: "star", id: msgId }),
    });
    return res.ok;
  } catch { return false; }
}

/** Pin / unpin a message in the conversation. */
export async function pinDm(other: string, msgId: string): Promise<boolean> {
  try {
    const res = await fetch(withBase(`/api/messages/${encodeURIComponent(other)}`), {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ action: "pin", id: msgId }),
    });
    return res.ok;
  } catch { return false; }
}

/** Edit my message's text (within the admin-allowed window). Returns { ok, error }. */
export async function editDm(other: string, msgId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase(`/api/messages/${encodeURIComponent(other)}`), {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ action: "edit", id: msgId, text }),
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: (data?.error as string) || "Could not edit the message." };
  } catch { return { ok: false, error: "Could not edit the message." }; }
}

/** ADMIN: edit ANY user's message in this conversation (no time window; the
 *  message is still marked "edited" for both people). Admin accounts only. */
export async function adminEditDm(other: string, msgId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase(`/api/messages/${encodeURIComponent(other)}`), {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ action: "adminEdit", id: msgId, text }),
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: (data?.error as string) || "Could not edit the message." };
  } catch { return { ok: false, error: "Could not edit the message." }; }
}

/** ADMIN: delete ANY user's message for both people. Admin accounts only. */
export async function adminDeleteDm(other: string, msgId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase(`/api/messages/${encodeURIComponent(other)}`), {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ action: "adminDelete", id: msgId }),
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: (data?.error as string) || "Could not delete the message." };
  } catch { return { ok: false, error: "Could not delete the message." }; }
}

/** Clear the whole conversation just for me. */
export async function clearDmConversation(other: string): Promise<boolean> {
  try {
    const res = await fetch(withBase(`/api/messages/${encodeURIComponent(other)}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "clearForMe" }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function clockFromIso(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-SA", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}
