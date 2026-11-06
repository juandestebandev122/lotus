import { withBase } from "./base-path";

export interface InvitablePerson {
  id: string;
  name: string;
  username: string;
  avatar: string;
  online: boolean;
  relation: "friend" | "follower" | "following";
}

// The current user's friends + followers (+ people they follow) — the only
// people they may invite into a room.
export async function fetchInvitablePeople(): Promise<InvitablePerson[]> {
  try {
    const res = await fetch(withBase("/api/social/invitable"), { credentials: "include", cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    return Array.isArray(d.people) ? d.people : [];
  } catch {
    return [];
  }
}

// Send an in-app room invite to the chosen friends/followers.
export async function inviteFriendsToRoom(roomId: string, userIds: string[]): Promise<{ ok: boolean; invited?: number; error?: string }> {
  try {
    const res = await fetch(withBase(`/api/rooms/${roomId}/invite-friends`), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds }),
    });
    const d = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, invited: d.invited } : { ok: false, error: d.error };
  } catch {
    return { ok: false, error: "Network error" };
  }
}
