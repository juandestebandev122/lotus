"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { fetchAgencyProfile, requestToJoinAgency, type AgencyProfile } from "@/lib/agency";
import {
  Landmark, Crown, Users, TrendingUp, Loader2, ArrowLeft, Coins, Radio, Lock,
  Globe, Hash, UserCheck, Clock, Mail,
} from "lucide-react";

const STATUS_BADGE: Record<string, { label: string; tone: string; icon: typeof UserCheck }> = {
  owner: { label: "You own this agency", tone: "bg-gold-500/15 text-gold-300", icon: Crown },
  manager: { label: "You manage this agency", tone: "bg-lotus-500/15 text-lotus-300", icon: UserCheck },
  cohost: { label: "You're a co-host here", tone: "bg-sky-500/15 text-sky-300", icon: UserCheck },
  member: { label: "You're a member", tone: "bg-emerald-500/15 text-emerald-300", icon: UserCheck },
  pending: { label: "Request pending", tone: "bg-amber-500/15 text-amber-300", icon: Clock },
  invited: { label: "You're invited", tone: "bg-violet-500/15 text-violet-300", icon: Mail },
};

const ROLE_TONE: Record<string, string> = {
  owner: "bg-gold-500/15 text-gold-300",
  manager: "bg-lotus-500/15 text-lotus-300",
  cohost: "bg-sky-500/15 text-sky-300",
  member: "bg-white/[0.06] text-mist-300",
};

const TYPE_ICON: Record<string, typeof Globe> = { public: Globe, community: Hash, private: Lock, password: Lock };

export default function AgencyProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { toast } = useToast();
  const [profile, setProfile] = useState<AgencyProfile | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => fetchAgencyProfile(id).then((p) => setProfile(p)), [id]);
  useEffect(() => { load(); }, [load]);

  const join = async () => {
    if (!profile) return;
    setBusy(true);
    const res = await requestToJoinAgency(profile.id);
    setBusy(false);
    if (res.ok) { toast(`Request sent to "${profile.name}" — the agency admin will review it.`, "success"); load(); }
    else toast(res.error ?? "Could not send request", "error");
  };

  if (profile === undefined) {
    return <div className="grid h-60 place-items-center text-mist-400"><Loader2 className="size-6 animate-spin" /></div>;
  }
  if (profile === null) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <Landmark className="mx-auto size-9 text-mist-600" />
        <h1 className="mt-3 font-display text-xl font-bold text-mist-100">Agency not found</h1>
        <p className="mt-1 text-sm text-mist-400">It may have been removed or is not active.</p>
        <Link href="/agencies" className="mt-4 inline-block text-sm text-lotus-300">← Back to agencies</Link>
      </div>
    );
  }

  const badge = STATUS_BADGE[profile.myStatus];
  const canJoin = profile.myStatus === "none" && !profile.full;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/agencies" className="inline-flex items-center gap-1.5 text-sm font-semibold text-mist-400 hover:text-mist-100">
        <ArrowLeft className="size-4" /> All agencies
      </Link>

      {/* Header card */}
      <Card className="overflow-hidden p-0">
        <div className="h-24 w-full bg-gradient-to-r from-lotus-600/40 to-petal-600/30" style={profile.cover ? { backgroundImage: `url(${profile.cover})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
        <div className="p-4 sm:p-5">
          <div className="-mt-12 flex items-end gap-3">
            <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 border-ink-900 bg-lotus-500/15 text-lotus-200 shadow-lg" style={profile.logo ? { backgroundImage: `url(${profile.logo})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
              {!profile.logo && <Landmark className="size-9" />}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-extrabold text-mist-100">{profile.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-mist-400">
                <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-semibold text-mist-300">{profile.agencyId}</span>
                {profile.tierName ? (
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold" style={{ background: `${profile.tierColor ?? "#f59e0b"}22`, color: profile.tierColor ?? "#f59e0b" }}>{profile.tierBadge} {profile.tierName}</span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-gold-300"><Crown className="size-3.5" /> Level {profile.level}</span>
                )}
                <span className="inline-flex items-center gap-0.5"><TrendingUp className="size-3.5" /> Rank #{profile.rank}</span>
                {profile.ownerName && <span>Owner: <span className="text-mist-300">{profile.ownerName}</span></span>}
              </div>
            </div>
            <div className="shrink-0">
              {badge ? (
                <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold", badge.tone)}>
                  <badge.icon className="size-3.5" /> {badge.label}
                </span>
              ) : profile.full ? (
                <span className="inline-flex items-center rounded-lg bg-white/[0.05] px-3 py-2 text-xs font-semibold text-mist-500">Agency full</span>
              ) : (
                <Button size="sm" onClick={join} disabled={busy || !canJoin}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Landmark className="size-4" />} Join Agency</Button>
              )}
            </div>
          </div>

          {profile.description && <p className="mt-3 whitespace-pre-wrap text-sm text-mist-300">{profile.description}</p>}

          {/* Quick stats */}
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat icon={Users} label="Members" value={`${profile.memberCount}/${profile.memberLimit}`} />
            <Stat icon={Crown} label="Level" value={String(profile.level)} />
            <Stat icon={Coins} label="Total coins" value={profile.totalCoins.toLocaleString()} />
          </div>
        </div>
      </Card>

      {/* Rooms this agency manages */}
      <section>
        <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold text-mist-100">
          <Radio className="size-4 text-lotus-300" /> Rooms managed by this agency
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-semibold text-mist-400">{profile.rooms.length}</span>
        </h2>
        {profile.rooms.length === 0 ? (
          <Card className="p-6 text-center text-sm text-mist-400">This agency doesn&apos;t manage any rooms yet.</Card>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {profile.rooms.map((r) => {
              const Icon = TYPE_ICON[r.type] ?? Globe;
              return (
                <Link key={r.id} href={`/rooms/${r.id}`} className="flex items-center gap-3 rounded-xl border border-white/10 bg-ink-850/60 p-3 transition hover:border-lotus-400/50 hover:bg-ink-850">
                  <Avatar name={r.name} size="md" ring />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-semibold text-mist-100">{r.name}</span>
                      {r.live && <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-rose-300"><Radio className="size-2.5" /> Live</span>}
                    </div>
                    <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-mist-400"><Icon className="size-3.5" /> {r.type}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Members */}
      <section>
        <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold text-mist-100">
          <Users className="size-4 text-lotus-300" /> Members
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-semibold text-mist-400">{profile.memberCount}</span>
        </h2>
        <Card className="divide-y divide-white/[0.06] p-0">
          {profile.members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="relative">
                <Avatar name={m.name} src={m.avatar || undefined} size="sm" />
                {m.online && <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-ink-900 bg-emerald-400" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-mist-100">{m.name}</div>
                <div className="truncate text-[11px] text-mist-500">@{m.username}</div>
              </div>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", ROLE_TONE[m.role] ?? "bg-white/[0.06] text-mist-300")}>{m.role}</span>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-ink-850/60 px-2 py-3">
      <Icon className="mx-auto size-4 text-lotus-300" />
      <div className="mt-1 font-display text-base font-bold text-mist-100">{value}</div>
      <div className="text-[11px] text-mist-500">{label}</div>
    </div>
  );
}
