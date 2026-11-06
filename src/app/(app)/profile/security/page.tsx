"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ChangePasswordCard } from "@/components/security/ChangePasswordCard";
import { fetchSecurityInfo, logoutOtherDevices, deleteMyAccount, type SecurityInfo } from "@/lib/account";
import { useAuth } from "@/lib/auth";
import { ShieldCheck, ArrowLeft, History, MonitorSmartphone, LogOut, KeyRound, IdCard, Trash2, AlertTriangle } from "lucide-react";

function fmt(at?: string | null) {
  if (!at) return "—";
  return new Date(at).toLocaleString("en-SA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function SecuritySettingsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { user, updateUser, logout } = useAuth();
  const [info, setInfo] = useState<SecurityInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Delete-account danger flow.
  const [showDelete, setShowDelete] = useState(false);
  const [delPassword, setDelPassword] = useState("");
  const [delConfirm, setDelConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const load = () => fetchSecurityInfo().then((d) => { setInfo(d); setLoading(false); });
  useEffect(() => { load(); }, []);

  // Clear the admin-forced "must change password" flag locally once it's done.
  const onPasswordChanged = () => { load(); if (user?.mustChangePassword) updateUser({ mustChangePassword: false }); };

  const logoutOthers = async () => {
    setBusy(true);
    const res = await logoutOtherDevices();
    setBusy(false);
    toast(res.ok ? "Signed out of all other devices" : (res.error ?? "Could not sign out other devices"), res.ok ? "success" : "error");
    load();
  };

  const hasPassword = info?.hasPassword ?? true;
  const isAdmin = user?.role === "admin";
  const canConfirmDelete = delConfirm.trim().toUpperCase() === "DELETE" && (!hasPassword || delPassword.length > 0);

  const deleteAccount = async () => {
    if (!canConfirmDelete || deleting) return;
    setDeleting(true);
    const res = await deleteMyAccount(delPassword);
    if (!res.ok) {
      setDeleting(false);
      toast(res.error ?? "Could not delete your account. Please try again.", "error");
      return;
    }
    toast("Your account has been permanently deleted.", "success");
    // Clears local session (Bearer token + cached user) and hard-redirects to /login.
    await logout();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/profile" className="grid size-9 place-items-center rounded-lg border border-line bg-ink-800 text-mist-300 hover:text-mist-100"><ArrowLeft className="size-4" /></Link>
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold text-mist-100"><ShieldCheck className="size-6 text-lotus-300" /> Security &amp; Account</h1>
          <p className="text-sm text-mist-400">Manage your password, review login history and devices, or delete your account.</p>
        </div>
      </div>

      {user?.mustChangePassword && (
        <Card className="flex items-center gap-3 border-amber-500/25 bg-amber-500/[0.06] p-4">
          <ShieldCheck className="size-5 shrink-0 text-amber-300" />
          <p className="text-sm text-mist-200">An administrator requires you to set a new password before continuing.</p>
        </Card>
      )}

      {/* Identity & bank verification (KYC) */}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-mist-100"><IdCard className="size-4 text-lotus-300" /> Identity &amp; Bank Verification (KYC)</h2>
          <p className="mt-1 text-xs text-mist-400">Verify your identity &amp; bank account to enable withdrawals of your earnings.</p>
        </div>
        <Button variant="secondary" onClick={() => router.push("/kyc")}>Manage KYC</Button>
      </Card>

      {/* Change password */}
      <ChangePasswordCard hasPassword={info?.hasPassword ?? true} onDone={onPasswordChanged} />

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

      {/* Delete account (danger zone) — self-service account removal. Hidden for
          administrators, who are managed from the Admin Panel instead. */}
      {!isAdmin && (
        // id + scroll-margin so "Delete My Account" in the menu / search lands
        // straight on this card instead of the top of the page.
        <Card id="delete-account" className="scroll-mt-24 border-rose-500/25 bg-rose-500/[0.05] p-5">
          <h2 className="flex items-center gap-2 font-semibold text-rose-200"><Trash2 className="size-4 text-rose-300" /> Delete account</h2>
          <p className="mt-1 text-xs text-mist-300">
            Permanently delete your Lotus account. Your profile, rooms and activity will be removed and you&apos;ll be signed out on every device. This cannot be undone by you.
          </p>

          {!showDelete ? (
            <Button variant="secondary" className="mt-3 !border-rose-500/30 !text-rose-300 hover:!bg-rose-500/10" onClick={() => setShowDelete(true)}>
              <Trash2 className="size-4" /> Delete my account
            </Button>
          ) : (
            <div className="mt-4 space-y-3 rounded-xl border border-rose-500/25 bg-ink-900/40 p-4">
              <div className="flex items-start gap-2.5 text-sm text-rose-100">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-300" />
                <span>This is permanent. To confirm, type <b className="font-semibold text-rose-200">DELETE</b> below{hasPassword ? " and enter your current password" : ""}.</span>
              </div>

              {hasPassword && (
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-mist-400">Current password</label>
                  <input
                    type="password"
                    value={delPassword}
                    onChange={(e) => setDelPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="w-full rounded-lg border border-line bg-ink-800 px-3 py-2 text-sm text-mist-100 outline-none focus:border-rose-400/50"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-[11px] font-medium text-mist-400">Type DELETE to confirm</label>
                <input
                  type="text"
                  value={delConfirm}
                  onChange={(e) => setDelConfirm(e.target.value)}
                  placeholder="DELETE"
                  className="w-full rounded-lg border border-line bg-ink-800 px-3 py-2 text-sm text-mist-100 outline-none focus:border-rose-400/50"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  className="!bg-rose-600 !text-white hover:!bg-rose-500 disabled:!opacity-50"
                  onClick={deleteAccount}
                  disabled={!canConfirmDelete || deleting}
                >
                  <Trash2 className="size-4" /> {deleting ? "Deleting…" : "Permanently delete account"}
                </Button>
                <Button variant="secondary" onClick={() => { setShowDelete(false); setDelPassword(""); setDelConfirm(""); }} disabled={deleting}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
