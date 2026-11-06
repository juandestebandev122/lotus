"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { RoomCard } from "@/components/social/RoomCard";
import { useToast } from "@/components/ui/Toast";
import { ROOMS } from "@/lib/mock-data";
import { withBase } from "@/lib/base-path";
import { BrandImg } from "@/components/BrandImg";
import { IS_PROD_SITE } from "@/lib/prod";
import type { User } from "@/lib/types";
import { Search as SearchIcon, UserPlus, CheckCircle2, TrendingUp } from "lucide-react";
import { profileHref } from "@/lib/profile-href";

const TABS = ["Users", "Rooms"] as const;
const TRENDING = ["Tamil Community", "Ludo", "Music", "Chess", "Friendship", "Late Night"];

export default function SearchPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Users");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [followed, setFollowed] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const q = query.trim().toLowerCase();

  // Live user search against the backend (debounced)
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const res = await fetch(withBase(`/api/users?q=${encodeURIComponent(q)}`), { credentials: "include" });
        const data = await res.json();
        setUsers((data.users as User[]) ?? []);
      } catch {
        setUsers([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const rooms = useMemo(
    () =>
      (IS_PROD_SITE ? [] : ROOMS).filter(
        (r) => !q || r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q),
      ),
    [q],
  );

  async function toggleFollow(u: User) {
    const wasFollowed = !!followed[u.id];
    setFollowed((p) => ({ ...p, [u.id]: !wasFollowed }));
    toast(wasFollowed ? `Unfollowed ${u.fullName}` : `Following ${u.fullName}`, wasFollowed ? "info" : "success");
    try {
      await fetch(withBase("/api/follow"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: u.id }),
      });
    } catch {}
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-extrabold text-mist-100">Search</h1>
      <p className="text-sm text-mist-400">Find people, rooms and communities.</p>

      <div className="mt-4">
        <Input
          icon={<SearchIcon className="size-4" />}
          placeholder="Search LotusPlay Connect…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {/* Trending chips */}
      {!q && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-mist-500">
            <TrendingUp className="size-3.5" /> Trending
          </div>
          <div className="flex flex-wrap gap-2">
            {TRENDING.map((t) => (
              <button
                key={t}
                onClick={() => setQuery(t)}
                className="rounded-full border border-line bg-ink-800 px-3 py-1.5 text-sm text-mist-300 transition hover:border-lotus-400/50 hover:text-lotus-200"
              >
                #{t}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-5 mt-5 flex gap-1 rounded-xl bg-ink-800/80 p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "flex-1 rounded-lg py-2 text-sm font-semibold transition " +
              (tab === t
                ? "bg-lotus-600 text-white"
                : "text-mist-400 hover:text-mist-100")
            }
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Users" ? (
        <Card className="p-2">
          {users.length ? (
            <div className="divide-y divide-black/[0.06]">
              {users.map((u) => {
                const isFollowed = followed[u.id];
                const online = u.status === "online";
                return (
                  <div key={u.id} className="flex items-center gap-3 px-2 py-3">
                    <Link href={profileHref(u)} className={online ? "" : "opacity-50"}>
                      <Avatar name={u.fullName} src={u.avatar} status={u.status} size="md" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={profileHref(u)}
                        className={`flex items-center gap-1 text-sm font-semibold text-mist-100 hover:text-lotus-300 ${online ? "" : "opacity-60"}`}
                      >
                        {u.fullName}
                        {u.verified && <CheckCircle2 className="size-3.5 text-lotus-400" />}
                        {online && <span className="ml-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-400"><span className="size-1.5 rounded-full bg-emerald-400" /> Online</span>}
                      </Link>
                      {/* Name + permanent ID number — display names repeat, the ID doesn't. */}
                      <div className="truncate text-xs text-mist-400">
                        @{u.username}
                        {u.publicId && <span className="ml-1.5 font-mono text-[11px] text-mist-500">ID {u.publicId}</span>}
                        {" · "}{u.stats.followers.toLocaleString("en-SA")} followers
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={isFollowed ? "secondary" : "primary"}
                      onClick={() => toggleFollow(u)}
                    >
                      {isFollowed ? (
                        <>
                          <CheckCircle2 className="size-4" /> Following
                        </>
                      ) : (
                        <>
                          <UserPlus className="size-4" /> Follow
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty query={query} />
          )}
        </Card>
      ) : rooms.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {rooms.map((r) => (
            <RoomCard key={r.id} room={r} />
          ))}
        </div>
      ) : (
        <Card className="p-2">
          <Empty query={query} />
        </Card>
      )}
    </div>
  );
}

function Empty({ query }: { query: string }) {
  return (
    <div className="px-4 py-12 text-center">
      <BrandImg slot="emptySearch" className="mx-auto w-28 animate-float drop-shadow-xl" />
      <p className="mt-4 font-semibold text-mist-200">No results found</p>
      <p className="mt-1 text-sm text-mist-400">
        We couldn&apos;t find anything for &ldquo;{query}&rdquo;. Try a different search.
      </p>
    </div>
  );
}
