"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TableSearch } from "@/components/admin/TableControls";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth";
import { fetchAllWithdrawals, decideWithdrawal, type WithdrawalRow } from "@/lib/wallet";
import { WithdrawModal, WithdrawStatusPill } from "@/components/WithdrawModal";
import { cn } from "@/lib/cn";
import { Banknote, Check, X, CheckCheck } from "lucide-react";

const KYC_TONE: Record<string, string> = {
  verified: "bg-emerald-500/15 text-emerald-300",
  pending: "bg-amber-500/15 text-amber-300",
  resubmit: "bg-amber-500/15 text-amber-300",
  rejected: "bg-rose-500/15 text-rose-300",
  unverified: "bg-white/[0.06] text-mist-400",
};

function bankSummary(w: WithdrawalRow): string {
  const b = w.bank;
  if (b && (b.accountHolder || b.iban || b.accountNumber)) {
    return [b.bankName, b.accountHolder, b.iban || b.accountNumber].filter(Boolean).join(" · ");
  }
  return w.details || "—";
}

export function WithdrawalsPanel() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [list, setList] = useState<WithdrawalRow[]>([]);
  const [wq, setWq] = useState("");
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const load = () => fetchAllWithdrawals().then(setList);
  useEffect(() => { load(); }, []);

  const act = async (id: string, decision: "approved" | "rejected" | "completed") => {
    const note = decision === "rejected" ? (typeof window !== "undefined" ? window.prompt("Reason for rejection (optional):") ?? "" : "") : "";
    const ok = await decideWithdrawal(id, decision, note);
    toast(ok ? `Withdrawal ${decision}` : "Could not update", ok ? "success" : "error");
    load();
  };

  // Free-text search across both tables (user, ID, method, bank, status).
  const matches = (w: WithdrawalRow) => {
    const needle = wq.trim().toLowerCase();
    if (!needle) return true;
    return [w.userName, w.userId, w.method, w.status, w.kycStatus, bankSummary(w), w.at.slice(0, 10)]
      .filter(Boolean).join(" ").toLowerCase().includes(needle);
  };
  const pending = list.filter((w) => (w.status === "pending" || w.status === "approved") && matches(w));
  const history = list.filter((w) => (w.status === "completed" || w.status === "rejected") && matches(w));

  const Row = ({ w, actions }: { w: WithdrawalRow; actions: boolean }) => (
    <tr className="border-b border-white/5 last:border-0">
      <td className="px-4 py-3 text-xs text-mist-400">{new Date(w.at).toLocaleString("en-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
      <td className="px-4 py-3">
        <Link href={`/admin/users?q=${encodeURIComponent(w.userId)}`} className="hover:underline">
          <div className="font-medium text-mist-100 hover:text-lotus-300">{w.userName}</div>
          <div className="font-mono text-[10px] text-mist-500">{w.userId}</div>
        </Link>
      </td>
      <td className="px-4 py-3 font-semibold tabular-nums text-petal-300">{w.coins.toLocaleString("en-SA")}</td>
      <td className="px-4 py-3 font-semibold text-emerald-300">
        {w.currency ?? "SAR"} {(w.netAmount ?? w.amountINR).toLocaleString("en-SA")}
        {w.feeAmount ? <div className="text-[10px] font-normal text-mist-500">gross {(w.currency ?? "SAR")} {w.amountINR.toLocaleString("en-SA")} · fee {(w.currency ?? "SAR")} {w.feeAmount.toLocaleString("en-SA")}</div> : null}
      </td>
      <td className="px-4 py-3 text-mist-300 max-w-[220px]">{w.method}<div className="truncate text-[11px] text-mist-500" title={bankSummary(w)}>{bankSummary(w)}</div></td>
      <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize", KYC_TONE[w.kycStatus ?? "unverified"])}>{w.kycStatus ?? "unverified"}</span></td>
      <td className="px-4 py-3"><WithdrawStatusPill status={w.status} /></td>
      <td className="px-4 py-3 text-right">
        {actions ? (
          <div className="flex justify-end gap-1.5">
            {w.status === "pending" && <Button size="sm" variant="secondary" onClick={() => act(w.id, "approved")}><Check className="size-3.5" /> Approve</Button>}
            {(w.status === "pending" || w.status === "approved") && <Button size="sm" onClick={() => act(w.id, "completed")}><CheckCheck className="size-3.5" /> Mark paid</Button>}
            {w.status === "pending" && <Button size="sm" variant="danger" onClick={() => act(w.id, "rejected")}><X className="size-3.5" /></Button>}
          </div>
        ) : (
          <span className="text-xs text-mist-500">{w.note || (w.decidedBy ? `by ${w.decidedBy}` : "—")}</span>
        )}
      </td>
    </tr>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-mist-400">Review cash-out requests. Rejecting refunds the held coins automatically.</p>
        <div className="flex items-center gap-2">
          <TableSearch value={wq} onChange={setWq} placeholder="Search user / ID / method…" className="w-56" />
          <Button size="sm" variant="secondary" onClick={() => setWithdrawOpen(true)}><Banknote className="size-4" /> Withdraw my balance ({(user?.coins ?? 0).toLocaleString("en-SA")} 🪙)</Button>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-mist-500">
                <th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">User</th><th className="px-4 py-3 font-semibold">Coins</th><th className="px-4 py-3 font-semibold">Amount</th><th className="px-4 py-3 font-semibold">Bank details</th><th className="px-4 py-3 font-semibold">KYC</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((w) => <Row key={w.id} w={w} actions />)}
              {pending.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-mist-500">No pending withdrawals.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {history.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-mist-200">History</h3>
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-mist-500">
                    <th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">User</th><th className="px-4 py-3 font-semibold">Coins</th><th className="px-4 py-3 font-semibold">Amount</th><th className="px-4 py-3 font-semibold">Bank details</th><th className="px-4 py-3 font-semibold">KYC</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 text-right font-semibold">By / note</th>
                  </tr>
                </thead>
                <tbody>{history.map((w) => <Row key={w.id} w={w} actions={false} />)}</tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {withdrawOpen && (
        <WithdrawModal
          balance={user?.coins ?? 0}
          onClose={() => setWithdrawOpen(false)}
          onDone={(nb) => { setWithdrawOpen(false); if (nb !== undefined) updateUser({ coins: nb }); load(); }}
        />
      )}
    </div>
  );
}
