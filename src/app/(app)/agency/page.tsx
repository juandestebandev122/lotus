"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import Link from "next/link";
import {
  fetchAgencyPortal, agencyMemberAction, agencyAnnounce, agencySearchUsers, agencyCreateMember,
  fetchAgencyPlans, buyAgencyMembership, fetchAgencyPayments, fetchMyAgency,
  fetchAgencyGroups, agencyGroupAction, agencyMemberDetails, agencyEditMember, fetchAgencyStorage, agencySendStorageWarning,
  type AgencyPortal, type AgencyMemberRow, type AgencyUserResult, type AgencyMemberActionType,
  type AgencyPlan, type AgencyPayment, type AgencyMembership, type MyAgency,
  type AgencyPermissions, type AgencyGroupRow, type AgencyMemberDetails, type AgencyStorageInfo, type AgencyUserSubmission,
} from "@/lib/agency";
import {
  Landmark, Users, UserCheck, UserX, Crown, Shield, Star, Megaphone, Search, Plus, Trash2,
  Coins, TrendingUp, Loader2, Send, Check, X, ChevronDown, UserPlus, Mail, Receipt, Clock, CheckCircle2, AlertTriangle,
  Radio, Lock, Unlock, Power, ExternalLink, DoorClosed, HardDrive, KeyRound, Eye, Pencil, Pen, Ban,
} from "lucide-react";

const ROLE_META: Record<string, { label: string; icon: typeof Crown; tone: string }> = {
  owner: { label: "Owner", icon: Crown, tone: "bg-gold-500/15 text-gold-300" },
  manager: { label: "Manager", icon: Shield, tone: "bg-lotus-500/15 text-lotus-300" },
  cohost: { label: "Co-Host", icon: Star, tone: "bg-sky-500/15 text-sky-300" },
  member: { label: "Member", icon: Users, tone: "bg-white/[0.06] text-mist-300" },
  pending: { label: "Pending", icon: UserPlus, tone: "bg-amber-500/15 text-amber-300" },
};

export default function AgencyPortalPage() {
  const { toast } = useToast();
  const [portal, setPortal] = useState<AgencyPortal | null>(null);
  const [myAgency, setMyAgency] = useState<MyAgency | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [detailMember, setDetailMember] = useState<AgencyMemberRow | null>(null);
  const [editMember, setEditMember] = useState<AgencyMemberRow | null>(null);

  const load = useCallback(async () => {
    const [p, mine] = await Promise.all([fetchAgencyPortal(), fetchMyAgency()]);
    setPortal(p); setMyAgency(mine); setLoading(false);
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(() => { if (typeof document === "undefined" || !document.hidden) load(); }, 20000);
    return () => clearInterval(t);
  }, [load]);

  const canManage = portal?.myRole === "owner" || portal?.myRole === "manager";
  const isOwner = portal?.myRole === "owner";

  const act = async (action: AgencyMemberActionType, m: AgencyMemberRow) => {
    if (action === "remove" && !window.confirm(`Remove ${m.name} from the agency?`)) return;
    setBusy(m.id + action);
    const res = await agencyMemberAction(action, m.id);
    setBusy("");
    if (res.ok) { toast("Done", "success"); load(); } else toast(res.error ?? "Action failed", "error");
  };

  const cancelInvite = async (id: string) => {
    setBusy(id + "cancelInvite");
    const res = await agencyMemberAction("cancelInvite", id);
    setBusy("");
    if (res.ok) { toast("Invitation cancelled", "info"); load(); } else toast(res.error ?? "Failed", "error");
  };

  if (loading) return <div className="grid min-h-[50vh] place-items-center text-mist-400">Loading your agency…</div>;
  // MEMBER (not owner/manager) — no management portal, but they ARE in an agency:
  // show a friendly card that opens their agency's profile.
  if (!portal && myAgency) return (
    <div className="mx-auto max-w-lg">
      <Card className="p-8 text-center">
        <div className="mx-auto grid size-16 place-items-center overflow-hidden rounded-2xl bg-lotus-500/15">
          {myAgency.logo ? <img src={myAgency.logo} alt="" className="size-full object-cover" /> : <Landmark className="size-8 text-lotus-300" />}
        </div>
        <h1 className="mt-3 font-display text-xl font-extrabold text-mist-100">{myAgency.name}</h1>
        <p className="mt-1 font-mono text-xs text-mist-500">{myAgency.agencyId} · {myAgency.memberCount} members</p>
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold text-mist-300"><Users className="size-3.5" /> You&apos;re a {ROLE_META[myAgency.role]?.label ?? "member"}</span>
        <p className="mt-3 text-sm text-mist-400">You&apos;re a member of this agency. Open its profile to see the members, rooms and details.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href={`/agencies/${myAgency.id}`}><Button><Landmark className="size-4" /> Open agency profile</Button></Link>
          <Link href="/agencies"><Button variant="secondary">Browse agencies</Button></Link>
        </div>
      </Card>
    </div>
  );
  if (!portal) return (
    <div className="mx-auto max-w-lg">
      <Card className="p-10 text-center">
        <Landmark className="mx-auto size-10 text-mist-600" />
        <h1 className="mt-3 font-display text-xl font-extrabold text-mist-100">No agency yet</h1>
        <p className="mt-2 text-sm text-mist-400">You&apos;re not in an agency yet. Browse agencies to join one, or an admin can assign you as an owner.</p>
        <div className="mt-4 flex justify-center"><Link href="/agencies"><Button variant="secondary"><Landmark className="size-4" /> Browse agencies</Button></Link></div>
      </Card>
    </div>
  );

  const a = portal.agency;
  const stat = [
    { label: "Members", value: portal.counts.total, icon: Users, tone: "text-lotus-300" },
    { label: "Active", value: portal.counts.active, icon: UserCheck, tone: "text-emerald-300" },
    { label: "Inactive", value: portal.counts.inactive, icon: UserX, tone: "text-mist-400" },
    { label: "Managers", value: portal.counts.managers, icon: Shield, tone: "text-lotus-300" },
    { label: "Co-Hosts", value: portal.counts.coHosts, icon: Star, tone: "text-sky-300" },
    { label: "Earnings", value: a.earnings.toLocaleString("en-SA"), icon: Coins, tone: "text-gold-300" },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Header */}
      <Card className="overflow-hidden p-0">
        <div className="h-20 w-full bg-gradient-to-r from-lotus-600/40 to-petal-600/30" />
        <div className="px-5 pb-5">
          <div className="-mt-8 flex items-end gap-3">
            <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 border-ink-850 bg-lotus-500/20 text-lotus-200" style={a.logo ? { backgroundImage: `url(${a.logo})`, backgroundSize: "cover" } : undefined}>
              {!a.logo && <Landmark className="size-8" />}
            </span>
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate font-display text-xl font-extrabold text-mist-100">{a.name}</h1>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-bold text-mist-300">{a.agencyId}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold capitalize", a.status === "active" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300")}>{a.status}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-mist-400">
                <span className="inline-flex items-center gap-1 text-gold-300"><Crown className="size-3.5" /> Level {a.level}</span>
                <span className="inline-flex items-center gap-1"><TrendingUp className="size-3.5" /> Rank #{portal.rank}</span>
                <span>Owner: {a.ownerName ?? "—"}</span>
                <span>You: {ROLE_META[portal.myRole]?.label ?? portal.myRole}</span>
              </div>
            </div>
          </div>
          {a.description && <p className="mt-3 text-sm text-mist-300">{a.description}</p>}
        </div>
      </Card>

      {/* Membership status + purchase / renew (owner only) */}
      {isOwner && a.membership && <MembershipPanel agencyId={a.id} m={a.membership} onChanged={load} />}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {stat.map((s) => (
          <Card key={s.label} className="p-3 text-center">
            <s.icon className={cn("mx-auto size-4", s.tone)} />
            <div className="mt-1 font-display text-lg font-extrabold text-mist-100">{s.value}</div>
            <div className="text-[10px] text-mist-500">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Announcements */}
      {canManage && <Announce onSent={load} />}
      {portal.announcements.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-mist-100"><Megaphone className="size-4 text-lotus-300" /> Recent announcements</h2>
          <div className="space-y-2">
            {portal.announcements.slice(0, 5).map((an) => (
              <div key={an.id} className="rounded-lg border border-line bg-ink-800/60 px-3 py-2">
                <p className="text-sm text-mist-200">{an.text}</p>
                <p className="mt-0.5 text-[10px] text-mist-500">{an.byName} · {new Date(an.at).toLocaleString("en-SA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Pending join requests */}
      {canManage && portal.pending.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-mist-100"><UserPlus className="size-4 text-amber-300" /> Pending requests ({portal.pending.length})</h2>
          <div className="space-y-2">
            {portal.pending.map((m) => (
              <div key={m.id} className="flex items-center gap-2 rounded-lg border border-line bg-ink-800/60 px-3 py-2">
                <Avatar name={m.name} src={m.avatar || undefined} size="sm" />
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-mist-100">{m.name}</div><div className="truncate text-[11px] text-mist-500">@{m.username}{m.publicId ? ` · ID ${m.publicId}` : ""}</div></div>
                <Button size="sm" onClick={() => act("approve", m)} disabled={busy === m.id + "approve"}><Check className="size-4" /> Approve</Button>
                <Button size="sm" variant="ghost" className="!text-rose-300" onClick={() => act("reject", m)} title="Decline (they can request again)"><X className="size-4" /></Button>
                <Button size="sm" variant="ghost" className="!text-rose-400" onClick={() => { if (window.confirm(`Block ${m.name}? They will be declined AND barred from requesting to join this agency again.`)) act("block", m); }} title="Block from re-requesting">Block</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Blocked users — barred from re-requesting. The owner/manager can unblock. */}
      {canManage && (portal.blocked?.length ?? 0) > 0 && (
        <Card className="p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-mist-100"><Ban className="size-4 text-rose-300" /> Blocked ({portal.blocked!.length})</h2>
          <div className="space-y-2">
            {portal.blocked!.map((m) => (
              <div key={m.id} className="flex items-center gap-2 rounded-lg border border-line bg-ink-800/60 px-3 py-2">
                <Avatar name={m.name} src={m.avatar || undefined} size="sm" />
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-mist-100">{m.name}</div><div className="truncate text-[11px] text-mist-500">@{m.username}{m.publicId ? ` · ID ${m.publicId}` : ""}</div></div>
                <Button size="sm" variant="ghost" onClick={() => act("unblock", m)} title="Allow them to request again">Unblock</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Sent invitations (awaiting the user's reply) */}
      {canManage && portal.sentInvites.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-mist-100"><Mail className="size-4 text-violet-300" /> Sent invitations ({portal.sentInvites.length})</h2>
          <div className="space-y-2">
            {portal.sentInvites.map((iv) => (
              <div key={iv.id} className="flex items-center gap-2 rounded-lg border border-line bg-ink-800/60 px-3 py-2">
                <Avatar name={iv.name} src={iv.avatar || undefined} size="sm" />
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-mist-100">{iv.name}</div><div className="truncate text-[11px] text-mist-500">@{iv.username} · invited {new Date(iv.at).toLocaleDateString("en-SA", { day: "2-digit", month: "short" })}{iv.byName ? ` by ${iv.byName}` : ""}</div></div>
                <span className="shrink-0 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold text-violet-300">Awaiting reply</span>
                <Button size="sm" variant="ghost" className="!text-rose-300" onClick={() => cancelInvite(iv.id)} disabled={busy === iv.id + "cancelInvite"} title="Cancel invitation"><X className="size-4" /></Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Groups (rooms the agency manages) — with permission-gated actions. */}
      {canManage && <AgencyGroups perms={a.permissions} members={portal.members} />}

      {/* Storage management (View storage + Send warnings) — permission-gated. */}
      {canManage && a.permissions?.storage.view && <AgencyStorageCard perms={a.permissions} />}

      {/* What the admin allows this agency to do (visible + gates the actions). */}
      {canManage && a.permissions && <PermissionsCard perms={a.permissions} />}

      {/* Invite / add member */}
      {canManage && <AddMember counts={portal.counts} limit={a.memberLimit} canCreate={!!a.canCreateUsers} onChanged={load} />}

      {/* Accounts this agency created + their admin-approval status (Agency View). */}
      {canManage && portal.submissions && portal.submissions.length > 0 && <SubmissionsCard subs={portal.submissions} />}

      {/* Member list */}
      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-mist-100"><Users className="size-4 text-lotus-300" /> Members ({portal.members.length}/{a.memberLimit})</h2>
        <div className="space-y-2">
          {portal.members.map((m) => (
            <MemberRow key={m.id} m={m} canManage={canManage} isOwner={isOwner} busy={busy} perms={a.permissions} onAct={act} onView={setDetailMember} onEdit={setEditMember} />
          ))}
        </div>
      </Card>

      {detailMember && <MemberDetailsModal member={detailMember} onClose={() => setDetailMember(null)} />}
      {editMember && <MemberEditModal member={editMember} onClose={() => setEditMember(null)} onSaved={() => { setEditMember(null); load(); }} />}
    </div>
  );
}

// Read-only member details (gated by the "View user details" permission).
function MemberDetailsModal({ member, onClose }: { member: AgencyMemberRow; onClose: () => void }) {
  const { toast } = useToast();
  const [d, setD] = useState<AgencyMemberDetails | null>(null);
  useEffect(() => { agencyMemberDetails(member.id).then((r) => { if (r.ok) setD(r.details ?? null); else { toast(r.error ?? "Not allowed", "error"); onClose(); } }); }, [member.id, toast, onClose]);
  const Row = ({ k, v }: { k: string; v: string }) => (<div className="flex justify-between gap-3 border-b border-line/50 py-1.5 text-sm last:border-0"><span className="text-mist-500">{k}</span><span className="text-right font-medium text-mist-100">{v}</span></div>);
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <Card className="w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2.5">
          <Avatar name={member.name} src={member.avatar || undefined} size="md" />
          <div className="min-w-0"><div className="truncate font-bold text-mist-100">{member.name}</div><div className="text-xs text-mist-500">@{member.username}</div></div>
          <button onClick={onClose} className="ml-auto grid size-8 place-items-center rounded-full bg-white/10 text-mist-300 hover:bg-white/20"><X className="size-4" /></button>
        </div>
        {!d ? <div className="grid place-items-center p-6 text-mist-400"><Loader2 className="size-5 animate-spin" /></div> : (
          <div>
            <Row k="Member ID" v={d.publicId || d.id.slice(0, 8)} />
            <Row k="Role" v={ROLE_META[d.role ?? "member"]?.label ?? "Member"} />
            <Row k="Level" v={String(d.level)} />
            <Row k="Coins" v={d.coins.toLocaleString("en-SA")} />
            <Row k="Lotus" v={d.lotus.toLocaleString("en-SA")} />
            {d.email && <Row k="Email" v={d.email} />}
            {d.phone && <Row k="Phone" v={d.phone} />}
            <Row k="Status" v={d.online ? "Online" : "Offline"} />
            {d.joinedAt && <Row k="Joined agency" v={new Date(d.joinedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} />}
            <Row k="Account" v={d.accountStatus} />
          </div>
        )}
      </Card>
    </div>
  );
}

// Edit a member's basic profile (gated by the "Edit users" permission).
function MemberEditModal({ member, onClose, onSaved }: { member: AgencyMemberRow; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState({ fullName: member.name, email: "", phone: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => { agencyMemberDetails(member.id).then((r) => { if (r.ok && r.details) setF({ fullName: r.details.name, email: r.details.email ?? "", phone: r.details.phone ?? "" }); }); }, [member.id]);
  const field = "h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400";
  const save = async () => {
    if (f.fullName.trim().length < 2) return toast("Enter a name", "error");
    setSaving(true);
    const res = await agencyEditMember(member.id, { fullName: f.fullName.trim(), email: f.email.trim(), phone: f.phone.trim() });
    setSaving(false);
    if (res.ok) { toast("Member updated", "success"); onSaved(); } else toast(res.error ?? "Could not save", "error");
  };
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <Card className="w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h3 className="font-bold text-mist-100">Edit {member.name}</h3><button onClick={onClose} className="grid size-8 place-items-center rounded-full bg-white/10 text-mist-300 hover:bg-white/20"><X className="size-4" /></button></div>
        <div className="space-y-3">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-300">Full name</span><input value={f.fullName} onChange={(e) => setF((s) => ({ ...s, fullName: e.target.value }))} className={field} /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-300">Email</span><input value={f.email} onChange={(e) => setF((s) => ({ ...s, email: e.target.value }))} className={field} placeholder="optional" /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-mist-300">Phone</span><input value={f.phone} onChange={(e) => setF((s) => ({ ...s, phone: e.target.value }))} className={field} placeholder="optional" /></label>
        </div>
        <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save</Button></div>
      </Card>
    </div>
  );
}

// Accounts the agency created + their admin-approval status (Pending/Approved/Rejected).
function SubmissionsCard({ subs }: { subs: AgencyUserSubmission[] }) {
  const tone: Record<string, string> = { pending: "bg-amber-500/15 text-amber-300", approved: "bg-emerald-500/15 text-emerald-300", rejected: "bg-rose-500/15 text-rose-300" };
  const fmt = (s?: string) => { if (!s) return ""; const d = new Date(s); return isNaN(d.getTime()) ? "" : d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); };
  const pendingCount = subs.filter((s) => s.status === "pending").length;
  return (
    <Card className="p-4">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-mist-100"><UserCheck className="size-4 text-lotus-300" /> Accounts you submitted <span className="font-normal text-mist-500">({subs.length}{pendingCount ? ` · ${pendingCount} pending` : ""})</span></h2>
      <p className="mb-2 text-[11px] text-mist-500">Accounts your agency created. When admin approval is required, they stay <b className="text-amber-300">Pending</b> until an admin approves or rejects them.</p>
      <div className="space-y-1.5">
        {subs.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-ink-800/50 px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-mist-100">{s.userName} <span className="text-[11px] font-normal text-mist-500">@{s.username}</span></div>
              <div className="text-[11px] text-mist-500">Submitted {fmt(s.createdAt)}{s.createdByName ? ` by ${s.createdByName}` : ""}{s.decidedAt ? ` · ${s.status} ${fmt(s.decidedAt)}${s.decidedByName ? ` by ${s.decidedByName}` : ""}` : ""}{s.note ? ` · ${s.note}` : ""}</div>
            </div>
            <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize", tone[s.status])}>{s.status}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Agency storage usage + per-member warnings (View storage / Send warnings perms).
function AgencyStorageCard({ perms }: { perms: AgencyPermissions }) {
  const { toast } = useToast();
  const [data, setData] = useState<AgencyStorageInfo | null>(null);
  const [busy, setBusy] = useState("");
  useEffect(() => { fetchAgencyStorage().then((r) => { if (r.ok) setData(r.data ?? null); }); }, []);
  const mb = (b: number) => { const m = b / (1024 * 1024); return m < 1 ? `${Math.round(b / 1024)} KB` : `${m.toFixed(1)} MB`; };
  const warn = async (id: string, name: string) => {
    setBusy(id);
    const res = await agencySendStorageWarning(id);
    setBusy("");
    if (res.ok) toast(`Storage warning sent to ${name}`, "success"); else toast(res.error ?? "Could not send", "error");
  };
  return (
    <Card className="p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-mist-100"><HardDrive className="size-4 text-lotus-300" /> Storage {data && <span className="text-xs font-normal text-mist-500">· {mb(data.totalBytes)} used by your agency</span>}</h2>
      {!data ? <div className="grid place-items-center p-4 text-mist-400"><Loader2 className="size-5 animate-spin" /></div>
        : data.members.length === 0 ? <p className="text-sm text-mist-500">No members yet.</p>
        : (
          <div className="space-y-1.5">
            {data.members.map((m) => (
              <div key={m.id} className="flex items-center gap-2 rounded-lg bg-ink-800/50 px-3 py-2">
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-mist-100">{m.name}</div><div className="text-[11px] text-mist-500">{mb(m.usedBytes)} · {m.fileCount} files · {m.pct}%</div></div>
                {perms.storage.sendWarnings && <button onClick={() => warn(m.id, m.name)} disabled={busy === m.id} className="inline-flex items-center gap-1 rounded-lg border border-line bg-ink-800 px-2.5 py-1 text-[11px] font-semibold text-amber-300 transition hover:bg-amber-500/10 disabled:opacity-50">{busy === m.id ? <Loader2 className="size-3 animate-spin" /> : <AlertTriangle className="size-3" />} Warn</button>}
              </div>
            ))}
          </div>
        )}
    </Card>
  );
}

function MembershipPanel({ agencyId, m, onChanged }: { agencyId: string; m: AgencyMembership; onChanged: () => void }) {
  const { toast } = useToast();
  const [plans, setPlans] = useState<AgencyPlan[]>([]);
  const [payments, setPayments] = useState<AgencyPayment[]>([]);
  const [planId, setPlanId] = useState("");
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const loadPayments = useCallback(() => fetchAgencyPayments(agencyId).then(setPayments), [agencyId]);
  useEffect(() => { fetchAgencyPlans().then((p) => { setPlans(p); if (p[0]) setPlanId(p[0].id); }); loadPayments(); }, [loadPayments]);

  const needsPay = m.status === "expired" || (m.status === "pending" && m.approved);
  const buy = async () => {
    if (!planId) return;
    setBusy(true);
    const res = await buyAgencyMembership(agencyId, planId);
    setBusy(false);
    if (res.ok) { toast(`Membership active! Receipt ${res.receipt?.id}.`, "success"); loadPayments(); onChanged(); }
    else toast(res.error ?? "Payment failed", "error");
  };

  const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");
  const STATUS: Record<string, { label: string; tone: string; icon: typeof CheckCircle2 }> = {
    active: { label: "Active", tone: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200", icon: CheckCircle2 },
    pending: { label: m.approved ? "Approved — pay to activate" : "Awaiting admin review", tone: "border-amber-400/30 bg-amber-500/10 text-amber-200", icon: Clock },
    expired: { label: "Expired — renew to reactivate", tone: "border-rose-400/30 bg-rose-500/10 text-rose-200", icon: AlertTriangle },
    suspended: { label: "Suspended by admin", tone: "border-rose-400/30 bg-rose-500/10 text-rose-200", icon: AlertTriangle },
    rejected: { label: "Request rejected", tone: "border-rose-400/30 bg-rose-500/10 text-rose-200", icon: X },
  };
  const s = STATUS[m.status] ?? STATUS.pending;

  return (
    <Card className={cn("border p-4", s.tone)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold"><s.icon className="size-4" /> Membership: {s.label}</h2>
        <button onClick={() => setShowHistory((v) => !v)} className="inline-flex items-center gap-1 rounded-lg bg-black/20 px-2.5 py-1 text-[11px] font-semibold hover:bg-black/30"><Receipt className="size-3.5" /> Payment history ({payments.length})</button>
      </div>

      {m.status === "active" && (
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
          <span>Plan: <b className="text-mist-100">{m.planName ?? "—"}</b></span>
          <span>Started: <b className="text-mist-100">{fmt(m.startDate)}</b></span>
          <span>Expires: <b className="text-mist-100">{fmt(m.expiryDate)}</b></span>
          <span>Auto-renewal: <b className="text-mist-100">{m.autoRenewal ? "On" : "Off"}</b></span>
        </div>
      )}
      {m.status === "rejected" && m.rejectionReason && <p className="mt-2 text-xs">Reason: <b>{m.rejectionReason}</b></p>}
      {m.status === "pending" && !m.approved && <p className="mt-2 text-xs text-mist-300">You&apos;ll be notified once an admin reviews your request. After approval, pay the membership coins here to go live.</p>}

      {(needsPay) && (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-semibold text-mist-300">{m.status === "expired" ? "Renew with a plan:" : "Choose a plan & pay with wallet coins:"}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {plans.map((p) => (
              <button key={p.id} onClick={() => setPlanId(p.id)} className={cn("flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition", planId === p.id ? "border-lotus-400 bg-lotus-500/15 text-mist-100" : "border-white/10 bg-black/20 text-mist-200 hover:border-lotus-400/40")}>
                <span className="font-semibold">{p.name}</span>
                <span className="flex items-center gap-1 text-xs text-gold-300"><Coins className="size-3.5" /> {p.priceCoins.toLocaleString()}</span>
              </button>
            ))}
          </div>
          <Button className="mt-3" onClick={buy} disabled={busy || !planId}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Coins className="size-4" />} Pay &amp; {m.status === "expired" ? "renew" : "activate"}</Button>
        </div>
      )}
      {m.status === "active" && (
        <div className="mt-3">
          <details>
            <summary className="cursor-pointer text-[11px] font-semibold text-mist-300">Extend / renew early</summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {plans.map((p) => (
                <button key={p.id} onClick={() => setPlanId(p.id)} className={cn("flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition", planId === p.id ? "border-lotus-400 bg-lotus-500/15 text-mist-100" : "border-white/10 bg-black/20 text-mist-200")}>
                  <span className="font-semibold">{p.name}</span><span className="flex items-center gap-1 text-xs text-gold-300"><Coins className="size-3.5" /> {p.priceCoins.toLocaleString()}</span>
                </button>
              ))}
            </div>
            <Button size="sm" className="mt-2" onClick={buy} disabled={busy || !planId}>Pay &amp; extend</Button>
          </details>
        </div>
      )}

      {showHistory && (
        <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3">
          {payments.length === 0 ? <p className="text-xs text-mist-400">No payments yet.</p> : payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg bg-black/20 px-2.5 py-1.5 text-[11px]">
              <span className="truncate"><b className="text-mist-100">{p.planName}</b> · {p.id} · {fmt(p.at)}</span>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 font-bold", p.status === "success" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300")}>{p.coins.toLocaleString()} coins · {p.status}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function MemberRow({ m, canManage, isOwner, busy, perms, onAct, onView, onEdit }: { m: AgencyMemberRow; canManage: boolean; isOwner: boolean; busy: string; perms?: AgencyPermissions; onAct: (a: AgencyMemberActionType, m: AgencyMemberRow) => void; onView: (m: AgencyMemberRow) => void; onEdit: (m: AgencyMemberRow) => void }) {
  const [open, setOpen] = useState(false);
  const R = ROLE_META[m.role] ?? ROLE_META.member;
  const canView = canManage && !!perms?.user.view;
  const canEdit = canManage && !!perms?.user.edit && m.role !== "owner";
  // The menu opens if there's ANY action available (role actions, view, or edit).
  const canActOn = canManage && (m.role !== "owner" || canView);
  return (
    <div className="rounded-lg border border-line bg-ink-800/60 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="relative shrink-0">
          <Avatar name={m.name} src={m.avatar || undefined} size="sm" />
          {m.online && <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border border-ink-850 bg-emerald-400" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-mist-100">{m.name}</div>
          <div className="truncate text-[11px] text-mist-500">@{m.username} · ID {m.publicId || m.id.slice(0, 6)}{m.joinedAt ? ` · joined ${new Date(m.joinedAt).toLocaleDateString("en-SA", { day: "2-digit", month: "short", year: "numeric" })}` : ""}</div>
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold", R.tone)}><R.icon className="mr-0.5 inline size-3" />{R.label}</span>
        {canActOn && (
          <button onClick={() => setOpen((v) => !v)} className="grid size-7 shrink-0 place-items-center rounded-lg text-mist-400 hover:bg-white/10"><ChevronDown className={cn("size-4 transition", open && "rotate-180")} /></button>
        )}
      </div>
      {open && canActOn && (
        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line pt-2">
          {canView && <ActBtn label="View details" icon={Eye} onClick={() => onView(m)} />}
          {canEdit && <ActBtn label="Edit" icon={Pencil} onClick={() => onEdit(m)} />}
          {m.role !== "owner" && (
            <>
              {isOwner && m.role !== "manager" && <ActBtn label="Make manager" onClick={() => onAct("setManager", m)} busy={busy === m.id + "setManager"} />}
              {m.role !== "cohost" && <ActBtn label="Make co-host" onClick={() => onAct("setCoHost", m)} busy={busy === m.id + "setCoHost"} />}
              {(m.role === "manager" || m.role === "cohost") && <ActBtn label="Set as member" onClick={() => onAct("setMember", m)} busy={busy === m.id + "setMember"} />}
              <ActBtn label="Remove" tone="rose" icon={Trash2} onClick={() => onAct("remove", m)} busy={busy === m.id + "remove"} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ActBtn({ label, onClick, busy, tone, icon: Icon }: { label: string; onClick: () => void; busy?: boolean; tone?: "rose"; icon?: typeof Trash2 }) {
  return (
    <button onClick={onClick} disabled={busy} className={cn("inline-flex items-center gap-1 rounded-lg border border-line bg-ink-800 px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-50", tone === "rose" ? "text-rose-300 hover:bg-rose-500/10" : "text-mist-200 hover:bg-ink-700")}>
      {busy ? <Loader2 className="size-3 animate-spin" /> : Icon ? <Icon className="size-3" /> : null} {label}
    </button>
  );
}

function Announce({ onSent }: { onSent: () => void }) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    const res = await agencyAnnounce(text.trim());
    setSending(false);
    if (res.ok) { setText(""); toast("Announcement sent to all members", "success"); onSent(); }
    else toast(res.error ?? "Could not send", "error");
  };
  return (
    <Card className="p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-mist-100"><Megaphone className="size-4 text-lotus-300" /> Send an announcement</h2>
      <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={500} rows={2} placeholder="Message every member of your agency…" className="w-full rounded-xl border border-line bg-ink-900 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400" />
      <div className="mt-2 flex justify-end"><Button size="sm" onClick={send} disabled={sending || !text.trim()}>{sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send to members</Button></div>
    </Card>
  );
}

// The rooms ("groups") this agency manages. Each room shows a permission-gated
// action row: Lock/Unlock chat, Close/Reopen — only the actions the admin granted.
function AgencyGroups({ perms, members }: { perms?: AgencyPermissions; members: AgencyMemberRow[] }) {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<AgencyGroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [coHostFor, setCoHostFor] = useState<string | null>(null);
  const load = useCallback(async () => {
    const d = await fetchAgencyGroups();
    setRooms(d?.rooms ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (r: AgencyGroupRow, action: "lock" | "unlock" | "close" | "reopen" | "edit" | "assignCoHost" | "removeCoHost", payload?: { name?: string; targetId?: string }) => {
    setBusy(r.id + action + (payload?.targetId ?? ""));
    const res = await agencyGroupAction(r.id, action, payload);
    setBusy("");
    if (res.ok) { toast("Done", "success"); load(); } else toast(res.error ?? "Action failed", "error");
  };
  const rename = (r: AgencyGroupRow) => { const name = window.prompt("New room name:", r.name); if (name && name.trim() && name.trim() !== r.name) act(r, "edit", { name: name.trim() }); };
  const canLock = !!perms?.room.lockUnlock;
  const canClose = !!perms?.room.close;
  const canReopen = !!perms?.room.reopen;
  const canEdit = !!perms?.room.edit;
  const canAssignCo = !!perms?.room.assignCoHost;
  const canRemoveCo = !!perms?.room.removeHost;

  return (
    <Card className="p-4">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-mist-100"><Radio className="size-4 text-lotus-300" /> Groups (rooms) <span className="font-normal text-mist-500">({rooms.length})</span></h2>
      <p className="mb-2 text-[11px] text-mist-500">Voice rooms run by your agency&apos;s members. You can manage them with the powers the admin granted your agency.</p>
      {loading ? (
        <div className="grid h-16 place-items-center text-mist-500"><Loader2 className="size-4 animate-spin" /></div>
      ) : rooms.length === 0 ? (
        <p className="rounded-lg bg-white/[0.03] px-3 py-3 text-center text-xs text-mist-500">No rooms yet. When your members create voice rooms, they appear here.</p>
      ) : (
        <div className="space-y-2">
          {rooms.map((r) => (
            <div key={r.id} className="rounded-lg border border-line bg-ink-800/60 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-lotus-500/15 text-lotus-200" style={r.image ? { backgroundImage: `url(${r.image})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>{!r.image && <Radio className="size-4" />}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-mist-100">{r.name}</span>
                    {r.closed ? <span className="shrink-0 rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-bold text-rose-300">Closed</span>
                      : r.live ? <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300"><Radio className="size-2.5" /> Live</span> : null}
                    {r.chatLocked && <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-300"><Lock className="size-2.5" /> Locked</span>}
                  </div>
                  <div className="truncate text-[11px] text-mist-500 capitalize">{r.type} · {r.ownerName}</div>
                </div>
                <Link href={`/rooms/${r.id}`} title="Open room" className="grid size-8 shrink-0 place-items-center rounded-lg text-mist-400 hover:bg-white/10 hover:text-mist-100"><ExternalLink className="size-4" /></Link>
              </div>
              {(canLock || canClose || canReopen || canEdit || canAssignCo || canRemoveCo) && (
                <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line pt-2">
                  {canEdit && <GBtn label="Edit name" icon={Pen} busy={busy === r.id + "edit"} onClick={() => rename(r)} />}
                  {canLock && (
                    <GBtn label={r.chatLocked ? "Unlock chat" : "Lock chat"} icon={r.chatLocked ? Unlock : Lock} busy={busy === r.id + (r.chatLocked ? "unlock" : "lock")} onClick={() => act(r, r.chatLocked ? "unlock" : "lock")} />
                  )}
                  {(canAssignCo || canRemoveCo) && <GBtn label={`Co-hosts (${r.coHosts.length})`} icon={Star} onClick={() => setCoHostFor(coHostFor === r.id ? null : r.id)} />}
                  {!r.closed && canClose && <GBtn label="Close" icon={DoorClosed} tone="rose" busy={busy === r.id + "close"} onClick={() => act(r, "close")} />}
                  {r.closed && canReopen && <GBtn label="Reopen" icon={Power} busy={busy === r.id + "reopen"} onClick={() => act(r, "reopen")} />}
                </div>
              )}
              {coHostFor === r.id && (canAssignCo || canRemoveCo) && (
                <div className="mt-2 space-y-1.5 rounded-lg bg-ink-900/60 p-2">
                  <p className="text-[11px] font-semibold text-mist-400">Co-hosts for this room</p>
                  {r.coHosts.length > 0 ? r.coHosts.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 text-xs text-mist-200"><Star className="size-3 text-sky-300" /><span className="flex-1 truncate">{c.name}</span>{canRemoveCo && <button onClick={() => act(r, "removeCoHost", { targetId: c.id })} className="rounded bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-300 hover:bg-rose-500/25">Remove</button>}</div>
                  )) : <p className="text-[11px] text-mist-600">No co-hosts yet.</p>}
                  {canAssignCo && (
                    <select value="" onChange={(e) => { if (e.target.value) act(r, "assignCoHost", { targetId: e.target.value }); }} className="mt-1 h-8 w-full rounded-lg border border-line bg-ink-800 px-2 text-xs text-mist-100 outline-none focus:border-lotus-400">
                      <option value="">+ Add a member as co-host…</option>
                      {members.filter((m) => m.role !== "owner" && !r.coHosts.some((c) => c.id === m.id)).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function GBtn({ label, icon: Icon, onClick, busy, tone }: { label: string; icon: typeof Lock; onClick: () => void; busy?: boolean; tone?: "rose" }) {
  return (
    <button onClick={onClick} disabled={busy} className={cn("inline-flex items-center gap-1 rounded-lg border border-line bg-ink-800 px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-50", tone === "rose" ? "text-rose-300 hover:bg-rose-500/10" : "text-mist-200 hover:bg-ink-700")}>
      {busy ? <Loader2 className="size-3 animate-spin" /> : <Icon className="size-3" />} {label}
    </button>
  );
}

// Shows exactly what the admin has allowed this agency to do (User / Room /
// Storage management), so the granted permissions are always visible in the panel.
function PermissionsCard({ perms }: { perms: AgencyPermissions }) {
  const GROUPS: { key: keyof AgencyPermissions; label: string; icon: typeof Users; items: [string, string][] }[] = [
    { key: "user", label: "User Management", icon: Users, items: [["create", "Create users"], ["edit", "Edit users"], ["delete", "Delete users"], ["suspend", "Suspend users"], ["view", "View user details"], ["resetPassword", "Reset password"], ["verify", "Verify accounts"]] },
    { key: "room", label: "Room Management", icon: Radio, items: [["create", "Create room"], ["edit", "Edit room"], ["delete", "Delete room"], ["close", "Close room"], ["reopen", "Reopen room"], ["assignHost", "Assign host"], ["assignCoHost", "Assign co-host"], ["removeHost", "Remove host/co-host"], ["lockUnlock", "Lock/Unlock room"]] },
    { key: "storage", label: "Storage Management", icon: HardDrive, items: [["view", "View storage"], ["deleteFiles", "Delete files"], ["setLimits", "Set limits"], ["sendWarnings", "Send warnings"], ["downloadFiles", "Download files"]] },
  ];
  return (
    <Card className="border-lotus-400/20 bg-lotus-500/[0.03] p-4">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-mist-100"><KeyRound className="size-4 text-lotus-300" /> Your agency permissions</h2>
      <p className="mb-3 text-[11px] text-mist-500">Set by the admin. Your agency can only use the features marked <span className="font-semibold text-emerald-300">Allowed</span>.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {GROUPS.map((g) => {
          const group = perms[g.key] as Record<string, boolean>;
          return (
            <div key={g.key} className="rounded-lg border border-line bg-ink-800/50 p-2.5">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-mist-300"><g.icon className="size-3.5 text-lotus-300" /> {g.label}</div>
              <div className="space-y-1">
                {g.items.map(([k, label]) => (
                  <div key={k} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className={cn("truncate", group[k] ? "text-mist-200" : "text-mist-600 line-through")}>{label}</span>
                    {group[k]
                      ? <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300"><Check className="size-2.5" /> Allowed</span>
                      : <span className="shrink-0 rounded-full bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-semibold text-mist-600">Off</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function AddMember({ counts, limit, canCreate, onChanged }: { counts: AgencyPortal["counts"]; limit: number; canCreate: boolean; onChanged: () => void }) {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AgencyUserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onQ = (v: string) => {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    timer.current = setTimeout(async () => { setResults(await agencySearchUsers(v.trim())); setSearching(false); }, 350);
  };
  const run = async (u: AgencyUserResult, action: "invite" | "add") => {
    setBusy(u.id + action);
    const res = await agencyMemberAction(action, u.id);
    setBusy("");
    if (res.ok) { toast(action === "invite" ? `Invitation sent to ${u.name}` : `${u.name} added to the agency`, "success"); setQ(""); setResults([]); onChanged(); }
    else toast(res.error ?? "Could not complete", "error");
  };
  const full = counts.total >= limit;

  return (
    <Card className="p-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-mist-100"><UserPlus className="size-4 text-lotus-300" /> Invite or add a member <span className="font-normal text-mist-500">({counts.total}/{limit})</span></h2>
        {canCreate && !full && (
          <Button size="sm" variant="secondary" onClick={() => setCreateOpen(true)}><Plus className="size-4" /> Create new member</Button>
        )}
      </div>
      {/* IMPORTANT (client rule): direct "Add" is limited to accounts the agency
          itself created; everyone else must be invited and choose to accept. */}
      <p className="mb-2 text-[11px] text-mist-500"><b className="text-violet-300">Invite</b> sends a request the user accepts or declines. <b className="text-lotus-300">Add</b> (immediate) is only available for members <b>your agency created</b>{canCreate ? " — use “Create new member” to make one" : ""}.</p>
      {createOpen && <CreateMemberModal onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); onChanged(); }} />}
      {full ? (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">Member limit reached. Ask an admin to raise the limit.</p>
      ) : (
        <>
          <div className="flex items-center gap-2 rounded-xl border border-line bg-ink-800 px-3">
            <Search className="size-4 text-mist-500" />
            <input value={q} onChange={(e) => onQ(e.target.value)} placeholder="Search a user by name, @username or ID…" className="h-10 w-full bg-transparent text-sm text-mist-100 outline-none placeholder:text-mist-500" />
            {searching && <Loader2 className="size-4 animate-spin text-mist-500" />}
          </div>
          {results.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {results.map((u) => (
                <div key={u.id} className="flex items-center gap-2 rounded-lg border border-line bg-ink-800/60 px-3 py-2">
                  <Avatar name={u.name} src={u.avatar || undefined} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5"><span className="truncate text-sm font-semibold text-mist-100">{u.name}</span>{u.createdByThisAgency && <span className="shrink-0 rounded-full bg-lotus-500/15 px-1.5 py-0.5 text-[9px] font-bold text-lotus-300">Your account</span>}</div>
                    <div className="truncate text-[11px] text-mist-500">@{u.username}{u.publicId ? ` · ID ${u.publicId}` : ""}</div>
                  </div>
                  <Button size="sm" onClick={() => run(u, "invite")} disabled={busy === u.id + "invite"}>{busy === u.id + "invite" ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />} Invite</Button>
                  {/* Direct Add ONLY for accounts this agency created. */}
                  {u.createdByThisAgency && (
                    <Button size="sm" variant="secondary" onClick={() => run(u, "add")} disabled={busy === u.id + "add"}>{busy === u.id + "add" ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />} Add</Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

// Create a brand-new member account (agency-created → directly addable). Only
// shown when the agency has the "Create Users" permission enabled by an admin.
function CreateMemberModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState({ fullName: "", username: "", password: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const field = "h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400";

  const submit = async () => {
    if (f.fullName.trim().length < 2) return toast("Enter the member's full name", "error");
    if (f.username.trim().length < 3) return toast("Enter a username (min 3 characters)", "error");
    if (f.password.length < 8) return toast("Password must be at least 8 characters", "error");
    setBusy(true);
    const res = await agencyCreateMember({ fullName: f.fullName.trim(), username: f.username.trim(), password: f.password, email: f.email.trim() || undefined, phone: f.phone.trim() || undefined });
    setBusy(false);
    if (res.ok) {
      toast(res.pending
        ? `${f.fullName.trim()}'s account was created and sent to the admin for approval. They can sign in once it's approved.`
        : `${f.fullName.trim()} created and added to your agency`, "success");
      onDone();
    }
    else toast(res.error ?? "Could not create the account", "error");
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-md rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><UserPlus className="size-5 text-lotus-300" /> Create a new member</h2>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>
        <p className="mb-3 text-xs text-mist-500">This creates a new account under your agency and adds them immediately. Share the username &amp; password with the member so they can log in.</p>
        <div className="space-y-2.5">
          <div><label className="text-[11px] font-semibold text-mist-400">Full name *</label><input value={f.fullName} onChange={(e) => set("fullName", e.target.value)} className={field} maxLength={60} /></div>
          <div><label className="text-[11px] font-semibold text-mist-400">Username *</label><input value={f.username} onChange={(e) => set("username", e.target.value.toLowerCase())} placeholder="letters, numbers, . or _" className={field} maxLength={20} /></div>
          <div><label className="text-[11px] font-semibold text-mist-400">Password *</label><input type="text" value={f.password} onChange={(e) => set("password", e.target.value)} placeholder="min 8 chars, incl. a capital & a symbol" className={field} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[11px] font-semibold text-mist-400">Email (optional)</label><input value={f.email} onChange={(e) => set("email", e.target.value)} className={field} /></div>
            <div><label className="text-[11px] font-semibold text-mist-400">Mobile (optional)</label><input value={f.phone} onChange={(e) => set("phone", e.target.value)} className={field} /></div>
          </div>
        </div>
        <Button block className="mt-4" onClick={submit} disabled={busy}>{busy ? "Creating…" : "Create & add member"}</Button>
      </div>
    </div>
  );
}
