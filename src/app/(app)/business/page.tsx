"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ButtonLink, Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { fetchBusinesses, toggleFollowBusiness, type BizState, type BusinessCard } from "@/lib/business";
import { Building2, Search, BadgeCheck, MapPin, Users, Plus, Store, RefreshCw } from "lucide-react";

export default function BusinessDirectoryPage() {
  const { toast } = useToast();
  const [state, setState] = useState<BizState | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback((query = q, category = cat) => {
    return fetchBusinesses(query, category === "All" ? "" : category).then(setState);
  }, [q, cat]);
  const refresh = () => { setRefreshing(true); reload(q, cat === "All" ? "" : cat).finally(() => setRefreshing(false)); };

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  // Debounced re-fetch on search / category change.
  useEffect(() => {
    const t = setTimeout(() => reload(q, cat === "All" ? "" : cat), 250);
    return () => clearTimeout(t);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [q, cat]);

  if (!state) return <div className="grid min-h-[60vh] place-items-center text-mist-400">Loading businesses…</div>;

  if (!state.enabled) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="p-8 text-center">
          <Building2 className="mx-auto size-10 text-mist-500" />
          <h1 className="mt-3 text-lg font-bold text-mist-100">Businesses</h1>
          <p className="mt-1 text-sm text-mist-400">This section is currently turned off. Please check back later.</p>
        </Card>
      </div>
    );
  }

  const categories = ["All", ...state.categories];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-mist-100">
            <Building2 className="size-6 text-lotus-300" /> Businesses
          </h1>
          <p className="mt-0.5 text-sm text-mist-400">Discover verified businesses on LotusPlay Connect.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} disabled={refreshing} title="Refresh" className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-ink-800 text-mist-300 transition hover:text-mist-100 disabled:opacity-50">
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
          </button>
          <ButtonLink href="/business/mine" variant="secondary" size="sm">
            <Store className="size-4" /> My Business{state.mine.length ? ` · ${state.mine.length}` : ""}
          </ButtonLink>
          <ButtonLink href="/business/new" size="sm">
            <Plus className="size-4" /> Register
          </ButtonLink>
        </div>
      </div>

      {/* Search + categories */}
      <div className="space-y-3">
        <Input icon={<Search />} placeholder="Search businesses, categories, locations…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                cat === c ? "border-lotus-400 bg-lotus-500/15 text-lotus-100" : "border-line bg-ink-800 text-mist-300 hover:bg-ink-700",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Directory */}
      {state.directory.length === 0 ? (
        <Card className="p-8 text-center">
          <Store className="mx-auto size-9 text-mist-500" />
          <p className="mt-3 text-sm text-mist-300">No businesses here yet.</p>
          <p className="text-xs text-mist-500">Be the first — register your business and get the verified badge.</p>
          <ButtonLink href="/business/new" size="sm" className="mt-4"><Plus className="size-4" /> Register your business</ButtonLink>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {state.directory.map((b) => (
            <BusinessTile key={b.id} biz={b} onFollow={async () => {
              const r = await toggleFollowBusiness(b.id);
              toast(r.following ? `Following ${b.name}` : `Unfollowed ${b.name}`, "success");
              reload();
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

function BusinessTile({ biz, onFollow }: { biz: BusinessCard; onFollow: () => void }) {
  return (
    <Card className="flex gap-3 p-3.5">
      <Link href={`/business/${biz.id}`} className="shrink-0">
        <Avatar name={biz.name} src={biz.logoUrl || undefined} size="lg" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/business/${biz.id}`} className="flex items-center gap-1.5">
          <span className="truncate font-bold text-mist-100">{biz.name}</span>
          {biz.verified && <BadgeCheck className="size-4 shrink-0 text-sky-400" aria-label="Verified" />}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge tone="lotus" className="!py-0 text-[10px]">{biz.category}</Badge>
          {biz.location && <span className="flex items-center gap-0.5 text-[11px] text-mist-500"><MapPin className="size-3" />{biz.location}</span>}
        </div>
        {biz.description && <p className="mt-1.5 line-clamp-2 text-xs text-mist-400">{biz.description}</p>}
        <div className="mt-2 flex items-center justify-between">
          <span className="flex items-center gap-1 text-[11px] text-mist-500"><Users className="size-3" />{biz.followers} follower{biz.followers === 1 ? "" : "s"}</span>
          <Button size="sm" variant={biz.following ? "secondary" : "outline"} className="!h-8 !px-3 text-xs" onClick={onFollow}>
            {biz.following ? "Following" : "Follow"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
