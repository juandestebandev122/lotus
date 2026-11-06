"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth";
import { withBase } from "@/lib/base-path";
import { BrandImg } from "@/components/BrandImg";
import type { Friend, FriendState } from "@/lib/types";
import { Search, UserPlus, UserCheck, X, MessageCircle, CheckCircle2 } from "lucide-react";

const TABS = ["Friends", "Requests", "Suggestions"] as const;

const ACTION_FOR: Record<FriendState, string> = {
  friends: "accept",
  outgoing: "add",
  incoming: "accept",
  none: "remove",
};

export default function FriendsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Friends");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<Friend[]>([]);
  const [suggested, setSuggested] = useState<Friend[]>([]);
  const [states, setStates] = useState<Record<string, FriendState>>({});
  // Open the REQUESTS tab automatically the first time we load and there are
  // requests waiting. Previously the page always opened on "Friends", so an
  // incoming request sat unseen on another tab and looked like it was never
  // delivered ("friend request not received").
  const autoTabbed = useRef(false);
  const { toast } = useToast();
  const { user, updateUser } = useAuth();
  const router = useRouter();

  const reload = async () => {
    try {
      const res = await fetch(withBase("/api/friends"), { credentials: "include", cache: "no-store" });
      const json = await res.json();
      const friends = (json.friends as Friend[]) ?? [];
      setData(friends);
      setSuggested((json.suggestions as Friend[]) ?? []);
      setStates({}); // server is now the source of truth
      // First load only: jump straight to the pending requests if there are any.
      if (!autoTabbed.current) {
        autoTabbed.current = true;
        if (friends.some((f) => f.state === "incoming")) setTab("Requests");
      }
      // Keep the profile's friend count in sync immediately.
      const fc = friends.filter((f) => f.state === "friends").length;
      if (user && user.stats.friends !== fc) updateUser({ stats: { ...user.stats, friends: fc } });
    } catch {
      /* ignore */
    }
  };

  // Refresh periodically so friends' online/offline status stays live.
  useEffect(() => {
    reload();
    const t = setInterval(() => { if (!document.hidden) reload(); }, 30000);
    const onVis = () => { if (!document.hidden) reload(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function setState(id: string, s: FriendState) {
    setStates((prev) => ({ ...prev, [id]: s }));
    fetch(withBase("/api/friends"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ otherId: id, action: ACTION_FOR[s] }),
    })
      .then(() => reload()) // re-sync both sides + counts from the server
      .catch(() => {});
  }

  const lists = useMemo(() => {
    const all = [...data, ...suggested].map((f) => ({ ...f, state: states[f.user.id] ?? f.state }));
    const q = query.trim().toLowerCase();
    const match = (f: Friend) =>
      !q || f.user.fullName.toLowerCase().includes(q) || f.user.username.toLowerCase().includes(q);
    return {
      friends: all.filter((f) => f.state === "friends" && match(f)),
      requests: all.filter((f) => f.state === "incoming" && match(f)),
      suggestions: all.filter((f) => (f.state === "none" || f.state === "outgoing") && match(f)),
    };
  }, [data, suggested, states, query]);

  const counts = {
    Friends: lists.friends.length,
    Requests: lists.requests.length,
    Suggestions: lists.suggestions.length,
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4">
        <h1 className="font-display text-2xl font-extrabold text-mist-100">Friends</h1>
        <p className="text-sm text-mist-400">Manage your connections and requests.</p>
      </div>

      <Input
        icon={<Search className="size-4" />}
        placeholder="Search friends…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-4"
      />

      <div className="mb-5 flex gap-1 rounded-xl bg-ink-800/80 p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition " +
              (tab === t
                ? "bg-lotus-600 text-white"
                : "text-mist-400 hover:text-mist-100")
            }
          >
            {t}
            {counts[t] > 0 && (
              <span className={"grid min-w-5 place-items-center rounded-full px-1.5 text-[10px] " + (tab === t ? "bg-white/25 text-white" : "bg-lotus-500/20 text-lotus-200")}>
                {counts[t]}
              </span>
            )}
          </button>
        ))}
      </div>

      <Card className="p-2">
        {tab === "Friends" && (
          <List
            items={lists.friends}
            empty="No friends yet — find people in the Suggestions tab."
            render={(f) => (
              <Row
                key={f.user.id}
                friend={f}
                actions={
                  <>
                    <Button size="sm" variant="secondary" onClick={() => router.push(`/messages?to=${f.user.username}`)}>
                      <MessageCircle className="size-4" /> Message
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setState(f.user.id, "none");
                        toast(`Removed ${f.user.fullName} from friends`, "info");
                      }}
                    >
                      Remove
                    </Button>
                  </>
                }
              />
            )}
          />
        )}

        {tab === "Requests" && (
          <List
            items={lists.requests}
            empty="No pending friend requests."
            render={(f) => (
              <Row
                key={f.user.id}
                friend={f}
                subtitle={`${f.mutuals ?? 0} mutual friends`}
                actions={
                  <>
                    <Button
                      size="sm"
                      onClick={() => {
                        setState(f.user.id, "friends");
                        toast(`You are now friends with ${f.user.fullName} 🎉`, "success");
                      }}
                    >
                      <UserCheck className="size-4" /> Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setState(f.user.id, "none");
                        toast(`Declined request from ${f.user.fullName}`, "info");
                      }}
                    >
                      <X className="size-4" /> Decline
                    </Button>
                  </>
                }
              />
            )}
          />
        )}

        {tab === "Suggestions" && (
          <List
            items={lists.suggestions}
            empty="No suggestions right now."
            render={(f) => {
              const sent = f.state === "outgoing";
              return (
                <Row
                  key={f.user.id}
                  friend={f}
                  subtitle={`${f.mutuals ?? 0} mutual friends`}
                  actions={
                    <Button
                      size="sm"
                      variant={sent ? "secondary" : "primary"}
                      onClick={() => {
                        if (sent) {
                          setState(f.user.id, "none");
                          toast(`Cancelled request to ${f.user.fullName}`, "info");
                        } else {
                          setState(f.user.id, "outgoing");
                          toast(`Friend request sent to ${f.user.fullName}`, "success");
                        }
                      }}
                    >
                      {sent ? (
                        <>
                          <CheckCircle2 className="size-4" /> Requested
                        </>
                      ) : (
                        <>
                          <UserPlus className="size-4" /> Add friend
                        </>
                      )}
                    </Button>
                  }
                />
              );
            }}
          />
        )}
      </Card>
    </div>
  );
}

function List({
  items,
  render,
  empty,
}: {
  items: Friend[];
  render: (f: Friend) => React.ReactNode;
  empty: string;
}) {
  if (!items.length) {
    return (
      <div className="px-4 py-10 text-center">
        <BrandImg slot="emptyFriends" className="mx-auto w-24 animate-float drop-shadow-xl" />
        <p className="mt-4 text-sm text-mist-400">{empty}</p>
      </div>
    );
  }
  return <div className="divide-y divide-black/[0.06]">{items.map(render)}</div>;
}

function Row({
  friend,
  subtitle,
  actions,
}: {
  friend: Friend;
  subtitle?: string;
  actions: React.ReactNode;
}) {
  const online = friend.user.status === "online";
  return (
    <div className="flex flex-wrap items-center gap-3 px-2 py-3">
      <div className={online ? "" : "opacity-50"}>
        <Avatar name={friend.user.fullName} src={friend.user.avatar} status={friend.user.status} size="md" />
      </div>
      <div className="min-w-0 flex-1">
        <div className={`flex items-center gap-1 text-sm font-semibold text-mist-100 ${online ? "" : "opacity-60"}`}>
          {friend.user.fullName}
          {friend.user.verified && <CheckCircle2 className="size-3.5 text-lotus-400" />}
          {online && <span className="ml-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-400"><span className="size-1.5 rounded-full bg-emerald-400" /> Online</span>}
        </div>
        {/* Name is never enough on its own — several members share a display
            name — so the permanent ID number rides along with it everywhere. */}
        <div className="text-xs text-mist-400">
          {subtitle ?? `@${friend.user.username}`}
          {friend.user.publicId && <span className="ml-1.5 font-mono text-[11px] text-mist-500">ID {friend.user.publicId}</span>}
        </div>
      </div>
      <div className="flex gap-2">{actions}</div>
    </div>
  );
}
