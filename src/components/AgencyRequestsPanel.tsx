"use client";

import { useEffect, useState } from "react";
import { Landmark, Clock, Check, X, Ban, ArrowLeftRight, History } from "lucide-react";
import { fetchMyAgencyRequests, type AgencyJoinRequest, type AgencyChangeRequest } from "@/lib/agency";
import { cn } from "@/lib/cn";

const STATUS: Record<string, { label: string; tone: string; icon: typeof Clock }> = {
  pending: { label: "Pending", tone: "bg-amber-500/15 text-amber-300", icon: Clock },
  approved: { label: "Approved", tone: "bg-emerald-500/15 text-emerald-300", icon: Check },
  rejected: { label: "Rejected", tone: "bg-rose-500/15 text-rose-300", icon: X },
  blocked: { label: "Blocked", tone: "bg-rose-600/20 text-rose-300", icon: Ban },
  cancelled: { label: "Cancelled", tone: "bg-white/[0.08] text-mist-400", icon: X },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.pending;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold", s.tone)}>
      <s.icon className="size-3" /> {s.label}
    </span>
  );
}

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "");

/**
 * "My Agency Requests" — the user-visible request HISTORY (client: complete
 * request history with Pending / Approved / Rejected). Shows the user's join
 * requests and their change/transfer requests, each with status + dates.
 * Renders nothing when the user has never made a request (keeps the profile tidy).
 */
export function AgencyRequestsPanel({ className }: { className?: string }) {
  const [join, setJoin] = useState<AgencyJoinRequest[]>([]);
  const [change, setChange] = useState<AgencyChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetchMyAgencyRequests().then((d) => { setJoin(d.join); setChange(d.change); }).finally(() => setLoading(false)); }, []);
  if (loading || (join.length === 0 && change.length === 0)) return null;

  return (
    <div className={cn("rounded-2xl border border-white/8 bg-ink-850/70 p-4", className)}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-mist-100"><History className="size-4 text-lotus-300" /> My agency requests</h3>

      {join.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-mist-500">Join requests</div>
          {join.map((r) => (
            <div key={r.id} className="flex items-center gap-2 rounded-lg border border-line bg-ink-800/60 px-3 py-2">
              <Landmark className="size-4 shrink-0 text-lotus-300" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-mist-100">{r.agencyName}{r.agencyPublicId ? <span className="ml-1 font-mono text-[10px] text-mist-500">{r.agencyPublicId}</span> : null}</div>
                <div className="text-[10px] text-mist-500">Requested {fmt(r.createdAt)}{r.decidedAt ? ` · ${STATUS[r.status]?.label ?? r.status} ${fmt(r.decidedAt)}${r.decidedByName ? ` by ${r.decidedByName}` : ""}` : ""}</div>
              </div>
              <StatusPill status={r.status} />
            </div>
          ))}
        </div>
      )}

      {change.length > 0 && (
        <div className={cn("space-y-1.5", join.length > 0 && "mt-3")}>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-mist-500">Agency change / transfer requests</div>
          {change.map((r) => (
            <div key={r.id} className="rounded-lg border border-line bg-ink-800/60 px-3 py-2">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="size-4 shrink-0 text-lotus-300" />
                <div className="min-w-0 flex-1 text-sm text-mist-100">
                  <span className="text-mist-400">{r.fromAgencyName ?? "No agency"}</span> → <span className="font-semibold">{r.toAgencyName}</span>
                </div>
                <StatusPill status={r.status} />
              </div>
              <div className="mt-0.5 pl-6 text-[10px] text-mist-500">Requested {fmt(r.createdAt)}{r.decidedAt ? ` · ${STATUS[r.status]?.label ?? r.status} ${fmt(r.decidedAt)}${r.decidedByName ? ` by ${r.decidedByName}` : ""}` : ""}{r.decisionReason ? ` — “${r.decisionReason}”` : ""}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
