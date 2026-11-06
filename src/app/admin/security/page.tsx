"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ChangePasswordCard } from "@/components/security/ChangePasswordCard";
import { fetchSecurityInfo, logoutOtherDevices, type SecurityInfo } from "@/lib/account";
import { ShieldCheck, History, MonitorSmartphone, LogOut, KeyRound } from "lucide-react";

function fmt(at?: string | null) {
  if (!at) return "—";
  return new Date(at).toLocaleString("en-SA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Admin Panel → My Security: Change Password + Login History + Active Sessions.
// Mirrors the user Security page but lives inside the admin shell so admins have
// an obvious place to change their own password.
export default function AdminSecurityPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [info, setInfo] = useState<SecurityInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = () => fetchSecurityInfo().then((d) => { setInfo(d); setLoading(false); });
  useEffect(() => { load(); }, []);

  const logoutOthers = async () => {
    setBusy(true);
    const res = await logoutOtherDevices();
    setBusy(false);
    toast(res.ok ? "Signed out of all other devices" : (res.error ?? "Could not sign out other devices"), res.ok ? "success" : "error");
    load();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><ShieldCheck className="size-6 text-lotus-300" /> My Security</h1>
        <p className="text-sm text-mist-400">Change your password, review your login history and active devices.</p>
      </div>

      {/* Change password */}
      <ChangePasswordCard hasPassword={info?.hasPassword ?? true} onDone={load} />

      {/* Forgot password */}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-mist-100"><KeyRound className="size-4 text-amber-300" /> Forgot your password?</h2>
          <p className="mt-1 text-xs text-mist-400">Reset it with a verification code sent to your email or mobile.</p>
          {info?.passwordChangedAt && <p className="mt-1 text-[11px] text-mist-500">Last changed {fmt(info.passwordChangedAt)}</p>}
        </div>
        <Button variant="secondary" onClick={() => router.push("/forgot")}>Reset password</Button>
      </Card>

      {/* Active sessions / devices */}
      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-semibold text-mist-100"><MonitorSmartphone className="size-4 text-emerald-300" /> Active devices &amp; sessions</h2>
        <p className="mt-1 text-xs text-mist-400">This is the device you&apos;re using now. Sign out everywhere else if you suspect someone has your password.</p>
        <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3">
          <div className="flex items-center gap-3">
            <MonitorSmartphone className="size-5 text-emerald-300" />
            <div>
              <div className="text-sm font-semibold text-mist-100">{info?.currentSession.device || "This device"} <span className="ml-1 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">Current</span></div>
              <div className="text-[11px] text-mist-400">Signed in {fmt(info?.currentSession.since)}{info?.currentSession.ip ? ` · ${info.currentSession.ip}` : ""}</div>
            </div>
          </div>
        </div>
        <Button variant="secondary" className="mt-3 !text-rose-300 hover:!bg-rose-500/10" onClick={logoutOthers} disabled={busy}>
          <LogOut className="size-4" /> {busy ? "Signing out…" : "Log out of all other devices"}
        </Button>
      </Card>

      {/* Login history */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b border-white/5 px-5 py-3.5">
          <History className="size-4 text-lotus-300" />
          <h2 className="font-semibold text-mist-100">Login history</h2>
        </div>
        {loading ? (
          <p className="px-5 py-8 text-center text-sm text-mist-500">Loading…</p>
        ) : (info?.loginHistory.length ?? 0) === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-mist-500">No login history recorded yet.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {info!.loginHistory.map((e, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <MonitorSmartphone className="size-4 text-mist-500" />
                  <div>
                    <div className="text-sm text-mist-100">{e.device}</div>
                    <div className="text-[11px] text-mist-500 capitalize">{e.method} sign-in{e.ip ? ` · ${e.ip}` : ""}</div>
                  </div>
                </div>
                <span className="text-xs text-mist-400">{fmt(e.at)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
