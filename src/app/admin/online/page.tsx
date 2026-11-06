"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { fetchOnlineUsers, onlineUserAction, type OnlineUser } from "@/lib/admin";
import {
  UserCheck, Search, RefreshCw, Download, ExternalLink, MessageSquare, LogOut, Ban, ShieldAlert,
  ShieldCheck, X, Send, MapPin, Smartphone, Globe, Coins, DoorOpen, Loader2,
} from "lucide-react";
import { profileHref } from "@/lib/profile-href";

function fmt(dt?: string): string {
  if (!dt) return "—";
  const d = new Date(dt);
  return Number.isFinite(d.getTime()) ? d.toLocaleString("en-SA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
}
function fmtDate(dt?: string): string {
  if (!dt) return "—";
  const d = new Date(dt);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString("en-SA", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

export default function AdminOnlinePage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");
  const [msgFor, setMsgFor] = useState<OnlineUser | null>(null);

  const load = useCallback(() => fetchOnlineUsers().then((u) => { setUsers(u); setLoading(false); }), []);
  useEffect(() => {
    load();
    // Real-time auto-refresh every 15s (paused when the tab is hidden).
    const t = setInterval(() => { if (typeof document === "undefined" || !document.hidden) load(); }, 15000);
    return () => clearInterval(t);
  }, [load]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) => `${u.fullName} ${u.username} ${u.publicId} ${u.id} ${u.country ?? ""} ${u.city ?? ""} ${u.roomName ?? ""} ${u.email ?? ""} ${u.phone ?? ""} ${u.ip ?? ""}`.toLowerCase().includes(s));
  }, [users, q]);

  const act = async (u: OnlineUser, action: "suspend" | "ban" | "unban" | "logout" | "message", text?: string) => {
    if ((action === "ban" || action === "suspend" || action === "logout") && !window.confirm(`${action[0].toUpperCase()}${action.slice(1)} ${u.fullName}?`)) return;
    setBusy(u.id + action);
    const res = await onlineUserAction(u.id, action, text);
    setBusy("");
    if (res.ok) {
      toast(action === "message" ? "Message sent" : action === "logout" ? "User signed out of all devices" : `User ${action === "unban" ? "reactivated" : action + "ed"}`, "success");
      load();
    } else toast(res.error ?? "Action failed", "error");
  };

  const exportCsv = () => {
    const cols = ["ID", "Username", "Name", "Gender", "Country", "City", "Email", "Mobile", "Registered", "Current login", "Last login", "Current room", "Device", "IP", "Location", "Device ID", "Wallet", "Status"];
    const rows = shown.map((u) => [u.publicId || u.id, u.username, u.fullName, u.gender ?? "", u.country ?? "", u.city ?? "", u.email ?? "", u.phone ?? "", fmtDate(u.registeredAt), fmt(u.currentLoginAt), fmt(u.lastLoginAt), u.roomName ?? "", u.device ?? "", u.ip ?? "", u.location ?? "", u.deviceId ?? "", String(u.coins), u.accountStatus]);
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [cols, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `online-users-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-white"><UserCheck className="size-6 text-emerald-300" /> Online Now</h1>
          <p className="text-sm text-mist-400">Everyone active in the last 2 minutes — live details &amp; quick actions. Auto-refreshes every 15s.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={load}><RefreshCw className="size-4" /> Refresh</Button>
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={shown.length === 0}><Download className="size-4" /> Export CSV</Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-xl border border-line bg-ink-800 px-3">
        <Search className="size-4 text-mist-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, ID, username, country, room, IP, email…" className="h-10 w-full bg-transparent text-sm text-mist-100 outline-none placeholder:text-mist-500" />
        <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-300">{shown.length} online</span>
      </div>

      {loading ? (
        <Card className="p-10 text-center text-sm text-mist-500">Loading online users…</Card>
      ) : shown.length === 0 ? (
        <Card className="p-10 text-center">
          <UserCheck className="mx-auto size-9 text-mist-600" />
          <p className="mt-2 text-sm text-mist-300">{users.length === 0 ? "No users are online right now." : "No online users match your search."}</p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {shown.map((u) => (
            <Card key={u.id} className="p-4">
              {/* Header: avatar + identity + status */}
              <div className="flex items-start gap-3">
                <span className="relative shrink-0">
                  <Avatar name={u.fullName} src={u.avatar || undefined} size="lg" />
                  <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-ink-850 bg-emerald-400" title="Online" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-bold text-white">{u.fullName}</span>
                    <StatusPill status={u.accountStatus} />
                  </div>
                  <div className="truncate text-xs text-mist-400">@{u.username} · ID {u.publicId || u.id}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-mist-500">
                    {u.roomName ? <span className="flex items-center gap-1 text-lotus-300"><DoorOpen className="size-3" /> {u.roomName}</span> : <span className="flex items-center gap-1"><DoorOpen className="size-3" /> Browsing app</span>}
                    <span className="inline-flex items-center gap-1 text-gold-300"><Coins className="size-3" /> {u.coins.toLocaleString("en-SA")}</span>
                    <span>Lv {u.level}</span>
                  </div>
                </div>
              </div>

              {/* Details grid */}
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs sm:grid-cols-3">
                <Field label="Gender" value={u.gender ? cap(u.gender) : "—"} />
                <Field label="Country" value={u.country || u.city ? [u.country, u.city].filter(Boolean).join(", ") : "—"} icon={<Globe className="size-3" />} />
                <Field label="Mobile" value={u.phone || "—"} />
                <Field label="Email" value={u.email || "—"} />
                <Field label="Registered" value={fmtDate(u.registeredAt)} />
                <Field label="Current login" value={fmt(u.currentLoginAt)} />
                <Field label="Last login" value={fmt(u.lastLoginAt)} />
                <Field label="Device" value={u.device || "—"} icon={<Smartphone className="size-3" />} />
                <Field label="IP address" value={u.ip || "—"} icon={<MapPin className="size-3" />} />
                <Field label="Location (approx · from IP)" value={u.location || "—"} icon={<Globe className="size-3" />} />
              </div>

              {/* Actions */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <ActionLink href={profileHref(u)} icon={ExternalLink} label="Profile" />
                <ActionBtn icon={MessageSquare} label="Message" onClick={() => setMsgFor(u)} />
                {u.accountStatus === "suspended" || u.accountStatus === "banned" ? (
                  <ActionBtn icon={ShieldCheck} label="Reactivate" tone="emerald" busy={busy === u.id + "unban"} onClick={() => act(u, "unban")} />
                ) : (
                  <ActionBtn icon={ShieldAlert} label="Suspend" tone="amber" busy={busy === u.id + "suspend"} onClick={() => act(u, "suspend")} />
                )}
                <ActionBtn icon={Ban} label="Ban" tone="rose" busy={busy === u.id + "ban"} onClick={() => act(u, "ban")} />
                <ActionBtn icon={LogOut} label="Logout" busy={busy === u.id + "logout"} onClick={() => act(u, "logout")} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {msgFor && <MessageModal user={msgFor} onClose={() => setMsgFor(null)} onSend={(t) => { act(msgFor, "message", t); setMsgFor(null); }} />}
    </div>
  );
}

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

function Field({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-mist-600">{label}</div>
      <div className="flex items-center gap-1 truncate text-mist-200" title={value}>{icon}<span className="truncate">{value}</span></div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone = status === "banned" ? "bg-rose-500/15 text-rose-300" : status === "suspended" ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300";
  return <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold capitalize", tone)}>{status === "active" ? "online" : status}</span>;
}

function ActionLink({ href, icon: Icon, label }: { href: string; icon: typeof ExternalLink; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 rounded-lg border border-line bg-ink-800 px-2.5 py-1.5 text-[11px] font-semibold text-mist-200 transition hover:bg-ink-700">
      <Icon className="size-3.5" /> {label}
    </Link>
  );
}

function ActionBtn({ icon: Icon, label, onClick, tone, busy }: { icon: typeof ExternalLink; label: string; onClick: () => void; tone?: "amber" | "rose" | "emerald"; busy?: boolean }) {
  const t = tone === "rose" ? "text-rose-300 hover:bg-rose-500/10" : tone === "amber" ? "text-amber-300 hover:bg-amber-500/10" : tone === "emerald" ? "text-emerald-300 hover:bg-emerald-500/10" : "text-mist-200 hover:bg-ink-700";
  return (
    <button onClick={onClick} disabled={busy} className={cn("inline-flex items-center gap-1 rounded-lg border border-line bg-ink-800 px-2.5 py-1.5 text-[11px] font-semibold transition disabled:opacity-50", t)}>
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Icon className="size-3.5" />} {label}
    </button>
  );
}

function MessageModal({ user, onClose, onSend }: { user: OnlineUser; onClose: () => void; onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md space-y-3 rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-bold text-mist-100"><MessageSquare className="size-4 text-lotus-300" /> Message {user.fullName}</h3>
          <button onClick={onClose} className="text-mist-500 hover:text-mist-200"><X className="size-4" /></button>
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message — it's delivered to their notifications." maxLength={500} rows={4} className="w-full rounded-xl border border-line bg-ink-900 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400" autoFocus />
        <Button block disabled={!text.trim()} onClick={() => onSend(text.trim())}><Send className="size-4" /> Send message</Button>
      </div>
    </div>
  );
}
