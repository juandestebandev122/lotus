"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { useConfig, saveConfig } from "@/lib/config";
import { fetchDevices, deviceAction, type DeviceRow, type SecurityAlert, type DeviceAccountLite, type DeviceAnalytics } from "@/lib/admin";
import {
  Search, Smartphone, ShieldAlert, MapPin, Wifi, Ban, LogOut, Lock, Unlock, RefreshCw,
  Users, Clock, ChevronDown, ChevronRight, Globe, Loader2, Info, Check, ShieldCheck, Download, FileText, SlidersHorizontal, Trash2,
} from "lucide-react";

const fmt = (iso?: string) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("en-SA", { dateStyle: "medium", timeStyle: "short" }); } catch { return iso; }
};
const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-300", banned: "bg-rose-500/15 text-rose-300",
  suspended: "bg-amber-500/15 text-amber-300", blocked: "bg-orange-500/15 text-orange-300", pending: "bg-sky-500/15 text-sky-300",
};
type FilterKey = "all" | "online" | "offline" | "multi" | "blocked" | "whitelisted";
const userHref = (a: DeviceAccountLite) => `/admin/users?q=${encodeURIComponent(a.publicId || a.id || a.username || a.fullName)}`;
const startOfToday = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
};
const isToday = (iso?: string) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= startOfToday();
};

export default function AdminDevicesPage() {
  const { toast } = useToast();
  const { config, reload: reloadConfig } = useConfig();
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [analytics, setAnalytics] = useState<DeviceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey | "activeToday" | "newToday" | "avg">("all");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [showReports, setShowReports] = useState(false);

  const load = async () => {
    setLoading(true);
    const d = await fetchDevices();
    setDevices(d.devices); setAlerts(d.alerts); setAnalytics(d.analytics ?? null); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = devices;
    if (filter === "online") list = list.filter((d) => d.online);
    else if (filter === "offline") list = list.filter((d) => !d.online);
    else if (filter === "multi") list = list.filter((d) => d.accountCount >= 2);
    else if (filter === "blocked") list = list.filter((d) => d.blocked);
    else if (filter === "whitelisted") list = list.filter((d) => d.whitelisted);
    else if (filter === "activeToday") list = list.filter((d) => isToday(d.lastSeen));
    else if (filter === "newToday") list = list.filter((d) => isToday(d.firstSeen));
    else if (filter === "avg") list = [...list].sort((a, b) => b.accountCount - a.accountCount);
    if (!q) return list;
    return list.filter((d) =>
      d.id.toLowerCase().includes(q) ||
      (d.device ?? "").toLowerCase().includes(q) || (d.os ?? "").toLowerCase().includes(q) || (d.model ?? "").toLowerCase().includes(q) ||
      (d.lastIp ?? "").toLowerCase().includes(q) || (d.lastLocation ?? "").toLowerCase().includes(q) ||
      d.accounts.some((a) => `${a.fullName} ${a.username ?? ""} ${a.email ?? ""} ${a.phone ?? ""} ${a.publicId ?? ""}`.toLowerCase().includes(q)),
    );
  }, [query, filter, devices]);

  const act = async (action: Parameters<typeof deviceAction>[0], deviceId: string, extra?: { reason?: string; userId?: string }, confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(deviceId + action + (extra?.userId ?? ""));
    const res = await deviceAction(action, deviceId, extra);
    setBusy(null);
    if (res.ok) { toast(action === "forceLogout" || action.startsWith("ban") ? `Done — ${res.count ?? 0} account(s) affected` : "Done", "success"); load(); }
    else toast(res.error ?? "Action failed", "error");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-mist-100">Device &amp; Security</h1>
          <p className="text-sm text-mist-400">Devices, the accounts that share them, restrictions, analytics &amp; alerts. {devices.length} device{devices.length === 1 ? "" : "s"}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Button size="sm" variant="secondary" onClick={() => setShowReports((s) => !s)}><Download className="size-4" /> Export report</Button>
            {showReports && <ReportsMenu devices={devices} alerts={alerts} onClose={() => setShowReports(false)} />}
          </div>
          <Button size="sm" variant="secondary" onClick={load} disabled={loading}><RefreshCw className={cn("size-4", loading && "animate-spin")} /> Refresh</Button>
        </div>
      </div>

      {/* Analytics dashboard */}
      {analytics && <AnalyticsDashboard a={analytics} active={filter} onPick={(k) => { setFilter(k); setQuery(""); }} />}

      {/* Restrictions (config) */}
      <Card className="p-0">
        <button onClick={() => setShowRules((s) => !s)} className="flex w-full items-center justify-between gap-2 p-4 text-left">
          <span className="flex items-center gap-2 font-semibold text-mist-100"><SlidersHorizontal className="size-4 text-lotus-300" /> Device restrictions</span>
          {showRules ? <ChevronDown className="size-4 text-mist-400" /> : <ChevronRight className="size-4 text-mist-400" />}
        </button>
        {showRules && <RestrictionsForm config={config} onSaved={reloadConfig} toast={toast} />}
      </Card>

      {/* Honest scope note */}
      <div className="flex items-start gap-2 rounded-xl border border-sky-400/20 bg-sky-500/5 px-4 py-3 text-xs text-mist-400">
        <Info className="mt-0.5 size-4 shrink-0 text-sky-300" />
        <p>A website can report <b className="text-mist-200">OS, browser, screen, language, timezone, IP &amp; IP-location</b> and a stable device id — but <b className="text-mist-200">not</b> the real hardware id, exact brand/model, push token, GPS, or a rooted / jailbroken / emulated / cloned device. Those need the native mobile app (planned). Everything the web can do — full multiple-account detection, restrictions, block / force-logout, analytics &amp; alerts — is here.</p>
      </div>

      {/* Security alerts */}
      {alerts.length > 0 && (
        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-semibold text-mist-100"><ShieldAlert className="size-4 text-amber-300" /> Security alerts <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-300">{alerts.length}</span></h2>
          <div className="mt-3 space-y-1.5">
            {alerts.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-lg border border-line bg-ink-900/50 px-3 py-2">
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", a.severity === "high" ? "bg-rose-500/15 text-rose-300" : a.severity === "medium" ? "bg-amber-500/15 text-amber-300" : "bg-sky-500/15 text-sky-300")}>{a.severity}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-mist-100">{a.title}</div>
                  <div className="truncate text-xs text-mist-500">{a.detail}</div>
                </div>
                {a.deviceId && <button onClick={() => { setFilter("all"); setQuery(a.deviceId!); setOpen((o) => ({ ...o, [a.deviceId!]: true })); }} className="shrink-0 text-xs font-semibold text-lotus-300 hover:underline">View device</button>}
                {a.userId && <Link href={`/admin/users?q=${encodeURIComponent(a.userId)}`} className="shrink-0 text-xs font-semibold text-lotus-300 hover:underline">View user</Link>}
                {a.ip && <button onClick={() => { setFilter("all"); setQuery(a.ip || ""); }} className="shrink-0 text-xs font-semibold text-lotus-300 hover:underline">View IP</button>}
                <button
                  onClick={async () => {
                    const res = await deviceAction("dismissAlert", undefined, { alertId: a.id });
                    if (res.ok) { toast("Alert removed", "success"); load(); }
                    else toast(res.error ?? "Could not remove alert", "error");
                  }}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-rose-400/30 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20"
                  title="Remove this alert from the list"
                >
                  <Trash2 className="size-3.5" /> Delete
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Search + filters */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-ink-900 px-3">
          <Search className="size-4 text-mist-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by Device ID · Username · Mobile · Email · IP · Location · Model" className="w-full bg-transparent py-3 text-sm text-mist-100 outline-none" />
          {query && <button onClick={() => setQuery("")} className="text-xs text-mist-400 hover:text-mist-100">clear</button>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {([["all", "All"], ["activeToday", "Active today"], ["online", "Online"], ["offline", "Offline"], ["newToday", "New today"], ["multi", "Multiple accounts"], ["blocked", "Blocked"], ["whitelisted", "Whitelisted"], ["avg", "Avg accts/device"]] as [FilterKey | "activeToday" | "newToday" | "avg", string][]).map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)} className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition", filter === k ? "bg-lotus-500 text-white" : "border border-line bg-ink-800 text-mist-400 hover:text-mist-100")}>
              {k === "online" && <span className={cn("size-1.5 rounded-full", filter === k ? "bg-white" : "bg-emerald-400")} />}
              {k === "offline" && <span className={cn("size-1.5 rounded-full", filter === k ? "bg-white" : "bg-mist-500")} />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16 text-mist-500"><Loader2 className="size-6 animate-spin" /></div>
      ) : matches.length === 0 ? (
        <Card className="p-8 text-center text-sm text-mist-500">{devices.length === 0 ? "No devices recorded yet — they appear as users sign in on the new version." : "No devices match your search / filter."}</Card>
      ) : (
        <div id="device-list" className="space-y-3">
          {matches.map((d) => {
            const isOpen = open[d.id];
            const shared = d.accountCount >= 2;
            return (
              <Card key={d.id} className={cn("overflow-hidden p-0", shared && "ring-1 ring-amber-400/30")}>
                <div className="flex flex-wrap items-center gap-3 p-4">
                  <div className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-lotus-500/15 text-lotus-300">
                    <Smartphone className="size-5" />
                    <span className={cn("absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-ink-850", d.online ? "bg-emerald-400" : "bg-mist-600")} title={d.online ? "Online now" : "Offline"} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-mist-100">{d.device || "Unknown device"}</span>
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold", d.online ? "bg-emerald-500/15 text-emerald-300" : "bg-ink-700 text-mist-400")}><span className={cn("size-1.5 rounded-full", d.online ? "bg-emerald-400" : "bg-mist-500")} />{d.online ? "ONLINE" : "OFFLINE"}</span>
                      {d.blocked && <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-300">BLOCKED</span>}
                      {d.whitelisted && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">WHITELISTED</span>}
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", shared ? "bg-amber-500/15 text-amber-300" : "bg-ink-700 text-mist-400")}><Users className="mr-0.5 inline size-3" />{d.accountCount} account{d.accountCount === 1 ? "" : "s"}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-mist-500">
                      {d.lastLocation && <span><MapPin className="mr-0.5 inline size-3" /><button onClick={() => setQuery(d.lastLocation || "")} className="hover:text-lotus-300 hover:underline">{d.lastLocation}</button></span>}
                      {d.lastIp && <span><Globe className="mr-0.5 inline size-3" /><button onClick={() => setQuery(d.lastIp || "")} className="hover:text-lotus-300 hover:underline">{d.lastIp}</button></span>}
                      {d.screen && <span>{d.screen}</span>}
                      {d.netType && <span><Wifi className="mr-0.5 inline size-3" />{d.netType}</span>}
                      <span><Clock className="mr-0.5 inline size-3" />seen {fmt(d.lastSeen)}</span>
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-mist-600">ID <button onClick={() => setQuery(d.id)} className="text-lotus-300 hover:underline">{d.id}</button></div>
                  </div>
                  <button onClick={() => setOpen((o) => ({ ...o, [d.id]: !o[d.id] }))} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-mist-300 hover:text-mist-100">
                    {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />} {d.accountCount} account{d.accountCount === 1 ? "" : "s"}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-white/5 bg-ink-900/40 px-4 py-2.5">
                  {d.blocked
                    ? <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => act("unblock", d.id)}><Unlock className="size-3.5" /> Unblock</Button>
                    : <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => act("block", d.id, { reason: "" }, `Block this device? All accounts on it will be refused at login.`)}><Lock className="size-3.5" /> Block</Button>}
                  {d.whitelisted
                    ? <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => act("unwhitelist", d.id)}><ShieldCheck className="size-3.5" /> Remove whitelist</Button>
                    : <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => act("whitelist", d.id)}><ShieldCheck className="size-3.5" /> Whitelist</Button>}
                  <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => act("forceLogout", d.id, undefined, `Force-logout every account on this device now?`)}><LogOut className="size-3.5" /> Force logout all</Button>
                  <Button size="sm" variant="danger" disabled={busy !== null} onClick={() => act("banAll", d.id, { reason: "" }, `BAN every account on this device?`)}><Ban className="size-3.5" /> Ban all</Button>
                </div>

                {isOpen && (
                  <div className="divide-y divide-white/5 border-t border-white/5">
                    {d.accounts.map((a) => <AccountRow key={a.id} a={a} busy={busy} onBan={() => act("banOne", d.id, { userId: a.id, reason: "" }, `Ban ${a.fullName} only?`)} />)}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AnalyticsDashboard({
  a, onPick, active,
}: {
  a: DeviceAnalytics;
  onPick: (k: FilterKey | "activeToday" | "newToday" | "avg") => void;
  active: FilterKey | "activeToday" | "newToday" | "avg";
}) {
  const tiles: [FilterKey | "activeToday" | "newToday" | "avg", string, number | string, string][] = [
    ["all", "Total devices", a.totalDevices, "text-mist-100"],
    ["activeToday", "Active today", a.activeToday, "text-emerald-300"],
    ["online", "Online now", a.onlineDevices, "text-emerald-300"],
    ["offline", "Offline", a.offlineDevices, "text-mist-300"],
    ["newToday", "New today", a.newToday, "text-sky-300"],
    ["multi", "Multi-account", a.multiAccountDevices, "text-amber-300"],
    ["blocked", "Blocked", a.blockedDevices, "text-rose-300"],
    ["avg", "Avg accts/device", a.avgAccountsPerDevice, "text-mist-100"],
  ];
  return (
    <Card className="p-5">
      <h2 className="mb-3 flex items-center gap-2 font-semibold text-mist-100"><Smartphone className="size-4 text-lotus-300" /> Analytics</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map(([key, label, val, color]) => (
          <button
            key={label}
            onClick={() => { onPick(key); window.location.hash = "device-list"; }}
            className={cn(
              "rounded-xl border border-line bg-ink-900/50 p-3 text-left transition hover:border-lotus-400/40 hover:bg-white/[0.03]",
              active === key && "border-lotus-400/50 ring-1 ring-lotus-400/30",
            )}
            title={`Show ${label.toLowerCase()}`}
          >
            <div className={cn("font-display text-2xl font-extrabold tabular-nums", color)}>{val}</div>
            <div className="text-[11px] text-mist-500">{label}</div>
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Breakdown title="Platform (OS)" rows={a.byPlatform.map((p) => [p.platform, p.count])} total={a.totalDevices} />
        <Breakdown title="Country" rows={a.byCountry.map((c) => [c.country, c.count])} total={a.totalDevices} />
      </div>
    </Card>
  );
}
function Breakdown({ title, rows, total }: { title: string; rows: [string, number][]; total: number }) {
  return (
    <div className="rounded-xl border border-line bg-ink-900/50 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-mist-500">{title}</div>
      {rows.length === 0 ? <div className="text-xs text-mist-600">No data yet.</div> : (
        <div className="space-y-1.5">
          {rows.slice(0, 6).map(([name, count]) => (
            <div key={name} className="flex items-center gap-2 text-xs">
              <span className="w-24 shrink-0 truncate text-mist-300">{name}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-800"><div className="h-full rounded-full bg-lotus-500" style={{ width: `${total ? Math.round((count / total) * 100) : 0}%` }} /></div>
              <span className="w-8 shrink-0 text-right tabular-nums text-mist-400">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RestrictionsForm({ config, onSaved, toast }: { config: ReturnType<typeof useConfig>["config"]; onSaved: () => Promise<void> | void; toast: (m: string, t?: "success" | "error" | "info") => void }) {
  const ds = config.deviceSecurity ?? {};
  const [f, setF] = useState({
    maxAccountsPerDevice: ds.maxAccountsPerDevice ?? 0, maxDevicesPerAccount: ds.maxDevicesPerAccount ?? 0,
    blockMultiAccountPerDevice: ds.blockMultiAccountPerDevice ?? false, whitelistMode: ds.whitelistMode ?? false,
    retentionDays: ds.retentionDays ?? 0,
    alertNewDevice: ds.alertNewDevice ?? false, alertNewDeviceUser: ds.alertNewDeviceUser ?? false, alertMultiAccount: ds.alertMultiAccount ?? true,
    alertBlockedAttempt: ds.alertBlockedAttempt ?? true, alertFailedLogins: ds.alertFailedLogins ?? false,
    failedLoginThreshold: ds.failedLoginThreshold ?? 5,
  });
  const [saving, setSaving] = useState(false);
  const single = config.inactivity?.singleSession === true;
  const save = async () => {
    setSaving(true);
    const res = await saveConfig({ deviceSecurity: f });
    setSaving(false);
    if (res.ok) { await onSaved(); toast("Device restrictions saved — live now.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };
  const num = (k: keyof typeof f, label: string, hint: string) => (
    <label className="block">
      <span className="text-xs font-semibold text-mist-300">{label}</span>
      <input type="number" min={0} value={(f[k] as number) || ""} onChange={(e) => setF({ ...f, [k]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} placeholder="0" className="mt-1 w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400" />
      <span className="mt-0.5 block text-[11px] text-mist-500">{hint}</span>
    </label>
  );
  const tog = (k: keyof typeof f, label: string, hint: string) => (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-ink-900/50 p-2.5">
      <div className="min-w-0 flex-1"><div className="text-sm text-mist-100">{label}</div><div className="text-[11px] text-mist-500">{hint}</div></div>
      <button onClick={() => setF({ ...f, [k]: !(f[k] as boolean) })} role="switch" aria-checked={f[k] as boolean} className={cn("relative h-6 w-11 shrink-0 rounded-full transition", f[k] ? "bg-emerald-500" : "bg-mist-600")}>
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", f[k] ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );
  return (
    <div className="space-y-4 border-t border-white/5 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {num("maxAccountsPerDevice", "Max accounts / device", "0 = unlimited")}
        {num("maxDevicesPerAccount", "Max devices / account", "0 = unlimited")}
        {num("retentionDays", "Data retention (days)", "0 = keep forever; older device/login data auto-deleted")}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {tog("blockMultiAccountPerDevice", "One account per device", "Hard block: a device may hold only one account.")}
        {tog("whitelistMode", "Whitelist-only mode", "Only admin-whitelisted devices may log in.")}
      </div>
      <div className="rounded-lg border border-line bg-ink-900/50 p-2.5 text-[11px] text-mist-500">
        <b className="text-mist-300">Multiple simultaneous logins:</b> controlled by <b className="text-mist-300">Single-session</b> in Admin → Settings (currently <b className={single ? "text-emerald-300" : "text-amber-300"}>{single ? "ON — one active session per account" : "OFF — multiple logins allowed"}</b>). <b className="text-mist-300">Blacklist</b> = the per-device Block button below.
      </div>
      <div>
        <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-mist-500">Admin alerts (notifications)</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {tog("alertMultiAccount", "Too many accounts on a device", "Alert when a device exceeds the account limit.")}
          {tog("alertNewDevice", "New-device login (admin)", "Alert admins when an account signs in from a new device.")}
          {tog("alertNewDeviceUser", "New-device login (user)", "Send the account owner a security heads-up on a new-device sign-in.")}
          {tog("alertBlockedAttempt", "Blocked-device login attempt", "Alert when a blocked/unapproved device tries to log in.")}
          {tog("alertFailedLogins", "Repeated failed logins", "Alert after several wrong-password attempts.")}
        </div>
        {f.alertFailedLogins && <div className="mt-2 max-w-xs">{num("failedLoginThreshold", "Failed attempts before alert", "e.g. 5")}</div>}
      </div>
      <p className="text-[11px] text-mist-600"><b className="text-mist-500">Note:</b> rooted / jailbroken / emulator / cloned-app detection can&apos;t be done from a website — those alerts activate with the native app.</p>
      <Button size="sm" onClick={save} disabled={saving}><Check className="size-4" /> {saving ? "Saving…" : "Save restrictions"}</Button>
    </div>
  );
}

function AccountRow({ a, busy, onBan }: { a: DeviceAccountLite; busy: string | null; onBan: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={cn("size-2 shrink-0 rounded-full", a.online ? "bg-emerald-400" : "bg-mist-600")} title={a.online ? "Online now" : "Offline"} />
          <Link href={userHref(a)} className="font-semibold text-mist-100 hover:text-lotus-300 hover:underline">{a.fullName}</Link>
          {a.username && <Link href={userHref(a)} className="text-xs text-mist-500 hover:text-lotus-300 hover:underline">@{a.username}</Link>}
          {a.publicId && <Link href={userHref(a)} className="font-mono text-[11px] text-lotus-300 hover:underline">ID {a.publicId}</Link>}
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold capitalize", STATUS_STYLE[a.accountStatus ?? "active"] ?? "bg-ink-700 text-mist-400")}>{a.accountStatus ?? "active"}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-mist-500">
          {a.email && <Link href={userHref(a)} className="hover:text-lotus-300 hover:underline">{a.email}</Link>}
          {a.phone && <Link href={userHref(a)} className="hover:text-lotus-300 hover:underline">{a.phone}</Link>}
          <span>Reg {fmt(a.createdAt)}</span>
          <span>Last seen {fmt(a.lastSeen)}</span>
        </div>
      </div>
      {a.accountStatus !== "banned" && (
        <button onClick={onBan} disabled={busy !== null} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50">
          <Ban className="size-3" /> Ban
        </button>
      )}
    </div>
  );
}

// ---- Reports (CSV / Excel / PDF) ----
function ReportsMenu({ devices, alerts, onClose }: { devices: DeviceRow[]; alerts: SecurityAlert[]; onClose: () => void }) {
  const reports: { key: string; label: string; cols: string[]; rows: () => (string | number)[][] }[] = [
    { key: "devices", label: "Device List", cols: ["Device ID", "Device", "OS", "Online", "Location", "IP", "Accounts", "Blocked", "Whitelisted", "First seen", "Last seen"],
      rows: () => devices.map((d) => [d.id, d.device ?? "", d.os ?? "", d.online ? "online" : "offline", d.lastLocation ?? "", d.lastIp ?? "", d.accountCount, d.blocked ? "yes" : "", d.whitelisted ? "yes" : "", d.firstSeen, d.lastSeen]) },
    { key: "loginhistory", label: "Device Login History", cols: ["Date & time", "Device ID", "Device", "User ID", "Username", "Full name", "Method", "Result", "IP", "Location"],
      rows: () => devices.flatMap((d) => (d.loginHistory ?? []).map((h) => [h.at, d.id, d.device ?? "", h.userId, h.username ?? "", h.fullName, h.method ?? "", h.success ? "success" : "failed", h.ip ?? "", h.location ?? ""])) },
    { key: "multi", label: "Multi-Account Report", cols: ["Device ID", "Device", "Location", "Accounts", "Usernames"],
      rows: () => devices.filter((d) => d.accountCount >= 2).map((d) => [d.id, d.device ?? "", d.lastLocation ?? "", d.accountCount, d.accounts.map((a) => a.username || a.fullName).join(" | ")]) },
    { key: "blocked", label: "Blocked Devices", cols: ["Device ID", "Device", "Location", "Reason", "Accounts"],
      rows: () => devices.filter((d) => d.blocked).map((d) => [d.id, d.device ?? "", d.lastLocation ?? "", d.blockedReason ?? "", d.accountCount]) },
    { key: "suspicious", label: "Suspicious Devices", cols: ["Severity", "Type", "Title", "Detail"],
      rows: () => alerts.map((a) => [a.severity, a.kind, a.title, a.detail]) },
    { key: "userdevice", label: "User Device Report", cols: ["Device ID", "Device", "User ID", "Username", "Full name", "Mobile", "Email", "Status"],
      rows: () => devices.flatMap((d) => d.accounts.map((a) => [d.id, d.device ?? "", a.publicId ?? a.id, a.username ?? "", a.fullName, a.phone ?? "", a.email ?? "", a.accountStatus ?? "active"])) },
  ];
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const download = (name: string, mime: string, content: string) => {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const stamp = () => new Date().toISOString().slice(0, 10);
  const doCsv = (r: typeof reports[number]) => download(`${r.key}-${stamp()}.csv`, "text/csv;charset=utf-8;", [r.cols, ...r.rows()].map((row) => row.map(esc).join(",")).join("\n"));
  const doXls = (r: typeof reports[number]) => {
    const html = `<html><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>${r.cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${r.rows().map((row) => `<tr>${row.map((c) => `<td>${String(c).replace(/</g, "&lt;")}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
    download(`${r.key}-${stamp()}.xls`, "application/vnd.ms-excel", html);
  };
  const doPdf = (r: typeof reports[number]) => {
    const html = `<html><head><meta charset="utf-8"><title>${r.label}</title><style>body{font-family:system-ui,Arial,sans-serif;padding:20px;color:#111}h1{font-size:18px}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}th{background:#f2f2f2}</style></head><body><h1>${r.label} — ${stamp()}</h1><table><thead><tr>${r.cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${r.rows().map((row) => `<tr>${row.map((c) => `<td>${String(c).replace(/</g, "&lt;")}</td>`).join("")}</tr>`).join("")}</tbody></table><script>window.onload=function(){window.print()}</script></body></html>`;
    const w = window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); }
  };
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute right-0 z-40 mt-1 w-72 rounded-xl border border-white/10 bg-ink-850 p-2 shadow-2xl">
        <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-mist-500">Export a report</div>
        {reports.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.04]">
            <span className="flex items-center gap-1.5 text-sm text-mist-200"><FileText className="size-3.5 text-mist-500" /> {r.label}</span>
            <span className="flex shrink-0 gap-1">
              <button onClick={() => doCsv(r)} className="rounded bg-ink-800 px-1.5 py-0.5 text-[10px] font-bold text-mist-300 hover:text-mist-100" title="CSV">CSV</button>
              <button onClick={() => doXls(r)} className="rounded bg-ink-800 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 hover:brightness-125" title="Excel">XLS</button>
              <button onClick={() => doPdf(r)} className="rounded bg-ink-800 px-1.5 py-0.5 text-[10px] font-bold text-rose-300 hover:brightness-125" title="Print / Save as PDF">PDF</button>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
