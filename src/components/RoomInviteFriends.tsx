"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { fetchInvitablePeople, inviteFriendsToRoom, type InvitablePerson } from "@/lib/social";
import { UserPlus, X, Search, Check, Users } from "lucide-react";

const RELATION_LABEL: Record<InvitablePerson["relation"], string> = {
  friend: "Friend",
  follower: "Follower",
  following: "Following",
};

// "Invite friends & followers" — lets a member invite their existing connections
// (registered users only) into this room with a one-tap in-app invite.
// variant "pill" = compact header pill; "row" = full-width menu row (Room options).
export function RoomInviteFriends({ roomId, variant = "pill" }: { roomId: string; variant?: "pill" | "row" }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<InvitablePerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setPicked(new Set());
    setQuery("");
    fetchInvitablePeople().then((p) => { setPeople(p); setLoading(false); });
  }, [open]);

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () => people.filter((p) => !q || p.name.toLowerCase().includes(q) || p.username.toLowerCase().includes(q)),
    [people, q],
  );

  const toggle = (id: string) =>
    setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const send = async () => {
    if (sending || picked.size === 0) return;
    setSending(true);
    const res = await inviteFriendsToRoom(roomId, [...picked]);
    setSending(false);
    if (res.ok) {
      toast(`Invite sent to ${res.invited} ${res.invited === 1 ? "person" : "people"} 🎉`, "success");
      setOpen(false);
    } else {
      toast(res.error ?? "Could not send invites", "error");
    }
  };

  return (
    <>
      {variant === "row" ? (
        <button
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-xl border border-line bg-ink-800 px-3.5 py-3 text-left text-sm font-semibold text-mist-100 transition hover:bg-ink-700"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-lotus-500/15 text-lotus-300"><UserPlus className="size-4" /></span>
          <span className="flex-1">Invite friends &amp; followers</span>
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-ink-700 px-3 py-1 text-xs font-semibold text-mist-200 transition hover:bg-ink-600"
          title="Invite your friends & followers to this room"
        >
          <UserPlus className="size-3.5 text-lotus-300" /> Invite
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-850" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
              <div>
                <h2 className="font-display text-lg font-bold text-mist-100">Invite friends &amp; followers</h2>
                <p className="text-xs text-mist-500">Only people you&apos;re connected with can be invited.</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
            </div>

            <div className="border-b border-white/5 p-3">
              <div className="flex items-center gap-2 rounded-xl border border-line bg-ink-800 px-3">
                <Search className="size-4 text-mist-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search your friends & followers…"
                  className="h-10 w-full bg-transparent text-sm text-mist-100 outline-none placeholder:text-mist-500"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {loading ? (
                <p className="py-10 text-center text-sm text-mist-400">Loading your connections…</p>
              ) : shown.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <Users className="mx-auto size-8 text-mist-600" />
                  <p className="mt-3 text-sm font-semibold text-mist-200">{q ? "No matches" : "No friends or followers yet"}</p>
                  <p className="mt-1 text-xs text-mist-500">{q ? "Try a different name." : "Add friends or get followers, then invite them here."}</p>
                </div>
              ) : (
                shown.map((p) => {
                  const on = picked.has(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggle(p.id)}
                      className={cn("flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition", on ? "bg-lotus-500/15" : "hover:bg-white/[0.04]")}
                    >
                      <div className="relative">
                        <Avatar name={p.name} src={p.avatar} size="md" />
                        {p.online && <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-ink-850 bg-emerald-400" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-mist-100">{p.name}</div>
                        <div className="flex items-center gap-1.5 text-xs text-mist-500">
                          <span className="truncate">@{p.username}</span>
                          <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-mist-300">{RELATION_LABEL[p.relation]}</span>
                        </div>
                      </div>
                      <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border transition", on ? "border-lotus-400 bg-lotus-500 text-white" : "border-line text-transparent")}>
                        <Check className="size-3.5" />
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="border-t border-white/5 p-3">
              <button
                onClick={send}
                disabled={sending || picked.size === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-lotus-500 to-petal-500 px-4 py-3 text-sm font-bold text-white shadow-sm transition enabled:hover:brightness-110 disabled:opacity-50"
              >
                <UserPlus className="size-4" /> {sending ? "Sending…" : picked.size ? `Send invite · ${picked.size}` : "Select friends to invite"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
