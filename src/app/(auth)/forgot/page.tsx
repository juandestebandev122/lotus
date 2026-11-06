"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { PasswordChecklist } from "@/components/security/PasswordChecklist";
import { forgotPassword, resetPassword } from "@/lib/account";
import { isStrongPassword } from "@/lib/password";
import { Mail, Lock, ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = identifier.trim();
    if (!id) { toast("Enter your email or mobile number", "error"); return; }
    setBusy(true);
    const res = await forgotPassword(id);
    setBusy(false);
    if (!res.ok) { toast(res.error ?? "Could not send code", "error"); return; }
    const demoCode = res.data.demoCode as string | undefined;
    toast(demoCode ? `Verification code sent! Demo code: ${demoCode}` : "If an account exists, a reset code has been sent.", "success");
    if (demoCode) setCode(demoCode);
    setStep(2);
  };

  const doReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) { toast("Enter the verification code", "error"); return; }
    if (!isStrongPassword(next)) { toast("Your new password doesn't meet the requirements", "error"); return; }
    if (next !== confirm) { toast("Passwords don't match", "error"); return; }
    setBusy(true);
    const res = await resetPassword(identifier.trim(), code.trim(), next);
    setBusy(false);
    if (!res.ok) { toast(res.error ?? "Could not reset password", "error"); return; }
    toast("Password reset! Please log in with your new password. 🔒", "success");
    router.push("/login");
  };

  const field = "h-12 w-full rounded-xl border border-line bg-ink-800 px-3.5 text-sm text-mist-100 outline-none placeholder:text-mist-500 focus:border-lotus-400";

  return (
    <div className="animate-rise">
      <Link href="/login" className="mb-4 inline-flex items-center gap-1.5 text-sm text-mist-400 hover:text-mist-200"><ArrowLeft className="size-4" /> Back to login</Link>
      <h1 className="flex items-center gap-2 font-display text-3xl font-extrabold text-mist-100"><KeyRound className="size-7 text-lotus-300" /> Forgot password</h1>
      <p className="mt-2 text-mist-300">{step === 1 ? "We'll send a verification code to reset your password." : "Enter the code and choose a new password."}</p>

      {step === 1 ? (
        <form onSubmit={sendCode} className="mt-7 space-y-4">
          <Field label="Email or mobile number">
            <Input placeholder="you@example.com or +966…" icon={<Mail className="size-4" />} value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
          </Field>
          <Button type="submit" block size="lg" disabled={busy}><ShieldCheck className="size-4" /> {busy ? "Sending…" : "Send verification code"}</Button>
        </form>
      ) : (
        <form onSubmit={doReset} className="mt-7 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-mist-200">Verification code</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="6-digit code" className={`${field} mt-1.5 tracking-widest`} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-mist-200">New password</label>
            <div className="relative mt-1.5">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mist-500" />
              <input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="New password" className={`${field} pl-10`} />
            </div>
            <PasswordChecklist value={next} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-mist-200">Confirm new password</label>
            <div className="relative mt-1.5">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mist-500" />
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter new password" className={`${field} pl-10`} />
            </div>
            {confirm && confirm !== next && <p className="mt-1 text-[11px] text-rose-300">Passwords don&apos;t match.</p>}
          </div>
          <Button type="submit" block size="lg" disabled={busy}><KeyRound className="size-4" /> {busy ? "Resetting…" : "Reset password"}</Button>
          <button type="button" onClick={() => setStep(1)} className="w-full text-center text-xs text-mist-400 hover:text-mist-200">Didn&apos;t get a code? Try again</button>
        </form>
      )}
    </div>
  );
}
