"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { fetchAgencies, createAgency, updateAgency, deleteAgency, fetchAdminUsers, type AdminAgency, type AdminUser, type AdminUserLite, type AdminAgencyMemberLite, type AgencyPermissions } from "@/lib/admin";
import { usePhotoEdit } from "@/components/usePhotoEdit";
import { applyFilterSort, SortTh, type SortDir } from "@/components/admin/TableControls";
import { useConfig } from "@/lib/config";
import { ImagePlus, Landmark } from "lucide-react";

// Default per-agency powers (mirrors the server default). Non-destructive actions
// start ON; sensitive/destructive ones start OFF.
const DEFAULT_AGENCY_PERMS: AgencyPermissions = {
  user: { create: true, edit: true, delete: false, suspend: false, view: true, resetPassword: false, verify: false },
  room: { create: true, edit: true, delete: false, close: true, reopen: true, assignHost: true, assignCoHost: true, removeHost: true, lockUnlock: true },
  storage: { view: true, deleteFiles: false, setLimits: false, sendWarnings: true, downloadFiles: false },
};
// Grouped display: [group key, group label, [[perm key, perm label], …]].
const PERM_GROUPS: [keyof AgencyPermissions, string, [string, string][]][] = [
  ["user", "User Management", [["create", "Create Users"], ["edit", "Edit Users"], ["delete", "Delete Users"], ["suspend", "Suspend Users"], ["view", "View User Details"], ["resetPassword", "Reset User Password"], ["verify", "Verify User Accounts"]]],
  ["room", "Room Management", [["create", "Create Room"], ["edit", "Edit Room"], ["delete", "Delete Room"], ["close", "Close Room"], ["reopen", "Reopen Room"], ["assignHost", "Assign Host"], ["assignCoHost", "Assign Co-Host"], ["removeHost", "Remove Host/Co-Host"], ["lockUnlock", "Room Lock/Unlock"]]],
  ["storage", "Storage Management", [["view", "View User Storage"], ["deleteFiles", "Delete User Files"], ["setLimits", "Set Storage Limits"], ["sendWarnings", "Send Storage Warnings"], ["downloadFiles", "Download User Files"]]],
];
import { fetchAgencyStructure, adminAgencyMemberAction, adminTransferMember, adminAgencySearchUsers, reviewAgencyRequest, fetchAgencyPlans, fetchAgencyChangeRequests, decideAgencyChangeRequest, cancelAgencyChangeRequest, type AgencyPortal, type AgencyMemberRow, type AgencyUserResult, type AgencyMemberActionType, type AgencyPlan, type AgencyChangeRequest } from "@/lib/agency";
import { cn } from "@/lib/cn";
import { Building2, Plus, Search, X, Pencil, Trash2, Power, Users, TrendingUp, Percent, Crown, Shield, Star, UserPlus, Download, ArrowRightLeft, Loader2, ExternalLink, Check, Coins, Calendar, Ban } from "lucide-react";
import { profileHref } from "@/lib/profile-href";

const AGENCY_STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300",
  active: "bg-emerald-500/15 text-emerald-300",
  suspended: "bg-orange-500/15 text-orange-300",
  expired: "bg-rose-500/15 text-rose-300",
  rejected: "bg-rose-500/15 text-rose-300",
};

const num = (n: number) => (n ?? 0).toLocaleString("en-SA");

export default function AdminAgenciesPage() {
  const { toast } = useToast();
  const [agencies, setAgencies] = useState<AdminAgency[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminAgency | null>(null);
  const [managing, setManaging] = useState<AdminAgency | null>(null);
  const [confirmDel, setConfirmDel] = useState<AdminAgency | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active">("all");
  const [membersOpen, setMembersOpen] = useState(false);
  const [changeReqs, setChangeReqs] = useState<AgencyChangeRequest[]>([]);

  const load = () => fetchAgencies().then((a) => { setAgencies(a); setLoading(false); });
  const loadChanges = () => fetchAgencyChangeRequests().then(setChangeReqs);
  useEffect(() => { load(); loadChanges(); fetchAdminUsers().then(setUsers); }, []);

  const q = query.trim().toLowerCase();
  // Search now matches the agency name/ID AND the owner's name, Unique ID, mobile
  // and email — so admins can find an agency by any of the owner's identifiers.
  // Click any column heading to sort by it; click again to reverse. Same control
  // used across the admin report tables.
  const [sort, setSort] = useState("name");
  const [dir, setDir] = useState<SortDir>("asc");
  const toggleSort = (col: string) => {
    if (col === sort) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSort(col); setDir("asc"); }
  };

  const rows = useMemo(
    () => applyFilterSort(
      agencies.filter((a) => (statusFilter === "active" ? a.status === "active" : true)),
      {
        q,
        sort, dir,
        searchText: (a) => `${a.name} ${a.agencyId} ${a.ownerName ?? ""} ${a.ownerUsername ?? ""} ${a.owner?.publicId ?? ""} ${a.owner?.email ?? ""} ${a.owner?.phone ?? ""}`,
        sortKeys: {
          name: (a) => a.name ?? "",
          owner: (a) => a.ownerName ?? "",
          level: (a) => a.level ?? 0,
          members: (a) => a.memberCount ?? 0,
          earnings: (a) => a.earnings ?? 0,
          status: (a) => a.status ?? "",
        },
      },
    ),
    [agencies, q, statusFilter, sort, dir],
  );
  // Every member across all agencies (for the "Members" card drill-down).
  const allMembers = useMemo(() => agencies.flatMap((a) => a.members ?? []), [agencies]);

  const totals = useMemo(() => ({
    count: agencies.length,
    active: agencies.filter((a) => a.status === "active").length,
    members: agencies.reduce((s, a) => s + (a.memberCount ?? 0), 0),
    earnings: agencies.reduce((s, a) => s + (a.earnings ?? 0), 0),
  }), [agencies]);

  const toggleStatus = async (a: AdminAgency) => {
    const status = a.status === "active" ? "suspended" : "active";
    const res = await updateAgency({ id: a.id, status });
    if (res.ok) { toast(`Agency ${status === "active" ? "activated" : "suspended"}`, "success"); load(); }
    else toast(res.error ?? "Failed", "error");
  };

  // Approve / reject a user's agency REQUEST (pending). Rejection asks for a reason
  // which is sent to the user.
  const review = async (a: AdminAgency, approve: boolean) => {
    let reason = "";
    if (!approve) { reason = window.prompt(`Reject "${a.name}"? Enter a reason to send the user:`, "") ?? ""; if (reason === null as unknown as string) return; }
    const res = await reviewAgencyRequest(a.id, approve, reason);
    if (res.ok) { toast(approve ? `“${a.name}” approved & activated.` : "Request rejected — the user was notified.", approve ? "success" : "info"); load(); }
    else toast(res.error ?? "Failed", "error");
  };

  const remove = async (a: AdminAgency) => {
    setConfirmDel(null);
    const res = await deleteAgency(a.id);
    if (res.ok) { toast("Agency deleted", "success"); setAgencies((xs) => xs.filter((x) => x.id !== a.id)); }
    else toast(res.error ?? "Failed", "error");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><Building2 className="size-6 text-lotus-300" /> Agency System</h1>
          <p className="mt-1 text-sm text-mist-400">Create and manage agencies · assign owners · set commission & limits.</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="size-4" /> New agency</Button>
      </div>

      {/* Summary stats — every card is clickable and drills into its data. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={Building2} label="Agencies" value={num(totals.count)} active={statusFilter === "all" && !q} onClick={() => { setStatusFilter("all"); setQuery(""); }} hint="Show all agencies" />
        <Stat icon={Power} label="Active" value={num(totals.active)} tone="text-emerald-300" active={statusFilter === "active"} onClick={() => setStatusFilter(statusFilter === "active" ? "all" : "active")} hint={statusFilter === "active" ? "Showing active ✓" : "Show only active"} />
        <Stat icon={Users} label="Members" value={num(totals.members)} tone="text-sky-300" onClick={() => setMembersOpen(true)} hint="View all members" />
        <Stat icon={TrendingUp} label="Agency earnings" value={`🪙 ${num(totals.earnings)}`} tone="text-gold-300" href="/admin/agent-profit" hint="Open earnings report" />
      </div>

      {/* Member agency-CHANGE requests (admin-approved, with a reason). */}
      <AgencyChangeRequests requests={changeReqs} onChanged={() => { loadChanges(); load(); }} />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mist-500" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by agency name/ID, or owner name, Unique ID, mobile or email…" className="pl-9" />
      </div>

      <Card className="overflow-visible p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-mist-500">
                <SortTh col="name" sort={sort} dir={dir} onSort={toggleSort} className="px-5 py-3">Agency</SortTh>
                <SortTh col="owner" sort={sort} dir={dir} onSort={toggleSort} className="px-5 py-3">Owner</SortTh>
                <SortTh col="level" sort={sort} dir={dir} onSort={toggleSort} className="px-5 py-3">Level</SortTh>
                <SortTh col="members" sort={sort} dir={dir} onSort={toggleSort} className="px-5 py-3">Members</SortTh>
                <th className="px-5 py-3 font-semibold">Commission (R / A / C / T)</th>
                <SortTh col="earnings" sort={sort} dir={dir} onSort={toggleSort} className="px-5 py-3">Earnings</SortTh>
                <SortTh col="status" sort={sort} dir={dir} onSort={toggleSort} className="px-5 py-3">Status</SortTh>
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-mist-500">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-mist-500">No agencies yet. Tap “New agency” to create one.</td></tr>
              ) : rows.map((a) => (
                <tr key={a.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                  <td className="px-5 py-3">
                    {/* The agency name links to its public profile (rooms + members). */}
                    <Link href={`/agencies/${a.id}`} target="_blank" className="inline-flex items-center gap-1 font-semibold text-mist-100 transition hover:text-lotus-300">
                      {a.name} <ExternalLink className="size-3 text-mist-500" />
                    </Link>
                    <div className="text-[11px] font-mono text-lotus-300">{a.agencyId}</div>
                  </td>
                  <td className="px-5 py-3">
                    {a.owner ? <UserIdentity u={a.owner} /> : a.ownerName ? <span className="text-xs text-mist-300">{a.ownerName}</span> : <span className="text-xs text-mist-600">— unassigned —</span>}
                  </td>
                  <td className="px-5 py-3">
                    {a.tier ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: `${a.tier.color}22`, color: a.tier.color }} title={`Level ${a.tier.level}${a.levelTierId ? " · set manually" : ""}`}>
                        <span>{a.tier.badge}</span> {a.tier.name}{a.levelTierId ? <span className="ml-0.5 opacity-70">✎</span> : null}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gold-400/15 px-2 py-0.5 text-xs font-bold text-gold-300"><Crown className="size-3" /> {a.level}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-mist-300">{num(a.memberCount)} / {num(a.memberLimit)}</td>
                  <td className="px-5 py-3 text-xs text-mist-300">{a.commission.receiverPct}% / {a.commission.agencyPct}% / {a.commission.companyPct}% / <span className="text-emerald-300">{a.commission.trustPct ?? 0}%</span></td>
                  <td className="px-5 py-3 text-xs text-gold-200">🪙 {num(a.earnings)}</td>
                  <td className="px-5 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold capitalize", AGENCY_STATUS_TONE[a.status] ?? "bg-white/[0.06] text-mist-300")}>{a.status}</span>
                    {a.status === "rejected" && a.rejectionReason && <div className="mt-0.5 max-w-40 truncate text-[10px] text-rose-300/70" title={a.rejectionReason}>{a.rejectionReason}</div>}
                    {a.status === "active" && a.expiryDate && <div className="mt-0.5 text-[10px] text-mist-500">exp {new Date(a.expiryDate).toLocaleDateString("en-GB")}</div>}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {a.status === "pending" && (
                        <>
                          <button title="Approve request" onClick={() => review(a, true)} className="grid size-8 place-items-center rounded-lg text-emerald-300 hover:bg-emerald-500/10"><Check className="size-4" /></button>
                          <button title="Reject request" onClick={() => review(a, false)} className="grid size-8 place-items-center rounded-lg text-rose-300 hover:bg-rose-500/10"><X className="size-4" /></button>
                        </>
                      )}
                      <Link href={`/agencies/${a.id}`} target="_blank" title="View profile" className="grid size-8 place-items-center rounded-lg text-mist-400 hover:bg-white/10 hover:text-mist-100"><ExternalLink className="size-4" /></Link>
                      <button title="Members & structure" onClick={() => setManaging(a)} className="grid size-8 place-items-center rounded-lg text-lotus-300 hover:bg-white/10"><Users className="size-4" /></button>
                      <button title="Edit" onClick={() => setEditing(a)} className="grid size-8 place-items-center rounded-lg text-mist-400 hover:bg-white/10 hover:text-mist-100"><Pencil className="size-4" /></button>
                      <button title={a.status === "active" ? "Suspend" : "Activate"} onClick={() => toggleStatus(a)} className={cn("grid size-8 place-items-center rounded-lg hover:bg-white/10", a.status === "active" ? "text-amber-300" : "text-emerald-300")}><Power className="size-4" /></button>
                      <button title="Delete" onClick={() => setConfirmDel(a)} className="grid size-8 place-items-center rounded-lg text-rose-300 hover:bg-white/10"><Trash2 className="size-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {(creating || editing) && (
        <AgencyModal
          agency={editing}
          users={users}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); load(); }}
        />
      )}
      {managing && (
        <AgencyStructureModal agencyId={managing.id} agencies={agencies} onClose={() => setManaging(null)} onChanged={load} />
      )}
      {confirmDel && (
        <ConfirmDialog danger title="Delete agency?" message={`Delete “${confirmDel.name}” (${confirmDel.agencyId})? This removes the agency but not its members' accounts.`} confirmLabel="Delete" cancelLabel="Cancel" onConfirm={() => remove(confirmDel)} onCancel={() => setConfirmDel(null)} />
      )}
      {membersOpen && <MembersModal members={allMembers} onClose={() => setMembersOpen(false)} />}
    </div>
  );
}

// Admin review of member "change my agency" requests. Pending ones show first
// with Approve (transfers the user) / Reject (asks for a reason, sent to the user).
function AgencyChangeRequests({ requests, onChanged }: { requests: AgencyChangeRequest[]; onChanged: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState("");
  const [showAll, setShowAll] = useState(false);
  const pending = requests.filter((r) => r.status === "pending");
  const decided = requests.filter((r) => r.status !== "pending");

  const decide = async (r: AgencyChangeRequest, approve: boolean) => {
    let reason = "";
    if (!approve) { const v = window.prompt(`Reject ${r.userName}'s move to "${r.toAgencyName}"? Optional reason to send them:`, ""); if (v === null) return; reason = v; }
    setBusy(r.id);
    const res = await decideAgencyChangeRequest(r.id, approve, reason);
    setBusy("");
    if (res.ok) { toast(approve ? `${r.userName} moved to "${r.toAgencyName}".` : "Request rejected — the user was notified.", approve ? "success" : "info"); onChanged(); }
    else toast(res.error ?? "Failed", "error");
  };

  const cancel = async (r: AgencyChangeRequest) => {
    if (!window.confirm(`Cancel ${r.userName}'s change request to "${r.toAgencyName}"? This voids it without transferring them.`)) return;
    setBusy(r.id);
    const res = await cancelAgencyChangeRequest(r.id);
    setBusy("");
    if (res.ok) { toast("Request cancelled — the user was notified.", "info"); onChanged(); }
    else toast(res.error ?? "Failed", "error");
  };

  if (requests.length === 0) return null;

  const Row = ({ r }: { r: AgencyChangeRequest }) => (
    <div className="rounded-lg border border-line bg-ink-800/60 p-3">
      <div className="flex items-start gap-2.5">
        <Avatar name={r.userName} src={r.userAvatar || undefined} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 text-sm">
            <span className="font-semibold text-mist-100">{r.userName}</span>
            {r.userPublicId && <span className="font-mono text-[10px] text-mist-500">{r.userPublicId}</span>}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-mist-400">
            <span className="truncate">{r.fromAgencyName ? `“${r.fromAgencyName}”` : "No agency"}</span>
            <ArrowRightLeft className="size-3 shrink-0 text-lotus-300" />
            <span className="truncate font-semibold text-mist-200">“{r.toAgencyName}”</span>
          </div>
          <p className="mt-1 rounded-md bg-ink-900/60 px-2 py-1 text-[11px] italic text-mist-300">“{r.reason}”</p>
          <div className="mt-1 text-[10px] text-mist-500">{new Date(r.createdAt).toLocaleString("en-GB")}</div>
          {r.status !== "pending" && (
            <div className={cn("mt-1 text-[11px] font-semibold", r.status === "approved" ? "text-emerald-300" : r.status === "cancelled" ? "text-mist-400" : "text-rose-300")}>
              {r.status === "approved" ? "✓ Approved" : r.status === "cancelled" ? "⊘ Cancelled" : "✗ Rejected"}{r.decidedByName ? ` by ${r.decidedByName}` : ""}{r.decisionReason ? ` — “${r.decisionReason}”` : ""}
            </div>
          )}
        </div>
        {r.status === "pending" && (
          <div className="flex shrink-0 flex-col gap-1.5">
            <button onClick={() => decide(r, true)} disabled={busy === r.id} className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50">{busy === r.id ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />} Approve</button>
            <button onClick={() => decide(r, false)} disabled={busy === r.id} className="inline-flex items-center gap-1 rounded-lg bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"><X className="size-3" /> Reject</button>
            <button onClick={() => cancel(r)} disabled={busy === r.id} className="inline-flex items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-mist-400 hover:bg-white/[0.12] disabled:opacity-50"><Ban className="size-3" /> Cancel</button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Card className="border-amber-400/20 bg-amber-500/[0.04] p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold text-mist-100">
          <ArrowRightLeft className="size-4 text-amber-300" /> Agency change requests
          {pending.length > 0 && <span className="rounded-full bg-amber-500/25 px-2 py-0.5 text-[10px] font-bold text-amber-200">{pending.length} pending</span>}
        </h2>
        {decided.length > 0 && <button onClick={() => setShowAll((s) => !s)} className="text-[11px] font-semibold text-lotus-300 hover:text-lotus-200">{showAll ? "Hide history" : `History (${decided.length})`}</button>}
      </div>
      <p className="mt-0.5 text-[11px] text-mist-500">A user can belong to only one agency. Approving a request transfers them to the new agency.</p>
      {pending.length === 0 ? (
        <p className="mt-3 text-xs text-mist-500">No pending change requests.</p>
      ) : (
        <div className="mt-3 space-y-2">{pending.map((r) => <Row key={r.id} r={r} />)}</div>
      )}
      {showAll && decided.length > 0 && (
        <div className="mt-2 space-y-2 border-t border-white/5 pt-2">{decided.slice(0, 20).map((r) => <Row key={r.id} r={r} />)}</div>
      )}
    </Card>
  );
}

const S_ROLE: Record<string, { label: string; icon: typeof Crown; tone: string }> = {
  owner: { label: "Owner", icon: Crown, tone: "bg-gold-500/15 text-gold-300" },
  manager: { label: "Manager", icon: Shield, tone: "bg-lotus-500/15 text-lotus-300" },
  cohost: { label: "Co-Host", icon: Star, tone: "bg-sky-500/15 text-sky-300" },
  member: { label: "Member", icon: Users, tone: "bg-white/[0.06] text-mist-300" },
  pending: { label: "Pending", icon: UserPlus, tone: "bg-amber-500/15 text-amber-300" },
};

function AgencyStructureModal({ agencyId, agencies, onClose, onChanged }: { agencyId: string; agencies: AdminAgency[]; onClose: () => void; onChanged: () => void }) {
  const { toast } = useToast();
  const [data, setData] = useState<AgencyPortal | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [q, setQ] = useState("");
  const [addQ, setAddQ] = useState("");
  const [addResults, setAddResults] = useState<AgencyUserResult[]>([]);
  const [transferFor, setTransferFor] = useState<AgencyMemberRow | null>(null);

  const load = () => fetchAgencyStructure(agencyId).then((d) => { setData(d); setLoading(false); });
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [agencyId]);

  useEffect(() => {
    if (addQ.trim().length < 2) { setAddResults([]); return; }
    const t = setTimeout(async () => setAddResults(await adminAgencySearchUsers(addQ.trim())), 350);
    return () => clearTimeout(t);
  }, [addQ]);

  const act = async (action: AgencyMemberActionType, m: AgencyMemberRow | AgencyUserResult) => {
    setBusy(m.id + action);
    const res = await adminAgencyMemberAction(agencyId, action, m.id);
    setBusy("");
    if (res.ok) { toast("Done", "success"); setAddQ(""); setAddResults([]); load(); onChanged(); }
    else toast(res.error ?? "Failed", "error");
  };

  const doTransfer = async (toId: string) => {
    if (!transferFor) return;
    setBusy(transferFor.id + "xfer");
    const res = await adminTransferMember(toId, transferFor.id);
    setBusy("");
    setTransferFor(null);
    if (res.ok) { toast("Member transferred", "success"); load(); onChanged(); }
    else toast(res.error ?? "Failed", "error");
  };

  const members = (data?.members ?? []).filter((m) => !q.trim() || `${m.name} ${m.username} ${m.publicId}`.toLowerCase().includes(q.trim().toLowerCase()));

  const exportCsv = () => {
    if (!data) return;
    const cols = ["Member ID", "Name", "Username", "Agency", "Role", "Join Date", "Status"];
    const rows = data.members.map((m) => [m.publicId || m.id, m.name, m.username, data.agency.name, m.role, m.joinedAt ? new Date(m.joinedAt).toLocaleDateString("en-SA") : "", m.online ? "online" : m.accountStatus]);
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [cols, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${data.agency.agencyId}-members.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-2xl rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Users className="size-5 text-lotus-300" /> {data ? `${data.agency.name} · ${data.agency.agencyId}` : "Agency structure"}</h2>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>

        {loading || !data ? (
          <p className="py-10 text-center text-sm text-mist-500">Loading…</p>
        ) : (
          <>
            {/* Counts */}
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {[["Total", data.counts.total], ["Active", data.counts.active], ["Inactive", data.counts.inactive], ["Managers", data.counts.managers], ["Co-Hosts", data.counts.coHosts], ["Pending", data.counts.pending]].map(([l, v]) => (
                <div key={l as string} className="rounded-lg border border-line bg-ink-800/60 p-2 text-center">
                  <div className="font-display text-lg font-extrabold text-mist-100">{v as number}</div>
                  <div className="text-[10px] text-mist-500">{l as string}</div>
                </div>
              ))}
            </div>

            {/* Add member + search + export */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="flex min-w-40 flex-1 items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-2.5">
                <UserPlus className="size-4 text-mist-500" />
                <input value={addQ} onChange={(e) => setAddQ(e.target.value)} placeholder="Add member — search user…" className="h-9 w-full bg-transparent text-sm text-mist-100 outline-none placeholder:text-mist-500" />
              </div>
              <Button size="sm" variant="secondary" onClick={exportCsv}><Download className="size-4" /> Export CSV</Button>
            </div>
            {addResults.length > 0 && (
              <div className="mt-1.5 space-y-1 rounded-lg border border-line bg-ink-900/60 p-1.5">
                {addResults.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/[0.04]">
                    <Avatar name={u.name} src={u.avatar || undefined} size="xs" />
                    <div className="min-w-0 flex-1 truncate text-sm text-mist-200">{u.name} <span className="text-xs text-mist-500">@{u.username}</span></div>
                    <Button size="sm" onClick={() => act("add", u)} disabled={busy === u.id + "add"}>Add</Button>
                  </div>
                ))}
              </div>
            )}

            {/* Member search */}
            <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-2.5">
              <Search className="size-4 text-mist-500" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter members…" className="h-9 w-full bg-transparent text-sm text-mist-100 outline-none placeholder:text-mist-500" />
            </div>

            {/* Member list */}
            <div className="mt-2 max-h-[42vh] space-y-1.5 overflow-y-auto pr-1">
              {[...data.pending, ...members].map((m) => {
                const R = S_ROLE[m.role] ?? S_ROLE.member;
                return (
                  <div key={m.id + m.role} className="rounded-lg border border-line bg-ink-800/60 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Avatar name={m.name} src={m.avatar || undefined} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-mist-100">{m.name}</div>
                        <div className="truncate text-[11px] text-mist-500">@{m.username} · ID {m.publicId || m.id.slice(0, 6)}{m.joinedAt ? ` · ${new Date(m.joinedAt).toLocaleDateString("en-SA", { day: "2-digit", month: "short", year: "numeric" })}` : ""}</div>
                      </div>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold", R.tone)}><R.icon className="mr-0.5 inline size-3" />{R.label}</span>
                    </div>
                    {m.role !== "owner" && (
                      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line pt-2">
                        {m.role === "pending" ? (
                          <>
                            <MBtn label="Approve" onClick={() => act("approve", m)} busy={busy === m.id + "approve"} />
                            <MBtn label="Reject" tone="rose" onClick={() => act("reject", m)} busy={busy === m.id + "reject"} />
                          </>
                        ) : (
                          <>
                            {m.role !== "manager" && <MBtn label="Manager" onClick={() => act("setManager", m)} busy={busy === m.id + "setManager"} />}
                            {m.role !== "cohost" && <MBtn label="Co-Host" onClick={() => act("setCoHost", m)} busy={busy === m.id + "setCoHost"} />}
                            {(m.role === "manager" || m.role === "cohost") && <MBtn label="Member" onClick={() => act("setMember", m)} busy={busy === m.id + "setMember"} />}
                            <MBtn label="Transfer" icon={ArrowRightLeft} onClick={() => setTransferFor(m)} />
                            <MBtn label="Remove" tone="rose" onClick={() => act("remove", m)} busy={busy === m.id + "remove"} />
                          </>
                        )}
                      </div>
                    )}
                    {transferFor?.id === m.id && (
                      <div className="mt-2 rounded-lg border border-lotus-400/30 bg-lotus-500/[0.06] p-2">
                        <p className="mb-1 text-[11px] font-semibold text-mist-200">Transfer {m.name} to:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {agencies.filter((x) => x.id !== agencyId).map((x) => (
                            <button key={x.id} onClick={() => doTransfer(x.id)} disabled={busy === m.id + "xfer"} className="inline-flex items-center gap-1 rounded-lg border border-line bg-ink-800 px-2.5 py-1 text-[11px] font-semibold text-mist-200 hover:bg-ink-700 disabled:opacity-50">{x.name}</button>
                          ))}
                          <button onClick={() => setTransferFor(null)} className="rounded-lg px-2 py-1 text-[11px] text-mist-500 hover:text-mist-300">cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MBtn({ label, onClick, busy, tone, icon: Icon }: { label: string; onClick: () => void; busy?: boolean; tone?: "rose"; icon?: typeof ArrowRightLeft }) {
  return (
    <button onClick={onClick} disabled={busy} className={cn("inline-flex items-center gap-1 rounded-lg border border-line bg-ink-800 px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-50", tone === "rose" ? "text-rose-300 hover:bg-rose-500/10" : "text-mist-200 hover:bg-ink-700")}>
      {busy ? <Loader2 className="size-3 animate-spin" /> : Icon ? <Icon className="size-3" /> : null} {label}
    </button>
  );
}

// A consistent user chip used across the admin panel: photo + name + a CLICKABLE
// Unique ID (opens the profile) + mobile, so admins can tell apart same-named users.
function UserIdentity({ u, showEmail = false }: { u: AdminUserLite; showEmail?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="relative shrink-0">
        <Avatar name={u.fullName} src={u.avatar || undefined} size="sm" />
        {u.online && <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-ink-900 bg-emerald-400" title="Online" />}
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs font-semibold text-mist-100">{u.fullName}</div>
        <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-mist-500">
          {u.publicId
            ? <Link href={profileHref(u)} target="_blank" className="font-mono font-semibold text-lotus-300 hover:underline" title="Open user profile">UID: {u.publicId}</Link>
            : <span className="font-mono">@{u.username}</span>}
          {u.phone && <span>📱 {u.phone}</span>}
          {showEmail && u.email && <span className="truncate">✉ {u.email}</span>}
        </div>
      </div>
    </div>
  );
}

// "Members" card drill-down: every member across all agencies, with full identity.
function MembersModal({ members, onClose }: { members: AdminAgencyMemberLite[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();
  const filtered = members.filter((m) => !ql || `${m.fullName} ${m.publicId} ${m.username} ${m.email ?? ""} ${m.phone ?? ""} ${m.agencyName}`.toLowerCase().includes(ql));
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <Card className="max-h-[85vh] w-full max-w-2xl overflow-hidden p-0" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
          <h3 className="flex items-center gap-2 font-bold text-mist-100"><Users className="size-4 text-sky-300" /> All agency members ({members.length})</h3>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>
        <div className="px-5 py-2">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mist-500" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search members by name, Unique ID, mobile or email…" className="pl-9" /></div>
        </div>
        <div className="max-h-[60vh] space-y-1.5 overflow-y-auto px-5 pb-5">
          {filtered.length === 0 ? <p className="py-8 text-center text-sm text-mist-500">No members found.</p> : filtered.map((m) => (
            <div key={m.id + m.agencyId} className="flex items-center gap-3 rounded-lg border border-line bg-ink-800 px-3 py-2">
              <UserIdentity u={m} showEmail />
              <span className="ml-auto shrink-0 text-[11px] text-mist-400">🏛 {m.agencyName} · <span className="capitalize">{m.role}</span></span>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize", m.status === "active" ? "bg-emerald-500/15 text-emerald-300" : "bg-white/[0.06] text-mist-400")}>{m.status}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone, onClick, href, active, hint }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; tone?: string; onClick?: () => void; href?: string; active?: boolean; hint?: string }) {
  const inner = (
    <>
      <div className="flex items-center gap-1.5 text-xs text-mist-400"><Icon className="size-3.5" /> {label}</div>
      <div className={cn("mt-1 font-display text-xl font-extrabold", tone ?? "text-mist-100")}>{value}</div>
      {(onClick || href) && <div className="mt-0.5 text-[10px] font-semibold text-lotus-300/80">{hint ?? "Tap to view →"}</div>}
    </>
  );
  const cls = cn("block w-full p-4 text-left transition", active ? "border-lotus-400/50 bg-lotus-500/[0.08]" : (onClick || href) && "hover:border-white/15 hover:bg-white/[0.03]");
  if (href) return <Link href={href}><Card className={cls}>{inner}</Card></Link>;
  if (onClick) return <button onClick={onClick} className="text-left"><Card className={cls}>{inner}</Card></button>;
  return <Card className="p-4">{inner}</Card>;
}

function AgencyModal({ agency, users, onClose, onSaved }: { agency: AdminAgency | null; users: AdminUser[]; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const editing = !!agency;
  const [name, setName] = useState(agency?.name ?? "");
  const [description, setDescription] = useState(agency?.description ?? "");
  const [logo, setLogo] = useState(agency?.logo ?? "");
  const [cover, setCover] = useState(agency?.cover ?? "");
  const { pick: agencyEdit, editor: agencyEditor } = usePhotoEdit();
  // Logo + cover now go through the shared advanced editor (crop/zoom/rotate).
  const pickImage = (file: File | undefined, setter: (v: string) => void, aspect: "square" | "cover") =>
    agencyEdit(file, setter, aspect);
  const [ownerId, setOwnerId] = useState(agency?.ownerId ?? "");
  const [ownerSearch, setOwnerSearch] = useState("");
  const [receiverPct, setReceiverPct] = useState(agency?.commission.receiverPct ?? 60);
  const [agencyPct, setAgencyPct] = useState(agency?.commission.agencyPct ?? 30);
  const [companyPct, setCompanyPct] = useState(agency?.commission.companyPct ?? 10);
  const [trustPct, setTrustPct] = useState(agency?.commission.trustPct ?? 0);
  const [roomLimit, setRoomLimit] = useState(agency?.roomLimit ?? 5);
  const [memberLimit, setMemberLimit] = useState(agency?.memberLimit ?? 50);
  const [feat, setFeat] = useState({ rooms: agency?.features.rooms ?? true, gifts: agency?.features.gifts ?? true, invites: agency?.features.invites ?? true });
  const [perms, setPerms] = useState<AgencyPermissions>(agency?.permissions ?? DEFAULT_AGENCY_PERMS);
  const togglePerm = (group: keyof AgencyPermissions, key: string) =>
    setPerms((p) => ({ ...p, [group]: { ...(p[group] as Record<string, boolean>), [key]: !(p[group] as Record<string, boolean>)[key] } }));
  const setGroup = (group: keyof AgencyPermissions, on: boolean) =>
    setPerms((p) => ({ ...p, [group]: Object.fromEntries(Object.keys(p[group]).map((k) => [k, on])) as AgencyPermissions[typeof group] }));
  const [info, setInfo] = useState({ type: agency?.type ?? "", country: agency?.country ?? "", state: agency?.state ?? "", city: agency?.city ?? "", address: agency?.address ?? "", contactPerson: agency?.contactPerson ?? "", mobile: agency?.mobile ?? "", email: agency?.email ?? "", website: agency?.website ?? "" });
  const [status, setStatus] = useState<AdminAgency["status"]>(agency?.status ?? "active");
  const [planId, setPlanId] = useState(agency?.planId ?? "");
  const [levelTierId, setLevelTierId] = useState(agency?.levelTierId ?? "");
  const { config: appConfig } = useConfig();
  const levelTiers = appConfig.agencyLevels?.tiers ?? [];
  const [startDate, setStartDate] = useState(agency?.startDate ? agency.startDate.slice(0, 10) : "");
  const [expiryDate, setExpiryDate] = useState(agency?.expiryDate ? agency.expiryDate.slice(0, 10) : "");
  const [autoRenewal, setAutoRenewal] = useState(agency?.autoRenewal ?? false);
  const [reminderDays, setReminderDays] = useState(agency?.renewalReminderDays ?? 0);
  const [plans, setPlans] = useState<AgencyPlan[]>([]);
  useEffect(() => { fetchAgencyPlans().then(setPlans); }, []);
  const setI = (k: string, v: string) => setInfo((s) => ({ ...s, [k]: v }));
  const [busy, setBusy] = useState(false);

  const pctTotal = receiverPct + agencyPct + companyPct + trustPct;
  const ownerMatches = useMemo(() => {
    const s = ownerSearch.trim().toLowerCase();
    if (!s) return users.slice(0, 6);
    // Match by name, username AND User ID (publicId) / email / phone — the owner
    // picker previously searched only name+username, so "search by User ID" failed.
    return users.filter((u) => `${u.fullName} ${u.username} ${u.publicId ?? ""} ${u.email ?? ""} ${u.phone ?? ""}`.toLowerCase().includes(s)).slice(0, 8);
  }, [ownerSearch, users]);
  const ownerLabel = users.find((u) => u.id === ownerId);

  const save = async () => {
    if (!name.trim()) return toast("Enter an agency name", "error");
    if (pctTotal !== 100) return toast("Commission percentages must add up to 100%", "error");
    setBusy(true);
    const body: Record<string, unknown> = {
      name, description, ownerId: ownerId || "",
      logo, cover,
      commission: { receiverPct, agencyPct, companyPct, trustPct },
      roomLimit, memberLimit, features: feat, permissions: perms,
      ...info, status, planId: planId || undefined,
      startDate: startDate ? new Date(startDate).toISOString() : undefined,
      expiryDate: expiryDate ? new Date(expiryDate).toISOString() : undefined,
      autoRenewal, renewalReminderDays: reminderDays,
      ...(editing ? { levelTierId } : {}),
    };
    const res = editing ? await updateAgency({ id: agency!.id, ...body }) : await createAgency(body);
    setBusy(false);
    if (res.ok) { toast(editing ? "Agency updated" : "Agency created", "success"); onSaved(); }
    else toast(res.error ?? "Failed", "error");
  };

  const field = "h-10 w-full rounded-lg border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none placeholder:text-mist-500 focus:border-lotus-400";

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      {agencyEditor}
      <div className="my-8 w-full max-w-lg rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Building2 className="size-5 text-lotus-300" /> {editing ? `Edit ${agency!.agencyId}` : "New agency"}</h2>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>

        <label className="mt-4 block text-xs font-semibold text-mist-300">Agency name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lotus Stars" className={cn(field, "mt-1")} maxLength={60} />

        <label className="mt-3 block text-xs font-semibold text-mist-300">Description</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" className={cn(field, "mt-1")} maxLength={500} />

        {/* Profile picture (logo) + cover image — click either to upload */}
        <label className="mt-3 block text-xs font-semibold text-mist-300">Profile picture &amp; cover</label>
        <div className="mt-1 overflow-hidden rounded-xl border border-line">
          <label className="relative block h-24 w-full cursor-pointer bg-gradient-to-r from-lotus-600/40 to-petal-600/30" style={cover ? { backgroundImage: `url(${cover})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0], setCover, "cover")} />
            <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg bg-black/50 px-2 py-1 text-[11px] font-semibold text-white"><ImagePlus className="size-3.5" /> Cover</span>
          </label>
          <div className="flex items-center gap-3 bg-ink-800/50 p-3">
            <label className="relative grid size-16 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-2xl border-2 border-ink-900 bg-lotus-500/15 text-lotus-200" style={logo ? { backgroundImage: `url(${logo})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0], setLogo, "square")} />
              {!logo && <Landmark className="size-7" />}
              <span className="absolute inset-x-0 bottom-0 bg-black/50 py-0.5 text-center text-[9px] font-semibold text-white">Edit</span>
            </label>
            <div className="text-xs text-mist-400">
              <p className="font-semibold text-mist-200">Agency logo &amp; cover banner</p>
              <p>Tap the banner or the logo tile to upload an image.{(logo || cover) && <> · <button type="button" onClick={() => { setLogo(""); setCover(""); }} className="text-rose-300 hover:underline">Remove both</button></>}</p>
            </div>
          </div>
        </div>

        {/* Agency Information */}
        <div className="mt-4 rounded-xl border border-line bg-ink-800/50 p-3">
          <p className="mb-2 text-xs font-semibold text-mist-300">Agency Information</p>
          <div className="grid grid-cols-2 gap-2">
            <input value={info.type} onChange={(e) => setI("type", e.target.value)} placeholder="Agency type" className={field} />
            <input value={info.contactPerson} onChange={(e) => setI("contactPerson", e.target.value)} placeholder="Contact person" className={field} />
            <input value={info.mobile} onChange={(e) => setI("mobile", e.target.value)} placeholder="Mobile number" className={field} />
            <input value={info.email} onChange={(e) => setI("email", e.target.value)} placeholder="Email address" className={field} />
            <input value={info.country} onChange={(e) => setI("country", e.target.value)} placeholder="Country" className={field} />
            <input value={info.state} onChange={(e) => setI("state", e.target.value)} placeholder="State" className={field} />
            <input value={info.city} onChange={(e) => setI("city", e.target.value)} placeholder="City" className={field} />
            <input value={info.website} onChange={(e) => setI("website", e.target.value)} placeholder="Website" className={field} />
            <input value={info.address} onChange={(e) => setI("address", e.target.value)} placeholder="Address" className={cn(field, "col-span-2")} />
          </div>
        </div>

        {/* Status & Membership */}
        <div className="mt-3 rounded-xl border border-line bg-ink-800/50 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-mist-300"><Calendar className="size-3.5 text-lotus-300" /> Status &amp; Membership</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-mist-500">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as AdminAgency["status"])} className={field}>
                {["pending", "active", "suspended", "expired", "rejected"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-mist-500">Membership plan</label>
              <select value={planId} onChange={(e) => setPlanId(e.target.value)} className={field}>
                <option value="">— none —</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.priceCoins} coins)</option>)}
              </select>
            </div>
            <div><label className="text-[11px] text-mist-500">Start date</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={field} /></div>
            <div><label className="text-[11px] text-mist-500">Expiry date</label><input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className={field} /></div>
            <div><label className="text-[11px] text-mist-500">Renewal reminder (days before)</label><input type="number" min={0} value={reminderDays} onChange={(e) => setReminderDays(Number(e.target.value) || 0)} className={field} /></div>
            <label className="flex items-end gap-2 pb-2 text-sm text-mist-200"><input type="checkbox" checked={autoRenewal} onChange={(e) => setAutoRenewal(e.target.checked)} className="size-4" /> Auto-renewal</label>
            {editing && levelTiers.length > 0 && (
              <div className="col-span-2">
                <label className="text-[11px] text-mist-500">Level (tier)</label>
                <select value={levelTierId} onChange={(e) => setLevelTierId(e.target.value)} className={field}>
                  <option value="">Auto (by {appConfig.agencyLevels?.metric ?? "members"})</option>
                  {levelTiers.map((t) => <option key={t.id} value={t.id}>{t.badge} {t.name} (manual)</option>)}
                </select>
                <p className="mt-0.5 text-[10px] text-mist-500">Leave on Auto to level up by the metric, or force a specific tier. Manage tiers in <b className="text-mist-400">Agency Levels</b>.</p>
              </div>
            )}
          </div>
        </div>

        {/* Owner picker */}
        <label className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-mist-300"><Crown className="size-3.5 text-gold-400" /> Agency Owner</label>
        {ownerId && <p className="mt-1 flex items-center gap-2 text-sm text-mist-100">{ownerLabel?.fullName ?? "Selected"} <button onClick={() => setOwnerId("")} className="text-xs text-rose-300 hover:underline">clear</button></p>}
        <input value={ownerSearch} onChange={(e) => setOwnerSearch(e.target.value)} placeholder="Search a user to assign as owner…" className={cn(field, "mt-1")} />
        {ownerSearch && (
          <div className="mt-1 max-h-32 space-y-0.5 overflow-y-auto rounded-lg border border-line bg-ink-900/60 p-1">
            {ownerMatches.map((u) => (
              <button key={u.id} onClick={() => { setOwnerId(u.id); setOwnerSearch(""); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-mist-200 hover:bg-white/[0.06]">
                <span className="truncate">{u.fullName}</span><span className="text-xs text-mist-500">@{u.username}</span>
              </button>
            ))}
            {ownerMatches.length === 0 && <p className="px-2 py-1 text-xs text-mist-500">No match.</p>}
          </div>
        )}

        {/* Commission split */}
        <div className="mt-4 rounded-xl border border-line bg-ink-800/50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-mist-300"><Percent className="size-3.5 text-lotus-300" /> Gift commission split (Receiver / Agency / Company / Trust)</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            <PctField label="Receiver" value={receiverPct} onChange={setReceiverPct} />
            <PctField label="Agency" value={agencyPct} onChange={setAgencyPct} />
            <PctField label="Company" value={companyPct} onChange={setCompanyPct} />
            <PctField label="Trust" value={trustPct} onChange={setTrustPct} />
          </div>
          <p className={cn("mt-1.5 text-[11px]", pctTotal === 100 ? "text-emerald-300" : "text-rose-300")}>Total: {pctTotal}% {pctTotal === 100 ? "✓" : "(must be 100%)"}</p>
          <p className="mt-1 text-[11px] text-mist-500">The <span className="text-emerald-300">Trust</span> % of every gift to this agency&apos;s members is credited to the Trust Wallet (Admin → Trust Management).</p>
        </div>

        {/* Limits */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-semibold text-mist-300">Room limit</label><input type="number" min={0} value={roomLimit} onChange={(e) => setRoomLimit(Number(e.target.value) || 0)} className={cn(field, "mt-1")} /></div>
          <div><label className="block text-xs font-semibold text-mist-300">Member limit</label><input type="number" min={0} value={memberLimit} onChange={(e) => setMemberLimit(Number(e.target.value) || 0)} className={cn(field, "mt-1")} /></div>
        </div>

        {/* Features */}
        <label className="mt-3 block text-xs font-semibold text-mist-300">Enabled features</label>
        <div className="mt-1 flex flex-wrap gap-2">
          {([["rooms", "Rooms"], ["gifts", "Gifts"], ["invites", "Invites"]] as const).map(([k, lbl]) => (
            <button key={k} onClick={() => setFeat((f) => ({ ...f, [k]: !f[k] }))} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold transition", feat[k] ? "border-lotus-400 bg-lotus-500/15 text-lotus-200" : "border-line bg-ink-900 text-mist-400")}>{lbl}: {feat[k] ? "On" : "Off"}</button>
          ))}
        </div>

        {/* Agency Permissions — granular ON/OFF for what this agency may do.
            Compact layout (tight group gaps + slim rows) so all three groups fit
            with minimal scrolling, per client request. */}
        <div className="mt-4 rounded-xl border border-lotus-400/20 bg-lotus-500/[0.04] p-2.5">
          <div className="flex items-center gap-2 text-sm font-bold text-mist-100"><Shield className="size-4 text-lotus-300" /> Agency Permissions</div>
          <p className="mt-0.5 text-[11px] text-mist-500">Control exactly what this agency owner/manager may do. Each is ON/OFF.</p>
          {PERM_GROUPS.map(([gk, glabel, items]) => {
            const group = perms[gk] as Record<string, boolean>;
            const allOn = items.every(([k]) => group[k]);
            return (
              <div key={gk} className="mt-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-mist-400">{glabel}</span>
                  <button onClick={() => setGroup(gk, !allOn)} className="text-[11px] font-semibold text-lotus-300 hover:text-lotus-200">{allOn ? "Turn all off" : "Turn all on"}</button>
                </div>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {items.map(([k, label]) => (
                    <button key={k} onClick={() => togglePerm(gk, k)} className={cn("flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition", group[k] ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200" : "border-line bg-ink-900 text-mist-400")}>
                      <span className="truncate">{label}</span>
                      <span className={cn("ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[10px]", group[k] ? "bg-emerald-500/25 text-emerald-100" : "bg-white/[0.06] text-mist-500")}>{group[k] ? "ON" : "OFF"}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <Button block className="mt-5" onClick={save} disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Create agency"}</Button>
      </div>
    </div>
  );
}

function PctField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <label className="block text-[11px] text-mist-400">{label}</label>
      <input type="number" min={0} max={100} value={value} onChange={(e) => onChange(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} className="mt-0.5 h-9 w-full rounded-lg border border-line bg-ink-900 px-2 text-sm text-mist-100 outline-none focus:border-lotus-400" />
    </div>
  );
}
