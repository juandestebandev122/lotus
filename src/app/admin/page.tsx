"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ADMIN_NAV } from "@/components/admin/AdminShell";
import { useAuth } from "@/lib/auth";
import { effectivePerms } from "@/lib/admin-perms";
import { cn } from "@/lib/cn";
import { fetchAdminStats, fetchAdminRooms, fetchAdminUsers, fetchAdmins, fetchCompanyProfit, fetchPendingSummary, type AdminStats, type AdminRoom, type AdminUser, type CompanyProfitReport, type PendingApprovalsSummary } from "@/lib/admin";
import {
  Users,
  UserCheck,
  Mic,
  Gamepad2,
  Coins,
  ShieldAlert,
  ShieldCheck,
  Flag,
  Banknote,
  TrendingUp,
  Activity,
  ChevronRight,
  ClipboardCheck,
  RefreshCw,
  ArrowRight,
  LayoutGrid,
} from "lucide-react";

// Section headings for the "All features" directory, keyed by the sidebar item's
// permission. Items with a permission not listed here fall under "Other".
const FEATURE_GROUPS: { perm: string; label: string }[] = [
  { perm: "", label: "General" },
  { perm: "analytics", label: "Analytics" },
  { perm: "users", label: "Users" },
  { perm: "admins", label: "Admins" },
  { perm: "agencies", label: "Agencies" },
  { perm: "rooms", label: "Rooms & groups" },
  { perm: "competitions", label: "Competitions" },
  { perm: "games", label: "Games" },
  { perm: "tournaments", label: "Tournaments" },
  { perm: "coins", label: "Coins & rewards" },
  { perm: "payments", label: "Payments & finance" },
  { perm: "membership", label: "Membership & referrals" },
  { perm: "storage", label: "Storage" },
  { perm: "documents", label: "Documents" },
  { perm: "content", label: "Content & store" },
  { perm: "ads", label: "Advertisements" },
  { perm: "notifications", label: "Notifications" },
  { perm: "reports", label: "Reports" },
  { perm: "moderation", label: "Moderation" },
  { perm: "support", label: "Support" },
  { perm: "settings", label: "Settings" },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const featureGroups = useMemo(() => {
    const perms = effectivePerms(user?.adminRole, user?.adminPermissions);
    const visible = ADMIN_NAV.filter((i) => i.href !== "/admin" && (!i.perm || perms.includes(i.perm)));
    const known = new Set(FEATURE_GROUPS.map((g) => g.perm));
    const groups = FEATURE_GROUPS.map((g) => ({ label: g.label, items: visible.filter((i) => i.perm === g.perm) }));
    groups.push({ label: "Other", items: visible.filter((i) => !known.has(i.perm)) });
    return groups.filter((g) => g.items.length > 0);
  }, [user?.adminRole, user?.adminPermissions]);
  const featureCount = featureGroups.reduce((n, g) => n + g.items.length, 0);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [adminInfo, setAdminInfo] = useState<{ count: number; activeAdmins: number; limit: number } | null>(null);
  const [profit, setProfit] = useState<CompanyProfitReport | null>(null);
  const [pending, setPending] = useState<PendingApprovalsSummary | null>(null);
  const [pendingBusy, setPendingBusy] = useState(false);

  const loadPending = (silent = false) => {
    if (!silent) setPendingBusy(true);
    fetchPendingSummary().then(setPending).finally(() => { if (!silent) setPendingBusy(false); });
  };

  useEffect(() => {
    fetchAdminStats().then(setStats);
    fetchAdminRooms().then(setRooms);
    fetchAdminUsers().then(setUsers);
    fetchAdmins().then((d) => setAdminInfo({ count: d.count, activeAdmins: d.activeAdmins, limit: d.limit }));
    fetchCompanyProfit().then(setProfit).catch(() => {});
    loadPending();
    const id = setInterval(() => loadPending(true), 20000);
    return () => clearInterval(id);
  }, []);

  const cards = [
    { label: "Active Admins", value: adminInfo ? adminInfo.activeAdmins : "—", icon: ShieldCheck, sub: adminInfo ? `${adminInfo.count} total · max ${adminInfo.limit}` : "", href: "/admin/admins" },
    { label: "Total Users", value: stats?.totalUsers ?? "—", icon: Users, sub: stats ? `+${stats.newUsers7d} this week` : "", href: "/admin/users" },
    { label: "Online Now", value: stats?.onlineUsers ?? "—", icon: UserCheck, sub: stats ? `${stats.activeUsers24h} active 24h` : "", href: "/admin/online" },
    { label: "Live Voice Rooms", value: stats?.liveRooms ?? "—", icon: Mic, sub: stats ? `${stats.totalRooms} total` : "", href: "/admin/rooms" },
    { label: "Games Played", value: stats?.gamesPlayed ?? "—", icon: Gamepad2, sub: "all-time", href: "/admin/games-sessions" },
    { label: "Coins in circulation", value: stats ? stats.coins.toLocaleString("en-SA") : "—", icon: Coins, sub: "across all wallets", href: "/admin/transactions" },
    { label: "Pending Reports", value: stats?.pendingReports ?? "—", icon: Flag, sub: "awaiting review", href: "/admin/moderation" },
    { label: "Revenue", value: stats ? `₹${stats.revenue.toLocaleString("en-SA")}` : "—", icon: Banknote, sub: "connect a gateway", href: "/admin/transactions" },
    { label: "Suspended / banned", value: stats?.suspended ?? "—", icon: ShieldAlert, sub: "", href: "/admin/users?status=suspended" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-white">Dashboard overview</h1>
        <p className="text-sm text-mist-400">Welcome back — here&apos;s what&apos;s happening on LotusPlay Connect.</p>
      </div>

      {/* Stat cards — live from the backend */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((s) => {
          const href = (s as { href?: string }).href;
          const body = (
            <Card className={cn("group h-full p-5", href && "cursor-pointer transition hover:border-lotus-400/40 hover:bg-white/[0.03]")}>
              <div className="flex items-start justify-between">
                <span className="grid size-11 place-items-center rounded-lg bg-lotus-500/12 text-lotus-300">
                  <s.icon className="size-5" />
                </span>
                {href && <ChevronRight className="size-4 text-mist-600 transition group-hover:translate-x-0.5 group-hover:text-lotus-300" />}
              </div>
              <div className="mt-4 font-display text-2xl font-extrabold text-white">{s.value}</div>
              <div className="text-sm text-mist-400">{s.label}</div>
              {s.sub && <div className="mt-0.5 text-xs text-mist-500">{s.sub}</div>}
              {href && <div className="mt-1 text-[11px] font-semibold text-lotus-300/80 opacity-0 transition group-hover:opacity-100">View details →</div>}
            </Card>
          );
          return href ? <Link key={s.label} href={href}>{body}</Link> : <div key={s.label}>{body}</div>;
        })}
      </div>

      {/* Unified Pending Approvals — one live count per approval queue across the app. */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display font-bold text-white">
            <ClipboardCheck className="size-5 text-lotus-300" /> Pending approvals
            {pending && <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", pending.total > 0 ? "bg-amber-500/20 text-amber-200" : "bg-emerald-500/15 text-emerald-300")}>{pending.total} total</span>}
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={() => loadPending()} disabled={pendingBusy} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink-800 px-2.5 py-1.5 text-xs font-semibold text-mist-300 hover:border-lotus-400/40 disabled:opacity-50" title="Refresh counts">
              <RefreshCw className={cn("size-3.5", pendingBusy && "animate-spin")} /> Refresh
            </button>
            <Link href="/admin/approvals?tab=history" className="inline-flex items-center gap-1 text-xs font-semibold text-mist-300 hover:text-lotus-200">History</Link>
            <Link href="/admin/approvals" className="inline-flex items-center gap-1 text-xs font-semibold text-lotus-300 hover:text-lotus-200">Open all <ArrowRight className="size-3.5" /></Link>
          </div>
        </div>
        <p className="mt-1 text-xs text-mist-500">Every request across the app that needs an admin decision, counted live. Tap any card to review &amp; act.</p>
        {!pending ? (
          <div className="mt-4 grid h-24 place-items-center text-xs text-mist-600">Loading…</div>
        ) : (
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...pending.categories].sort((a, b) => b.count - a.count).map((c) => (
              <Link key={c.key} href={c.href} className={cn("group flex items-center justify-between gap-2 rounded-xl border p-3 transition", c.count > 0 ? "border-amber-400/25 bg-amber-500/[0.06] hover:border-amber-400/50" : "border-line bg-ink-900/40 hover:border-lotus-400/30")}>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-mist-100">{c.label}</div>
                  <div className="text-[11px] text-mist-500">{c.group}</div>
                </div>
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg text-sm font-extrabold", c.count > 0 ? "bg-amber-500/20 text-amber-200" : "bg-white/[0.05] text-mist-500")}>{c.count}</span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* All features — every admin section from the sidebar this admin can access, grouped by area. */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display font-bold text-white">
            <LayoutGrid className="size-5 text-lotus-300" /> All features
            <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs font-bold text-mist-400">{featureCount}</span>
          </h2>
        </div>
        <p className="mt-1 text-xs text-mist-500">Quick links to every admin section. Tap any tile to open it.</p>
        <div className="mt-4 space-y-5">
          {featureGroups.map((g) => (
            <div key={g.label}>
              <div className="mb-2 flex items-center gap-2 px-1">
                <h3 className="text-xs font-bold uppercase tracking-wide text-mist-400">{g.label}</h3>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-mist-500">{g.items.length}</span>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {g.items.map((item) => (
                  <Link key={item.href} href={item.href} className="group flex items-center gap-3 rounded-xl border border-line bg-ink-900/40 p-3 transition hover:border-lotus-400/30 hover:bg-white/[0.03]">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-lotus-500/12 text-lotus-300">
                      <item.icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-mist-100">{item.label}</span>
                    <ChevronRight className="size-4 shrink-0 text-mist-600 transition group-hover:translate-x-0.5 group-hover:text-lotus-300" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Company Profit Coins — Today / This Month / Total Lifetime */}
      <Link href="/admin/company-profit" className="group block">
        <Card className="cursor-pointer p-5 transition hover:border-gold-400/40 hover:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display font-bold text-white"><Coins className="size-5 text-gold-300" /> Admin Profit <span className="text-xs font-normal text-mist-500">(Company)</span></h2>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold-300/80 opacity-0 transition group-hover:opacity-100">Full ledger · see also Agent &amp; User Profit →</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div>
              <div className="font-display text-2xl font-extrabold text-emerald-300">🪙 {(profit?.today ?? 0).toLocaleString("en-SA")}</div>
              <div className="text-xs text-mist-400">Today</div>
            </div>
            <div>
              <div className="font-display text-2xl font-extrabold text-sky-300">🪙 {(profit?.monthly ?? 0).toLocaleString("en-SA")}</div>
              <div className="text-xs text-mist-400">This month</div>
            </div>
            <div>
              <div className="font-display text-2xl font-extrabold text-gold-300">🪙 {(profit?.totalLifetime ?? 0).toLocaleString("en-SA")}</div>
              <div className="text-xs text-mist-400">Total lifetime</div>
            </div>
          </div>
        </Card>
      </Link>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Chart */}
        <Card className="p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-display font-bold text-white">
                <TrendingUp className="size-4 text-lotus-300" /> User growth
              </h2>
              <p className="text-xs text-mist-500">New sign-ups over the last 8 weeks</p>
            </div>
            <Badge tone="green">Live</Badge>
          </div>
          {stats?.growth && stats.growth.length ? (
            <AreaChart data={stats.growth} />
          ) : (
            <div className="grid h-40 w-full place-items-center text-xs text-mist-600">
              {stats ? "No growth data yet." : "Loading…"}
            </div>
          )}
          <div className="mt-2 flex justify-between text-[10px] text-mist-600">
            {["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"].map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
        </Card>

        {/* Recent activity */}
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 font-display font-bold text-white">
            <Activity className="size-4 text-emerald-300" /> Recent activity
          </h2>
          <div className="space-y-2">
            {(!stats || stats.recent.length === 0) && <p className="px-1 py-4 text-sm text-mist-500">No recent activity.</p>}
            {stats?.recent.map((a, i) => (
              <div key={i} className="flex items-start gap-2 rounded-xl px-1 py-1.5">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-lotus-400" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-mist-200">{a.text}</div>
                  <div className="text-[10px] text-mist-500">
                    {new Date(a.at).toLocaleDateString("en-SA", { day: "numeric", month: "short" })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Recent rooms */}
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 font-display font-bold text-white">
            <Mic className="size-4 text-petal-400" /> Recent rooms
          </h2>
          <div className="space-y-2">
            {rooms.length === 0 && <p className="px-1 py-4 text-sm text-mist-500">No rooms created yet.</p>}
            {rooms.slice(0, 6).map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl px-1 py-2">
                <Avatar name={r.hostName} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{r.name}</div>
                  <div className="truncate text-xs text-mist-400">Host: {r.hostName}</div>
                </div>
                <span className="flex items-center gap-1 text-xs text-mist-400">
                  <Users className="size-3.5" /> {r.capacity}
                </span>
              </div>
            ))}
          </div>
          <Link href="/admin/rooms" className="mt-3 block text-center text-xs font-semibold text-lotus-300 hover:text-lotus-200">
            View all rooms
          </Link>
        </Card>
      </div>

      {/* Recent users */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between p-5">
          <h2 className="flex items-center gap-2 font-display font-bold text-white">
            <Users className="size-4 text-lotus-300" /> Recent users
          </h2>
          <Link href="/admin/users" className="text-xs font-semibold text-lotus-300 hover:text-lotus-200">
            Manage users
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-white/5 text-left text-xs uppercase tracking-wide text-mist-500">
                <th className="px-5 py-3 font-semibold">User</th>
                <th className="px-5 py-3 font-semibold">Level</th>
                <th className="px-5 py-3 font-semibold">Games</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.slice(0, 6).map((u) => (
                <tr key={u.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.fullName} size="sm" />
                      <div>
                        <div className="font-semibold text-white">{u.fullName}</div>
                        <div className="text-xs text-mist-500">@{u.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-mist-300">Lv {u.level}</td>
                  <td className="px-5 py-3 text-mist-300">{u.stats.gamesPlayed}</td>
                  <td className="px-5 py-3">
                    <span
                      className={
                        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium capitalize " +
                        (u.accountStatus === "banned"
                          ? "bg-rose-500/15 text-rose-300"
                          : u.accountStatus === "suspended"
                            ? "bg-amber-500/15 text-amber-300"
                            : "bg-emerald-500/15 text-emerald-300")
                      }
                    >
                      {u.accountStatus}
                    </span>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-center text-sm text-mist-500">Loading users…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function AreaChart({ data }: { data: number[] }) {
  const w = 600;
  const h = 160;
  const max = Math.max(...data) * 1.1;
  const min = Math.min(...data) * 0.85;
  const step = w / (data.length - 1);
  const y = (v: number) => h - ((v - min) / (max - min)) * h;
  const pts = data.map((v, i) => `${i * step},${y(v)}`);
  const line = "M" + pts.join(" L");
  const area = `${line} L${w},${h} L0,${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lineStroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#areaFill)" />
      <path d={line} fill="none" stroke="url(#lineStroke)" strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
