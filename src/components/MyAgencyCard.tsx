"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Landmark, Users, ChevronRight, Crown, Shield, Star } from "lucide-react";
import { fetchMyAgency, type MyAgency } from "@/lib/agency";

const ROLE: Record<string, { label: string; icon: typeof Crown }> = {
  owner: { label: "Owner", icon: Crown },
  manager: { label: "Manager", icon: Shield },
  cohost: { label: "Co-Host", icon: Star },
  member: { label: "Member", icon: Users },
};

/**
 * "My Agency" shortcut. On the Home page it shows ONLY for users already in an
 * agency (renders nothing otherwise). On the PROFILE page it's rendered with
 * `promptJoin`, so a user with NO agency instead sees a "Join an Agency" card that
 * opens the searchable agency directory (client: Join/Change Agency must be reachable
 * from the profile). Tapping the in-agency card opens their agency; members also get
 * a "Change agency" link.
 */
export function MyAgencyCard({ promptJoin = false }: { promptJoin?: boolean }) {
  const [a, setA] = useState<MyAgency | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetchMyAgency().then(setA).finally(() => setLoading(false)); }, []);
  if (loading) return null;

  // Not in an agency → prompt to browse + request to join (profile only).
  if (!a) {
    if (!promptJoin) return null;
    return (
      <Link href="/agencies" className="group flex items-center gap-3 rounded-2xl border border-lotus-400/25 bg-lotus-500/[0.06] p-3.5 transition-colors hover:border-lotus-400/50 hover:bg-lotus-500/[0.12]">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-lotus-500/20"><Landmark className="size-6 text-lotus-200" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-lotus-300"><Landmark className="size-3.5" /> Agencies</div>
          <div className="truncate font-display text-lg font-extrabold text-mist-100">Join an Agency</div>
          <div className="text-xs text-mist-400">Search by name or ID and request to join</div>
        </div>
        <ChevronRight className="size-5 shrink-0 text-mist-500 transition-transform group-hover:translate-x-0.5 group-hover:text-lotus-300" />
      </Link>
    );
  }

  const R = ROLE[a.role] ?? ROLE.member;
  const href = a.canManage ? "/agency" : `/agencies/${a.id}`;
  return (
    <div className="rounded-2xl border border-lotus-400/25 bg-lotus-500/[0.08]">
      <Link href={href} className="group flex items-center gap-3 p-3.5 transition-colors hover:bg-lotus-500/[0.06] rounded-2xl">
        <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-lotus-500/20">
          {a.logo ? <img src={a.logo} alt="" className="size-full object-cover" /> : <Landmark className="size-6 text-lotus-200" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-lotus-300"><Landmark className="size-3.5" /> My Agency</div>
          <div className="truncate font-display text-lg font-extrabold text-mist-100">{a.name}</div>
          <div className="flex items-center gap-2 text-xs text-mist-400">
            <span className="font-mono">{a.agencyId}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.08] px-1.5 py-0.5 font-semibold text-mist-300"><R.icon className="size-3" /> {R.label}</span>
            <span>· {a.memberCount} members</span>
          </div>
        </div>
        <ChevronRight className="size-5 shrink-0 text-mist-500 transition-transform group-hover:translate-x-0.5 group-hover:text-lotus-300" />
      </Link>
      {/* Members (not owners) can request to move to a different agency. */}
      {promptJoin && a.role !== "owner" && (
        <Link href="/agencies" className="flex items-center justify-center gap-1.5 border-t border-lotus-400/20 py-2 text-xs font-semibold text-lotus-300 transition hover:bg-lotus-500/[0.06]">
          Change agency <ChevronRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
}
