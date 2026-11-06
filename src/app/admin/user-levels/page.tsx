"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { fetchUserLevels, userLevelAction, type UserLevelRow, type LevelAuditEntry } from "@/lib/admin";
import {
  Search, RefreshCw, Loader2, Crown, ChevronUp, ChevronDown, Lock, Unlock, RotateCcw,
  Gift, Coins, Wifi, Star, Gauge, X, Check, Download, ShieldCheck, Clock,
} from "lucide-react";

const fmt = (iso?: string) => { if (!iso) return "—"; try { return new Date(iso).toLocaleString("en-SA", { dateStyle: "medium", timeStyle: "short" }); } catch { return iso; } };
const fmtDate = (iso?: string) => { if (!iso) return "—"; try { return new Date(iso).toLocaleDateString("en-SA", { dateStyle: "medium" }); } catch { return iso; } };
const n = (v: number) => (v || 0).toLocaleString("en-SA");
const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-300", banned: "bg-rose-500/15 text-rose-300",
  suspended: "bg-amber-500/15 text-amber-300", blocked: "bg-orange-500/15 text-orange-300",
  pending: "bg-sky-500/15 text-sky-300", inactive: "bg-ink-700 text-mist-400", rejected: "bg-rose-500/15 text-rose-300",
};
type StatusFilter = "all" | "active" | "suspended" | "banned";
type PresenceFilter = "all" | "online" | "offline";

export default function AdminUserLevelsPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserLevelRow[]>([]);
  const [audit, setAudit] = useState<LevelAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [presence, setPresence] = useState<PresenceFilter>("all");
  const [vipOnly, setVipOnly] = useState(false);
  const [lockedOnly, setLockedOnly] = useState(false);
  const [minLevel, setMinLevel] = useState("");
  const [maxLevel, setMaxLevel] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [manage, setManage] = useState<UserLevelRow | null>(null);

  const load = async () => {
    setLoading(true);
    const d = await fetchUserLevels();
    setUsers(d.users); setAudit(d.audit); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const lo = minLevel ? Number(minLevel) : null, hi = maxLevel ? Number(maxLevel) : null;
    const from = fromDate ? new Date(fromDate).getTime() : null;
    const to = toDate ? new Date(toDate).getTime() + 86_400_000 : null;
    return users.filter((u) => {
      if (status !== "all" && (u.accountStatus || "active") !== status) return false;
      if (presence === "online" && !u.online) return false;
      if (presence === "offline" && u.online) return false;
      if (vipOnly && !u.vip) return false;
      if (lockedOnly && !u.levelLocked) return false;
      if (lo !== null && u.level < lo) return false;
      if (hi !== null && u.level > hi) return false;
      if (from !== null || to !== null) { const t = u.joinedAt ? new Date(u.joinedAt).getTime() : 0; if (from !== null && t < from) return false; if (to !== null && t >= to) return false; }
      if (!q) return true;
      return `${u.fullName} ${u.username} ${u.publicId} ${u.phone ?? ""} ${u.email ?? ""}`.toLowerCase().includes(q);
    });
  }, [users, query, status, presence, vipOnly, lockedOnly, minLevel, maxLevel, fromDate, toDate]);

  const exportCsv = () => {
    const cols = ["User ID", "Username", "Name", "Mobile", "Registered", "Level", "Locked", "XP", "Tier", "Coins", "Lotus Flowers", "Gifts Sent", "Gifts Received", "Coins Sent", "Recharge", "VIP", "Online", "Last Login", "Status"];
    const rows = matches.map((u) => [u.publicId || u.id, u.username, u.fullName, u.phone ?? "", u.joinedAt, u.level, u.levelLocked ? "yes" : "", u.xp, u.tierName, u.coins, u.lotusFlowers, u.giftsSent, u.giftsReceived, u.coinsSent, u.rechargeAmount, u.vip ? "yes" : "", u.online ? "online" : "offline", u.lastLogin ?? "", u.accountStatus]);
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [cols, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `user-levels-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-mist-100">User Levels</h1>
          <p className="text-sm text-mist-400">Every member&apos;s level, XP, coins, gifts, recharge &amp; status — with manual level control. {users.length} user{users.length === 1 ? "" : "s"}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={exportCsv}><Download className="size-4" /> Export</Button>
          <Button size="sm" variant="secondary" onClick={load} disabled={loading}><RefreshCw className={cn("size-4", loading && "animate-spin")} /> Refresh</Button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-ink-900 px-3">
          <Search className="size-4 text-mist-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by User ID · Username · Name · Mobile" className="w-full bg-transparent py-3 text-sm text-mist-100 outline-none" />
          {query && <button onClick={() => setQuery("")} className="text-xs text-mist-400 hover:text-mist-100">clear</button>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(["all", "active", "suspended", "banned"] as StatusFilter[]).map((k) => (
            <button key={k} onClick={() => setStatus(k)} className={cn("rounded-full px-3 py-1 text-xs font-semibold capitalize transition", status === k ? "bg-lotus-500 text-white" : "border border-line bg-ink-800 text-mist-400 hover:text-mist-100")}>{k === "all" ? "All status" : k}</button>
          ))}
          <span className="mx-1 h-4 w-px bg-white/10" />
          {(["all", "online", "offline"] as PresenceFilter[]).map((k) => (
            <button key={k} onClick={() => setPresence(k)} className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold capitalize transition", presence === k ? "bg-lotus-500 text-white" : "border border-line bg-ink-800 text-mist-400 hover:text-mist-100")}>
              {k === "online" && <span className={cn("size-1.5 rounded-full", presence === k ? "bg-white" : "bg-emerald-400")} />}
              {k === "offline" && <span className={cn("size-1.5 rounded-full", presence === k ? "bg-white" : "bg-mist-500")} />}
              {k === "all" ? "Any presence" : k}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-white/10" />
          <button onClick={() => setVipOnly((v) => !v)} className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition", vipOnly ? "bg-amber-500 text-white" : "border border-line bg-ink-800 text-mist-400 hover:text-mist-100")}><Crown className="size-3" /> VIP</button>
          <button onClick={() => setLockedOnly((v) => !v)} className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition", lockedOnly ? "bg-sky-500 text-white" : "border border-line bg-ink-800 text-mist-400 hover:text-mist-100")}><Lock className="size-3" /> Locked</button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-mist-400">
          <span className="flex items-center gap-1"><Gauge className="size-3.5" /> Level</span>
          <input value={minLevel} onChange={(e) => setMinLevel(e.target.value.replace(/\D/g, ""))} placeholder="min" className="w-16 rounded-lg border border-line bg-ink-900 px-2 py-1.5 text-mist-100 outline-none focus:border-lotus-400" />
          <span>–</span>
          <input value={maxLevel} onChange={(e) => setMaxLevel(e.target.value.replace(/\D/g, ""))} placeholder="max" className="w-16 rounded-lg border border-line bg-ink-900 px-2 py-1.5 text-mist-100 outline-none focus:border-lotus-400" />
          <span className="ml-2 flex items-center gap-1"><Clock className="size-3.5" /> Registered</span>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-lg border border-line bg-ink-900 px-2 py-1.5 text-mist-100 outline-none focus:border-lotus-400" />
          <span>–</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-lg border border-line bg-ink-900 px-2 py-1.5 text-mist-100 outline-none focus:border-lotus-400" />
          {(minLevel || maxLevel || fromDate || toDate) && <button onClick={() => { setMinLevel(""); setMaxLevel(""); setFromDate(""); setToDate(""); }} className="text-mist-400 hover:text-mist-100">reset</button>}
          <span className="ml-auto text-mist-500">{matches.length} shown</span>
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16 text-mist-500"><Loader2 className="size-6 animate-spin" /></div>
      ) : matches.length === 0 ? (
        <Card className="p-8 text-center text-sm text-mist-500">No users match your search / filters.</Card>
      ) : (
        <div className="space-y-2">
          {matches.map((u) => (
            <Card key={u.id} className="p-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative shrink-0">
                  <Avatar name={u.fullName} src={u.avatar} size="md" />
                  <span className={cn("absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-ink-850", u.online ? "bg-emerald-400" : "bg-mist-600")} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-mist-100">{u.fullName}</span>
                    {u.vip && <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300"><Crown className="size-2.5" /> VIP</span>}
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold capitalize", STATUS_STYLE[u.accountStatus] ?? "bg-ink-700 text-mist-400")}>{u.accountStatus}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-mist-500">
                    {u.username && <span>@{u.username}</span>}
                    {u.publicId && <span className="font-mono text-lotus-300">ID {u.publicId}</span>}
                    {u.phone && <span>{u.phone}</span>}
                    <span>Reg {fmtDate(u.joinedAt)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={cn("inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold", u.badgeClass)} title={`${u.tierName} tier`}>
                    {u.tierEmoji} Lv {u.level}{u.levelLocked && <Lock className="size-3" />}
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => setManage(u)}><Gauge className="size-3.5" /> Manage</Button>
                </div>
              </div>
              {/* stat strip */}
              <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-white/5 pt-2 text-[11px] text-mist-400 sm:grid-cols-4 lg:grid-cols-7">
                <Stat icon={<Star className="size-3 text-sky-300" />} label="XP" value={n(u.xp)} />
                <Stat icon={<Coins className="size-3 text-gold-300" />} label="Coins" value={n(u.coins)} />
                <Stat icon={<span className="text-xs">🪷</span>} label="Flowers" value={n(u.lotusFlowers)} />
                <Stat icon={<Gift className="size-3 text-lotus-300" />} label="Gifts sent" value={n(u.giftsSent)} />
                <Stat icon={<Gift className="size-3 text-emerald-300" />} label="Gifts recv" value={n(u.giftsReceived)} />
                <Stat icon={<Coins className="size-3 text-rose-300" />} label="Recharge" value={u.rechargeAmount ? `${u.rechargeCurrency} ${n(u.rechargeAmount)}` : "—"} />
                <Stat icon={<Wifi className="size-3 text-mist-400" />} label="Last login" value={fmt(u.lastLogin)} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {manage && (
        <ManageLevelModal
          user={manage}
          audit={audit.filter((a) => a.userId === manage.id)}
          onClose={() => setManage(null)}
          onDone={async () => { await load(); }}
          toast={toast}
        />
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 truncate">
      {icon}
      <span className="text-mist-500">{label}</span>
      <span className="ml-auto font-semibold tabular-nums text-mist-200">{value}</span>
    </div>
  );
}

function ManageLevelModal({
  user, audit, onClose, onDone, toast,
}: {
  user: UserLevelRow; audit: LevelAuditEntry[]; onClose: () => void; onDone: () => Promise<void>;
  toast: (m: string, t?: "success" | "error" | "info") => void;
}) {
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("1");
  const [target, setTarget] = useState(String(user.level));
  const [busy, setBusy] = useState(false);

  const run = async (action: LevelAuditEntry["action"], value?: number) => {
    setBusy(true);
    const res = await userLevelAction(user.id, action, { value, reason: reason.trim() || undefined });
    setBusy(false);
    if (res.ok) {
      toast(action === "lock" ? "Level locked" : action === "unlock" ? "Level unlocked" : `Level updated → ${res.level}`, "success");
      setReason("");
      await onDone();
      onClose();
    } else toast(res.error ?? "Action failed", "error");
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-ink-850 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={user.fullName} src={user.avatar} size="md" />
            <div>
              <div className="flex items-center gap-2 font-semibold text-mist-100">{user.fullName}
                <span className={cn("inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-bold", user.badgeClass)}>{user.tierEmoji} Lv {user.level}</span>
              </div>
              <div className="text-[11px] text-mist-500">@{user.username} · ID {user.publicId} · {user.tierName} · {user.xp.toLocaleString("en-SA")} XP {user.levelLocked && "· 🔒 locked"}</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-mist-400 hover:bg-white/5 hover:text-mist-100"><X className="size-5" /></button>
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-semibold text-mist-300">Reason (saved to the audit trail)</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. compensation, correction, promotion…" className="mt-1 w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400" />
        </label>

        <div className="mt-4 space-y-3">
          {/* increase / decrease by N */}
          <div className="flex items-center gap-2">
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} className="w-16 rounded-lg border border-line bg-ink-900 px-2 py-2 text-center text-sm text-mist-100 outline-none focus:border-lotus-400" />
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => run("increase", Math.max(1, Number(amount) || 1))}><ChevronUp className="size-4 text-emerald-300" /> Increase</Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => run("decrease", Math.max(1, Number(amount) || 1))}><ChevronDown className="size-4 text-rose-300" /> Decrease</Button>
          </div>
          {/* set exact */}
          <div className="flex items-center gap-2">
            <input value={target} onChange={(e) => setTarget(e.target.value.replace(/\D/g, ""))} className="w-16 rounded-lg border border-line bg-ink-900 px-2 py-2 text-center text-sm text-mist-100 outline-none focus:border-lotus-400" />
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => run("set", Math.max(1, Number(target) || 1))}><Check className="size-4 text-lotus-300" /> Set exact level</Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => run("reset")}><RotateCcw className="size-4 text-amber-300" /> Reset to 1</Button>
          </div>
          {/* lock / unlock */}
          <div className="flex items-center gap-2">
            {user.levelLocked
              ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => run("unlock")}><Unlock className="size-4 text-emerald-300" /> Unlock level</Button>
              : <Button size="sm" variant="secondary" disabled={busy} onClick={() => run("lock")}><Lock className="size-4 text-sky-300" /> Lock level</Button>}
            <span className="text-[11px] text-mist-500">Locked = activity still earns XP but the level number is frozen.</span>
          </div>
        </div>

        {/* audit for this user */}
        <div className="mt-5">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-mist-500"><ShieldCheck className="size-3.5" /> Change history</div>
          {audit.length === 0 ? (
            <div className="rounded-lg border border-line bg-ink-900/50 p-3 text-xs text-mist-500">No manual level changes yet.</div>
          ) : (
            <div className="space-y-1.5">
              {audit.slice(0, 20).map((a) => (
                <div key={a.id} className="rounded-lg border border-line bg-ink-900/50 px-3 py-2 text-[11px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold capitalize text-mist-200">{a.action}</span>
                    {a.action !== "lock" && a.action !== "unlock" && <span className="text-mist-400">{a.previousLevel} → {a.newLevel}</span>}
                    <span className="ml-auto text-mist-500">{fmt(a.at)}</span>
                  </div>
                  <div className="mt-0.5 text-mist-500">by {a.adminName}{a.ip ? ` · ${a.ip}` : ""}{a.reason ? ` · “${a.reason}”` : ""}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <p className="mt-3 text-[11px] text-mist-600">Every change is logged with previous → new level, admin name, date/time, reason and IP.</p>
      </div>
    </div>
  );
}
