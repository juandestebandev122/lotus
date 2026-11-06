"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { fetchViolations, addViolation, resolveViolation, type ViolationView } from "@/lib/admin";
import type { WalletRow } from "@/lib/wallet";
import { cn } from "@/lib/cn";
import { ShieldAlert, Plus, X, Check } from "lucide-react";

const TYPES = ["Fraud", "Payment abuse", "Chargeback", "Cheating", "Spam", "Harassment", "Other"];
const ACTIONS = ["Warning", "Coin penalty", "Account suspended"];

export function ViolationsPanel({ wallets }: { wallets: WalletRow[] }) {
  const { toast } = useToast();
  const [list, setList] = useState<ViolationView[]>([]);
  const [adding, setAdding] = useState(false);

  const load = () => fetchViolations().then(setList);
  useEffect(() => { load(); }, []);

  const resolve = async (id: string) => {
    const ok = await resolveViolation(id);
    toast(ok ? "Violation marked resolved" : "Could not update", ok ? "success" : "error");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-mist-400">Record rule-breaches and apply penalties (coin fines or suspension).</p>
        <Button size="sm" onClick={() => setAdding(true)}><Plus className="size-4" /> Record violation</Button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-mist-500">
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Reason</th>
                <th className="px-4 py-3 font-semibold">Penalty</th>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">By</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((v) => (
                <tr key={v.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3 font-medium text-mist-100">{v.userName}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300">{v.type}</span></td>
                  <td className="px-4 py-3 max-w-[220px] truncate text-mist-300" title={v.reason}>{v.reason || "—"}</td>
                  <td className="px-4 py-3 font-semibold text-petal-300">{v.penaltyCoins > 0 ? `−${v.penaltyCoins.toLocaleString("en-SA")} 🪙` : "—"}</td>
                  <td className="px-4 py-3 text-mist-300">{v.action}</td>
                  <td className="px-4 py-3 text-xs text-mist-400">{v.by}</td>
                  <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", v.status === "active" ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300")}>{v.status}</span></td>
                  <td className="px-4 py-3 text-right">{v.status === "active" && <Button size="sm" variant="secondary" onClick={() => resolve(v.id)}><Check className="size-3.5" /> Resolve</Button>}</td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-mist-500"><ShieldAlert className="mx-auto mb-2 size-6 text-mist-600" />No violations recorded. Use “Record violation” to add one.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {adding && <ViolationModal wallets={wallets} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); toast("Violation recorded", "success"); }} />}
    </div>
  );
}

function ViolationModal({ wallets, onClose, onSaved }: { wallets: WalletRow[]; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [userId, setUserId] = useState(wallets[0]?.id ?? "");
  const [type, setType] = useState(TYPES[0]);
  const [reason, setReason] = useState("");
  const [action, setAction] = useState(ACTIONS[0]);
  const [penaltyCoins, setPenaltyCoins] = useState(0);
  const [busy, setBusy] = useState(false);
  const field = "h-11 w-full rounded-xl border border-line bg-ink-900 px-3.5 text-sm text-mist-100 outline-none focus:border-lotus-400";

  const save = async () => {
    if (!userId) return toast("Select a user", "error");
    setBusy(true);
    const res = await addViolation({ userId, type, reason, action, penaltyCoins: action === "Coin penalty" ? penaltyCoins : 0 });
    setBusy(false);
    if (res.ok) onSaved();
    else toast(res.error ?? "Could not record", "error");
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-ink-850 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-mist-100">Record a violation</h2>
          <button onClick={onClose} className="text-mist-400 hover:text-mist-100"><X className="size-5" /></button>
        </div>

        <label className="block text-xs font-semibold text-mist-300">User</label>
        <select value={userId} onChange={(e) => setUserId(e.target.value)} className={cn(field, "mt-1")}>
          {wallets.map((w) => <option key={w.id} value={w.id}>{w.fullName}{w.email ? ` (${w.email})` : ""}</option>)}
        </select>

        <label className="mt-3 block text-xs font-semibold text-mist-300">Violation type</label>
        <select value={type} onChange={(e) => setType(e.target.value)} className={cn(field, "mt-1")}>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <label className="mt-3 block text-xs font-semibold text-mist-300">Reason / notes</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What happened…" className={cn(field, "mt-1")} />

        <label className="mt-3 block text-xs font-semibold text-mist-300">Penalty action</label>
        <select value={action} onChange={(e) => setAction(e.target.value)} className={cn(field, "mt-1")}>
          {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>

        {action === "Coin penalty" && (
          <>
            <label className="mt-3 block text-xs font-semibold text-mist-300">Coins to deduct</label>
            <input type="number" min={0} value={penaltyCoins} onChange={(e) => setPenaltyCoins(Math.max(0, Number(e.target.value) || 0))} className={cn(field, "mt-1")} />
          </>
        )}

        <div className="mt-5 flex gap-2">
          <Button block variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button block variant="danger" onClick={save} disabled={busy}><ShieldAlert className="size-4" /> Record</Button>
        </div>
      </div>
    </div>
  );
}
