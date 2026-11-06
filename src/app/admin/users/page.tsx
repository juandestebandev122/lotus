"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { Button, ButtonLink } from "@/components/ui/Button";
import { tierForLevel } from "@/lib/levels";
import { useToast } from "@/components/ui/Toast";
import { fetchAdminUsers, updateAdminUser, deleteAdminUser, resetUserPassword, createAdminUserAccount, fetchUserActivity, resetUserMedia, resetUserLoginLock, adminSetReferredBy, type AdminUser, type AccountStatus, type UserActivity } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { SortTh } from "@/components/admin/TableControls";
import { PasswordChecklist } from "@/components/security/PasswordChecklist";
import { isStrongPassword } from "@/lib/password";
import { useAuth } from "@/lib/auth";
import { fileToDataUrl } from "@/lib/image";
import { adminListAgenciesLite, adminTransferMember, adminRemoveUserFromAgency, type AgencyLite } from "@/lib/agency";
import {
  Search, Shield, ShieldCheck, Ban, CheckCircle2, MoreVertical, UserCog, Lock, Unlock, Trash2, Activity, X, KeyRound, UserPlus, Pencil, RotateCcw, Camera, Download, BarChart3,
  Mail, Phone, Coins, Calendar, Building2, Crown, ExternalLink, Clock, Copy, Loader2, ImageOff, Snowflake, Smartphone, MessageSquare,
} from "lucide-react";
import Link from "next/link";
import { profileHref } from "@/lib/profile-href";

// Account provenance labels — "Created By" / registration method.
const VIA_LABEL: Record<string, string> = {
  self: "Self Registration",
  admin: "Admin Created",
  business: "Business Created",
  system: "System Generated",
};
function viaLabel(via?: string): string {
  return VIA_LABEL[via ?? "self"] ?? "Self Registration";
}
/** Who created the account (creator name; "Self" for self sign-ups). */
function createdByName(u: AdminUser): string {
  const via = u.createdVia ?? "self";
  if (via === "self") return "Self";
  return u.createdByName || "—";
}

/** "Online now" / "5 minutes ago" / "3 days ago" — a person reads this far faster
 *  than a timestamp, and it is the same 2-minute freshness the online dots use. */
function lastSeenLabel(iso?: string): string {
  if (!iso) return "Never";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "Never";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 120) return "Online now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) { const h = Math.floor(s / 3600); return `${h} hour${h === 1 ? "" : "s"} ago`; }
  const d = Math.floor(s / 86400);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-SA", { day: "numeric", month: "short", year: "numeric" });
}
export default function AdminUsersPage() {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [joinedFilter, setJoinedFilter] = useState<"all" | "today" | "week" | "month" | "range">("all");
  const [createdViaFilter, setCreatedViaFilter] = useState("all"); // all / self / admin / business / system
  const [agencyFilter, setAgencyFilter] = useState("all"); // "all" | "none" | <agency name>
  const [searchIn, setSearchIn] = useState("all");
  const [sortBy, setSortBy] = useState("joined"); // multi-column (see key() below)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [activity, setActivity] = useState<AdminUser | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);
  const [delReason, setDelReason] = useState("");
  const [resetFor, setResetFor] = useState<AdminUser | null>(null);
  const [editFor, setEditFor] = useState<AdminUser | null>(null);
  const [profileFor, setProfileFor] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);
  const { user: me } = useAuth();
  const isSuper = !me?.adminRole || me?.adminRole === "super_admin";
  const { toast } = useToast();

  const load = () => fetchAdminUsers().then((u) => { setUsers(u); setLoading(false); });
  useEffect(() => { load(); }, []);

  // Arriving from a "?q=<member ID>" link elsewhere in the admin (e.g. the Lucky
  // Spin chance log) pre-fills the search so that member is shown straight away.
  useEffect(() => {
    const incoming = new URLSearchParams(window.location.search).get("q");
    if (incoming) setQuery(incoming);
  }, []);

  const q = query.trim().toLowerCase();
  // Joining-date filter: Today / last 7 days / last 30 days / a custom range.
  const matchesJoined = (joinedAt: string): boolean => {
    if (joinedFilter === "all") return true;
    const d = new Date(joinedAt);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (joinedFilter === "today") return d >= startOfToday;
    if (joinedFilter === "week") { const w = new Date(startOfToday); w.setDate(w.getDate() - 6); return d >= w; }
    if (joinedFilter === "month") { const m = new Date(startOfToday); m.setDate(m.getDate() - 29); return d >= m; }
    if (joinedFilter === "range") {
      if (fromDate && d < new Date(fromDate)) return false;
      if (toDate) { const e = new Date(toDate); e.setHours(23, 59, 59, 999); if (d > e) return false; }
      return true;
    }
    return true;
  };
  // Every distinct agency in the user list — for the Agency filter dropdown.
  const agencyOptions = useMemo(
    () => [...new Set(users.map((u) => u.agencyName).filter((n): n is string => !!n))].sort((a, b) => a.localeCompare(b)),
    [users],
  );
  const rows = useMemo(
    () => {
      const filtered = users.filter((u) => {
        if (roleFilter !== "all" && u.role !== roleFilter) return false;
        if (statusFilter !== "all" && (u.accountStatus ?? "active") !== statusFilter) return false;
        if (createdViaFilter !== "all" && (u.createdVia ?? "self") !== createdViaFilter) return false;
        // Agency filter: "none" = members in no agency; a name = that agency only.
        if (agencyFilter === "none" && u.agencyName) return false;
        if (agencyFilter !== "all" && agencyFilter !== "none" && (u.agencyName ?? "") !== agencyFilter) return false;
        if (!matchesJoined(u.joinedAt)) return false;
        if (!q) return true;
        const all = `${u.fullName} ${u.username} ${u.email} ${u.phone} ${u.publicId ?? ""} ${u.joinedAt ?? ""} ${u.agencyName ?? ""} ${u.agencyId ?? ""} ${u.id} ${createdByName(u)} ${(u.groupCount ?? 0)} ${(u.coinsPurchased ?? 0)} ${(u.coinsSpent ?? 0)} ${(u.coins ?? 0)} ${u.level ?? 0} ${u.xp ?? 0} ${u.stats.gamesPlayed ?? 0} ${u.stats.wins ?? 0}`.toLowerCase();
        const byField: Record<string, string> = {
          name: u.fullName.toLowerCase(),
          username: u.username.toLowerCase(),
          userId: (u.publicId || u.id).toLowerCase(),
          email: (u.email || "").toLowerCase(),
          phone: (u.phone || "").toLowerCase(),
          role: (u.role || "").toLowerCase(),
          status: (u.accountStatus || "").toLowerCase(),
          joined: (u.joinedAt || "").toLowerCase(),
          lastSeen: lastSeenLabel(u.lastSeen).toLowerCase(),
          agency: `${u.agencyName ?? ""} ${u.agencyId ?? ""}`.toLowerCase(),
          referredBy: (u.referredByName ?? "").toLowerCase(),
          createdBy: createdByName(u).toLowerCase(),
          groups: String(u.groupCount ?? 0),
          coinBalance: String(u.coins ?? 0),
          coinsIn: String(u.coinsPurchased ?? 0),
          coinsOut: String(u.coinsSpent ?? 0),
          level: String(u.level ?? 0),
          xp: String(u.xp ?? 0),
          gamesPlayed: String(u.stats.gamesPlayed ?? 0),
          wins: String(u.stats.wins ?? 0),
        };
        return searchIn === "all" ? all.includes(q) : (byField[searchIn] ?? "").includes(q);
      });
      const key = (u: AdminUser): string | number => {
        switch (sortBy) {
          case "name": return u.fullName ?? "";
          case "username": return u.username ?? "";
          case "id": return u.publicId || u.id;
          case "email": return u.email ?? "";
          case "phone": return u.phone ?? "";
          case "role": return u.role ?? "";
          case "status": return u.accountStatus ?? "";
          case "lastSeen": return new Date(u.lastSeen ?? 0).getTime() || 0;
          case "agency": return u.agencyName ?? "";
          case "referredBy": return u.referredByName ?? "";
          case "createdBy": return createdByName(u);
          case "groups": return u.groupCount ?? 0;
          case "coins": return u.coins ?? 0;
          case "coinsIn": return u.coinsPurchased ?? 0;
          case "coinsOut": return u.coinsSpent ?? 0;
          case "level": return u.level ?? 0;
          case "xp": return u.xp ?? 0;
          case "gamesPlayed": return u.stats.gamesPlayed ?? 0;
          case "wins": return u.stats.wins ?? 0;
          default: return new Date(u.joinedAt ?? 0).getTime() || 0; // joined
        }
      };
      const mult = sortDir === "asc" ? 1 : -1;
      return [...filtered].sort((a, b) => {
        const av = key(a), bv = key(b);
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * mult;
        return String(av).localeCompare(String(bv), undefined, { numeric: true }) * mult;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q, searchIn, users, roleFilter, statusFilter, createdViaFilter, agencyFilter, joinedFilter, fromDate, toDate, sortBy, sortDir],
  );

  // Export the currently-filtered users to a CSV (opens in Excel).
  const exportCsv = () => {
    const esc = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const head = ["User ID", "Name", "Username", "Email", "Phone", "Role", "Status", "Joined", "Last seen", "Agency", "Groups joined", "Referred by", "Registration method", "Created by", "Creator role", "Created at", "Creator IP", "Coin balance", "Coins purchased", "Coins spent"];
    const body = rows.map((u) => [u.publicId || u.id, u.fullName, u.username, u.email, u.phone, u.role, u.accountStatus, u.joinedAt, lastSeenLabel(u.lastSeen), u.agencyName ?? "", u.groupCount ?? 0, u.referredByName ?? "", viaLabel(u.createdVia), createdByName(u), u.createdByRole ?? "", u.createdAt ?? "", u.createdIp ?? "", u.coins, u.coinsPurchased ?? 0, u.coinsSpent ?? 0].map(esc).join(","));
    const csv = [head.join(","), ...body].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const setStatus = async (u: AdminUser, accountStatus: AccountStatus, verb: string) => {
    setMenuFor(null);
    setUsers((us) => us.map((x) => (x.id === u.id ? { ...x, accountStatus } : x)));
    const okRes = await updateAdminUser(u.id, { accountStatus });
    toast(okRes.ok ? `${u.fullName} ${verb}` : "Could not save", okRes.ok ? "success" : "error");
    if (!okRes.ok) load();
  };

  const setVerified = async (u: AdminUser) => {
    setMenuFor(null);
    setUsers((us) => us.map((x) => (x.id === u.id ? { ...x, verified: !x.verified } : x)));
    await updateAdminUser(u.id, { verified: !u.verified });
    toast(`${u.fullName} ${u.verified ? "unverified" : "verified"}`, "success");
  };

  const setAdmin = async (u: AdminUser) => {
    setMenuFor(null);
    const role = u.role === "admin" ? "user" : "admin";
    setUsers((us) => us.map((x) => (x.id === u.id ? { ...x, role } : x)));
    await updateAdminUser(u.id, { role });
    toast(`${u.fullName} role set to ${role}`, "success");
  };

  const toggleForceReset = async (u: AdminUser) => {
    setMenuFor(null);
    const next = !u.mustChangePassword;
    setUsers((us) => us.map((x) => (x.id === u.id ? { ...x, mustChangePassword: next } : x)));
    const res = await updateAdminUser(u.id, { mustChangePassword: next });
    toast(res.ok ? (next ? `${u.fullName} must reset password on next login` : "Force-reset cleared") : "Could not save", res.ok ? "success" : "error");
    if (!res.ok) load();
  };

  // Admin per-user personal-messaging switch: OFF = this user can't send DMs.
  const toggleMessaging = async (u: AdminUser) => {
    setMenuFor(null);
    const next = !u.messagingDisabled;
    setUsers((us) => us.map((x) => (x.id === u.id ? { ...x, messagingDisabled: next } : x)));
    const res = await updateAdminUser(u.id, { dmDisabled: next });
    toast(res.ok ? (next ? `${u.fullName}'s personal messaging is turned OFF` : `${u.fullName}'s personal messaging is back ON`) : "Could not save", res.ok ? "success" : "error");
    if (!res.ok) load();
  };

  const toggleFreeze = async (u: AdminUser) => {
    setMenuFor(null);
    const next = !u.walletFrozen;
    setUsers((us) => us.map((x) => (x.id === u.id ? { ...x, walletFrozen: next } : x)));
    try {
      const res = await fetch("/api/admin/wallet-freeze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: u.id, frozen: next }),
      });
      const data = await res.json();
      if (res.ok && data.ok) toast(next ? `${u.fullName}'s wallet is frozen — they can't spend or withdraw` : `${u.fullName}'s wallet is unfrozen`, "success");
      else { toast(data.error ?? "Could not update the wallet", "error"); load(); }
    } catch { toast("Could not update the wallet", "error"); load(); }
  };

  const doDelete = async (u: AdminUser, reason: string) => {
    const res = await deleteAdminUser(u.id, reason);
    if (res.ok) {
      setConfirmDelete(null); setDelReason("");
      setUsers((us) => us.filter((x) => x.id !== u.id));
      toast(`${u.fullName} moved to Deleted Users`, "success");
    } else {
      toast(res.error ?? "Could not delete this account", "error");
    }
  };
  const onSort = (col: string) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(col);
    setSortDir(col === "joined" || col === "lastSeen" || col === "coins" || col === "coinsIn" || col === "coinsOut" || col === "groups" || col === "level" || col === "xp" || col === "gamesPlayed" || col === "wins" ? "desc" : "asc");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-mist-100">User management</h1>
          <p className="text-sm text-mist-400">
            {loading ? "Loading…" : `${rows.length} users`} · block, suspend, verify, set roles &amp; remove.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 lg:max-w-2xl">
          <div className="min-w-[200px] flex-1">
            <Input
              icon={<Search className="size-4" />}
              placeholder="Search name, ID, email or mobile…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select value={searchIn} onChange={(e) => setSearchIn(e.target.value)} aria-label="Search in column" className="h-11 shrink-0 rounded-xl border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400">
            <option value="all">Search: all columns</option>
            <option value="name">Name</option>
            <option value="username">Username</option>
            <option value="userId">User ID</option>
            <option value="email">Email</option>
            <option value="phone">Mobile</option>
            <option value="role">Role</option>
            <option value="status">Status</option>
            <option value="joined">Joined date</option>
            <option value="lastSeen">Last seen</option>
            <option value="agency">Agency</option>
            <option value="referredBy">Referred by</option>
            <option value="createdBy">Created by</option>
            <option value="groups">Groups count</option>
            <option value="coinBalance">Coin balance</option>
            <option value="coinsIn">Coins in</option>
            <option value="coinsOut">Coins out</option>
            <option value="level">Level</option>
            <option value="xp">XP</option>
            <option value="gamesPlayed">Games played</option>
            <option value="wins">Wins</option>
          </select>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filter by role" className="h-11 shrink-0 rounded-xl border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400">
            <option value="all">All roles</option>
            <option value="user">User</option>
            <option value="moderator">Moderator</option>
            <option value="admin">Admin</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status" className="h-11 shrink-0 rounded-xl border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400">
            <option value="all">All statuses</option>
            <option value="pending">Waiting approval</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
            <option value="blocked">Blocked</option>
            <option value="banned">Banned</option>
            <option value="rejected">Rejected</option>
          </select>
          <select value={joinedFilter} onChange={(e) => setJoinedFilter(e.target.value as typeof joinedFilter)} aria-label="Filter by joining date" className="h-11 shrink-0 rounded-xl border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400">
            <option value="all">Joined: any time</option>
            <option value="today">Joined today</option>
            <option value="week">Joined this week</option>
            <option value="month">Joined this month</option>
            <option value="range">Joined: custom range…</option>
          </select>
          <select value={createdViaFilter} onChange={(e) => setCreatedViaFilter(e.target.value)} aria-label="Filter by who created the account" className="h-11 shrink-0 rounded-xl border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400">
            <option value="all">Created by: anyone</option>
            <option value="self">Self Registered</option>
            <option value="admin">Created by Admin</option>
            <option value="business">Created by Business</option>
            <option value="system">System Generated</option>
          </select>
          {/* Agency filter */}
          <select value={agencyFilter} onChange={(e) => setAgencyFilter(e.target.value)} aria-label="Filter by agency" className="h-11 shrink-0 rounded-xl border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400">
            <option value="all">Agency: all</option>
            <option value="none">No agency</option>
            {agencyOptions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          {/* Sort */}
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort by" className="h-11 shrink-0 rounded-xl border border-line bg-ink-800 px-3 text-sm text-mist-100 outline-none focus:border-lotus-400">
            <option value="status">Sort: Status</option>
            <option value="joined">Sort: Joined date</option>
            <option value="lastSeen">Sort: Last seen</option>
            <option value="name">Sort: Name</option>
            <option value="username">Sort: Username</option>
            <option value="id">Sort: ID number</option>
            <option value="role">Sort: Role</option>
            <option value="agency">Sort: Agency</option>
            <option value="groups">Sort: Groups count</option>
            <option value="coins">Sort: Coin balance</option>
            <option value="coinsIn">Sort: Coins in</option>
            <option value="coinsOut">Sort: Coins out</option>
            <option value="level">Sort: Level</option>
            <option value="xp">Sort: XP</option>
            <option value="gamesPlayed">Sort: Games played</option>
            <option value="wins">Sort: Wins</option>
            <option value="createdBy">Sort: Created by</option>
            <option value="referredBy">Sort: Referred by</option>
            <option value="email">Sort: Email</option>
            <option value="phone">Sort: Mobile</option>
          </select>
          <button onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))} title={sortDir === "asc" ? "Ascending — click for descending" : "Descending — click for ascending"} className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-ink-800 text-mist-200 transition hover:text-mist-100">{sortDir === "asc" ? "▲" : "▼"}</button>
          <Button className="shrink-0" onClick={() => setCreating(true)}><UserPlus className="size-4" /> Create user</Button>
        </div>
      </div>

      {/* Custom date range + exports */}
      <div className="flex flex-wrap items-center gap-2">
        {joinedFilter === "range" && (
          <>
            <label className="flex items-center gap-1.5 text-xs text-mist-400">From <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9 rounded-lg border border-line bg-ink-800 px-2 text-sm text-mist-100 outline-none focus:border-lotus-400" /></label>
            <label className="flex items-center gap-1.5 text-xs text-mist-400">To <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9 rounded-lg border border-line bg-ink-800 px-2 text-sm text-mist-100 outline-none focus:border-lotus-400" /></label>
          </>
        )}
        <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-3 py-2 text-xs font-semibold text-mist-200 hover:border-emerald-400/40"><Download className="size-3.5 text-emerald-300" /> Export Excel (CSV)</button>
        <ButtonLink href="/admin/joining-report" variant="secondary" size="sm"><BarChart3 className="size-4" /> Joining report</ButtonLink>
      </div>

      <Card className="overflow-visible p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-mist-500">
                <SortTh col="name" sort={sortBy} dir={sortDir} onSort={onSort} className="px-5 py-3">User</SortTh>
                <SortTh col="email" sort={sortBy} dir={sortDir} onSort={onSort} className="px-5 py-3">Contact</SortTh>
                <SortTh col="role" sort={sortBy} dir={sortDir} onSort={onSort} className="px-5 py-3">Role</SortTh>
                <SortTh col="status" sort={sortBy} dir={sortDir} onSort={onSort} className="px-5 py-3">Status</SortTh>
                <SortTh col="joined" sort={sortBy} dir={sortDir} onSort={onSort} className="px-5 py-3">Joined</SortTh>
                <SortTh col="lastSeen" sort={sortBy} dir={sortDir} onSort={onSort} className="px-5 py-3">Last seen</SortTh>
                <SortTh col="agency" sort={sortBy} dir={sortDir} onSort={onSort} className="px-5 py-3">Agency</SortTh>
                <SortTh col="groups" sort={sortBy} dir={sortDir} onSort={onSort} className="px-5 py-3">Groups</SortTh>
                <SortTh col="referredBy" sort={sortBy} dir={sortDir} onSort={onSort} className="px-5 py-3">Referred by</SortTh>
                <SortTh col="createdBy" sort={sortBy} dir={sortDir} onSort={onSort} className="px-5 py-3">Created by</SortTh>
                <SortTh col="coins" sort={sortBy} dir={sortDir} onSort={onSort} className="px-5 py-3">Coins (in / out)</SortTh>
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                  <td className="px-5 py-3">
                    {/* Click the name/photo to open the full profile popup. */}
                    <button onClick={() => setProfileFor(u)} className="flex items-center gap-3 text-left transition hover:opacity-90" title="View full profile">
                      <Avatar name={u.fullName} src={u.avatar} size="sm" />
                      <div>
                        <div className="flex items-center gap-1 font-semibold text-mist-100 hover:text-lotus-200">
                          {u.fullName}
                          {u.verified && <CheckCircle2 className="size-3.5 text-lotus-400" />}
                        </div>
                        <div className="text-xs text-mist-500">@{u.username}{u.publicId && <span className="ml-1 font-mono font-semibold text-lotus-300">· ID {u.publicId}</span>}</div>
                      </div>
                    </button>
                  </td>
                  <td className="px-5 py-3 text-xs text-mist-400">
                    <div>{u.email || "—"}</div>
                    <div>{u.phone || "—"}</div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={"rounded-full px-2 py-0.5 text-xs font-semibold capitalize " + (u.role === "admin" ? "bg-lotus-500/15 text-lotus-300" : u.role === "moderator" ? "bg-sky-500/15 text-sky-300" : "bg-white/8 text-mist-300")}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3"><StatusPill status={u.accountStatus} /></td>
                  <td className="px-5 py-3 text-xs text-mist-300">{u.joinedAt ? new Date(u.joinedAt).toLocaleDateString("en-SA", { day: "numeric", month: "short", year: "numeric" }) : "—"}</td>
                  {/* LAST SEEN. The data was already flowing to this screen — it was
                      just never shown in the list, only inside a user's profile. */}
                  <td className="px-5 py-3 text-xs">
                    {(() => {
                      const rel = lastSeenLabel(u.lastSeen);
                      return <span className={rel === "Online now" ? "font-semibold text-emerald-300" : "text-mist-300"}>{rel}</span>;
                    })()}
                  </td>
                  <td className="px-5 py-3 text-xs">
                    {u.agencyName ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-lotus-500/12 px-2 py-0.5 text-[11px] font-semibold text-lotus-200" title={`${u.agencyName} — ${u.agencyRole}`}>
                        {u.agencyName}
                        {u.agencyRole && u.agencyRole !== "member" && <span className="text-[9px] uppercase text-lotus-300/80">{u.agencyRole}</span>}
                      </span>
                    ) : <span className="text-mist-600">—</span>}
                  </td>
                  <td className="px-5 py-3 text-xs text-mist-200">{(u.groupCount ?? 0).toLocaleString("en-SA")}</td>
                  <td className="px-5 py-3 text-xs">
                    {u.referredByName ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/12 px-2 py-0.5 text-[11px] font-semibold text-sky-200" title="Joined through this member's invite link">
                        {u.referredByName}
                      </span>
                    ) : <span className="text-mist-600">—</span>}
                  </td>
                  <td className="px-5 py-3 text-xs">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", (u.createdVia ?? "self") === "admin" ? "bg-lotus-500/15 text-lotus-300" : (u.createdVia ?? "self") === "business" ? "bg-amber-500/15 text-amber-300" : (u.createdVia ?? "self") === "system" ? "bg-white/8 text-mist-300" : "bg-emerald-500/12 text-emerald-300")}>
                      {viaLabel(u.createdVia)}
                    </span>
                    <div className="mt-0.5 text-[11px] text-mist-500">{createdByName(u)}</div>
                  </td>
                  <td className="px-5 py-3 text-xs">
                    <span className="text-emerald-300">🪙 {(u.coinsPurchased ?? 0).toLocaleString("en-SA")}</span>
                    <span className="mx-1 text-mist-600">/</span>
                    <span className="text-petal-300">{(u.coinsSpent ?? 0).toLocaleString("en-SA")}</span>
                  </td>
                  <td className="relative px-5 py-3 text-right">
                    <button onClick={() => setMenuFor(menuFor === u.id ? null : u.id)} className="grid size-8 place-items-center rounded-lg text-mist-400 hover:bg-white/10 hover:text-mist-100">
                      <MoreVertical className="size-4" />
                    </button>
                    {menuFor === u.id && (
                      <div className="absolute right-5 top-12 z-20 w-52 overflow-hidden rounded-xl border border-white/10 bg-ink-800 py-1 shadow-2xl">
                        {(u.accountStatus === "pending" || u.accountStatus === "rejected") && (
                          <>
                            <MenuItem icon={CheckCircle2} label="Approve account" tone="text-emerald-300" onClick={() => setStatus(u, "active", "approved — can now sign in")} />
                            <div className="my-1 border-t border-white/8" />
                          </>
                        )}
                        <MenuItem icon={Activity} label="View activity" onClick={() => { setMenuFor(null); setActivity(u); }} />
                        <MenuItem icon={Pencil} label="Edit details" onClick={() => { setMenuFor(null); setEditFor(u); }} />
                        <MenuItem icon={Shield} label={u.verified ? "Remove verification" : "Verify user"} onClick={() => setVerified(u)} />
                        <MenuItem icon={ShieldCheck} label={u.role === "admin" ? "Revoke admin" : "Make admin"} tone="text-lotus-300" onClick={() => setAdmin(u)} />
                        <div className="my-1 border-t border-white/8" />
                        {u.accountStatus !== "active" ? (
                          <MenuItem icon={Unlock} label="Unblock / activate" tone="text-emerald-300" onClick={() => setStatus(u, "active", "is now active")} />
                        ) : (
                          <MenuItem icon={Lock} label="Block user" tone="text-amber-300" onClick={() => setStatus(u, "blocked", "has been blocked")} />
                        )}
                        <MenuItem icon={UserCog} label="Suspend (temporary)" tone="text-amber-300" onClick={() => setStatus(u, "suspended", "has been suspended")} />
                        <MenuItem icon={Ban} label="Ban (permanent)" tone="text-rose-300" onClick={() => setStatus(u, "banned", "has been banned")} />
                        <MenuItem icon={Snowflake} label={u.walletFrozen ? "Unfreeze wallet" : "Freeze wallet (hold coins)"} tone={u.walletFrozen ? "text-emerald-300" : "text-sky-300"} onClick={() => toggleFreeze(u)} />
                        <div className="my-1 border-t border-white/8" />
                        <MenuItem icon={KeyRound} label="Reset password" tone="text-sky-300" onClick={() => { setMenuFor(null); setResetFor(u); }} />
                        <MenuItem icon={RotateCcw} label={u.mustChangePassword ? "Cancel forced reset" : "Force reset on next login"} tone="text-amber-300" onClick={() => toggleForceReset(u)} />
                        <MenuItem icon={MessageSquare} label={u.messagingDisabled ? "Turn ON messaging" : "Turn OFF messaging"} tone={u.messagingDisabled ? "text-emerald-300" : "text-amber-300"} onClick={() => toggleMessaging(u)} />
                        <MenuItem icon={Trash2} label="Delete account" tone="text-rose-300" onClick={() => { setMenuFor(null); setConfirmDelete(u); }} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={12} className="px-5 py-8 text-center text-sm text-mist-500">No users match your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {activity && <ActivityModal user={activity} onClose={() => setActivity(null)} />}

      {resetFor && <ResetPasswordModal user={resetFor} onClose={() => setResetFor(null)} onDone={(msg) => { setResetFor(null); toast(msg, "success"); }} />}

      {creating && <CreateUserModal canMakeAdmin={isSuper} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); toast("User created", "success"); }} />}

      {editFor && <EditUserModal user={editFor} onClose={() => setEditFor(null)} onSaved={() => { setEditFor(null); load(); toast("User updated", "success"); }} />}

      {profileFor && (
        <UserProfileModal
          user={profileFor}
          onClose={() => setProfileFor(null)}
          onEdit={(u) => { setProfileFor(null); setEditFor(u); }}
          onReset={(u) => { setProfileFor(null); setResetFor(u); }}
          onActivity={(u) => { setProfileFor(null); setActivity(u); }}
          onStatus={(u, s, verb) => setStatus(u, s, verb)}
          onDelete={(u) => { setProfileFor(null); setConfirmDelete(u); }}
          onChanged={() => load()}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4" onClick={() => { setConfirmDelete(null); setDelReason(""); }}>
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-lg font-bold text-rose-200">Delete {confirmDelete.fullName}?</h2>
            <p className="mt-1 text-sm text-mist-400">The account moves to <b className="text-mist-200">Deleted Users</b> (a Super Admin can restore it). A reason is required and stored in the deletion log.</p>
            <label className="mt-4 block text-xs font-semibold text-mist-300">Reason for deletion <span className="text-rose-300">*</span></label>
            <textarea value={delReason} onChange={(e) => setDelReason(e.target.value)} rows={3} maxLength={300} autoFocus placeholder="e.g. Spam / abuse / duplicate account / user request…" className="mt-1 w-full resize-none rounded-lg border border-line bg-ink-800 p-2.5 text-sm text-mist-100 outline-none focus:border-lotus-400" />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setConfirmDelete(null); setDelReason(""); }} className="rounded-lg px-4 py-2 text-sm font-semibold text-mist-300 hover:text-mist-100">Cancel</button>
              <button onClick={() => doDelete(confirmDelete, delReason.trim())} disabled={!delReason.trim()} className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-bold text-white hover:bg-rose-600 disabled:opacity-50">Delete account</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const STATUS_MAP: Record<AccountStatus, [string, string]> = {
  active: ["bg-emerald-500/15 text-emerald-300", "Active"],
  inactive: ["bg-white/[0.06] text-mist-400", "Inactive"],
  suspended: ["bg-amber-500/15 text-amber-300", "Suspended"],
  blocked: ["bg-orange-500/15 text-orange-300", "Blocked"],
  banned: ["bg-rose-500/15 text-rose-300", "Banned"],
  pending: ["bg-amber-500/15 text-amber-300", "Waiting approval"],
  rejected: ["bg-rose-500/15 text-rose-300", "Rejected"],
};

function StatusPill({ status }: { status: AccountStatus }) {
  const [cls, label] = STATUS_MAP[status];
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

function MenuItem({ icon: Icon, label, onClick, tone = "text-mist-200" }: { icon: typeof Shield; label: string; onClick: () => void; tone?: string }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-white/5 ${tone}`}>
      <Icon className="size-4" /> {label}
    </button>
  );
}

function ActField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-mist-600">{label}</div>
      <div className="truncate text-mist-200">{value || "—"}</div>
    </div>
  );
}

function ActivityModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const fmt = (s: string) => (s ? new Date(s).toLocaleString("en-SA", { dateStyle: "medium", timeStyle: "short" }) : "Never");
  const [activity, setActivity] = useState<UserActivity | null>(null);
  useEffect(() => { fetchUserActivity(user.id).then(setActivity); }, [user.id]);

  const rows: [string, string][] = [
    ["User ID", user.id],
    ["Email", user.email || "—"],
    ["Mobile", user.phone || "—"],
    ["Role", user.role],
    ["Status", STATUS_MAP[user.accountStatus][1]],
    ["Registration method", viaLabel(user.createdVia)],
    ...(user.referredByName ? ([["Referred by", user.referredByName]] as [string, string][]) : []),
    ["Account created by", createdByName(user) + (user.createdByRole ? ` (${user.createdByRole})` : "")],
    ["Created at", user.createdAt ? fmt(user.createdAt) : fmt(user.joinedAt)],
    ...(user.createdIp ? ([["Created from IP", user.createdIp]] as [string, string][]) : []),
    ["Joined", fmt(user.joinedAt)],
    ["Last login", fmt(user.lastSeen)],
    ["Level", `${user.level} · ${tierForLevel(user.level).emoji} ${tierForLevel(user.level).name}`],
    ["XP", (user.xp ?? 0).toLocaleString("en-SA")],
    ["Coin balance", user.coins.toLocaleString("en-SA")],
    ["Coins purchased", (user.coinsPurchased ?? 0).toLocaleString("en-SA")],
    ["Coins spent", (user.coinsSpent ?? 0).toLocaleString("en-SA")],
    ["Games played", String(user.stats.gamesPlayed)],
    ["Wins", String(user.stats.wins)],
    ["Followers", String(user.stats.followers)],
    ["Groups joined", String(user.groupCount ?? 0)],
  ];
  const isLogout = (m?: string) => (m || "").toLowerCase() === "logout";
  const sessionDuration = (start: string, end: string): string => {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (!Number.isFinite(ms) || ms <= 0) return "";
    const mins = Math.round(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60); const m = mins % 60;
    return `${h}h${m ? ` ${m}m` : ""}`;
  };
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-lg rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-white/8 pb-3">
          <Avatar name={user.fullName} src={user.avatar} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-mist-100">{user.fullName}</p>
            <p className="truncate text-xs text-mist-400">@{user.username}</p>
          </div>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wide text-mist-500">{k}</span>
              <span className="truncate text-mist-100">{v}</span>
            </div>
          ))}
        </div>

        {/* Device information (Device & Security) */}
        {activity?.deviceSummary && (() => {
          const s = activity.deviceSummary;
          return (
            <>
              <h3 className="mt-4 mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-mist-500"><Smartphone className="size-3.5" /> Device information</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl border border-white/8 bg-ink-900 p-3 text-xs sm:grid-cols-3">
                <ActField label="Current device" value={s.currentDevice} />
                <ActField label="OS" value={s.os} />
                <ActField label="Model" value={s.model} />
                <ActField label="Current IP" value={s.ip} />
                <ActField label="Location" value={s.location} />
                <ActField label="Status" value={s.online ? "🟢 Online" : "⚪ Offline"} />
                <ActField label="Last login" value={s.lastLogin ? fmt(s.lastLogin) : "—"} />
                <ActField label="Total devices" value={String(s.totalDevices)} />
                <ActField label="Total logins" value={String(s.totalLogins)} />
              </div>
            </>
          );
        })()}

        {/* Login / logout history */}
        <h3 className="mt-4 mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-mist-500"><Activity className="size-3.5" /> Login &amp; logout history</h3>
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-white/8 bg-ink-900 p-2">
          {!activity ? (
            <p className="px-1 py-2 text-center text-xs text-mist-500">Loading…</p>
          ) : activity.loginHistory.length === 0 ? (
            <p className="px-1 py-2 text-center text-xs text-mist-500">No login activity recorded yet.</p>
          ) : (
            activity.loginHistory.map((e, i) => {
              const failed = e.success === false;
              const label = failed ? (e.method === "blocked" ? "Blocked" : "Failed") : isLogout(e.method) ? "Logout" : "Login";
              const style = failed ? "bg-amber-500/15 text-amber-300" : isLogout(e.method) ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/15 text-emerald-300";
              const dur = e.at2 ? sessionDuration(e.at, e.at2) : "";
              return (
                <div key={i} className="flex items-center justify-between gap-2 px-1 py-1 text-xs">
                  <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold", style)}>{label}</span>
                  <span className="min-w-0 flex-1 truncate text-mist-300">{e.device || "Unknown device"}{e.ip ? ` · ${e.ip}` : ""}{e.location ? ` · ${e.location}` : ""}{e.method && !isLogout(e.method) && !failed ? ` · ${e.method}` : ""}{dur ? ` · ${dur}` : ""}</span>
                  <span className="shrink-0 text-mist-500">{fmt(e.at)}</span>
                </div>
              );
            })
          )}
        </div>

        {/* Account audit trail (admin actions on this user) */}
        <h3 className="mt-4 mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-mist-500"><Activity className="size-3.5" /> Account actions (audit)</h3>
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-white/8 bg-ink-900 p-2">
          {!activity ? (
            <p className="px-1 py-2 text-center text-xs text-mist-500">Loading…</p>
          ) : activity.auditLog.length === 0 ? (
            <p className="px-1 py-2 text-center text-xs text-mist-500">No account actions recorded for this user.</p>
          ) : (
            activity.auditLog.map((l) => (
              <div key={l.id} className="px-1 py-1 text-xs">
                <div className="text-mist-200">{l.action}</div>
                <div className="text-[10px] text-mist-500">by {l.admin} · {fmt(l.at)}</div>
              </div>
            ))
          )}
        </div>

        {/* Full user action history */}
        <h3 className="mt-4 mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-mist-500"><Activity className="size-3.5" /> User action history</h3>
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-white/8 bg-ink-900 p-2">
          {!activity ? (
            <p className="px-1 py-2 text-center text-xs text-mist-500">Loading…</p>
          ) : activity.actionHistory.length === 0 ? (
            <p className="px-1 py-2 text-center text-xs text-mist-500">No user actions recorded yet.</p>
          ) : (
            activity.actionHistory.map((a) => (
              <div key={a.id} className="rounded-lg border border-white/6 bg-ink-850 px-2 py-1.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-mist-200">{a.detail}</span>
                  <span className="shrink-0 text-[10px] text-mist-500">{fmt(a.at)}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-mist-500">
                  <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 uppercase tracking-wide">{a.kind.replace(/_/g, " ")}</span>
                  {a.status && <span className="capitalize">Status: {a.status.replace(/_/g, " ")}</span>}
                  {typeof a.coins === "number" && <span>Coins: {a.coins.toLocaleString("en-SA")}</span>}
                  {a.roomName && <span>Room: {a.roomName}</span>}
                </div>
              </div>
            ))
          )}
        </div>

        <Button block variant="secondary" className="mt-4" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}

function ResetPasswordModal({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: (msg: string) => void }) {
  const { toast } = useToast();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!isStrongPassword(pw)) { toast("Password doesn't meet the requirements", "error"); return; }
    if (pw !== confirm) { toast("Passwords don't match", "error"); return; }
    setBusy(true);
    const res = await resetUserPassword(user.id, pw);
    setBusy(false);
    if (!res.ok) { toast(res.error ?? "Could not reset password", "error"); return; }
    onDone(`Password reset for ${user.fullName}. They've been signed out everywhere.`);
  };

  const field = "h-11 w-full rounded-xl border border-line bg-ink-800 px-3.5 text-sm text-mist-100 outline-none placeholder:text-mist-500 focus:border-lotus-400";

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <KeyRound className="size-5 text-sky-300" />
          <h2 className="font-display text-lg font-bold text-mist-100">Reset password</h2>
        </div>
        <p className="mt-1 text-xs text-mist-400">Set a new password for <span className="font-semibold text-mist-200">{user.fullName}</span> (@{user.username}). They&apos;ll be signed out of all devices.</p>

        <label className="mt-4 block text-sm font-semibold text-mist-200">New password</label>
        <input type="text" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Enter a new password" autoFocus className={`${field} mt-1.5`} />
        <PasswordChecklist value={pw} />

        <label className="mt-3 block text-sm font-semibold text-mist-200">Confirm password</label>
        <input type="text" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter the password" className={`${field} mt-1.5`} />
        {confirm && confirm !== pw && <p className="mt-1 text-[11px] text-rose-300">Passwords don&apos;t match.</p>}

        <div className="mt-5 flex gap-2">
          <Button variant="secondary" block onClick={onClose}>Cancel</Button>
          <Button block onClick={submit} disabled={busy}><KeyRound className="size-4" /> {busy ? "Resetting…" : "Reset password"}</Button>
        </div>
      </div>
    </div>
  );
}

const modalField = "h-11 w-full rounded-xl border border-line bg-ink-900 px-3.5 text-sm text-mist-100 outline-none placeholder:text-mist-500 focus:border-lotus-400";

function CreateUserModal({ canMakeAdmin, onClose, onCreated }: { canMakeAdmin: boolean; onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState({ fullName: "", username: "", password: "", confirm: "", email: "", phone: "", role: "user", accountStatus: "active", mustChangePassword: false });
  const [avatar, setAvatar] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));

  const pickPhoto = async (file?: File) => {
    if (!file) return;
    try { setAvatar(await fileToDataUrl(file, 256, 0.72)); } catch { toast("Could not read that image", "error"); }
  };

  const submit = async () => {
    if (!f.fullName.trim()) { toast("Enter the full name", "error"); return; }
    if (!/^[a-z0-9._]{3,20}$/.test(f.username.trim().toLowerCase())) { toast("Username: 3–20 chars (letters, numbers, . or _)", "error"); return; }
    if (!isStrongPassword(f.password)) { toast("Password doesn't meet the requirements", "error"); return; }
    if (f.password !== f.confirm) { toast("Passwords don't match", "error"); return; }
    setBusy(true);
    const res = await createAdminUserAccount({
      fullName: f.fullName, username: f.username.trim().toLowerCase(), password: f.password,
      email: f.email.trim() || undefined, phone: f.phone.trim() || undefined,
      role: f.role, accountStatus: f.accountStatus, mustChangePassword: f.mustChangePassword,
      avatar: avatar || undefined,
    });
    setBusy(false);
    if (!res.ok) { toast(res.error ?? "Could not create user", "error"); return; }
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-lg rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><UserPlus className="size-5 text-lotus-300" /> Create new account</h2>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>

        {/* Profile picture (optional) */}
        <div className="mb-3 flex items-center gap-3">
          <Avatar name={f.fullName || "New user"} src={avatar} size="lg" />
          <div>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-ink-900 px-3 py-1.5 text-xs font-semibold text-mist-200 hover:border-lotus-400/40">
              <Camera className="size-3.5" /> {avatar ? "Change photo" : "Upload photo"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { pickPhoto(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            {avatar && <button type="button" onClick={() => setAvatar("")} className="ml-2 text-xs text-rose-300 hover:text-rose-200">Remove</button>}
            <p className="mt-1 text-[11px] text-mist-500">Profile picture — optional.</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="block text-xs font-semibold text-mist-300">Full name *</label><input value={f.fullName} onChange={(e) => set("fullName", e.target.value)} className={`${modalField} mt-1`} placeholder="Full name" /></div>
          <div><label className="block text-xs font-semibold text-mist-300">Username *</label><input value={f.username} onChange={(e) => set("username", e.target.value)} className={`${modalField} mt-1`} placeholder="username" /></div>
          <div><label className="block text-xs font-semibold text-mist-300">Mobile number</label><input value={f.phone} onChange={(e) => set("phone", e.target.value)} className={`${modalField} mt-1`} placeholder="+966…" /></div>
          <div className="sm:col-span-2"><label className="block text-xs font-semibold text-mist-300">Email address</label><input value={f.email} onChange={(e) => set("email", e.target.value)} className={`${modalField} mt-1`} placeholder="user@example.com" /></div>
          <div><label className="block text-xs font-semibold text-mist-300">Password *</label><input type="text" value={f.password} onChange={(e) => set("password", e.target.value)} className={`${modalField} mt-1`} placeholder="Set a password" /></div>
          <div><label className="block text-xs font-semibold text-mist-300">Confirm password *</label><input type="text" value={f.confirm} onChange={(e) => set("confirm", e.target.value)} className={`${modalField} mt-1`} placeholder="Re-enter password" /></div>
          <div className="sm:col-span-2"><PasswordChecklist value={f.password} /></div>
          <div>
            <label className="block text-xs font-semibold text-mist-300">Role</label>
            <select value={f.role} onChange={(e) => set("role", e.target.value)} className={`${modalField} mt-1 appearance-none`}>
              <option value="user">User</option>
              <option value="moderator" disabled={!canMakeAdmin}>Moderator</option>
              <option value="admin" disabled={!canMakeAdmin}>Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-mist-300">Account status</label>
            <select value={f.accountStatus} onChange={(e) => set("accountStatus", e.target.value)} className={`${modalField} mt-1 appearance-none`}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <label className="mt-3 flex items-center gap-2 text-xs text-mist-300">
          <input type="checkbox" checked={f.mustChangePassword} onChange={(e) => set("mustChangePassword", e.target.checked)} className="size-4 accent-lotus-500" /> Require password change on first login
        </label>
        {!canMakeAdmin && <p className="mt-1 text-[11px] text-mist-500">Only a Super Admin can create admin/moderator accounts.</p>}

        <div className="mt-5 flex gap-2">
          <Button variant="secondary" block onClick={onClose}>Cancel</Button>
          <Button block onClick={submit} disabled={busy}><UserPlus className="size-4" /> {busy ? "Creating…" : "Create account"}</Button>
        </div>
      </div>
    </div>
  );
}

function EditUserModal({ user, onClose, onSaved }: { user: AdminUser; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!fullName.trim()) { toast("Name can't be empty", "error"); return; }
    setBusy(true);
    const res = await updateAdminUser(user.id, { fullName: fullName.trim(), email: email.trim(), phone: phone.trim() });
    setBusy(false);
    if (!res.ok) { toast(res.error ?? "Could not save", "error"); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-mist-100"><Pencil className="size-5 text-lotus-300" /> Edit {user.fullName}</h2>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>
        <p className="mb-3 text-xs text-mist-500">@{user.username} · {user.id}</p>
        <label className="block text-xs font-semibold text-mist-300">Full name</label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={`${modalField} mt-1`} />
        <label className="mt-3 block text-xs font-semibold text-mist-300">Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} className={`${modalField} mt-1`} placeholder="—" />
        <label className="mt-3 block text-xs font-semibold text-mist-300">Mobile number</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className={`${modalField} mt-1`} placeholder="—" />
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" block onClick={onClose}>Cancel</Button>
          <Button block onClick={submit} disabled={busy}><Pencil className="size-4" /> {busy ? "Saving…" : "Save changes"}</Button>
        </div>
      </div>
    </div>
  );
}

// A small labelled detail row inside the profile popup.
function ProfileRow({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-line bg-ink-800/60 px-3 py-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-lotus-300" />
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-mist-500">{label}</div>
        <div className="truncate text-sm text-mist-100">{children}</div>
      </div>
    </div>
  );
}

// Consolidated PROFILE POPUP — opens when an admin clicks a user's name/photo.
// Shows the full identity (photo · name · Unique ID · email · mobile · agency ·
// level · wallet · joined · last seen · status) + quick moderation actions.
// Manual agency assignment (admin User Management): assign / change / remove a
// user's agency via a searchable agency dropdown.
function AgencyAssign({ user, onChanged }: { user: AdminUser; onChanged: () => void }) {
  const { toast } = useToast();
  const [agencies, setAgencies] = useState<AgencyLite[]>([]);
  const [current, setCurrent] = useState<{ name: string; agencyId: string; role: string } | null>(
    user.agencyName ? { name: user.agencyName, agencyId: user.agencyId ?? "", role: user.agencyRole ?? "member" } : null,
  );
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { adminListAgenciesLite().then(setAgencies); }, []);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = agencies.filter((a) => a.agencyId !== current?.agencyId); // hide the one they're already in
    if (!s) return list.slice(0, 8);
    return list.filter((a) => a.name.toLowerCase().includes(s) || a.agencyId.toLowerCase().includes(s)).slice(0, 8);
  }, [q, agencies, current]);

  const assign = async (a: AgencyLite) => {
    setBusy(true);
    const res = await adminTransferMember(a.id, user.id);
    setBusy(false);
    if (res.ok) { setCurrent({ name: a.name, agencyId: a.agencyId, role: "member" }); setQ(""); setOpen(false); toast(`Assigned to ${a.name}`, "success"); onChanged(); }
    else toast(res.error ?? "Could not assign", "error");
  };
  const remove = async () => {
    setBusy(true);
    const res = await adminRemoveUserFromAgency(user.id);
    setBusy(false);
    if (res.ok) { setCurrent(null); toast("Agency assignment removed", "success"); onChanged(); }
    else toast(res.error ?? "Could not remove", "error");
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-mist-500"><Building2 className="size-3.5" /> Agency assignment</div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-mist-300">Current: {current ? <b className="text-mist-100">{current.name}</b> : <span className="text-mist-500">Not assigned</span>}{current?.role ? <span className="ml-1 text-[11px] text-mist-500">· {current.role}</span> : null}</span>
        {current && <button onClick={remove} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50">{busy ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />} Remove</button>}
      </div>
      <div className="relative mt-2">
        <div className="flex items-center gap-2 rounded-lg border border-line bg-ink-800 px-2.5">
          <Search className="size-4 text-mist-500" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder={current ? "Change agency — search by name or AG ID…" : "Assign an agency — search by name or AG ID…"} className="h-9 w-full bg-transparent text-sm text-mist-100 outline-none placeholder:text-mist-500" />
        </div>
        {open && matches.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-white/10 bg-ink-850 py-1 shadow-xl">
            {matches.map((a) => (
              <button key={a.id} onClick={() => assign(a)} disabled={busy} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-white/[0.05] disabled:opacity-50">
                <span className="min-w-0 truncate"><span className="font-semibold text-mist-100">{a.name}</span> <span className="text-[11px] text-mist-500">{a.agencyId}</span></span>
                <span className="shrink-0 text-[11px] text-mist-500">{a.memberCount}/{a.memberLimit}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-mist-500">Assign, change, or remove this user&apos;s agency. Owners can&apos;t be removed here — reassign or delete their agency first.</p>
    </div>
  );
}

// "Referred by" assignment — mirrors AgencyAssign. Admin sets/changes/clears which
// user invited this user (searchable by name / username / ID). Records the relationship
// only (shown in the Users list + profile); it does NOT pay the referrer.
function ReferredByAssign({ user, onChanged }: { user: AdminUser; onChanged: () => void }) {
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [current, setCurrent] = useState<{ id: string; name: string } | null>(
    user.referredById ? { id: user.referredById, name: user.referredByName ?? user.referredById } : null,
  );
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetchAdminUsers().then(setUsers); }, []);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    // Never offer this user themselves, an admin, or the person already set.
    const list = users.filter((u) => u.id !== user.id && u.role !== "admin" && u.id !== current?.id);
    if (!s) return list.slice(0, 8);
    return list.filter((u) => u.fullName.toLowerCase().includes(s) || u.username.toLowerCase().includes(s) || (u.publicId ?? "").toLowerCase().includes(s)).slice(0, 8);
  }, [q, users, user.id, current]);

  const assign = async (u: AdminUser) => {
    setBusy(true);
    const res = await adminSetReferredBy(user.id, u.id);
    setBusy(false);
    if (res.ok) { setCurrent({ id: u.id, name: u.fullName }); setQ(""); setOpen(false); toast(`Referred-by set to ${u.fullName}`, "success"); onChanged(); }
    else toast(res.error ?? "Could not set", "error");
  };
  const remove = async () => {
    setBusy(true);
    const res = await adminSetReferredBy(user.id, "");
    setBusy(false);
    if (res.ok) { setCurrent(null); toast("Referred-by cleared", "success"); onChanged(); }
    else toast(res.error ?? "Could not clear", "error");
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-mist-500"><UserPlus className="size-3.5" /> Referred by</div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-mist-300">Current: {current ? <b className="text-mist-100">{current.name}</b> : <span className="text-mist-500">Not set</span>}</span>
        {current && <button onClick={remove} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50">{busy ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />} Clear</button>}
      </div>
      <div className="relative mt-2">
        <div className="flex items-center gap-2 rounded-lg border border-line bg-ink-800 px-2.5">
          <Search className="size-4 text-mist-500" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder={current ? "Change referrer — search by name, username or ID…" : "Set referrer — search by name, username or ID…"} className="h-9 w-full bg-transparent text-sm text-mist-100 outline-none placeholder:text-mist-500" />
        </div>
        {open && matches.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-white/10 bg-ink-850 py-1 shadow-xl">
            {matches.map((u) => (
              <button key={u.id} onClick={() => assign(u)} disabled={busy} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/[0.05] disabled:opacity-50">
                <Avatar name={u.fullName} src={u.avatar} size="xs" />
                <span className="min-w-0 flex-1 truncate"><span className="font-semibold text-mist-100">{u.fullName}</span> <span className="text-[11px] text-mist-500">@{u.username}</span></span>
                <span className="shrink-0 font-mono text-[10px] text-mist-500">{u.publicId ?? ""}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-mist-500">Set or change who invited this user. This records the referral only — it doesn&apos;t pay the referrer (use Refer-a-Friend for rewards).</p>
    </div>
  );
}

function UserProfileModal({ user, onClose, onEdit, onReset, onActivity, onStatus, onDelete, onChanged }: {
  user: AdminUser;
  onClose: () => void;
  onEdit: (u: AdminUser) => void;
  onReset: (u: AdminUser) => void;
  onActivity: (u: AdminUser) => void;
  onStatus: (u: AdminUser, s: AccountStatus, verb: string) => void;
  onDelete: (u: AdminUser) => void;
  onChanged: () => void;
}) {
  const tier = tierForLevel(user.level ?? 1);
  const online = user.lastSeen ? Date.now() - new Date(user.lastSeen).getTime() < 120_000 : false;
  const fmtDate = (s?: string) => (s ? new Date(s).toLocaleString("en-SA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
  const actionBtn = "inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-3 py-1.5 text-xs font-semibold hover:border-lotus-400/40";
  return (
    <div className="fixed inset-0 z-[85] grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-ink-850" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 border-b border-white/8 p-5">
          <div className="relative shrink-0">
            <Avatar name={user.fullName} src={user.avatar} size="lg" />
            <span className={cn("absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-ink-850", online ? "bg-emerald-400" : "bg-mist-600")} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 font-display text-lg font-extrabold text-mist-100">{user.fullName}{user.verified && <CheckCircle2 className="size-4 text-lotus-400" />}</div>
            <div className="text-xs text-mist-500">@{user.username}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <StatusPill status={user.accountStatus} />
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", user.role === "admin" ? "bg-lotus-500/15 text-lotus-300" : user.role === "moderator" ? "bg-sky-500/15 text-sky-300" : "bg-white/8 text-mist-300")}>{user.role}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", online ? "bg-emerald-500/15 text-emerald-300" : "bg-white/8 text-mist-400")}>{online ? "Online" : "Offline"}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>
        <div className="grid gap-2 p-5 sm:grid-cols-2">
          <ProfileRow icon={Copy} label="Unique ID"><span className="font-mono font-semibold text-lotus-300">{user.publicId || user.id}</span></ProfileRow>
          <ProfileRow icon={Crown} label="Level">Level {user.level} · {tier.name}</ProfileRow>
          <ProfileRow icon={Mail} label="Email">{user.email || "—"}</ProfileRow>
          <ProfileRow icon={Phone} label="Mobile">{user.phone || "—"}</ProfileRow>
          <ProfileRow icon={Building2} label="Agency">{user.agencyName ? `${user.agencyName}${user.agencyRole ? ` · ${user.agencyRole}` : ""}` : "—"}</ProfileRow>
          <ProfileRow icon={Coins} label="Wallet balance"><span className="text-gold-300">🪙 {(user.coins ?? 0).toLocaleString("en-SA")}</span></ProfileRow>
          <ProfileRow icon={Calendar} label="Joined">{fmtDate(user.joinedAt)}</ProfileRow>
          <ProfileRow icon={Clock} label="Last seen">{online ? "Online now" : fmtDate(user.lastSeen)}</ProfileRow>
        </div>
        <div className="border-t border-white/8 p-4">
          <AgencyAssign user={user} onChanged={onChanged} />
        </div>
        <div className="border-t border-white/8 p-4">
          <ReferredByAssign user={user} onChanged={onChanged} />
        </div>
        <div className="border-t border-white/8 p-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-mist-500">Quick actions</div>
          <div className="flex flex-wrap gap-2">
            <Link href={profileHref(user)} target="_blank" className={cn(actionBtn, "text-mist-200")}><ExternalLink className="size-3.5" /> View profile</Link>
            <button onClick={() => onActivity(user)} className={cn(actionBtn, "text-mist-200")}><Activity className="size-3.5" /> Activity</button>
            <button onClick={() => onEdit(user)} className={cn(actionBtn, "text-mist-200")}><Pencil className="size-3.5" /> Edit</button>
            <button onClick={() => onReset(user)} className={cn(actionBtn, "!text-sky-300")}><KeyRound className="size-3.5" /> Reset password</button>
            <button
              onClick={async () => {
                const r = await resetUserMedia(user.id);
                if (r.ok) { onChanged(); alert("Profile picture & cover cleared. If a large image was blocking this account, it will open normally now."); }
                else alert(r.error ?? "Could not reset the image");
              }}
              title="Clear this user's profile picture & cover — fixes an oversized image that blocks the profile"
              className={cn(actionBtn, "text-mist-200")}
            ><ImageOff className="size-3.5" /> Reset image</button>
            <button
              onClick={async () => {
                const r = await resetUserLoginLock(user.id);
                if (r.ok) { onChanged(); alert("Login lock cleared. This member can sign in again right away."); }
                else alert(r.error ?? "Could not clear the login lock");
              }}
              title="Clear the 'Too many failed attempts' lock so this member can log in immediately"
              className={cn(actionBtn, user.locked ? "border-amber-400/40 !text-amber-300" : "text-mist-200")}
            ><Unlock className="size-3.5" /> {user.locked ? `Reset lock (${user.lockMinutes}m left)` : "Reset login lock"}</button>
            {user.accountStatus !== "active"
              ? <button onClick={() => onStatus(user, "active", "is now active")} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20"><Unlock className="size-3.5" /> Activate</button>
              : <button onClick={() => onStatus(user, "suspended", "has been suspended")} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"><UserCog className="size-3.5" /> Suspend</button>}
            <button onClick={() => onStatus(user, "banned", "has been banned")} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"><Ban className="size-3.5" /> Ban</button>
            <button onClick={() => onDelete(user)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"><Trash2 className="size-3.5" /> Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
}
