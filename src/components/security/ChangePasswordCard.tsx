"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { PasswordChecklist } from "./PasswordChecklist";
import { changePassword } from "@/lib/account";
import { isStrongPassword } from "@/lib/password";
import { KeyRound, Eye, EyeOff, Lock } from "lucide-react";

const field = "h-11 w-full rounded-xl border border-line bg-ink-800 pl-10 pr-10 text-sm text-mist-100 outline-none placeholder:text-mist-500 focus:border-lotus-400";

function PwInput({ value, onChange, placeholder, autoFocus }: { value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative mt-1.5">
      <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mist-500" />
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={field}
      />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-mist-500 hover:text-mist-200">
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

/**
 * Reusable Change Password card — used by both the User Security page and the
 * Admin panel. When the account has no password yet (Google/OTP sign-in), it
 * switches to "Set a password" mode and drops the current-password field.
 */
export function ChangePasswordCard({ hasPassword = true, onDone }: { hasPassword?: boolean; onDone?: () => void }) {
  const { toast } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [logoutOthers, setLogoutOthers] = useState(false);
  const [busy, setBusy] = useState(false);

  const settingFirst = !hasPassword;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingFirst && !current) { toast("Enter your current password", "error"); return; }
    if (!isStrongPassword(next)) { toast("Your new password doesn't meet the requirements", "error"); return; }
    if (next !== confirm) { toast("New password and confirmation don't match", "error"); return; }

    setBusy(true);
    const res = await changePassword(current, next, logoutOthers);
    setBusy(false);
    if (!res.ok) { toast(res.error ?? "Could not update password", "error"); return; }
    toast(settingFirst ? "Password set successfully 🔒" : "Password changed successfully 🔒", "success");
    setCurrent(""); setNext(""); setConfirm(""); setLogoutOthers(false);
    onDone?.();
  };

  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 font-semibold text-mist-100">
        <KeyRound className="size-4 text-lotus-300" /> {settingFirst ? "Set a password" : "Change password"}
      </h2>
      <p className="mt-1 text-xs text-mist-400">
        {settingFirst
          ? "Your account was created with a social/OTP sign-in. Set a password to also log in with email."
          : "Choose a strong password. You'll stay signed in on this device."}
      </p>

      <form onSubmit={submit} className="mt-4 max-w-md space-y-3">
        {!settingFirst && (
          <div>
            <label className="block text-sm font-semibold text-mist-200">Current password</label>
            <PwInput value={current} onChange={setCurrent} placeholder="Enter current password" autoFocus />
          </div>
        )}
        <div>
          <label className="block text-sm font-semibold text-mist-200">New password</label>
          <PwInput value={next} onChange={setNext} placeholder="Enter new password" autoFocus={settingFirst} />
          <PasswordChecklist value={next} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-mist-200">Confirm new password</label>
          <PwInput value={confirm} onChange={setConfirm} placeholder="Re-enter new password" />
          {confirm && confirm !== next && <p className="mt-1 text-[11px] text-rose-300">Passwords don&apos;t match.</p>}
        </div>

        <label className="flex items-center gap-2 pt-1 text-xs text-mist-300">
          <input type="checkbox" checked={logoutOthers} onChange={(e) => setLogoutOthers(e.target.checked)} className="size-4 accent-lotus-500" />
          Log out of all other devices after changing
        </label>

        <Button type="submit" disabled={busy}>
          <KeyRound className="size-4" /> {busy ? "Saving…" : settingFirst ? "Set password" : "Update password"}
        </Button>
      </form>
    </Card>
  );
}
