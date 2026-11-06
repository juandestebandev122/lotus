"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import {
  fetchAgencies, requestToJoinAgency, respondToAgencyInvite,
  fetchAgencyPlans, createAgencyRequest,
  submitAgencyChangeRequest, fetchMyAgencyChangeRequest,
  type AgencyDirectoryCard, type MyAgencyInvite, type AgencyPlan, type AgencyChangeRequest,
} from "@/lib/agency";
import { Landmark, Crown, Users, TrendingUp, Search, Loader2, Check, X, Mail, UserCheck, Clock, Building, Plus, Coins, ArrowLeftRight } from "lucide-react";
import { AgencyRequestsPanel } from "@/components/AgencyRequestsPanel";

const STATUS_BADGE: Record<string, { label: string; tone: string }> = {
  owner: { label: "You own this", tone: "bg-gold-500/15 text-gold-300" },
  manager: { label: "You manage this", tone: "bg-lotus-500/15 text-lotus-300" },
  cohost: { label: "You're a co-host", tone: "bg-sky-500/15 text-sky-300" },
  member: { label: "You're a member", tone: "bg-emerald-500/15 text-emerald-300" },
  pending: { label: "Request pending", tone: "bg-amber-500/15 text-amber-300" },
  invited: { label: "You're invited", tone: "bg-violet-500/15 text-violet-300" },
};

export default function AgenciesDirectoryPage() {
  const { toast } = useToast();
  const [agencies, setAgencies] = useState<AgencyDirectoryCard[]>([]);
  const [invites, setInvites] = useState<MyAgencyInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [q, setQ] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);
  // The user's current agency-change request (if any) + the agency they're
  // currently switching to (drives the reason modal).
  const [myChange, setMyChange] = useState<AgencyChangeRequest | null>(null);
  const [changeFor, setChangeFor] = useState<AgencyDirectoryCard | null>(null);

  const load = useCallback(() => Promise.all([fetchAgencies(), fetchMyAgencyChangeRequest()]).then(([d, ch]) => { setAgencies(d.agencies); setInvites(d.invites); setMyChange(ch); setLoading(false); }), []);
  useEffect(() => { load(); }, [load]);

  // The agency the user already belongs to (owner/manager/cohost/member), if any.
  // While in an agency, joining ANOTHER one is a "change" that needs admin approval.
  const myAgency = agencies.find((a) => ["owner", "manager", "cohost", "member"].includes(a.myStatus));
  const isOwner = myAgency?.myStatus === "owner";
  const hasPendingChange = myChange?.status === "pending";

  const join = async (a: AgencyDirectoryCard) => {
    setBusy(a.id);
    const res = await requestToJoinAgency(a.id);
    setBusy("");
    if (res.ok) { toast(`Request sent to "${a.name}" — the agency admin will review it.`, "success"); load(); }
    else toast(res.error ?? "Could not send request", "error");
  };

  const respond = async (inv: MyAgencyInvite, accept: boolean) => {
    setBusy(inv.agencyId + (accept ? "a" : "d"));
    const res = await respondToAgencyInvite(inv.agencyId, accept);
    setBusy("");
    if (res.ok) { toast(accept ? `You joined "${inv.name}"! 🎉` : "Invitation declined", accept ? "success" : "info"); load(); }
    else toast(res.error ?? "Could not respond", "error");
  };

  const filtered = agencies.filter((a) => {
    const s = q.trim().toLowerCase();
    return !s || a.name.toLowerCase().includes(s) || a.agencyId.toLowerCase().includes(s) || (a.ownerName ?? "").toLowerCase().includes(s);
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><Landmark className="size-6 text-lotus-300" /> Agencies</h1>
          <p className="mt-0.5 text-sm text-mist-400">Browse agencies and request to join, or start your own.</p>
        </div>
        <Button onClick={() => setRequestOpen(true)}><Plus className="size-4" /> Request your own agency</Button>
      </div>
      {requestOpen && <RequestAgencyModal onClose={() => setRequestOpen(false)} onDone={() => { setRequestOpen(false); load(); }} />}
      {changeFor && (
        <ChangeAgencyModal
          target={changeFor}
          fromName={myAgency?.name}
          onClose={() => setChangeFor(null)}
          onDone={() => { setChangeFor(null); load(); }}
        />
      )}

      {/* Your agency-change request status (pending / rejected). Cancelled + full
          history are shown by the request-history panel below. */}
      {myChange && (myChange.status === "pending" || myChange.status === "rejected") && (
        <Card className={cn("flex items-start gap-2.5 p-3.5", myChange.status === "pending" ? "border-amber-400/30 bg-amber-500/[0.07]" : "border-rose-400/30 bg-rose-500/[0.07]")}>
          <ArrowLeftRight className={cn("mt-0.5 size-4 shrink-0", myChange.status === "pending" ? "text-amber-300" : "text-rose-300")} />
          <div className="min-w-0 flex-1 text-xs">
            {myChange.status === "pending" ? (
              <p className="text-mist-200"><span className="font-semibold text-amber-200">Agency change pending admin approval</span> — you asked to move{myChange.fromAgencyName ? ` from “${myChange.fromAgencyName}”` : ""} to <span className="font-semibold">“{myChange.toAgencyName}”</span>. You&apos;ll be notified once it&apos;s reviewed.</p>
            ) : (
              <p className="text-mist-200"><span className="font-semibold text-rose-200">Agency change declined</span> — your request to move to “{myChange.toAgencyName}” was not approved{myChange.decisionReason ? `: ${myChange.decisionReason}` : "."}</p>
            )}
          </div>
        </Card>
      )}

      {/* Invitations you've received */}
      {invites.length > 0 && (
        <Card className="border-violet-400/30 bg-violet-500/5 p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-mist-100"><Mail className="size-4 text-violet-300" /> Your invitations ({invites.length})</h2>
          <div className="space-y-2">
            {invites.map((inv) => (
              <div key={inv.agencyId} className="flex items-center gap-2.5 rounded-lg border border-line bg-ink-800/60 px-3 py-2">
                <AgencyLogo logo={inv.logo} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-mist-100">{inv.name}</div>
                  <div className="truncate text-[11px] text-mist-500">{inv.publicId}{inv.byName ? ` · invited by ${inv.byName}` : ""}</div>
                </div>
                <Button size="sm" onClick={() => respond(inv, true)} disabled={busy === inv.agencyId + "a"}>{busy === inv.agencyId + "a" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Accept</Button>
                <Button size="sm" variant="ghost" className="!text-rose-300" onClick={() => respond(inv, false)} disabled={busy === inv.agencyId + "d"}><X className="size-4" /> Decline</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* The user's own request history (join + change) — Pending/Approved/Rejected. */}
      <AgencyRequestsPanel />

      {/* Search */}
      <div className="flex items-center gap-2 rounded-xl border border-line bg-ink-800 px-3">
        <Search className="size-4 text-mist-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search agencies by name, ID or owner…" className="h-11 w-full bg-transparent text-sm text-mist-100 outline-none placeholder:text-mist-500" />
      </div>

      {loading ? (
        <div className="grid h-40 place-items-center text-mist-400"><Loader2 className="size-5 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <Building className="mx-auto size-9 text-mist-600" />
          <p className="mt-2 text-sm text-mist-400">{agencies.length === 0 ? "No agencies yet." : "No agencies match your search."}</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((a) => (
            <AgencyCard
              key={a.id}
              a={a}
              busy={busy === a.id}
              onJoin={() => join(a)}
              inAgency={!!myAgency}
              isOwner={isOwner}
              hasPendingChange={hasPendingChange}
              onChange={() => setChangeFor(a)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AgencyCard({ a, busy, onJoin, inAgency, isOwner, hasPendingChange, onChange }: { a: AgencyDirectoryCard; busy: boolean; onJoin: () => void; inAgency: boolean; isOwner: boolean; hasPendingChange: boolean; onChange: () => void }) {
  const badge = STATUS_BADGE[a.myStatus];
  const canJoin = a.myStatus === "none";
  // If the user already belongs to an agency, moving to a DIFFERENT one is a
  // "change" that needs admin approval + a reason (not a plain owner-approved join).
  const isChange = canJoin && inAgency;
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <AgencyLogo logo={a.logo} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link href={`/agencies/${a.id}`} className="truncate font-bold text-mist-100 transition hover:text-lotus-200">{a.name}</Link>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-mist-500">
            <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-semibold text-mist-300">{a.agencyId}</span>
            <span className="inline-flex items-center gap-0.5 text-gold-300"><Crown className="size-3" /> Lvl {a.level}</span>
            <span className="inline-flex items-center gap-0.5"><TrendingUp className="size-3" /> #{a.rank}</span>
          </div>
        </div>
      </div>

      {a.description && <p className="line-clamp-2 text-xs text-mist-400">{a.description}</p>}

      <div className="flex items-center justify-between text-xs text-mist-400">
        <span className="inline-flex items-center gap-1"><Users className="size-3.5 text-lotus-300" /> {a.memberCount}/{a.memberLimit} members</span>
        {a.ownerName && <span className="truncate">Owner: <span className="text-mist-300">{a.ownerName}</span></span>}
      </div>

      <div className="mt-auto">
        {badge ? (
          <span className={cn("inline-flex w-full items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-bold", badge.tone)}>
            {a.myStatus === "pending" ? <Clock className="size-3.5" /> : a.myStatus === "invited" ? <Mail className="size-3.5" /> : <UserCheck className="size-3.5" />} {badge.label}
          </span>
        ) : a.full ? (
          <span className="inline-flex w-full items-center justify-center rounded-lg bg-white/[0.05] px-3 py-2 text-xs font-semibold text-mist-500">Agency full</span>
        ) : isChange ? (
          isOwner ? (
            <span className="inline-flex w-full items-center justify-center rounded-lg bg-white/[0.05] px-3 py-2 text-center text-[11px] font-semibold text-mist-500">You own an agency — transfer ownership to switch</span>
          ) : (
            <Button block size="sm" variant="secondary" onClick={onChange} disabled={busy || hasPendingChange} title={hasPendingChange ? "You already have a pending change request" : "Request to move to this agency (admin approval)"}>
              <ArrowLeftRight className="size-4" /> {hasPendingChange ? "Change pending…" : "Request to change"}
            </Button>
          )
        ) : (
          <Button block size="sm" onClick={onJoin} disabled={busy || !canJoin}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Landmark className="size-4" />} Join Agency</Button>
        )}
      </div>
    </Card>
  );
}

function RequestAgencyModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [plans, setPlans] = useState<AgencyPlan[]>([]);
  const [f, setF] = useState<Record<string, string>>({ name: "", type: "", description: "", country: "", state: "", city: "", address: "", contactPerson: "", mobile: "", email: "", website: "" });
  const [planId, setPlanId] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetchAgencyPlans().then((p) => { setPlans(p); if (p[0]) setPlanId(p[0].id); }); }, []);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const field = "h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400";

  const submit = async () => {
    if (!f.name.trim()) return toast("Enter your agency name", "error");
    setBusy(true);
    const res = await createAgencyRequest({ ...f, planId });
    setBusy(false);
    if (res.ok) { toast("Agency request submitted! It's now awaiting admin approval.", "success"); onDone(); }
    else toast(res.error ?? "Could not submit", "error");
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-lg rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Landmark className="size-5 text-lotus-300" /> Request your own agency</h2>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>
        <p className="mb-3 text-xs text-mist-500">Fill in your agency details and pick a membership plan. An admin reviews every request; you pay the coins to activate after approval.</p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="text-[11px] font-semibold text-mist-400">Agency name *</label><input value={f.name} onChange={(e) => set("name", e.target.value)} className={field} maxLength={60} /></div>
          <div><label className="text-[11px] font-semibold text-mist-400">Agency type</label><input value={f.type} onChange={(e) => set("type", e.target.value)} placeholder="e.g. Music / Gaming" className={field} /></div>
          <div><label className="text-[11px] font-semibold text-mist-400">Contact person</label><input value={f.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} className={field} /></div>
          <div className="sm:col-span-2"><label className="text-[11px] font-semibold text-mist-400">Description</label><input value={f.description} onChange={(e) => set("description", e.target.value)} className={field} maxLength={300} /></div>
          <div><label className="text-[11px] font-semibold text-mist-400">Mobile number</label><input value={f.mobile} onChange={(e) => set("mobile", e.target.value)} className={field} /></div>
          <div><label className="text-[11px] font-semibold text-mist-400">Email address</label><input value={f.email} onChange={(e) => set("email", e.target.value)} className={field} /></div>
          <div><label className="text-[11px] font-semibold text-mist-400">Country</label><input value={f.country} onChange={(e) => set("country", e.target.value)} className={field} /></div>
          <div><label className="text-[11px] font-semibold text-mist-400">State</label><input value={f.state} onChange={(e) => set("state", e.target.value)} className={field} /></div>
          <div><label className="text-[11px] font-semibold text-mist-400">City</label><input value={f.city} onChange={(e) => set("city", e.target.value)} className={field} /></div>
          <div><label className="text-[11px] font-semibold text-mist-400">Website</label><input value={f.website} onChange={(e) => set("website", e.target.value)} className={field} /></div>
          <div className="sm:col-span-2"><label className="text-[11px] font-semibold text-mist-400">Address</label><input value={f.address} onChange={(e) => set("address", e.target.value)} className={field} maxLength={200} /></div>
        </div>

        <label className="mt-4 block text-[11px] font-semibold text-mist-400">Membership plan</label>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          {plans.map((p) => (
            <button key={p.id} onClick={() => setPlanId(p.id)} className={cn("flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition", planId === p.id ? "border-lotus-400 bg-lotus-500/15" : "border-line bg-ink-800 hover:border-lotus-400/40")}>
              <span className="font-semibold text-mist-100">{p.name}</span>
              <span className="flex items-center gap-1 text-xs text-gold-300"><Coins className="size-3.5" /> {p.priceCoins.toLocaleString()}</span>
            </button>
          ))}
          {plans.length === 0 && <p className="text-xs text-mist-500 sm:col-span-2">No plans available right now.</p>}
        </div>

        <Button block className="mt-5" onClick={submit} disabled={busy || !f.name.trim()}>{busy ? "Submitting…" : "Submit request"}</Button>
      </div>
    </div>
  );
}

// Reason prompt for a member-initiated agency change (goes to admin for approval).
function ChangeAgencyModal({ target, fromName, onClose, onDone }: { target: AgencyDirectoryCard; fromName?: string; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (reason.trim().length < 3) return toast("Please enter a valid reason for the change.", "error");
    setBusy(true);
    const res = await submitAgencyChangeRequest(target.id, reason.trim());
    setBusy(false);
    if (res.ok) { toast("Change request submitted — an admin will review it.", "success"); onDone(); }
    else toast(res.error ?? "Could not submit", "error");
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-md rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><ArrowLeftRight className="size-5 text-lotus-300" /> Request agency change</h2>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>
        <p className="mb-3 text-xs text-mist-500">
          You&apos;re requesting to move{fromName ? <> from <span className="font-semibold text-mist-300">“{fromName}”</span></> : ""} to <span className="font-semibold text-mist-200">“{target.name}”</span>. A user can belong to only one agency, so this needs <span className="font-semibold text-mist-300">admin approval</span>. Once approved you&apos;ll be moved to the new agency.
        </p>
        <label className="block text-[11px] font-semibold text-mist-400">Reason for the change *</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          rows={4}
          placeholder="Tell the admin why you want to change agency…"
          className="mt-1 w-full resize-none rounded-lg border border-line bg-ink-800 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400"
        />
        <Button block className="mt-4" onClick={submit} disabled={busy || reason.trim().length < 3}>{busy ? "Submitting…" : "Submit change request"}</Button>
      </div>
    </div>
  );
}

function AgencyLogo({ logo, size }: { logo?: string; size: "sm" | "lg" }) {
  const cls = size === "lg" ? "size-12 rounded-xl" : "size-10 rounded-lg";
  return (
    <span className={cn("grid shrink-0 place-items-center overflow-hidden border border-line bg-lotus-500/15 text-lotus-200", cls)} style={logo ? { backgroundImage: `url(${logo})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
      {!logo && <Landmark className={size === "lg" ? "size-6" : "size-5"} />}
    </span>
  );
}
