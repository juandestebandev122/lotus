"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { updateRoom } from "@/lib/rooms";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/cn";
import { Search, UserPlus, Check } from "lucide-react";

// Invite REAL registered users to a room (search by name, @username or User ID).
// Used by the room host (Edit panel) and by an Admin (rooms page). Adding sends a
// notification + grants private-room access; removing revokes it immediately.
interface PickUser { id: string; fullName: string; username?: string; avatar?: string; publicId?: string }

export function RoomInvitePicker({
  roomId,
  invited,
  onInvitedChange,
  isPrivate,
}: {
  roomId: string;
  invited: string[];
  onInvitedChange: (next: string[]) => void;
  isPrivate?: boolean;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickUser[]>([]);
  const [invitedUsers, setInvitedUsers] = useState<PickUser[]>([]);
  const [busy, setBusy] = useState("");

  // Resolve names/avatars for the already-invited ids.
  useEffect(() => {
    if (!invited.length) { setInvitedUsers([]); return; }
    let on = true;
    fetch(withBase("/api/users/profiles"), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: invited }) })
      .then((r) => r.json()).then((d) => { if (on) setInvitedUsers(d.profiles ?? []); }).catch(() => {});
    return () => { on = false; };
  }, [invited]);

  // Debounced search over REAL users.
  useEffect(() => {
    const term = q.trim();
    if (!term) { setResults([]); return; }
    let on = true;
    const t = setTimeout(() => {
      fetch(withBase(`/api/users?q=${encodeURIComponent(term)}`), { credentials: "include" })
        .then((r) => r.json()).then((d) => { if (on) setResults((d.users ?? []).slice(0, 20)); }).catch(() => {});
    }, 250);
    return () => { on = false; clearTimeout(t); };
  }, [q]);

  const add = async (id: string) => {
    if (invited.includes(id)) return;
    setBusy(id);
    onInvitedChange([...invited, id]); // optimistic
    // The invite endpoint grants private-room access AND notifies the invitee.
    await fetch(withBase(`/api/rooms/${roomId}/invite`), { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetUserId: id }) }).catch(() => {});
    setBusy("");
  };
  const remove = async (id: string) => {
    setBusy(id);
    const next = invited.filter((x) => x !== id);
    onInvitedChange(next); // optimistic
    await updateRoom(roomId, { invitedIds: next });
    setBusy("");
  };

  const resultsToShow = results.filter((u) => !invited.includes(u.id));

  const row = (u: PickUser, isInvited: boolean) => (
    <div key={u.id} className="flex items-center gap-2 rounded-lg bg-ink-800 px-2.5 py-1.5">
      <Avatar name={u.fullName} src={u.avatar} size="xs" />
      <span className="min-w-0 flex-1 truncate text-sm text-mist-100">
        {u.fullName}
        {u.publicId ? <span className="ml-1 font-mono text-[11px] text-mist-500">{u.publicId}</span> : u.username ? <span className="ml-1 text-[11px] text-mist-500">@{u.username}</span> : null}
      </span>
      <button
        disabled={busy === u.id}
        onClick={() => (isInvited ? remove(u.id) : add(u.id))}
        className={cn(
          "ml-auto inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50",
          isInvited ? "bg-emerald-500/15 text-emerald-300 hover:bg-rose-500/15 hover:text-rose-300" : "bg-lotus-500/15 text-lotus-300 hover:bg-lotus-500/25",
        )}
      >
        {isInvited ? <><Check className="size-3.5" /> Invited</> : <><UserPlus className="size-3.5" /> Invite</>}
      </button>
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-lg border border-line bg-ink-800 px-2.5">
        <Search className="size-4 text-mist-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people by name, @username or ID…" className="h-9 w-full bg-transparent text-sm text-mist-100 outline-none placeholder:text-mist-500" />
      </div>

      {q.trim() && (
        <div className="max-h-40 space-y-1 overflow-y-auto">
          {resultsToShow.length === 0 ? <p className="px-1 py-2 text-xs text-mist-500">No matching users.</p> : resultsToShow.map((u) => row(u, false))}
        </div>
      )}

      <div>
        <p className="mb-1 text-[11px] font-semibold text-mist-400">Invited ({invited.length})</p>
        {invited.length === 0 ? (
          <p className="px-1 text-xs text-mist-500">{isPrivate ? "No one invited yet — search above to add people who can see & join." : "No invitations sent yet."}</p>
        ) : (
          <div className="max-h-40 space-y-1 overflow-y-auto">{invitedUsers.map((u) => row(u, true))}</div>
        )}
      </div>
    </div>
  );
}
