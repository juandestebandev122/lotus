import { withBase } from "./base-path";

export interface FeatureRequest {
  id: string;
  type: "room_name" | "video" | "cohost" | "public_room" | "group_deletion";
  userId: string;
  userName: string;
  roomId: string;
  roomName: string;
  payload?: string;
  coinCost: number;
  status: "pending" | "approved" | "rejected";
  at: string;
  decidedAt?: string;
  decidedBy?: string;
  note?: string;
}

// Host/co-host submits a paid-feature request (room rename / video unlock).
export async function requestFeature(
  roomId: string,
  type: "room_name" | "video" | "cohost",
  newName?: string,
): Promise<{ ok: boolean; error?: string; balance?: number }> {
  try {
    const res = await fetch(withBase(`/api/rooms/${roomId}/feature-request`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ type, newName }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, error: data.error, balance: data.balance };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

// Owner requests admin deletion of their PRIMARY group (reason mandatory).
export async function requestGroupDeletion(
  roomId: string,
  reason: string,
  comments?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase(`/api/rooms/${roomId}/feature-request`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ type: "group_deletion", reason, comments }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, error: data.error };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

// The current user's requests for this room (to show pending status).
export async function fetchMyRoomRequests(roomId: string): Promise<FeatureRequest[]> {
  try {
    const res = await fetch(withBase(`/api/rooms/${roomId}/feature-request`), { credentials: "include", cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    return (data.requests as FeatureRequest[]) ?? [];
  } catch {
    return [];
  }
}

// Admin: list + decide.
export async function fetchFeatureRequests(): Promise<FeatureRequest[]> {
  try {
    const res = await fetch(withBase("/api/admin/feature-requests"), { credentials: "include", cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    return (data.requests as FeatureRequest[]) ?? [];
  } catch {
    return [];
  }
}

export async function decideFeatureRequest(id: string, approve: boolean, note?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(withBase("/api/admin/feature-requests"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, approve, note }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, error: data.error };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function removeFeatureRequest(id: string): Promise<boolean> {
  try {
    const res = await fetch(withBase("/api/admin/feature-requests"), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
