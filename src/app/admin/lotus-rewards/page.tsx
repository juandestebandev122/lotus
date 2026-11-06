"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { useConfig, saveConfig } from "@/lib/config";
import {
  fetchLotusRewards, lotusRewardAction, fetchUserLevels,
  type LotusRewardEntry, type UserLevelRow,
} from "@/lib/admin";
import {
  Search, RefreshCw, Loader2, Plus, Trash2, Check, Send, X, Undo2, Info, Gift, History, SlidersHorizontal,
} from "lucide-react";

const fmt = (iso?: string) => { if (!iso) return "—"; try { return new Date(iso).toLocaleString("en-SA", { dateStyle: "medium", timeStyle: "short" }); } catch { return iso; } };
const n = (v: number) => (v || 0).toLocaleString("en-SA");

export default function AdminLotusRewardsPage() {
  const { toast } = useToast();
  const { config, reload: reloadConfig } = useConfig();
  const [rewards, setRewards] = useState<LotusRewardEntry[]>([]);
  const [users, setUsers] = useState<UserLevelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "automatic" | "manual">("all");

  const load = async () => {
    setLoading(true);
    const [r, u] = await Promise.all([fetchLotusRewards(), fetchUserLevels()]);
    setRewards(r); setUsers(u.users); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rewards.filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (!q) return true;
      return `${r.userName} ${r.userPublicId ?? ""} ${r.reason ?? ""} ${r.adminName ?? ""} ${r.at.slice(0, 10)}`.toLowerCase().includes(q);
    });
  }, [rewards, query, typeFilter]);

  const revoke = async (id: string) => {
    if (!window.confirm("Revoke this reward and deduct the flowers from the user?")) return;
    const res = await lotusRewardAction({ action: "revoke", rewardId: id });
    if (res.ok) { toast("Reward revoked", "success"); load(); } else toast(res.error ?? "Failed", "error");
  };

  const totalGranted = rewards.filter((r) => r.status === "granted").reduce((s, r) => s + r.flowers, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-mist-100">🪷 Lotus Flower Rewards</h1>
          <p className="text-sm text-mist-400">Reward members with Lotus Flowers for the coins they SEND — automatic milestones + manual grants. {n(totalGranted)} flowers granted.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={load} disabled={loading}><RefreshCw className={cn("size-4", loading && "animate-spin")} /> Refresh</Button>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-sky-400/20 bg-sky-500/5 px-4 py-3 text-xs text-mist-400">
        <Info className="mt-0.5 size-4 shrink-0 text-sky-300" />
        <p>Lotus Flowers are a <b className="text-mist-200">loyalty/thank-you reward</b> earned by <b className="text-mist-200">sending</b> coins &amp; gifts — separate from the withdrawable Lotus earnings a receiver gets. Each tier below awards its flowers <b className="text-mist-200">once</b>, the first time a member&apos;s lifetime coins-sent crosses that amount.</p>
      </div>

      <AutoRewardConfig config={config} onSaved={reloadConfig} toast={toast} />

      <ManualSend users={users} onSent={load} toast={toast} />

      {/* History */}
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-mist-100"><History className="size-4 text-lotus-300" /> Reward history</h2>
          <div className="flex flex-wrap items-center gap-1.5">
            {(["all", "automatic", "manual"] as const).map((k) => (
              <button key={k} onClick={() => setTypeFilter(k)} className={cn("rounded-full px-3 py-1 text-xs font-semibold capitalize transition", typeFilter === k ? "bg-lotus-500 text-white" : "border border-line bg-ink-800 text-mist-400 hover:text-mist-100")}>{k}</button>
            ))}
          </div>
        </div>
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-line bg-ink-900 px-3">
          <Search className="size-4 text-mist-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by User ID · Username · Date · Admin" className="w-full bg-transparent py-2.5 text-sm text-mist-100 outline-none" />
          {query && <button onClick={() => setQuery("")} className="text-xs text-mist-400 hover:text-mist-100">clear</button>}
        </div>
        {loading ? (
          <div className="grid place-items-center py-10 text-mist-500"><Loader2 className="size-6 animate-spin" /></div>
        ) : shown.length === 0 ? (
          <div className="py-8 text-center text-sm text-mist-500">No rewards yet.</div>
        ) : (
          <div className="space-y-1.5">
            {shown.map((r) => (
              <div key={r.id} className={cn("flex flex-wrap items-center gap-3 rounded-lg border border-line bg-ink-900/50 px-3 py-2", r.status === "revoked" && "opacity-60")}>
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-lotus-500/10 text-base">🪷</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-mist-100">+{r.flowers}</span>
                    <span className="truncate text-mist-300">{r.userName}</span>
                    {r.userPublicId && <span className="font-mono text-[11px] text-lotus-300">ID {r.userPublicId}</span>}
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", r.type === "automatic" ? "bg-sky-500/15 text-sky-300" : "bg-violet-500/15 text-violet-300")}>{r.type}</span>
                    {r.status === "revoked" && <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-300">REVOKED</span>}
                  </div>
                  <div className="mt-0.5 text-[11px] text-mist-500">
                    {fmt(r.at)}{r.threshold ? ` · milestone ${n(r.threshold)} coins` : ""}{r.adminName ? ` · by ${r.adminName}` : ""}{r.reason ? ` · “${r.reason}”` : ""}{r.status === "revoked" && r.revokedBy ? ` · revoked by ${r.revokedBy}` : ""}
                  </div>
                </div>
                {r.status === "granted" && (
                  <button onClick={() => revoke(r.id)} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"><Undo2 className="size-3" /> Revoke</button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function AutoRewardConfig({ config, onSaved, toast }: { config: ReturnType<typeof useConfig>["config"]; onSaved: () => Promise<void> | void; toast: (m: string, t?: "success" | "error" | "info") => void }) {
  const lr = config.lotusRewards ?? { enabled: false, notifyUser: true, validityDays: 0, tiers: [] };
  const [enabled, setEnabled] = useState(lr.enabled);
  const [notifyUser, setNotifyUser] = useState(lr.notifyUser);
  const [validityDays, setValidityDays] = useState(String(lr.validityDays ?? 0));
  const [tiers, setTiers] = useState(lr.tiers.length ? lr.tiers.map((t) => ({ minCoins: String(t.minCoins), flowers: String(t.flowers) })) : [{ minCoins: "", flowers: "" }]);
  const [saving, setSaving] = useState(false);

  const setTier = (i: number, k: "minCoins" | "flowers", v: string) => setTiers((ts) => ts.map((t, j) => (j === i ? { ...t, [k]: v.replace(/\D/g, "") } : t)));
  const addTier = () => setTiers((ts) => [...ts, { minCoins: "", flowers: "" }]);
  const delTier = (i: number) => setTiers((ts) => ts.filter((_, j) => j !== i));

  const save = async () => {
    setSaving(true);
    const clean = tiers.map((t) => ({ minCoins: Number(t.minCoins) || 0, flowers: Number(t.flowers) || 0 })).filter((t) => t.minCoins > 0 && t.flowers > 0).sort((a, b) => a.minCoins - b.minCoins);
    const res = await saveConfig({ lotusRewards: { enabled, notifyUser, validityDays: Number(validityDays) || 0, tiers: clean } });
    setSaving(false);
    if (res.ok) { await onSaved(); toast("Automatic reward settings saved — live now.", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const Toggle = ({ on, set, label, hint }: { on: boolean; set: (v: boolean) => void; label: string; hint: string }) => (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-ink-900/50 p-2.5">
      <div className="min-w-0 flex-1"><div className="text-sm text-mist-100">{label}</div><div className="text-[11px] text-mist-500">{hint}</div></div>
      <button onClick={() => set(!on)} role="switch" aria-checked={on} className={cn("relative h-6 w-11 shrink-0 rounded-full transition", on ? "bg-emerald-500" : "bg-mist-600")}>
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );

  return (
    <Card className="p-4">
      <h2 className="mb-3 flex items-center gap-2 font-semibold text-mist-100"><SlidersHorizontal className="size-4 text-lotus-300" /> Automatic rewards</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <Toggle on={enabled} set={setEnabled} label="Enable automatic rewards" hint="Award Lotus Flowers automatically as members cross the coin-sent milestones below." />
        <Toggle on={notifyUser} set={setNotifyUser} label="Notify the user" hint="Send the “Congratulations!” in-app message on every award." />
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-mist-500">Milestone tiers (coins sent → flowers)</span>
          <button onClick={addTier} className="inline-flex items-center gap-1 text-xs font-semibold text-lotus-300 hover:underline"><Plus className="size-3.5" /> Add tier</button>
        </div>
        <div className="space-y-1.5">
          {tiers.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[11px] text-mist-500">Send</span>
              <input value={t.minCoins} onChange={(e) => setTier(i, "minCoins", e.target.value)} placeholder="100000" className="w-32 rounded-lg border border-line bg-ink-900 px-2.5 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400" />
              <span className="text-[11px] text-mist-500">coins →</span>
              <input value={t.flowers} onChange={(e) => setTier(i, "flowers", e.target.value)} placeholder="10" className="w-20 rounded-lg border border-line bg-ink-900 px-2.5 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400" />
              <span className="text-[11px] text-mist-500">🪷</span>
              <button onClick={() => delTier(i)} className="ml-auto rounded-lg p-1.5 text-mist-500 hover:bg-rose-500/10 hover:text-rose-300"><Trash2 className="size-4" /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-mist-300">Reward validity (days)</span>
          <input value={validityDays} onChange={(e) => setValidityDays(e.target.value.replace(/\D/g, ""))} placeholder="0" className="mt-1 w-28 rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400" />
          <span className="mt-0.5 block text-[11px] text-mist-500">0 = never expires (informational)</span>
        </label>
        <Button size="sm" onClick={save} disabled={saving} className="ml-auto"><Check className="size-4" /> {saving ? "Saving…" : "Save settings"}</Button>
      </div>
    </Card>
  );
}

function ManualSend({ users, onSent, toast }: { users: UserLevelRow[]; onSent: () => Promise<void>; toast: (m: string, t?: "success" | "error" | "info") => void }) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<UserLevelRow | null>(null);
  const [flowers, setFlowers] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return users.filter((u) => `${u.fullName} ${u.username} ${u.publicId} ${u.phone ?? ""}`.toLowerCase().includes(s)).slice(0, 8);
  }, [q, users]);

  const send = async () => {
    if (!picked) return;
    const amt = Number(flowers) || 0;
    if (amt <= 0) { toast("Enter a positive number of flowers", "error"); return; }
    setBusy(true);
    const res = await lotusRewardAction({ action: "give", userId: picked.id, flowers: amt, reason: reason.trim() || undefined });
    setBusy(false);
    if (res.ok) { toast(`Sent ${amt} 🪷 to ${picked.fullName}`, "success"); setPicked(null); setQ(""); setFlowers(""); setReason(""); await onSent(); }
    else toast(res.error ?? "Could not send", "error");
  };

  return (
    <Card className="p-4">
      <h2 className="mb-3 flex items-center gap-2 font-semibold text-mist-100"><Gift className="size-4 text-lotus-300" /> Send Lotus Flowers manually</h2>
      {!picked ? (
        <div className="relative">
          <div className="flex items-center gap-2 rounded-xl border border-line bg-ink-900 px-3">
            <Search className="size-4 text-mist-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a user by name, username, ID or mobile" className="w-full bg-transparent py-2.5 text-sm text-mist-100 outline-none" />
          </div>
          {results.length > 0 && (
            <div className="mt-1 space-y-1 rounded-xl border border-white/10 bg-ink-850 p-1.5">
              {results.map((u) => (
                <button key={u.id} onClick={() => setPicked(u)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/[0.04]">
                  <Avatar name={u.fullName} src={u.avatar} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-mist-100">{u.fullName}</div>
                    <div className="truncate text-[11px] text-mist-500">@{u.username} · ID {u.publicId} · Lv {u.level} · 🪷 {n(u.lotusFlowers)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-line bg-ink-900/50 p-2">
            <Avatar name={picked.fullName} src={picked.avatar} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-mist-100">{picked.fullName}</div>
              <div className="truncate text-[11px] text-mist-500">@{picked.username} · ID {picked.publicId} · currently 🪷 {n(picked.lotusFlowers)}</div>
            </div>
            <button onClick={() => setPicked(null)} className="rounded-lg p-1 text-mist-400 hover:bg-white/5 hover:text-mist-100"><X className="size-4" /></button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="text-xs font-semibold text-mist-300">Lotus Flowers</span>
              <input value={flowers} onChange={(e) => setFlowers(e.target.value.replace(/\D/g, ""))} placeholder="10" className="mt-1 w-28 rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400" />
            </label>
            <label className="block flex-1">
              <span className="text-xs font-semibold text-mist-300">Note (optional)</span>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. loyalty bonus, event prize…" className="mt-1 w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm text-mist-100 outline-none focus:border-lotus-400" />
            </label>
            <Button size="sm" onClick={send} disabled={busy}><Send className="size-4" /> Send</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
