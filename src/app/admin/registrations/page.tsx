"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  fetchRegistrationRequests, approveRegistration, rejectRegistration,
  type RegistrationRequestView,
} from "@/lib/admin";
import { useConfig, saveConfig } from "@/lib/config";
import { cn } from "@/lib/cn";
import { UserPlus, Search, Check, X, Clock, Mail, Smartphone, Calendar, User, RefreshCw, MailCheck, MailWarning, ShieldCheck, Power } from "lucide-react";

function fmt(s?: string) { return s ? new Date(s).toLocaleString("en-SA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; }
function age(dob?: string) { if (!dob) return ""; const d = new Date(dob); if (isNaN(d.getTime())) return ""; const t = new Date(); let a = t.getFullYear() - d.getFullYear(); const m = t.getMonth() - d.getMonth(); if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a--; return `${a} yrs`; }

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: "Waiting for approval", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  rejected: { label: "Rejected", cls: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
};

export default function AdminRegistrationsPage() {
  const { toast } = useToast();
  const { config, reload: reloadConfig } = useConfig();
  const [requests, setRequests] = useState<RegistrationRequestView[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "pending" | "rejected">("pending");
  const [busy, setBusy] = useState<string | null>(null);
  const [savingToggle, setSavingToggle] = useState(false);

  const approvalOn = config.settings?.signupApproval !== false;
  const toggleApproval = async () => {
    setSavingToggle(true);
    const res = await saveConfig({ settings: { ...config.settings, signupApproval: !approvalOn } });
    setSavingToggle(false);
    if (res.ok) { await reloadConfig(); toast(!approvalOn ? "Approval required — new sign-ups now wait for you" : "Approval OFF — new sign-ups are auto-approved", "success"); }
    else toast(res.error ?? "Could not save", "error");
  };

  const load = () => { setLoading(true); fetchRegistrationRequests().then((r) => { setRequests(r); setLoading(false); }); };
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => ({
    pending: requests.filter((r) => r.status === "pending").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  }), [requests]);

  const needle = q.trim().toLowerCase();
  const shown = requests.filter((r) =>
    (status === "all" || r.status === status) &&
    (!needle || [r.fullName, r.username, r.phone, r.email].some((v) => v?.toLowerCase().includes(needle))),
  );

  async function approve(r: RegistrationRequestView) {
    setBusy(r.id);
    const res = await approveRegistration(r.id);
    setBusy(null);
    if (res.ok) { toast(`${r.fullName} approved — they can now sign in`, "success"); load(); }
    else toast(res.error ?? "Could not approve", "error");
  }
  async function reject(r: RegistrationRequestView) {
    const note = window.prompt(`Reject ${r.fullName}'s account? Optionally add a reason:`, "");
    if (note === null) return;
    setBusy(r.id);
    const res = await rejectRegistration(r.id, note);
    setBusy(null);
    if (res.ok) { toast("Account rejected", "info"); load(); }
    else toast(res.error ?? "Could not reject", "error");
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-mist-100"><UserPlus className="size-6 text-lotus-400" /> Account Requests</h1>
          <p className="mt-1 text-sm text-mist-400">New sign-ups awaiting approval. Users stay on &ldquo;Waiting for Admin Approval&rdquo; until you approve. Only approved accounts can access the app.</p>
        </div>
        <Button variant="outline" onClick={load}><RefreshCw className="size-4" /> Refresh</Button>
      </div>

      {/* New-joining approval control */}
      <Card className="flex flex-wrap items-center gap-4 p-5">
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl", approvalOn ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300")}><ShieldCheck className="size-6" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold text-mist-100">New-user approval is {approvalOn ? "ON" : "OFF"}</p>
          <p className="text-sm text-mist-400">{approvalOn
            ? "New sign-ups go to “Waiting for approval” and can't use the app until you approve them here."
            : "New sign-ups are auto-approved and can use the app immediately (no approval needed)."}</p>
        </div>
        <button
          onClick={toggleApproval}
          disabled={savingToggle}
          className={cn("inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:opacity-50", approvalOn ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25" : "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25")}
        >
          <Power className="size-4" /> {savingToggle ? "Saving…" : `Turn ${approvalOn ? "OFF" : "ON"}`}
        </button>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        {([["pending", "Waiting", counts.pending], ["rejected", "Rejected", counts.rejected], ["all", "All", requests.length]] as const).map(([key, label, n]) => (
          <button key={key} onClick={() => setStatus(key)} className={cn("rounded-xl border px-4 py-3 text-left transition", status === key ? "border-lotus-400/50 bg-lotus-500/10" : "border-line bg-ink-850 hover:border-line/80")}>
            <div className="text-2xl font-bold text-mist-100">{n}</div>
            <div className="text-xs text-mist-400">{label}</div>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mist-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, username, mobile, email…" className="h-11 w-full rounded-xl border border-line bg-ink-850 pl-10 pr-3 text-sm text-mist-100 outline-none placeholder:text-mist-500 focus:border-lotus-400" />
      </div>

      {loading ? (
        <Card className="grid place-items-center py-16 text-mist-400"><RefreshCw className="size-5 animate-spin" /></Card>
      ) : shown.length === 0 ? (
        <Card className="grid place-items-center gap-2 py-16 text-center text-mist-400">
          <UserPlus className="size-8 text-mist-600" />
          <p>No {status === "all" ? "" : status} account requests.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-lotus-500/15 text-lotus-300"><User className="size-4.5" /></span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-mist-100">{r.fullName} <span className="text-xs font-normal text-mist-500">@{r.username}{r.gender ? ` · ${r.gender}` : ""}</span></p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {r.publicId && <span className="inline-flex items-center rounded-full bg-ink-800 px-2 py-0.5 font-mono text-[11px] font-semibold text-lotus-300" title="Account ID">🆔 {r.publicId}</span>}
                        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", STATUS_META[r.status]?.cls ?? "bg-white/10 text-mist-300 border-line")}>{STATUS_META[r.status]?.label ?? r.status}</span>
                        {r.emailVerified
                          ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300"><MailCheck className="size-3" /> Email verified</span>
                          : <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300"><MailWarning className="size-3" /> Email not verified</span>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-1.5 text-sm text-mist-300 sm:grid-cols-2">
                    <span className="flex items-center gap-1.5"><Smartphone className="size-3.5 text-mist-500" /> {r.phone || "—"}</span>
                    <span className="flex items-center gap-1.5"><Mail className="size-3.5 text-mist-500" /> {r.email || "—"}</span>
                    <span className="flex items-center gap-1.5"><Calendar className="size-3.5 text-mist-500" /> {r.dob || "—"} {age(r.dob) && <span className="text-mist-500">({age(r.dob)})</span>}</span>
                    <span className="flex items-center gap-1.5"><Clock className="size-3.5 text-mist-500" /> {fmt(r.at)}</span>
                  </div>
                </div>
                {r.status === "pending" && (
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" disabled={busy === r.id} onClick={() => approve(r)}><Check className="size-4" /> Approve</Button>
                    <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => reject(r)}><X className="size-4" /> Reject</Button>
                  </div>
                )}
                {r.status === "rejected" && (
                  <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => approve(r)}><Check className="size-4" /> Approve anyway</Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
